-- Comprobación PREVIA a 20261128040000_conciliacion_plataformas_tesoreria.sql. Solo lectura.
-- Requiere 20261128020000 ya aplicada.
begin transaction read only;
select id, verificacion, resultado, detalle from (
  select 'P1' id, 'Existe private.has_org_role(uuid, text[])' verificacion,
         case when to_regprocedure('private.has_org_role(uuid,text[])') is not null then 'OK' else 'FALLA' end resultado, '' detalle
  union all select 'P2', 'Aplicada 20261128020000 (canal_cuentas, canal_ordenes, canal_liquidaciones)',
         case when to_regclass('public.canal_cuentas') is not null and to_regclass('public.canal_ordenes') is not null and to_regclass('public.canal_liquidaciones') is not null then 'OK' else 'FALLA' end, ''
  union all select 'P3', 'cash_movements tiene id uuid, organization_id, business_id y amount',
         case when count(*) = 4 then 'OK' else 'FALLA' end, string_agg(column_name || ':' || data_type, ', ')
  from information_schema.columns where table_schema='public' and table_name='cash_movements'
    and ((column_name = 'id' and data_type = 'uuid') or column_name in ('organization_id','business_id','amount'))
  union all select 'P4', 'Tabla de vínculos aún no existe (o es reaplicación)',
         case when to_regclass('public.cash_movement_platform_links') is null then 'OK' else 'AVISO' end, ''
) c order by id;
rollback;
