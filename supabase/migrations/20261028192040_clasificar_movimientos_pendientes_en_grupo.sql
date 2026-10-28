begin;

create table if not exists public.cash_movement_group_reviews (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  business_id uuid not null references public.businesses(id),
  branch_id uuid not null references public.branches(id),
  account_id uuid references public.accounts(id),
  movement_ids uuid[] not null check (cardinality(movement_ids) between 2 and 100),
  movement_count integer not null check (movement_count = cardinality(movement_ids)),
  total_amount numeric(14,2) not null check (total_amount >= 0),
  concept_snapshot text not null,
  counterparty_snapshot text,
  expense_category text not null,
  expense_behavior text not null check (expense_behavior in ('fijo','variable','no_aplica')),
  before_snapshot jsonb not null,
  registered_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  check (length(trim(concept_snapshot)) between 1 and 500),
  check (expense_category <> 'sin_clasificar'),
  check (expense_behavior <> 'no_aplica' or expense_category in (
    'anticipo_prestamo','retiro_propietaria','traspaso_caja',
    'ajuste_cancelacion','registro_prueba','ingreso_caja_sicar'
  ))
);

create index if not exists cash_movement_group_reviews_scope_idx
  on public.cash_movement_group_reviews (organization_id,business_id,branch_id,created_at desc);

alter table public.cash_movement_group_reviews enable row level security;
revoke all on public.cash_movement_group_reviews from anon, authenticated;
grant select on public.cash_movement_group_reviews to authenticated;

drop policy if exists cash_movement_group_reviews_select on public.cash_movement_group_reviews;
create policy cash_movement_group_reviews_select
on public.cash_movement_group_reviews for select to authenticated
using (private.has_org_role(organization_id,array['owner','director','admin','finanzas']::text[]));

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
  if p_expense_behavior='no_aplica' and p_expense_category not in (
    'anticipo_prestamo','retiro_propietaria','traspaso_caja',
    'ajuste_cancelacion','registro_prueba','ingreso_caja_sicar'
  ) then
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

revoke all on function public.clasificar_movimientos_tesoreria_en_grupo(uuid[],text,text) from public,anon,authenticated;
grant execute on function public.clasificar_movimientos_tesoreria_en_grupo(uuid[],text,text) to authenticated;

commit;
