begin;

create table if not exists public.user_permission_overrides (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  usuario_id uuid not null references public.usuarios(id) on delete cascade,
  permission text not null,
  allowed boolean not null,
  changed_by uuid references auth.users(id) on delete set null,
  reason text not null check (length(trim(reason)) >= 4),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (usuario_id, permission)
);

create index if not exists user_permission_overrides_org_idx
  on public.user_permission_overrides (organization_id, usuario_id);

create table if not exists public.user_permission_audit (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  usuario_id uuid not null references public.usuarios(id) on delete restrict,
  permission text not null,
  previous_allowed boolean,
  new_allowed boolean not null,
  reason text not null check (length(trim(reason)) >= 4),
  changed_by uuid references auth.users(id) on delete set null,
  changed_at timestamptz not null default now()
);

create index if not exists user_permission_audit_user_date_idx
  on public.user_permission_audit (usuario_id, changed_at desc);

alter table public.user_permission_overrides enable row level security;
alter table public.user_permission_audit enable row level security;

revoke all on public.user_permission_overrides from anon;
revoke all on public.user_permission_audit from anon;
revoke insert, update, delete on public.user_permission_overrides from authenticated;
revoke insert, update, delete on public.user_permission_audit from authenticated;
grant select on public.user_permission_overrides to authenticated;
grant select on public.user_permission_audit to authenticated;

drop policy if exists user_permission_overrides_select on public.user_permission_overrides;
create policy user_permission_overrides_select on public.user_permission_overrides
for select to authenticated using (
  exists (
    select 1
    from public.usuarios actor
    where actor.auth_user_id = (select auth.uid())
      and actor.active = true
      and actor.organization_id = user_permission_overrides.organization_id
      and (
        actor.role = 'owner'
        or actor.id = user_permission_overrides.usuario_id
      )
  )
);

drop policy if exists user_permission_audit_owner_select on public.user_permission_audit;
create policy user_permission_audit_owner_select on public.user_permission_audit
for select to authenticated using (
  exists (
    select 1
    from public.usuarios actor
    where actor.auth_user_id = (select auth.uid())
      and actor.active = true
      and actor.role = 'owner'
      and actor.organization_id = user_permission_audit.organization_id
  )
);

create or replace function public.configurar_permisos_usuario(
  p_usuario_id uuid,
  p_cambios jsonb,
  p_motivo text
) returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_actor public.usuarios%rowtype;
  v_objetivo public.usuarios%rowtype;
  v_cambio jsonb;
  v_permission text;
  v_allowed boolean;
  v_previous boolean;
  v_actualizados integer := 0;
  v_permisos_validos constant text[] := array[
    'ver_finanzas',
    'ver_ventas',
    'ver_inventario',
    'ver_logistica',
    'ver_ordenes',
    'registrar_producto_solicitado',
    'registrar_incidencias',
    'registrar_ideas'
  ];
begin
  if length(trim(coalesce(p_motivo, ''))) < 4 then
    raise exception 'El motivo del cambio es obligatorio';
  end if;

  if jsonb_typeof(p_cambios) <> 'array' or jsonb_array_length(p_cambios) = 0 then
    raise exception 'No hay cambios de permisos para guardar';
  end if;

  select * into v_actor
  from public.usuarios
  where auth_user_id = auth.uid() and active = true
  limit 1;

  if v_actor.id is null or v_actor.role <> 'owner' then
    raise exception 'Solo la propietaria puede cambiar permisos';
  end if;

  select * into v_objetivo
  from public.usuarios
  where id = p_usuario_id
  for update;

  if v_objetivo.id is null or v_objetivo.organization_id <> v_actor.organization_id then
    raise exception 'No se encontró el usuario en tu organización';
  end if;

  if v_objetivo.role = 'owner' then
    raise exception 'Los permisos de la propietaria no se pueden limitar';
  end if;

  for v_cambio in select value from jsonb_array_elements(p_cambios)
  loop
    v_permission := trim(coalesce(v_cambio->>'permission', ''));

    if not (v_permission = any(v_permisos_validos)) then
      raise exception 'Permiso no válido: %', v_permission;
    end if;

    if jsonb_typeof(v_cambio->'allowed') <> 'boolean' then
      raise exception 'El estado del permiso % no es válido', v_permission;
    end if;

    v_allowed := (v_cambio->>'allowed')::boolean;

    v_previous := null;

    select allowed into v_previous
    from public.user_permission_overrides
    where usuario_id = v_objetivo.id and permission = v_permission;

    insert into public.user_permission_overrides (
      organization_id, usuario_id, permission, allowed, changed_by, reason
    ) values (
      v_objetivo.organization_id, v_objetivo.id, v_permission, v_allowed,
      auth.uid(), trim(p_motivo)
    )
    on conflict (usuario_id, permission) do update
    set allowed = excluded.allowed,
        changed_by = excluded.changed_by,
        reason = excluded.reason,
        updated_at = now();

    insert into public.user_permission_audit (
      organization_id, usuario_id, permission, previous_allowed,
      new_allowed, reason, changed_by
    ) values (
      v_objetivo.organization_id, v_objetivo.id, v_permission, v_previous,
      v_allowed, trim(p_motivo), auth.uid()
    );

    v_actualizados := v_actualizados + 1;
  end loop;

  return jsonb_build_object(
    'ok', true,
    'usuario_id', v_objetivo.id,
    'permisos_actualizados', v_actualizados
  );
end;
$$;

revoke all on function public.configurar_permisos_usuario(uuid,jsonb,text) from public;
grant execute on function public.configurar_permisos_usuario(uuid,jsonb,text) to authenticated;

commit;
