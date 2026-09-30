create or replace function public.programar_publicacion_marketing(
  p_publicacion_id uuid,
  p_programada_para timestamptz
)
returns public.marketing_publicaciones
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_publicacion public.marketing_publicaciones;
begin
  if p_programada_para is null then
    raise exception 'Selecciona la fecha y hora de publicación.';
  end if;

  if p_programada_para < now() - interval '1 minute' then
    raise exception 'La fecha de publicación no puede estar en el pasado.';
  end if;

  update public.marketing_publicaciones publicacion
  set estado = 'PROGRAMADA',
      programada_para = p_programada_para,
      updated_at = now(),
      ultimo_error = null
  where publicacion.id = p_publicacion_id
    and publicacion.estado in ('APROBADA', 'PROGRAMADA')
    and exists (
      select 1
      from public.usuarios usuario
      where usuario.auth_user_id = (select auth.uid())
        and usuario.organization_id = publicacion.organization_id
        and usuario.active
        and lower(usuario.role) in ('owner', 'admin')
    )
  returning publicacion.* into v_publicacion;

  if v_publicacion.id is null then
    raise exception 'No tienes autorización para programar esta publicación.';
  end if;

  return v_publicacion;
end;
$$;

revoke all on function public.programar_publicacion_marketing(uuid, timestamptz)
  from public;
grant execute on function public.programar_publicacion_marketing(uuid, timestamptz)
  to authenticated;
