begin;

create table if not exists public.flotilla_accesos_usuario (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  auth_user_id uuid not null references auth.users(id) on delete cascade,
  correo text not null,
  nombre text not null,
  tipo_acceso text not null check (tipo_acceso in ('ADMIN_FLOTILLA', 'SOCIO_CONSULTA')),
  socio_nombre text check (socio_nombre is null or socio_nombre in ('Kary', 'Chory', 'Abraham')),
  activo boolean not null default true,
  configurado_por uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, auth_user_id),
  check (tipo_acceso <> 'SOCIO_CONSULTA' or socio_nombre is not null)
);

create table if not exists public.flotilla_acceso_unidades (
  acceso_id uuid not null references public.flotilla_accesos_usuario(id) on delete cascade,
  unidad_id uuid not null references public.flotilla_unidades(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (acceso_id, unidad_id)
);

create or replace function public.flotilla_es_admin_de_organizacion(p_organization_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.usuarios usuario
    where usuario.auth_user_id = (select auth.uid())
      and usuario.active
      and usuario.organization_id = p_organization_id
      and usuario.role in ('owner', 'admin', 'director')
  ) or exists (
    select 1 from public.flotilla_accesos_usuario acceso
    where acceso.auth_user_id = (select auth.uid())
      and acceso.organization_id = p_organization_id
      and acceso.tipo_acceso = 'ADMIN_FLOTILLA'
      and acceso.activo
  );
$$;

create or replace function public.flotilla_puede_ver_unidad(p_unidad_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.flotilla_unidades unidad
    where unidad.id = p_unidad_id
      and (
        unidad.chofer_auth_user_id = (select auth.uid())
        or public.flotilla_es_admin_de_organizacion(unidad.organization_id)
        or exists (
          select 1
          from public.flotilla_accesos_usuario acceso
          join public.flotilla_acceso_unidades alcance on alcance.acceso_id = acceso.id
          where acceso.auth_user_id = (select auth.uid())
            and acceso.organization_id = unidad.organization_id
            and acceso.tipo_acceso = 'SOCIO_CONSULTA'
            and acceso.activo
            and alcance.unidad_id = unidad.id
        )
      )
  );
$$;

revoke all on function public.flotilla_puede_ver_unidad(uuid) from public;
grant execute on function public.flotilla_puede_ver_unidad(uuid) to authenticated;

create or replace function public.configurar_acceso_flotilla(
  p_correo text,
  p_tipo_acceso text,
  p_socio_nombre text default null,
  p_unidad_ids uuid[] default array[]::uuid[]
)
returns table (acceso_id uuid, correo text, tipo_acceso text, socio_nombre text, unidades integer)
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_owner public.usuarios%rowtype;
  v_destino public.usuarios%rowtype;
  v_auth_user_id uuid;
  v_acceso_id uuid;
begin
  select * into v_owner from public.usuarios
  where auth_user_id = (select auth.uid()) and active
  limit 1;
  if v_owner.id is null or v_owner.role <> 'owner' then
    raise exception 'Solo la propietaria puede configurar accesos de Flotilla';
  end if;
  if p_tipo_acceso not in ('ADMIN_FLOTILLA', 'SOCIO_CONSULTA') then
    raise exception 'Tipo de acceso no válido';
  end if;
  if p_tipo_acceso = 'SOCIO_CONSULTA' and p_socio_nombre not in ('Kary', 'Chory', 'Abraham') then
    raise exception 'Selecciona Kary, Chory o Abraham';
  end if;

  select id into v_auth_user_id from auth.users
  where lower(email) = lower(btrim(p_correo))
  limit 1;
  if v_auth_user_id is null then
    raise exception 'Ese correo todavía no tiene cuenta en MONYS OS';
  end if;

  select * into v_destino from public.usuarios
  where auth_user_id = v_auth_user_id and active
  limit 1;
  if v_destino.id is null or v_destino.organization_id <> v_owner.organization_id then
    raise exception 'La cuenta no está activa dentro de esta organización';
  end if;

  insert into public.flotilla_accesos_usuario (
    organization_id, auth_user_id, correo, nombre, tipo_acceso, socio_nombre, activo, configurado_por
  ) values (
    v_owner.organization_id, v_auth_user_id, lower(btrim(p_correo)), v_destino.nombre, p_tipo_acceso,
    case when p_tipo_acceso = 'SOCIO_CONSULTA' then p_socio_nombre else null end,
    true, (select auth.uid())
  )
  on conflict (organization_id, auth_user_id) do update
  set correo = excluded.correo,
      nombre = excluded.nombre,
      tipo_acceso = excluded.tipo_acceso,
      socio_nombre = excluded.socio_nombre,
      activo = true,
      configurado_por = excluded.configurado_por,
      updated_at = now()
  returning id into v_acceso_id;

  delete from public.flotilla_acceso_unidades where acceso_id = v_acceso_id;
  if p_tipo_acceso = 'SOCIO_CONSULTA' then
    insert into public.flotilla_acceso_unidades (acceso_id, unidad_id)
    select v_acceso_id, unidad.id
    from public.flotilla_unidades unidad
    where unidad.organization_id = v_owner.organization_id
      and unidad.id = any(coalesce(p_unidad_ids, array[]::uuid[]));
  end if;

  perform public.configurar_permisos_usuario(
    v_destino.id,
    jsonb_build_array(jsonb_build_object('permission', 'ver_logistica', 'allowed', true)),
    'Acceso controlado a Flotilla'
  );

  return query select v_acceso_id, lower(btrim(p_correo)), p_tipo_acceso,
    case when p_tipo_acceso = 'SOCIO_CONSULTA' then p_socio_nombre else null end,
    (select count(*)::integer from public.flotilla_acceso_unidades where flotilla_acceso_unidades.acceso_id = v_acceso_id);
end;
$$;

revoke all on function public.configurar_acceso_flotilla(text, text, text, uuid[]) from public;
grant execute on function public.configurar_acceso_flotilla(text, text, text, uuid[]) to authenticated;

create or replace function public.desactivar_acceso_flotilla(p_correo text)
returns boolean
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_owner public.usuarios%rowtype;
  v_destino public.usuarios%rowtype;
  v_auth_user_id uuid;
  v_actualizados integer := 0;
begin
  select * into v_owner from public.usuarios
  where auth_user_id = (select auth.uid()) and active
  limit 1;
  if v_owner.id is null or v_owner.role <> 'owner' then
    raise exception 'Solo la propietaria puede quitar accesos de Flotilla';
  end if;

  select id into v_auth_user_id from auth.users
  where lower(email) = lower(btrim(p_correo))
  limit 1;
  select * into v_destino from public.usuarios
  where auth_user_id = v_auth_user_id
    and organization_id = v_owner.organization_id
  limit 1;
  if v_destino.id is null then raise exception 'No se encontró la cuenta'; end if;

  update public.flotilla_accesos_usuario
  set activo = false, configurado_por = (select auth.uid()), updated_at = now()
  where organization_id = v_owner.organization_id and auth_user_id = v_auth_user_id;
  get diagnostics v_actualizados = row_count;

  perform public.configurar_permisos_usuario(
    v_destino.id,
    jsonb_build_array(jsonb_build_object('permission', 'ver_logistica', 'allowed', false)),
    'Acceso de Flotilla retirado'
  );
  return v_actualizados > 0;
end;
$$;

revoke all on function public.desactivar_acceso_flotilla(text) from public;
grant execute on function public.desactivar_acceso_flotilla(text) to authenticated;

alter table public.flotilla_accesos_usuario enable row level security;
alter table public.flotilla_acceso_unidades enable row level security;
revoke all on public.flotilla_accesos_usuario, public.flotilla_acceso_unidades from anon;
grant select on public.flotilla_accesos_usuario, public.flotilla_acceso_unidades to authenticated;

create policy flotilla_accesos_select_alcance on public.flotilla_accesos_usuario
for select to authenticated using (
  auth_user_id = (select auth.uid())
  or public.flotilla_es_admin_de_organizacion(organization_id)
);

create policy flotilla_acceso_unidades_select_alcance on public.flotilla_acceso_unidades
for select to authenticated using (
  exists (
    select 1 from public.flotilla_accesos_usuario acceso
    where acceso.id = acceso_id
      and (acceso.auth_user_id = (select auth.uid()) or public.flotilla_es_admin_de_organizacion(acceso.organization_id))
  )
);

drop policy if exists flotilla_unidades_select_alcance on public.flotilla_unidades;
create policy flotilla_unidades_select_alcance on public.flotilla_unidades
for select to authenticated using (public.flotilla_puede_ver_unidad(id));

drop policy if exists flotilla_rutas_select_alcance on public.flotilla_rutas;
create policy flotilla_rutas_select_alcance on public.flotilla_rutas
for select to authenticated using (public.flotilla_puede_ver_unidad(unidad_id));

drop policy if exists flotilla_eventos_select_alcance on public.flotilla_eventos;
create policy flotilla_eventos_select_alcance on public.flotilla_eventos
for select to authenticated using (
  driver_auth_user_id = (select auth.uid())
  or public.flotilla_es_admin_de_organizacion(organization_id)
  or exists (select 1 from public.flotilla_rutas ruta where ruta.id = ruta_id and public.flotilla_puede_ver_unidad(ruta.unidad_id))
);

drop policy if exists flotilla_dinero_select_alcance on public.flotilla_movimientos_dinero;
create policy flotilla_dinero_select_alcance on public.flotilla_movimientos_dinero
for select to authenticated using (public.flotilla_puede_ver_unidad(unidad_id));

drop policy if exists flotilla_ambulancia_select_alcance on public.flotilla_ambulancias;
create policy flotilla_ambulancia_select_alcance on public.flotilla_ambulancias
for select to authenticated using (
  driver_auth_user_id = (select auth.uid())
  or public.flotilla_es_admin_de_organizacion(organization_id)
  or exists (select 1 from public.flotilla_rutas ruta where ruta.id = ruta_origen_id and public.flotilla_puede_ver_unidad(ruta.unidad_id))
);

drop policy if exists flotilla_cuenta_select_alcance on public.flotilla_cuenta_chofer;
create policy flotilla_cuenta_select_alcance on public.flotilla_cuenta_chofer
for select to authenticated using (public.flotilla_puede_ver_unidad(unidad_id));

drop policy if exists flotilla_revision_evidencias_select_alcance on public.flotilla_revision_evidencias;
create policy flotilla_revision_evidencias_select_alcance on public.flotilla_revision_evidencias
for select to authenticated using (
  exists (select 1 from public.flotilla_rutas ruta where ruta.id = ruta_id and public.flotilla_puede_ver_unidad(ruta.unidad_id))
);

create policy flotilla_prestamos_socios_select on public.flotilla_prestamos
for select to authenticated using (
  exists (
    select 1 from public.flotilla_accesos_usuario acceso
    where acceso.auth_user_id = (select auth.uid())
      and acceso.organization_id = flotilla_prestamos.organization_id
      and acceso.tipo_acceso = 'SOCIO_CONSULTA'
      and acceso.socio_nombre = flotilla_prestamos.beneficiario_nombre
      and acceso.activo
  )
);

create policy flotilla_prestamo_abonos_socios_select on public.flotilla_prestamo_abonos
for select to authenticated using (
  exists (
    select 1
    from public.flotilla_prestamos prestamo
    join public.flotilla_accesos_usuario acceso
      on acceso.organization_id = prestamo.organization_id
     and acceso.socio_nombre = prestamo.beneficiario_nombre
    where prestamo.id = prestamo_id
      and acceso.auth_user_id = (select auth.uid())
      and acceso.tipo_acceso = 'SOCIO_CONSULTA'
      and acceso.activo
  )
);

create policy flotilla_rental_cortes_socios_select on public.flotilla_rental_cortes
for select to authenticated using (
  exists (
    select 1 from public.flotilla_accesos_usuario acceso
    where acceso.auth_user_id = (select auth.uid())
      and acceso.organization_id = flotilla_rental_cortes.organization_id
      and acceso.tipo_acceso = 'SOCIO_CONSULTA' and acceso.activo
  )
);

create policy flotilla_rental_liquidaciones_socios_select on public.flotilla_rental_liquidaciones
for select to authenticated using (
  exists (
    select 1 from public.flotilla_accesos_usuario acceso
    where acceso.auth_user_id = (select auth.uid())
      and acceso.organization_id = flotilla_rental_liquidaciones.organization_id
      and acceso.tipo_acceso = 'SOCIO_CONSULTA' and acceso.activo
  )
);

create policy flotilla_rental_repartos_socios_select on public.flotilla_rental_repartos
for select to authenticated using (
  exists (
    select 1 from public.flotilla_accesos_usuario acceso
    where acceso.auth_user_id = (select auth.uid())
      and acceso.organization_id = flotilla_rental_repartos.organization_id
      and acceso.tipo_acceso = 'SOCIO_CONSULTA' and acceso.activo
  )
);

drop policy if exists flotilla_evidencia_select_alcance on storage.objects;
create policy flotilla_evidencia_select_alcance on storage.objects
for select to authenticated using (
  bucket_id = 'flotilla-evidencias'
  and (
    (storage.foldername(name))[1] = (select auth.uid())::text
    or exists (
      select 1 from public.flotilla_rutas ruta
      where ruta.id::text = (storage.foldername(name))[2]
        and public.flotilla_puede_ver_unidad(ruta.unidad_id)
    )
  )
);

do $$
begin
  begin alter publication supabase_realtime add table public.flotilla_accesos_usuario;
  exception when duplicate_object then null; end;
  begin alter publication supabase_realtime add table public.flotilla_acceso_unidades;
  exception when duplicate_object then null; end;
end $$;

commit;
