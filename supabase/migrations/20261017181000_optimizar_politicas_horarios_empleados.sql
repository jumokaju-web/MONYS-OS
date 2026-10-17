begin;

drop policy if exists empleado_horario_semanal_direccion_escribe
  on public.empleado_horario_semanal;

create policy empleado_horario_semanal_direccion_inserta
on public.empleado_horario_semanal
for insert to authenticated
with check (
  changed_by = (select auth.uid())
  and exists (
    select 1 from public.empleados e
    join public.branches b on b.id = empleado_horario_semanal.branch_id
    join public.usuarios u on u.auth_user_id = (select auth.uid())
    where e.id = empleado_horario_semanal.empleado_id
      and e.organization_id = empleado_horario_semanal.organization_id
      and e.business_id = empleado_horario_semanal.business_id
      and b.business_id = empleado_horario_semanal.business_id
      and u.active
      and u.role in ('owner', 'director', 'admin', 'rh')
      and u.organization_id = e.organization_id
      and (u.business_id is null or u.business_id = e.business_id)
      and (u.role = 'owner' or u.branch_id is null or u.branch_id = empleado_horario_semanal.branch_id)
  )
);

create policy empleado_horario_semanal_direccion_actualiza
on public.empleado_horario_semanal
for update to authenticated
using (
  exists (
    select 1 from public.usuarios u
    where u.auth_user_id = (select auth.uid())
      and u.active
      and u.role in ('owner', 'director', 'admin', 'rh')
      and u.organization_id = empleado_horario_semanal.organization_id
      and (u.business_id is null or u.business_id = empleado_horario_semanal.business_id)
      and (u.role = 'owner' or u.branch_id is null or u.branch_id = empleado_horario_semanal.branch_id)
  )
)
with check (
  changed_by = (select auth.uid())
  and exists (
    select 1 from public.empleados e
    join public.branches b on b.id = empleado_horario_semanal.branch_id
    join public.usuarios u on u.auth_user_id = (select auth.uid())
    where e.id = empleado_horario_semanal.empleado_id
      and e.organization_id = empleado_horario_semanal.organization_id
      and e.business_id = empleado_horario_semanal.business_id
      and b.business_id = empleado_horario_semanal.business_id
      and u.active
      and u.role in ('owner', 'director', 'admin', 'rh')
      and u.organization_id = e.organization_id
      and (u.business_id is null or u.business_id = e.business_id)
      and (u.role = 'owner' or u.branch_id is null or u.branch_id = empleado_horario_semanal.branch_id)
  )
);

create policy empleado_horario_semanal_direccion_elimina
on public.empleado_horario_semanal
for delete to authenticated
using (
  exists (
    select 1 from public.usuarios u
    where u.auth_user_id = (select auth.uid())
      and u.active
      and u.role in ('owner', 'director', 'admin', 'rh')
      and u.organization_id = empleado_horario_semanal.organization_id
      and (u.business_id is null or u.business_id = empleado_horario_semanal.business_id)
      and (u.role = 'owner' or u.branch_id is null or u.branch_id = empleado_horario_semanal.branch_id)
  )
);

drop policy if exists empleado_horario_excepcion_direccion_escribe
  on public.empleado_horario_excepcion;

create policy empleado_horario_excepcion_direccion_inserta
on public.empleado_horario_excepcion
for insert to authenticated
with check (
  changed_by = (select auth.uid())
  and exists (
    select 1 from public.empleados e
    join public.branches b on b.id = empleado_horario_excepcion.branch_id
    join public.usuarios u on u.auth_user_id = (select auth.uid())
    where e.id = empleado_horario_excepcion.empleado_id
      and e.organization_id = empleado_horario_excepcion.organization_id
      and e.business_id = empleado_horario_excepcion.business_id
      and b.business_id = empleado_horario_excepcion.business_id
      and u.active
      and u.role in ('owner', 'director', 'admin', 'rh')
      and u.organization_id = e.organization_id
      and (u.business_id is null or u.business_id = e.business_id)
      and (u.role = 'owner' or u.branch_id is null or u.branch_id = empleado_horario_excepcion.branch_id)
  )
);

create policy empleado_horario_excepcion_direccion_actualiza
on public.empleado_horario_excepcion
for update to authenticated
using (
  exists (
    select 1 from public.usuarios u
    where u.auth_user_id = (select auth.uid())
      and u.active
      and u.role in ('owner', 'director', 'admin', 'rh')
      and u.organization_id = empleado_horario_excepcion.organization_id
      and (u.business_id is null or u.business_id = empleado_horario_excepcion.business_id)
      and (u.role = 'owner' or u.branch_id is null or u.branch_id = empleado_horario_excepcion.branch_id)
  )
)
with check (
  changed_by = (select auth.uid())
  and exists (
    select 1 from public.empleados e
    join public.branches b on b.id = empleado_horario_excepcion.branch_id
    join public.usuarios u on u.auth_user_id = (select auth.uid())
    where e.id = empleado_horario_excepcion.empleado_id
      and e.organization_id = empleado_horario_excepcion.organization_id
      and e.business_id = empleado_horario_excepcion.business_id
      and b.business_id = empleado_horario_excepcion.business_id
      and u.active
      and u.role in ('owner', 'director', 'admin', 'rh')
      and u.organization_id = e.organization_id
      and (u.business_id is null or u.business_id = e.business_id)
      and (u.role = 'owner' or u.branch_id is null or u.branch_id = empleado_horario_excepcion.branch_id)
  )
);

create policy empleado_horario_excepcion_direccion_elimina
on public.empleado_horario_excepcion
for delete to authenticated
using (
  exists (
    select 1 from public.usuarios u
    where u.auth_user_id = (select auth.uid())
      and u.active
      and u.role in ('owner', 'director', 'admin', 'rh')
      and u.organization_id = empleado_horario_excepcion.organization_id
      and (u.business_id is null or u.business_id = empleado_horario_excepcion.business_id)
      and (u.role = 'owner' or u.branch_id is null or u.branch_id = empleado_horario_excepcion.branch_id)
  )
);

commit;
