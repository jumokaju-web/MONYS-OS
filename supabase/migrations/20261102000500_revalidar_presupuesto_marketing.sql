create or replace function public.resolver_aprobacion_publicacion_marketing(
  p_publicacion_id uuid,
  p_aprobar boolean,
  p_observaciones text default null
)
returns public.marketing_publicaciones
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_publicacion public.marketing_publicaciones;
  v_politica public.marketing_politicas_publicacion;
  v_gasto_diario numeric := 0;
  v_rol text;
begin
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
    raise exception 'No tienes autorización para resolver esta publicación.';
  end if;

  if p_aprobar and v_rol = 'marketing' then
    perform pg_advisory_xact_lock(hashtext(v_publicacion.business_id::text));

    select politica.*
    into v_politica
    from public.marketing_politicas_publicacion politica
    where politica.organization_id = v_publicacion.organization_id
      and politica.business_id = v_publicacion.business_id;

    if v_publicacion.tipo_campana = 'ORGANICA' then
      if not coalesce(v_politica.publicar_organico_automatico, true) then
        raise exception 'Esta campaña orgánica necesita autorización de Mónica.';
      end if;
    else
      select coalesce(sum(publicacion.presupuesto_autorizado), 0)
      into v_gasto_diario
      from public.marketing_publicaciones publicacion
      where publicacion.organization_id = v_publicacion.organization_id
        and publicacion.business_id = v_publicacion.business_id
        and publicacion.id <> v_publicacion.id
        and publicacion.tipo_campana = 'PAGADA'
        and publicacion.estado in ('APROBADA', 'PROGRAMADA', 'PUBLICANDO', 'PUBLICADA')
        and (
          coalesce(publicacion.programada_para, publicacion.aprobada_en, publicacion.created_at)
          at time zone 'America/Mexico_City'
        )::date = (now() at time zone 'America/Mexico_City')::date;

      if not (
        coalesce(v_politica.publicar_pagado_automatico, false)
        and coalesce(v_politica.limite_por_campana, 0) > 0
        and coalesce(v_politica.limite_diario, 0) > 0
        and v_publicacion.presupuesto_propuesto > 0
        and v_publicacion.presupuesto_propuesto <= v_politica.limite_por_campana
        and v_gasto_diario + v_publicacion.presupuesto_propuesto <= v_politica.limite_diario
      ) then
        raise exception 'Esta campaña necesita autorización de Mónica por presupuesto o política de gasto.';
      end if;
    end if;
  end if;

  update public.marketing_publicaciones publicacion
  set estado = case when p_aprobar then 'APROBADA' else 'REQUIERE_AJUSTES' end,
      approved_by = case when p_aprobar then (select auth.uid()) else null end,
      aprobada_en = case when p_aprobar then now() else null end,
      presupuesto_autorizado = case
        when p_aprobar and publicacion.tipo_campana = 'PAGADA'
          then publicacion.presupuesto_propuesto
        else null
      end,
      presupuesto_autorizado_por = case
        when p_aprobar and publicacion.tipo_campana = 'PAGADA'
          then (select auth.uid())
        else null
      end,
      presupuesto_autorizado_en = case
        when p_aprobar and publicacion.tipo_campana = 'PAGADA'
          then now()
        else null
      end,
      requiere_autorizacion_duena = case
        when p_aprobar then false
        else publicacion.requiere_autorizacion_duena
      end,
      observaciones_aprobacion = nullif(trim(p_observaciones), ''),
      updated_at = now()
  where publicacion.id = v_publicacion.id
  returning publicacion.* into v_publicacion;

  return v_publicacion;
end;
$$;

revoke all on function public.resolver_aprobacion_publicacion_marketing(uuid, boolean, text) from public;
grant execute on function public.resolver_aprobacion_publicacion_marketing(uuid, boolean, text) to authenticated;
