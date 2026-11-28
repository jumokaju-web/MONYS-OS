-- Canales de venta (Mercado Libre, TikTok Shop) de Monys Glam.
-- Autorizado por la propietaria para PREPARAR; aplicar solo tras revisión.
-- Aditiva: crea tablas nuevas; no toca datos existentes.
--
-- Escritura: solo la Edge Function `sincronizar-canales` (service_role).
-- Lectura: owner, director, admin y finanzas de la organización (RLS).
-- Vínculos con SICAR: los confirma una persona (owner/director/admin).
-- Idempotencia: unique (business_id, canal, external_id) + upsert.
-- Tokens OAuth: NO se guardan aquí; van en Supabase Vault.

begin;

create table if not exists public.canal_cuentas (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  business_id uuid not null references public.businesses(id),
  canal text not null check (canal in ('mercado_libre', 'tiktok_shop')),
  cuenta_externa text not null check (length(trim(cuenta_externa)) between 1 and 80),
  nombre text,
  estado text not null default 'PENDIENTE_AUTORIZACION'
    check (estado in ('PENDIENTE_AUTORIZACION', 'ACTIVA', 'ERROR', 'DESCONECTADA')),
  ultimo_sync timestamptz,
  ultimo_error text check (ultimo_error is null or length(ultimo_error) <= 1000),
  intentos_fallidos integer not null default 0 check (intentos_fallidos >= 0),
  proximo_intento timestamptz,          -- reintento automático (backoff)
  sync_en_curso_hasta timestamptz,      -- turno exclusivo (evita corridas simultáneas)
  sync_ejecucion_id uuid,               -- dueño del turno: solo esa corrida lo libera
  cobertura jsonb,                      -- qué trajo cada fuente en la última corrida
  created_at timestamptz not null default now(),
  unique (canal, cuenta_externa)
);

create table if not exists public.canal_ordenes (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  business_id uuid not null references public.businesses(id),
  cuenta_id uuid not null references public.canal_cuentas(id),
  canal text not null check (canal in ('mercado_libre', 'tiktok_shop')),
  external_id text not null,
  fecha timestamptz not null,
  estado text not null check (estado in ('paid', 'cancelled', 'pending', 'other')),
  motivo_cancelacion text,
  total numeric(14,2) not null check (total >= 0),
  comision numeric(14,2) check (comision is null or comision >= 0),
  envio_vendedor numeric(14,2) check (envio_vendedor is null or envio_vendedor >= 0), -- null = desconocido
  envio_estado text,
  fecha_liberacion timestamptz,
  -- Confirmado por la propietaria: las ventas de canales no se registran en SICAR.
  registrado_en_sicar boolean not null default false,
  datos_origen jsonb not null default '{}'::jsonb,
  sincronizado_en timestamptz not null default now(),
  unique (business_id, canal, external_id)
);

create table if not exists public.canal_orden_items (
  id uuid primary key default gen_random_uuid(),
  orden_id uuid not null references public.canal_ordenes(id) on delete cascade,
  publicacion text not null default '',
  variacion text not null default '',   -- tono/color: evita colisiones de variantes
  titulo text,
  sku text not null default '',         -- '' = sin SKU (no null, para que la llave sea única)
  cantidad numeric(12,2) not null check (cantidad > 0),
  precio_unit numeric(14,2) not null check (precio_unit >= 0),
  comision numeric(14,2) check (comision is null or comision >= 0),
  unique (orden_id, publicacion, variacion, sku)
);

create table if not exists public.canal_publicaciones (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  business_id uuid not null references public.businesses(id),
  cuenta_id uuid not null references public.canal_cuentas(id),
  canal text not null check (canal in ('mercado_libre', 'tiktok_shop')),
  publicacion text not null,
  variacion text not null default '',
  titulo text,
  sku text,
  codigo_barras text,
  estado text,                          -- 'no_encontrada' si desapareció en un barrido completo
  precio numeric(14,2),
  existencia integer,
  vendidas integer,
  sincronizado_en timestamptz not null default now(),
  unique (business_id, canal, publicacion, variacion)
);

create table if not exists public.canal_liquidaciones (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  business_id uuid not null references public.businesses(id),
  cuenta_id uuid not null references public.canal_cuentas(id),
  canal text not null check (canal in ('mercado_libre', 'tiktok_shop')),
  external_id text not null,
  fecha timestamptz not null,
  monto_bruto numeric(14,2),
  comisiones numeric(14,2),
  envios numeric(14,2),
  retenciones numeric(14,2),
  devoluciones numeric(14,2),
  monto_neto numeric(14,2),
  estado text,
  datos_origen jsonb not null default '{}'::jsonb,
  unique (business_id, canal, external_id)
);

create table if not exists public.canal_devoluciones (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  business_id uuid not null references public.businesses(id),
  canal text not null check (canal in ('mercado_libre', 'tiktok_shop')),
  external_id text not null,
  orden_external_id text,
  fecha timestamptz not null,
  estado text,
  monto numeric(14,2),
  afecta_reputacion text,
  motivo text,
  unique (business_id, canal, external_id)
);

-- Vínculo confirmado por una persona entre publicación y producto SICAR.
create table if not exists public.producto_vinculos (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  business_id uuid not null references public.businesses(id),
  canal text not null check (canal in ('mercado_libre', 'tiktok_shop')),
  publicacion text not null,
  codigo_sicar text not null check (length(trim(codigo_sicar)) between 1 and 80),
  confirmado_por uuid not null default auth.uid() references auth.users(id),
  confirmado_en timestamptz not null default now(),
  unique (business_id, canal, publicacion)
);

create index if not exists canal_ordenes_negocio_fecha_idx on public.canal_ordenes (business_id, canal, fecha desc);
create index if not exists canal_liquidaciones_negocio_fecha_idx on public.canal_liquidaciones (business_id, canal, fecha desc);

-- RLS: lectura por rol de la organización; escritura solo service_role
-- (la Edge Function), salvo producto_vinculos.
do $$
declare
  tabla text;
begin
  foreach tabla in array array['canal_cuentas','canal_ordenes','canal_publicaciones','canal_liquidaciones','canal_devoluciones','producto_vinculos'] loop
    execute format('alter table public.%I enable row level security', tabla);
    execute format('revoke all on public.%I from anon, authenticated', tabla);
    execute format('grant select on public.%I to authenticated', tabla);
    execute format('drop policy if exists %I on public.%I', tabla || '_lectura', tabla);
    execute format(
      'create policy %I on public.%I for select to authenticated using (private.has_org_role(organization_id, array[''owner'',''director'',''admin'',''finanzas'']::text[]))',
      tabla || '_lectura', tabla
    );
  end loop;
end;
$$;

alter table public.canal_orden_items enable row level security;
revoke all on public.canal_orden_items from anon, authenticated;
grant select on public.canal_orden_items to authenticated;
drop policy if exists canal_orden_items_lectura on public.canal_orden_items;
create policy canal_orden_items_lectura on public.canal_orden_items for select to authenticated
using (exists (
  select 1 from public.canal_ordenes orden
  where orden.id = canal_orden_items.orden_id
    and private.has_org_role(orden.organization_id, array['owner','director','admin','finanzas']::text[])
));

grant insert, update on public.producto_vinculos to authenticated;
drop policy if exists producto_vinculos_confirmar on public.producto_vinculos;
create policy producto_vinculos_confirmar on public.producto_vinculos for insert to authenticated
with check (
  private.has_org_role(organization_id, array['owner','director','admin']::text[])
  and confirmado_por = (select auth.uid())
);
drop policy if exists producto_vinculos_corregir on public.producto_vinculos;
create policy producto_vinculos_corregir on public.producto_vinculos for update to authenticated
using (private.has_org_role(organization_id, array['owner','director','admin']::text[]))
with check (private.has_org_role(organization_id, array['owner','director','admin']::text[]) and confirmado_por = (select auth.uid()));

commit;

-- Turno exclusivo por cuenta: solo una sincronización a la vez. Lo usa
-- únicamente la Edge Function (service_role).
-- Por si una versión previa de esta migración ya creó la tabla o las
-- funciones sin identificador de ejecución.
alter table public.canal_cuentas add column if not exists sync_ejecucion_id uuid;
drop function if exists public.tomar_turno_canal(uuid, integer);
drop function if exists public.liberar_turno_canal(uuid);

-- Cada corrida tiene un identificador propio (p_ejecucion). Una corrida
-- cuyo turno venció no puede liberar ni cerrar el turno de otra.
create or replace function public.tomar_turno_canal(p_cuenta_id uuid, p_minutos integer, p_ejecucion uuid)
returns boolean language plpgsql security definer set search_path = '' as $$
declare
  tomado uuid;
begin
  if p_minutos is null or p_minutos < 1 or p_minutos > 60 then
    raise exception 'Duración de turno inválida';
  end if;
  if p_ejecucion is null then
    raise exception 'Falta el identificador de ejecución';
  end if;
  update public.canal_cuentas
  set sync_en_curso_hasta = now() + make_interval(mins => p_minutos),
      sync_ejecucion_id = p_ejecucion
  where id = p_cuenta_id
    and (sync_en_curso_hasta is null or sync_en_curso_hasta < now())
  returning id into tomado;
  return tomado is not null;
end;
$$;

create or replace function public.liberar_turno_canal(p_cuenta_id uuid, p_ejecucion uuid)
returns boolean language plpgsql security definer set search_path = '' as $$
declare
  liberado uuid;
begin
  update public.canal_cuentas
  set sync_en_curso_hasta = null, sync_ejecucion_id = null
  where id = p_cuenta_id and sync_ejecucion_id = p_ejecucion
  returning id into liberado;
  return liberado is not null;
end;
$$;

-- Extiende el turno solo si sigue siendo de esta ejecución y no ha vencido.
-- La Edge Function lo llama antes de rotar credenciales y antes de cada
-- lote de escritura: una corrida vencida se detiene sin escribir.
create or replace function public.renovar_turno_canal(p_cuenta_id uuid, p_ejecucion uuid, p_minutos integer)
returns boolean language plpgsql security definer set search_path = '' as $$
declare
  renovado uuid;
begin
  if p_minutos is null or p_minutos < 1 or p_minutos > 60 then
    raise exception 'Duración de turno inválida';
  end if;
  update public.canal_cuentas
  set sync_en_curso_hasta = now() + make_interval(mins => p_minutos)
  where id = p_cuenta_id and sync_ejecucion_id = p_ejecucion and sync_en_curso_hasta >= now()
  returning id into renovado;
  return renovado is not null;
end;
$$;

revoke all on function public.renovar_turno_canal(uuid, uuid, integer) from public, anon, authenticated;
revoke all on function public.tomar_turno_canal(uuid, integer, uuid) from public, anon, authenticated;
revoke all on function public.liberar_turno_canal(uuid, uuid) from public, anon, authenticated;
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'service_role') then
    execute 'grant execute on function public.tomar_turno_canal(uuid, integer, uuid) to service_role';
    execute 'grant execute on function public.liberar_turno_canal(uuid, uuid) to service_role';
    execute 'grant execute on function public.renovar_turno_canal(uuid, uuid, integer) to service_role';
  end if;
end;
$$;

-- Credenciales de las plataformas (JSON: access/refresh token, vencimientos,
-- shop_cipher) cifradas en Supabase Vault. Solo service_role puede leerlas o
-- rotarlas, y solo para cuentas registradas en canal_cuentas.
do $do$
begin
  if exists (select 1 from pg_namespace where nspname = 'vault') then
    execute $f$
      create or replace function public.leer_credencial_canal(p_cuenta_id uuid)
      returns text language plpgsql security definer set search_path = '' as $$
      begin
        if not exists (select 1 from public.canal_cuentas where id = p_cuenta_id) then
          raise exception 'Cuenta de canal inexistente';
        end if;
        return (select decrypted_secret from vault.decrypted_secrets where name = 'canal_credencial_' || p_cuenta_id::text);
      end;
      $$;
    $f$;
    execute 'drop function if exists public.guardar_credencial_canal(uuid, text)';
    -- p_ejecucion: la corrida que rota la credencial debe tener el turno
    -- vigente (la fila queda bloqueada mientras se escribe). Sin ejecución
    -- (alta inicial por OAuth) solo se permite si no hay turno activo.
    execute $f$
      create or replace function public.guardar_credencial_canal(p_cuenta_id uuid, p_credencial text, p_ejecucion uuid)
      returns void language plpgsql security definer set search_path = '' as $$
      declare
        existente uuid;
        datos jsonb;
        cuenta record;
      begin
        select sync_ejecucion_id, sync_en_curso_hasta into cuenta
        from public.canal_cuentas where id = p_cuenta_id for update;
        if not found then
          raise exception 'Cuenta de canal inexistente';
        end if;
        if p_ejecucion is null then
          if cuenta.sync_en_curso_hasta is not null and cuenta.sync_en_curso_hasta >= now() then
            raise exception 'Hay una sincronización en curso: no se reemplaza la credencial';
          end if;
        elsif cuenta.sync_ejecucion_id is distinct from p_ejecucion or cuenta.sync_en_curso_hasta is null or cuenta.sync_en_curso_hasta < now() then
          raise exception 'Turno vencido o ajeno: no se guarda la credencial';
        end if;
        datos := p_credencial::jsonb;  -- debe ser JSON válido
        if coalesce(datos->>'access_token', '') = '' or coalesce(datos->>'refresh_token', '') = '' then
          raise exception 'Credencial incompleta: no se reemplaza la anterior';
        end if;
        select id into existente from vault.secrets where name = 'canal_credencial_' || p_cuenta_id::text;
        if existente is null then
          perform vault.create_secret(p_credencial, 'canal_credencial_' || p_cuenta_id::text, 'Credencial de canal (solo lectura)');
        else
          perform vault.update_secret(existente, p_credencial);
        end if;
      end;
      $$;
    $f$;
    execute 'revoke all on function public.leer_credencial_canal(uuid) from public, anon, authenticated';
    execute 'revoke all on function public.guardar_credencial_canal(uuid, text, uuid) from public, anon, authenticated';
    if exists (select 1 from pg_roles where rolname = 'service_role') then
      execute 'grant execute on function public.leer_credencial_canal(uuid) to service_role';
      execute 'grant execute on function public.guardar_credencial_canal(uuid, text, uuid) to service_role';
    end if;
  end if;
end;
$do$;
