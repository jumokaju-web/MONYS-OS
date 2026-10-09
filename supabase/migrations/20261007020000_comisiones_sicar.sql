alter table public.empleados
  add column if not exists usuario_sicar text null;

create unique index if not exists empleados_usuario_sicar_sucursal_unico_idx
  on public.empleados (
    business_id,
    branch_id,
    lower(trim(usuario_sicar))
  )
  where usuario_sicar is not null and trim(usuario_sicar) <> '';
