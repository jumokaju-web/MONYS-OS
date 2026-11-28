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
  publicacion text,
  titulo text,
  sku text,
  cantidad numeric(12,2) not null check (cantidad > 0),
  precio_unit numeric(14,2) not null check (precio_unit >= 0),
  comision numeric(14,2) check (comision is null or comision >= 0),
  unique (orden_id, publicacion, sku)
);

create table if not exists public.canal_publicaciones (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  business_id uuid not null references public.businesses(id),
  cuenta_id uuid not null references public.canal_cuentas(id),
  canal text not null check (canal in ('mercado_libre', 'tiktok_shop')),
  publicacion text not null,
  titulo text,
  sku text,
  codigo_barras text,
  estado text,
  precio numeric(14,2),
  existencia integer,
  vendidas integer,
  sincronizado_en timestamptz not null default now(),
  unique (business_id, canal, publicacion)
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

-- Tokens de las plataformas en Supabase Vault (cifrados). Solo la Edge
-- Function (service_role) puede leerlos o rotarlos. Se crean solo si la
-- base tiene Vault (Supabase lo trae).
do $do$
begin
  if exists (select 1 from pg_namespace where nspname = 'vault') then
    execute $f$
      create or replace function public.leer_token_canal(p_cuenta_id uuid)
      returns text language sql security definer set search_path = '' as $$
        select decrypted_secret from vault.decrypted_secrets
        where name = 'canal_token_' || p_cuenta_id::text
      $$;
    $f$;
    execute $f$
      create or replace function public.guardar_token_canal(p_cuenta_id uuid, p_token text)
      returns void language plpgsql security definer set search_path = '' as $$
      declare
        existente uuid;
      begin
        select id into existente from vault.secrets where name = 'canal_token_' || p_cuenta_id::text;
        if existente is null then
          perform vault.create_secret(p_token, 'canal_token_' || p_cuenta_id::text, 'Refresh token de canal (solo lectura)');
        else
          perform vault.update_secret(existente, p_token);
        end if;
      end;
      $$;
    $f$;
    execute 'revoke all on function public.leer_token_canal(uuid) from public, anon, authenticated';
    execute 'revoke all on function public.guardar_token_canal(uuid, text) from public, anon, authenticated';
    execute 'grant execute on function public.leer_token_canal(uuid) to service_role';
    execute 'grant execute on function public.guardar_token_canal(uuid, text) to service_role';
  end if;
end;
$do$;
