begin;

alter table public.empleado_configuracion_operativa
  add column if not exists areas_asignadas text[];

update public.empleado_configuracion_operativa
set areas_asignadas = array[area_asignada]
where areas_asignadas is null;

create or replace function public.sin_areas_repetidas(valores text[])
returns boolean
language sql
immutable
set search_path = public
as $$
  select cardinality(valores) = count(distinct valor)::integer
  from unnest(valores) as items(valor);
$$;

create or replace function public.sincronizar_areas_configuracion_empleada()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    if new.areas_asignadas is null then
      new.areas_asignadas := array[new.area_asignada];
    elsif new.area_asignada is null then
      new.area_asignada := new.areas_asignadas[1];
    end if;
  elsif new.areas_asignadas is distinct from old.areas_asignadas then
    new.area_asignada := new.areas_asignadas[1];
  elsif new.area_asignada is distinct from old.area_asignada then
    new.areas_asignadas := array[new.area_asignada];
  end if;
  return new;
end;
$$;

drop trigger if exists empleado_configuracion_sincronizar_areas
  on public.empleado_configuracion_operativa;
create trigger empleado_configuracion_sincronizar_areas
before insert or update of area_asignada, areas_asignadas
on public.empleado_configuracion_operativa
for each row execute function public.sincronizar_areas_configuracion_empleada();

alter table public.empleado_configuracion_operativa
  alter column areas_asignadas set not null,
  add constraint empleado_config_areas_cantidad
    check (cardinality(areas_asignadas) between 1 and 3),
  add constraint empleado_config_areas_validas
    check (areas_asignadas <@ array[
      'VENTA_TIENDA', 'VENTA_WHATSAPP', 'PUBLICAR_GRUPOS_WHATSAPP',
      'CAJA_CORTE', 'INVENTARIO_APOYO'
    ]::text[]),
  add constraint empleado_config_areas_sin_repetir
    check (public.sin_areas_repetidas(areas_asignadas));

create index if not exists empleado_config_operativa_areas_gin_idx
  on public.empleado_configuracion_operativa using gin (areas_asignadas);

commit;
