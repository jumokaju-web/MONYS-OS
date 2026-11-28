-- Calendario operativo de sucursales (autorizado para PREPARAR por la
-- propietaria el 27-nov-2026; NO aplicar sin su autorización).
--
-- Dos niveles:
-- 1. sucursal_vigencias: periodos en que una sucursal opera (apertura,
--    cierre definitivo, reapertura). Fuera de un periodo, la sucursal no
--    debe tener ventas y su ausencia no es dato faltante.
-- 2. sucursal_calendario: excepciones por día local (America/Mexico_City):
--    cerrado, horario reducido o abierto con minutos programados/reales.
--    Un día sin registro NO se asume abierto ni cerrado: es desconocido.
--
-- Un cierre no elimina gastos: solo cambia la productividad esperada.
-- Todo cambio queda en sucursal_calendario_auditoria.

begin;

create table if not exists public.sucursal_vigencias (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  business_id uuid not null references public.businesses(id) on delete restrict,
  branch_id uuid not null references public.branches(id) on delete restrict,
  operando_desde date not null,
  operando_hasta date,                       -- inclusivo; null = sigue operando
  motivo text,
  confirmado_por uuid,
  confirmado_en timestamptz,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint sucursal_vigencias_rango check (operando_hasta is null or operando_hasta >= operando_desde),
  constraint sucursal_vigencias_confirmacion check ((confirmado_por is null) = (confirmado_en is null))
);
create index if not exists sucursal_vigencias_branch_idx on public.sucursal_vigencias (branch_id, operando_desde);

create table if not exists public.sucursal_calendario (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  business_id uuid not null references public.businesses(id) on delete restrict,
  branch_id uuid not null references public.branches(id) on delete restrict,
  fecha date not null,                       -- fecha local (America/Mexico_City)
  estado text not null,
  minutos_programados integer,
  minutos_reales integer,
  motivo text,
  confirmado_por uuid,
  confirmado_en timestamptz,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint sucursal_calendario_unico unique (branch_id, fecha),
  constraint sucursal_calendario_estado check (estado in ('abierto', 'cerrado', 'horario_reducido')),
  constraint sucursal_calendario_minutos check (
    (minutos_programados is null or minutos_programados between 0 and 1440)
    and (minutos_reales is null or minutos_reales between 0 and 1440)
  ),
  constraint sucursal_calendario_cerrado check (estado <> 'cerrado' or coalesce(minutos_reales, 0) = 0),
  constraint sucursal_calendario_motivo check (estado = 'abierto' or length(trim(coalesce(motivo, ''))) > 0),
  constraint sucursal_calendario_confirmacion check ((confirmado_por is null) = (confirmado_en is null))
);
create index if not exists sucursal_calendario_negocio_fecha_idx on public.sucursal_calendario (business_id, fecha);

create table if not exists public.sucursal_calendario_auditoria (
  id bigint generated always as identity primary key,
  organization_id uuid not null,
  tabla text not null,
  registro_id uuid not null,
  accion text not null,
  antes jsonb,
  despues jsonb,
  usuario uuid,
  registrado_en timestamptz not null default now()
);
create index if not exists sucursal_calendario_auditoria_registro_idx on public.sucursal_calendario_auditoria (registro_id, registrado_en);

-- Coherencia organización → negocio → sucursal, sin vigencias encimadas y
-- confirmación solo por quien está autenticado.
create or replace function private.validar_calendario_sucursal()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  org_negocio uuid;
  negocio_sucursal uuid;
begin
  select organization_id into org_negocio from public.businesses where id = new.business_id;
  if org_negocio is null or org_negocio <> new.organization_id then
    raise exception 'El negocio no pertenece a la organización';
  end if;
  select business_id into negocio_sucursal from public.branches where id = new.branch_id;
  if negocio_sucursal is null or negocio_sucursal <> new.business_id then
    raise exception 'La sucursal no pertenece al negocio';
  end if;
  if new.confirmado_por is not null and new.confirmado_por is distinct from auth.uid()
     and (tg_op = 'INSERT' or new.confirmado_por is distinct from old.confirmado_por) then
    raise exception 'Solo la persona autenticada puede confirmar';
  end if;
  if tg_table_name = 'sucursal_vigencias' then
    -- (anidado: new.operando_desde solo existe en sucursal_vigencias)
    if exists (
      select 1 from public.sucursal_vigencias v
      where v.branch_id = (to_jsonb(new)->>'branch_id')::uuid and v.id <> new.id
        and daterange(v.operando_desde, coalesce(v.operando_hasta, 'infinity'::date), '[]')
            && daterange((to_jsonb(new)->>'operando_desde')::date, coalesce((to_jsonb(new)->>'operando_hasta')::date, 'infinity'::date), '[]')
    ) then
      raise exception 'La vigencia se encima con otra de la misma sucursal';
    end if;
  end if;
  new.updated_at := now();
  return new;
end;
$$;

create or replace function private.auditar_calendario_sucursal()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.sucursal_calendario_auditoria (organization_id, tabla, registro_id, accion, antes, despues, usuario)
  values (
    coalesce(new.organization_id, old.organization_id), tg_table_name, coalesce(new.id, old.id), lower(tg_op),
    case when tg_op = 'INSERT' then null else to_jsonb(old) end,
    case when tg_op = 'DELETE' then null else to_jsonb(new) end,
    auth.uid()
  );
  return coalesce(new, old);
end;
$$;

do $$
declare
  t text;
begin
  foreach t in array array['sucursal_vigencias', 'sucursal_calendario'] loop
    execute format('drop trigger if exists %I on public.%I', t || '_validar', t);
    execute format('create trigger %I before insert or update on public.%I for each row execute function private.validar_calendario_sucursal()', t || '_validar', t);
    execute format('drop trigger if exists %I on public.%I', t || '_auditar', t);
    execute format('create trigger %I after insert or update or delete on public.%I for each row execute function private.auditar_calendario_sucursal()', t || '_auditar', t);

    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists %I on public.%I', t || '_leer', t);
    execute format('create policy %I on public.%I for select to authenticated using (private.has_org_role(organization_id, array[''owner'',''director'',''admin'',''finanzas'',''gerente'']::text[]))', t || '_leer', t);
    execute format('drop policy if exists %I on public.%I', t || '_escribir', t);
    execute format('create policy %I on public.%I for all to authenticated using (private.has_org_role(organization_id, array[''owner'',''director'',''admin'']::text[])) with check (private.has_org_role(organization_id, array[''owner'',''director'',''admin'']::text[]))', t || '_escribir', t);
  end loop;
end;
$$;

alter table public.sucursal_calendario_auditoria enable row level security;
drop policy if exists sucursal_calendario_auditoria_leer on public.sucursal_calendario_auditoria;
create policy sucursal_calendario_auditoria_leer on public.sucursal_calendario_auditoria
  for select to authenticated using (private.has_org_role(organization_id, array['owner','director','admin']::text[]));
-- La auditoría solo la escribe el trigger: nadie la edita ni la borra.
revoke insert, update, delete on public.sucursal_calendario_auditoria from authenticated, anon;

revoke all on function private.validar_calendario_sucursal() from public, anon, authenticated;
revoke all on function private.auditar_calendario_sucursal() from public, anon, authenticated;

commit;
