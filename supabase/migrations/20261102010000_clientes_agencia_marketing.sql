create table if not exists public.marketing_clientes_agencia (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  business_id uuid null references public.businesses(id) on delete set null,
  nombre text not null,
  tipo text not null default 'EXTERNO',
  sector text null,
  objetivo_principal text null,
  estado text not null default 'ACTIVO',
  presupuesto_mensual numeric(14,2) null,
  moneda text not null default 'MXN',
  created_by uuid not null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint marketing_clientes_tipo_check check (tipo in ('INTERNO', 'EXTERNO')),
  constraint marketing_clientes_estado_check check (estado in ('ACTIVO', 'PAUSADO')),
  constraint marketing_clientes_moneda_check check (moneda in ('MXN', 'USD')),
  constraint marketing_clientes_presupuesto_check check (presupuesto_mensual is null or presupuesto_mensual >= 0),
  constraint marketing_clientes_nombre_check check (char_length(trim(nombre)) between 2 and 120)
);

create unique index if not exists marketing_clientes_nombre_unico_idx
  on public.marketing_clientes_agencia (organization_id, lower(trim(nombre)));

create unique index if not exists marketing_clientes_negocio_interno_idx
  on public.marketing_clientes_agencia (business_id)
  where business_id is not null and tipo = 'INTERNO';

create index if not exists marketing_clientes_contexto_idx
  on public.marketing_clientes_agencia (organization_id, estado, created_at);

alter table public.marketing_clientes_agencia enable row level security;

create policy "Marketing consulta clientes de su organizacion"
on public.marketing_clientes_agencia
for select to authenticated
using (
  exists (
    select 1 from public.usuarios usuario
    where usuario.organization_id = marketing_clientes_agencia.organization_id
      and usuario.auth_user_id = (select auth.uid())
      and usuario.active
      and lower(usuario.role) in ('owner', 'admin', 'marketing')
  )
);

create policy "Marketing crea clientes de su organizacion"
on public.marketing_clientes_agencia
for insert to authenticated
with check (
  created_by = (select auth.uid())
  and exists (
    select 1 from public.usuarios usuario
    where usuario.organization_id = marketing_clientes_agencia.organization_id
      and usuario.auth_user_id = (select auth.uid())
      and usuario.active
      and lower(usuario.role) in ('owner', 'admin', 'marketing')
  )
);

create policy "Marketing actualiza clientes de su organizacion"
on public.marketing_clientes_agencia
for update to authenticated
using (
  exists (
    select 1 from public.usuarios usuario
    where usuario.organization_id = marketing_clientes_agencia.organization_id
      and usuario.auth_user_id = (select auth.uid())
      and usuario.active
      and lower(usuario.role) in ('owner', 'admin', 'marketing')
  )
)
with check (
  exists (
    select 1 from public.usuarios usuario
    where usuario.organization_id = marketing_clientes_agencia.organization_id
      and usuario.auth_user_id = (select auth.uid())
      and usuario.active
      and lower(usuario.role) in ('owner', 'admin', 'marketing')
  )
);

grant select, insert on public.marketing_clientes_agencia to authenticated;
grant update (
  sector,
  objetivo_principal,
  estado,
  presupuesto_mensual,
  moneda,
  updated_at
) on public.marketing_clientes_agencia to authenticated;

alter table public.marketing_cuentas_canal
  add column if not exists cliente_agencia_id uuid null
  references public.marketing_clientes_agencia(id) on delete cascade;

alter table public.marketing_publicaciones
  add column if not exists cliente_agencia_id uuid null
  references public.marketing_clientes_agencia(id) on delete set null;

create index if not exists marketing_cuentas_cliente_idx
  on public.marketing_cuentas_canal (cliente_agencia_id, proveedor, estado);

create index if not exists marketing_publicaciones_cliente_idx
  on public.marketing_publicaciones (cliente_agencia_id, created_at desc);

insert into public.marketing_clientes_agencia (
  organization_id,
  business_id,
  nombre,
  tipo,
  sector,
  objetivo_principal,
  estado,
  created_by
)
select
  negocio.organization_id,
  negocio.id,
  negocio.name,
  'INTERNO',
  'Belleza y cosméticos',
  'Aumentar ventas rentables y recuperar la audiencia de cada canal.',
  'ACTIVO',
  propietaria.auth_user_id
from public.businesses negocio
join lateral (
  select usuario.auth_user_id
  from public.usuarios usuario
  where usuario.organization_id = negocio.organization_id
    and usuario.active
    and lower(usuario.role) in ('owner', 'admin')
    and usuario.auth_user_id is not null
  order by case when lower(usuario.role) = 'owner' then 0 else 1 end
  limit 1
) propietaria on true
where negocio.active
  and lower(negocio.name) = lower('Monys Glam')
on conflict do nothing;
