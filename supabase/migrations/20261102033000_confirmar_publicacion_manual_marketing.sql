create or replace function public.confirmar_publicacion_manual_marketing(
  p_publicacion_id uuid,
  p_referencia text
)
returns public.marketing_publicaciones
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_publicacion public.marketing_publicaciones;
  v_rol text;
  v_referencia text := nullif(trim(p_referencia), '');
begin
  if v_referencia is null or char_length(v_referencia) < 5 or char_length(v_referencia) > 500 then
    raise exception 'Pega el enlace o escribe una referencia verificable de la publicación.';
  end if;

  select publicacion.*
  into v_publicacion
  from public.marketing_publicaciones publicacion
  where publicacion.id = p_publicacion_id
    and publicacion.estado in ('APROBADA', 'PROGRAMADA', 'PUBLICANDO')
  for update of publicacion;

  select lower(usuario.role)
  into v_rol
  from public.usuarios usuario
  where usuario.organization_id = v_publicacion.organization_id
    and usuario.auth_user_id = (select auth.uid())
    and usuario.active;

  if v_publicacion.id is null or v_rol not in ('owner', 'admin', 'marketing') then
    raise exception 'No tienes autorización para confirmar esta publicación.';
  end if;

  update public.marketing_publicaciones publicacion
  set estado = 'PUBLICADA',
      publicada_en = now(),
      referencias_externas = coalesce(publicacion.referencias_externas, '{}'::jsonb) || jsonb_build_object(
        'MANUAL', jsonb_build_object(
          'referencia', v_referencia,
          'confirmada_por', (select auth.uid()),
          'confirmada_en', now()
        )
      ),
      updated_at = now(),
      ultimo_error = null
  where publicacion.id = v_publicacion.id
  returning publicacion.* into v_publicacion;

  return v_publicacion;
end;
$$;

revoke all on function public.confirmar_publicacion_manual_marketing(uuid, text) from public;
revoke all on function public.confirmar_publicacion_manual_marketing(uuid, text) from anon;
grant execute on function public.confirmar_publicacion_manual_marketing(uuid, text) to authenticated;
