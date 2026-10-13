begin;

-- La base productiva ya usa flotilla_rutas, movimientos, ambulancias y cuenta_chofer.
-- Esta migración amplía ese modelo; no crea una operación paralela.
alter table public.flotilla_unidades
  add column if not exists chofer_auth_user_id uuid references auth.users(id) on delete set null,
  add column if not exists tipo_pago_chory text
    check (tipo_pago_chory is null or tipo_pago_chory in ('MLP', 'RENTAL_SMALL', 'RENTAL_LARGE'));

update public.flotilla_unidades
set tipo_pago_chory = 'MLP'
where tipo_operacion = 'MLP' and tipo_pago_chory is null;

create index if not exists flotilla_unidades_chofer_auth_idx
  on public.flotilla_unidades (chofer_auth_user_id);

alter table public.flotilla_rutas
  add column if not exists km_inicial numeric(12,2),
  add column if not exists km_final numeric(12,2),
  add column if not exists gasolina_in text,
  add column if not exists gasolina_out text,
  add column if not exists foto_salida_path text,
  add column if not exists foto_cierre_path text,
  add column if not exists tipo_pago text
    check (tipo_pago is null or tipo_pago in ('MLP', 'RENTAL_SMALL', 'RENTAL_LARGE')),
  add column if not exists client_updated_at timestamptz;

create unique index if not exists flotilla_rutas_chory_evento_uidx
  on public.flotilla_rutas (driver_auth_user_id, chory_ruta_id);

create index if not exists flotilla_rutas_org_fecha_idx
  on public.flotilla_rutas (organization_id, fecha, estado, updated_at desc);

alter table public.flotilla_movimientos_dinero
  add column if not exists uso text
    check (uso is null or uso in ('GASOLINA', 'PERSONAL', 'REPARACION', 'COMIDA', 'OTRO')),
  add column if not exists litros numeric(10,3) check (litros is null or litros >= 0),
  add column if not exists pagador text
    check (pagador is null or pagador in ('EMPRESA', 'CHOFER', 'OTRO')),
  add column if not exists evidencia_path text,
  add column if not exists client_event_id text;

alter table public.flotilla_movimientos_dinero
  alter column origen_dinero drop not null;

create unique index if not exists flotilla_movimientos_dinero_evento_uidx
  on public.flotilla_movimientos_dinero (driver_auth_user_id, client_event_id);

alter table public.flotilla_ambulancias
  add column if not exists organization_id uuid references public.organizations(id) on delete cascade,
  add column if not exists business_id uuid references public.businesses(id) on delete set null,
  add column if not exists branch_id uuid references public.branches(id) on delete set null,
  add column if not exists driver_auth_user_id uuid references auth.users(id) on delete set null,
  add column if not exists registrado_por uuid references auth.users(id) on delete set null,
  add column if not exists evidencia_path text,
  add column if not exists client_event_id text;

create unique index if not exists flotilla_ambulancias_evento_uidx
  on public.flotilla_ambulancias (driver_auth_user_id, client_event_id);

alter table public.flotilla_eventos
  add column if not exists ruta_id uuid references public.flotilla_rutas(id) on delete cascade;

create index if not exists flotilla_eventos_ruta_idx
  on public.flotilla_eventos (ruta_id, creado_en desc);

create table if not exists public.flotilla_rental_cortes (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  fecha date not null default ((now() at time zone 'America/Mexico_City')::date),
  ingreso numeric(12,2) not null default 0 check (ingreso >= 0),
  otro_concepto text,
  otro_importe numeric(12,2) not null default 0 check (otro_importe >= 0),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, fecha),
  check (otro_importe = 0 or nullif(btrim(otro_concepto), '') is not null)
);

create or replace function public.flotilla_es_admin_de_organizacion(p_organization_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.usuarios u
    where u.auth_user_id = (select auth.uid())
      and u.active
      and u.organization_id = p_organization_id
      and u.role in ('owner', 'admin', 'director', 'logistica')
  );
$$;

revoke all on function public.flotilla_es_admin_de_organizacion(uuid) from public;
grant execute on function public.flotilla_es_admin_de_organizacion(uuid) to authenticated;

create or replace function public.preparar_ruta_chory()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_usuario public.usuarios%rowtype;
  v_unidad public.flotilla_unidades%rowtype;
  v_es_admin boolean;
begin
  select * into v_usuario from public.usuarios
  where auth_user_id = (select auth.uid()) and active limit 1;
  if v_usuario.id is null then raise exception 'Cuenta sin usuario activo de MONYS OS'; end if;
  v_es_admin := v_usuario.role in ('owner', 'admin', 'director', 'logistica');

  select * into v_unidad from public.flotilla_unidades where id = new.unidad_id;
  if v_unidad.id is null then raise exception 'Unidad no encontrada'; end if;
  if not v_es_admin and v_unidad.chofer_auth_user_id is distinct from (select auth.uid()) then
    raise exception 'La unidad no está vinculada a este chofer';
  end if;

  if not v_es_admin then
    if TG_OP = 'UPDATE' then
      if old.estado = 'FINALIZADA' then
        raise exception 'Una ruta finalizada solo puede corregirla Administración';
      end if;
    end if;
    new.organization_id := v_usuario.organization_id;
    new.business_id := v_usuario.business_id;
    new.branch_id := v_usuario.branch_id;
    new.driver_auth_user_id := (select auth.uid());
    new.chofer_nombre := v_usuario.nombre;
    if new.estado not in ('CARGADA', 'EN_RUTA', 'FINALIZADA') then
      raise exception 'Estado de ruta no permitido para el chofer';
    end if;
  else
    new.organization_id := coalesce(new.organization_id, v_unidad.organization_id, v_usuario.organization_id);
    new.business_id := coalesce(new.business_id, v_usuario.business_id);
    new.branch_id := coalesce(new.branch_id, v_usuario.branch_id);
  end if;
  new.registrado_por := coalesce(new.registrado_por, (select auth.uid()));
  new.tipo_pago := coalesce(new.tipo_pago, v_unidad.tipo_pago_chory);
  if new.tipo_pago is null and (not v_es_admin or new.chory_ruta_id is not null) then
    raise exception 'Administración debe configurar el tipo de pago de la unidad';
  end if;
  if new.km_inicial is not null and new.km_final is not null then
    if new.km_final < new.km_inicial then raise exception 'El KM final no puede ser menor al inicial'; end if;
    new.kilometros_ruta := new.km_final - new.km_inicial;
  end if;
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists flotilla_ruta_chory_preparar on public.flotilla_rutas;
create trigger flotilla_ruta_chory_preparar
before insert or update on public.flotilla_rutas
for each row execute function public.preparar_ruta_chory();

create or replace function public.preparar_evento_chory()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_usuario public.usuarios%rowtype;
  v_ruta public.flotilla_rutas%rowtype;
  v_es_admin boolean;
begin
  select * into v_usuario from public.usuarios
  where auth_user_id = (select auth.uid()) and active limit 1;
  if v_usuario.id is null then raise exception 'Cuenta sin usuario activo de MONYS OS'; end if;
  v_es_admin := v_usuario.role in ('owner', 'admin', 'director', 'logistica');

  if new.ruta_id is null then
    if not v_es_admin then raise exception 'El evento del chofer requiere una ruta'; end if;
    new.organization_id := coalesce(new.organization_id, v_usuario.organization_id);
  else
    select * into v_ruta from public.flotilla_rutas where id = new.ruta_id;
    if v_ruta.id is null then raise exception 'Ruta no encontrada'; end if;
    if not v_es_admin and v_ruta.driver_auth_user_id is distinct from (select auth.uid()) then
      raise exception 'Solo el chofer de la ruta puede registrar el evento';
    end if;
    new.organization_id := v_ruta.organization_id;
    new.business_id := v_ruta.business_id;
    new.branch_id := v_ruta.branch_id;
    new.driver_auth_user_id := v_ruta.driver_auth_user_id;
    new.registrado_por := coalesce(new.registrado_por, (select auth.uid()));
  end if;
  return new;
end;
$$;

drop trigger if exists flotilla_evento_chory_preparar on public.flotilla_eventos;
create trigger flotilla_evento_chory_preparar
before insert on public.flotilla_eventos
for each row execute function public.preparar_evento_chory();

create or replace function public.preparar_movimiento_dinero_chory()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_usuario public.usuarios%rowtype;
  v_ruta public.flotilla_rutas%rowtype;
  v_es_admin boolean;
begin
  select * into v_usuario from public.usuarios
  where auth_user_id = (select auth.uid()) and active limit 1;
  if v_usuario.id is null then raise exception 'Cuenta sin usuario activo de MONYS OS'; end if;
  v_es_admin := v_usuario.role in ('owner', 'admin', 'director', 'logistica');
  if new.ruta_id is null then
    if not v_es_admin then raise exception 'El movimiento del chofer requiere una ruta'; end if;
    new.organization_id := coalesce(new.organization_id, v_usuario.organization_id);
    new.registrado_por := coalesce(new.registrado_por, (select auth.uid()));
    new.updated_at := now();
    return new;
  end if;
  select * into v_ruta from public.flotilla_rutas where id = new.ruta_id;
  if v_ruta.id is null then raise exception 'Ruta no encontrada'; end if;
  if not v_es_admin and v_ruta.driver_auth_user_id is distinct from (select auth.uid()) then
    raise exception 'Solo el chofer de la ruta puede capturar el movimiento';
  end if;
  if not v_es_admin and new.tipo_movimiento not in ('GASOLINA', 'ADELANTO') then
    raise exception 'Movimiento no permitido para el chofer';
  end if;

  new.organization_id := v_ruta.organization_id;
  new.business_id := v_ruta.business_id;
  new.branch_id := v_ruta.branch_id;
  new.unidad_id := v_ruta.unidad_id;
  new.chofer_nombre := v_ruta.chofer_nombre;
  new.driver_auth_user_id := v_ruta.driver_auth_user_id;
  new.registrado_por := coalesce(new.registrado_por, (select auth.uid()));
  new.referencia_externa := coalesce(new.referencia_externa, new.client_event_id);
  if not v_es_admin then
    new.estado_conciliacion := 'PENDIENTE';
    new.afecta_cuenta_chofer := new.tipo_movimiento = 'ADELANTO';
  end if;
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists flotilla_dinero_chory_preparar on public.flotilla_movimientos_dinero;
create trigger flotilla_dinero_chory_preparar
before insert or update on public.flotilla_movimientos_dinero
for each row execute function public.preparar_movimiento_dinero_chory();

create or replace function public.aplicar_adelanto_entregado_chory()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.tipo_movimiento = 'ADELANTO'
     and new.estado_conciliacion = 'CONCILIADO'
     and old.estado_conciliacion is distinct from new.estado_conciliacion
     and not exists (
       select 1 from public.flotilla_cuenta_chofer
       where referencia_origen = 'MOVIMIENTO_DINERO:' || new.id::text
     ) then
    insert into public.flotilla_cuenta_chofer (
      fecha, chofer_nombre, unidad_id, ruta_id, tipo_movimiento, concepto, monto,
      naturaleza, automatico, origen_dinero, estado_conciliacion, referencia_origen,
      organization_id, business_id, branch_id, driver_auth_user_id, registrado_por
    ) values (
      new.fecha, new.chofer_nombre, new.unidad_id, new.ruta_id, 'ADELANTO',
      coalesce(nullif(new.observaciones, ''), 'Adelanto entregado'), new.monto,
      'RESTA', true, new.origen_dinero, 'CONCILIADO', 'MOVIMIENTO_DINERO:' || new.id::text,
      new.organization_id, new.business_id, new.branch_id, new.driver_auth_user_id, (select auth.uid())
    );
  end if;
  return new;
end;
$$;

drop trigger if exists flotilla_adelanto_chory_aplicar on public.flotilla_movimientos_dinero;
create trigger flotilla_adelanto_chory_aplicar
after update of estado_conciliacion on public.flotilla_movimientos_dinero
for each row execute function public.aplicar_adelanto_entregado_chory();

create or replace function public.preparar_ambulancia_chory()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_usuario public.usuarios%rowtype;
  v_ruta public.flotilla_rutas%rowtype;
  v_es_admin boolean;
begin
  select * into v_usuario from public.usuarios
  where auth_user_id = (select auth.uid()) and active limit 1;
  if v_usuario.id is null then raise exception 'Cuenta sin usuario activo de MONYS OS'; end if;
  v_es_admin := v_usuario.role in ('owner', 'admin', 'director', 'logistica');
  if new.ruta_origen_id is null then
    if not v_es_admin then raise exception 'La ambulancia del chofer requiere una ruta'; end if;
    new.organization_id := coalesce(new.organization_id, v_usuario.organization_id);
    new.registrado_por := coalesce(new.registrado_por, (select auth.uid()));
    new.updated_at := now();
    return new;
  end if;
  select * into v_ruta from public.flotilla_rutas where id = new.ruta_origen_id;
  if v_ruta.id is null then raise exception 'Ruta no encontrada'; end if;
  if not v_es_admin and v_ruta.driver_auth_user_id is distinct from (select auth.uid()) then
    raise exception 'Solo el chofer de la ruta puede registrar la ambulancia';
  end if;
  new.organization_id := v_ruta.organization_id;
  new.business_id := v_ruta.business_id;
  new.branch_id := v_ruta.branch_id;
  new.driver_auth_user_id := v_ruta.driver_auth_user_id;
  new.registrado_por := coalesce(new.registrado_por, (select auth.uid()));
  if not v_es_admin then new.estado := 'REGISTRADA'; end if;
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists flotilla_ambulancia_chory_preparar on public.flotilla_ambulancias;
create trigger flotilla_ambulancia_chory_preparar
before insert or update on public.flotilla_ambulancias
for each row execute function public.preparar_ambulancia_chory();

create or replace function public.aplicar_ambulancia_confirmada_chory()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.estado = 'CONFIRMADA'
     and old.estado is distinct from new.estado
     and new.pago_por_kilometraje > 0
     and not exists (
       select 1 from public.flotilla_cuenta_chofer
       where referencia_origen = 'AMBULANCIA:' || new.id::text
     ) then
    insert into public.flotilla_cuenta_chofer (
      fecha, chofer_nombre, unidad_id, ruta_id, ambulancia_id, tipo_movimiento,
      concepto, monto, naturaleza, automatico, estado_conciliacion, referencia_origen,
      organization_id, business_id, branch_id, driver_auth_user_id, registrado_por
    ) values (
      new.fecha, new.ayudante, new.unidad_apoyo_id, new.ruta_origen_id, new.id, 'AMBULANCIA',
      'Ambulancia confirmada', new.pago_por_kilometraje, 'SUMA', true, 'CONCILIADO',
      'AMBULANCIA:' || new.id::text, new.organization_id, new.business_id,
      new.branch_id, new.driver_auth_user_id, (select auth.uid())
    );
  end if;
  return new;
end;
$$;

drop trigger if exists flotilla_ambulancia_chory_aplicar on public.flotilla_ambulancias;
create trigger flotilla_ambulancia_chory_aplicar
after update of estado on public.flotilla_ambulancias
for each row execute function public.aplicar_ambulancia_confirmada_chory();

create or replace function public.preparar_corte_rental_flotilla()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_usuario public.usuarios%rowtype;
begin
  select * into v_usuario from public.usuarios
  where auth_user_id = (select auth.uid()) and active limit 1;
  if v_usuario.id is null or v_usuario.role not in ('owner', 'admin', 'director', 'logistica') then
    raise exception 'Solo Administración puede guardar el corte de rentals';
  end if;
  new.organization_id := v_usuario.organization_id;
  if TG_OP = 'INSERT' then new.created_by := (select auth.uid()); end if;
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists flotilla_rental_corte_preparar on public.flotilla_rental_cortes;
create trigger flotilla_rental_corte_preparar
before insert or update on public.flotilla_rental_cortes
for each row execute function public.preparar_corte_rental_flotilla();

-- Conserva visibles los registros históricos antes de restringir las políticas.
update public.flotilla_rutas r
set organization_id = coalesce(r.organization_id, u.organization_id)
from public.flotilla_unidades u
where r.unidad_id = u.id and r.organization_id is null;

update public.flotilla_movimientos_dinero m
set organization_id = coalesce(m.organization_id, r.organization_id),
    business_id = coalesce(m.business_id, r.business_id),
    branch_id = coalesce(m.branch_id, r.branch_id),
    driver_auth_user_id = coalesce(m.driver_auth_user_id, r.driver_auth_user_id)
from public.flotilla_rutas r
where m.ruta_id = r.id
  and (m.organization_id is null or m.driver_auth_user_id is null);

update public.flotilla_ambulancias a
set organization_id = coalesce(a.organization_id, r.organization_id),
    business_id = coalesce(a.business_id, r.business_id),
    branch_id = coalesce(a.branch_id, r.branch_id),
    driver_auth_user_id = coalesce(a.driver_auth_user_id, r.driver_auth_user_id)
from public.flotilla_rutas r
where a.ruta_origen_id = r.id
  and (a.organization_id is null or a.driver_auth_user_id is null);

update public.flotilla_cuenta_chofer c
set organization_id = coalesce(c.organization_id, r.organization_id),
    business_id = coalesce(c.business_id, r.business_id),
    branch_id = coalesce(c.branch_id, r.branch_id),
    driver_auth_user_id = coalesce(c.driver_auth_user_id, r.driver_auth_user_id)
from public.flotilla_rutas r
where c.ruta_id = r.id
  and (c.organization_id is null or c.driver_auth_user_id is null);

alter table public.flotilla_unidades enable row level security;
alter table public.flotilla_rutas enable row level security;
alter table public.flotilla_eventos enable row level security;
alter table public.flotilla_movimientos_dinero enable row level security;
alter table public.flotilla_ambulancias enable row level security;
alter table public.flotilla_cuenta_chofer enable row level security;
alter table public.flotilla_rental_cortes enable row level security;

revoke all on public.flotilla_rutas, public.flotilla_eventos,
  public.flotilla_movimientos_dinero, public.flotilla_ambulancias,
  public.flotilla_cuenta_chofer, public.flotilla_rental_cortes from anon;
grant select on public.flotilla_unidades to authenticated;
grant select, insert, update on public.flotilla_rutas, public.flotilla_eventos,
  public.flotilla_movimientos_dinero, public.flotilla_ambulancias,
  public.flotilla_cuenta_chofer, public.flotilla_rental_cortes to authenticated;

drop policy if exists flotilla_unidades_select_authenticated on public.flotilla_unidades;
drop policy if exists flotilla_unidades_select_alcance on public.flotilla_unidades;
create policy flotilla_unidades_select_alcance on public.flotilla_unidades
for select to authenticated using (
  chofer_auth_user_id = (select auth.uid())
  or public.flotilla_es_admin_de_organizacion(organization_id)
);

drop policy if exists flotilla_rutas_select_authenticated on public.flotilla_rutas;
drop policy if exists flotilla_rutas_select_alcance on public.flotilla_rutas;
drop policy if exists flotilla_rutas_insert_alcance on public.flotilla_rutas;
drop policy if exists flotilla_rutas_update_alcance on public.flotilla_rutas;
create policy flotilla_rutas_select_alcance on public.flotilla_rutas
for select to authenticated using (
  driver_auth_user_id = (select auth.uid())
  or public.flotilla_es_admin_de_organizacion(organization_id)
);
create policy flotilla_rutas_insert_alcance on public.flotilla_rutas
for insert to authenticated with check (
  driver_auth_user_id = (select auth.uid())
  or public.flotilla_es_admin_de_organizacion(organization_id)
);
create policy flotilla_rutas_update_alcance on public.flotilla_rutas
for update to authenticated using (
  driver_auth_user_id = (select auth.uid())
  or public.flotilla_es_admin_de_organizacion(organization_id)
) with check (
  driver_auth_user_id = (select auth.uid())
  or public.flotilla_es_admin_de_organizacion(organization_id)
);

drop policy if exists flotilla_eventos_select_alcance on public.flotilla_eventos;
drop policy if exists flotilla_eventos_insert_propio on public.flotilla_eventos;
create policy flotilla_eventos_select_alcance on public.flotilla_eventos
for select to authenticated using (
  driver_auth_user_id = (select auth.uid())
  or public.flotilla_es_admin_de_organizacion(organization_id)
);
create policy flotilla_eventos_insert_propio on public.flotilla_eventos
for insert to authenticated with check (driver_auth_user_id = (select auth.uid()));

drop policy if exists flotilla_dinero_select_alcance on public.flotilla_movimientos_dinero;
drop policy if exists flotilla_dinero_insert_propio on public.flotilla_movimientos_dinero;
drop policy if exists flotilla_dinero_update_admin on public.flotilla_movimientos_dinero;
create policy flotilla_dinero_select_alcance on public.flotilla_movimientos_dinero
for select to authenticated using (
  driver_auth_user_id = (select auth.uid())
  or public.flotilla_es_admin_de_organizacion(organization_id)
);
create policy flotilla_dinero_insert_propio on public.flotilla_movimientos_dinero
for insert to authenticated with check (driver_auth_user_id = (select auth.uid()));
create policy flotilla_dinero_update_admin on public.flotilla_movimientos_dinero
for update to authenticated using (public.flotilla_es_admin_de_organizacion(organization_id))
with check (public.flotilla_es_admin_de_organizacion(organization_id));

drop policy if exists flotilla_ambulancia_select_alcance on public.flotilla_ambulancias;
drop policy if exists flotilla_ambulancia_insert_propia on public.flotilla_ambulancias;
drop policy if exists flotilla_ambulancia_update_admin on public.flotilla_ambulancias;
create policy flotilla_ambulancia_select_alcance on public.flotilla_ambulancias
for select to authenticated using (
  driver_auth_user_id = (select auth.uid())
  or public.flotilla_es_admin_de_organizacion(organization_id)
);
create policy flotilla_ambulancia_insert_propia on public.flotilla_ambulancias
for insert to authenticated with check (driver_auth_user_id = (select auth.uid()));
create policy flotilla_ambulancia_update_admin on public.flotilla_ambulancias
for update to authenticated using (public.flotilla_es_admin_de_organizacion(organization_id))
with check (public.flotilla_es_admin_de_organizacion(organization_id));

drop policy if exists flotilla_cuenta_select_alcance on public.flotilla_cuenta_chofer;
drop policy if exists flotilla_cuenta_insert_admin on public.flotilla_cuenta_chofer;
create policy flotilla_cuenta_select_alcance on public.flotilla_cuenta_chofer
for select to authenticated using (
  driver_auth_user_id = (select auth.uid())
  or public.flotilla_es_admin_de_organizacion(organization_id)
);
create policy flotilla_cuenta_insert_admin on public.flotilla_cuenta_chofer
for insert to authenticated with check (public.flotilla_es_admin_de_organizacion(organization_id));

drop policy if exists flotilla_rental_cortes_admin on public.flotilla_rental_cortes;
create policy flotilla_rental_cortes_admin on public.flotilla_rental_cortes
for all to authenticated
using (public.flotilla_es_admin_de_organizacion(organization_id))
with check (public.flotilla_es_admin_de_organizacion(organization_id));

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('flotilla-evidencias', 'flotilla-evidencias', false, 10485760, array['image/jpeg','image/png','image/webp'])
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists flotilla_evidencia_insert_propia on storage.objects;
drop policy if exists flotilla_evidencia_select_alcance on storage.objects;
create policy flotilla_evidencia_insert_propia on storage.objects
for insert to authenticated with check (
  bucket_id = 'flotilla-evidencias'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);
create policy flotilla_evidencia_select_alcance on storage.objects
for select to authenticated using (
  bucket_id = 'flotilla-evidencias'
  and (
    (storage.foldername(name))[1] = (select auth.uid())::text
    or exists (
      select 1 from public.flotilla_rutas r
      where r.id::text = (storage.foldername(name))[2]
        and public.flotilla_es_admin_de_organizacion(r.organization_id)
    )
  )
);

do $$
begin
  begin alter publication supabase_realtime add table public.flotilla_rutas;
  exception when duplicate_object then null; end;
  begin alter publication supabase_realtime add table public.flotilla_movimientos_dinero;
  exception when duplicate_object then null; end;
  begin alter publication supabase_realtime add table public.flotilla_ambulancias;
  exception when duplicate_object then null; end;
  begin alter publication supabase_realtime add table public.flotilla_rental_cortes;
  exception when duplicate_object then null; end;
end $$;

commit;
