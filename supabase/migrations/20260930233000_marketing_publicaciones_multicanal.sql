create table if not exists public.marketing_publicaciones (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  business_id uuid not null references public.businesses(id),
  branch_id uuid null references public.branches(id),
  campana_id uuid null references public.campanas_marketing(id) on delete set null,
  created_by uuid not null default auth.uid(),
  approved_by uuid null,
  productos jsonb not null default '[]'::jsonb,
  canales text[] not null default '{}'::text[],
  contenidos_por_canal jsonb not null default '{}'::jsonb,
  estado text not null default 'BORRADOR',
  requiere_autorizacion boolean not null default true,
  observaciones_aprobacion text null,
  programada_para timestamptz null,
  aprobada_en timestamptz null,
  publicada_en timestamptz null,
  referencias_externas jsonb not null default '{}'::jsonb,
  ultimo_error text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint marketing_publicaciones_estado_check check (
    estado in (
      'BORRADOR',
      'PENDIENTE_APROBACION',
      'REQUIERE_AJUSTES',
      'APROBADA',
      'PROGRAMADA',
      'PUBLICANDO',
      'PUBLICADA',
      'ERROR',
      'CANCELADA'
    )
  ),
  constraint marketing_publicaciones_canales_check check (
    cardinality(canales) > 0
  ),
  constraint marketing_publicaciones_productos_array_check check (
    jsonb_typeof(productos) = 'array'
  ),
  constraint marketing_publicaciones_contenidos_object_check check (
    jsonb_typeof(contenidos_por_canal) = 'object'
  )
);

create index if not exists marketing_publicaciones_contexto_idx
  on public.marketing_publicaciones (
    organization_id,
    business_id,
    branch_id,
    created_at desc
  );

create index if not exists marketing_publicaciones_estado_idx
  on public.marketing_publicaciones (estado, programada_para);

alter table public.marketing_publicaciones enable row level security;

drop policy if exists "Miembros consultan publicaciones de marketing"
  on public.marketing_publicaciones;

create policy "Miembros consultan publicaciones de marketing"
on public.marketing_publicaciones
for select
to authenticated
using (
  exists (
    select 1
    from public.organization_members miembro
    where miembro.organization_id = marketing_publicaciones.organization_id
      and miembro.user_id = (select auth.uid())
      and miembro.active
  )
);

drop policy if exists "Miembros crean borradores de marketing"
  on public.marketing_publicaciones;

create policy "Miembros crean borradores de marketing"
on public.marketing_publicaciones
for insert
to authenticated
with check (
  created_by = (select auth.uid())
  and estado = 'BORRADOR'
  and exists (
    select 1
    from public.organization_members miembro
    where miembro.organization_id = marketing_publicaciones.organization_id
      and miembro.user_id = (select auth.uid())
      and miembro.active
  )
);

drop policy if exists "Autores editan borradores de marketing"
  on public.marketing_publicaciones;

create policy "Autores editan borradores de marketing"
on public.marketing_publicaciones
for update
to authenticated
using (
  created_by = (select auth.uid())
  and estado in ('BORRADOR', 'REQUIERE_AJUSTES')
)
with check (
  created_by = (select auth.uid())
  and estado in ('BORRADOR', 'REQUIERE_AJUSTES')
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
begin
  update public.marketing_publicaciones publicacion
  set estado = 'PENDIENTE_APROBACION',
      updated_at = now(),
      ultimo_error = null
  where publicacion.id = p_publicacion_id
    and publicacion.created_by = (select auth.uid())
    and publicacion.estado in ('BORRADOR', 'REQUIERE_AJUSTES')
    and exists (
      select 1
      from public.organization_members miembro
      where miembro.organization_id = publicacion.organization_id
        and miembro.user_id = (select auth.uid())
        and miembro.active
    )
  returning publicacion.* into v_publicacion;

  if v_publicacion.id is null then
    raise exception 'No se pudo enviar esta publicación a autorización.';
  end if;

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
begin
  update public.marketing_publicaciones publicacion
  set estado = case
        when p_aprobar then 'APROBADA'
        else 'REQUIERE_AJUSTES'
      end,
      approved_by = case
        when p_aprobar then (select auth.uid())
        else null
      end,
      aprobada_en = case
        when p_aprobar then now()
        else null
      end,
      observaciones_aprobacion = nullif(trim(p_observaciones), ''),
      updated_at = now()
  where publicacion.id = p_publicacion_id
    and publicacion.estado = 'PENDIENTE_APROBACION'
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
    raise exception 'No tienes autorización para resolver esta publicación.';
  end if;

  return v_publicacion;
end;
$$;

revoke all on function public.solicitar_aprobacion_publicacion_marketing(uuid)
  from public;
grant execute on function public.solicitar_aprobacion_publicacion_marketing(uuid)
  to authenticated;

revoke all on function public.resolver_aprobacion_publicacion_marketing(uuid, boolean, text)
  from public;
grant execute on function public.resolver_aprobacion_publicacion_marketing(uuid, boolean, text)
  to authenticated;

