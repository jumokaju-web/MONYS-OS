create or replace function public.rechazar_publicacion_marketing(
  p_publicacion_id uuid,
  p_observaciones text
)
returns public.marketing_publicaciones
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_publicacion public.marketing_publicaciones;
  v_rol text;
  v_observaciones text := nullif(trim(p_observaciones), '');
begin
  if v_observaciones is null or char_length(v_observaciones) < 5 then
    raise exception 'Explica brevemente por qué se rechaza.';
  end if;

  select publicacion.*
  into v_publicacion
  from public.marketing_publicaciones publicacion
  where publicacion.id = p_publicacion_id
    and publicacion.estado = 'PENDIENTE_APROBACION'
  for update of publicacion;

  select lower(usuario.role)
  into v_rol
  from public.usuarios usuario
  where usuario.organization_id = v_publicacion.organization_id
    and usuario.auth_user_id = (select auth.uid())
    and usuario.active;

  if v_publicacion.id is null or v_rol not in ('owner', 'admin', 'marketing') then
    raise exception 'No tienes autorización para rechazar esta publicación.';
  end if;

  update public.marketing_publicaciones publicacion
  set estado = 'CANCELADA',
      approved_by = null,
      aprobada_en = null,
      presupuesto_autorizado = null,
      presupuesto_autorizado_por = null,
      presupuesto_autorizado_en = null,
      requiere_autorizacion_duena = false,
      observaciones_aprobacion = v_observaciones,
      updated_at = now()
  where publicacion.id = v_publicacion.id
  returning publicacion.* into v_publicacion;

  return v_publicacion;
end;
$$;

revoke all on function public.rechazar_publicacion_marketing(uuid, text) from public;
grant execute on function public.rechazar_publicacion_marketing(uuid, text) to authenticated;
