alter table public.empleados
  add column if not exists responsabilidades text[] not null default '{}';

comment on column public.empleados.responsabilidades is
  'Responsabilidades operativas visibles para la persona dentro de MONYS OS.';
