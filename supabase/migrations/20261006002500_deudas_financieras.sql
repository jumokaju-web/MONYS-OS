create table if not exists public.deudas_financieras (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  business_id uuid null references public.businesses(id),
  branch_id uuid null references public.branches(id),
  created_by uuid not null default auth.uid(),
  nombre text not null,
  acreedor text not null,
  tipo text not null,
  alcance text not null default 'NEGOCIO',
  moneda text not null default 'MXN',
  saldo_actual numeric(14, 2) not null,
  pago_mensual numeric(14, 2) null,
  tasa_anual numeric(8, 4) null,
  fecha_proximo_pago date null,
  estado text not null default 'ACTIVA',
  fuente text not null default 'CAPTURA_MANUAL',
  fecha_corte_dato date not null default current_date,
  notas text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint deudas_financieras_tipo_check check (
    tipo in ('SIMPLE', 'REVOLVENTE', 'TERMINAL', 'TARJETA', 'OTRO')
  ),
  constraint deudas_financieras_alcance_check check (
    alcance in ('NEGOCIO', 'PERSONAL_RESPALDA_NEGOCIO')
  ),
  constraint deudas_financieras_estado_check check (
    estado in ('ACTIVA', 'REESTRUCTURADA', 'LIQUIDADA', 'CANCELADA')
  ),
  constraint deudas_financieras_fuente_check check (
    fuente in ('ESTADO_CUENTA', 'CONTRATO', 'BANCA_EN_LINEA', 'CAPTURA_MANUAL')
  ),
  constraint deudas_financieras_saldo_check check (saldo_actual >= 0),
  constraint deudas_financieras_pago_check check (
    pago_mensual is null or pago_mensual >= 0
  ),
  constraint deudas_financieras_tasa_check check (
    tasa_anual is null or tasa_anual >= 0
  )
);

create index if not exists deudas_financieras_contexto_idx
  on public.deudas_financieras (
    organization_id,
    estado,
    fecha_proximo_pago
  );

alter table public.deudas_financieras enable row level security;

drop policy if exists "Duenos administran deudas financieras"
  on public.deudas_financieras;

create policy "Duenos administran deudas financieras"
on public.deudas_financieras
for all
to authenticated
using (
  exists (
    select 1
    from public.usuarios usuario
    where usuario.auth_user_id = (select auth.uid())
      and usuario.organization_id = deudas_financieras.organization_id
      and usuario.active
      and lower(usuario.role) in ('owner', 'admin')
  )
)
with check (
  created_by = (select auth.uid())
  and exists (
    select 1
    from public.usuarios usuario
    where usuario.auth_user_id = (select auth.uid())
      and usuario.organization_id = deudas_financieras.organization_id
      and usuario.active
      and lower(usuario.role) in ('owner', 'admin')
  )
);

