-- Comprobación PREVIA a 20261128010000_categorias_deuda_impuestos_marketplace.sql
-- Solo lectura. Correr en staging y luego en producción antes de aplicar.
-- Todas las filas deben decir OK (AVISO = revisar con Claude antes de aplicar).
begin transaction read only;
select id, verificacion, resultado, detalle from (
  select 'P1' id, 'Existe private.has_org_role(uuid, text[])' verificacion,
         case when to_regprocedure('private.has_org_role(uuid,text[])') is not null then 'OK' else 'FALLA' end resultado, '' detalle
  union all
  select 'P2', 'Huella de guardar_distribucion_cash_movement es la revisada',
         case when md5(prosrc) in ('ab5cd0701561b71368c13e0fd0300c23','5e8a1fb4af4b0640d5a12aea148336ee') then 'OK' else 'FALLA' end, md5(prosrc)
  from pg_proc where pronamespace = 'public'::regnamespace and proname = 'guardar_distribucion_cash_movement'
  union all
  select 'P3', 'Huella de clasificar_movimientos_tesoreria_en_grupo es la revisada',
         case when md5(prosrc) in ('81a834b8110581bba48cf02e51a42542','845e41385cf03ee471567f340568f8b4') then 'OK' else 'FALLA' end, md5(prosrc)
  from pg_proc where pronamespace = 'public'::regnamespace and proname = 'clasificar_movimientos_tesoreria_en_grupo'
  union all
  select 'P4', 'Existen cash_movements, cash_movement_allocations y cash_movement_group_reviews',
         case when to_regclass('public.cash_movements') is not null and to_regclass('public.cash_movement_allocations') is not null
               and to_regclass('public.cash_movement_group_reviews') is not null then 'OK' else 'FALLA' end, ''
  union all
  select 'P5', 'Ninguna revisión en grupo viola la regla nueva de no_aplica',
         case when count(*) = 0 then 'OK' else 'FALLA' end, count(*)::text || ' fila(s)'
  from public.cash_movement_group_reviews
  where expense_behavior = 'no_aplica'
    and lower(trim(coalesce(expense_category, ''))) not in ('anticipo_prestamo','retiro_propietaria','traspaso_caja','ajuste_cancelacion','registro_prueba','ingreso_caja_sicar',
      'pago_capital_deuda','impuesto_iva','impuesto_isr','liquidacion_marketplace','retencion_marketplace','devolucion_marketplace')
  union all
  -- Si cash_movements enumera categorías en un CHECK, las nuevas serían rechazadas.
  select 'P6', 'cash_movements no restringe expense_category a una lista que excluya las nuevas',
         case when count(*) = 0 then 'OK' else 'AVISO' end, coalesce(string_agg(conname || ': ' || pg_get_constraintdef(oid), ' | '), 'sin CHECK de categoría')
  from pg_constraint
  where conrelid = 'public.cash_movements'::regclass and contype = 'c'
    and pg_get_constraintdef(oid) ilike '%expense_category%' and pg_get_constraintdef(oid) not ilike '%pago_capital_deuda%'
  union all
  select 'P7', 'Permisos actuales de las funciones (anotar para comparar después)', 'INFO',
         string_agg(proname || '=' || coalesce(array_to_string(proacl, ','), 'por defecto'), ' | ')
  from pg_proc where pronamespace = 'public'::regnamespace and proname in ('guardar_distribucion_cash_movement','clasificar_movimientos_tesoreria_en_grupo')
) c order by id;
rollback;
