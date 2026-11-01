alter table public.marketing_publicaciones
  add column if not exists tipo_campana text not null default 'ORGANICA',
  add column if not exists presupuesto_propuesto numeric(14,2) not null default 0,
  add column if not exists moneda text not null default 'MXN',
  add column if not exists presupuesto_autorizado numeric(14,2) null,
  add column if not exists presupuesto_autorizado_por uuid null,
  add column if not exists presupuesto_autorizado_en timestamptz null,
  add column if not exists requiere_autorizacion_duena boolean not null default false;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'marketing_publicaciones_tipo_campana_check') then
    alter table public.marketing_publicaciones
      add constraint marketing_publicaciones_tipo_campana_check
      check (tipo_campana in ('ORGANICA', 'PAGADA'));
  end if;

  if not exists (select 1 from pg_constraint where conname = 'marketing_publicaciones_presupuesto_check') then
    alter table public.marketing_publicaciones
      add constraint marketing_publicaciones_presupuesto_check
      check (
        presupuesto_propuesto >= 0
        and (presupuesto_autorizado is null or presupuesto_autorizado >= 0)
      );
  end if;

  if not exists (select 1 from pg_constraint where conname = 'marketing_publicaciones_moneda_check') then
    alter table public.marketing_publicaciones
      add constraint marketing_publicaciones_moneda_check
      check (moneda in ('MXN', 'USD'));
  end if;
end;
$$;

alter table public.marketing_politicas_publicacion
  alter column publicar_organico_automatico set default true;

insert into public.marketing_politicas_publicacion (
  organization_id,
  business_id,
  publicar_organico_automatico,
  publicar_pagado_automatico,
  limite_por_campana,
  limite_diario,
  created_by
)
select
  negocio.organization_id,
  negocio.id,
  true,
  false,
  0,
  0,
  propietario.user_id
from public.businesses negocio
join lateral (
  select miembro.user_id
  from public.organization_members miembro
  where miembro.organization_id = negocio.organization_id
    and miembro.active
    and lower(miembro.role) in ('owner', 'admin')
  order by case when lower(miembro.role) = 'owner' then 0 else 1 end
  limit 1
) propietario on true
where negocio.active
on conflict (organization_id, business_id) do nothing;

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

  select publicacion.*
  into v_publicacion
  from public.marketing_publicaciones publicacion
  where publicacion.id = p_publicacion_id
    and publicacion.estado in ('APROBADA', 'PROGRAMADA')
  for update of publicacion;

  select lower(usuario.role)
  into v_rol
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
  set estado = 'PROGRAMADA',
      programada_para = p_programada_para,
      updated_at = now(),
      ultimo_error = null
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
