create table if not exists public.creditos_proveedores_confirmaciones (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  business_id uuid not null references public.businesses(id),
  branch_id uuid not null references public.branches(id),
  fecha_corte date not null,
  estado text not null default 'CONFIRMADO_CERO'
    check (estado = 'CONFIRMADO_CERO'),
  nota text not null check (length(btrim(nota)) > 0),
  confirmado_por uuid not null references auth.users(id),
  confirmado_en timestamptz not null default now(),
  constraint creditos_proveedores_confirmaciones_fecha_corte_valida
    check (fecha_corte <= (confirmado_en at time zone 'America/Mexico_City')::date)
);

create index if not exists creditos_proveedores_confirmaciones_sucursal_fecha_idx
  on public.creditos_proveedores_confirmaciones (branch_id, fecha_corte desc, confirmado_en desc);

alter table public.creditos_proveedores_confirmaciones enable row level security;
revoke all on public.creditos_proveedores_confirmaciones from anon;
revoke update, delete on public.creditos_proveedores_confirmaciones from authenticated;
grant select, insert on public.creditos_proveedores_confirmaciones to authenticated;

drop policy if exists monys_creditos_proveedores_confirmaciones_select
  on public.creditos_proveedores_confirmaciones;
create policy monys_creditos_proveedores_confirmaciones_select
on public.creditos_proveedores_confirmaciones for select to authenticated
using (
  exists (
    select 1
    from public.branches sucursal
    join public.businesses negocio on negocio.id = sucursal.business_id
    join public.usuarios actor on actor.auth_user_id = (select auth.uid())
    where sucursal.id = creditos_proveedores_confirmaciones.branch_id
      and sucursal.business_id = creditos_proveedores_confirmaciones.business_id
      and negocio.organization_id = creditos_proveedores_confirmaciones.organization_id
      and actor.active is true
      and actor.organization_id = creditos_proveedores_confirmaciones.organization_id
      and lower(actor.role) in ('owner','admin','director','finanzas','compras')
      and (actor.role = 'owner' or actor.business_id is null or actor.business_id = sucursal.business_id)
      and (actor.role = 'owner' or actor.branch_id is null or actor.branch_id = sucursal.id)
  )
);

drop policy if exists monys_creditos_proveedores_confirmaciones_insert
  on public.creditos_proveedores_confirmaciones;
create policy monys_creditos_proveedores_confirmaciones_insert
on public.creditos_proveedores_confirmaciones for insert to authenticated
with check (
  confirmado_por = (select auth.uid())
  and estado = 'CONFIRMADO_CERO'
  and exists (
    select 1
    from public.branches sucursal
    join public.businesses negocio on negocio.id = sucursal.business_id
    join public.usuarios actor on actor.auth_user_id = (select auth.uid())
    where sucursal.id = creditos_proveedores_confirmaciones.branch_id
      and sucursal.business_id = creditos_proveedores_confirmaciones.business_id
      and negocio.organization_id = creditos_proveedores_confirmaciones.organization_id
      and actor.active is true
      and actor.organization_id = creditos_proveedores_confirmaciones.organization_id
      and lower(actor.role) in ('owner','admin','director','finanzas','compras')
      and (actor.role = 'owner' or actor.business_id is null or actor.business_id = sucursal.business_id)
      and (actor.role = 'owner' or actor.branch_id is null or actor.branch_id = sucursal.id)
  )
);
