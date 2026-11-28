-- Comprobación POSTERIOR a 20261128020000. Solo lectura.
begin transaction read only;
with tablas(t) as (values ('canal_cuentas'),('canal_ordenes'),('canal_orden_items'),('canal_publicaciones'),('canal_liquidaciones'),('canal_devoluciones'),('producto_vinculos')),
funciones(f) as (values ('public.tomar_turno_canal(uuid,integer,uuid)'),('public.liberar_turno_canal(uuid,uuid)'),('public.renovar_turno_canal(uuid,uuid,integer)'),
  ('public.guardar_lote_canal(uuid,uuid,text,jsonb,timestamp with time zone,boolean)'),('public.leer_credencial_canal(uuid)'),('public.guardar_credencial_canal(uuid,text,uuid)'))
select id, verificacion, resultado, detalle from (
  select 'D1' id, 'RLS activo en las 7 tablas' verificacion,
         case when bool_and(c.relrowsecurity) and count(*) = 7 then 'OK' else 'FALLA' end resultado, string_agg(t || '=' || c.relrowsecurity, ', ') detalle
  from tablas join pg_class c on c.oid = to_regclass('public.' || t)
  union all
  select 'D2', 'anon no tiene ningún permiso sobre las tablas',
         case when bool_or(has_table_privilege('anon', 'public.' || t, 'SELECT,INSERT,UPDATE,DELETE,TRUNCATE')) then 'FALLA' else 'OK' end, ''
  from tablas
  union all
  select 'D3', 'authenticated: solo SELECT (e INSERT/UPDATE en producto_vinculos), nunca DELETE ni TRUNCATE',
         case when bool_or(has_table_privilege('authenticated', 'public.' || t, 'DELETE,TRUNCATE'))
                or bool_or(t <> 'producto_vinculos' and has_table_privilege('authenticated', 'public.' || t, 'INSERT,UPDATE')) then 'FALLA' else 'OK' end, ''
  from tablas
  union all
  select 'D4', 'Funciones de turno, lote y credenciales: solo service_role',
         case when bool_or(has_function_privilege('authenticated', f, 'EXECUTE') or has_function_privilege('anon', f, 'EXECUTE')) then 'FALLA'
              when bool_and(has_function_privilege('service_role', f, 'EXECUTE')) then 'OK' else 'AVISO' end,
         (select count(*) from funciones where to_regprocedure(f) is null)::text || ' función(es) no creada(s) (las de credenciales requieren Vault)'
  from funciones where to_regprocedure(f) is not null
  union all
  select 'D5', 'Funciones SECURITY DEFINER con search_path fijo',
         case when bool_and(p.proconfig is not null and array_to_string(p.proconfig, ',') like '%search_path=%') then 'OK' else 'FALLA' end, ''
  from funciones join pg_proc p on p.oid = to_regprocedure(f) where p.prosecdef
) c order by id;
rollback;
