begin;

-- Permite a la empleada leer solo su ficha RH aunque empleados.usuario_id
-- contenga usuarios.id; conserva compatibilidad con filas que guardan auth.uid().
grant select on public.empleados to authenticated;
drop policy if exists empleados_select_ficha_vinculada on public.empleados;
create policy empleados_select_ficha_vinculada
on public.empleados
for select to authenticated
using (
  usuario_id = (select auth.uid())
  or exists (
    select 1
    from public.usuarios u
    where u.id = empleados.usuario_id
      and u.auth_user_id = (select auth.uid())
      and u.active
  )
);

drop policy if exists empleado_config_operativa_insert_propio
  on public.empleado_configuracion_operativa;
create policy empleado_config_operativa_insert_propio
on public.empleado_configuracion_operativa
for insert to authenticated
with check (
  usuario_id = (select auth.uid())
  and exists (
    select 1
    from public.empleados e
    where e.id = empleado_configuracion_operativa.empleado_id
      and e.active
      and e.branch_id = empleado_configuracion_operativa.branch_id
      and (
        e.usuario_id = (select auth.uid())
        or exists (
          select 1 from public.usuarios u
          where u.id = e.usuario_id
            and u.auth_user_id = (select auth.uid())
            and u.active
        )
      )
  )
);

drop policy if exists empleado_config_operativa_update_propio
  on public.empleado_configuracion_operativa;
create policy empleado_config_operativa_update_propio
on public.empleado_configuracion_operativa
for update to authenticated
using (
  usuario_id = (select auth.uid())
  and exists (
    select 1
    from public.empleados e
    where e.id = empleado_configuracion_operativa.empleado_id
      and e.active
      and e.branch_id = empleado_configuracion_operativa.branch_id
      and (
        e.usuario_id = (select auth.uid())
        or exists (
          select 1 from public.usuarios u
          where u.id = e.usuario_id
            and u.auth_user_id = (select auth.uid())
            and u.active
        )
      )
  )
)
with check (
  usuario_id = (select auth.uid())
  and exists (
    select 1
    from public.empleados e
    where e.id = empleado_configuracion_operativa.empleado_id
      and e.active
      and e.branch_id = empleado_configuracion_operativa.branch_id
      and (
        e.usuario_id = (select auth.uid())
        or exists (
          select 1 from public.usuarios u
          where u.id = e.usuario_id
            and u.auth_user_id = (select auth.uid())
            and u.active
        )
      )
  )
);

drop policy if exists asistencia_operativa_insert_propia
  on public.asistencia_operativa;
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
      and e.branch_id = asistencia_operativa.branch_id
      and (
        e.usuario_id = (select auth.uid())
        or exists (
          select 1 from public.usuarios u
          where u.id = e.usuario_id
            and u.auth_user_id = (select auth.uid())
            and u.active
        )
      )
  )
);

commit;
