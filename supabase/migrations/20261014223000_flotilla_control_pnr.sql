begin;

create table if not exists public.flotilla_pnr_expedientes (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  business_id uuid references public.businesses(id) on delete set null,
  branch_id uuid references public.branches(id) on delete set null,
  ruta_id uuid not null references public.flotilla_rutas(id) on delete restrict,
  unidad_id uuid not null references public.flotilla_unidades(id) on delete restrict,
  driver_auth_user_id uuid not null references auth.users(id) on delete restrict,
  chofer_nombre text not null,
  paquete_id text not null,
  referencia_operativa text,
  fecha_reporte date not null default ((now() at time zone 'America/Mexico_City')::date),
  descripcion text,
  captura_origen_path text not null,
  estado text not null default 'EN_INVESTIGACION' check (estado in (
    'EN_INVESTIGACION', 'ESPERANDO_EVIDENCIA', 'RESPONDIDO',
    'PENALIDAD_PROPUESTA', 'PENALIDAD_CONFIRMADA', 'CONVENIO_SOLICITADO',
    'CONVENIO_ACTIVO', 'RESUELTO_SIN_COBRO', 'LIQUIDADO'
  )),
  enterado_at timestamptz,
  respuesta_chofer text,
  respuesta_at timestamptz,
  penalidad_monto numeric(12,2) check (penalidad_monto is null or penalidad_monto > 0),
  saldo numeric(12,2) not null default 0 check (saldo >= 0),
  convenio_solicitado_monto numeric(12,2) check (convenio_solicitado_monto is null or convenio_solicitado_monto > 0),
  convenio_autorizado_monto numeric(12,2) check (convenio_autorizado_monto is null or convenio_autorizado_monto > 0),
  resolucion text,
  creado_por uuid references auth.users(id) on delete set null,
  actualizado_por uuid references auth.users(id) on delete set null,
  resuelto_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, paquete_id),
  check (saldo <= coalesce(penalidad_monto, 0)),
  check (estado <> 'RESUELTO_SIN_COBRO' or nullif(btrim(resolucion), '') is not null)
);

create table if not exists public.flotilla_pnr_evidencias (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  pnr_id uuid not null references public.flotilla_pnr_expedientes(id) on delete restrict,
  archivo_path text not null,
  nota text,
  creado_por uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now()
);

create table if not exists public.flotilla_pnr_descuentos (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  pnr_id uuid not null references public.flotilla_pnr_expedientes(id) on delete restrict,
  periodo_desde date not null,
  periodo_hasta date not null,
  monto numeric(12,2) not null check (monto > 0),
  aplica_socio boolean not null default true,
  aplica_chofer boolean not null default true,
  estado text not null default 'APLICADO' check (estado in ('APLICADO', 'ANULADO')),
  observaciones text,
  creado_por uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  check (periodo_desde <= periodo_hasta),
  unique (pnr_id, periodo_desde, periodo_hasta)
);

create index if not exists flotilla_pnr_driver_estado_idx
  on public.flotilla_pnr_expedientes (driver_auth_user_id, estado, fecha_reporte desc);
create index if not exists flotilla_pnr_org_estado_idx
  on public.flotilla_pnr_expedientes (organization_id, estado, fecha_reporte desc);
create index if not exists flotilla_pnr_evidencias_pnr_idx
  on public.flotilla_pnr_evidencias (pnr_id, created_at desc);
create index if not exists flotilla_pnr_descuentos_periodo_idx
  on public.flotilla_pnr_descuentos (organization_id, periodo_desde, periodo_hasta);

create or replace function public.flotilla_puede_gestionar_pnr(p_organization_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.usuarios usuario
    where usuario.auth_user_id = (select auth.uid())
      and usuario.organization_id = p_organization_id
      and usuario.active
      and usuario.role = 'owner'
  ) or exists (
    select 1
    from public.flotilla_accesos_usuario acceso
    where acceso.auth_user_id = (select auth.uid())
      and acceso.organization_id = p_organization_id
      and acceso.tipo_acceso = 'ADMIN_FLOTILLA'
      and acceso.activo
  );
$$;

revoke all on function public.flotilla_puede_gestionar_pnr(uuid) from public;
grant execute on function public.flotilla_puede_gestionar_pnr(uuid) to authenticated;

create or replace function public.preparar_pnr_flotilla()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ruta public.flotilla_rutas%rowtype;
begin
  select * into v_ruta from public.flotilla_rutas where id = new.ruta_id;
  if v_ruta.id is null then raise exception 'Ruta no encontrada'; end if;
  if not public.flotilla_puede_gestionar_pnr(v_ruta.organization_id) then
    raise exception 'Solo Chory o Mónica pueden registrar un PNR';
  end if;
  if v_ruta.driver_auth_user_id is null then
    raise exception 'El driver de esa ruta todavía no tiene una cuenta vinculada';
  end if;

  new.organization_id := v_ruta.organization_id;
  new.business_id := v_ruta.business_id;
  new.branch_id := v_ruta.branch_id;
  new.unidad_id := v_ruta.unidad_id;
  new.driver_auth_user_id := v_ruta.driver_auth_user_id;
  new.chofer_nombre := coalesce(nullif(btrim(v_ruta.chofer_nombre), ''), 'Driver sin nombre');
  new.paquete_id := btrim(new.paquete_id);
  new.referencia_operativa := nullif(btrim(new.referencia_operativa), '');
  new.descripcion := nullif(btrim(new.descripcion), '');
  new.estado := 'EN_INVESTIGACION';
  new.enterado_at := null;
  new.respuesta_chofer := null;
  new.respuesta_at := null;
  new.penalidad_monto := null;
  new.saldo := 0;
  new.convenio_solicitado_monto := null;
  new.convenio_autorizado_monto := null;
  new.resolucion := null;
  new.resuelto_at := null;
  new.creado_por := (select auth.uid());
  new.actualizado_por := (select auth.uid());
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists flotilla_pnr_preparar on public.flotilla_pnr_expedientes;
create trigger flotilla_pnr_preparar
before insert on public.flotilla_pnr_expedientes
for each row execute function public.preparar_pnr_flotilla();

create or replace function public.responder_pnr_flotilla(p_pnr_id uuid, p_respuesta text)
returns public.flotilla_pnr_expedientes
language plpgsql
security definer
set search_path = public
as $$
declare v_pnr public.flotilla_pnr_expedientes%rowtype;
begin
  select * into v_pnr from public.flotilla_pnr_expedientes where id = p_pnr_id for update;
  if v_pnr.id is null or v_pnr.driver_auth_user_id is distinct from (select auth.uid()) then
    raise exception 'PNR no encontrado para este driver';
  end if;
  if v_pnr.estado in ('RESUELTO_SIN_COBRO', 'LIQUIDADO') then
    raise exception 'Este PNR ya está cerrado';
  end if;
  if char_length(btrim(coalesce(p_respuesta, ''))) < 5 then raise exception 'Explica qué ocurrió'; end if;

  update public.flotilla_pnr_expedientes
  set enterado_at = coalesce(enterado_at, now()), respuesta_chofer = btrim(p_respuesta),
      respuesta_at = now(), estado = case when estado in ('EN_INVESTIGACION', 'ESPERANDO_EVIDENCIA') then 'RESPONDIDO' else estado end,
      actualizado_por = (select auth.uid()), updated_at = now()
  where id = p_pnr_id returning * into v_pnr;
  return v_pnr;
end;
$$;

create or replace function public.solicitar_convenio_pnr_flotilla(p_pnr_id uuid, p_monto_semanal numeric)
returns public.flotilla_pnr_expedientes
language plpgsql
security definer
set search_path = public
as $$
declare v_pnr public.flotilla_pnr_expedientes%rowtype;
begin
  select * into v_pnr from public.flotilla_pnr_expedientes where id = p_pnr_id for update;
  if v_pnr.id is null or v_pnr.driver_auth_user_id is distinct from (select auth.uid()) then
    raise exception 'PNR no encontrado para este driver';
  end if;
  if v_pnr.estado <> 'PENALIDAD_CONFIRMADA' then raise exception 'La penalidad todavía no permite convenio'; end if;
  if p_monto_semanal <= 0 or p_monto_semanal > v_pnr.saldo then raise exception 'Monto semanal no válido'; end if;
  update public.flotilla_pnr_expedientes
  set convenio_solicitado_monto = p_monto_semanal, estado = 'CONVENIO_SOLICITADO',
      actualizado_por = (select auth.uid()), updated_at = now()
  where id = p_pnr_id returning * into v_pnr;
  return v_pnr;
end;
$$;

create or replace function public.gestionar_pnr_flotilla(
  p_pnr_id uuid,
  p_accion text,
  p_resolucion text default null,
  p_monto numeric default null
)
returns public.flotilla_pnr_expedientes
language plpgsql
security definer
set search_path = public
as $$
declare
  v_pnr public.flotilla_pnr_expedientes%rowtype;
  v_es_propietaria boolean;
  v_descuentos integer;
begin
  select * into v_pnr from public.flotilla_pnr_expedientes where id = p_pnr_id for update;
  if v_pnr.id is null or not public.flotilla_puede_gestionar_pnr(v_pnr.organization_id) then
    raise exception 'Solo Chory o Mónica pueden gestionar este PNR';
  end if;
  select exists(
    select 1
    from public.usuarios
    where auth_user_id = (select auth.uid())
      and organization_id = v_pnr.organization_id
      and active
      and role = 'owner'
  ) into v_es_propietaria;

  if p_accion = 'PEDIR_EVIDENCIA' then
    if v_pnr.estado not in ('EN_INVESTIGACION','ESPERANDO_EVIDENCIA','RESPONDIDO') then
      raise exception 'Este PNR ya está en proceso de penalidad o cerrado';
    end if;
    update public.flotilla_pnr_expedientes set estado='ESPERANDO_EVIDENCIA', actualizado_por=(select auth.uid()), updated_at=now() where id=p_pnr_id;
  elsif p_accion = 'RESOLVER_SIN_COBRO' then
    select count(*) into v_descuentos from public.flotilla_pnr_descuentos where pnr_id=p_pnr_id and estado='APLICADO';
    if v_descuentos > 0 then raise exception 'No se puede cerrar sin cobro porque ya tiene descuentos aplicados'; end if;
    if char_length(btrim(coalesce(p_resolucion,''))) < 5 then raise exception 'Escribe cómo se resolvió'; end if;
    update public.flotilla_pnr_expedientes set estado='RESUELTO_SIN_COBRO', penalidad_monto=null, saldo=0,
      resolucion=btrim(p_resolucion), resuelto_at=now(), actualizado_por=(select auth.uid()), updated_at=now() where id=p_pnr_id;
  elsif p_accion = 'PROPONER_PENALIDAD' then
    if v_pnr.estado in ('PENALIDAD_CONFIRMADA','CONVENIO_SOLICITADO','CONVENIO_ACTIVO','RESUELTO_SIN_COBRO','LIQUIDADO') then
      raise exception 'Este PNR ya no permite proponer otra penalidad';
    end if;
    if p_monto is null or p_monto <= 0 then raise exception 'Escribe el importe de la penalidad'; end if;
    update public.flotilla_pnr_expedientes set estado='PENALIDAD_PROPUESTA', penalidad_monto=p_monto,
      resolucion=nullif(btrim(p_resolucion),''), actualizado_por=(select auth.uid()), updated_at=now() where id=p_pnr_id;
  elsif p_accion = 'CONFIRMAR_PENALIDAD' then
    if not v_es_propietaria then raise exception 'Mónica debe autorizar la penalidad'; end if;
    if v_pnr.estado <> 'PENALIDAD_PROPUESTA' then raise exception 'Primero Chory debe proponer la penalidad'; end if;
    if coalesce(p_monto, v_pnr.penalidad_monto) <= 0 then raise exception 'Escribe el importe de la penalidad'; end if;
    update public.flotilla_pnr_expedientes set estado='PENALIDAD_CONFIRMADA',
      penalidad_monto=coalesce(p_monto, penalidad_monto), saldo=coalesce(p_monto, penalidad_monto),
      resolucion=nullif(btrim(p_resolucion),''), actualizado_por=(select auth.uid()), updated_at=now() where id=p_pnr_id;
  elsif p_accion = 'AUTORIZAR_CONVENIO' then
    if not v_es_propietaria then raise exception 'Mónica debe autorizar el convenio'; end if;
    if v_pnr.estado <> 'CONVENIO_SOLICITADO' then raise exception 'El driver todavía no ha solicitado este convenio'; end if;
    if coalesce(p_monto, v_pnr.convenio_solicitado_monto) <= 0 then raise exception 'Escribe el descuento semanal autorizado'; end if;
    update public.flotilla_pnr_expedientes set estado='CONVENIO_ACTIVO',
      convenio_autorizado_monto=coalesce(p_monto, convenio_solicitado_monto), actualizado_por=(select auth.uid()), updated_at=now() where id=p_pnr_id;
  else
    raise exception 'Acción de PNR no válida';
  end if;
  select * into v_pnr from public.flotilla_pnr_expedientes where id=p_pnr_id;
  return v_pnr;
end;
$$;

create or replace function public.aplicar_descuento_pnr_flotilla(
  p_pnr_id uuid, p_periodo_desde date, p_periodo_hasta date, p_monto numeric, p_observaciones text default null
)
returns public.flotilla_pnr_descuentos
language plpgsql
security definer
set search_path = public
as $$
declare
  v_pnr public.flotilla_pnr_expedientes%rowtype;
  v_descuento public.flotilla_pnr_descuentos%rowtype;
begin
  select * into v_pnr from public.flotilla_pnr_expedientes where id=p_pnr_id for update;
  if v_pnr.id is null or not public.flotilla_puede_gestionar_pnr(v_pnr.organization_id) then raise exception 'PNR no autorizado'; end if;
  if v_pnr.estado not in ('PENALIDAD_CONFIRMADA','CONVENIO_SOLICITADO','CONVENIO_ACTIVO') then raise exception 'La penalidad no está confirmada'; end if;
  if p_periodo_desde is null or p_periodo_hasta is null or p_periodo_desde > p_periodo_hasta then raise exception 'Corte semanal no válido'; end if;
  if p_monto <= 0 or p_monto > v_pnr.saldo then raise exception 'El descuento supera el saldo pendiente'; end if;

  insert into public.flotilla_pnr_descuentos (organization_id,pnr_id,periodo_desde,periodo_hasta,monto,aplica_socio,aplica_chofer,estado,observaciones,creado_por)
  values (v_pnr.organization_id,p_pnr_id,p_periodo_desde,p_periodo_hasta,p_monto,true,true,'APLICADO',nullif(btrim(p_observaciones),''),(select auth.uid()))
  returning * into v_descuento;

  update public.flotilla_pnr_expedientes
  set saldo=saldo-p_monto, estado=case when saldo-p_monto=0 then 'LIQUIDADO' else estado end,
      resuelto_at=case when saldo-p_monto=0 then now() else resuelto_at end,
      actualizado_por=(select auth.uid()), updated_at=now()
  where id=p_pnr_id;
  return v_descuento;
end;
$$;

create or replace function public.preparar_evidencia_pnr_flotilla()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare v_pnr public.flotilla_pnr_expedientes%rowtype;
begin
  select * into v_pnr from public.flotilla_pnr_expedientes where id=new.pnr_id;
  if v_pnr.id is null or (v_pnr.driver_auth_user_id is distinct from (select auth.uid()) and not public.flotilla_puede_gestionar_pnr(v_pnr.organization_id)) then
    raise exception 'No puedes agregar evidencia a este PNR';
  end if;
  new.organization_id := v_pnr.organization_id;
  new.creado_por := (select auth.uid());
  return new;
end;
$$;

drop trigger if exists flotilla_pnr_evidencia_preparar on public.flotilla_pnr_evidencias;
create trigger flotilla_pnr_evidencia_preparar before insert on public.flotilla_pnr_evidencias
for each row execute function public.preparar_evidencia_pnr_flotilla();

alter table public.flotilla_pnr_expedientes enable row level security;
alter table public.flotilla_pnr_evidencias enable row level security;
alter table public.flotilla_pnr_descuentos enable row level security;
revoke all on public.flotilla_pnr_expedientes, public.flotilla_pnr_evidencias, public.flotilla_pnr_descuentos from anon;
grant select, insert on public.flotilla_pnr_expedientes to authenticated;
grant select, insert on public.flotilla_pnr_evidencias to authenticated;
grant select on public.flotilla_pnr_descuentos to authenticated;

drop policy if exists flotilla_pnr_select on public.flotilla_pnr_expedientes;
create policy flotilla_pnr_select on public.flotilla_pnr_expedientes for select to authenticated using (
  driver_auth_user_id=(select auth.uid()) or public.flotilla_puede_gestionar_pnr(organization_id)
);
drop policy if exists flotilla_pnr_insert_admin on public.flotilla_pnr_expedientes;
create policy flotilla_pnr_insert_admin on public.flotilla_pnr_expedientes for insert to authenticated with check (
  public.flotilla_puede_gestionar_pnr(organization_id)
);
drop policy if exists flotilla_pnr_evidencias_select on public.flotilla_pnr_evidencias;
create policy flotilla_pnr_evidencias_select on public.flotilla_pnr_evidencias for select to authenticated using (
  exists(select 1 from public.flotilla_pnr_expedientes p where p.id=pnr_id and (p.driver_auth_user_id=(select auth.uid()) or public.flotilla_puede_gestionar_pnr(p.organization_id)))
);
drop policy if exists flotilla_pnr_evidencias_insert on public.flotilla_pnr_evidencias;
create policy flotilla_pnr_evidencias_insert on public.flotilla_pnr_evidencias for insert to authenticated with check (
  exists(select 1 from public.flotilla_pnr_expedientes p where p.id=pnr_id and (p.driver_auth_user_id=(select auth.uid()) or public.flotilla_puede_gestionar_pnr(p.organization_id)))
);
drop policy if exists flotilla_pnr_descuentos_select on public.flotilla_pnr_descuentos;
create policy flotilla_pnr_descuentos_select on public.flotilla_pnr_descuentos for select to authenticated using (
  exists(select 1 from public.flotilla_pnr_expedientes p where p.id=pnr_id and (p.driver_auth_user_id=(select auth.uid()) or public.flotilla_puede_gestionar_pnr(p.organization_id)))
);

revoke all on function public.responder_pnr_flotilla(uuid,text) from public;
revoke all on function public.solicitar_convenio_pnr_flotilla(uuid,numeric) from public;
revoke all on function public.gestionar_pnr_flotilla(uuid,text,text,numeric) from public;
revoke all on function public.aplicar_descuento_pnr_flotilla(uuid,date,date,numeric,text) from public;
grant execute on function public.responder_pnr_flotilla(uuid,text) to authenticated;
grant execute on function public.solicitar_convenio_pnr_flotilla(uuid,numeric) to authenticated;
grant execute on function public.gestionar_pnr_flotilla(uuid,text,text,numeric) to authenticated;
grant execute on function public.aplicar_descuento_pnr_flotilla(uuid,date,date,numeric,text) to authenticated;

drop policy if exists flotilla_pnr_archivos_select on storage.objects;
create policy flotilla_pnr_archivos_select on storage.objects for select to authenticated using (
  bucket_id='flotilla-evidencias' and (
    exists(select 1 from public.flotilla_pnr_expedientes p where p.captura_origen_path=name and (p.driver_auth_user_id=(select auth.uid()) or public.flotilla_puede_gestionar_pnr(p.organization_id)))
    or exists(select 1 from public.flotilla_pnr_evidencias e join public.flotilla_pnr_expedientes p on p.id=e.pnr_id where e.archivo_path=name and (p.driver_auth_user_id=(select auth.uid()) or public.flotilla_puede_gestionar_pnr(p.organization_id)))
  )
);

do $$
begin
  begin alter publication supabase_realtime add table public.flotilla_pnr_expedientes; exception when duplicate_object then null; end;
  begin alter publication supabase_realtime add table public.flotilla_pnr_evidencias; exception when duplicate_object then null; end;
  begin alter publication supabase_realtime add table public.flotilla_pnr_descuentos; exception when duplicate_object then null; end;
end $$;

comment on table public.flotilla_pnr_expedientes is 'PNR visibles al driver desde investigación hasta resolución, penalidad y liquidación.';
comment on table public.flotilla_pnr_descuentos is 'Un solo descuento semanal compartido por la prefactura del socio y el pago del driver.';

commit;
