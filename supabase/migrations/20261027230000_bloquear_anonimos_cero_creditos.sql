begin;

drop policy if exists monys_creditos_proveedores_confirmaciones_select
  on public.creditos_proveedores_confirmaciones;
create policy monys_creditos_proveedores_confirmaciones_select
on public.creditos_proveedores_confirmaciones for select to authenticated
using (
  (select (auth.jwt()->>'is_anonymous')::boolean) is false
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

drop policy if exists monys_creditos_proveedores_confirmaciones_insert
  on public.creditos_proveedores_confirmaciones;
create policy monys_creditos_proveedores_confirmaciones_insert
on public.creditos_proveedores_confirmaciones for insert to authenticated
with check (
  (select (auth.jwt()->>'is_anonymous')::boolean) is false
  and confirmado_por = (select auth.uid())
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

commit;
