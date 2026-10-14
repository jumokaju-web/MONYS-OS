begin;

alter table public.flotilla_movimientos_dinero
  add column if not exists evidencia_ticket_path text,
  add column if not exists evidencia_tablero_antes_path text,
  add column if not exists evidencia_tablero_despues_path text,
  add column if not exists clasificacion_gasolina text;

update public.flotilla_movimientos_dinero
set evidencia_ticket_path = evidencia_path
where tipo_movimiento = 'GASOLINA'
  and evidencia_ticket_path is null
  and evidencia_path is not null;

alter table public.flotilla_movimientos_dinero
  drop constraint if exists flotilla_movimientos_dinero_clasificacion_gasolina_check;

alter table public.flotilla_movimientos_dinero
  add constraint flotilla_movimientos_dinero_clasificacion_gasolina_check
  check (
    clasificacion_gasolina is null
    or clasificacion_gasolina in ('GASOLINA_APROBADA', 'PRESTAMO_PERSONAL')
  );

alter table public.flotilla_revision_evidencias
  drop constraint if exists flotilla_revision_evidencias_tipo_evidencia_check;

alter table public.flotilla_revision_evidencias
  add constraint flotilla_revision_evidencias_tipo_evidencia_check
  check (tipo_evidencia in (
    'FOTO_SALIDA',
    'FOTO_CIERRE',
    'GASOLINA',
    'GASOLINA_TICKET',
    'GASOLINA_TABLERO_ANTES',
    'GASOLINA_TABLERO_DESPUES',
    'AMBULANCIA'
  ));

create table if not exists public.flotilla_prestamos (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  tipo_beneficiario text not null check (tipo_beneficiario in ('CHOFER', 'EMPLEADO', 'FLOTISTA')),
  beneficiario_nombre text not null,
  beneficiario_auth_user_id uuid references auth.users(id) on delete set null,
  movimiento_gasolina_id uuid unique references public.flotilla_movimientos_dinero(id) on delete restrict,
  fecha date not null default ((now() at time zone 'America/Mexico_City')::date),
  concepto text not null,
  monto_original numeric(12,2) not null check (monto_original > 0),
  saldo numeric(12,2) not null check (saldo >= 0),
  estado text not null default 'PENDIENTE' check (estado in ('PENDIENTE', 'PAGADO', 'CANCELADO')),
  automatico boolean not null default false,
  motivo_cancelacion text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (saldo <= monto_original),
  check (estado <> 'CANCELADO' or nullif(btrim(motivo_cancelacion), '') is not null)
);

create table if not exists public.flotilla_prestamo_abonos (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  prestamo_id uuid not null references public.flotilla_prestamos(id) on delete restrict,
  fecha date not null default ((now() at time zone 'America/Mexico_City')::date),
  monto numeric(12,2) not null check (monto > 0),
  observaciones text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists flotilla_prestamos_org_estado_idx
  on public.flotilla_prestamos (organization_id, estado, fecha desc);

create index if not exists flotilla_prestamo_abonos_prestamo_idx
  on public.flotilla_prestamo_abonos (prestamo_id, fecha desc);

create or replace function public.clasificar_gasolina_por_evidencias(p_movimiento_id uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_movimiento public.flotilla_movimientos_dinero%rowtype;
  v_aprobadas integer;
  v_clasificacion text;
begin
  select * into v_movimiento
  from public.flotilla_movimientos_dinero
  where id = p_movimiento_id
  for update;

  if v_movimiento.id is null or v_movimiento.tipo_movimiento <> 'GASOLINA' then
    return null;
  end if;

  select count(*) into v_aprobadas
  from public.flotilla_revision_evidencias revision
  where revision.ruta_id = v_movimiento.ruta_id
    and revision.referencia_id = v_movimiento.id
    and revision.estado = 'APROBADA'
    and revision.evidencia_key in (
      'GASOLINA_TICKET:' || v_movimiento.id::text,
      'GASOLINA_TABLERO_ANTES:' || v_movimiento.id::text,
      'GASOLINA_TABLERO_DESPUES:' || v_movimiento.id::text
    );

  v_clasificacion := case
    when coalesce(v_movimiento.evidencia_ticket_path, v_movimiento.evidencia_path) is not null
      and v_movimiento.evidencia_tablero_antes_path is not null
      and v_movimiento.evidencia_tablero_despues_path is not null
      and v_aprobadas = 3
      then 'GASOLINA_APROBADA'
    else 'PRESTAMO_PERSONAL'
  end;

  update public.flotilla_movimientos_dinero
  set clasificacion_gasolina = v_clasificacion,
      updated_at = now()
  where id = v_movimiento.id;

  return v_clasificacion;
end;
$$;

revoke all on function public.clasificar_gasolina_por_evidencias(uuid) from public;
grant execute on function public.clasificar_gasolina_por_evidencias(uuid) to authenticated;

create or replace function public.sincronizar_prestamo_gasolina()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_referencia text := 'GASOLINA_SIN_EVIDENCIA:' || new.id::text;
  v_es_prestamo boolean := new.tipo_movimiento = 'GASOLINA'
    and new.clasificacion_gasolina = 'PRESTAMO_PERSONAL'
    and new.estado_conciliacion <> 'DESCARTADO';
begin
  if new.tipo_movimiento <> 'GASOLINA' then return new; end if;

  if v_es_prestamo then
    if exists (
      select 1 from public.flotilla_cuenta_chofer
      where referencia_origen = v_referencia
    ) then
      update public.flotilla_cuenta_chofer
      set monto = new.monto,
          concepto = 'Préstamo personal: gasolina sin ticket y tableros aprobados',
          estado_conciliacion = 'CONCILIADO',
          updated_at = now()
      where referencia_origen = v_referencia;
    else
      insert into public.flotilla_cuenta_chofer (
        fecha, chofer_nombre, unidad_id, ruta_id, tipo_movimiento, concepto, monto,
        naturaleza, automatico, origen_dinero, estado_conciliacion, referencia_origen,
        organization_id, business_id, branch_id, driver_auth_user_id, registrado_por
      ) values (
        new.fecha, new.chofer_nombre, new.unidad_id, new.ruta_id, 'PRESTAMO',
        'Préstamo personal: gasolina sin ticket y tableros aprobados', new.monto,
        'RESTA', true, new.origen_dinero, 'CONCILIADO', v_referencia,
        new.organization_id, new.business_id, new.branch_id, new.driver_auth_user_id,
        coalesce(new.registrado_por, (select auth.uid()))
      );
    end if;

    insert into public.flotilla_prestamos (
      organization_id, tipo_beneficiario, beneficiario_nombre,
      beneficiario_auth_user_id, movimiento_gasolina_id, fecha, concepto,
      monto_original, saldo, estado, automatico, created_by
    ) values (
      new.organization_id, 'CHOFER', coalesce(new.chofer_nombre, 'Chofer sin nombre'),
      new.driver_auth_user_id, new.id, new.fecha,
      'Gasolina sin ticket y tableros aprobados', new.monto, new.monto,
      'PENDIENTE', true, coalesce(new.registrado_por, (select auth.uid()))
    )
    on conflict (movimiento_gasolina_id) do update
    set monto_original = excluded.monto_original,
        saldo = greatest(0, excluded.monto_original - coalesce((
          select sum(abono.monto)
          from public.flotilla_prestamo_abonos abono
          where abono.prestamo_id = public.flotilla_prestamos.id
        ), 0)),
        estado = case
          when excluded.monto_original <= coalesce((
            select sum(abono.monto)
            from public.flotilla_prestamo_abonos abono
            where abono.prestamo_id = public.flotilla_prestamos.id
          ), 0) then 'PAGADO'
          else 'PENDIENTE'
        end,
        motivo_cancelacion = null,
        updated_at = now();
  else
    update public.flotilla_cuenta_chofer
    set estado_conciliacion = 'DESCARTADO',
        concepto = 'Préstamo cancelado: gasolina comprobada con tres evidencias',
        updated_at = now()
    where referencia_origen = v_referencia
      and estado_conciliacion <> 'DESCARTADO';

    update public.flotilla_prestamos
    set estado = 'CANCELADO', saldo = 0,
        motivo_cancelacion = 'Gasolina comprobada con ticket y tableros aprobados',
        updated_at = now()
    where movimiento_gasolina_id = new.id
      and estado = 'PENDIENTE';
  end if;

  return new;
end;
$$;

drop trigger if exists flotilla_gasolina_sincronizar_prestamo on public.flotilla_movimientos_dinero;
create trigger flotilla_gasolina_sincronizar_prestamo
after update of monto, estado_conciliacion, clasificacion_gasolina
on public.flotilla_movimientos_dinero
for each row execute function public.sincronizar_prestamo_gasolina();

create or replace function public.reclasificar_gasolina_al_revisar()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.tipo_evidencia in (
    'GASOLINA',
    'GASOLINA_TICKET',
    'GASOLINA_TABLERO_ANTES',
    'GASOLINA_TABLERO_DESPUES'
  ) and new.referencia_id is not null then
    perform public.clasificar_gasolina_por_evidencias(new.referencia_id);
  end if;
  return new;
end;
$$;

drop trigger if exists flotilla_gasolina_reclasificar_revision on public.flotilla_revision_evidencias;
create trigger flotilla_gasolina_reclasificar_revision
after insert or update of estado on public.flotilla_revision_evidencias
for each row execute function public.reclasificar_gasolina_al_revisar();

create or replace function public.reclasificar_gasolina_al_cambiar_fotos()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.tipo_movimiento = 'GASOLINA' then
    perform public.clasificar_gasolina_por_evidencias(new.id);
  end if;
  return new;
end;
$$;

drop trigger if exists flotilla_gasolina_reclasificar_fotos on public.flotilla_movimientos_dinero;
create trigger flotilla_gasolina_reclasificar_fotos
after insert or update of evidencia_path, evidencia_ticket_path,
  evidencia_tablero_antes_path, evidencia_tablero_despues_path
on public.flotilla_movimientos_dinero
for each row execute function public.reclasificar_gasolina_al_cambiar_fotos();

create or replace function public.preparar_prestamo_flotilla()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_organization_id uuid;
begin
  if new.automatico and new.movimiento_gasolina_id is not null then
    new.saldo := coalesce(new.saldo, new.monto_original);
    new.created_by := coalesce(new.created_by, (select auth.uid()));
    new.updated_at := now();
    return new;
  end if;

  select organization_id into v_organization_id
  from public.usuarios
  where auth_user_id = (select auth.uid()) and active
  limit 1;

  if v_organization_id is null
    or not public.flotilla_es_admin_de_organizacion(v_organization_id) then
    raise exception 'Solo Administración de Flotilla puede registrar préstamos';
  end if;

  new.organization_id := v_organization_id;
  new.automatico := false;
  new.saldo := case when TG_OP = 'INSERT' then new.monto_original else new.saldo end;
  new.created_by := coalesce(new.created_by, (select auth.uid()));
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists flotilla_prestamo_preparar on public.flotilla_prestamos;
create trigger flotilla_prestamo_preparar
before insert or update on public.flotilla_prestamos
for each row execute function public.preparar_prestamo_flotilla();

create or replace function public.aplicar_abono_prestamo_flotilla()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_prestamo public.flotilla_prestamos%rowtype;
begin
  select * into v_prestamo
  from public.flotilla_prestamos
  where id = new.prestamo_id
  for update;

  if v_prestamo.id is null then raise exception 'Préstamo no encontrado'; end if;
  if not public.flotilla_es_admin_de_organizacion(v_prestamo.organization_id) then
    raise exception 'Solo Administración de Flotilla puede registrar abonos';
  end if;
  if v_prestamo.estado <> 'PENDIENTE' then raise exception 'El préstamo ya no acepta abonos'; end if;
  if new.monto > v_prestamo.saldo then raise exception 'El abono no puede superar el saldo'; end if;

  new.organization_id := v_prestamo.organization_id;
  new.created_by := (select auth.uid());

  update public.flotilla_prestamos
  set saldo = saldo - new.monto,
      estado = case when saldo - new.monto = 0 then 'PAGADO' else 'PENDIENTE' end,
      updated_at = now()
  where id = v_prestamo.id;

  return new;
end;
$$;

drop trigger if exists flotilla_prestamo_abono_aplicar on public.flotilla_prestamo_abonos;
create trigger flotilla_prestamo_abono_aplicar
before insert on public.flotilla_prestamo_abonos
for each row execute function public.aplicar_abono_prestamo_flotilla();

alter table public.flotilla_prestamos enable row level security;
alter table public.flotilla_prestamo_abonos enable row level security;
revoke all on public.flotilla_prestamos, public.flotilla_prestamo_abonos from anon;
grant select, insert, update on public.flotilla_prestamos to authenticated;
grant select, insert on public.flotilla_prestamo_abonos to authenticated;

create policy flotilla_prestamos_select_alcance on public.flotilla_prestamos
for select to authenticated using (
  public.flotilla_es_admin_de_organizacion(organization_id)
  or beneficiario_auth_user_id = (select auth.uid())
);

create policy flotilla_prestamos_insert_admin on public.flotilla_prestamos
for insert to authenticated with check (public.flotilla_es_admin_de_organizacion(organization_id));

create policy flotilla_prestamos_update_admin on public.flotilla_prestamos
for update to authenticated
using (public.flotilla_es_admin_de_organizacion(organization_id))
with check (public.flotilla_es_admin_de_organizacion(organization_id));

create policy flotilla_prestamo_abonos_select_alcance on public.flotilla_prestamo_abonos
for select to authenticated using (
  public.flotilla_es_admin_de_organizacion(organization_id)
  or exists (
    select 1 from public.flotilla_prestamos prestamo
    where prestamo.id = prestamo_id
      and prestamo.beneficiario_auth_user_id = (select auth.uid())
  )
);

create policy flotilla_prestamo_abonos_insert_admin on public.flotilla_prestamo_abonos
for insert to authenticated with check (public.flotilla_es_admin_de_organizacion(organization_id));

do $$
begin
  begin alter publication supabase_realtime add table public.flotilla_prestamos;
  exception when duplicate_object then null; end;
  begin alter publication supabase_realtime add table public.flotilla_prestamo_abonos;
  exception when duplicate_object then null; end;
end $$;

update public.flotilla_movimientos_dinero
set clasificacion_gasolina = 'PRESTAMO_PERSONAL'
where tipo_movimiento = 'GASOLINA'
  and clasificacion_gasolina is null;

commit;
