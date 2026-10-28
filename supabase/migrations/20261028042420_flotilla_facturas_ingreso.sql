begin;

create table if not exists public.flotilla_facturas_ingreso (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  business_id uuid not null references public.businesses(id) on delete restrict,
  emisor text not null check (length(btrim(emisor)) between 2 and 180),
  folio text not null check (length(btrim(folio)) between 1 and 80),
  periodo_desde date not null,
  periodo_hasta date not null,
  emitida_en timestamptz not null,
  forma_pago text,
  metodo_pago text,
  moneda text not null default 'MXN' check (moneda = 'MXN'),
  subtotal numeric(14,2) not null check (subtotal >= 0),
  iva numeric(14,2) not null check (iva >= 0),
  total numeric(14,2) not null check (total >= 0 and abs(total - subtotal - iva) <= 0.01),
  estado_pago text not null default 'PENDIENTE'
    check (estado_pago in ('PENDIENTE', 'PAGADA', 'CANCELADA')),
  pagada_en timestamptz,
  estado_conciliacion text not null default 'PENDIENTE'
    check (estado_conciliacion in ('PENDIENTE', 'CONCILIADA')),
  cuenta_id uuid references public.accounts(id) on delete restrict,
  movimiento_tesoreria_id uuid references public.cash_movements(id) on delete restrict,
  evidencia_url text,
  nota_auditoria text,
  creado_por uuid references auth.users(id) on delete set null,
  creado_en timestamptz not null default now(),
  actualizado_en timestamptz not null default now(),
  unique (organization_id, business_id, emisor, folio),
  check (periodo_hasta >= periodo_desde),
  check ((estado_pago = 'PAGADA' and pagada_en is not null) or estado_pago <> 'PAGADA'),
  check (estado_conciliacion <> 'CONCILIADA' or (cuenta_id is not null and movimiento_tesoreria_id is not null))
);

create index if not exists flotilla_facturas_ingreso_periodo_idx
  on public.flotilla_facturas_ingreso (organization_id, business_id, periodo_desde, periodo_hasta);

alter table public.flotilla_facturas_ingreso enable row level security;
revoke all on public.flotilla_facturas_ingreso from anon, authenticated;
grant select, insert, update on public.flotilla_facturas_ingreso to authenticated;

drop policy if exists flotilla_facturas_ingreso_select on public.flotilla_facturas_ingreso;
create policy flotilla_facturas_ingreso_select on public.flotilla_facturas_ingreso
  for select to authenticated using (
    exists (
      select 1 from public.usuarios u
      where u.auth_user_id = (select auth.uid())
        and u.active is true
        and u.organization_id = flotilla_facturas_ingreso.organization_id
        and lower(u.role) in ('owner', 'admin', 'director', 'finanzas')
    )
  );

drop policy if exists flotilla_facturas_ingreso_write on public.flotilla_facturas_ingreso;
create policy flotilla_facturas_ingreso_write on public.flotilla_facturas_ingreso
  for all to authenticated using (
    exists (
      select 1 from public.usuarios u
      where u.auth_user_id = (select auth.uid())
        and u.active is true
        and u.organization_id = flotilla_facturas_ingreso.organization_id
        and lower(u.role) in ('owner', 'admin', 'director', 'finanzas')
    )
  ) with check (
    exists (
      select 1 from public.usuarios u
      where u.auth_user_id = (select auth.uid())
        and u.active is true
        and u.organization_id = flotilla_facturas_ingreso.organization_id
        and lower(u.role) in ('owner', 'admin', 'director', 'finanzas')
    )
    and exists (
      select 1 from public.businesses b
      where b.id = flotilla_facturas_ingreso.business_id
        and b.organization_id = flotilla_facturas_ingreso.organization_id
    )
    and (flotilla_facturas_ingreso.cuenta_id is null or exists (
      select 1 from public.accounts a
      where a.id = flotilla_facturas_ingreso.cuenta_id
        and a.organization_id = flotilla_facturas_ingreso.organization_id
    ))
    and (flotilla_facturas_ingreso.movimiento_tesoreria_id is null or exists (
      select 1 from public.cash_movements m
      where m.id = flotilla_facturas_ingreso.movimiento_tesoreria_id
        and m.organization_id = flotilla_facturas_ingreso.organization_id
        and m.business_id = flotilla_facturas_ingreso.business_id
    ))
  );

commit;
