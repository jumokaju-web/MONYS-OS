begin;

-- Registro semanal por caja. No crea movimientos contables ni modifica saldos.
create table if not exists public.remanentes_semanales_caja (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  business_id uuid not null references public.businesses(id),
  branch_id uuid not null references public.branches(id),
  importacion_id uuid not null references public.importaciones(id) on delete restrict,
  importacion_detalle_id uuid not null references public.importacion_detalle(id) on delete restrict,
  semana_inicio date not null,
  semana_fin date not null,
  caja_id text not null check (length(trim(caja_id)) between 1 and 40),
  version integer not null check (version > 0),
  efectivo_sicar numeric(14,2) not null check (efectivo_sicar >= 0),
  efectivo_contado numeric(14,2) not null check (efectivo_contado >= 0),
  fondo_fijo numeric(14,2) not null check (fondo_fijo >= 0),
  monto_resguardado numeric(14,2) not null check (monto_resguardado >= 0),
  monto_resguardable numeric(14,2) generated always as (efectivo_contado - fondo_fijo) stored,
  diferencia_sicar numeric(14,2) generated always as (efectivo_contado - efectivo_sicar) stored,
  destino text,
  referencia text,
  evidencia_path text,
  observaciones text,
  nota_revision text,
  estado text not null check (estado in ('REPORTADO','COMPROBADO','DIFERENCIA')),
  registrado_por uuid not null references auth.users(id),
  registrado_nombre text not null,
  verificado_por uuid references auth.users(id),
  verificado_nombre text,
  verificado_en timestamptz,
  created_at timestamptz not null default now(),
  unique (branch_id,caja_id,semana_inicio,version),
  check (semana_fin = semana_inicio + 6 and extract(isodow from semana_inicio) = 1),
  check (efectivo_contado >= fondo_fijo),
  check (monto_resguardado <= efectivo_contado - fondo_fijo),
  check ((monto_resguardado = 0) or (
    length(trim(coalesce(destino,''))) between 2 and 200
    and length(trim(coalesce(referencia,''))) between 2 and 200
    and length(trim(coalesce(evidencia_path,''))) between 3 and 500
  )),
  check (observaciones is null or length(trim(observaciones)) between 5 and 1000),
  check ((estado='REPORTADO' and verificado_por is null and verificado_en is null)
    or (estado in ('COMPROBADO','DIFERENCIA') and verificado_por is not null and verificado_en is not null)),
  check (nota_revision is null or length(trim(nota_revision)) between 5 and 1000)
);

create index if not exists remanentes_semanales_contexto_idx
  on public.remanentes_semanales_caja (organization_id,business_id,semana_inicio,branch_id,caja_id,version desc);

alter table public.remanentes_semanales_caja enable row level security;
revoke all on public.remanentes_semanales_caja from anon, authenticated;
-- Supabase requiere opt-in explícito de tablas nuevas en el Data API desde 2026-10-30.
grant select on public.remanentes_semanales_caja to authenticated;

drop policy if exists remanentes_semanales_direccion_select on public.remanentes_semanales_caja;
create policy remanentes_semanales_direccion_select
on public.remanentes_semanales_caja for select to authenticated
using (private.has_org_role(organization_id,array['owner','director','admin','finanzas']::text[]));

drop policy if exists remanentes_semanales_evidencia_direccion_select on storage.objects;
create policy remanentes_semanales_evidencia_direccion_select
on storage.objects for select to authenticated
using (
  bucket_id='tesoreria-comprobantes'
  and exists (
    select 1 from public.remanentes_semanales_caja remanente
    where remanente.evidencia_path=storage.objects.name
      and private.has_org_role(remanente.organization_id,array['owner','director','admin','finanzas']::text[])
  )
);

create or replace function public.obtener_remanentes_semanales_caja(
  p_business_id uuid,
  p_semana_inicio date
) returns setof public.remanentes_semanales_caja
language sql stable security invoker set search_path=''
as $$
  select distinct on (branch_id,caja_id) *
  from public.remanentes_semanales_caja
  where business_id=p_business_id and semana_inicio=p_semana_inicio
  order by branch_id,caja_id,version desc;
$$;

create or replace function public.registrar_remanente_semanal_caja(
  p_organization_id uuid,
  p_business_id uuid,
  p_branch_id uuid,
  p_semana_inicio date,
  p_semana_fin date,
  p_caja_id text,
  p_importacion_id uuid,
  p_importacion_detalle_id uuid,
  p_version integer,
  p_efectivo_sicar numeric,
  p_efectivo_contado numeric,
  p_fondo_fijo numeric,
  p_monto_resguardado numeric,
  p_destino text,
  p_referencia text,
  p_evidencia_path text,
  p_nota text
) returns jsonb
language plpgsql security definer set search_path=''
as $$
declare
  v_org uuid; v_business uuid; v_version integer; v_nombre text;
  v_contado_sicar numeric; v_retirado_sicar numeric;
  v_evento public.remanentes_semanales_caja%rowtype;
begin
  if (select auth.uid()) is null then raise exception 'Debes iniciar sesión'; end if;
  select b.organization_id,b.id into v_org,v_business
  from public.branches s join public.businesses b on b.id=s.business_id
  where s.id=p_branch_id for update of s;
  if not found or v_org is distinct from p_organization_id or v_business is distinct from p_business_id then
    raise exception 'La sucursal no corresponde al negocio indicado';
  end if;
  if not private.has_org_role(v_org,array['owner','director','admin','finanzas']::text[]) then
    raise exception 'Tu perfil no puede registrar el remanente semanal';
  end if;
  if p_semana_inicio is null or p_semana_fin is distinct from p_semana_inicio+6
    or extract(isodow from p_semana_inicio) is distinct from 1 then
    raise exception 'El periodo debe ser una semana completa de lunes a domingo';
  end if;
  if length(trim(coalesce(p_caja_id,''))) not between 1 and 40 then raise exception 'Indica la caja'; end if;
  select nullif(metodos.value->>'contado','')::numeric, nullif(metodos.value->>'retirado','')::numeric
    into v_contado_sicar,v_retirado_sicar
  from public.importaciones i
  join public.importacion_detalle d on d.importacion_id=i.id and d.id=p_importacion_detalle_id
  cross join lateral jsonb_array_elements(
    case when jsonb_typeof(d.datos_originales->'metodos')='array'
      then d.datos_originales->'metodos' else '[]'::jsonb end
  ) as metodos(value)
  where i.id=p_importacion_id and i.branch_id=p_branch_id and i.estado='procesado'
    and i.tipo_reporte='Cortes de caja'
    and d.datos_originales->>'fecha'=p_semana_fin::text
    and regexp_replace(upper(coalesce(d.datos_originales->>'caja','')),'[^A-Z0-9]','','g')
      =regexp_replace(upper(trim(p_caja_id)),'[^A-Z0-9]','','g')
    and metodos.value->>'clave'='efectivo';
  if not found or v_contado_sicar is null or v_retirado_sicar is null then
    raise exception 'El corte fuente de SICAR no coincide con la sucursal, caja y domingo';
  end if;
  if abs(p_efectivo_sicar-greatest(0,v_contado_sicar-v_retirado_sicar))>0.009 then
    raise exception 'El efectivo reportado cambió respecto del detalle SICAR';
  end if;
  if p_efectivo_sicar is null or p_efectivo_sicar<0 or p_efectivo_contado is null or p_efectivo_contado<0
    or p_fondo_fijo is null or p_fondo_fijo<0 or p_monto_resguardado is null or p_monto_resguardado<0 then
    raise exception 'Los importes deben ser números iguales o mayores a cero';
  end if;
  if p_efectivo_contado<p_fondo_fijo or p_monto_resguardado>p_efectivo_contado-p_fondo_fijo then
    raise exception 'El resguardo no puede exceder el efectivo contado menos el fondo fijo';
  end if;
  if abs(p_efectivo_contado-p_efectivo_sicar)>0.009 and length(trim(coalesce(p_nota,''))) not between 5 and 1000 then
    raise exception 'Explica la diferencia entre el conteo físico y SICAR';
  end if;
  if p_monto_resguardado>0 then
    if length(trim(coalesce(p_destino,''))) not between 2 and 200
      or length(trim(coalesce(p_referencia,''))) not between 2 and 200
      or length(trim(coalesce(p_evidencia_path,''))) not between 3 and 500 then
      raise exception 'Para registrar un resguardo indica destino, referencia y evidencia';
    end if;
    if split_part(p_evidencia_path,'/',1) is distinct from (select auth.uid())::text then
      raise exception 'La evidencia no pertenece a tu sesión';
    end if;
  end if;
  select coalesce(max(version),0) into v_version
  from public.remanentes_semanales_caja
  where branch_id=p_branch_id and caja_id=trim(p_caja_id) and semana_inicio=p_semana_inicio;
  if p_version is null or p_version<>v_version then raise exception 'El registro cambió. Actualiza antes de continuar'; end if;
  select nombre into v_nombre from public.usuarios
  where auth_user_id=(select auth.uid()) and active=true and organization_id=v_org limit 1;
  insert into public.remanentes_semanales_caja (
    organization_id,business_id,branch_id,importacion_id,importacion_detalle_id,semana_inicio,semana_fin,caja_id,version,
    efectivo_sicar,efectivo_contado,fondo_fijo,monto_resguardado,destino,referencia,evidencia_path,observaciones,nota_revision,
    estado,registrado_por,registrado_nombre
  ) values (
    v_org,v_business,p_branch_id,p_importacion_id,p_importacion_detalle_id,p_semana_inicio,p_semana_fin,trim(p_caja_id),v_version+1,
    p_efectivo_sicar,p_efectivo_contado,p_fondo_fijo,p_monto_resguardado,nullif(trim(p_destino),''),
    nullif(trim(p_referencia),''),nullif(trim(p_evidencia_path),''),nullif(trim(p_nota),''),null,'REPORTADO',(select auth.uid()),coalesce(v_nombre,'Dirección')
  ) returning * into v_evento;
  return to_jsonb(v_evento);
end;
$$;

create or replace function public.revisar_remanente_semanal_caja(
  p_remanente_id uuid,
  p_version integer,
  p_estado text,
  p_nota text
) returns jsonb
language plpgsql security definer set search_path=''
as $$
declare
  v_actual public.remanentes_semanales_caja%rowtype;
  v_version integer; v_nombre text; v_evento public.remanentes_semanales_caja%rowtype;
begin
  if (select auth.uid()) is null then raise exception 'Debes iniciar sesión'; end if;
  select * into v_actual from public.remanentes_semanales_caja where id=p_remanente_id for update;
  if not found then raise exception 'No se encontró el remanente semanal'; end if;
  if not private.has_org_role(v_actual.organization_id,array['owner','director','admin','finanzas']::text[]) then
    raise exception 'Tu perfil no puede revisar remanentes semanales';
  end if;
  perform 1 from public.branches where id=v_actual.branch_id for update;
  if p_estado not in ('COMPROBADO','DIFERENCIA') then raise exception 'Estado de revisión no válido'; end if;
  if length(trim(coalesce(p_nota,''))) not between 5 and 1000 then raise exception 'Explica la revisión en al menos 5 caracteres'; end if;
  select coalesce(max(version),0) into v_version from public.remanentes_semanales_caja
  where branch_id=v_actual.branch_id and caja_id=v_actual.caja_id and semana_inicio=v_actual.semana_inicio;
  if p_version is null or p_version<>v_version or v_actual.version<>v_version or v_actual.estado<>'REPORTADO' then
    raise exception 'El remanente cambió o ya fue revisado. Actualiza antes de continuar';
  end if;
  if p_estado='COMPROBADO' and abs(v_actual.diferencia_sicar)>0.009 then
    raise exception 'No se puede comprobar: el conteo físico difiere del corte SICAR';
  end if;
  if p_estado='DIFERENCIA' and abs(v_actual.diferencia_sicar)<=0.009 then
    raise exception 'No hay diferencia de conteo que justifique ese estado';
  end if;
  select nombre into v_nombre from public.usuarios
  where auth_user_id=(select auth.uid()) and active=true and organization_id=v_actual.organization_id limit 1;
  insert into public.remanentes_semanales_caja (
    organization_id,business_id,branch_id,importacion_id,importacion_detalle_id,semana_inicio,semana_fin,caja_id,version,
    efectivo_sicar,efectivo_contado,fondo_fijo,monto_resguardado,destino,referencia,evidencia_path,observaciones,nota_revision,
    estado,registrado_por,registrado_nombre,verificado_por,verificado_nombre,verificado_en
  ) values (
    v_actual.organization_id,v_actual.business_id,v_actual.branch_id,v_actual.importacion_id,v_actual.importacion_detalle_id,v_actual.semana_inicio,v_actual.semana_fin,
    v_actual.caja_id,v_version+1,v_actual.efectivo_sicar,v_actual.efectivo_contado,v_actual.fondo_fijo,
    v_actual.monto_resguardado,v_actual.destino,v_actual.referencia,v_actual.evidencia_path,v_actual.observaciones,trim(p_nota),p_estado,
    v_actual.registrado_por,v_actual.registrado_nombre,(select auth.uid()),coalesce(v_nombre,'Dirección'),now()
  ) returning * into v_evento;
  return to_jsonb(v_evento);
end;
$$;

revoke all on function public.obtener_remanentes_semanales_caja(uuid,date) from public;
revoke all on function public.registrar_remanente_semanal_caja(uuid,uuid,uuid,date,date,text,uuid,uuid,integer,numeric,numeric,numeric,numeric,text,text,text,text) from public;
revoke all on function public.revisar_remanente_semanal_caja(uuid,integer,text,text) from public;
grant execute on function public.obtener_remanentes_semanales_caja(uuid,date) to authenticated;
grant execute on function public.registrar_remanente_semanal_caja(uuid,uuid,uuid,date,date,text,uuid,uuid,integer,numeric,numeric,numeric,numeric,text,text,text,text) to authenticated;
grant execute on function public.revisar_remanente_semanal_caja(uuid,integer,text,text) to authenticated;

commit;
