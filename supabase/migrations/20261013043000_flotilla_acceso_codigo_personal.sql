begin;

create table if not exists public.flotilla_codigos_acceso (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  unidad_id uuid not null references public.flotilla_unidades(id) on delete cascade,
  codigo_hash text not null,
  intentos smallint not null default 0 check (intentos between 0 and 8),
  vence_en timestamptz not null,
  usado_en timestamptz,
  usado_por uuid references auth.users(id) on delete set null,
  revocado_en timestamptz,
  creado_por uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now()
);

create index if not exists flotilla_codigos_acceso_unidad_idx on public.flotilla_codigos_acceso (unidad_id, created_at desc);
alter table public.flotilla_codigos_acceso enable row level security;
revoke all on public.flotilla_codigos_acceso from anon, authenticated;

create or replace function public.generar_codigo_activacion_chofer(p_unidad_id uuid)
returns table (codigo text, vence_en timestamptz)
language plpgsql security definer set search_path = public, extensions
as $$
declare
  v_unidad public.flotilla_unidades%rowtype;
  v_codigo text;
  v_vence_en timestamptz := now() + interval '7 days';
begin
  select * into v_unidad from public.flotilla_unidades where id = p_unidad_id;
  if v_unidad.id is null then raise exception 'Unidad no encontrada'; end if;
  if not public.flotilla_es_admin_de_organizacion(v_unidad.organization_id) then raise exception 'No tienes permiso para generar el código de esta unidad'; end if;
  if nullif(btrim(v_unidad.chofer_nombre), '') is null then raise exception 'Primero asigna un chofer a la unidad'; end if;
  if v_unidad.chofer_auth_user_id is not null then raise exception 'Esta unidad ya tiene acceso activado'; end if;
  update public.flotilla_codigos_acceso set revocado_en = now() where unidad_id = p_unidad_id and usado_en is null and revocado_en is null;
  v_codigo := upper(encode(gen_random_bytes(6), 'hex'));
  insert into public.flotilla_codigos_acceso (organization_id, unidad_id, codigo_hash, vence_en, creado_por)
  values (v_unidad.organization_id, v_unidad.id, encode(digest(v_unidad.id::text || ':' || v_codigo, 'sha256'), 'hex'), v_vence_en, (select auth.uid()));
  return query select v_codigo, v_vence_en;
end;
$$;
revoke all on function public.generar_codigo_activacion_chofer(uuid) from public;
grant execute on function public.generar_codigo_activacion_chofer(uuid) to authenticated;

create or replace function public.activar_chofer_con_codigo(p_placas text, p_codigo text)
returns table (activado boolean, mensaje text, unidad_id uuid, placas text, chofer_nombre text)
language plpgsql security definer set search_path = public, extensions
as $$
declare
  v_auth_uid uuid := (select auth.uid());
  v_unidad public.flotilla_unidades%rowtype;
  v_acceso public.flotilla_codigos_acceso%rowtype;
  v_codigo_normalizado text := upper(regexp_replace(coalesce(p_codigo, ''), '[^A-Z0-9]', '', 'g'));
begin
  if v_auth_uid is null then
    return query select false, 'Primero inicia la activación segura.', null::uuid, null::text, null::text; return;
  end if;
  if length(v_codigo_normalizado) <> 12 then
    return query select false, 'El código debe tener 12 caracteres.', null::uuid, null::text, null::text; return;
  end if;

  select * into v_unidad from public.flotilla_unidades u
  where upper(regexp_replace(coalesce(u.placas, ''), '[^A-Z0-9]', '', 'g')) = upper(regexp_replace(coalesce(p_placas, ''), '[^A-Z0-9]', '', 'g'))
  limit 1 for update;

  if v_unidad.id is null then
    return query select false, 'No encontramos esa unidad.', null::uuid, null::text, null::text; return;
  end if;
  if v_unidad.chofer_auth_user_id = v_auth_uid then
    return query select true, 'Este teléfono ya estaba activado.', v_unidad.id, v_unidad.placas, v_unidad.chofer_nombre; return;
  end if;
  if v_unidad.chofer_auth_user_id is not null then
    return query select false, 'La unidad ya está activada en otro teléfono. Pide a Administración que la restablezca.', null::uuid, null::text, null::text; return;
  end if;
  if exists (select 1 from public.flotilla_unidades u where u.chofer_auth_user_id = v_auth_uid and u.id <> v_unidad.id) then
    return query select false, 'Este teléfono ya está vinculado a otra unidad.', null::uuid, null::text, null::text; return;
  end if;

  select * into v_acceso from public.flotilla_codigos_acceso a
  where a.unidad_id = v_unidad.id and a.usado_en is null and a.revocado_en is null
  order by a.created_at desc limit 1 for update;

  if v_acceso.id is null or v_acceso.vence_en <= now() then
    return query select false, 'El código venció o fue reemplazado. Solicita uno nuevo.', null::uuid, null::text, null::text; return;
  end if;
  if v_acceso.intentos >= 8 then
    return query select false, 'El código se bloqueó por seguridad. Solicita uno nuevo.', null::uuid, null::text, null::text; return;
  end if;
  if v_acceso.codigo_hash <> encode(digest(v_unidad.id::text || ':' || v_codigo_normalizado, 'sha256'), 'hex') then
    update public.flotilla_codigos_acceso set intentos = least(intentos + 1, 8) where id = v_acceso.id;
    return query select false, 'El código no es correcto.', null::uuid, null::text, null::text; return;
  end if;

  if exists (select 1 from public.usuarios u where u.auth_user_id = v_auth_uid and (not u.active or u.role <> 'chofer')) then
    return query select false, 'La sesión actual no puede activarse como chofer.', null::uuid, null::text, null::text; return;
  end if;

  insert into public.usuarios (organization_id, business_id, branch_id, auth_user_id, nombre, role, active)
  values (v_unidad.organization_id, v_unidad.business_id, v_unidad.branch_id, v_auth_uid, v_unidad.chofer_nombre, 'chofer', true)
  on conflict (auth_user_id) do update set organization_id = excluded.organization_id, business_id = excluded.business_id,
    branch_id = excluded.branch_id, nombre = excluded.nombre, role = 'chofer', active = true, updated_at = now();

  update public.flotilla_unidades set chofer_auth_user_id = v_auth_uid where id = v_unidad.id;
  update public.flotilla_codigos_acceso set usado_en = now(), usado_por = v_auth_uid where id = v_acceso.id;
  return query select true, 'Acceso activado.', v_unidad.id, v_unidad.placas, v_unidad.chofer_nombre;
end;
$$;
revoke all on function public.activar_chofer_con_codigo(text, text) from public;
grant execute on function public.activar_chofer_con_codigo(text, text) to authenticated;
commit;
