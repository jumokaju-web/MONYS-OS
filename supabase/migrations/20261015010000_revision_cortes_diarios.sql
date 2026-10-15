begin;

-- Append-only: a review never changes the original employee submission.
create table public.revisiones_cortes_diarios (
  id uuid primary key default gen_random_uuid(),
  cierre_id uuid not null references public.cierres_turno(id) on delete restrict,
  organization_id uuid not null references public.organizations(id),
  business_id uuid not null references public.businesses(id),
  branch_id uuid not null references public.branches(id),
  version integer not null check (version > 0),
  estado text not null check (estado in ('ACLARAR', 'REVISADO')),
  nota text not null check (length(trim(nota)) between 10 and 2000),
  evidencia text not null check (length(trim(evidencia)) between 3 and 500),
  comprobaciones jsonb not null,
  snapshot_observaciones text not null,
  revisado_nombre text not null,
  revisado_por uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  unique (cierre_id, version)
);
create index revisiones_cortes_contexto_idx on public.revisiones_cortes_diarios (organization_id,business_id,cierre_id,version desc);
alter table public.revisiones_cortes_diarios enable row level security;
revoke all on public.revisiones_cortes_diarios from anon, authenticated;
grant select on public.revisiones_cortes_diarios to authenticated;
create policy revisiones_cortes_owner_select on public.revisiones_cortes_diarios
for select to authenticated using (exists (
  select 1 from public.usuarios u where u.auth_user_id=(select auth.uid())
    and u.active=true and u.role='owner'
    and u.organization_id=revisiones_cortes_diarios.organization_id
    and u.business_id=revisiones_cortes_diarios.business_id
));

create function public.registrar_revision_corte_diario(
  p_cierre_id uuid, p_version integer, p_observaciones text,
  p_estado text, p_nota text, p_evidencia text, p_comprobaciones jsonb
) returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare
  v_cierre public.cierres_turno%rowtype;
  v_org uuid; v_negocio uuid; v_version integer; v_evento public.revisiones_cortes_diarios%rowtype; v_nombre text; v_datos jsonb;
begin
  select * into v_cierre from public.cierres_turno where id=p_cierre_id for update;
  if not found then raise exception 'No se encontró el corte'; end if;
  select b.organization_id,b.id into v_org,v_negocio from public.branches s
    join public.businesses b on b.id=s.business_id where s.id=v_cierre.branch_id;
  select u.nombre into v_nombre from public.usuarios u where u.auth_user_id=auth.uid()
    and u.active=true and u.role='owner' and u.organization_id=v_org and u.business_id=v_negocio limit 1;
  if v_org is null or not found then raise exception 'Solo la propietaria del negocio puede revisar este corte'; end if;
  if v_cierre.observaciones is distinct from p_observaciones then
    raise exception 'El corte cambió. Actualiza y vuelve a revisar antes de guardar';
  end if;
  if position('[MONYS_CAJA_V1]' in coalesce(v_cierre.observaciones,'')) <> 1 then
    raise exception 'Esta revisión solo acepta cortes de tienda con el formato vigente';
  end if;
  select coalesce(max(version),0) into v_version from public.revisiones_cortes_diarios where cierre_id=p_cierre_id;
  if p_version is null or v_version<>p_version then
    raise exception 'Otra persona actualizó la revisión. Actualiza antes de guardar';
  end if;
  if p_estado is null or p_estado not in ('ACLARAR','REVISADO') then raise exception 'Estado de revisión no válido'; end if;
  if length(trim(coalesce(p_nota,''))) not between 10 and 2000 then raise exception 'Escribe una explicación de 10 a 2000 caracteres'; end if;
  if length(trim(coalesce(p_evidencia,''))) not between 3 and 500 then raise exception 'Indica el comprobante o referencia de evidencia'; end if;
  if p_comprobaciones is null or jsonb_typeof(p_comprobaciones)<>'object' then raise exception 'Revisa las comprobaciones'; end if;
  if p_estado='REVISADO' then
    v_datos := substring(split_part(v_cierre.observaciones,E'\n',1) from length('[MONYS_CAJA_V1]')+1)::jsonb;
    if jsonb_typeof(v_datos->'diferenciaCaja') is distinct from 'number' or jsonb_typeof(v_datos->'diferenciaVenta') is distinct from 'number' then
      raise exception 'Completa las diferencias de caja y venta antes de marcar revisado';
    end if;
  end if;
  if p_estado='REVISADO' and not (
    p_comprobaciones @> '{"sicar":true,"cobros":true,"movimientos":true}'::jsonb
  ) then raise exception 'Comprueba SICAR, cobros y movimientos antes de marcar revisado'; end if;
  insert into public.revisiones_cortes_diarios (
    cierre_id,organization_id,business_id,branch_id,version,estado,nota,evidencia,
    comprobaciones,snapshot_observaciones,revisado_nombre,revisado_por
  ) values (p_cierre_id,v_org,v_negocio,v_cierre.branch_id,v_version+1,p_estado,trim(p_nota),trim(p_evidencia),
    p_comprobaciones,v_cierre.observaciones,coalesce(v_nombre,'Propietaria'),auth.uid()) returning * into v_evento;
  return to_jsonb(v_evento);
end;
$$;

-- Latest review for only the submissions visible in the inbox; RLS applies.
create function public.obtener_revisiones_cortes_diarios(p_cierre_ids uuid[])
returns setof public.revisiones_cortes_diarios language sql stable security invoker set search_path=public,pg_temp as $$
  select distinct on (cierre_id) * from public.revisiones_cortes_diarios
  where cierre_id=any(p_cierre_ids) and cardinality(p_cierre_ids)<=100
  order by cierre_id,version desc;
$$;
revoke all on function public.registrar_revision_corte_diario(uuid,integer,text,text,text,text,jsonb) from public;
revoke all on function public.obtener_revisiones_cortes_diarios(uuid[]) from public;
grant execute on function public.registrar_revision_corte_diario(uuid,integer,text,text,text,text,jsonb) to authenticated;
grant execute on function public.obtener_revisiones_cortes_diarios(uuid[]) to authenticated;
commit;
