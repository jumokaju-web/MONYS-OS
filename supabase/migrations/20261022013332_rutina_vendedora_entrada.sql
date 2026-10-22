begin;
-- Automatización interna, sin RPC público ni permisos nuevos para crear tareas.
create schema if not exists monys_automatizacion;
revoke all on schema monys_automatizacion from public, anon, authenticated;
create function monys_automatizacion.preparar_rutina_entrada() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  ficha public.empleados%rowtype;
  actor uuid := (select auth.uid());
  estado_dia text;
begin
  -- Solo una entrada propia validada por RLS, en la fecha de México.
  if actor is null or actor <> new.usuario_id
    or new.fecha <> (now() at time zone 'America/Mexico_City')::date
    or new.salida_at is not null then return new; end if;
  select e.* into ficha from public.empleados e where e.id=new.empleado_id and e.active
    and e.organization_id=new.organization_id and e.business_id=new.business_id and e.branch_id=new.branch_id
    and (e.usuario_id=actor or exists (select 1 from public.usuarios u
      where u.id=e.usuario_id and u.auth_user_id=actor and u.active));
  if not found or not ('VENTA_TIENDA'=any(coalesce(ficha.responsabilidades,'{}'::text[]))) then return new; end if;
  -- No interpretar una declaración de descanso como turno iniciado.
  select h.estado into estado_dia from public.empleado_horario_excepcion h
    where h.empleado_id=ficha.id and h.fecha=new.fecha;
  if estado_dia is null then
    select h.estado into estado_dia from public.empleado_horario_semanal h
      where h.empleado_id=ficha.id and h.dia_semana=extract(dow from new.fecha)::int;
  end if;
  if estado_dia='DESCANSA' then return new; end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(actor::text || ':' || new.fecha::text, 0));
  insert into public.tareas_operativas
    (organization_id,business_id,branch_id,titulo,descripcion,area,responsable,responsable_usuario_id,
     prioridad,estado,fecha,instrucciones,creada_por,requiere_evidencia,criterio_exito)
  select new.organization_id,new.business_id,new.branch_id,r.titulo,r.descripcion,'tienda',ficha.nombre,actor,
    'normal','pendiente',new.fecha,r.instrucciones,'MONYS · rutina al registrar entrada',false,r.criterio
  from (values
    ('Revisar exhibición y faltantes antes de cerrar',
     'Revisar exhibición y reportar productos que necesitan atención.',
     'Revisa tu área, acomoda lo necesario y registra los pendientes. No declares existencias sin contarlas.',
     'Resultado real y pendientes de exhibición registrados.', false),
    ('Registrar solicitudes e incidencias del turno',
     'Dejar a Dirección los productos solicitados y problemas reales del turno.',
     'Utiliza Solicitudes e Incidencias para los casos reales. Si no hubo casos, indícalo en el resultado.',
     'Casos reales registrados o ausencia de casos confirmada por la empleada.', false),
    ('Capturar el corte de la caja utilizada',
     'Cerrar la caja física utilizada y enviar el corte para revisión de Dirección.',
     'Entra a Cierre, elige la caja utilizada y captura importes reales y foto. Sin apertura previa, usa la opción correspondiente con el fondo real. Si no manejaste caja, indícalo y solicita reasignación.',
     'Corte enviado o motivo real de no manejar caja registrado.', true)
  ) as r(titulo,descripcion,instrucciones,criterio,requiere_caja)
  where (not r.requiere_caja or 'CAJA_CORTE'=any(coalesce(ficha.responsabilidades,'{}'::text[])))
    and not exists (select 1 from public.tareas_operativas t
      where t.organization_id=new.organization_id and t.business_id=new.business_id
        and t.branch_id=new.branch_id and t.fecha=new.fecha
        and pg_catalog.lower(pg_catalog.btrim(t.titulo))=pg_catalog.lower(r.titulo)
        and (t.responsable_usuario_id=actor or (t.responsable_usuario_id is null
          and pg_catalog.lower(pg_catalog.btrim(t.responsable))=pg_catalog.lower(pg_catalog.btrim(ficha.nombre)))));
  return new;
end;
$$;
revoke all on function monys_automatizacion.preparar_rutina_entrada() from public, anon, authenticated;
create trigger preparar_rutina_vendedora_entrada after insert on public.asistencia_operativa
for each row execute function monys_automatizacion.preparar_rutina_entrada();
commit;
