begin;

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
    'gestionar_personal_operativo',
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

  select * into v_actor from public.usuarios
  where auth_user_id = auth.uid() and active = true limit 1;
  if v_actor.id is null or v_actor.role <> 'owner' then
    raise exception 'Solo la propietaria puede cambiar permisos';
  end if;

  select * into v_objetivo from public.usuarios where id = p_usuario_id for update;
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
    select allowed into v_previous from public.user_permission_overrides
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

-- Corrige la identidad: Kary es KARI JIMENEZ / Ana Karina, no Karla Yoselin.
-- Karla conserva su perfil de vendedora y Kary recibe supervisión operativa.
do $trasladar_control_personal$
declare
  v_kary public.usuarios%rowtype;
  v_karla public.usuarios%rowtype;
  v_total integer;
  v_permiso text;
begin
  select count(*) into v_total
  from public.usuarios
  where upper(trim(nombre)) = 'KARI JIMENEZ'
    and lower(trim(correo)) = 'karijim2390@gmail.com';

  if v_total <> 1 then
    raise exception 'No se pudo identificar de forma única la cuenta de Kary';
  end if;

  select * into v_kary
  from public.usuarios
  where upper(trim(nombre)) = 'KARI JIMENEZ'
    and lower(trim(correo)) = 'karijim2390@gmail.com';

  select count(*) into v_total
  from public.usuarios
  where upper(trim(nombre)) = 'KARLA YOSELIN'
    and lower(trim(correo)) = 'karlayose.jica@gmail.com';

  if v_total <> 1 then
    raise exception 'No se pudo identificar de forma única la cuenta de Karla Yoselin';
  end if;

  select * into v_karla
  from public.usuarios
  where upper(trim(nombre)) = 'KARLA YOSELIN'
    and lower(trim(correo)) = 'karlayose.jica@gmail.com';

  foreach v_permiso in array array[
    'gestionar_estado_usuarios',
    'gestionar_personal_operativo'
  ]
  loop
    insert into public.user_permission_overrides (
      organization_id, usuario_id, permission, allowed, changed_by, reason
    ) values (
      v_kary.organization_id, v_kary.id, v_permiso, true, null,
      'Kary es mano derecha operativa de Mónica para personal y tiendas'
    )
    on conflict (usuario_id, permission) do update
    set allowed = true,
        reason = excluded.reason,
        updated_at = now();

    insert into public.user_permission_audit (
      organization_id, usuario_id, permission, previous_allowed,
      new_allowed, reason, changed_by
    ) values (
      v_kary.organization_id, v_kary.id, v_permiso, null, true,
      'Kary es mano derecha operativa de Mónica para personal y tiendas', null
    );
  end loop;

  insert into public.user_permission_overrides (
    organization_id, usuario_id, permission, allowed, changed_by, reason
  ) values (
    v_karla.organization_id, v_karla.id, 'gestionar_estado_usuarios', false, null,
    'Corrección de identidad: el permiso corresponde a Kary, no a Karla Yoselin'
  )
  on conflict (usuario_id, permission) do update
  set allowed = false,
      reason = excluded.reason,
      updated_at = now();

  insert into public.user_permission_audit (
    organization_id, usuario_id, permission, previous_allowed,
    new_allowed, reason, changed_by
  ) values (
    v_karla.organization_id, v_karla.id, 'gestionar_estado_usuarios', true, false,
    'Corrección de identidad: el permiso corresponde a Kary, no a Karla Yoselin', null
  );
end;
$trasladar_control_personal$;

commit;
