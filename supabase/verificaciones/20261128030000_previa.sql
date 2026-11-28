-- Comprobación PREVIA a 20261128030000_calendario_operativo_sucursales.sql. Solo lectura.
begin transaction read only;
select id, verificacion, resultado, detalle from (
  select 'P1' id, 'Existe private.has_org_role(uuid, text[])' verificacion,
         case when to_regprocedure('private.has_org_role(uuid,text[])') is not null then 'OK' else 'FALLA' end resultado, '' detalle
  union all select 'P2', 'Existe auth.uid()', case when to_regprocedure('auth.uid()') is not null then 'OK' else 'FALLA' end, ''
  union all select 'P3', 'branches tiene business_id y businesses tiene organization_id',
         case when exists (select 1 from information_schema.columns where table_schema='public' and table_name='branches' and column_name='business_id')
               and exists (select 1 from information_schema.columns where table_schema='public' and table_name='businesses' and column_name='organization_id') then 'OK' else 'FALLA' end, ''
  union all select 'P4', 'Toda sucursal pertenece a un negocio existente',
         case when count(*) = 0 then 'OK' else 'AVISO' end, count(*)::text || ' sucursal(es) sin negocio válido'
  from public.branches b left join public.businesses n on n.id = b.business_id where n.id is null
  union all select 'P5', 'Tablas del calendario aún no existen (o es reaplicación)',
         case when to_regclass('public.sucursal_calendario') is null then 'OK' else 'AVISO' end, ''
  union all select 'P6', 'Roles usados por las políticas (owner, director, admin, finanzas, encargada) existen en usuarios', 'INFO',
         coalesce((select string_agg(distinct lower(role), ', ') from public.usuarios), 'tabla usuarios no disponible')
) c order by id;
rollback;
