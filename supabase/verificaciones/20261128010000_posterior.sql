-- Comprobación POSTERIOR a 20261128010000. Solo lectura.
begin transaction read only;
select id, verificacion, resultado, detalle from (
  select 'D1' id, 'categoria_tesoreria_sin_impacto clasifica bien' verificacion,
         case when public.categoria_tesoreria_sin_impacto('pago_capital_deuda') and public.categoria_tesoreria_sin_impacto('impuesto_isr')
               and not public.categoria_tesoreria_sin_impacto('renta') and not public.categoria_tesoreria_sin_impacto('intereses_deuda') then 'OK' else 'FALLA' end resultado, '' detalle
  union all
  select 'D2', 'Existe el CHECK cash_movement_group_reviews_no_aplica_check',
         case when count(*) = 1 then 'OK' else 'FALLA' end, ''
  from pg_constraint where conname = 'cash_movement_group_reviews_no_aplica_check'
  union all
  select 'D3', 'Funciones en la versión nueva',
         case when bool_and(md5(prosrc) in ('5e8a1fb4af4b0640d5a12aea148336ee','845e41385cf03ee471567f340568f8b4')) then 'OK' else 'FALLA' end,
         string_agg(proname || '=' || md5(prosrc), ' | ')
  from pg_proc where pronamespace = 'public'::regnamespace and proname in ('guardar_distribucion_cash_movement','clasificar_movimientos_tesoreria_en_grupo')
  union all
  select 'D4', 'Permisos de las funciones (deben ser iguales a P7 de la previa)', 'INFO',
         string_agg(proname || '=' || coalesce(array_to_string(proacl, ','), 'por defecto'), ' | ')
  from pg_proc where pronamespace = 'public'::regnamespace and proname in ('guardar_distribucion_cash_movement','clasificar_movimientos_tesoreria_en_grupo')
) c order by id;
rollback;
