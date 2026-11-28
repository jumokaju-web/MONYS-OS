-- Banderas de disponibilidad en ventas por artículo.
--
-- Hasta ahora el importador guardaba 0 en importe y utilidad cuando el
-- reporte SICAR no traía la columna o la celda venía vacía, así que un
-- cero real era indistinguible de un dato ausente. Estas columnas lo
-- separan:
--   true  = el reporte traía el número (incluido un cero real)
--   false = la columna no existía o la celda venía vacía
--   null  = desconocido (filas importadas antes de esta migración)
--
-- No se rellenan filas históricas: inferirlo sería inventar el dato.
-- Las políticas RLS de ventas_articulos (20261019040000) aplican a las
-- columnas nuevas sin cambios.
--
-- Aplicación: requiere autorización explícita de la propietaria. El
-- código del importador y de lectura funciona con o sin estas columnas.

alter table public.ventas_articulos
  add column if not exists utilidad_disponible boolean null,
  add column if not exists importe_disponible boolean null;

comment on column public.ventas_articulos.utilidad_disponible is
  'true: utilidad presente en el reporte (incluye cero real); false: ausente; null: desconocido (importación anterior).';

comment on column public.ventas_articulos.importe_disponible is
  'true: importe presente en el reporte (incluye cero real); false: ausente; null: desconocido (importación anterior).';
