begin;

alter table public.flotilla_incidencias
  add column if not exists detalle jsonb not null default '{}'::jsonb,
  add column if not exists mensaje_whatsapp text;

update public.flotilla_incidencias
set mensaje_whatsapp = descripcion
where nullif(btrim(mensaje_whatsapp), '') is null;

alter table public.flotilla_incidencias
  alter column mensaje_whatsapp set not null,
  drop constraint if exists flotilla_incidencias_tipo_check,
  drop constraint if exists flotilla_incidencias_paquete_check,
  drop constraint if exists flotilla_incidencias_mensaje_check,
  drop constraint if exists flotilla_incidencias_detalle_reporte_check;

alter table public.flotilla_incidencias
  add constraint flotilla_incidencias_tipo_check check (tipo in (
    'PARADA_FALLIDA', 'ALTO_VALOR', 'RETORNO_PENDIENTE', 'RETORNO_CEDIS',
    'PNR', 'CEDIS_SIN_ESPACIO', 'DESCONTENEDORIZADO', 'DEVUELTO',
    'DANO_UNIDAD', 'ACCIDENTE', 'OTRO'
  )),
  add constraint flotilla_incidencias_paquete_check check (
    tipo not in (
      'ALTO_VALOR', 'RETORNO_PENDIENTE', 'RETORNO_CEDIS', 'PNR',
      'CEDIS_SIN_ESPACIO', 'DESCONTENEDORIZADO', 'DEVUELTO'
    ) or nullif(btrim(paquete_id), '') is not null
  ),
  add constraint flotilla_incidencias_mensaje_check check (
    nullif(btrim(mensaje_whatsapp), '') is not null
  ),
  add constraint flotilla_incidencias_detalle_reporte_check check (
    (tipo <> 'PARADA_FALLIDA' or (
      nullif(btrim(detalle->>'motivo'), '') is not null
      and detalle->>'tipoDomicilio' in ('residencial', 'negocio')
      and detalle->>'numeroVisita' in ('1', '2')
    ))
    and (tipo <> 'ALTO_VALOR' or nullif(btrim(detalle->>'parentescoRecibe'), '') is not null)
    and (tipo <> 'RETORNO_PENDIENTE' or nullif(btrim(detalle->>'motivo'), '') is not null)
    and (tipo <> 'RETORNO_CEDIS' or nullif(btrim(detalle->>'recibeCedis'), '') is not null)
  );

create or replace function public.preparar_incidencia_flotilla()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ruta public.flotilla_rutas%rowtype;
  v_es_admin boolean;
begin
  if TG_OP = 'UPDATE' then
    v_es_admin := public.flotilla_es_admin_de_organizacion(old.organization_id);
    if not v_es_admin then
      raise exception 'Solo Administración puede revisar una incidencia';
    end if;

    new.organization_id := old.organization_id;
    new.business_id := old.business_id;
    new.branch_id := old.branch_id;
    new.ruta_id := old.ruta_id;
    new.unidad_id := old.unidad_id;
    new.driver_auth_user_id := old.driver_auth_user_id;
    new.chofer_nombre := old.chofer_nombre;
    new.fecha := old.fecha;
    new.tipo := old.tipo;
    new.paquete_id := old.paquete_id;
    new.descripcion := old.descripcion;
    new.detalle := old.detalle;
    new.mensaje_whatsapp := old.mensaje_whatsapp;
    new.foto_contexto_path := old.foto_contexto_path;
    new.foto_detalle_path := old.foto_detalle_path;
    new.fotos_extra_paths := old.fotos_extra_paths;
    new.client_event_id := old.client_event_id;
    new.created_at := old.created_at;
    new.resolucion := nullif(btrim(new.resolucion), '');
    new.revisado_por := (select auth.uid());
    new.revisado_at := now();
    new.updated_at := now();
    return new;
  end if;

  select * into v_ruta from public.flotilla_rutas where id = new.ruta_id;
  if v_ruta.id is null then raise exception 'Ruta no encontrada'; end if;

  v_es_admin := public.flotilla_es_admin_de_organizacion(v_ruta.organization_id);
  if not v_es_admin and v_ruta.driver_auth_user_id is distinct from (select auth.uid()) then
    raise exception 'Solo el chofer de la ruta puede registrar la incidencia';
  end if;

  new.organization_id := v_ruta.organization_id;
  new.business_id := v_ruta.business_id;
  new.branch_id := v_ruta.branch_id;
  new.unidad_id := v_ruta.unidad_id;
  new.driver_auth_user_id := coalesce(v_ruta.driver_auth_user_id, (select auth.uid()));
  new.chofer_nombre := coalesce(nullif(btrim(v_ruta.chofer_nombre), ''), 'Chofer sin nombre');
  new.fecha := v_ruta.fecha;
  new.estado := 'PENDIENTE';
  new.resolucion := null;
  new.revisado_por := null;
  new.revisado_at := null;
  new.detalle := coalesce(new.detalle, '{}'::jsonb);
  new.updated_at := now();
  return new;
end;
$$;

comment on column public.flotilla_incidencias.detalle is
  'Datos estructurados del reporte: motivo, visita, parentesco o receptor en CEDIS.';
comment on column public.flotilla_incidencias.mensaje_whatsapp is
  'Texto exacto preparado por MONYS para compartir en el grupo operativo.';

commit;
