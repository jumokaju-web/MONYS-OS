begin;

create table if not exists public.pagos_proveedores_sicar (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  business_id uuid not null references public.businesses(id) on delete cascade,
  branch_id uuid not null references public.branches(id) on delete restrict,
  importacion_id uuid not null references public.importaciones(id) on delete restrict,
  importacion_detalle_id uuid not null references public.importacion_detalle(id) on delete restrict,
  proveedor_credito_id uuid references public.creditos_proveedores(id) on delete set null,
  proveedor_nombre_snapshot text not null check (length(trim(proveedor_nombre_snapshot)) between 2 and 180),
  numero_proveedor_snapshot text,
  tipo_aplicacion text not null default 'POR_DETERMINAR'
    check (tipo_aplicacion in ('ABONO', 'LIQUIDACION', 'POR_DETERMINAR')),
  fecha_pago date not null,
  importe_pago numeric(14,2) not null check (importe_pago > 0),
  evidencia text not null check (length(trim(evidencia)) between 5 and 500),
  estado text not null default 'ACTIVA' check (estado in ('ACTIVA', 'ANULADA')),
  registrado_por uuid not null references auth.users(id) on delete restrict,
  registrado_en timestamptz not null default now(),
  motivo_anulacion text,
  anulado_por uuid references auth.users(id) on delete restrict,
  anulado_en timestamptz,
  check (
    (estado = 'ACTIVA' and motivo_anulacion is null and anulado_por is null and anulado_en is null)
    or (estado = 'ANULADA' and length(trim(coalesce(motivo_anulacion, ''))) between 5 and 500 and anulado_por is not null and anulado_en is not null)
  )
);

create unique index if not exists pagos_proveedores_sicar_detalle_activo_unico_idx
  on public.pagos_proveedores_sicar (importacion_detalle_id)
  where estado = 'ACTIVA';
create index if not exists pagos_proveedores_sicar_alcance_fecha_idx
  on public.pagos_proveedores_sicar (organization_id, business_id, branch_id, fecha_pago desc);
create index if not exists pagos_proveedores_sicar_proveedor_idx
  on public.pagos_proveedores_sicar (proveedor_credito_id, fecha_pago desc)
  where estado = 'ACTIVA';

comment on table public.pagos_proveedores_sicar is
  'Atribución auditada de salidas SICAR con cheque a proveedores. No reduce saldos importados ni presume liquidación.';

alter table public.pagos_proveedores_sicar enable row level security;
revoke all on public.pagos_proveedores_sicar from anon, authenticated;
grant select, insert on public.pagos_proveedores_sicar to authenticated;
grant update (estado, motivo_anulacion, anulado_por, anulado_en) on public.pagos_proveedores_sicar to authenticated;

drop policy if exists pagos_proveedores_sicar_select_direccion on public.pagos_proveedores_sicar;
create policy pagos_proveedores_sicar_select_direccion
  on public.pagos_proveedores_sicar for select to authenticated
  using (
    (select (auth.jwt()->>'is_anonymous')::boolean) is false
    and exists (
      select 1 from public.usuarios u
      where u.auth_user_id = (select auth.uid()) and u.active = true
        and lower(u.role) in ('owner', 'admin')
        and u.organization_id = pagos_proveedores_sicar.organization_id
        and u.business_id = pagos_proveedores_sicar.business_id
    )
  );

drop policy if exists pagos_proveedores_sicar_insert_cheque_validado on public.pagos_proveedores_sicar;
create policy pagos_proveedores_sicar_insert_cheque_validado
  on public.pagos_proveedores_sicar for insert to authenticated
  with check (
    (select (auth.jwt()->>'is_anonymous')::boolean) is false
    and registrado_por = (select auth.uid())
    and estado = 'ACTIVA'
    and motivo_anulacion is null and anulado_por is null and anulado_en is null
    and exists (
      select 1 from public.usuarios u
      where u.auth_user_id = (select auth.uid()) and u.active = true
        and lower(u.role) in ('owner', 'admin')
        and u.organization_id = pagos_proveedores_sicar.organization_id
        and u.business_id = pagos_proveedores_sicar.business_id
    )
    and exists (
      select 1 from public.branches b
      where b.id = pagos_proveedores_sicar.branch_id and b.active = true
        and b.business_id = pagos_proveedores_sicar.business_id
    )
    and exists (
      select 1
      from public.importaciones i
      join public.importacion_detalle d on d.importacion_id = i.id
      where i.id = pagos_proveedores_sicar.importacion_id
        and d.id = pagos_proveedores_sicar.importacion_detalle_id
        and i.branch_id = pagos_proveedores_sicar.branch_id
        and i.organization_id = pagos_proveedores_sicar.organization_id
        and i.estado = 'procesado'
        and i.tipo_reporte = 'Movimientos de caja'
        and upper(trim(coalesce(d.datos_originales->>'tipoMovimiento', d.datos_originales->>'tipo', ''))) = 'SALIDA'
        and upper(trim(coalesce(d.datos_originales->>'metodoPago', ''))) = 'CH'
        and case
          when trim(coalesce(d.datos_originales->>'fecha', '')) ~ '^\d+(\.\d+)?$'
            and (d.datos_originales->>'fecha')::numeric > 10000
            then date '1899-12-30' + floor((d.datos_originales->>'fecha')::numeric)::integer
          when trim(coalesce(d.datos_originales->>'fecha', '')) ~ '^\d{4}-\d{2}-\d{2}'
            then substring(d.datos_originales->>'fecha' from 1 for 10)::date
          else null
        end = pagos_proveedores_sicar.fecha_pago
        and round(coalesce(nullif(d.datos_originales->>'monto', '')::numeric,
          nullif(d.datos_originales->>'total', '')::numeric), 2) = pagos_proveedores_sicar.importe_pago
    )
    and (
      pagos_proveedores_sicar.proveedor_credito_id is null
      or exists (
        select 1
        from public.creditos_proveedores cp
        join public.importaciones ci on ci.id = cp.importacion_id
        where cp.id = pagos_proveedores_sicar.proveedor_credito_id
          and ci.branch_id = pagos_proveedores_sicar.branch_id
          and ci.organization_id = pagos_proveedores_sicar.organization_id
          and ci.estado = 'procesado'
          and ci.tipo_reporte = 'Créditos de proveedores'
          and lower(trim(cp.nombre)) = lower(trim(pagos_proveedores_sicar.proveedor_nombre_snapshot))
          and coalesce(cp.numero_proveedor, '') = coalesce(pagos_proveedores_sicar.numero_proveedor_snapshot, '')
      )
    )
  );

drop policy if exists pagos_proveedores_sicar_anula_sin_borrar on public.pagos_proveedores_sicar;
create policy pagos_proveedores_sicar_anula_sin_borrar
  on public.pagos_proveedores_sicar for update to authenticated
  using (
    (select (auth.jwt()->>'is_anonymous')::boolean) is false
    and estado = 'ACTIVA'
    and exists (
      select 1 from public.usuarios u
      where u.auth_user_id = (select auth.uid()) and u.active = true
        and lower(u.role) in ('owner', 'admin')
        and u.organization_id = pagos_proveedores_sicar.organization_id
        and u.business_id = pagos_proveedores_sicar.business_id
    )
  )
  with check (
    (select (auth.jwt()->>'is_anonymous')::boolean) is false
    and estado = 'ANULADA'
    and length(trim(coalesce(motivo_anulacion, ''))) between 5 and 500
    and anulado_por = (select auth.uid()) and anulado_en is not null
    and exists (
      select 1 from public.usuarios u
      where u.auth_user_id = (select auth.uid()) and u.active = true
        and lower(u.role) in ('owner', 'admin')
        and u.organization_id = pagos_proveedores_sicar.organization_id
        and u.business_id = pagos_proveedores_sicar.business_id
    )
  );

commit;
