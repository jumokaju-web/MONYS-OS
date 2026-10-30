begin;

-- Activar o pausar personal es una capacidad separada de crear usuarios,
-- cambiar roles/permisos o eliminar cuentas.
create or replace function private.monys_puede_gestionar_estado_usuario(
  p_organization_id uuid,
  p_role_objetivo text
) returns boolean
language sql
stable
security definer
set search_path = ''
as $function$
  select exists (
    select 1
    from public.usuarios actor
    where actor.auth_user_id = (select auth.uid())
      and actor.active is true
      and actor.organization_id = p_organization_id
      and (
        actor.role = 'owner'
        or (
          p_role_objetivo <> 'owner'
          and coalesce(
            (
              select excepcion.allowed
              from public.user_permission_overrides excepcion
              where excepcion.usuario_id = actor.id
                and excepcion.permission = 'gestionar_estado_usuarios'
              limit 1
            ),
            (
              select permiso.allowed
              from public.role_permissions permiso
              where permiso.role = actor.role
                and permiso.permission = 'gestionar_estado_usuarios'
              limit 1
            ),
            false
          )
        )
      )
  );
$function$;

revoke all on function private.monys_puede_gestionar_estado_usuario(uuid,text)
  from public, anon;
grant execute on function private.monys_puede_gestionar_estado_usuario(uuid,text)
  to authenticated;

-- Conserva el editor de permisos de la propietaria como única vía para
-- conceder o retirar esta capacidad después de la autorización inicial.
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
    'gestionar_estado_usuarios',
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

drop policy if exists monys_usuarios_leer_mi_perfil_o_alcance on public.usuarios;
create policy monys_usuarios_leer_mi_perfil_o_alcance
  on public.usuarios
  for select
  to authenticated
  using (
    auth_user_id = (select auth.uid())
    or private.monys_puede_gestionar_estado_usuario(organization_id, role)
  );

drop policy if exists monys_usuarios_actualizar_estado_en_alcance on public.usuarios;
create policy monys_usuarios_actualizar_estado_en_alcance
  on public.usuarios
  for update
  to authenticated
  using (private.monys_puede_gestionar_estado_usuario(organization_id, role))
  with check (private.monys_puede_gestionar_estado_usuario(organization_id, role));

-- Kary/Karla recibe únicamente la capacidad solicitada. La migración exige una
-- sola coincidencia exacta en Monys Glam Centro para no autorizar a otra persona.
do $autorizar_kary$
declare
  v_kary public.usuarios%rowtype;
  v_coincidencias integer;
begin
  select count(*)
    into v_coincidencias
  from public.usuarios usuario
  join public.businesses negocio on negocio.id = usuario.business_id
  join public.branches sucursal on sucursal.id = usuario.branch_id
  where upper(trim(usuario.nombre)) = 'KARLA YOSELIN'
    and lower(trim(negocio.name)) = 'monys glam'
    and lower(trim(sucursal.name)) = 'centro';

  if v_coincidencias <> 1 then
    raise exception 'No se pudo identificar de forma única a Kary/Karla en Monys Glam Centro';
  end if;

  select usuario.* into v_kary
  from public.usuarios usuario
  join public.businesses negocio on negocio.id = usuario.business_id
  join public.branches sucursal on sucursal.id = usuario.branch_id
  where upper(trim(usuario.nombre)) = 'KARLA YOSELIN'
    and lower(trim(negocio.name)) = 'monys glam'
    and lower(trim(sucursal.name)) = 'centro';

  insert into public.user_permission_overrides (
    organization_id, usuario_id, permission, allowed, changed_by, reason
  ) values (
    v_kary.organization_id,
    v_kary.id,
    'gestionar_estado_usuarios',
    true,
    null,
    'Autorizado por Mónica para activar o pausar personal'
  )
  on conflict (usuario_id, permission) do update
  set allowed = excluded.allowed,
      reason = excluded.reason,
      updated_at = now();

  insert into public.user_permission_audit (
    organization_id, usuario_id, permission, previous_allowed,
    new_allowed, reason, changed_by
  ) values (
    v_kary.organization_id,
    v_kary.id,
    'gestionar_estado_usuarios',
    null,
    true,
    'Autorizado por Mónica para activar o pausar personal',
    null
  );
end;
$autorizar_kary$;

commit;
