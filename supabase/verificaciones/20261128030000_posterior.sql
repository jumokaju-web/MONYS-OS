-- Comprobación POSTERIOR a 20261128030000. Solo lectura.
begin transaction read only;
with tablas(t) as (values ('sucursal_vigencias'),('sucursal_calendario'),('sucursal_calendario_auditoria'))
select id, verificacion, resultado, detalle from (
  select 'D1' id, 'RLS activo en las 3 tablas' verificacion,
         case when bool_and(c.relrowsecurity) and count(*) = 3 then 'OK' else 'FALLA' end resultado, '' detalle
  from tablas join pg_class c on c.oid = to_regclass('public.' || t)
  union all select 'D2', 'Nadie (anon ni authenticated) puede TRUNCATE',
         case when bool_or(has_table_privilege('anon', 'public.' || t, 'TRUNCATE') or has_table_privilege('authenticated', 'public.' || t, 'TRUNCATE')) then 'FALLA' else 'OK' end, ''
  from tablas
  union all select 'D3', 'anon sin permisos', case when bool_or(has_table_privilege('anon', 'public.' || t, 'SELECT,INSERT,UPDATE,DELETE')) then 'FALLA' else 'OK' end, '' from tablas
  union all select 'D4', 'Auditoría: authenticated solo SELECT',
         case when has_table_privilege('authenticated', 'public.sucursal_calendario_auditoria', 'INSERT,UPDATE,DELETE') then 'FALLA' else 'OK' end, ''
  union all select 'D5', 'Triggers de validación y auditoría presentes',
         case when count(*) = 4 then 'OK' else 'FALLA' end, string_agg(tgname, ', ')
  from pg_trigger where tgname in ('sucursal_vigencias_validar','sucursal_vigencias_auditar','sucursal_calendario_validar','sucursal_calendario_auditar')
) c order by id;
rollback;
