begin;

-- Keep flotilla access tied to an active MONYS user in the same organization.
create or replace function public.flotilla_puede_gestionar_pnr(p_organization_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
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
    join public.usuarios usuario
      on usuario.auth_user_id = acceso.auth_user_id
     and usuario.organization_id = acceso.organization_id
    where acceso.auth_user_id = (select auth.uid())
      and acceso.organization_id = p_organization_id
      and acceso.tipo_acceso = 'ADMIN_FLOTILLA'
      and acceso.activo
      and usuario.active
  );
$$;

revoke all on function public.flotilla_puede_gestionar_pnr(uuid) from public, anon;
grant execute on function public.flotilla_puede_gestionar_pnr(uuid) to authenticated;

-- A disabled MONYS account must not retain broad fleet or partner visibility.
create or replace function public.flotilla_es_admin_de_organizacion(p_organization_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.usuarios usuario
    where usuario.auth_user_id = (select auth.uid())
      and usuario.active
      and usuario.organization_id = p_organization_id
      and usuario.role in ('owner', 'admin', 'director')
  ) or exists (
    select 1
    from public.flotilla_accesos_usuario acceso
    join public.usuarios usuario
      on usuario.auth_user_id = acceso.auth_user_id
     and usuario.organization_id = acceso.organization_id
    where acceso.auth_user_id = (select auth.uid())
      and acceso.organization_id = p_organization_id
      and acceso.tipo_acceso = 'ADMIN_FLOTILLA'
      and acceso.activo
      and usuario.active
  );
$$;

revoke all on function public.flotilla_es_admin_de_organizacion(uuid) from public, anon;
grant execute on function public.flotilla_es_admin_de_organizacion(uuid) to authenticated;

create or replace function public.flotilla_puede_ver_unidad(p_unidad_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.flotilla_unidades unidad
    join public.usuarios usuario
      on usuario.auth_user_id = (select auth.uid())
     and usuario.organization_id = unidad.organization_id
     and usuario.active
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

revoke all on function public.flotilla_puede_ver_unidad(uuid) from public, anon;
grant execute on function public.flotilla_puede_ver_unidad(uuid) to authenticated;

-- Do not allow deductions before the owner approves a requested agreement.
-- Once approved, cap each weekly deduction at the authorized installment.
create or replace function public.aplicar_descuento_pnr_flotilla(
  p_pnr_id uuid,
  p_periodo_desde date,
  p_periodo_hasta date,
  p_monto numeric,
  p_observaciones text default null
)
returns public.flotilla_pnr_descuentos
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_pnr public.flotilla_pnr_expedientes%rowtype;
  v_descuento public.flotilla_pnr_descuentos%rowtype;
begin
  select * into v_pnr
  from public.flotilla_pnr_expedientes
  where id = p_pnr_id
  for update;

  if v_pnr.id is null
     or not public.flotilla_puede_gestionar_pnr(v_pnr.organization_id) then
    raise exception 'PNR no autorizado';
  end if;

  if v_pnr.estado = 'CONVENIO_SOLICITADO' then
    raise exception 'Mónica debe autorizar el convenio antes de aplicar abonos';
  end if;

  if v_pnr.estado not in ('PENALIDAD_CONFIRMADA', 'CONVENIO_ACTIVO') then
    raise exception 'La penalidad no está confirmada';
  end if;

  if p_periodo_desde is null or p_periodo_hasta is null or p_periodo_desde > p_periodo_hasta then
    raise exception 'Corte semanal no válido';
  end if;

  if p_monto is null or p_monto <= 0 or p_monto > v_pnr.saldo then
    raise exception 'El descuento supera el saldo pendiente';
  end if;

  if v_pnr.estado = 'CONVENIO_ACTIVO'
     and (v_pnr.convenio_autorizado_monto is null
       or p_monto > v_pnr.convenio_autorizado_monto) then
    raise exception 'El abono supera el monto semanal autorizado por Mónica';
  end if;

  insert into public.flotilla_pnr_descuentos (
    organization_id, pnr_id, periodo_desde, periodo_hasta, monto,
    aplica_socio, aplica_chofer, estado, observaciones, creado_por
  ) values (
    v_pnr.organization_id, p_pnr_id, p_periodo_desde, p_periodo_hasta, p_monto,
    true, true, 'APLICADO', nullif(btrim(p_observaciones), ''), (select auth.uid())
  ) returning * into v_descuento;

  update public.flotilla_pnr_expedientes
  set saldo = saldo - p_monto,
      estado = case when saldo - p_monto = 0 then 'LIQUIDADO' else estado end,
      resuelto_at = case when saldo - p_monto = 0 then now() else resuelto_at end,
      actualizado_por = (select auth.uid()),
      updated_at = now()
  where id = p_pnr_id;

  return v_descuento;
end;
$$;

revoke all on function public.aplicar_descuento_pnr_flotilla(uuid, date, date, numeric, text) from public, anon;
grant execute on function public.aplicar_descuento_pnr_flotilla(uuid, date, date, numeric, text) to authenticated;

commit;
