create table if not exists public.empleado_configuracion_operativa (
  id uuid primary key default gen_random_uuid(),
  empleado_id uuid not null unique references public.empleados(id) on delete cascade,
  usuario_id uuid not null unique references auth.users(id) on delete cascade,
  branch_id uuid not null references public.branches(id) on delete cascade,
  nombre_preferido text not null check (char_length(trim(nombre_preferido)) between 1 and 60),
  dia_descanso smallint not null check (dia_descanso between 0 and 6),
  area_asignada text not null check (area_asignada in (
    'VENTA_TIENDA', 'VENTA_WHATSAPP', 'PUBLICAR_GRUPOS_WHATSAPP', 'CAJA_CORTE', 'INVENTARIO_APOYO'
  )),
  turno_asignado text not null check (turno_asignado in ('PRIMERO', 'SEGUNDO', 'AMBOS')),
  updated_at timestamptz not null default now(),
  constraint empleado_configuracion_branch_match check (branch_id is not null)
);

create index if not exists empleado_configuracion_operativa_branch_idx
  on public.empleado_configuracion_operativa (branch_id, area_asignada, turno_asignado);

alter table public.empleado_configuracion_operativa enable row level security;
revoke all on public.empleado_configuracion_operativa from anon;
grant select, insert, update on public.empleado_configuracion_operativa to authenticated;

drop policy if exists empleado_config_operativa_select_propietario on public.empleado_configuracion_operativa;
create policy empleado_config_operativa_select_propietario
on public.empleado_configuracion_operativa
for select to authenticated
using (
  usuario_id = (select auth.uid())
  or exists (
    select 1
    from public.usuarios u
    join public.empleados e on e.id = empleado_configuracion_operativa.empleado_id
    where u.auth_user_id = (select auth.uid())
      and u.active
      and u.role in ('owner', 'director', 'admin', 'rh')
      and u.organization_id = e.organization_id
      and (u.business_id is null or u.business_id = e.business_id)
      and (u.branch_id is null or u.branch_id = e.branch_id)
  )
);

drop policy if exists empleado_config_operativa_insert_propio on public.empleado_configuracion_operativa;
create policy empleado_config_operativa_insert_propio
on public.empleado_config_operativa
for insert to authenticated
with check (
  usuario_id = (select auth.uid())
  and exists (
    select 1
    from public.empleados e
    where e.id = empleado_configuracion_operativa.empleado_id
      and e.usuario_id = (select auth.uid())
      and e.active
      and e.branch_id = empleado_configuracion_operativa.branch_id
  )
);

drop policy if exists empleado_config_operativa_update_propio on public.empleado_configuracion_operativa;
create policy empleado_config_operativa_update_propio
on public.empleado_configuracion_operativa
for update to authenticated
using (
  usuario_id = (select auth.uid())
  and exists (
    select 1
    from public.empleados e
    where e.id = empleado_configuracion_operativa.empleado_id
      and e.usuario_id = (select auth.uid())
      and e.active
      and e.branch_id = empleado_configuracion_operativa.branch_id
  )
)
with check (
  usuario_id = (select auth.uid())
  and exists (
    select 1
    from public.empleados e
    where e.id = empleado_configuracion_operativa.empleado_id
      and e.usuario_id = (select auth.uid())
      and e.active
      and e.branch_id = empleado_configuracion_operativa.branch_id
  )
);
