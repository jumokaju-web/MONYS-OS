drop policy if exists "Usuarios activos consultan publicaciones de marketing"
  on public.marketing_publicaciones;

create policy "Usuarios activos consultan publicaciones de marketing"
on public.marketing_publicaciones
for select to authenticated
using (
  exists (
    select 1
    from public.usuarios usuario
    where usuario.organization_id = marketing_publicaciones.organization_id
      and usuario.auth_user_id = (select auth.uid())
      and usuario.active
      and lower(usuario.role) in ('owner', 'admin', 'marketing')
  )
);

drop policy if exists "Usuarios activos crean borradores de marketing"
  on public.marketing_publicaciones;

create policy "Usuarios activos crean borradores de marketing"
on public.marketing_publicaciones
for insert to authenticated
with check (
  created_by = (select auth.uid())
  and estado = 'BORRADOR'
  and exists (
    select 1
    from public.usuarios usuario
    where usuario.organization_id = marketing_publicaciones.organization_id
      and usuario.auth_user_id = (select auth.uid())
      and usuario.active
      and lower(usuario.role) in ('owner', 'admin', 'marketing')
  )
);

drop policy if exists "Miembros consultan politicas de marketing"
  on public.marketing_politicas_publicacion;

create policy "Usuarios autorizados consultan politicas de marketing"
on public.marketing_politicas_publicacion
for select to authenticated
using (
  exists (
    select 1
    from public.usuarios usuario
    where usuario.organization_id = marketing_politicas_publicacion.organization_id
      and usuario.auth_user_id = (select auth.uid())
      and usuario.active
      and lower(usuario.role) in ('owner', 'admin', 'marketing')
  )
);

drop policy if exists "Direccion configura politicas de marketing"
  on public.marketing_politicas_publicacion;

create policy "Direccion configura politicas de marketing"
on public.marketing_politicas_publicacion
for insert to authenticated
with check (
  created_by = (select auth.uid())
  and exists (
    select 1
    from public.usuarios usuario
    where usuario.organization_id = marketing_politicas_publicacion.organization_id
      and usuario.auth_user_id = (select auth.uid())
      and usuario.active
      and lower(usuario.role) in ('owner', 'admin')
  )
);

drop policy if exists "Direccion actualiza politicas de marketing"
  on public.marketing_politicas_publicacion;

create policy "Direccion actualiza politicas de marketing"
on public.marketing_politicas_publicacion
for update to authenticated
using (
  exists (
    select 1
    from public.usuarios usuario
    where usuario.organization_id = marketing_politicas_publicacion.organization_id
      and usuario.auth_user_id = (select auth.uid())
      and usuario.active
      and lower(usuario.role) in ('owner', 'admin')
  )
)
with check (
  exists (
    select 1
    from public.usuarios usuario
    where usuario.organization_id = marketing_politicas_publicacion.organization_id
      and usuario.auth_user_id = (select auth.uid())
      and usuario.active
      and lower(usuario.role) in ('owner', 'admin')
  )
);

drop policy if exists "Miembros consultan conexiones de marketing"
  on public.marketing_cuentas_canal;

create policy "Usuarios autorizados consultan conexiones de marketing"
on public.marketing_cuentas_canal
for select to authenticated
using (
  exists (
    select 1
    from public.usuarios usuario
    where usuario.organization_id = marketing_cuentas_canal.organization_id
      and usuario.auth_user_id = (select auth.uid())
      and usuario.active
      and lower(usuario.role) in ('owner', 'admin', 'marketing')
  )
);

create or replace function public.solicitar_aprobacion_publicacion_marketing(
  p_publicacion_id uuid
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
  v_requiere_duena boolean := true;
begin
  select publicacion.*
  into v_publicacion
  from public.marketing_publicaciones publicacion
  where publicacion.id = p_publicacion_id
    and publicacion.created_by = (select auth.uid())
    and publicacion.estado in ('BORRADOR', 'REQUIERE_AJUSTES')
    and exists (
      select 1
      from public.usuarios usuario
      where usuario.organization_id = publicacion.organization_id
        and usuario.auth_user_id = (select auth.uid())
        and usuario.active
        and lower(usuario.role) in ('owner', 'admin', 'marketing')
    );

  if v_publicacion.id is null then
    raise exception 'No se pudo enviar esta publicación a autorización.';
  end if;

  select politica.*
  into v_politica
  from public.marketing_politicas_publicacion politica
  where politica.organization_id = v_publicacion.organization_id
    and politica.business_id = v_publicacion.business_id;

  if v_publicacion.tipo_campana = 'ORGANICA' then
    v_requiere_duena := not coalesce(v_politica.publicar_organico_automatico, true);
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

    v_requiere_duena := not (
      coalesce(v_politica.publicar_pagado_automatico, false)
      and coalesce(v_politica.limite_por_campana, 0) > 0
      and coalesce(v_politica.limite_diario, 0) > 0
      and v_publicacion.presupuesto_propuesto > 0
      and v_publicacion.presupuesto_propuesto <= v_politica.limite_por_campana
      and v_gasto_diario + v_publicacion.presupuesto_propuesto <= v_politica.limite_diario
    );
  end if;

  update public.marketing_publicaciones publicacion
  set estado = 'PENDIENTE_APROBACION',
      requiere_autorizacion_duena = v_requiere_duena,
      updated_at = now(),
      ultimo_error = null
  where publicacion.id = v_publicacion.id
  returning publicacion.* into v_publicacion;

  return v_publicacion;
end;
$$;

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
    select politica.* into v_politica
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
        when p_aprobar and publicacion.tipo_campana = 'PAGADA' then publicacion.presupuesto_propuesto
        else null
      end,
      presupuesto_autorizado_por = case
        when p_aprobar and publicacion.tipo_campana = 'PAGADA' then (select auth.uid())
        else null
      end,
      presupuesto_autorizado_en = case
        when p_aprobar and publicacion.tipo_campana = 'PAGADA' then now()
        else null
      end,
      requiere_autorizacion_duena = case when p_aprobar then false else publicacion.requiere_autorizacion_duena end,
      observaciones_aprobacion = nullif(trim(p_observaciones), ''),
      updated_at = now()
  where publicacion.id = v_publicacion.id
  returning publicacion.* into v_publicacion;

  return v_publicacion;
end;
$$;

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
  v_rol text;
begin
  if p_programada_para is null then
    raise exception 'Selecciona la fecha y hora de publicación.';
  end if;
  if p_programada_para < now() - interval '1 minute' then
    raise exception 'La fecha de publicación no puede estar en el pasado.';
  end if;

  select publicacion.* into v_publicacion
  from public.marketing_publicaciones publicacion
  where publicacion.id = p_publicacion_id
    and publicacion.estado in ('APROBADA', 'PROGRAMADA')
  for update of publicacion;

  select lower(usuario.role) into v_rol
  from public.usuarios usuario
  where usuario.organization_id = v_publicacion.organization_id
    and usuario.auth_user_id = (select auth.uid())
    and usuario.active;

  if v_publicacion.id is null
     or v_rol not in ('owner', 'admin', 'marketing')
     or (v_rol = 'marketing' and v_publicacion.requiere_autorizacion_duena) then
    raise exception 'No tienes autorización para programar esta publicación.';
  end if;

  update public.marketing_publicaciones publicacion
  set estado = 'PROGRAMADA', programada_para = p_programada_para,
      updated_at = now(), ultimo_error = null
  where publicacion.id = v_publicacion.id
  returning publicacion.* into v_publicacion;
  return v_publicacion;
end;
$$;

revoke all on function public.solicitar_aprobacion_publicacion_marketing(uuid) from public;
grant execute on function public.solicitar_aprobacion_publicacion_marketing(uuid) to authenticated;
revoke all on function public.resolver_aprobacion_publicacion_marketing(uuid, boolean, text) from public;
grant execute on function public.resolver_aprobacion_publicacion_marketing(uuid, boolean, text) to authenticated;
revoke all on function public.programar_publicacion_marketing(uuid, timestamptz) from public;
grant execute on function public.programar_publicacion_marketing(uuid, timestamptz) to authenticated;
