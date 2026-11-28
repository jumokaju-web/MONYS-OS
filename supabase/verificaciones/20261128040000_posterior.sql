-- Comprobación POSTERIOR a 20261128040000. Solo lectura.
begin transaction read only;
with tablas(t) as (values ('cash_movement_platform_links'),('cash_movement_platform_links_auditoria'))
select id, verificacion, resultado, detalle from (
  select 'D1' id, 'RLS activo' verificacion, case when bool_and(c.relrowsecurity) and count(*) = 2 then 'OK' else 'FALLA' end resultado, '' detalle
  from tablas join pg_class c on c.oid = to_regclass('public.' || t)
  union all select 'D2', 'Nadie puede TRUNCATE ni DELETE',
         case when bool_or(has_table_privilege('anon', 'public.' || t, 'TRUNCATE,DELETE') or has_table_privilege('authenticated', 'public.' || t, 'TRUNCATE,DELETE')) then 'FALLA' else 'OK' end, ''
  from tablas
  union all select 'D3', 'anon sin permisos', case when bool_or(has_table_privilege('anon', 'public.' || t, 'SELECT,INSERT,UPDATE')) then 'FALLA' else 'OK' end, '' from tablas
  union all select 'D4', 'Auditoría: authenticated solo SELECT',
         case when has_table_privilege('authenticated', 'public.cash_movement_platform_links_auditoria', 'INSERT,UPDATE') then 'FALLA' else 'OK' end, ''
  union all select 'D5', 'Triggers presentes', case when count(*) = 2 then 'OK' else 'FALLA' end, string_agg(tgname, ', ')
  from pg_trigger where tgname in ('cmpl_validar','cmpl_auditar')
) c order by id;
rollback;
