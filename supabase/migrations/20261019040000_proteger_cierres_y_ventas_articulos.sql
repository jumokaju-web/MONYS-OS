-- Cierra políticas heredadas que permitían a cualquier cuenta autenticada
-- leer e insertar cierres y ventas de cualquier sucursal.
--
-- Los cierres conservan el flujo operativo de tienda y flotilla:
-- - Dirección consulta todas las sucursales de su negocio.
-- - Vendedoras/encargadas consultan la operación compartida de su sucursal.
-- - Finanzas puede consultar el cierre de su sucursal si tiene el permiso.
-- - Los demás perfiles sólo consultan los registros que ellos crearon.
-- - Toda captura nueva conserva el auth.uid() que la creó.
--
-- Las ventas por artículo heredan el alcance de la importación:
-- - Dirección consulta su negocio.
-- - Un perfil operativo necesita ver_ventas y queda limitado a su sucursal.
-- - Sólo Dirección puede insertar filas y únicamente dentro de una importación
--   creada por la misma sesión autenticada.

alter table public.cierres_turno
  add column if not exists created_by uuid null references auth.users(id);

alter table public.cierres_turno
  alter column created_by set default auth.uid();

create index if not exists cierres_turno_sucursal_fecha_idx
  on public.cierres_turno (branch_id, fecha desc, created_at desc);

create index if not exists cierres_turno_creador_idx
  on public.cierres_turno (created_by, created_at desc)
  where created_by is not null;

alter table public.cierres_turno enable row level security;

drop policy if exists permitir_select_cierres_autenticados
  on public.cierres_turno;
drop policy if exists permitir_insert_cierres_autenticados
  on public.cierres_turno;
drop policy if exists monys_cierres_select_alcance
  on public.cierres_turno;
drop policy if exists monys_cierres_insert_alcance
  on public.cierres_turno;

create policy monys_cierres_select_alcance
on public.cierres_turno
for select
to authenticated
using (
  exists (
    select 1
    from public.usuarios actor
    join public.branches sucursal
      on sucursal.id = cierres_turno.branch_id
    join public.businesses negocio
      on negocio.id = sucursal.business_id
    where actor.auth_user_id = (select auth.uid())
      and actor.active is true
      and actor.organization_id = negocio.organization_id
      and (
        (
          lower(actor.role) in ('owner', 'admin')
          and (
            actor.business_id is null
            or actor.business_id = sucursal.business_id
          )
        )
        or (
          actor.business_id = sucursal.business_id
          and actor.branch_id = cierres_turno.branch_id
          and (
            lower(actor.role) in ('vendedora', 'encargada')
            or cierres_turno.created_by = (select auth.uid())
            or coalesce(
              (
                select excepcion.allowed
                from public.user_permission_overrides excepcion
                where excepcion.usuario_id = actor.id
                  and excepcion.permission = 'ver_finanzas'
                limit 1
              ),
              (
                select permiso.allowed
                from public.role_permissions permiso
                where permiso.role = actor.role
                  and permiso.permission = 'ver_finanzas'
                limit 1
              ),
              false
            )
          )
        )
      )
  )
);

create policy monys_cierres_insert_alcance
on public.cierres_turno
for insert
to authenticated
with check (
  created_by = (select auth.uid())
  and exists (
    select 1
    from public.usuarios actor
    join public.branches sucursal
      on sucursal.id = cierres_turno.branch_id
    join public.businesses negocio
      on negocio.id = sucursal.business_id
    where actor.auth_user_id = (select auth.uid())
      and actor.active is true
      and actor.organization_id = negocio.organization_id
      and (
        (
          lower(actor.role) in ('owner', 'admin')
          and (
            actor.business_id is null
            or actor.business_id = sucursal.business_id
          )
        )
        or (
          actor.business_id = sucursal.business_id
          and actor.branch_id = cierres_turno.branch_id
        )
      )
  )
);

revoke all on table public.cierres_turno from anon, authenticated;
grant select, insert on table public.cierres_turno to authenticated;

alter table public.ventas_articulos enable row level security;

drop policy if exists ventas_articulos_select_authenticated
  on public.ventas_articulos;
drop policy if exists ventas_articulos_insert_authenticated
  on public.ventas_articulos;
drop policy if exists monys_ventas_articulos_select_alcance
  on public.ventas_articulos;
drop policy if exists monys_ventas_articulos_insert_direccion
  on public.ventas_articulos;

create policy monys_ventas_articulos_select_alcance
on public.ventas_articulos
for select
to authenticated
using (
  exists (
    select 1
    from public.importaciones importacion
    join public.branches sucursal
      on sucursal.id = importacion.branch_id
    join public.businesses negocio
      on negocio.id = sucursal.business_id
    join public.usuarios actor
      on actor.auth_user_id = (select auth.uid())
    where importacion.id = ventas_articulos.importacion_id
      and actor.active is true
      and actor.organization_id = negocio.organization_id
      and (
        (
          lower(actor.role) in ('owner', 'admin')
          and (
            actor.business_id is null
            or actor.business_id = sucursal.business_id
          )
        )
        or (
          actor.business_id = sucursal.business_id
          and actor.branch_id = importacion.branch_id
          and coalesce(
            (
              select excepcion.allowed
              from public.user_permission_overrides excepcion
              where excepcion.usuario_id = actor.id
                and excepcion.permission = 'ver_ventas'
              limit 1
            ),
            (
              select permiso.allowed
              from public.role_permissions permiso
              where permiso.role = actor.role
                and permiso.permission = 'ver_ventas'
              limit 1
            ),
            false
          )
        )
      )
  )
);

create policy monys_ventas_articulos_insert_direccion
on public.ventas_articulos
for insert
to authenticated
with check (
  exists (
    select 1
    from public.importaciones importacion
    join public.branches sucursal
      on sucursal.id = importacion.branch_id
    join public.businesses negocio
      on negocio.id = sucursal.business_id
    join public.usuarios actor
      on actor.auth_user_id = (select auth.uid())
    where importacion.id = ventas_articulos.importacion_id
      and importacion.created_by = (select auth.uid())
      and actor.active is true
      and actor.organization_id = negocio.organization_id
      and lower(actor.role) in ('owner', 'admin')
      and (
        actor.business_id is null
        or actor.business_id = sucursal.business_id
      )
  )
);

revoke all on table public.ventas_articulos from anon, authenticated;
grant select, insert on table public.ventas_articulos to authenticated;
