begin;

drop policy if exists empleado_config_operativa_insert_direccion
  on public.empleado_configuracion_operativa;
create policy empleado_config_operativa_insert_direccion
on public.empleado_configuracion_operativa
for insert to authenticated
with check (
  exists (
    select 1
    from public.empleados e
    join public.usuarios direccion
      on direccion.auth_user_id = (select auth.uid())
    where e.id = empleado_configuracion_operativa.empleado_id
      and e.active
      and e.branch_id = empleado_configuracion_operativa.branch_id
      and direccion.active
      and direccion.role in ('owner', 'director', 'admin', 'rh')
      and direccion.organization_id = e.organization_id
      and (direccion.business_id is null or direccion.business_id = e.business_id)
      and (direccion.branch_id is null or direccion.branch_id = e.branch_id)
      and (
        e.usuario_id = empleado_configuracion_operativa.usuario_id
        or exists (
          select 1
          from public.usuarios acceso
          where acceso.id = e.usuario_id
            and acceso.auth_user_id = empleado_configuracion_operativa.usuario_id
            and acceso.active
        )
      )
  )
);

drop policy if exists empleado_config_operativa_update_direccion
  on public.empleado_configuracion_operativa;
create policy empleado_config_operativa_update_direccion
on public.empleado_configuracion_operativa
for update to authenticated
using (
  exists (
    select 1
    from public.empleados e
    join public.usuarios direccion
      on direccion.auth_user_id = (select auth.uid())
    where e.id = empleado_configuracion_operativa.empleado_id
      and direccion.active
      and direccion.role in ('owner', 'director', 'admin', 'rh')
      and direccion.organization_id = e.organization_id
      and (direccion.business_id is null or direccion.business_id = e.business_id)
      and (direccion.branch_id is null or direccion.branch_id = e.branch_id)
  )
)
with check (
  exists (
    select 1
    from public.empleados e
    join public.usuarios direccion
      on direccion.auth_user_id = (select auth.uid())
    where e.id = empleado_configuracion_operativa.empleado_id
      and e.active
      and e.branch_id = empleado_configuracion_operativa.branch_id
      and direccion.active
      and direccion.role in ('owner', 'director', 'admin', 'rh')
      and direccion.organization_id = e.organization_id
      and (direccion.business_id is null or direccion.business_id = e.business_id)
      and (direccion.branch_id is null or direccion.branch_id = e.branch_id)
      and (
        e.usuario_id = empleado_configuracion_operativa.usuario_id
        or exists (
          select 1
          from public.usuarios acceso
          where acceso.id = e.usuario_id
            and acceso.auth_user_id = empleado_configuracion_operativa.usuario_id
            and acceso.active
        )
      )
  )
);

commit;
