begin;

-- Bitácora append-only: reportar evidencia nunca equivale a comprobarla.
create table public.comprobaciones_retiros_efectivo (
  id uuid primary key default gen_random_uuid(),
  cierre_id uuid not null references public.cierres_turno(id) on delete restrict,
  organization_id uuid not null references public.organizations(id),
  business_id uuid not null references public.businesses(id),
  branch_id uuid not null references public.branches(id),
  caja_id text not null check (length(trim(caja_id)) between 1 and 40),
  version integer not null check (version > 0),
  estado text not null check (estado in ('REPORTADO','COMPROBADO','DIFERENCIA')),
  monto_retirado numeric(14,2) not null check (monto_retirado > 0),
  destino_declarado text,
  destino_real text not null check (length(trim(destino_real)) between 2 and 200),
  referencia text not null check (length(trim(referencia)) between 2 and 200),
  evidencia_path text not null check (length(trim(evidencia_path)) between 3 and 500),
  nota_revision text,
  snapshot_observaciones text not null,
  registrado_por uuid not null references auth.users(id),
  registrado_nombre text not null,
  verificado_por uuid references auth.users(id),
  verificado_nombre text,
  verificado_en timestamptz,
  created_at timestamptz not null default now(),
  unique (cierre_id, caja_id, version),
  check ((estado='REPORTADO' and verificado_por is null and verificado_en is null)
    or (estado in ('COMPROBADO','DIFERENCIA') and verificado_por is not null and verificado_en is not null)),
  check (nota_revision is null or length(trim(nota_revision)) between 5 and 1000)
);

create index comprobaciones_retiros_contexto_idx
  on public.comprobaciones_retiros_efectivo (organization_id,business_id,branch_id,created_at desc);
create index comprobaciones_retiros_ultimo_idx
  on public.comprobaciones_retiros_efectivo (cierre_id,caja_id,version desc);

alter table public.comprobaciones_retiros_efectivo enable row level security;
revoke all on public.comprobaciones_retiros_efectivo from anon, authenticated;
grant select on public.comprobaciones_retiros_efectivo to authenticated;

create policy comprobaciones_retiros_direccion_select
on public.comprobaciones_retiros_efectivo for select to authenticated
using (private.has_org_role(organization_id,array['owner','director','admin','finanzas']::text[]));

-- El bucket ya es privado. Se corrige la lectura directiva anterior para que
-- un perfil financiero no pueda abrir comprobantes de otra organización.
drop policy if exists tesoreria_directivos_ver_comprobantes on storage.objects;
create policy tesoreria_directivos_ver_comprobantes
on storage.objects for select to authenticated
using (
  bucket_id='tesoreria-comprobantes'
  and (
    exists (
      select 1 from public.cash_movements movimiento
      where movimiento.receipt_url=storage.objects.name
        and private.has_org_role(movimiento.organization_id,array['owner','director','admin','finanzas']::text[])
    )
    or exists (
      select 1 from public.comprobaciones_retiros_efectivo comprobacion
      where comprobacion.evidencia_path=storage.objects.name
        and private.has_org_role(comprobacion.organization_id,array['owner','director','admin','finanzas']::text[])
    )
  )
);

create function public.registrar_comprobacion_retiro_efectivo(
  p_cierre_id uuid,
  p_caja_id text,
  p_version integer,
  p_monto numeric,
  p_destino_real text,
  p_referencia text,
  p_evidencia_path text
) returns jsonb
language plpgsql security definer set search_path=''
as $$
declare
  v_cierre public.cierres_turno%rowtype;
  v_org uuid; v_negocio uuid; v_version integer; v_nombre text; v_datos jsonb;
  v_evento public.comprobaciones_retiros_efectivo%rowtype;
begin
  if (select auth.uid()) is null then raise exception 'Debes iniciar sesión'; end if;
  select * into v_cierre from public.cierres_turno where id=p_cierre_id for update;
  if not found then raise exception 'No se encontró el cierre del retiro'; end if;

  select b.organization_id,b.id into v_org,v_negocio
  from public.branches s join public.businesses b on b.id=s.business_id
  where s.id=v_cierre.branch_id;
  if not private.has_org_role(v_org,array['owner','director','admin','finanzas']::text[]) then
    raise exception 'Tu perfil no puede comprobar retiros';
  end if;
  select nombre into v_nombre from public.usuarios
  where auth_user_id=(select auth.uid()) and active=true and organization_id=v_org limit 1;

  if position('[MONYS_CAJA_V1]' in coalesce(v_cierre.observaciones,'')) <> 1 then
    raise exception 'Este retiro no tiene un cierre individual compatible';
  end if;
  begin
    v_datos := substring(split_part(v_cierre.observaciones,E'\n',1) from length('[MONYS_CAJA_V1]')+1)::jsonb;
  exception when others then
    raise exception 'No fue posible leer el cierre original';
  end;
  if trim(coalesce(p_caja_id,'')) is distinct from trim(coalesce(v_datos->>'cajaId','')) then
    raise exception 'La caja no coincide con el cierre original';
  end if;
  if p_monto is null or p_monto <= 0 or round(p_monto,2) <> p_monto then
    raise exception 'El importe retirado no es válido';
  end if;
  if abs(p_monto-coalesce(nullif(v_datos->>'efectivoEntregado','')::numeric,0)) > 0.009 then
    raise exception 'El importe cambió respecto del cierre. Actualiza antes de continuar';
  end if;
  if length(trim(coalesce(p_destino_real,''))) not between 2 and 200 then raise exception 'Indica el destino real'; end if;
  if length(trim(coalesce(p_referencia,''))) not between 2 and 200 then raise exception 'Indica una referencia'; end if;
  if length(trim(coalesce(p_evidencia_path,''))) not between 3 and 500 then raise exception 'Adjunta un comprobante'; end if;
  if split_part(p_evidencia_path,'/',1) is distinct from (select auth.uid())::text then
    raise exception 'El comprobante no pertenece a tu sesión';
  end if;

  select coalesce(max(version),0) into v_version
  from public.comprobaciones_retiros_efectivo where cierre_id=p_cierre_id and caja_id=trim(p_caja_id);
  if p_version is null or p_version<>v_version then raise exception 'La comprobación cambió. Actualiza antes de guardar'; end if;

  insert into public.comprobaciones_retiros_efectivo (
    cierre_id,organization_id,business_id,branch_id,caja_id,version,estado,monto_retirado,
    destino_declarado,destino_real,referencia,evidencia_path,snapshot_observaciones,
    registrado_por,registrado_nombre
  ) values (
    p_cierre_id,v_org,v_negocio,v_cierre.branch_id,trim(p_caja_id),v_version+1,'REPORTADO',p_monto,
    nullif(trim(v_datos->>'destinoEfectivoRetirado'),''),trim(p_destino_real),trim(p_referencia),
    trim(p_evidencia_path),v_cierre.observaciones,(select auth.uid()),coalesce(v_nombre,'Dirección')
  ) returning * into v_evento;
  return to_jsonb(v_evento);
end;
$$;

create function public.revisar_comprobacion_retiro_efectivo(
  p_comprobacion_id uuid,
  p_version integer,
  p_estado text,
  p_nota text
) returns jsonb
language plpgsql security definer set search_path=''
as $$
declare
  v_actual public.comprobaciones_retiros_efectivo%rowtype;
  v_version integer; v_nombre text; v_evento public.comprobaciones_retiros_efectivo%rowtype;
begin
  if (select auth.uid()) is null then raise exception 'Debes iniciar sesión'; end if;
  select * into v_actual from public.comprobaciones_retiros_efectivo where id=p_comprobacion_id;
  if not found then raise exception 'No se encontró la comprobación'; end if;
  if not private.has_org_role(v_actual.organization_id,array['owner','director','admin','finanzas']::text[]) then
    raise exception 'Tu perfil no puede revisar comprobantes';
  end if;
  if p_estado not in ('COMPROBADO','DIFERENCIA') then raise exception 'Estado de revisión no válido'; end if;
  if length(trim(coalesce(p_nota,''))) not between 5 and 1000 then raise exception 'Explica la revisión en al menos 5 caracteres'; end if;
  select coalesce(max(version),0) into v_version from public.comprobaciones_retiros_efectivo
  where cierre_id=v_actual.cierre_id and caja_id=v_actual.caja_id;
  if p_version is null or p_version<>v_version or v_actual.version<>v_version then
    raise exception 'La comprobación cambió. Actualiza antes de revisar';
  end if;
  select nombre into v_nombre from public.usuarios
  where auth_user_id=(select auth.uid()) and active=true and organization_id=v_actual.organization_id limit 1;
  insert into public.comprobaciones_retiros_efectivo (
    cierre_id,organization_id,business_id,branch_id,caja_id,version,estado,monto_retirado,
    destino_declarado,destino_real,referencia,evidencia_path,nota_revision,snapshot_observaciones,
    registrado_por,registrado_nombre,verificado_por,verificado_nombre,verificado_en
  ) values (
    v_actual.cierre_id,v_actual.organization_id,v_actual.business_id,v_actual.branch_id,v_actual.caja_id,
    v_version+1,p_estado,v_actual.monto_retirado,v_actual.destino_declarado,v_actual.destino_real,
    v_actual.referencia,v_actual.evidencia_path,trim(p_nota),v_actual.snapshot_observaciones,
    v_actual.registrado_por,v_actual.registrado_nombre,(select auth.uid()),coalesce(v_nombre,'Dirección'),now()
  ) returning * into v_evento;
  return to_jsonb(v_evento);
end;
$$;

create function public.obtener_comprobaciones_retiros_efectivo(p_cierre_ids uuid[])
returns setof public.comprobaciones_retiros_efectivo
language sql stable security invoker set search_path=''
as $$
  select distinct on (cierre_id,caja_id) *
  from public.comprobaciones_retiros_efectivo
  where cierre_id=any(p_cierre_ids) and cardinality(p_cierre_ids)<=100
  order by cierre_id,caja_id,version desc;
$$;

revoke all on function public.registrar_comprobacion_retiro_efectivo(uuid,text,integer,numeric,text,text,text) from public;
revoke all on function public.revisar_comprobacion_retiro_efectivo(uuid,integer,text,text) from public;
revoke all on function public.obtener_comprobaciones_retiros_efectivo(uuid[]) from public;
grant execute on function public.registrar_comprobacion_retiro_efectivo(uuid,text,integer,numeric,text,text,text) to authenticated;
grant execute on function public.revisar_comprobacion_retiro_efectivo(uuid,integer,text,text) to authenticated;
grant execute on function public.obtener_comprobaciones_retiros_efectivo(uuid[]) to authenticated;

commit;
