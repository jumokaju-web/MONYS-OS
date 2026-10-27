begin;

drop policy if exists conciliacion_sicar_consulta_direccion on public.conciliaciones_sicar_tesoreria;
create policy conciliacion_sicar_consulta_direccion
  on public.conciliaciones_sicar_tesoreria for select to authenticated
  using (
    (select (auth.jwt()->>'is_anonymous')::boolean) is false
    and exists (
      select 1 from public.usuarios u
      where u.auth_user_id = (select auth.uid()) and u.active = true
        and lower(u.role) in ('owner', 'admin')
        and u.organization_id = conciliaciones_sicar_tesoreria.organization_id
        and u.business_id = conciliaciones_sicar_tesoreria.business_id
    )
  );

drop policy if exists conciliacion_sicar_registra_coincidencia_validada on public.conciliaciones_sicar_tesoreria;
create policy conciliacion_sicar_registra_coincidencia_validada
  on public.conciliaciones_sicar_tesoreria for insert to authenticated
  with check (
    (select (auth.jwt()->>'is_anonymous')::boolean) is false
    and registrado_por = (select auth.uid())
    and estado = 'ACTIVA'
    and motivo_anulacion is null and anulado_por is null and anulado_en is null
    and metodo_sicar = 'CH'
    and exists (
      select 1 from public.usuarios u
      where u.auth_user_id = (select auth.uid()) and u.active = true
        and lower(u.role) in ('owner', 'admin')
        and u.organization_id = conciliaciones_sicar_tesoreria.organization_id
        and u.business_id = conciliaciones_sicar_tesoreria.business_id
    )
    and exists (
      select 1 from public.branches b
      where b.id = conciliaciones_sicar_tesoreria.branch_id and b.active = true
        and b.business_id = conciliaciones_sicar_tesoreria.business_id
    )
    and exists (
      select 1
      from public.importaciones i
      join public.importacion_detalle d on d.importacion_id = i.id
      where i.id = conciliaciones_sicar_tesoreria.importacion_id
        and d.id = conciliaciones_sicar_tesoreria.importacion_detalle_id
        and i.branch_id = conciliaciones_sicar_tesoreria.branch_id
        and i.organization_id = conciliaciones_sicar_tesoreria.organization_id
        and i.estado = 'procesado'
        and i.tipo_reporte = 'Movimientos de caja'
        and upper(trim(coalesce(d.datos_originales->>'tipoMovimiento', ''))) = 'SALIDA'
        and upper(trim(coalesce(d.datos_originales->>'metodoPago', ''))) = conciliaciones_sicar_tesoreria.metodo_sicar
        and case
          when trim(coalesce(d.datos_originales->>'fecha', '')) ~ '^\d+(\.\d+)?$'
            and (d.datos_originales->>'fecha')::numeric > 10000
            then date '1899-12-30' + floor((d.datos_originales->>'fecha')::numeric)::integer
          when trim(coalesce(d.datos_originales->>'fecha', '')) ~ '^\d{4}-\d{2}-\d{2}'
            then substring(d.datos_originales->>'fecha' from 1 for 10)::date
          else null
        end = conciliaciones_sicar_tesoreria.fecha_sicar
        and round(coalesce(nullif(d.datos_originales->>'monto', '')::numeric,
          nullif(d.datos_originales->>'total', '')::numeric), 2) = conciliaciones_sicar_tesoreria.importe_sicar
    )
    and exists (
      select 1 from public.cash_movements m
      where m.id = conciliaciones_sicar_tesoreria.cash_movement_id
        and m.business_id = conciliaciones_sicar_tesoreria.business_id
        and (m.branch_id is null or m.branch_id = conciliaciones_sicar_tesoreria.branch_id)
        and m.movement_type = 'SALIDA' and coalesce(m.status, '') <> 'Cancelado'
        and round(m.amount, 2) = conciliaciones_sicar_tesoreria.importe_sicar
        and m.occurred_at::date = conciliaciones_sicar_tesoreria.fecha_sicar
    )
  );

drop policy if exists conciliacion_sicar_anula_sin_borrar on public.conciliaciones_sicar_tesoreria;
create policy conciliacion_sicar_anula_sin_borrar
  on public.conciliaciones_sicar_tesoreria for update to authenticated
  using (
    (select (auth.jwt()->>'is_anonymous')::boolean) is false
    and estado = 'ACTIVA'
    and exists (
      select 1 from public.usuarios u
      where u.auth_user_id = (select auth.uid()) and u.active = true
        and lower(u.role) in ('owner', 'admin')
        and u.organization_id = conciliaciones_sicar_tesoreria.organization_id
        and u.business_id = conciliaciones_sicar_tesoreria.business_id
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
        and u.organization_id = conciliaciones_sicar_tesoreria.organization_id
        and u.business_id = conciliaciones_sicar_tesoreria.business_id
    )
  );

commit;
