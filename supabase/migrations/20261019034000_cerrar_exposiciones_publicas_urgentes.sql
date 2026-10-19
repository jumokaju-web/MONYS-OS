-- Cierra exposiciones públicas heredadas sin borrar datos ni usuarios.
-- Las sesiones anónimas de Auth usadas por choferes conservan el rol
-- PostgreSQL `authenticated`; por eso la activación por código sigue disponible
-- después de iniciar la sesión segura, pero no desde la llave pública sin sesión.

-- Evita que los objetos nuevos vuelvan a conceder acceso directo a `anon`.
alter default privileges for role postgres in schema public
  revoke all on tables from anon;
alter default privileges for role postgres in schema public
  revoke all on sequences from anon;
alter default privileges for role postgres in schema public
  revoke execute on functions from anon;

revoke all on all tables in schema public from anon;
revoke all on all sequences in schema public from anon;
revoke execute on all functions in schema public from anon;

-- Organización, negocio y sucursal sólo se resuelven para el perfil activo.
drop policy if exists monys_read_organizations on public.organizations;
drop policy if exists monys_organizations_select_alcance on public.organizations;
create policy monys_organizations_select_alcance
on public.organizations for select to authenticated
using (
  exists (
    select 1 from public.usuarios actor
    where actor.auth_user_id = (select auth.uid())
      and actor.active is true
      and actor.organization_id = organizations.id
  )
);

drop policy if exists monys_read_businesses on public.businesses;
drop policy if exists monys_businesses_select_alcance on public.businesses;
create policy monys_businesses_select_alcance
on public.businesses for select to authenticated
using (
  exists (
    select 1 from public.usuarios actor
    where actor.auth_user_id = (select auth.uid())
      and actor.active is true
      and actor.organization_id = businesses.organization_id
      and (
        lower(actor.role) in ('owner', 'admin', 'director')
        or actor.business_id is null
        or actor.business_id = businesses.id
      )
  )
);

drop policy if exists monys_read_branches on public.branches;
drop policy if exists monys_branches_select_alcance on public.branches;
create policy monys_branches_select_alcance
on public.branches for select to authenticated
using (
  exists (
    select 1
    from public.usuarios actor
    join public.businesses negocio on negocio.id = branches.business_id
    where actor.auth_user_id = (select auth.uid())
      and actor.active is true
      and actor.organization_id = negocio.organization_id
      and (
        lower(actor.role) in ('owner', 'admin', 'director')
        or (
          (actor.business_id is null or actor.business_id = branches.business_id)
          and (actor.branch_id is null or actor.branch_id = branches.id)
        )
      )
  )
);

-- Cuentas financieras quedan limitadas a perfiles que participan en caja.
drop policy if exists monys_read_accounts on public.accounts;
drop policy if exists "Miembros consultan cuentas" on public.accounts;
drop policy if exists monys_accounts_select_alcance on public.accounts;
create policy monys_accounts_select_alcance
on public.accounts for select to authenticated
using (
  exists (
    select 1 from public.usuarios actor
    where actor.auth_user_id = (select auth.uid())
      and actor.active is true
      and actor.organization_id = accounts.organization_id
      and lower(actor.role) in (
        'owner', 'admin', 'director', 'finanzas', 'encargada', 'vendedora'
      )
      and (
        lower(actor.role) in ('owner', 'admin', 'director')
        or (
          (actor.business_id is null or actor.business_id = accounts.business_id)
          and (actor.branch_id is null or actor.branch_id = accounts.branch_id)
        )
      )
  )
);

-- El catálogo sigue disponible a la operación comercial, nunca al chofer.
drop policy if exists "Leer categorias" on public.categorias;
drop policy if exists "Insertar categorias" on public.categorias;
drop policy if exists monys_categorias_select_operacion on public.categorias;
drop policy if exists monys_categorias_insert_inventario on public.categorias;
create policy monys_categorias_select_operacion
on public.categorias for select to authenticated
using (
  exists (
    select 1 from public.usuarios actor
    where actor.auth_user_id = (select auth.uid())
      and actor.active is true
      and lower(actor.role) <> 'chofer'
  )
);
create policy monys_categorias_insert_inventario
on public.categorias for insert to authenticated
with check (
  exists (
    select 1 from public.usuarios actor
    where actor.auth_user_id = (select auth.uid())
      and actor.active is true
      and lower(actor.role) in ('owner', 'admin', 'director', 'compras', 'encargada')
  )
);

drop policy if exists "Permitir consultar productos" on public.productos;
drop policy if exists "Permitir insertar productos" on public.productos;
drop policy if exists "Permitir consultar productos autenticados" on public.productos;
drop policy if exists monys_productos_select_operacion on public.productos;
drop policy if exists monys_productos_insert_inventario on public.productos;
create policy monys_productos_select_operacion
on public.productos for select to authenticated
using (
  exists (
    select 1 from public.usuarios actor
    where actor.auth_user_id = (select auth.uid())
      and actor.active is true
      and lower(actor.role) <> 'chofer'
  )
);
create policy monys_productos_insert_inventario
on public.productos for insert to authenticated
with check (
  exists (
    select 1 from public.usuarios actor
    where actor.auth_user_id = (select auth.uid())
      and actor.active is true
      and lower(actor.role) in ('owner', 'admin', 'director', 'compras', 'encargada')
  )
);

-- Decisiones y órdenes antiguas no tienen columnas de alcance. Hasta migrarlas,
-- sólo la propietaria activa puede consultarlas o cambiarlas.
drop policy if exists "Permitir insertar decisiones" on public.decisiones_ejecutivas;
drop policy if exists "Permitir consultar decisiones anon" on public.decisiones_ejecutivas;
drop policy if exists "Usuarios autenticados pueden registrar decisiones" on public.decisiones_ejecutivas;
drop policy if exists "Usuarios autenticados pueden consultar decisiones" on public.decisiones_ejecutivas;
drop policy if exists "Usuarios autenticados pueden actualizar decisiones" on public.decisiones_ejecutivas;
drop policy if exists monys_decisiones_owner_select on public.decisiones_ejecutivas;
drop policy if exists monys_decisiones_owner_insert on public.decisiones_ejecutivas;
drop policy if exists monys_decisiones_owner_update on public.decisiones_ejecutivas;
create policy monys_decisiones_owner_select
on public.decisiones_ejecutivas for select to authenticated
using (
  exists (
    select 1 from public.usuarios actor
    where actor.auth_user_id = (select auth.uid())
      and actor.active is true and lower(actor.role) = 'owner'
  )
);
create policy monys_decisiones_owner_insert
on public.decisiones_ejecutivas for insert to authenticated
with check (
  exists (
    select 1 from public.usuarios actor
    where actor.auth_user_id = (select auth.uid())
      and actor.active is true and lower(actor.role) = 'owner'
  )
);
create policy monys_decisiones_owner_update
on public.decisiones_ejecutivas for update to authenticated
using (
  exists (
    select 1 from public.usuarios actor
    where actor.auth_user_id = (select auth.uid())
      and actor.active is true and lower(actor.role) = 'owner'
  )
)
with check (
  exists (
    select 1 from public.usuarios actor
    where actor.auth_user_id = (select auth.uid())
      and actor.active is true and lower(actor.role) = 'owner'
  )
);

drop policy if exists "Permitir todo ordenes_compra" on public.ordenes_compra;
drop policy if exists monys_ordenes_owner_select on public.ordenes_compra;
drop policy if exists monys_ordenes_owner_insert on public.ordenes_compra;
drop policy if exists monys_ordenes_owner_update on public.ordenes_compra;
drop policy if exists monys_ordenes_owner_delete on public.ordenes_compra;
create policy monys_ordenes_owner_select on public.ordenes_compra
for select to authenticated using (
  exists (select 1 from public.usuarios actor
    where actor.auth_user_id=(select auth.uid()) and actor.active and lower(actor.role)='owner')
);
create policy monys_ordenes_owner_insert on public.ordenes_compra
for insert to authenticated with check (
  exists (select 1 from public.usuarios actor
    where actor.auth_user_id=(select auth.uid()) and actor.active and lower(actor.role)='owner')
);
create policy monys_ordenes_owner_update on public.ordenes_compra
for update to authenticated
using (exists (select 1 from public.usuarios actor
  where actor.auth_user_id=(select auth.uid()) and actor.active and lower(actor.role)='owner'))
with check (exists (select 1 from public.usuarios actor
  where actor.auth_user_id=(select auth.uid()) and actor.active and lower(actor.role)='owner'));
create policy monys_ordenes_owner_delete on public.ordenes_compra
for delete to authenticated using (
  exists (select 1 from public.usuarios actor
    where actor.auth_user_id=(select auth.uid()) and actor.active and lower(actor.role)='owner')
);

-- Evaluaciones heredan exactamente el alcance de su tarea.
drop policy if exists monys_tarea_evaluaciones_all on public.tarea_evaluaciones;
drop policy if exists monys_tarea_evaluaciones_select_alcance on public.tarea_evaluaciones;
drop policy if exists monys_tarea_evaluaciones_insert_alcance on public.tarea_evaluaciones;
drop policy if exists monys_tarea_evaluaciones_update_direccion on public.tarea_evaluaciones;
drop policy if exists monys_tarea_evaluaciones_delete_direccion on public.tarea_evaluaciones;
create policy monys_tarea_evaluaciones_select_alcance
on public.tarea_evaluaciones for select to authenticated
using (
  exists (
    select 1 from public.tareas_operativas tarea
    where tarea.id = tarea_evaluaciones.tarea_id
      and private.monys_puede_acceder_alcance_operativo(
        tarea.organization_id, tarea.business_id, tarea.branch_id,
        tarea.responsable_usuario_id, false
      )
  )
);
create policy monys_tarea_evaluaciones_insert_alcance
on public.tarea_evaluaciones for insert to authenticated
with check (
  exists (
    select 1 from public.tareas_operativas tarea
    where tarea.id = tarea_evaluaciones.tarea_id
      and private.monys_puede_acceder_alcance_operativo(
        tarea.organization_id, tarea.business_id, tarea.branch_id,
        tarea.responsable_usuario_id, false
      )
  )
);
create policy monys_tarea_evaluaciones_update_direccion
on public.tarea_evaluaciones for update to authenticated
using (
  exists (
    select 1 from public.tareas_operativas tarea
    where tarea.id = tarea_evaluaciones.tarea_id
      and private.monys_puede_acceder_alcance_operativo(
        tarea.organization_id, tarea.business_id, tarea.branch_id,
        tarea.responsable_usuario_id, true
      )
  )
)
with check (
  exists (
    select 1 from public.tareas_operativas tarea
    where tarea.id = tarea_evaluaciones.tarea_id
      and private.monys_puede_acceder_alcance_operativo(
        tarea.organization_id, tarea.business_id, tarea.branch_id,
        tarea.responsable_usuario_id, true
      )
  )
);
create policy monys_tarea_evaluaciones_delete_direccion
on public.tarea_evaluaciones for delete to authenticated
using (
  exists (
    select 1 from public.tareas_operativas tarea
    where tarea.id = tarea_evaluaciones.tarea_id
      and private.monys_puede_acceder_alcance_operativo(
        tarea.organization_id, tarea.business_id, tarea.branch_id,
        tarea.responsable_usuario_id, true
      )
  )
);

-- Sólo la propietaria puede eliminar fichas de su organización.
drop policy if exists monys_delete_empleados on public.empleados;
drop policy if exists monys_empleados_delete_owner on public.empleados;
create policy monys_empleados_delete_owner
on public.empleados for delete to authenticated
using (
  exists (
    select 1 from public.usuarios actor
    where actor.auth_user_id = (select auth.uid())
      and actor.active is true
      and lower(actor.role) = 'owner'
      and actor.organization_id = empleados.organization_id
      and (actor.business_id is null or actor.business_id = empleados.business_id)
      and (actor.branch_id is null or actor.branch_id = empleados.branch_id)
  )
);

-- Créditos de proveedor heredan organización y sucursal de la importación SICAR.
drop policy if exists creditos_proveedores_select_authenticated on public.creditos_proveedores;
drop policy if exists creditos_proveedores_insert_authenticated on public.creditos_proveedores;
drop policy if exists monys_creditos_proveedores_select_alcance on public.creditos_proveedores;
drop policy if exists monys_creditos_proveedores_insert_alcance on public.creditos_proveedores;
create policy monys_creditos_proveedores_select_alcance
on public.creditos_proveedores for select to authenticated
using (
  exists (
    select 1
    from public.importaciones importacion
    join public.branches sucursal on sucursal.id = importacion.branch_id
    join public.usuarios actor on actor.auth_user_id = (select auth.uid())
    where importacion.id = creditos_proveedores.importacion_id
      and actor.active is true
      and actor.organization_id = importacion.organization_id
      and actor.organization_id = (
        select negocio.organization_id from public.businesses negocio
        where negocio.id = sucursal.business_id
      )
      and lower(actor.role) in ('owner','admin','director','finanzas','compras','encargada')
      and (actor.business_id is null or actor.business_id = sucursal.business_id)
      and (actor.branch_id is null or actor.branch_id = importacion.branch_id)
  )
);
create policy monys_creditos_proveedores_insert_alcance
on public.creditos_proveedores for insert to authenticated
with check (
  exists (
    select 1
    from public.importaciones importacion
    join public.branches sucursal on sucursal.id = importacion.branch_id
    join public.businesses negocio on negocio.id = sucursal.business_id
    join public.usuarios actor on actor.auth_user_id = (select auth.uid())
    where importacion.id = creditos_proveedores.importacion_id
      and actor.active is true
      and actor.organization_id = importacion.organization_id
      and actor.organization_id = negocio.organization_id
      and lower(actor.role) in ('owner','admin','director','finanzas','compras','encargada')
      and (actor.business_id is null or actor.business_id = sucursal.business_id)
      and (actor.branch_id is null or actor.branch_id = importacion.branch_id)
  )
);

-- El análisis de cierres es información de Dirección y respeta la sucursal.
drop policy if exists permitir_leer_patrones_autenticados on public.cierres_patrones_analisis;
drop policy if exists monys_cierres_patrones_select_direccion on public.cierres_patrones_analisis;
create policy monys_cierres_patrones_select_direccion
on public.cierres_patrones_analisis for select to authenticated
using (
  exists (
    select 1
    from public.branches sucursal
    join public.businesses negocio on negocio.id = sucursal.business_id
    join public.usuarios actor on actor.auth_user_id = (select auth.uid())
    where sucursal.id = cierres_patrones_analisis.branch_id
      and actor.active is true
      and actor.organization_id = negocio.organization_id
      and lower(actor.role) in ('owner','admin','director')
      and (actor.business_id is null or actor.business_id = sucursal.business_id)
      and (actor.branch_id is null or actor.branch_id = sucursal.id)
  )
);

-- El mapa de permisos puede leerse sólo desde un perfil MONYS OS activo.
drop policy if exists authenticated_can_read_role_permissions on public.role_permissions;
drop policy if exists monys_role_permissions_select_activos on public.role_permissions;
create policy monys_role_permissions_select_activos
on public.role_permissions for select to authenticated
using (
  exists (
    select 1 from public.usuarios actor
    where actor.auth_user_id = (select auth.uid()) and actor.active is true
  )
);

-- La vista semanal deja de usar privilegios del creador y obedece RLS.
alter view public.flotilla_saldo_semanal_chofer set (security_invoker = true);
revoke all on table public.flotilla_saldo_semanal_chofer from anon, authenticated;
grant select on table public.flotilla_saldo_semanal_chofer to authenticated;

-- Ninguna función privilegiada se ejecuta con la llave pública sin sesión.
do $seguridad$
declare funcion record;
begin
  for funcion in
    select p.oid, p.oid::regprocedure as firma, t.typname as retorno
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    join pg_type t on t.oid = p.prorettype
    where n.nspname = 'public' and p.prosecdef
  loop
    execute format('revoke execute on function %s from public, anon', funcion.firma);
    if funcion.retorno = 'trigger' then
      execute format('revoke execute on function %s from authenticated', funcion.firma);
    end if;
  end loop;
end
$seguridad$;

-- Esta función sólo es un auxiliar de triggers; nunca es un RPC de cliente.
revoke execute on function public.clasificar_gasolina_por_evidencias(uuid)
  from public, anon, authenticated;

-- Fija el search_path de funciones heredadas señaladas por el asesor.
alter function public.set_updated_at() set search_path = public, pg_temp;
alter function public.liquidar_ruta(uuid) set search_path = public, pg_temp;
alter function public.registrar_no_show(uuid,text,uuid,text) set search_path = public, pg_temp;
alter function public.calcular_pago_ambulancia(numeric) set search_path = public, pg_temp;
alter function public.registrar_ambulancia(text,text,integer,integer,numeric,uuid,uuid,uuid,text) set search_path = public, pg_temp;
alter function public.pasar_ganancia_ruta_a_chofer(uuid) set search_path = public, pg_temp;
alter function public.registrar_movimiento_chofer(text,text,numeric,text,uuid,uuid,text) set search_path = public, pg_temp;
alter function public.buscar_posibles_conciliaciones_flota(uuid) set search_path = public, pg_temp;
alter function public.confirmar_conciliacion_flota(uuid,uuid,numeric,text) set search_path = public, pg_temp;
alter function public.detectar_conciliaciones_flota_pendientes() set search_path = public, pg_temp;
alter function public.resumen_semanal_chofer(date,date,text) set search_path = public, pg_temp;
