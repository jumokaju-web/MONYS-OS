begin;

create table if not exists public.conciliaciones_bancarias (
  id uuid primary key default gen_random_uuid(),
  revision_bancaria_id uuid not null references public.revisiones_bancarias(id) on delete restrict,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  business_id uuid not null references public.businesses(id) on delete cascade,
  branch_id uuid not null references public.branches(id) on delete cascade,
  banco_movimiento_id text not null,
  cash_movement_id uuid not null references public.cash_movements(id) on delete restrict,
  cuenta text not null,
  fecha_banco date not null,
  monto numeric(14,2) not null check (monto > 0),
  direccion text not null check (direccion in ('ENTRADA', 'SALIDA')),
  estado text not null default 'ACTIVA' check (estado in ('ACTIVA', 'ANULADA')),
  snapshot jsonb not null default '{}'::jsonb,
  registrado_por uuid references auth.users(id) on delete set null,
  registrado_en timestamptz not null default now(),
  motivo_anulacion text,
  anulado_por uuid references auth.users(id) on delete set null,
  anulado_en timestamptz
);

create unique index if not exists conciliacion_banco_activa_unica_idx
  on public.conciliaciones_bancarias (revision_bancaria_id, banco_movimiento_id)
  where estado = 'ACTIVA';

create unique index if not exists conciliacion_caja_activa_unica_idx
  on public.conciliaciones_bancarias (revision_bancaria_id, cash_movement_id)
  where estado = 'ACTIVA';

create index if not exists conciliaciones_bancarias_contexto_idx
  on public.conciliaciones_bancarias (organization_id, business_id, branch_id, registrado_en desc);

alter table public.conciliaciones_bancarias enable row level security;
revoke all on public.conciliaciones_bancarias from anon;
grant select, insert, update on public.conciliaciones_bancarias to authenticated;

drop policy if exists conciliaciones_bancarias_owner on public.conciliaciones_bancarias;
create policy conciliaciones_bancarias_owner on public.conciliaciones_bancarias
for all to authenticated
using (
  registrado_por = (select auth.uid())
  and exists (
    select 1 from public.usuarios u
    where u.auth_user_id = (select auth.uid())
      and u.active = true
      and u.role = 'owner'
      and u.organization_id = conciliaciones_bancarias.organization_id
      and u.business_id = conciliaciones_bancarias.business_id
      and u.branch_id = conciliaciones_bancarias.branch_id
  )
)
with check (
  registrado_por = (select auth.uid())
  and exists (
    select 1 from public.usuarios u
    where u.auth_user_id = (select auth.uid())
      and u.active = true
      and u.role = 'owner'
      and u.organization_id = conciliaciones_bancarias.organization_id
      and u.business_id = conciliaciones_bancarias.business_id
      and u.branch_id = conciliaciones_bancarias.branch_id
  )
);

do $$
begin
  begin
    alter publication supabase_realtime add table public.conciliaciones_bancarias;
  exception when duplicate_object then null;
  end;
end $$;

commit;
