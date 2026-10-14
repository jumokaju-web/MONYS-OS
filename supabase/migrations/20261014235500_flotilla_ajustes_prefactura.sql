begin;

create table if not exists public.flotilla_prefactura_ajustes (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  unidad_id uuid not null references public.flotilla_unidades(id) on delete restrict,
  driver_auth_user_id uuid references auth.users(id) on delete set null,
  chofer_nombre text not null,
  periodo_desde date not null,
  periodo_hasta date not null,
  categoria text not null check (categoria in ('NO_SHOW', 'SINIESTRO', 'PENALIZACION', 'FONDO_UNIDAD')),
  monto numeric(12,2) not null check (monto > 0),
  numero_parcialidad integer check (numero_parcialidad is null or numero_parcialidad > 0),
  total_parcialidades integer check (total_parcialidades is null or total_parcialidades > 0),
  observaciones text,
  estado text not null default 'APLICADO' check (estado in ('APLICADO', 'ANULADO')),
  creado_por uuid not null references auth.users(id) on delete restrict,
  anulado_por uuid references auth.users(id) on delete set null,
  anulado_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (periodo_desde <= periodo_hasta),
  check (categoria = 'FONDO_UNIDAD' or (numero_parcialidad is null and total_parcialidades is null)),
  check (numero_parcialidad is null or total_parcialidades is null or numero_parcialidad <= total_parcialidades)
);

create index if not exists flotilla_prefactura_ajustes_periodo_idx
  on public.flotilla_prefactura_ajustes (organization_id, periodo_desde, periodo_hasta, estado);
create index if not exists flotilla_prefactura_ajustes_unidad_idx
  on public.flotilla_prefactura_ajustes (unidad_id, driver_auth_user_id, periodo_desde);
create unique index if not exists flotilla_prefactura_ajustes_activo_uidx
  on public.flotilla_prefactura_ajustes (
    organization_id, unidad_id, periodo_desde, periodo_hasta, categoria, lower(chofer_nombre)
  ) where estado='APLICADO';

create or replace function public.guardar_ajuste_prefactura_flotilla(
  p_unidad_id uuid,
  p_driver_auth_user_id uuid,
  p_chofer_nombre text,
  p_periodo_desde date,
  p_periodo_hasta date,
  p_categoria text,
  p_monto numeric,
  p_observaciones text default null,
  p_numero_parcialidad integer default null,
  p_total_parcialidades integer default null
)
returns public.flotilla_prefactura_ajustes
language plpgsql
security definer
set search_path = public
as $$
declare
  v_unidad public.flotilla_unidades%rowtype;
  v_resultado public.flotilla_prefactura_ajustes%rowtype;
begin
  select * into v_unidad from public.flotilla_unidades where id = p_unidad_id;
  if v_unidad.id is null then raise exception 'Unidad no encontrada'; end if;
  if not public.flotilla_puede_gestionar_pnr(v_unidad.organization_id) then
    raise exception 'Solo Mónica o el Administrador de Flotilla pueden guardar ajustes';
  end if;
  if p_periodo_desde is null or p_periodo_hasta is null or p_periodo_desde > p_periodo_hasta then
    raise exception 'El corte no es válido';
  end if;
  if p_categoria not in ('NO_SHOW', 'SINIESTRO', 'PENALIZACION', 'FONDO_UNIDAD') then
    raise exception 'La categoría no es válida';
  end if;
  if coalesce(p_monto, 0) <= 0 then raise exception 'El importe debe ser mayor a cero'; end if;
  if nullif(btrim(p_chofer_nombre), '') is null then raise exception 'Falta el nombre del operador'; end if;
  if p_categoria = 'FONDO_UNIDAD' and (
    coalesce(p_numero_parcialidad, 0) <= 0 or coalesce(p_total_parcialidades, 0) <= 0
    or p_numero_parcialidad > p_total_parcialidades
  ) then raise exception 'Indica la parcialidad correcta del fondo por unidad'; end if;

  insert into public.flotilla_prefactura_ajustes (
    organization_id, unidad_id, driver_auth_user_id, chofer_nombre,
    periodo_desde, periodo_hasta, categoria, monto,
    numero_parcialidad, total_parcialidades, observaciones, creado_por
  ) values (
    v_unidad.organization_id, p_unidad_id, p_driver_auth_user_id, btrim(p_chofer_nombre),
    p_periodo_desde, p_periodo_hasta, p_categoria, p_monto,
    case when p_categoria='FONDO_UNIDAD' then p_numero_parcialidad else null end,
    case when p_categoria='FONDO_UNIDAD' then p_total_parcialidades else null end,
    nullif(btrim(p_observaciones), ''), (select auth.uid())
  ) returning * into v_resultado;
  return v_resultado;
end;
$$;

create or replace function public.anular_ajuste_prefactura_flotilla(p_ajuste_id uuid)
returns public.flotilla_prefactura_ajustes
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ajuste public.flotilla_prefactura_ajustes%rowtype;
begin
  select * into v_ajuste from public.flotilla_prefactura_ajustes where id=p_ajuste_id for update;
  if v_ajuste.id is null then raise exception 'Ajuste no encontrado'; end if;
  if not public.flotilla_puede_gestionar_pnr(v_ajuste.organization_id) then
    raise exception 'Solo Mónica o el Administrador de Flotilla pueden anular ajustes';
  end if;
  if v_ajuste.estado = 'ANULADO' then return v_ajuste; end if;
  update public.flotilla_prefactura_ajustes
  set estado='ANULADO', anulado_por=(select auth.uid()), anulado_at=now(), updated_at=now()
  where id=p_ajuste_id returning * into v_ajuste;
  return v_ajuste;
end;
$$;

alter table public.flotilla_prefactura_ajustes enable row level security;
revoke all on public.flotilla_prefactura_ajustes from anon, authenticated;
grant select on public.flotilla_prefactura_ajustes to authenticated;

drop policy if exists flotilla_prefactura_ajustes_select on public.flotilla_prefactura_ajustes;
create policy flotilla_prefactura_ajustes_select on public.flotilla_prefactura_ajustes
for select to authenticated using (public.flotilla_puede_ver_unidad(unidad_id));

revoke all on function public.guardar_ajuste_prefactura_flotilla(uuid,uuid,text,date,date,text,numeric,text,integer,integer) from public;
revoke all on function public.anular_ajuste_prefactura_flotilla(uuid) from public;
grant execute on function public.guardar_ajuste_prefactura_flotilla(uuid,uuid,text,date,date,text,numeric,text,integer,integer) to authenticated;
grant execute on function public.anular_ajuste_prefactura_flotilla(uuid) to authenticated;

comment on table public.flotilla_prefactura_ajustes is
  'Descuentos manuales del corte. Los PNR viven aparte para evitar duplicar su saldo.';

commit;
