begin;

create table if not exists public.flotilla_rental_liquidaciones (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  periodo_desde date not null,
  periodo_hasta date not null,
  chofer_nombre text not null,
  placas text not null,
  ganado_calculado numeric(12,2) not null check (ganado_calculado >= 0),
  adelantos_entregados numeric(12,2) not null default 0 check (adelantos_entregados >= 0),
  monto_pagado numeric(12,2) not null check (monto_pagado >= 0),
  adelanto_excedente numeric(12,2) not null default 0 check (adelanto_excedente >= 0),
  estado text not null default 'PAGADA' check (estado in ('PAGADA', 'ANULADA')),
  observaciones text,
  snapshot jsonb not null default '{}'::jsonb,
  registrado_por uuid references auth.users(id) on delete set null,
  pagado_en timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, periodo_desde, periodo_hasta, chofer_nombre, placas),
  check (periodo_desde <= periodo_hasta)
);

create index if not exists flotilla_rental_liquidaciones_periodo_idx
  on public.flotilla_rental_liquidaciones (organization_id, periodo_desde, periodo_hasta, estado);

alter table public.flotilla_rental_liquidaciones enable row level security;
revoke all on public.flotilla_rental_liquidaciones from anon;
grant select, insert, update on public.flotilla_rental_liquidaciones to authenticated;

drop policy if exists flotilla_rental_liquidaciones_admin on public.flotilla_rental_liquidaciones;
create policy flotilla_rental_liquidaciones_admin on public.flotilla_rental_liquidaciones
for all to authenticated
using (public.flotilla_es_admin_de_organizacion(organization_id))
with check (public.flotilla_es_admin_de_organizacion(organization_id));

do $$
begin
  begin
    alter publication supabase_realtime add table public.flotilla_rental_liquidaciones;
  exception when duplicate_object then null;
  end;
end $$;

commit;
