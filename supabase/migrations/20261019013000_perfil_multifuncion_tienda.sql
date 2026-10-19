begin;

-- General Anaya opera con una sola responsable que puede cubrir las cinco
-- funciones autorizadas. Se conserva el catálogo cerrado, la prohibición de
-- duplicados y el mínimo de una función; solo se elimina el tope artificial de tres.
alter table public.empleado_configuracion_operativa
  drop constraint if exists empleado_config_areas_cantidad;

alter table public.empleado_configuracion_operativa
  add constraint empleado_config_areas_cantidad
    check (cardinality(areas_asignadas) between 1 and 5);

commit;
