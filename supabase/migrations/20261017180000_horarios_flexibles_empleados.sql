begin;

create table if not exists public.empleado_horario_semanal (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  business_id uuid not null references public.businesses(id) on delete cascade,
  empleado_id uuid not null references public.empleados(id) on delete cascade,
  branch_id uuid not null references public.branches(id) on delete cascade,
  dia_semana smallint not null check (dia_semana between 0 and 6),
  estado text not null check (estado in ('TRABAJA', 'DESCANSA', 'FLEXIBLE')),
  hora_inicio time,
  hora_fin time,
  nota text check (nota is null or char_length(trim(nota)) between 1 and 300),
  changed_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (empleado_id, dia_semana),
  check (
    (estado = 'TRABAJA' and hora_inicio is not null and hora_fin is not null and hora_inicio < hora_fin)
    or (estado in ('DESCANSA', 'FLEXIBLE') and hora_inicio is null and hora_fin is null)
  )
);

create table if not exists public.empleado_horario_excepcion (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  business_id uuid not null references public.businesses(id) on delete cascade,
  empleado_id uuid not null references public.empleados(id) on delete cascade,
  branch_id uuid not null references public.branches(id) on delete cascade,
  fecha date not null,
  estado text not null check (estado in ('TRABAJA', 'DESCANSA', 'FLEXIBLE')),
  hora_inicio time,
  hora_fin time,
  motivo text not null check (char_length(trim(motivo)) between 3 and 300),
  changed_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (empleado_id, fecha),
  check (
    (estado = 'TRABAJA' and hora_inicio is not null and hora_fin is not null and hora_inicio < hora_fin)
    or (estado in ('DESCANSA', 'FLEXIBLE') and hora_inicio is null and hora_fin is null)
  )
);

create index if not exists empleado_horario_semanal_sucursal_dia_idx
  on public.empleado_horario_semanal (branch_id, dia_semana, empleado_id);
create index if not exists empleado_horario_excepcion_sucursal_fecha_idx
  on public.empleado_horario_excepcion (branch_id, fecha, empleado_id);
create index if not exists empleado_horario_excepcion_empleado_fecha_idx
  on public.empleado_horario_excepcion (empleado_id, fecha desc);

alter table public.empleado_horario_semanal enable row level security;
alter table public.empleado_horario_excepcion enable row level security;
revoke all on public.empleado_horario_semanal from anon;
revoke all on public.empleado_horario_excepcion from anon;
grant select, insert, update, delete on public.empleado_horario_semanal to authenticated;
grant select, insert, update, delete on public.empleado_horario_excepcion to authenticated;

create policy empleado_horario_semanal_select_alcance
on public.empleado_horario_semanal
for select to authenticated
using (
  exists (
    select 1 from public.empleados e
    where e.id = empleado_horario_semanal.empleado_id
      and e.organization_id = empleado_horario_semanal.organization_id
      and e.business_id = empleado_horario_semanal.business_id
      and (
        e.usuario_id = (select auth.uid())
        or exists (
          select 1 from public.usuarios acceso
          where acceso.id = e.usuario_id
            and acceso.auth_user_id = (select auth.uid())
            and acceso.active
        )
        or exists (
          select 1 from public.usuarios u
          where u.auth_user_id = (select auth.uid())
            and u.active
            and u.organization_id = e.organization_id
            and (u.business_id is null or u.business_id = e.business_id)
            and (u.role = 'owner' or u.branch_id is null or u.branch_id in (e.branch_id, empleado_horario_semanal.branch_id))
        )
      )
  )
);

create policy empleado_horario_semanal_direccion_escribe
on public.empleado_horario_semanal
for all to authenticated
using (
  exists (
    select 1 from public.usuarios u
    where u.auth_user_id = (select auth.uid())
      and u.active
      and u.role in ('owner', 'director', 'admin', 'rh')
      and u.organization_id = empleado_horario_semanal.organization_id
      and (u.business_id is null or u.business_id = empleado_horario_semanal.business_id)
      and (u.role = 'owner' or u.branch_id is null or u.branch_id = empleado_horario_semanal.branch_id)
  )
)
with check (
  changed_by = (select auth.uid())
  and exists (
    select 1 from public.empleados e
    join public.branches b on b.id = empleado_horario_semanal.branch_id
    join public.usuarios u on u.auth_user_id = (select auth.uid())
    where e.id = empleado_horario_semanal.empleado_id
      and e.organization_id = empleado_horario_semanal.organization_id
      and e.business_id = empleado_horario_semanal.business_id
      and b.business_id = empleado_horario_semanal.business_id
      and u.active
      and u.role in ('owner', 'director', 'admin', 'rh')
      and u.organization_id = e.organization_id
      and (u.business_id is null or u.business_id = e.business_id)
      and (u.role = 'owner' or u.branch_id is null or u.branch_id = empleado_horario_semanal.branch_id)
  )
);

create policy empleado_horario_excepcion_select_alcance
on public.empleado_horario_excepcion
for select to authenticated
using (
  exists (
    select 1 from public.empleados e
    where e.id = empleado_horario_excepcion.empleado_id
      and e.organization_id = empleado_horario_excepcion.organization_id
      and e.business_id = empleado_horario_excepcion.business_id
      and (
        e.usuario_id = (select auth.uid())
        or exists (
          select 1 from public.usuarios acceso
          where acceso.id = e.usuario_id
            and acceso.auth_user_id = (select auth.uid())
            and acceso.active
        )
        or exists (
          select 1 from public.usuarios u
          where u.auth_user_id = (select auth.uid())
            and u.active
            and u.organization_id = e.organization_id
            and (u.business_id is null or u.business_id = e.business_id)
            and (u.role = 'owner' or u.branch_id is null or u.branch_id in (e.branch_id, empleado_horario_excepcion.branch_id))
        )
      )
  )
);

create policy empleado_horario_excepcion_direccion_escribe
on public.empleado_horario_excepcion
for all to authenticated
using (
  exists (
    select 1 from public.usuarios u
    where u.auth_user_id = (select auth.uid())
      and u.active
      and u.role in ('owner', 'director', 'admin', 'rh')
      and u.organization_id = empleado_horario_excepcion.organization_id
      and (u.business_id is null or u.business_id = empleado_horario_excepcion.business_id)
      and (u.role = 'owner' or u.branch_id is null or u.branch_id = empleado_horario_excepcion.branch_id)
  )
)
with check (
  changed_by = (select auth.uid())
  and exists (
    select 1 from public.empleados e
    join public.branches b on b.id = empleado_horario_excepcion.branch_id
    join public.usuarios u on u.auth_user_id = (select auth.uid())
    where e.id = empleado_horario_excepcion.empleado_id
      and e.organization_id = empleado_horario_excepcion.organization_id
      and e.business_id = empleado_horario_excepcion.business_id
      and b.business_id = empleado_horario_excepcion.business_id
      and u.active
      and u.role in ('owner', 'director', 'admin', 'rh')
      and u.organization_id = e.organization_id
      and (u.business_id is null or u.business_id = e.business_id)
      and (u.role = 'owner' or u.branch_id is null or u.branch_id = empleado_horario_excepcion.branch_id)
  )
);

commit;
