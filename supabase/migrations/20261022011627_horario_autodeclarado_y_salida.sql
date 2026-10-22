-- Autodeclaración diaria y salida real; las entradas existentes se conservan.
begin;
alter table public.asistencia_operativa add column if not exists salida_at timestamptz;
alter table public.asistencia_operativa add constraint asistencia_salida_despues_entrada
  check (salida_at is null or salida_at >= entrada_at);
-- Los permisos iniciales del proyecto incluyen privilegios de tabla amplios.
-- Mantener solamente las columnas que cada operación necesita.
revoke all on public.asistencia_operativa from anon, authenticated;
grant select on public.asistencia_operativa to authenticated;
grant insert (organization_id,business_id,branch_id,empleado_id,usuario_id,fecha)
  on public.asistencia_operativa to authenticated;
grant update (salida_at) on public.asistencia_operativa to authenticated;
create policy asistencia_operativa_salida_propia on public.asistencia_operativa
for update to authenticated
using (usuario_id = (select auth.uid()) and salida_at is null
  and fecha = (now() at time zone 'America/Mexico_City')::date
  and exists (select 1 from public.empleados e where e.id = asistencia_operativa.empleado_id and e.active
    and e.organization_id = asistencia_operativa.organization_id
    and e.business_id = asistencia_operativa.business_id
    and (e.usuario_id = (select auth.uid()) or exists (select 1 from public.usuarios u
      where u.id = e.usuario_id and u.auth_user_id = (select auth.uid()) and u.active))))
with check (usuario_id = (select auth.uid()) and salida_at is not null
  and fecha = (now() at time zone 'America/Mexico_City')::date);
create function public.fijar_hora_salida_operativa() returns trigger
language plpgsql security invoker set search_path = '' as $$
begin
  if old.salida_at is not null then raise exception 'La salida ya quedó registrada.'; end if;
  if new.salida_at is null then raise exception 'La salida necesita una hora.'; end if;
  new.salida_at := clock_timestamp();
  return new;
end;
$$;
revoke all on function public.fijar_hora_salida_operativa() from public, anon, authenticated;
create trigger fijar_hora_salida_operativa before update on public.asistencia_operativa
for each row execute function public.fijar_hora_salida_operativa();

-- Autodeclaración: propia ficha activa, misma sucursal, hoy o fechas futuras.
-- La actualización solo permite cambiar un horario creado por la propia empleada.
-- Una entrada registrada bloquea cambios de horario de ese día.
create policy empleado_horario_excepcion_autodeclara on public.empleado_horario_excepcion
for insert to authenticated with check (
  changed_by = (select auth.uid()) and estado in ('TRABAJA','DESCANSA')
  and fecha >= (now() at time zone 'America/Mexico_City')::date
  and exists (select 1 from public.empleados e
    where e.id = empleado_horario_excepcion.empleado_id and e.active
      and e.organization_id = empleado_horario_excepcion.organization_id
      and e.business_id = empleado_horario_excepcion.business_id
      and e.branch_id = empleado_horario_excepcion.branch_id
      and (e.usuario_id = (select auth.uid()) or exists (select 1 from public.usuarios u
        where u.id = e.usuario_id and u.auth_user_id = (select auth.uid()) and u.active)))
  and not exists (select 1 from public.asistencia_operativa a
    where a.empleado_id = empleado_horario_excepcion.empleado_id and a.fecha = empleado_horario_excepcion.fecha)
);
create policy empleado_horario_excepcion_autocorrige on public.empleado_horario_excepcion
for update to authenticated
using (changed_by = (select auth.uid())
  and fecha >= (now() at time zone 'America/Mexico_City')::date
  and exists (select 1 from public.empleados e where e.id = empleado_horario_excepcion.empleado_id and e.active
    and e.organization_id = empleado_horario_excepcion.organization_id
    and e.business_id = empleado_horario_excepcion.business_id
    and e.branch_id = empleado_horario_excepcion.branch_id
    and (e.usuario_id = (select auth.uid()) or exists (select 1 from public.usuarios u
      where u.id = e.usuario_id and u.auth_user_id = (select auth.uid()) and u.active)))
  and not exists (select 1 from public.asistencia_operativa a
    where a.empleado_id = empleado_horario_excepcion.empleado_id and a.fecha = empleado_horario_excepcion.fecha))
with check (changed_by = (select auth.uid()) and estado in ('TRABAJA','DESCANSA')
  and fecha >= (now() at time zone 'America/Mexico_City')::date
  and exists (select 1 from public.empleados e where e.id = empleado_horario_excepcion.empleado_id and e.active
    and e.organization_id = empleado_horario_excepcion.organization_id
    and e.business_id = empleado_horario_excepcion.business_id
    and e.branch_id = empleado_horario_excepcion.branch_id
    and (e.usuario_id = (select auth.uid()) or exists (select 1 from public.usuarios u
      where u.id = e.usuario_id and u.auth_user_id = (select auth.uid()) and u.active)))
  and not exists (select 1 from public.asistencia_operativa a
    where a.empleado_id = empleado_horario_excepcion.empleado_id and a.fecha = empleado_horario_excepcion.fecha));
alter policy asistencia_operativa_select_alcance on public.asistencia_operativa
using (usuario_id = (select auth.uid()) or exists (
  select 1 from public.usuarios u where u.auth_user_id = (select auth.uid()) and u.active
    and u.role in ('owner','director','admin','rh')
    and u.organization_id = asistencia_operativa.organization_id
    and (u.business_id is null or u.business_id = asistencia_operativa.business_id)
    and (u.role = 'owner' or u.branch_id is null or u.branch_id = asistencia_operativa.branch_id)));
commit;
