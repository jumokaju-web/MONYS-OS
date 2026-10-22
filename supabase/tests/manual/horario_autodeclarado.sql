-- Ejecutar en una transacción; todos los datos de prueba se revierten.
-- Requiere una vendedora activa vinculada. No modifica registros reales.
create temp table prueba_jornada as
select e.*, u.auth_user_id as actor from public.empleados e
join public.usuarios u on (u.id=e.usuario_id or u.auth_user_id=e.usuario_id)
where e.active and u.active and u.role='vendedora' limit 1;
grant select on prueba_jornada to authenticated;
do $$ begin
  if (select count(*) from prueba_jornada) <> 1 then raise exception 'Falta fixture de empleada activa'; end if;
  if exists (select 1 from public.empleado_horario_excepcion h join prueba_jornada p on h.empleado_id=p.id
    where h.fecha in ('2099-11-21','2099-11-22')) then raise exception 'Las fechas de prueba ya tienen registros'; end if;
  if exists (select 1 from public.asistencia_operativa a join prueba_jornada p on a.empleado_id=p.id
    where a.fecha=(now() at time zone 'America/Mexico_City')::date) then raise exception 'Ya hay asistencia real: no usar esta fixture hoy'; end if;
end $$;
-- Simular un horario escrito por Dirección: la empleada no puede apropiárselo.
insert into public.empleado_horario_excepcion (organization_id,business_id,branch_id,empleado_id,fecha,estado,motivo,changed_by)
select organization_id,business_id,branch_id,id,'2099-11-22','DESCANSA','Prueba protegida',null from prueba_jornada;
select set_config('request.jwt.claim.sub',(select actor::text from prueba_jornada),true);
set local role authenticated;
insert into public.empleado_horario_excepcion (organization_id,business_id,branch_id,empleado_id,fecha,estado,hora_inicio,hora_fin,motivo,changed_by)
select organization_id,business_id,branch_id,id,'2099-11-21','TRABAJA','14:00','20:00','Prueba propia',actor from prueba_jornada;
update public.empleado_horario_excepcion set estado='DESCANSA',hora_inicio=null,hora_fin=null
where empleado_id=(select id from prueba_jornada) and fecha='2099-11-21';
do $$ declare cantidad int; begin
  if not exists (select 1 from public.empleado_horario_excepcion where empleado_id=(select id from prueba_jornada)
    and fecha='2099-11-21' and estado='DESCANSA') then raise exception 'No pudo corregir su propio horario'; end if;
  update public.empleado_horario_excepcion set changed_by=(select actor from prueba_jornada)
    where empleado_id=(select id from prueba_jornada) and fecha='2099-11-22';
  get diagnostics cantidad = row_count;
  if cantidad <> 0 then raise exception 'Pudo cambiar el horario de Dirección'; end if;
  begin
    insert into public.empleado_horario_excepcion (organization_id,business_id,branch_id,empleado_id,fecha,estado,motivo,changed_by)
    select organization_id,business_id,branch_id,id,(now() at time zone 'America/Mexico_City')::date-1,'DESCANSA','Retroactivo no permitido',actor from prueba_jornada;
    raise exception 'Aceptó horario retroactivo';
  exception when insufficient_privilege then null; end;
  begin
    insert into public.empleado_horario_excepcion (organization_id,business_id,branch_id,empleado_id,fecha,estado,motivo,changed_by)
    select '00000000-0000-0000-0000-000000000000',business_id,branch_id,id,'2099-11-23','DESCANSA','Otra organización',actor from prueba_jornada;
    raise exception 'Aceptó otra organización';
  exception when insufficient_privilege then null; end;
end $$;
insert into public.asistencia_operativa (organization_id,business_id,branch_id,empleado_id,usuario_id,fecha)
select organization_id,business_id,branch_id,id,actor,(now() at time zone 'America/Mexico_City')::date from prueba_jornada;
-- El servidor debe ignorar la hora enviada y registrar la hora real de salida.
update public.asistencia_operativa set salida_at='2099-01-01T00:00:00Z'
where empleado_id=(select id from prueba_jornada) and fecha=(now() at time zone 'America/Mexico_City')::date;
do $$ declare cantidad int; begin
  if not exists (select 1 from public.asistencia_operativa where empleado_id=(select id from prueba_jornada)
    and fecha=(now() at time zone 'America/Mexico_City')::date and salida_at between now()-interval '1 minute' and clock_timestamp())
    then raise exception 'Salida no normalizada al reloj del servidor'; end if;
  update public.asistencia_operativa set salida_at=clock_timestamp()
    where empleado_id=(select id from prueba_jornada) and fecha=(now() at time zone 'America/Mexico_City')::date;
  get diagnostics cantidad = row_count;
  if cantidad <> 0 then raise exception 'Pudo registrar la salida dos veces'; end if;
  begin
    update public.asistencia_operativa set entrada_at=clock_timestamp()
      where empleado_id=(select id from prueba_jornada);
    raise exception 'Pudo modificar la entrada';
  exception when insufficient_privilege then null; end;
  begin
    insert into public.empleado_horario_excepcion (organization_id,business_id,branch_id,empleado_id,fecha,estado,motivo,changed_by)
    select organization_id,business_id,branch_id,id,(now() at time zone 'America/Mexico_City')::date,'DESCANSA','Descanso después de entrada',actor from prueba_jornada;
    raise exception 'Pudo borrar la asistencia con descanso';
  exception when insufficient_privilege then null; end;
end $$;
reset role;
select 'OK: horario propio, protección de Dirección, pasado, organización y salida real' as resultado;
