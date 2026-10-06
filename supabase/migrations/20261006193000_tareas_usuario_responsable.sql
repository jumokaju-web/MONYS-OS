alter table public.tareas_operativas
  add column if not exists responsable_usuario_id uuid
  references auth.users(id)
  on delete set null;

create index if not exists tareas_operativas_responsable_usuario_idx
  on public.tareas_operativas (responsable_usuario_id, fecha)
  where responsable_usuario_id is not null;
