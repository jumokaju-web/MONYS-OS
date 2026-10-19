-- Alcance permanente y auditable para decisiones ejecutivas y órdenes de compra.
-- Los registros legados sin evidencia conservan sus datos y quedan marcados como
-- PENDIENTE_CLASIFICACION; no se les inventa organización, negocio ni sucursal.

alter table public.decisiones_ejecutivas
  add column if not exists organization_id uuid references public.organizations(id),
  add column if not exists business_id uuid references public.businesses(id),
  add column if not exists branch_id uuid references public.branches(id),
  add column if not exists created_by uuid references auth.users(id),
  add column if not exists scope_status text not null default 'PENDIENTE_CLASIFICACION';

alter table public.ordenes_compra
  add column if not exists organization_id uuid references public.organizations(id),
  add column if not exists business_id uuid references public.businesses(id),
  add column if not exists branch_id uuid references public.branches(id),
  add column if not exists created_by uuid references auth.users(id),
  add column if not exists scope_status text not null default 'PENDIENTE_CLASIFICACION';

alter table public.decisiones_ejecutivas
  drop constraint if exists decisiones_ejecutivas_scope_status_check,
  add constraint decisiones_ejecutivas_scope_status_check check (
    scope_status in ('ASIGNADO', 'PENDIENTE_CLASIFICACION')
    and (
      scope_status = 'PENDIENTE_CLASIFICACION'
      or (organization_id is not null and business_id is not null and branch_id is not null)
    )
  );

alter table public.ordenes_compra
  drop constraint if exists ordenes_compra_scope_status_check,
  add constraint ordenes_compra_scope_status_check check (
    scope_status in ('ASIGNADO', 'PENDIENTE_CLASIFICACION')
    and (
      scope_status = 'PENDIENTE_CLASIFICACION'
      or (organization_id is not null and business_id is not null and branch_id is not null)
    )
  );

-- Sólo se recupera alcance cuando la importación enlazada aporta sucursal real.
update public.decisiones_ejecutivas decision
set organization_id = business.organization_id,
    business_id = branch.business_id,
    branch_id = importacion.branch_id,
    created_by = importacion.created_by,
    scope_status = 'ASIGNADO'
from public.importaciones importacion
join public.branches branch on branch.id = importacion.branch_id
join public.businesses business on business.id = branch.business_id
where decision.importacion_id = importacion.id
  and decision.organization_id is null
  and decision.business_id is null
  and decision.branch_id is null;

-- Las órdenes sólo heredan un alcance que ya quedó comprobado en su decisión.
update public.ordenes_compra orden
set organization_id = decision.organization_id,
    business_id = decision.business_id,
    branch_id = decision.branch_id,
    created_by = decision.created_by,
    scope_status = 'ASIGNADO'
from public.decisiones_ejecutivas decision
where orden.origen_decision_id = decision.id
  and decision.scope_status = 'ASIGNADO'
  and orden.organization_id is null
  and orden.business_id is null
  and orden.branch_id is null;

create index if not exists decisiones_ejecutivas_alcance_idx
  on public.decisiones_ejecutivas (organization_id, business_id, branch_id, creado_en desc);
create index if not exists decisiones_ejecutivas_created_by_idx
  on public.decisiones_ejecutivas (created_by);
create index if not exists ordenes_compra_alcance_idx
  on public.ordenes_compra (organization_id, business_id, branch_id, creado_en desc);
create index if not exists ordenes_compra_created_by_idx
  on public.ordenes_compra (created_by);

create or replace function private.monys_owner_puede_ver_registro_legacy()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    (select count(*) from public.organizations) = 1
    and exists (
      select 1
      from public.usuarios actor
      join public.organizations organization
        on organization.id = actor.organization_id
      where actor.auth_user_id = (select auth.uid())
        and actor.active
        and lower(actor.role) = 'owner'
    );
$$;

grant usage on schema private to authenticated;
revoke all on function private.monys_owner_puede_ver_registro_legacy()
  from public, anon;
grant execute on function private.monys_owner_puede_ver_registro_legacy()
  to authenticated;

create or replace function private.monys_asignar_alcance_decision()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor public.usuarios%rowtype;
  alcance record;
begin
  select usuario.* into actor
  from public.usuarios usuario
  where usuario.auth_user_id = (select auth.uid())
    and usuario.active
    and lower(usuario.role) = 'owner'
  limit 1;

  if actor.id is null then
    raise exception 'Sólo la propietaria puede registrar decisiones ejecutivas';
  end if;

  if tg_op = 'UPDATE' and new.importacion_id is not distinct from old.importacion_id then
    new.organization_id := old.organization_id;
    new.business_id := old.business_id;
    new.branch_id := old.branch_id;
    new.created_by := old.created_by;
    new.scope_status := old.scope_status;
    return new;
  end if;

  if new.importacion_id is not null then
    select business.organization_id, branch.business_id, importacion.branch_id
      into alcance
    from public.importaciones importacion
    join public.branches branch on branch.id = importacion.branch_id
    join public.businesses business on business.id = branch.business_id
    where importacion.id = new.importacion_id;

    if alcance.organization_id is null
      or alcance.business_id is null
      or alcance.branch_id is null
      or alcance.organization_id <> actor.organization_id then
      raise exception 'La importación no tiene un alcance válido para esta propietaria';
    end if;

    new.organization_id := alcance.organization_id;
    new.business_id := alcance.business_id;
    new.branch_id := alcance.branch_id;
  else
    if actor.organization_id is null or actor.business_id is null or actor.branch_id is null then
      raise exception 'El perfil de la propietaria no tiene alcance completo';
    end if;
    new.organization_id := actor.organization_id;
    new.business_id := actor.business_id;
    new.branch_id := actor.branch_id;
  end if;

  new.created_by := (select auth.uid());
  new.scope_status := 'ASIGNADO';
  return new;
end;
$$;

create or replace function private.monys_asignar_alcance_orden()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor public.usuarios%rowtype;
  decision public.decisiones_ejecutivas%rowtype;
begin
  select usuario.* into actor
  from public.usuarios usuario
  where usuario.auth_user_id = (select auth.uid())
    and usuario.active
    and lower(usuario.role) = 'owner'
  limit 1;

  if actor.id is null then
    raise exception 'Sólo la propietaria puede registrar órdenes de compra';
  end if;

  if tg_op = 'UPDATE' then
    new.organization_id := old.organization_id;
    new.business_id := old.business_id;
    new.branch_id := old.branch_id;
    new.created_by := old.created_by;
    new.scope_status := old.scope_status;
    return new;
  end if;

  if new.origen_decision_id is not null then
    select decision_row.* into decision
    from public.decisiones_ejecutivas decision_row
    where decision_row.id = new.origen_decision_id;

    if decision.id is null
      or decision.scope_status <> 'ASIGNADO'
      or decision.organization_id <> actor.organization_id then
      raise exception 'La decisión de origen no tiene alcance comprobado para esta propietaria';
    end if;

    new.organization_id := decision.organization_id;
    new.business_id := decision.business_id;
    new.branch_id := decision.branch_id;
  else
    if actor.organization_id is null or actor.business_id is null or actor.branch_id is null then
      raise exception 'El perfil de la propietaria no tiene alcance completo';
    end if;
    new.organization_id := actor.organization_id;
    new.business_id := actor.business_id;
    new.branch_id := actor.branch_id;
  end if;

  new.created_by := (select auth.uid());
  new.scope_status := 'ASIGNADO';
  return new;
end;
$$;

revoke all on function private.monys_asignar_alcance_decision()
  from public, anon, authenticated;
revoke all on function private.monys_asignar_alcance_orden()
  from public, anon, authenticated;

drop trigger if exists monys_asignar_alcance_decision on public.decisiones_ejecutivas;
create trigger monys_asignar_alcance_decision
before insert or update on public.decisiones_ejecutivas
for each row execute function private.monys_asignar_alcance_decision();

drop trigger if exists monys_asignar_alcance_orden on public.ordenes_compra;
create trigger monys_asignar_alcance_orden
before insert or update on public.ordenes_compra
for each row execute function private.monys_asignar_alcance_orden();

drop policy if exists monys_decisiones_owner_select on public.decisiones_ejecutivas;
drop policy if exists monys_decisiones_owner_insert on public.decisiones_ejecutivas;
drop policy if exists monys_decisiones_owner_update on public.decisiones_ejecutivas;

create policy monys_decisiones_owner_select
on public.decisiones_ejecutivas for select to authenticated
using (
  exists (
    select 1 from public.usuarios actor
    where actor.auth_user_id = (select auth.uid())
      and actor.active and lower(actor.role) = 'owner'
      and actor.organization_id = decisiones_ejecutivas.organization_id
  )
  or (
    decisiones_ejecutivas.scope_status = 'PENDIENTE_CLASIFICACION'
    and private.monys_owner_puede_ver_registro_legacy()
  )
);

create policy monys_decisiones_owner_insert
on public.decisiones_ejecutivas for insert to authenticated
with check (
  scope_status = 'ASIGNADO'
  and created_by = (select auth.uid())
  and exists (
    select 1 from public.usuarios actor
    where actor.auth_user_id = (select auth.uid())
      and actor.active and lower(actor.role) = 'owner'
      and actor.organization_id = decisiones_ejecutivas.organization_id
  )
);

create policy monys_decisiones_owner_update
on public.decisiones_ejecutivas for update to authenticated
using (
  exists (
    select 1 from public.usuarios actor
    where actor.auth_user_id = (select auth.uid())
      and actor.active and lower(actor.role) = 'owner'
      and actor.organization_id = decisiones_ejecutivas.organization_id
  )
  or (
    decisiones_ejecutivas.scope_status = 'PENDIENTE_CLASIFICACION'
    and private.monys_owner_puede_ver_registro_legacy()
  )
)
with check (
  exists (
    select 1 from public.usuarios actor
    where actor.auth_user_id = (select auth.uid())
      and actor.active and lower(actor.role) = 'owner'
      and actor.organization_id = decisiones_ejecutivas.organization_id
  )
  or (
    decisiones_ejecutivas.scope_status = 'PENDIENTE_CLASIFICACION'
    and private.monys_owner_puede_ver_registro_legacy()
  )
);

drop policy if exists monys_ordenes_owner_select on public.ordenes_compra;
drop policy if exists monys_ordenes_owner_insert on public.ordenes_compra;
drop policy if exists monys_ordenes_owner_update on public.ordenes_compra;
drop policy if exists monys_ordenes_owner_delete on public.ordenes_compra;

create policy monys_ordenes_owner_select on public.ordenes_compra
for select to authenticated using (
  exists (
    select 1 from public.usuarios actor
    where actor.auth_user_id = (select auth.uid())
      and actor.active and lower(actor.role) = 'owner'
      and actor.organization_id = ordenes_compra.organization_id
  )
  or (
    ordenes_compra.scope_status = 'PENDIENTE_CLASIFICACION'
    and private.monys_owner_puede_ver_registro_legacy()
  )
);

create policy monys_ordenes_owner_insert on public.ordenes_compra
for insert to authenticated with check (
  scope_status = 'ASIGNADO'
  and created_by = (select auth.uid())
  and exists (
    select 1 from public.usuarios actor
    where actor.auth_user_id = (select auth.uid())
      and actor.active and lower(actor.role) = 'owner'
      and actor.organization_id = ordenes_compra.organization_id
  )
);

create policy monys_ordenes_owner_update on public.ordenes_compra
for update to authenticated
using (
  exists (
    select 1 from public.usuarios actor
    where actor.auth_user_id = (select auth.uid())
      and actor.active and lower(actor.role) = 'owner'
      and actor.organization_id = ordenes_compra.organization_id
  )
  or (
    ordenes_compra.scope_status = 'PENDIENTE_CLASIFICACION'
    and private.monys_owner_puede_ver_registro_legacy()
  )
)
with check (
  exists (
    select 1 from public.usuarios actor
    where actor.auth_user_id = (select auth.uid())
      and actor.active and lower(actor.role) = 'owner'
      and actor.organization_id = ordenes_compra.organization_id
  )
  or (
    ordenes_compra.scope_status = 'PENDIENTE_CLASIFICACION'
    and private.monys_owner_puede_ver_registro_legacy()
  )
);

create policy monys_ordenes_owner_delete on public.ordenes_compra
for delete to authenticated using (
  exists (
    select 1 from public.usuarios actor
    where actor.auth_user_id = (select auth.uid())
      and actor.active and lower(actor.role) = 'owner'
      and actor.organization_id = ordenes_compra.organization_id
  )
  or (
    ordenes_compra.scope_status = 'PENDIENTE_CLASIFICACION'
    and private.monys_owner_puede_ver_registro_legacy()
  )
);

-- Lista explícita de RPC privilegiadas que el cliente utiliza. Toda función
-- SECURITY DEFINER queda bloqueada y sólo estas operaciones vuelven a abrirse a
-- authenticated; cada una conserva su comprobación interna de rol/propiedad.
do $acl$
declare
  funcion record;
begin
  for funcion in
    select p.oid::regprocedure as firma
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.prosecdef
  loop
    execute format('revoke execute on function %s from public, anon, authenticated', funcion.firma);
  end loop;
end
$acl$;

grant execute on function public.activar_chofer_con_codigo(text, text) to authenticated;
grant execute on function public.anular_ajuste_prefactura_flotilla(uuid) to authenticated;
grant execute on function public.anular_movimiento_financiero_rh(uuid, text) to authenticated;
grant execute on function public.aplicar_descuento_pnr_flotilla(uuid, date, date, numeric, text) to authenticated;
grant execute on function public.configurar_acceso_flotilla(text, text, text, uuid[]) to authenticated;
grant execute on function public.configurar_permisos_usuario(uuid, jsonb, text) to authenticated;
grant execute on function public.desactivar_acceso_flotilla(text) to authenticated;
grant execute on function public.flotilla_es_admin_de_organizacion(uuid) to authenticated;
grant execute on function public.flotilla_puede_gestionar_pnr(uuid) to authenticated;
grant execute on function public.flotilla_puede_ver_unidad(uuid) to authenticated;
grant execute on function public.generar_codigo_activacion_chofer(uuid) to authenticated;
grant execute on function public.gestionar_pnr_flotilla(uuid, text, text, numeric) to authenticated;
grant execute on function public.guardar_ajuste_prefactura_flotilla(uuid, uuid, text, date, date, text, numeric, text, integer, integer) to authenticated;
grant execute on function public.marcar_movimiento_financiero_rh_pagado(uuid, text) to authenticated;
grant execute on function public.programar_publicacion_marketing(uuid, timestamptz) to authenticated;
grant execute on function public.registrar_liquidaciones_comision_rh(date, date, uuid, jsonb) to authenticated;
grant execute on function public.registrar_movimiento_financiero_rh(uuid, text, numeric, text, date, date, text, uuid, jsonb) to authenticated;
grant execute on function public.registrar_movimiento_laboral_empleado(uuid, text, date, text) to authenticated;
grant execute on function public.registrar_recuperacion_movimiento_rh(uuid, numeric, text, text) to authenticated;
grant execute on function public.registrar_revision_corte_diario(uuid, integer, text, text, text, text, jsonb) to authenticated;
grant execute on function public.resolver_aprobacion_publicacion_marketing(uuid, boolean, text) to authenticated;
grant execute on function public.responder_pnr_flotilla(uuid, text) to authenticated;
grant execute on function public.solicitar_aprobacion_publicacion_marketing(uuid) to authenticated;
grant execute on function public.solicitar_convenio_pnr_flotilla(uuid, numeric) to authenticated;

