begin;

alter table public.flotilla_rental_liquidaciones
  add column if not exists motivo_anulacion text,
  add column if not exists anulada_por uuid references auth.users(id) on delete set null,
  add column if not exists anulada_en timestamptz;

do $$
declare
  nombre_restriccion text;
begin
  select conname into nombre_restriccion
  from pg_constraint
  where conrelid = 'public.flotilla_rental_liquidaciones'::regclass
    and contype = 'u'
    and pg_get_constraintdef(oid) like '%organization_id%periodo_desde%periodo_hasta%chofer_nombre%placas%'
  limit 1;

  if nombre_restriccion is not null then
    execute format('alter table public.flotilla_rental_liquidaciones drop constraint %I', nombre_restriccion);
  end if;
end $$;

create unique index if not exists flotilla_rental_liquidacion_activa_unica_idx
  on public.flotilla_rental_liquidaciones (organization_id, periodo_desde, periodo_hasta, chofer_nombre, placas)
  where estado = 'PAGADA';

create table if not exists public.flotilla_rental_repartos (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  periodo_desde date not null,
  periodo_hasta date not null,
  socio text not null check (socio in ('Abraham', 'Chory', 'Kary')),
  utilidad_calculada numeric(12,2) not null check (utilidad_calculada >= 0),
  parte_calculada numeric(12,2) not null check (parte_calculada >= 0),
  monto_entregado numeric(12,2) not null check (monto_entregado >= 0),
  estado text not null default 'PAGADO' check (estado in ('PAGADO', 'ANULADO')),
  observaciones text,
  snapshot jsonb not null default '{}'::jsonb,
  registrado_por uuid references auth.users(id) on delete set null,
  pagado_en timestamptz not null default now(),
  motivo_anulacion text,
  anulado_por uuid references auth.users(id) on delete set null,
  anulado_en timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (periodo_desde <= periodo_hasta)
);

create unique index if not exists flotilla_rental_reparto_activo_unico_idx
  on public.flotilla_rental_repartos (organization_id, periodo_desde, periodo_hasta, socio)
  where estado = 'PAGADO';

create index if not exists flotilla_rental_repartos_periodo_idx
  on public.flotilla_rental_repartos (organization_id, periodo_desde, periodo_hasta, estado);

alter table public.flotilla_rental_repartos enable row level security;
revoke all on public.flotilla_rental_repartos from anon;
grant select, insert, update on public.flotilla_rental_repartos to authenticated;

drop policy if exists flotilla_rental_repartos_admin on public.flotilla_rental_repartos;
create policy flotilla_rental_repartos_admin on public.flotilla_rental_repartos
for all to authenticated
using (public.flotilla_es_admin_de_organizacion(organization_id))
with check (public.flotilla_es_admin_de_organizacion(organization_id));

do $$
begin
  begin
    alter publication supabase_realtime add table public.flotilla_rental_repartos;
  exception when duplicate_object then null;
  end;
end $$;

commit;
