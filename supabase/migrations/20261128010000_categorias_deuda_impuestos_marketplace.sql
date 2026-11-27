-- Categorías de Tesorería para separar capital e intereses de deuda,
-- tipos de impuesto y operaciones de marketplace (Mercado Libre).
-- Autorizado por la propietaria para PREPARAR; aplicar solo después de
-- revisión. Aditivo: no modifica ni reclasifica movimientos existentes.
--
-- Categorías que NO son gasto operativo (permiten expense_behavior
-- 'no_aplica'):
--   anteriores: anticipo_prestamo, retiro_propietaria, traspaso_caja,
--               ajuste_cancelacion, registro_prueba, ingreso_caja_sicar
--   nuevas:     pago_capital_deuda      (abono a capital: reduce deuda, no es gasto)
--               impuesto_iva            (IVA trasladado/acreditable: no es gasto)
--               impuesto_isr            (impuesto a la utilidad: no es gasto operativo)
--               liquidacion_marketplace (depósito que liquida ventas ya registradas)
--               retencion_marketplace   (ISR/IVA retenidos por la plataforma)
--               devolucion_marketplace  (reembolso a cliente: reduce venta, no es gasto)
-- Categorías nuevas que SÍ son gasto (fijo o variable):
--   intereses_deuda (gasto financiero), cuotas_imss_infonavit (nómina),
--   comisiones_marketplace (comisión y envío cobrados por la plataforma).
--
-- La lista vive en una sola función para que las validaciones no se
-- vuelvan a desincronizar.

begin;

create or replace function public.categoria_tesoreria_sin_impacto(p_categoria text)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select lower(trim(coalesce(p_categoria, ''))) in (
    'anticipo_prestamo', 'retiro_propietaria', 'traspaso_caja',
    'ajuste_cancelacion', 'registro_prueba', 'ingreso_caja_sicar',
    'pago_capital_deuda', 'impuesto_iva', 'impuesto_isr',
    'liquidacion_marketplace', 'retencion_marketplace', 'devolucion_marketplace'
  );
$$;

revoke all on function public.categoria_tesoreria_sin_impacto(text) from public, anon;
grant execute on function public.categoria_tesoreria_sin_impacto(text) to authenticated;

-- Regla de la tabla de revisiones en grupo: reemplazar la lista fija.
do $$
declare
  restriccion text;
begin
  for restriccion in
    select conname
    from pg_constraint
    where conrelid = 'public.cash_movement_group_reviews'::regclass
      and contype = 'c'
      and pg_get_constraintdef(oid) like '%anticipo_prestamo%'
  loop
    execute format('alter table public.cash_movement_group_reviews drop constraint %I', restriccion);
  end loop;
end;
$$;

alter table public.cash_movement_group_reviews
  drop constraint if exists cash_movement_group_reviews_no_aplica_check;

alter table public.cash_movement_group_reviews
  add constraint cash_movement_group_reviews_no_aplica_check
  check (expense_behavior <> 'no_aplica' or public.categoria_tesoreria_sin_impacto(expense_category));

-- Funciones vigentes, idénticas salvo la validación de 'no_aplica'.
create or replace function public.guardar_distribucion_cash_movement(
  p_cash_movement_id uuid,
  p_partidas jsonb
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  movimiento public.cash_movements%rowtype;
  partida jsonb;
  distribucion_id uuid := gen_random_uuid();
  business_id uuid;
  branch_id uuid;
  categoria text;
  comportamiento text;
  nota text;
  monto numeric(14,2);
  suma numeric(14,2) := 0;
  total_partidas integer;
  business_org uuid;
  branch_business uuid;
begin
  if (select auth.uid()) is null then
    raise exception 'Debes iniciar sesión para distribuir un pago';
  end if;

  select * into movimiento
  from public.cash_movements
  where id = p_cash_movement_id
  for update;

  if not found then
    raise exception 'No encontramos el movimiento de Tesorería';
  end if;

  if not private.has_org_role(
    movimiento.organization_id,
    array['owner', 'director', 'admin', 'finanzas']::text[]
  ) then
    raise exception 'Tu perfil no tiene permiso para distribuir este pago';
  end if;

  if movimiento.movement_type <> 'SALIDA' or movimiento.status = 'Cancelado' then
    raise exception 'Solo se pueden distribuir salidas vigentes de dinero';
  end if;

  if jsonb_typeof(p_partidas) <> 'array' then
    raise exception 'El desglose debe ser una lista de partidas';
  end if;

  total_partidas := jsonb_array_length(p_partidas);
  if total_partidas < 1 or total_partidas > 50 then
    raise exception 'El desglose debe tener entre 1 y 50 partidas';
  end if;

  for partida in select value from jsonb_array_elements(p_partidas)
  loop
    if coalesce(partida->>'amount', '') !~ '^[0-9]+([.][0-9]{1,2})?$' then
      raise exception 'Cada partida debe tener un importe positivo con máximo dos decimales';
    end if;

    begin
      business_id := (partida->>'business_id')::uuid;
      branch_id := (partida->>'branch_id')::uuid;
      monto := (partida->>'amount')::numeric;
    exception when others then
      raise exception 'Una partida tiene negocio, sucursal o importe inválido';
    end;

    categoria := lower(trim(coalesce(partida->>'expense_category', '')));
    comportamiento := lower(trim(coalesce(partida->>'expense_behavior', '')));
    nota := nullif(trim(coalesce(partida->>'note', '')), '');

    if monto <= 0 or round(monto, 2) <> monto then
      raise exception 'Cada partida debe tener un importe positivo con máximo dos decimales';
    end if;
    if categoria = '' or categoria = 'sin_clasificar' then
      raise exception 'Cada partida debe tener categoría';
    end if;
    if comportamiento not in ('fijo', 'variable', 'no_aplica') then
      raise exception 'Cada gasto debe ser fijo o variable';
    end if;
    if comportamiento = 'no_aplica' and not public.categoria_tesoreria_sin_impacto(categoria) then
      raise exception 'Un gasto de operación debe ser fijo o variable';
    end if;
    if nota is not null and length(nota) > 500 then
      raise exception 'El detalle de una partida no puede superar 500 caracteres';
    end if;

    select negocio.organization_id, sucursal.business_id
      into business_org, branch_business
    from public.branches sucursal
    join public.businesses negocio on negocio.id = sucursal.business_id
    where negocio.id = business_id
      and sucursal.id = branch_id;

    if not found
      or business_org is distinct from movimiento.organization_id
      or branch_business is distinct from business_id then
      raise exception 'La sucursal no pertenece al negocio de esta organización';
    end if;

    suma := suma + monto;
  end loop;

  if suma <> movimiento.amount then
    raise exception 'Las partidas deben sumar exactamente el importe original ($%)', movimiento.amount;
  end if;

  update public.cash_movement_allocations
  set status = 'REEMPLAZADA'
  where cash_movement_id = p_cash_movement_id
    and status = 'ACTIVA';

  for partida in select value from jsonb_array_elements(p_partidas)
  loop
    insert into public.cash_movement_allocations (
      distribution_id,
      cash_movement_id,
      organization_id,
      business_id,
      branch_id,
      amount,
      expense_category,
      expense_behavior,
      note,
      registered_by
    ) values (
      distribucion_id,
      p_cash_movement_id,
      movimiento.organization_id,
      (partida->>'business_id')::uuid,
      (partida->>'branch_id')::uuid,
      (partida->>'amount')::numeric,
      lower(trim(partida->>'expense_category')),
      lower(trim(partida->>'expense_behavior')),
      nullif(trim(coalesce(partida->>'note', '')), ''),
      (select auth.uid())
    );
  end loop;

  update public.cash_movements
  set status = 'Revisado',
      updated_at = now()
  where id = p_cash_movement_id;

  return distribucion_id;
end;
$$;

create or replace function public.clasificar_movimientos_tesoreria_en_grupo(
  p_movement_ids uuid[],
  p_expense_category text,
  p_expense_behavior text
) returns jsonb
language plpgsql
security definer
set search_path=''
as $$
declare
  v_user uuid := (select auth.uid());
  v_count integer;
  v_signature_count integer;
  v_org uuid;
  v_business uuid;
  v_branch uuid;
  v_account uuid;
  v_concept text;
  v_counterparty text;
  v_total numeric(14,2);
  v_before jsonb;
  v_updated integer;
  v_review_id uuid;
begin
  if v_user is null then
    raise exception 'Debes iniciar sesión para clasificar movimientos';
  end if;
  if p_movement_ids is null or cardinality(p_movement_ids) not between 2 and 100 then
    raise exception 'Selecciona entre 2 y 100 movimientos para revisar juntos';
  end if;
  if cardinality(p_movement_ids) <> (select count(distinct id) from unnest(p_movement_ids) as x(id)) then
    raise exception 'El grupo contiene identificadores repetidos';
  end if;
  if nullif(trim(coalesce(p_expense_category,'')),'') is null
    or p_expense_category='sin_clasificar'
    or length(trim(p_expense_category)) > 80 then
    raise exception 'Selecciona una categoría válida';
  end if;
  if p_expense_behavior is null or p_expense_behavior not in ('fijo','variable','no_aplica') then
    raise exception 'Selecciona un comportamiento válido';
  end if;
  if p_expense_behavior='no_aplica' and not public.categoria_tesoreria_sin_impacto(p_expense_category) then
    raise exception 'No aplica solo corresponde a préstamos, retiros y movimientos que no son gastos';
  end if;

  select count(*),
         count(distinct row(
           organization_id,business_id,branch_id,account_id,movement_type,
           coalesce(concept,''),coalesce(counterparty,''),
           coalesce(expense_category,''),coalesce(expense_behavior,'')
         )),
         (array_agg(organization_id order by occurred_at,id))[1],
         (array_agg(business_id order by occurred_at,id))[1],
         (array_agg(branch_id order by occurred_at,id))[1],
         (array_agg(account_id order by occurred_at,id))[1],
         (array_agg(concept order by occurred_at,id))[1],
         (array_agg(counterparty order by occurred_at,id))[1],
         coalesce(sum(amount),0),
         jsonb_agg(jsonb_build_object(
           'id',id,'amount',amount,'category',expense_category,
           'behavior',expense_behavior,'status',status
         ) order by occurred_at,id)
  into v_count,v_signature_count,v_org,v_business,v_branch,v_account,
       v_concept,v_counterparty,v_total,v_before
  from public.cash_movements
  where id=any(p_movement_ids)
    and status='Pendiente de revisión'
    and movement_type='SALIDA';

  if v_count <> cardinality(p_movement_ids) then
    raise exception 'El grupo cambió o tienes movimientos que ya no están pendientes';
  end if;
  if v_signature_count <> 1 then
    raise exception 'Solo se pueden revisar juntos movimientos de la misma sucursal, cuenta, concepto y clasificación actual';
  end if;
  if nullif(trim(coalesce(v_concept,'')),'') is null then
    raise exception 'No se pueden agrupar movimientos sin concepto de origen';
  end if;
  if not private.has_org_role(v_org,array['owner','director','admin','encargada']::text[]) then
    raise exception 'Tu perfil no puede clasificar este grupo';
  end if;

  update public.cash_movements
  set expense_category=p_expense_category,
      expense_behavior=p_expense_behavior,
      status='Revisado'
  where id=any(p_movement_ids)
    and status='Pendiente de revisión'
    and movement_type='SALIDA';
  get diagnostics v_updated = row_count;
  if v_updated <> v_count then
    raise exception 'Uno o más movimientos cambiaron durante la revisión. No se guardó ningún cambio';
  end if;

  insert into public.cash_movement_group_reviews (
    organization_id,business_id,branch_id,account_id,movement_ids,movement_count,
    total_amount,concept_snapshot,counterparty_snapshot,expense_category,
    expense_behavior,before_snapshot,registered_by
  ) values (
    v_org,v_business,v_branch,v_account,p_movement_ids,v_count,v_total,
    v_concept,v_counterparty,p_expense_category,p_expense_behavior,v_before,v_user
  ) returning id into v_review_id;

  return jsonb_build_object(
    'review_id',v_review_id,'updated',v_updated,'total_amount',v_total
  );
end;
$$;

commit;
