begin;

-- Una cobertura es una excepción de horario autorizada por Dirección. La
-- empleada conserva su sucursal base; únicamente opera en otra sucursal en la
-- fecha registrada y con estado TRABAJA.
drop policy if exists asistencia_operativa_insert_propia on public.asistencia_operativa;
create policy asistencia_operativa_insert_propia
on public.asistencia_operativa
for insert to authenticated
with check (
  usuario_id = (select auth.uid())
  and fecha = (now() at time zone 'America/Mexico_City')::date
  and exists (
    select 1
    from public.empleados e
    where e.id = asistencia_operativa.empleado_id
      and e.active
      and e.organization_id = asistencia_operativa.organization_id
      and e.business_id = asistencia_operativa.business_id
      and (
        e.usuario_id = (select auth.uid())
        or exists (
          select 1 from public.usuarios u
          where u.id = e.usuario_id
            and u.auth_user_id = (select auth.uid())
            and u.active
        )
      )
      and (
        e.branch_id = asistencia_operativa.branch_id
        or exists (
          select 1
          from public.empleado_horario_excepcion cobertura
          where cobertura.empleado_id = e.id
            and cobertura.organization_id = e.organization_id
            and cobertura.business_id = e.business_id
            and cobertura.branch_id = asistencia_operativa.branch_id
            and cobertura.fecha = asistencia_operativa.fecha
            and cobertura.estado = 'TRABAJA'
        )
      )
  )
);

drop policy if exists monys_cierres_select_alcance on public.cierres_turno;
create policy monys_cierres_select_alcance
on public.cierres_turno
for select to authenticated
using (
  exists (
    select 1
    from public.usuarios actor
    join public.branches sucursal on sucursal.id = cierres_turno.branch_id
    join public.businesses negocio on negocio.id = sucursal.business_id
    where actor.auth_user_id = (select auth.uid())
      and actor.active is true
      and actor.organization_id = negocio.organization_id
      and (
        (lower(actor.role) in ('owner','admin') and (actor.business_id is null or actor.business_id = sucursal.business_id))
        or (
          actor.business_id = sucursal.business_id
          and (
            actor.branch_id = cierres_turno.branch_id
            or exists (
              select 1
              from public.empleados e
              join public.empleado_horario_excepcion cobertura on cobertura.empleado_id = e.id
              where e.active
                and e.usuario_id in (actor.id, actor.auth_user_id)
                and cobertura.organization_id = actor.organization_id
                and cobertura.business_id = actor.business_id
                and cobertura.branch_id = cierres_turno.branch_id
                and cobertura.fecha = cierres_turno.fecha
                and cobertura.estado = 'TRABAJA'
            )
          )
          and (
            lower(actor.role) in ('vendedora','encargada')
            or cierres_turno.created_by = (select auth.uid())
            or coalesce(
              (select x.allowed from public.user_permission_overrides x where x.usuario_id=actor.id and x.permission='ver_finanzas' limit 1),
              (select p.allowed from public.role_permissions p where p.role=actor.role and p.permission='ver_finanzas' limit 1),
              false
            )
          )
        )
      )
  )
);

drop policy if exists monys_cierres_insert_alcance on public.cierres_turno;
create policy monys_cierres_insert_alcance
on public.cierres_turno
for insert to authenticated
with check (
  created_by = (select auth.uid())
  and exists (
    select 1
    from public.usuarios actor
    join public.branches sucursal on sucursal.id = cierres_turno.branch_id
    join public.businesses negocio on negocio.id = sucursal.business_id
    where actor.auth_user_id = (select auth.uid())
      and actor.active is true
      and actor.organization_id = negocio.organization_id
      and (
        (lower(actor.role) in ('owner','admin') and (actor.business_id is null or actor.business_id = sucursal.business_id))
        or (
          actor.business_id = sucursal.business_id
          and (
            actor.branch_id = cierres_turno.branch_id
            or exists (
              select 1
              from public.empleados e
              join public.empleado_horario_excepcion cobertura on cobertura.empleado_id = e.id
              where e.active
                and e.usuario_id in (actor.id, actor.auth_user_id)
                and cobertura.organization_id = actor.organization_id
                and cobertura.business_id = actor.business_id
                and cobertura.branch_id = cierres_turno.branch_id
                and cobertura.fecha = cierres_turno.fecha
                and cobertura.estado = 'TRABAJA'
            )
          )
        )
      )
  )
);

-- El formulario de caja usa una ruta propia, separada de las evidencias de
-- tareas: <auth.uid>/cierres-caja/<branch_id>/<archivo>.
drop policy if exists monys_cortes_caja_subir_foto on storage.objects;
create policy monys_cortes_caja_subir_foto
on storage.objects
for insert to authenticated
with check (
  bucket_id = 'tareas-evidencias'
  and split_part(name,'/',1) = (select auth.uid())::text
  and split_part(name,'/',2) = 'cierres-caja'
  and exists (
    select 1
    from public.usuarios actor
    where actor.auth_user_id = (select auth.uid())
      and actor.active is true
      and (
        actor.branch_id::text = split_part(storage.objects.name,'/',3)
        or exists (
          select 1
          from public.empleados e
          join public.empleado_horario_excepcion cobertura on cobertura.empleado_id = e.id
          where e.active
            and e.usuario_id in (actor.id, actor.auth_user_id)
            and cobertura.organization_id = actor.organization_id
            and cobertura.business_id = actor.business_id
            and cobertura.branch_id::text = split_part(storage.objects.name,'/',3)
            and cobertura.fecha = (now() at time zone 'America/Mexico_City')::date
            and cobertura.estado = 'TRABAJA'
        )
      )
  )
);

commit;
