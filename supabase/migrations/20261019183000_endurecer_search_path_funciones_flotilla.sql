begin;

-- Estas RPC necesitan SECURITY DEFINER para ejecutar transacciones controladas
-- sobre tablas sin acceso directo desde el cliente. Conservamos sus permisos y
-- validaciones internas, pero colocamos pg_temp al final del search_path para
-- impedir que un objeto temporal suplante dependencias privilegiadas.

alter function public.activar_chofer_con_codigo(text, text)
  set search_path = public, extensions, pg_temp;

alter function public.anular_ajuste_prefactura_flotilla(uuid)
  set search_path = public, pg_temp;

alter function public.aplicar_descuento_pnr_flotilla(uuid, date, date, numeric, text)
  set search_path = public, pg_temp;

alter function public.configurar_acceso_flotilla(text, text, text, uuid[])
  set search_path = public, auth, pg_temp;

alter function public.desactivar_acceso_flotilla(text)
  set search_path = public, auth, pg_temp;

alter function public.flotilla_es_admin_de_organizacion(uuid)
  set search_path = public, pg_temp;

alter function public.flotilla_puede_gestionar_pnr(uuid)
  set search_path = public, pg_temp;

alter function public.flotilla_puede_ver_unidad(uuid)
  set search_path = public, pg_temp;

alter function public.generar_codigo_activacion_chofer(uuid)
  set search_path = public, extensions, pg_temp;

alter function public.gestionar_pnr_flotilla(uuid, text, text, numeric)
  set search_path = public, pg_temp;

alter function public.guardar_ajuste_prefactura_flotilla(
  uuid, uuid, text, date, date, text, numeric, text, integer, integer
)
  set search_path = public, pg_temp;

alter function public.responder_pnr_flotilla(uuid, text)
  set search_path = public, pg_temp;

alter function public.solicitar_convenio_pnr_flotilla(uuid, numeric)
  set search_path = public, pg_temp;

commit;
