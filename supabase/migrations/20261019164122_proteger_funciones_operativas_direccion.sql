begin;

create or replace function private.monys_proteger_funciones_config_operativa()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  actor_id uuid := (select auth.uid());
  actor_es_direccion boolean := false;
  responsabilidades_autorizadas text[];
  areas_solicitadas text[];
begin
  if actor_id is null then
    raise exception 'Se requiere una sesión autenticada.' using errcode = '42501';
  end if;

  select exists (
    select 1
    from public.usuarios direccion
    join public.empleados empleado on empleado.id = new.empleado_id
    where direccion.auth_user_id = actor_id
      and direccion.active
      and lower(direccion.role) in ('owner', 'director', 'admin', 'rh')
      and direccion.organization_id = empleado.organization_id
      and (direccion.business_id is null or direccion.business_id = empleado.business_id)
      and (direccion.branch_id is null or direccion.branch_id = empleado.branch_id)
  ) into actor_es_direccion;

  if actor_es_direccion then
    return new;
  end if;

  if tg_op = 'UPDATE' then
    if new.empleado_id is distinct from old.empleado_id
      or new.usuario_id is distinct from old.usuario_id
      or new.branch_id is distinct from old.branch_id
      or new.area_asignada is distinct from old.area_asignada
      or new.areas_asignadas is distinct from old.areas_asignadas
    then
      raise exception 'Solo Dirección puede cambiar las funciones de trabajo.' using errcode = '42501';
    end if;

    return new;
  end if;

  if new.usuario_id is distinct from actor_id then
    raise exception 'El perfil operativo debe pertenecer a la sesión autenticada.' using errcode = '42501';
  end if;

  select array(
    select distinct upper(trim(responsabilidad))
    from unnest(coalesce(empleado.responsabilidades, '{}'::text[])) responsabilidad
    where upper(trim(responsabilidad)) in (
      'VENTA_TIENDA',
      'VENTA_WHATSAPP',
      'PUBLICAR_GRUPOS_WHATSAPP',
      'CAJA_CORTE',
      'INVENTARIO_APOYO'
    )
    order by 1
  )
  into responsabilidades_autorizadas
  from public.empleados empleado
  where empleado.id = new.empleado_id
    and empleado.active
    and empleado.branch_id = new.branch_id
    and (
      empleado.usuario_id = actor_id
      or exists (
        select 1
        from public.usuarios acceso
        where acceso.id = empleado.usuario_id
          and acceso.auth_user_id = actor_id
          and acceso.active
      )
    );

  if coalesce(cardinality(responsabilidades_autorizadas), 0) = 0 then
    raise exception 'Dirección debe asignar funciones antes de crear el perfil operativo.' using errcode = '42501';
  end if;

  select array(
    select distinct upper(trim(area))
    from unnest(coalesce(new.areas_asignadas, array[new.area_asignada]::text[])) area
    where area is not null and trim(area) <> ''
    order by 1
  ) into areas_solicitadas;

  if areas_solicitadas is distinct from responsabilidades_autorizadas
    or not (upper(trim(new.area_asignada)) = any(responsabilidades_autorizadas))
  then
    raise exception 'Las funciones iniciales deben coincidir con las asignadas por Dirección.' using errcode = '42501';
  end if;

  return new;
end;
$$;

revoke all on function private.monys_proteger_funciones_config_operativa()
from public, anon, authenticated;

drop trigger if exists proteger_funciones_config_operativa
on public.empleado_configuracion_operativa;

create trigger proteger_funciones_config_operativa
before insert or update on public.empleado_configuracion_operativa
for each row
execute function private.monys_proteger_funciones_config_operativa();

commit;
