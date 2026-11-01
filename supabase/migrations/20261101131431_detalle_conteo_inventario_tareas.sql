alter table public.tareas_operativas
  add column if not exists detalle_inventario jsonb not null default '[]'::jsonb;

alter table public.tareas_operativas
  drop constraint if exists tareas_operativas_detalle_inventario_array;

alter table public.tareas_operativas
  add constraint tareas_operativas_detalle_inventario_array
  check (jsonb_typeof(detalle_inventario) = 'array');

comment on column public.tareas_operativas.detalle_inventario is
  'Productos fuente de una tarea de conteo. La existencia física se conserva en resultado y no actualiza SICAR automáticamente.';
