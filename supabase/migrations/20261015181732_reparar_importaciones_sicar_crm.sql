-- Repara el cierre de importaciones y activa las conexiones comerciales
-- que el cliente ya consulta. Todas las políticas se limitan a usuarios
-- autenticados del mismo negocio; sólo owner/admin pueden escribir reportes.

alter table public.importaciones
  add column if not exists created_by uuid null references auth.users(id);

alter table public.importaciones
  alter column created_by set default auth.uid();

create index if not exists importaciones_sucursal_fecha_idx
  on public.importaciones (branch_id, created_at desc);

alter table public.importaciones enable row level security;
alter table public.importacion_detalle enable row level security;

drop policy if exists mvp_importaciones_select on public.importaciones;
drop policy if exists mvp_importaciones_insert on public.importaciones;
drop policy if exists mvp_importaciones_update on public.importaciones;
drop policy if exists "Equipo consulta importaciones de su negocio" on public.importaciones;
drop policy if exists "Direccion registra importaciones de su negocio" on public.importaciones;
drop policy if exists "Direccion confirma importaciones de su negocio" on public.importaciones;

create policy "Equipo consulta importaciones de su negocio"
on public.importaciones for select to authenticated
using (
  exists (
    select 1
    from public.usuarios u
    join public.branches b on b.id = importaciones.branch_id
    where u.auth_user_id = (select auth.uid())
      and u.active
      and u.business_id = b.business_id
      and (
        lower(u.role) in ('owner', 'admin')
        or u.branch_id = importaciones.branch_id
      )
  )
);

create policy "Direccion registra importaciones de su negocio"
on public.importaciones for insert to authenticated
with check (
  created_by = (select auth.uid())
  and exists (
    select 1
    from public.usuarios u
    join public.branches b on b.id = importaciones.branch_id
    where u.auth_user_id = (select auth.uid())
      and u.active
      and lower(u.role) in ('owner', 'admin')
      and u.business_id = b.business_id
      and (importaciones.organization_id is null or importaciones.organization_id = u.organization_id)
  )
);

create policy "Direccion confirma importaciones de su negocio"
on public.importaciones for update to authenticated
using (
  exists (
    select 1
    from public.usuarios u
    join public.branches b on b.id = importaciones.branch_id
    where u.auth_user_id = (select auth.uid())
      and u.active
      and lower(u.role) in ('owner', 'admin')
      and u.business_id = b.business_id
  )
)
with check (
  exists (
    select 1
    from public.usuarios u
    join public.branches b on b.id = importaciones.branch_id
    where u.auth_user_id = (select auth.uid())
      and u.active
      and lower(u.role) in ('owner', 'admin')
      and u.business_id = b.business_id
      and (importaciones.organization_id is null or importaciones.organization_id = u.organization_id)
  )
);

drop policy if exists mvp_importacion_detalle_select on public.importacion_detalle;
drop policy if exists mvp_importacion_detalle_insert on public.importacion_detalle;
drop policy if exists "Equipo consulta detalle de importaciones autorizadas" on public.importacion_detalle;
drop policy if exists "Direccion registra detalle de importaciones" on public.importacion_detalle;

create policy "Equipo consulta detalle de importaciones autorizadas"
on public.importacion_detalle for select to authenticated
using (
  exists (
    select 1
    from public.importaciones i
    where i.id = importacion_detalle.importacion_id
  )
);

create policy "Direccion registra detalle de importaciones"
on public.importacion_detalle for insert to authenticated
with check (
  exists (
    select 1
    from public.importaciones i
    join public.branches b on b.id = i.branch_id
    join public.usuarios u on u.business_id = b.business_id
    where i.id = importacion_detalle.importacion_id
      and u.auth_user_id = (select auth.uid())
      and u.active
      and lower(u.role) in ('owner', 'admin')
  )
);

revoke all on table public.importaciones from anon;
revoke all on table public.importacion_detalle from anon;
grant select, insert, update on table public.importaciones to authenticated;
grant select, insert on table public.importacion_detalle to authenticated;

alter table public.empleados
  add column if not exists usuario_sicar text null;

create unique index if not exists empleados_usuario_sicar_sucursal_unico_idx
  on public.empleados (business_id, branch_id, lower(trim(usuario_sicar)))
  where usuario_sicar is not null and trim(usuario_sicar) <> '';

create table if not exists public.crm_oportunidades (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  business_id uuid not null references public.businesses(id),
  branch_id uuid null references public.branches(id),
  created_by uuid not null default auth.uid() references auth.users(id),
  empleado_id uuid null references public.empleados(id) on delete set null,
  asignado_a uuid null references auth.users(id) on delete set null,
  cliente text not null,
  telefono text null,
  canal text not null default 'MOSTRADOR',
  etapa text not null default 'NUEVO',
  producto_interes text null,
  monto_estimado numeric(14, 2) null,
  proximo_seguimiento date null,
  notas text null,
  ultimo_resultado text null,
  ultimo_seguimiento_at timestamptz null,
  folio_venta_sicar text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint crm_oportunidades_cliente_check check (length(trim(cliente)) >= 2),
  constraint crm_oportunidades_canal_check check (
    canal in ('MOSTRADOR','WHATSAPP','FACEBOOK','INSTAGRAM','TIKTOK','TIKTOK_SHOP','MERCADO_LIBRE','OTRO')
  ),
  constraint crm_oportunidades_etapa_check check (
    etapa in ('NUEVO','CONTACTADO','COTIZANDO','GANADO','PERDIDO')
  ),
  constraint crm_oportunidades_monto_check check (monto_estimado is null or monto_estimado >= 0),
  constraint crm_oportunidades_ganado_folio_check check (
    etapa <> 'GANADO' or (folio_venta_sicar is not null and length(trim(folio_venta_sicar)) > 0)
  )
);

create index if not exists crm_oportunidades_pipeline_idx
  on public.crm_oportunidades (business_id, etapa, proximo_seguimiento);
create index if not exists crm_oportunidades_asignacion_idx
  on public.crm_oportunidades (asignado_a, proximo_seguimiento)
  where asignado_a is not null;
create unique index if not exists crm_oportunidades_folio_sicar_sucursal_unico_idx
  on public.crm_oportunidades (
    business_id,
    coalesce(branch_id, '00000000-0000-0000-0000-000000000000'::uuid),
    lower(trim(folio_venta_sicar))
  )
  where folio_venta_sicar is not null and trim(folio_venta_sicar) <> '';

alter table public.crm_oportunidades enable row level security;

drop policy if exists "CRM visible por organizacion y asignacion" on public.crm_oportunidades;
drop policy if exists "CRM creado por direccion o responsable" on public.crm_oportunidades;
drop policy if exists "CRM actualizado por direccion o responsable" on public.crm_oportunidades;
drop policy if exists "CRM eliminado por direccion" on public.crm_oportunidades;

create policy "CRM visible por organizacion y asignacion"
on public.crm_oportunidades for select to authenticated
using (
  exists (
    select 1 from public.usuarios u
    where u.auth_user_id = (select auth.uid())
      and u.active
      and u.organization_id = crm_oportunidades.organization_id
      and (
        lower(u.role) in ('owner', 'admin')
        or crm_oportunidades.asignado_a = (select auth.uid())
      )
  )
);

create policy "CRM creado por direccion o responsable"
on public.crm_oportunidades for insert to authenticated
with check (
  created_by = (select auth.uid())
  and exists (
    select 1 from public.usuarios u
    where u.auth_user_id = (select auth.uid())
      and u.active
      and u.organization_id = crm_oportunidades.organization_id
      and (
        lower(u.role) in ('owner', 'admin')
        or crm_oportunidades.asignado_a = (select auth.uid())
      )
  )
);

create policy "CRM actualizado por direccion o responsable"
on public.crm_oportunidades for update to authenticated
using (
  exists (
    select 1 from public.usuarios u
    where u.auth_user_id = (select auth.uid())
      and u.active
      and u.organization_id = crm_oportunidades.organization_id
      and (lower(u.role) in ('owner', 'admin') or crm_oportunidades.asignado_a = (select auth.uid()))
  )
)
with check (
  exists (
    select 1 from public.usuarios u
    where u.auth_user_id = (select auth.uid())
      and u.active
      and u.organization_id = crm_oportunidades.organization_id
      and (lower(u.role) in ('owner', 'admin') or crm_oportunidades.asignado_a = (select auth.uid()))
  )
);

create policy "CRM eliminado por direccion"
on public.crm_oportunidades for delete to authenticated
using (
  exists (
    select 1 from public.usuarios u
    where u.auth_user_id = (select auth.uid())
      and u.active
      and u.organization_id = crm_oportunidades.organization_id
      and lower(u.role) in ('owner', 'admin')
  )
);

create table if not exists public.crm_interacciones (
  id uuid primary key default gen_random_uuid(),
  oportunidad_id uuid not null references public.crm_oportunidades(id) on delete cascade,
  organization_id uuid not null references public.organizations(id),
  business_id uuid not null references public.businesses(id),
  branch_id uuid null references public.branches(id),
  registrado_por uuid not null default auth.uid() references auth.users(id),
  canal text not null,
  direccion text not null,
  mensaje text not null,
  external_message_id text null,
  source_url text null,
  ocurrio_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  constraint crm_interacciones_canal_check check (
    canal in ('MOSTRADOR','WHATSAPP','FACEBOOK','INSTAGRAM','TIKTOK','TIKTOK_SHOP','MERCADO_LIBRE','OTRO')
  ),
  constraint crm_interacciones_direccion_check check (direccion in ('ENTRANTE','SALIENTE','NOTA')),
  constraint crm_interacciones_mensaje_check check (length(trim(mensaje)) > 0)
);

create index if not exists crm_interacciones_oportunidad_tiempo_idx
  on public.crm_interacciones (oportunidad_id, ocurrio_at desc);
create index if not exists crm_interacciones_negocio_tiempo_idx
  on public.crm_interacciones (business_id, ocurrio_at desc);

alter table public.crm_interacciones enable row level security;

drop policy if exists "CRM interacciones visibles por oportunidad" on public.crm_interacciones;
drop policy if exists "CRM interacciones registrables por responsable" on public.crm_interacciones;

create policy "CRM interacciones visibles por oportunidad"
on public.crm_interacciones for select to authenticated
using (
  exists (
    select 1 from public.crm_oportunidades o
    where o.id = crm_interacciones.oportunidad_id
  )
);

create policy "CRM interacciones registrables por responsable"
on public.crm_interacciones for insert to authenticated
with check (
  registrado_por = (select auth.uid())
  and exists (
    select 1 from public.crm_oportunidades o
    where o.id = crm_interacciones.oportunidad_id
      and o.organization_id = crm_interacciones.organization_id
      and o.business_id = crm_interacciones.business_id
  )
);

revoke all on table public.crm_oportunidades from anon;
revoke all on table public.crm_interacciones from anon;
grant select, insert, update, delete on table public.crm_oportunidades to authenticated;
grant select, insert on table public.crm_interacciones to authenticated;
