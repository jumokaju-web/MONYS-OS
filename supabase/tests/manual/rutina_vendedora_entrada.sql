-- Ejecutar después de la migración, siempre dentro de BEGIN/ROLLBACK.
-- Fichas y sucursales aisladas; no se modifican tareas o asistencias reales.
create temp table prueba_entrada_rutina (like public.asistencia_operativa including defaults);
create trigger probar_reintento after insert on prueba_entrada_rutina
for each row execute function monys_automatizacion.preparar_rutina_entrada();
do $$
declare
  base public.empleados%rowtype;
  actor uuid;
  sucursal uuid;
  ficha uuid;
  caso int;
  esperado int;
  fecha_prueba date;
  cantidad int;
  entrada public.asistencia_operativa%rowtype;
begin
  select e.* into strict base from public.empleados e where e.active and e.business_id is not null
    and e.usuario_id is not null and 'VENTA_TIENDA'=any(e.responsabilidades) limit 1;
  select u.auth_user_id into actor from public.usuarios u where u.id=base.usuario_id or u.auth_user_id=base.usuario_id limit 1;
  if actor is null then raise exception 'Falta acceso para la fixture'; end if;
  perform set_config('request.jwt.claim.sub',actor::text,true);
  for caso in 1..8 loop
    insert into public.branches (business_id,name) values(base.business_id,'Prueba transaccional rutina ' || gen_random_uuid()::text) returning id into sucursal;
    insert into public.empleados (organization_id,business_id,branch_id,nombre,usuario_id,active,responsabilidades)
      values (base.organization_id,base.business_id,sucursal,'Prueba transaccional rutina',actor,caso<>5,
        case when caso=2 then array['VENTA_TIENDA'] when caso=3 then array['PUBLICAR_GRUPOS_WHATSAPP']
          else array['VENTA_TIENDA','CAJA_CORTE'] end) returning id into ficha;
    fecha_prueba := (now() at time zone 'America/Mexico_City')::date + case when caso=7 then 1 when caso=8 then -1 else 0 end;
    if caso=4 then
      insert into public.empleado_horario_excepcion (organization_id,business_id,branch_id,empleado_id,fecha,estado,motivo,changed_by)
        values(base.organization_id,base.business_id,sucursal,ficha,fecha_prueba,'DESCANSA','Prueba descanso',actor);
    end if;
    if caso=6 then perform set_config('request.jwt.claim.sub',gen_random_uuid()::text,true); end if;
    insert into public.asistencia_operativa (organization_id,business_id,branch_id,empleado_id,usuario_id,fecha)
      values(base.organization_id,base.business_id,sucursal,ficha,actor,fecha_prueba) returning * into entrada;
    esperado := case when caso=1 then 3 when caso=2 then 2 else 0 end;
    select count(*) into cantidad from public.tareas_operativas where branch_id=sucursal;
    if cantidad<>esperado then raise exception 'Caso %: esperaba %, obtuvo %',caso,esperado,cantidad; end if;
    if caso=1 then
      update public.tareas_operativas set estado='terminada' where branch_id=sucursal and titulo='Registrar solicitudes e incidencias del turno';
      insert into prueba_entrada_rutina select (entrada).*;
      select count(*) into cantidad from public.tareas_operativas where branch_id=sucursal;
      if cantidad<>3 then raise exception 'Duplicó tareas al reintentar'; end if;
      if not exists (select 1 from public.tareas_operativas where branch_id=sucursal and estado='terminada') then
        raise exception 'Reabrió una tarea terminada'; end if;
      if exists (select 1 from public.tareas_operativas where branch_id=sucursal and
        (responsable_usuario_id<>actor or fecha<>fecha_prueba or organization_id<>base.organization_id or business_id<>base.business_id)) then
        raise exception 'Asignó tareas fuera del contexto'; end if;
    end if;
    perform set_config('request.jwt.claim.sub',actor::text,true);
  end loop;
  if has_function_privilege('authenticated','monys_automatizacion.preparar_rutina_entrada()','EXECUTE') or
     has_function_privilege('anon','monys_automatizacion.preparar_rutina_entrada()','EXECUTE') then
    raise exception 'Función interna expuesta al cliente'; end if;
end $$;
select 'OK: venta, caja, marketing, descanso, inactiva, identidad, fechas e idempotencia' as resultado;
