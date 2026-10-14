begin;

create table if not exists public.empleados_movimientos_laborales (
  id uuid primary key default gen_random_uuid(),
  empleado_id uuid not null references public.empleados(id) on delete restrict,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  business_id uuid not null references public.businesses(id) on delete cascade,
  branch_id uuid not null references public.branches(id) on delete cascade,
  tipo text not null check (tipo in ('BAJA', 'REACTIVACION')),
  fecha_efectiva date not null,
  motivo text not null check (length(trim(motivo)) > 0),
  estado_anterior boolean not null,
  estado_nuevo boolean not null,
  snapshot jsonb not null default '{}'::jsonb,
  registrado_por uuid references auth.users(id) on delete set null,
  registrado_en timestamptz not null default now()
);

create index if not exists empleados_movimientos_historial_idx
  on public.empleados_movimientos_laborales (branch_id, empleado_id, registrado_en desc);

alter table public.empleados_movimientos_laborales enable row level security;
revoke all on public.empleados_movimientos_laborales from anon;
revoke insert, update, delete on public.empleados_movimientos_laborales from authenticated;
grant select on public.empleados_movimientos_laborales to authenticated;

drop policy if exists empleados_movimientos_owner_select on public.empleados_movimientos_laborales;
create policy empleados_movimientos_owner_select on public.empleados_movimientos_laborales
for select to authenticated
using (
  exists (
    select 1 from public.usuarios u
    where u.auth_user_id = (select auth.uid())
      and u.active = true
      and u.role = 'owner'
      and u.organization_id = empleados_movimientos_laborales.organization_id
      and u.business_id = empleados_movimientos_laborales.business_id
      and u.branch_id = empleados_movimientos_laborales.branch_id
  )
);

create or replace function public.registrar_movimiento_laboral_empleado(
  p_empleado_id uuid,
  p_tipo text,
  p_fecha date default null,
  p_motivo text default null
) returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_empleado public.empleados%rowtype;
  v_fecha date := coalesce(p_fecha, timezone('America/Mexico_City', now())::date);
  v_nuevo_estado boolean;
  v_snapshot jsonb;
begin
  if p_tipo not in ('BAJA', 'REACTIVACION') then raise exception 'Tipo de movimiento laboral no válido'; end if;
  if length(trim(coalesce(p_motivo, ''))) = 0 then raise exception 'El motivo es obligatorio'; end if;
  if v_fecha > timezone('America/Mexico_City', now())::date then raise exception 'La fecha efectiva no puede estar en el futuro'; end if;

  select * into v_empleado from public.empleados where id = p_empleado_id for update;
  if not found then raise exception 'No se encontró a la empleada'; end if;
  if v_empleado.fecha_ingreso is not null and v_fecha < v_empleado.fecha_ingreso then raise exception 'La fecha efectiva no puede ser anterior al ingreso'; end if;
  if not exists (
    select 1 from public.usuarios u
    where u.auth_user_id = auth.uid()
      and u.active = true
      and u.role = 'owner'
      and u.organization_id = v_empleado.organization_id
      and u.business_id = v_empleado.business_id
      and u.branch_id = v_empleado.branch_id
  ) then raise exception 'No tienes permiso para cambiar el estado laboral de esta empleada'; end if;

  v_nuevo_estado := p_tipo = 'REACTIVACION';
  if v_empleado.active is not distinct from v_nuevo_estado then raise exception 'La empleada ya tiene ese estado laboral'; end if;
  v_snapshot := to_jsonb(v_empleado);

  update public.empleados
  set active = v_nuevo_estado,
      fecha_baja = case when p_tipo = 'BAJA' then v_fecha else null end,
      updated_at = now()
  where id = p_empleado_id
  returning * into v_empleado;

  insert into public.empleados_movimientos_laborales (
    empleado_id, organization_id, business_id, branch_id, tipo, fecha_efectiva,
    motivo, estado_anterior, estado_nuevo, snapshot, registrado_por
  ) values (
    v_empleado.id, v_empleado.organization_id, v_empleado.business_id, v_empleado.branch_id,
    p_tipo, v_fecha, trim(p_motivo), not v_nuevo_estado, v_nuevo_estado, v_snapshot, auth.uid()
  );

  return to_jsonb(v_empleado);
end;
$$;

revoke all on function public.registrar_movimiento_laboral_empleado(uuid,text,date,text) from public;
grant execute on function public.registrar_movimiento_laboral_empleado(uuid,text,date,text) to authenticated;
revoke delete on public.empleados from authenticated;

commit;
