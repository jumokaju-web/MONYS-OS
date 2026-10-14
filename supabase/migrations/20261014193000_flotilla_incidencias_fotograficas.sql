begin;

create table if not exists public.flotilla_incidencias (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  business_id uuid references public.businesses(id) on delete set null,
  branch_id uuid references public.branches(id) on delete set null,
  ruta_id uuid not null references public.flotilla_rutas(id) on delete cascade,
  unidad_id uuid not null references public.flotilla_unidades(id) on delete restrict,
  driver_auth_user_id uuid not null references auth.users(id) on delete restrict,
  chofer_nombre text not null,
  fecha date not null,
  tipo text not null check (tipo in (
    'ALTO_VALOR', 'PNR', 'CEDIS_SIN_ESPACIO', 'DESCONTENEDORIZADO',
    'DEVUELTO', 'DANO_UNIDAD', 'ACCIDENTE', 'OTRO'
  )),
  paquete_id text,
  descripcion text not null check (char_length(btrim(descripcion)) >= 8),
  foto_contexto_path text not null,
  foto_detalle_path text not null,
  fotos_extra_paths text[] not null default array[]::text[],
  estado text not null default 'PENDIENTE'
    check (estado in ('PENDIENTE', 'EN_REVISION', 'RESUELTA', 'RECHAZADA')),
  resolucion text,
  revisado_por uuid references auth.users(id) on delete set null,
  revisado_at timestamptz,
  client_event_id text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (driver_auth_user_id, client_event_id),
  check (cardinality(fotos_extra_paths) <= 2),
  check (
    tipo not in ('ALTO_VALOR', 'PNR', 'CEDIS_SIN_ESPACIO', 'DESCONTENEDORIZADO', 'DEVUELTO')
    or nullif(btrim(paquete_id), '') is not null
  ),
  check (
    estado not in ('RESUELTA', 'RECHAZADA')
    or nullif(btrim(resolucion), '') is not null
  )
);

-- MONYS ya tenía una tabla homónima para cargos operativos. La ampliamos sin
-- borrarla para conservar cualquier historial previo y convertirla en el
-- expediente fotográfico usado por la aplicación actual.
alter table public.flotilla_incidencias
  add column if not exists organization_id uuid references public.organizations(id) on delete cascade,
  add column if not exists business_id uuid references public.businesses(id) on delete set null,
  add column if not exists branch_id uuid references public.branches(id) on delete set null,
  add column if not exists driver_auth_user_id uuid references auth.users(id) on delete restrict,
  add column if not exists chofer_nombre text,
  add column if not exists paquete_id text,
  add column if not exists foto_contexto_path text,
  add column if not exists foto_detalle_path text,
  add column if not exists fotos_extra_paths text[] default array[]::text[],
  add column if not exists resolucion text,
  add column if not exists revisado_por uuid references auth.users(id) on delete set null,
  add column if not exists revisado_at timestamptz,
  add column if not exists client_event_id text;

alter table public.flotilla_incidencias
  drop constraint if exists flotilla_incidencias_tipo_check,
  drop constraint if exists flotilla_incidencias_estado_check,
  drop constraint if exists flotilla_incidencias_descripcion_check,
  drop constraint if exists flotilla_incidencias_fotos_extra_check,
  drop constraint if exists flotilla_incidencias_paquete_check,
  drop constraint if exists flotilla_incidencias_resolucion_check;

alter table public.flotilla_incidencias
  alter column organization_id set not null,
  alter column ruta_id set not null,
  alter column unidad_id set not null,
  alter column driver_auth_user_id set not null,
  alter column chofer_nombre set not null,
  alter column descripcion set not null,
  alter column foto_contexto_path set not null,
  alter column foto_detalle_path set not null,
  alter column fotos_extra_paths set default array[]::text[],
  alter column fotos_extra_paths set not null,
  alter column client_event_id set not null;

alter table public.flotilla_incidencias
  add constraint flotilla_incidencias_tipo_check check (tipo in (
    'ALTO_VALOR', 'PNR', 'CEDIS_SIN_ESPACIO', 'DESCONTENEDORIZADO',
    'DEVUELTO', 'DANO_UNIDAD', 'ACCIDENTE', 'OTRO'
  )),
  add constraint flotilla_incidencias_estado_check
    check (estado in ('PENDIENTE', 'EN_REVISION', 'RESUELTA', 'RECHAZADA')),
  add constraint flotilla_incidencias_descripcion_check
    check (char_length(btrim(descripcion)) >= 8),
  add constraint flotilla_incidencias_fotos_extra_check
    check (cardinality(fotos_extra_paths) <= 2),
  add constraint flotilla_incidencias_paquete_check check (
    tipo not in ('ALTO_VALOR', 'PNR', 'CEDIS_SIN_ESPACIO', 'DESCONTENEDORIZADO', 'DEVUELTO')
    or nullif(btrim(paquete_id), '') is not null
  ),
  add constraint flotilla_incidencias_resolucion_check check (
    estado not in ('RESUELTA', 'RECHAZADA')
    or nullif(btrim(resolucion), '') is not null
  );

create unique index if not exists flotilla_incidencias_driver_evento_uidx
  on public.flotilla_incidencias (driver_auth_user_id, client_event_id);

create index if not exists flotilla_incidencias_org_fecha_idx
  on public.flotilla_incidencias (organization_id, fecha desc, estado, created_at desc);
create index if not exists flotilla_incidencias_unidad_fecha_idx
  on public.flotilla_incidencias (unidad_id, fecha desc, created_at desc);
create index if not exists flotilla_incidencias_ruta_idx
  on public.flotilla_incidencias (ruta_id, created_at desc);

create or replace function public.preparar_incidencia_flotilla()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ruta public.flotilla_rutas%rowtype;
  v_es_admin boolean;
begin
  if TG_OP = 'UPDATE' then
    v_es_admin := public.flotilla_es_admin_de_organizacion(old.organization_id);
    if not v_es_admin then
      raise exception 'Solo Administración puede revisar una incidencia';
    end if;

    new.organization_id := old.organization_id;
    new.business_id := old.business_id;
    new.branch_id := old.branch_id;
    new.ruta_id := old.ruta_id;
    new.unidad_id := old.unidad_id;
    new.driver_auth_user_id := old.driver_auth_user_id;
    new.chofer_nombre := old.chofer_nombre;
    new.fecha := old.fecha;
    new.tipo := old.tipo;
    new.paquete_id := old.paquete_id;
    new.descripcion := old.descripcion;
    new.foto_contexto_path := old.foto_contexto_path;
    new.foto_detalle_path := old.foto_detalle_path;
    new.fotos_extra_paths := old.fotos_extra_paths;
    new.client_event_id := old.client_event_id;
    new.created_at := old.created_at;
    new.resolucion := nullif(btrim(new.resolucion), '');
    new.revisado_por := (select auth.uid());
    new.revisado_at := now();
    new.updated_at := now();
    return new;
  end if;

  select * into v_ruta from public.flotilla_rutas where id = new.ruta_id;
  if v_ruta.id is null then raise exception 'Ruta no encontrada'; end if;

  v_es_admin := public.flotilla_es_admin_de_organizacion(v_ruta.organization_id);
  if not v_es_admin and v_ruta.driver_auth_user_id is distinct from (select auth.uid()) then
    raise exception 'Solo el chofer de la ruta puede registrar la incidencia';
  end if;

  new.organization_id := v_ruta.organization_id;
  new.business_id := v_ruta.business_id;
  new.branch_id := v_ruta.branch_id;
  new.unidad_id := v_ruta.unidad_id;
  new.driver_auth_user_id := coalesce(v_ruta.driver_auth_user_id, (select auth.uid()));
  new.chofer_nombre := coalesce(nullif(btrim(v_ruta.chofer_nombre), ''), 'Chofer sin nombre');
  new.fecha := v_ruta.fecha;
  new.estado := 'PENDIENTE';
  new.resolucion := null;
  new.revisado_por := null;
  new.revisado_at := null;
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists flotilla_incidencia_preparar on public.flotilla_incidencias;
create trigger flotilla_incidencia_preparar
before insert or update on public.flotilla_incidencias
for each row execute function public.preparar_incidencia_flotilla();

alter table public.flotilla_incidencias enable row level security;
revoke all on public.flotilla_incidencias from anon;
grant select, insert, update on public.flotilla_incidencias to authenticated;

drop policy if exists flotilla_incidencias_select_alcance on public.flotilla_incidencias;
drop policy if exists flotilla_incidencias_insert_ruta_propia on public.flotilla_incidencias;
drop policy if exists flotilla_incidencias_update_admin on public.flotilla_incidencias;

create policy flotilla_incidencias_select_alcance on public.flotilla_incidencias
for select to authenticated using (public.flotilla_puede_ver_unidad(unidad_id));

create policy flotilla_incidencias_insert_ruta_propia on public.flotilla_incidencias
for insert to authenticated with check (
  driver_auth_user_id = (select auth.uid())
  or public.flotilla_es_admin_de_organizacion(organization_id)
);

create policy flotilla_incidencias_update_admin on public.flotilla_incidencias
for update to authenticated
using (public.flotilla_es_admin_de_organizacion(organization_id))
with check (public.flotilla_es_admin_de_organizacion(organization_id));

do $$
begin
  begin alter publication supabase_realtime add table public.flotilla_incidencias;
  exception when duplicate_object then null; end;
end $$;

comment on table public.flotilla_incidencias is
  'Expedientes privados de incidencias de Flotilla, ligados a ruta, unidad, chofer y evidencia fotográfica.';

commit;
