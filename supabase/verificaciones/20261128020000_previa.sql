-- Comprobación PREVIA a 20261128020000_canales_marketplace.sql. Solo lectura.
begin transaction read only;
select id, verificacion, resultado, detalle from (
  select 'P1' id, 'Existe private.has_org_role(uuid, text[])' verificacion,
         case when to_regprocedure('private.has_org_role(uuid,text[])') is not null then 'OK' else 'FALLA' end resultado, '' detalle
  union all select 'P2', 'Existe auth.uid()', case when to_regprocedure('auth.uid()') is not null then 'OK' else 'FALLA' end, ''
  union all select 'P3', 'Existen organizations y businesses(organization_id)',
         case when to_regclass('public.organizations') is not null and exists (select 1 from information_schema.columns where table_schema='public' and table_name='businesses' and column_name='organization_id') then 'OK' else 'FALLA' end, ''
  union all select 'P4', 'Existe el rol service_role', case when exists (select 1 from pg_roles where rolname='service_role') then 'OK' else 'FALLA' end, ''
  union all select 'P5', 'Vault disponible (vault.create_secret y vault.decrypted_secrets)',
         case when to_regprocedure('vault.create_secret(text,text,text)') is not null and to_regclass('vault.decrypted_secrets') is not null then 'OK' else 'AVISO' end,
         'sin Vault, las funciones de credenciales no se crean y la sincronización no puede operar'
  union all select 'P6', 'gen_random_uuid() disponible', case when to_regprocedure('gen_random_uuid()') is not null then 'OK' else 'FALLA' end, ''
  union all select 'P7', 'Tablas de canales aún no existen (o es reaplicación)',
         case when to_regclass('public.canal_cuentas') is null then 'OK' else 'AVISO' end,
         case when to_regclass('public.canal_cuentas') is null then 'instalación nueva' else 'ya existen: la migración es idempotente, revisar que sea la misma versión' end
  union all select 'P8', 'No hay funciones homónimas con otra firma',
         case when count(*) = 0 then 'OK' else 'AVISO' end, coalesce(string_agg(p.oid::regprocedure::text, ' | '), '')
  from pg_proc p where p.pronamespace = 'public'::regnamespace
    and p.proname in ('tomar_turno_canal','liberar_turno_canal','renovar_turno_canal','guardar_lote_canal','leer_credencial_canal','guardar_credencial_canal')
    and p.oid::regprocedure::text not in ('tomar_turno_canal(uuid,integer,uuid)','liberar_turno_canal(uuid,uuid)','renovar_turno_canal(uuid,uuid,integer)',
      'guardar_lote_canal(uuid,uuid,text,jsonb,timestamp with time zone,boolean)','leer_credencial_canal(uuid)','guardar_credencial_canal(uuid,text,uuid)')
) c order by id;
rollback;
