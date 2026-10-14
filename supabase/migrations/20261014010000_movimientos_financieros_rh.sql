begin;

create table if not exists public.rh_movimientos_financieros (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  business_id uuid not null references public.businesses(id) on delete cascade,
  branch_id uuid not null references public.branches(id) on delete cascade,
  empleado_id uuid not null references public.empleados(id) on delete restrict,
  tipo text not null check (tipo in ('NOMINA', 'COMISION', 'ANTICIPO', 'PRESTAMO')),
  monto numeric(14,2) not null check (monto > 0),
  concepto text not null check (length(trim(concepto)) > 0),
  periodo_desde date,
  periodo_hasta date,
  origen text not null default 'MANUAL' check (origen in ('MANUAL', 'SICAR')),
  fuente_id uuid,
  snapshot jsonb not null default '{}'::jsonb,
  estado text not null default 'PENDIENTE' check (estado in ('PENDIENTE', 'PAGADO', 'ANULADO')),
  referencia_pago text,
  pagado_por uuid references auth.users(id) on delete set null,
  pagado_en timestamptz,
  motivo_anulacion text,
  anulado_por uuid references auth.users(id) on delete set null,
  anulado_en timestamptz,
  creado_por uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((periodo_desde is null and periodo_hasta is null) or (periodo_desde is not null and periodo_hasta is not null and periodo_desde <= periodo_hasta)),
  check (tipo <> 'COMISION' or (origen = 'SICAR' and fuente_id is not null and periodo_desde is not null))
);

create unique index if not exists rh_comision_activa_unica_idx
  on public.rh_movimientos_financieros (empleado_id, periodo_desde, periodo_hasta, fuente_id)
  where tipo = 'COMISION' and estado <> 'ANULADO';

create unique index if not exists rh_nomina_activa_unica_idx
  on public.rh_movimientos_financieros (empleado_id, periodo_desde, periodo_hasta)
  where tipo = 'NOMINA' and estado <> 'ANULADO';

create index if not exists rh_movimientos_branch_fecha_idx
  on public.rh_movimientos_financieros (branch_id, created_at desc);

create table if not exists public.rh_recuperaciones_movimiento (
  id uuid primary key default gen_random_uuid(),
  movimiento_id uuid not null references public.rh_movimientos_financieros(id) on delete restrict,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  business_id uuid not null references public.businesses(id) on delete cascade,
  branch_id uuid not null references public.branches(id) on delete cascade,
  monto numeric(14,2) not null check (monto > 0),
  fecha date not null,
  metodo text not null check (metodo in ('DESCUENTO_NOMINA', 'DEPOSITO', 'EFECTIVO', 'OTRO')),
  nota text not null check (length(trim(nota)) > 0),
  estado text not null default 'VIGENTE' check (estado in ('VIGENTE', 'ANULADA')),
  registrado_por uuid references auth.users(id) on delete set null,
  motivo_anulacion text,
  anulada_por uuid references auth.users(id) on delete set null,
  anulada_en timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists rh_recuperaciones_movimiento_idx
  on public.rh_recuperaciones_movimiento (movimiento_id, created_at desc);

alter table public.rh_movimientos_financieros enable row level security;
alter table public.rh_recuperaciones_movimiento enable row level security;
revoke all on public.rh_movimientos_financieros from anon;
revoke all on public.rh_recuperaciones_movimiento from anon;
revoke insert, update, delete on public.rh_movimientos_financieros from authenticated;
revoke insert, update, delete on public.rh_recuperaciones_movimiento from authenticated;
grant select on public.rh_movimientos_financieros to authenticated;
grant select on public.rh_recuperaciones_movimiento to authenticated;

drop policy if exists rh_movimientos_owner_select on public.rh_movimientos_financieros;
create policy rh_movimientos_owner_select on public.rh_movimientos_financieros
for select to authenticated using (exists (
  select 1 from public.usuarios u where u.auth_user_id = (select auth.uid()) and u.active = true and u.role = 'owner'
    and u.organization_id = rh_movimientos_financieros.organization_id
    and u.business_id = rh_movimientos_financieros.business_id
    and u.branch_id = rh_movimientos_financieros.branch_id
));

drop policy if exists rh_recuperaciones_owner_select on public.rh_recuperaciones_movimiento;
create policy rh_recuperaciones_owner_select on public.rh_recuperaciones_movimiento
for select to authenticated using (exists (
  select 1 from public.usuarios u where u.auth_user_id = (select auth.uid()) and u.active = true and u.role = 'owner'
    and u.organization_id = rh_recuperaciones_movimiento.organization_id
    and u.business_id = rh_recuperaciones_movimiento.business_id
    and u.branch_id = rh_recuperaciones_movimiento.branch_id
));

create or replace function public.registrar_movimiento_financiero_rh(
  p_empleado_id uuid, p_tipo text, p_monto numeric, p_concepto text,
  p_periodo_desde date, p_periodo_hasta date, p_origen text, p_fuente_id uuid, p_snapshot jsonb
) returns uuid language plpgsql security definer set search_path = public, pg_temp as $$
declare v_empleado public.empleados%rowtype; v_id uuid;
begin
  if p_tipo not in ('NOMINA', 'ANTICIPO', 'PRESTAMO') then raise exception 'Tipo de movimiento manual no válido'; end if;
  if coalesce(p_monto, 0) <= 0 then raise exception 'El monto debe ser mayor que cero'; end if;
  if length(trim(coalesce(p_concepto, ''))) = 0 then raise exception 'El concepto es obligatorio'; end if;
  if p_tipo = 'NOMINA' and (p_periodo_desde is null or p_periodo_hasta is null or p_periodo_desde > p_periodo_hasta) then raise exception 'La nómina requiere un periodo válido'; end if;
  select * into v_empleado from public.empleados where id = p_empleado_id;
  if not found then raise exception 'No se encontró a la empleada'; end if;
  if not exists (select 1 from public.usuarios u where u.auth_user_id = auth.uid() and u.active = true and u.role = 'owner'
    and u.organization_id = v_empleado.organization_id and u.business_id = v_empleado.business_id and u.branch_id = v_empleado.branch_id)
  then raise exception 'No tienes permiso para registrar movimientos de esta empleada'; end if;
  insert into public.rh_movimientos_financieros (
    organization_id,business_id,branch_id,empleado_id,tipo,monto,concepto,periodo_desde,periodo_hasta,origen,fuente_id,snapshot,creado_por
  ) values (
    v_empleado.organization_id,v_empleado.business_id,v_empleado.branch_id,v_empleado.id,p_tipo,round(p_monto,2),trim(p_concepto),
    case when p_tipo='NOMINA' then p_periodo_desde else null end, case when p_tipo='NOMINA' then p_periodo_hasta else null end,
    'MANUAL',null,coalesce(p_snapshot,'{}'::jsonb),auth.uid()
  ) returning id into v_id;
  return v_id;
exception when unique_violation then raise exception 'Ya existe un registro activo para esa empleada y periodo';
end;
$$;

create or replace function public.registrar_liquidaciones_comision_rh(
  p_periodo_desde date, p_periodo_hasta date, p_fuente_id uuid, p_partidas jsonb
) returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare v_partida jsonb; v_empleado public.empleados%rowtype; v_ids uuid[] := '{}'; v_id uuid; v_monto numeric;
begin
  if p_periodo_desde is null or p_periodo_hasta is null or p_periodo_desde > p_periodo_hasta then raise exception 'El periodo de comisión no es válido'; end if;
  if p_fuente_id is null then raise exception 'La importación SICAR es obligatoria'; end if;
  if jsonb_typeof(p_partidas) <> 'array' or jsonb_array_length(p_partidas) = 0 then raise exception 'No hay comisiones válidas para registrar'; end if;
  for v_partida in select value from jsonb_array_elements(p_partidas) loop
    v_monto := (v_partida->>'monto')::numeric;
    if coalesce(v_monto,0) <= 0 then raise exception 'Cada comisión debe ser mayor que cero'; end if;
    select * into v_empleado from public.empleados where id = (v_partida->>'empleado_id')::uuid;
    if not found then raise exception 'No se encontró una empleada de la liquidación'; end if;
    if not exists (select 1 from public.usuarios u where u.auth_user_id = auth.uid() and u.active=true and u.role='owner'
      and u.organization_id=v_empleado.organization_id and u.business_id=v_empleado.business_id and u.branch_id=v_empleado.branch_id)
    then raise exception 'No tienes permiso para liquidar comisiones de esta sucursal'; end if;
    if not exists (select 1 from public.importaciones i where i.id=p_fuente_id and i.branch_id=v_empleado.branch_id and i.tipo_reporte='Utilidad de ventas')
    then raise exception 'La importación SICAR no pertenece a la sucursal'; end if;
    if exists (select 1 from public.rh_movimientos_financieros m where m.empleado_id=v_empleado.id and m.tipo='COMISION'
      and m.periodo_desde=p_periodo_desde and m.periodo_hasta=p_periodo_hasta and m.fuente_id=p_fuente_id and m.estado<>'ANULADO')
    then raise exception 'Ya existe una liquidación activa para %', v_empleado.nombre; end if;
    insert into public.rh_movimientos_financieros (
      organization_id,business_id,branch_id,empleado_id,tipo,monto,concepto,periodo_desde,periodo_hasta,origen,fuente_id,snapshot,creado_por
    ) values (
      v_empleado.organization_id,v_empleado.business_id,v_empleado.branch_id,v_empleado.id,'COMISION',round(v_monto,2),
      'Comisión SICAR pendiente de confirmar',p_periodo_desde,p_periodo_hasta,'SICAR',p_fuente_id,coalesce(v_partida->'snapshot','{}'::jsonb),auth.uid()
    ) returning id into v_id;
    v_ids := array_append(v_ids,v_id);
  end loop;
  return to_jsonb(v_ids);
end;
$$;

create or replace function public.marcar_movimiento_financiero_rh_pagado(p_movimiento_id uuid, p_referencia text)
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare v_mov public.rh_movimientos_financieros%rowtype;
begin
  if length(trim(coalesce(p_referencia,'')))=0 then raise exception 'La referencia de pago es obligatoria'; end if;
  select * into v_mov from public.rh_movimientos_financieros where id=p_movimiento_id for update;
  if not found then raise exception 'No se encontró el movimiento'; end if;
  if not exists (select 1 from public.usuarios u where u.auth_user_id=auth.uid() and u.active=true and u.role='owner'
    and u.organization_id=v_mov.organization_id and u.business_id=v_mov.business_id and u.branch_id=v_mov.branch_id)
  then raise exception 'No tienes permiso para confirmar este pago'; end if;
  if v_mov.estado <> 'PENDIENTE' then raise exception 'Solo un movimiento pendiente puede marcarse como pagado'; end if;
  update public.rh_movimientos_financieros set estado='PAGADO',referencia_pago=trim(p_referencia),pagado_por=auth.uid(),pagado_en=now(),updated_at=now()
  where id=p_movimiento_id returning * into v_mov;
  return to_jsonb(v_mov);
end;
$$;

create or replace function public.anular_movimiento_financiero_rh(p_movimiento_id uuid, p_motivo text)
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare v_mov public.rh_movimientos_financieros%rowtype;
begin
  if length(trim(coalesce(p_motivo,'')))=0 then raise exception 'El motivo de anulación es obligatorio'; end if;
  select * into v_mov from public.rh_movimientos_financieros where id=p_movimiento_id for update;
  if not found then raise exception 'No se encontró el movimiento'; end if;
  if not exists (select 1 from public.usuarios u where u.auth_user_id=auth.uid() and u.active=true and u.role='owner'
    and u.organization_id=v_mov.organization_id and u.business_id=v_mov.business_id and u.branch_id=v_mov.branch_id)
  then raise exception 'No tienes permiso para anular este registro'; end if;
  if v_mov.estado='ANULADO' then raise exception 'El registro ya está anulado'; end if;
  update public.rh_movimientos_financieros set estado='ANULADO',motivo_anulacion=trim(p_motivo),anulado_por=auth.uid(),anulado_en=now(),updated_at=now()
  where id=p_movimiento_id returning * into v_mov;
  return to_jsonb(v_mov);
end;
$$;

create or replace function public.registrar_recuperacion_movimiento_rh(p_movimiento_id uuid, p_monto numeric, p_metodo text, p_nota text)
returns uuid language plpgsql security definer set search_path = public, pg_temp as $$
declare v_mov public.rh_movimientos_financieros%rowtype; v_recuperado numeric; v_id uuid;
begin
  if coalesce(p_monto,0)<=0 then raise exception 'El monto recuperado debe ser mayor que cero'; end if;
  if p_metodo not in ('DESCUENTO_NOMINA','DEPOSITO','EFECTIVO','OTRO') then raise exception 'Método de recuperación no válido'; end if;
  if length(trim(coalesce(p_nota,'')))=0 then raise exception 'La nota o referencia es obligatoria'; end if;
  select * into v_mov from public.rh_movimientos_financieros where id=p_movimiento_id for update;
  if not found then raise exception 'No se encontró el anticipo o préstamo'; end if;
  if v_mov.tipo not in ('ANTICIPO','PRESTAMO') or v_mov.estado<>'PAGADO' then raise exception 'Solo se recuperan anticipos o préstamos pagados'; end if;
  if not exists (select 1 from public.usuarios u where u.auth_user_id=auth.uid() and u.active=true and u.role='owner'
    and u.organization_id=v_mov.organization_id and u.business_id=v_mov.business_id and u.branch_id=v_mov.branch_id)
  then raise exception 'No tienes permiso para registrar esta recuperación'; end if;
  select coalesce(sum(monto),0) into v_recuperado from public.rh_recuperaciones_movimiento where movimiento_id=p_movimiento_id and estado='VIGENTE';
  if v_recuperado+p_monto>v_mov.monto then raise exception 'La recuperación supera el saldo pendiente'; end if;
  insert into public.rh_recuperaciones_movimiento (movimiento_id,organization_id,business_id,branch_id,monto,fecha,metodo,nota,registrado_por)
  values (v_mov.id,v_mov.organization_id,v_mov.business_id,v_mov.branch_id,round(p_monto,2),timezone('America/Mexico_City',now())::date,p_metodo,trim(p_nota),auth.uid())
  returning id into v_id;
  return v_id;
end;
$$;

revoke all on function public.registrar_movimiento_financiero_rh(uuid,text,numeric,text,date,date,text,uuid,jsonb) from public;
revoke all on function public.registrar_liquidaciones_comision_rh(date,date,uuid,jsonb) from public;
revoke all on function public.marcar_movimiento_financiero_rh_pagado(uuid,text) from public;
revoke all on function public.anular_movimiento_financiero_rh(uuid,text) from public;
revoke all on function public.registrar_recuperacion_movimiento_rh(uuid,numeric,text,text) from public;
grant execute on function public.registrar_movimiento_financiero_rh(uuid,text,numeric,text,date,date,text,uuid,jsonb) to authenticated;
grant execute on function public.registrar_liquidaciones_comision_rh(date,date,uuid,jsonb) to authenticated;
grant execute on function public.marcar_movimiento_financiero_rh_pagado(uuid,text) to authenticated;
grant execute on function public.anular_movimiento_financiero_rh(uuid,text) to authenticated;
grant execute on function public.registrar_recuperacion_movimiento_rh(uuid,numeric,text,text) to authenticated;

commit;
