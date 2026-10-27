-- Obligaciones operativas previstas; los pagos se asignan a movimientos existentes.
-- No convierte borradores ni pagos personales en egresos contabilizados.
begin;

create table if not exists public.obligaciones_operativas (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  business_id uuid not null references public.businesses(id) on delete cascade,
  branch_id uuid null references public.branches(id) on delete restrict,
  categoria text not null check (categoria in ('RENTA', 'NOMINA', 'IMPUESTOS', 'SERVICIOS', 'SEGUROS', 'OTRO')),
  concepto text not null check (length(trim(concepto)) between 1 and 180),
  proveedor text null check (proveedor is null or length(trim(proveedor)) <= 180),
  importe numeric(14,2) not null check (importe > 0),
  moneda text not null default 'MXN' check (moneda = 'MXN'),
  fecha_vencimiento date not null,
  frecuencia text not null default 'UNICA' check (frecuencia in ('UNICA', 'SEMANAL', 'QUINCENAL', 'MENSUAL', 'BIMESTRAL', 'TRIMESTRAL', 'SEMESTRAL', 'ANUAL')),
  estado text not null default 'PENDIENTE' check (estado in ('PENDIENTE', 'CANCELADA')),
  notas text null check (notas is null or length(notas) <= 2000),
  creado_por uuid not null default auth.uid() references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists obligaciones_operativas_contexto_fecha_idx
  on public.obligaciones_operativas (organization_id, business_id, fecha_vencimiento, estado);

create table if not exists public.obligaciones_operativas_pagos (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  business_id uuid not null references public.businesses(id) on delete cascade,
  branch_id uuid null references public.branches(id) on delete restrict,
  obligacion_id uuid not null references public.obligaciones_operativas(id) on delete restrict,
  cash_movement_id uuid not null references public.cash_movements(id) on delete restrict,
  importe numeric(14,2) not null check (importe > 0),
  registrado_por uuid not null default auth.uid() references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  unique (obligacion_id, cash_movement_id)
);

create table if not exists public.revisiones_obligaciones_operativas (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  business_id uuid not null references public.businesses(id) on delete cascade,
  fecha_revision date not null,
  nota text not null check (length(trim(nota)) between 8 and 1000),
  confirmado_por uuid not null default auth.uid() references auth.users(id) on delete restrict,
  confirmado_en timestamptz not null default now()
);

create index if not exists obligaciones_operativas_pagos_contexto_idx
  on public.obligaciones_operativas_pagos (organization_id, business_id, obligacion_id);
create index if not exists revisiones_obligaciones_operativas_contexto_idx
  on public.revisiones_obligaciones_operativas (organization_id, business_id, fecha_revision desc, confirmado_en desc);

create or replace function public.validar_alcance_obligacion_operativa()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_branch_id uuid := nullif(to_jsonb(new)->>'branch_id', '')::uuid;
begin
  if not exists (
    select 1
    from public.businesses negocio
    where negocio.id = new.business_id
      and negocio.organization_id = new.organization_id
  ) then
    raise exception 'El negocio no pertenece a la organización seleccionada';
  end if;

  if v_branch_id is not null and not exists (
    select 1
    from public.branches sucursal
    where sucursal.id = v_branch_id
      and sucursal.business_id = new.business_id
  ) then
    raise exception 'La sucursal no pertenece al negocio seleccionado';
  end if;

  return new;
end;
$$;

drop trigger if exists obligaciones_operativas_validar_alcance on public.obligaciones_operativas;
create trigger obligaciones_operativas_validar_alcance
before insert or update on public.obligaciones_operativas
for each row execute function public.validar_alcance_obligacion_operativa();

drop trigger if exists obligaciones_operativas_pagos_validar_alcance on public.obligaciones_operativas_pagos;
create trigger obligaciones_operativas_pagos_validar_alcance
before insert on public.obligaciones_operativas_pagos
for each row execute function public.validar_alcance_obligacion_operativa();

drop trigger if exists revisiones_obligaciones_operativas_validar_alcance on public.revisiones_obligaciones_operativas;
create trigger revisiones_obligaciones_operativas_validar_alcance
before insert on public.revisiones_obligaciones_operativas
for each row execute function public.validar_alcance_obligacion_operativa();

create or replace function public.validar_pago_obligacion_operativa()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_obligacion public.obligaciones_operativas%rowtype;
  v_movimiento public.cash_movements%rowtype;
  v_pagado_obligacion numeric(14,2);
  v_asignado_movimiento numeric(14,2);
begin
  select * into v_obligacion
  from public.obligaciones_operativas
  where id = new.obligacion_id
  for update;
  if not found or v_obligacion.estado <> 'PENDIENTE' then
    raise exception 'La obligación no existe o ya está cancelada';
  end if;

  select * into v_movimiento
  from public.cash_movements
  where id = new.cash_movement_id
  for update;
  if not found or v_movimiento.movement_type <> 'SALIDA' or v_movimiento.status <> 'Revisado' then
    raise exception 'Selecciona una salida revisada de dinero';
  end if;
  if v_obligacion.organization_id is distinct from new.organization_id
    or v_obligacion.business_id is distinct from new.business_id
    or v_movimiento.organization_id is distinct from new.organization_id
    or v_movimiento.business_id is distinct from new.business_id
    or v_movimiento.branch_id is distinct from new.branch_id
    or (v_obligacion.branch_id is not null and v_obligacion.branch_id is distinct from v_movimiento.branch_id) then
    raise exception 'La obligación y la salida deben pertenecer al mismo negocio y sucursal';
  end if;

  select coalesce(sum(importe), 0) into v_pagado_obligacion
  from public.obligaciones_operativas_pagos
  where obligacion_id = new.obligacion_id;
  if new.importe > v_obligacion.importe - v_pagado_obligacion then
    raise exception 'El abono supera el saldo pendiente de la obligación';
  end if;

  select coalesce(sum(importe), 0) into v_asignado_movimiento
  from public.obligaciones_operativas_pagos
  where cash_movement_id = new.cash_movement_id;
  if new.importe > v_movimiento.amount - v_asignado_movimiento then
    raise exception 'El abono supera el importe de salida sin asignar';
  end if;
  return new;
end;
$$;

drop trigger if exists obligaciones_operativas_pago_validar on public.obligaciones_operativas_pagos;
create trigger obligaciones_operativas_pago_validar
before insert on public.obligaciones_operativas_pagos
for each row execute function public.validar_pago_obligacion_operativa();

alter table public.obligaciones_operativas enable row level security;
alter table public.obligaciones_operativas_pagos enable row level security;
alter table public.revisiones_obligaciones_operativas enable row level security;
revoke all on public.obligaciones_operativas, public.obligaciones_operativas_pagos from anon;
revoke all on public.revisiones_obligaciones_operativas from anon;
grant select, insert, update on public.obligaciones_operativas to authenticated;
grant select, insert on public.obligaciones_operativas_pagos to authenticated;
grant select, insert on public.revisiones_obligaciones_operativas to authenticated;
revoke delete on public.obligaciones_operativas, public.obligaciones_operativas_pagos from authenticated;
revoke update, delete on public.revisiones_obligaciones_operativas from authenticated;

create policy obligaciones_operativas_lectura on public.obligaciones_operativas
for select to authenticated using (exists (
  select 1 from public.usuarios u
  where u.auth_user_id = (select auth.uid()) and u.active = true
    and lower(u.role) in ('owner', 'admin', 'director', 'finanzas')
    and u.organization_id = obligaciones_operativas.organization_id
    and (u.business_id is null or u.business_id = obligaciones_operativas.business_id)
    and (u.branch_id is null or obligaciones_operativas.branch_id is null or u.branch_id = obligaciones_operativas.branch_id)
));

create policy obligaciones_operativas_alta on public.obligaciones_operativas
for insert to authenticated with check (
  creado_por = (select auth.uid()) and exists (
    select 1 from public.usuarios u
    where u.auth_user_id = (select auth.uid()) and u.active = true
      and lower(u.role) in ('owner', 'admin', 'director', 'finanzas')
      and u.organization_id = obligaciones_operativas.organization_id
      and (u.business_id is null or u.business_id = obligaciones_operativas.business_id)
      and (u.branch_id is null or obligaciones_operativas.branch_id is null or u.branch_id = obligaciones_operativas.branch_id)
  ) and (obligaciones_operativas.branch_id is null or exists (
    select 1 from public.branches b
    where b.id = obligaciones_operativas.branch_id
      and b.business_id = obligaciones_operativas.business_id
  ))
);

create policy obligaciones_operativas_actualizacion on public.obligaciones_operativas
for update to authenticated using (exists (
  select 1 from public.usuarios u
  where u.auth_user_id = (select auth.uid()) and u.active = true
    and lower(u.role) in ('owner', 'admin', 'director', 'finanzas')
    and u.organization_id = obligaciones_operativas.organization_id
    and (u.business_id is null or u.business_id = obligaciones_operativas.business_id)
    and (u.branch_id is null or obligaciones_operativas.branch_id is null or u.branch_id = obligaciones_operativas.branch_id)
)) with check (exists (
  select 1 from public.usuarios u
  where u.auth_user_id = (select auth.uid()) and u.active = true
    and lower(u.role) in ('owner', 'admin', 'director', 'finanzas')
    and u.organization_id = obligaciones_operativas.organization_id
    and (u.business_id is null or u.business_id = obligaciones_operativas.business_id)
    and (u.branch_id is null or obligaciones_operativas.branch_id is null or u.branch_id = obligaciones_operativas.branch_id)
  ) and (obligaciones_operativas.branch_id is null or exists (
  select 1 from public.branches b
  where b.id = obligaciones_operativas.branch_id
    and b.business_id = obligaciones_operativas.business_id
  )
));

create policy obligaciones_operativas_pagos_lectura on public.obligaciones_operativas_pagos
for select to authenticated using (exists (
  select 1 from public.usuarios u
  where u.auth_user_id = (select auth.uid()) and u.active = true
    and lower(u.role) in ('owner', 'admin', 'director', 'finanzas')
    and u.organization_id = obligaciones_operativas_pagos.organization_id
    and (u.business_id is null or u.business_id = obligaciones_operativas_pagos.business_id)
    and (u.branch_id is null or obligaciones_operativas_pagos.branch_id is null or u.branch_id = obligaciones_operativas_pagos.branch_id)
));

create policy obligaciones_operativas_pagos_alta on public.obligaciones_operativas_pagos
for insert to authenticated with check (
  registrado_por = (select auth.uid()) and exists (
    select 1 from public.usuarios u
    where u.auth_user_id = (select auth.uid()) and u.active = true
      and lower(u.role) in ('owner', 'admin', 'director', 'finanzas')
      and u.organization_id = obligaciones_operativas_pagos.organization_id
      and (u.business_id is null or u.business_id = obligaciones_operativas_pagos.business_id)
      and (u.branch_id is null or obligaciones_operativas_pagos.branch_id is null or u.branch_id = obligaciones_operativas_pagos.branch_id)
  ) and exists (
    select 1 from public.obligaciones_operativas o
    where o.id = obligaciones_operativas_pagos.obligacion_id
      and o.organization_id = obligaciones_operativas_pagos.organization_id
      and o.business_id = obligaciones_operativas_pagos.business_id
  ) and exists (
    select 1 from public.cash_movements m
    where m.id = obligaciones_operativas_pagos.cash_movement_id
      and m.organization_id = obligaciones_operativas_pagos.organization_id
      and m.business_id = obligaciones_operativas_pagos.business_id
      and m.branch_id is not distinct from obligaciones_operativas_pagos.branch_id
      and m.movement_type = 'SALIDA'
      and m.status = 'Revisado'
  ) and exists (
    select 1 from public.obligaciones_operativas o
    join public.cash_movements m on m.id = obligaciones_operativas_pagos.cash_movement_id
    where o.id = obligaciones_operativas_pagos.obligacion_id
      and (o.branch_id is null or o.branch_id is not distinct from m.branch_id)
  )
);

create policy revisiones_obligaciones_operativas_lectura on public.revisiones_obligaciones_operativas
for select to authenticated using (exists (
  select 1 from public.usuarios u
  where u.auth_user_id = (select auth.uid()) and u.active = true
    and lower(u.role) in ('owner', 'admin', 'director', 'finanzas')
    and u.organization_id = revisiones_obligaciones_operativas.organization_id
    and (u.business_id is null or u.business_id = revisiones_obligaciones_operativas.business_id)
));

create policy revisiones_obligaciones_operativas_alta on public.revisiones_obligaciones_operativas
for insert to authenticated with check (
  confirmado_por = (select auth.uid()) and exists (
    select 1 from public.usuarios u
    where u.auth_user_id = (select auth.uid()) and u.active = true
      and lower(u.role) in ('owner', 'admin', 'director', 'finanzas')
      and u.organization_id = revisiones_obligaciones_operativas.organization_id
      and (u.business_id is null or u.business_id = revisiones_obligaciones_operativas.business_id)
  )
);

commit;
