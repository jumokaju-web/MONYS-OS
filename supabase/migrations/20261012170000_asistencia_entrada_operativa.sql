begin;

create table if not exists public.asistencia_operativa (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  business_id uuid not null references public.businesses(id) on delete cascade,
  branch_id uuid not null references public.branches(id) on delete cascade,
  empleado_id uuid not null references public.empleados(id) on delete cascade,
  usuario_id uuid not null references auth.users(id) on delete cascade,
  fecha date not null,
  entrada_at timestamptz not null default now(),
  unique (empleado_id, fecha)
);

create index if not exists asistencia_operativa_sucursal_fecha_idx
  on public.asistencia_operativa (branch_id, fecha, entrada_at);

alter table public.asistencia_operativa enable row level security;
revoke all on public.asistencia_operativa from anon;
grant select on public.asistencia_operativa to authenticated;
grant insert (organization_id, business_id, branch_id, empleado_id, usuario_id, fecha)
  on public.asistencia_operativa to authenticated;

create policy asistencia_operativa_select_alcance
on public.asistencia_operativa
for select to authenticated
using (
  usuario_id = (select auth.uid())
  or exists (
    select 1
    from public.usuarios u
    where u.auth_user_id = (select auth.uid())
      and u.active
      and u.role in ('owner', 'director', 'admin', 'rh')
      and u.organization_id = asistencia_operativa.organization_id
      and (u.business_id is null or u.business_id = asistencia_operativa.business_id)
      and (u.branch_id is null or u.branch_id = asistencia_operativa.branch_id)
  )
);

create policy asistencia_operativa_insert_propia
on public.asistencia_operativa
for insert to authenticated
with check (
  usuario_id = (select auth.uid())
  and fecha = (now() at time zone 'America/Mexico_City')::date
  and exists (
    select 1
    from public.empleados e
    where e.id = asistencia_operativa.empleado_id
      and e.usuario_id = (select auth.uid())
      and e.active
      and e.organization_id = asistencia_operativa.organization_id
      and e.business_id = asistencia_operativa.business_id
      and e.branch_id = asistencia_operativa.branch_id
  )
);

commit;
