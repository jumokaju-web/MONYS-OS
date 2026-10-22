begin;

create table public.cash_movement_allocations (
  id uuid primary key default gen_random_uuid(),
  distribution_id uuid not null,
  cash_movement_id uuid not null references public.cash_movements(id) on delete restrict,
  organization_id uuid not null references public.organizations(id) on delete restrict,
  business_id uuid not null references public.businesses(id) on delete restrict,
  branch_id uuid not null references public.branches(id) on delete restrict,
  amount numeric(14,2) not null check (amount > 0),
  expense_category text not null check (length(trim(expense_category)) > 0),
  expense_behavior text not null check (expense_behavior in ('fijo', 'variable', 'no_aplica')),
  note text check (note is null or length(note) <= 500),
  status text not null default 'ACTIVA' check (status in ('ACTIVA', 'REEMPLAZADA')),
  registered_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now()
);

comment on table public.cash_movement_allocations is
  'Desglose analítico de un movimiento real. Nunca representa una entrada o salida adicional de efectivo.';

create index cash_movement_allocations_movement_idx
  on public.cash_movement_allocations (cash_movement_id, status, created_at desc);
create index cash_movement_allocations_scope_idx
  on public.cash_movement_allocations (organization_id, business_id, branch_id, created_at desc);

alter table public.cash_movement_allocations enable row level security;
revoke all on public.cash_movement_allocations from anon, authenticated;
grant select on public.cash_movement_allocations to authenticated;

create policy cash_movement_allocations_finanzas_select
  on public.cash_movement_allocations
  for select to authenticated
  using (
    private.has_org_role(
      organization_id,
      array['owner', 'director', 'admin', 'finanzas']::text[]
    )
  );

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
    if coalesce(partida->>'amount', '') !~ '^[0-9]+(\.[0-9]{1,2})?$' then
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
    if comportamiento = 'no_aplica' and categoria not in (
      'anticipo_prestamo', 'retiro_propietaria', 'traspaso_caja',
      'ajuste_cancelacion', 'registro_prueba', 'ingreso_caja_sicar'
    ) then
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

revoke all on function public.guardar_distribucion_cash_movement(uuid, jsonb) from public, anon;
grant execute on function public.guardar_distribucion_cash_movement(uuid, jsonb) to authenticated;

commit;
