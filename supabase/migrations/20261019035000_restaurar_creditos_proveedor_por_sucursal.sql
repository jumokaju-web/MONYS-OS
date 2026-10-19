-- Las importaciones heredadas de créditos no guardaron organization_id,
-- pero sí conservan una branch_id válida. El alcance se deriva de
-- branch -> business -> organization sin rellenar datos ausentes.

drop policy if exists monys_creditos_proveedores_select_alcance
  on public.creditos_proveedores;
drop policy if exists monys_creditos_proveedores_insert_alcance
  on public.creditos_proveedores;

create policy monys_creditos_proveedores_select_alcance
on public.creditos_proveedores for select to authenticated
using (
  exists (
    select 1
    from public.importaciones importacion
    join public.branches sucursal on sucursal.id = importacion.branch_id
    join public.businesses negocio on negocio.id = sucursal.business_id
    join public.usuarios actor on actor.auth_user_id = (select auth.uid())
    where importacion.id = creditos_proveedores.importacion_id
      and actor.active is true
      and actor.organization_id = negocio.organization_id
      and lower(actor.role) in ('owner','admin','director','finanzas','compras','encargada')
      and (actor.business_id is null or actor.business_id = sucursal.business_id)
      and (actor.branch_id is null or actor.branch_id = importacion.branch_id)
  )
);

create policy monys_creditos_proveedores_insert_alcance
on public.creditos_proveedores for insert to authenticated
with check (
  exists (
    select 1
    from public.importaciones importacion
    join public.branches sucursal on sucursal.id = importacion.branch_id
    join public.businesses negocio on negocio.id = sucursal.business_id
    join public.usuarios actor on actor.auth_user_id = (select auth.uid())
    where importacion.id = creditos_proveedores.importacion_id
      and actor.active is true
      and actor.organization_id = negocio.organization_id
      and lower(actor.role) in ('owner','admin','director','finanzas','compras','encargada')
      and (actor.business_id is null or actor.business_id = sucursal.business_id)
      and (actor.branch_id is null or actor.branch_id = importacion.branch_id)
  )
);
