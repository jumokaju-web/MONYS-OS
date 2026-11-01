create table if not exists public.marketing_politicas_publicacion (
  organization_id uuid not null references public.organizations(id) on delete cascade,
  business_id uuid not null references public.businesses(id) on delete cascade,
  moneda text not null default 'MXN',
  publicar_organico_automatico boolean not null default false,
  publicar_pagado_automatico boolean not null default false,
  limite_por_campana numeric(14,2) not null default 0 check (limite_por_campana >= 0),
  limite_diario numeric(14,2) not null default 0 check (limite_diario >= 0),
  created_by uuid not null default auth.uid(),
  updated_at timestamptz not null default now(),
  primary key (organization_id, business_id),
  constraint marketing_politicas_moneda_check check (moneda in ('MXN', 'USD'))
);

alter table public.marketing_politicas_publicacion enable row level security;

create policy "Miembros consultan politicas de marketing"
on public.marketing_politicas_publicacion
for select to authenticated
using (
  exists (
    select 1 from public.organization_members miembro
    where miembro.organization_id = marketing_politicas_publicacion.organization_id
      and miembro.user_id = (select auth.uid())
      and miembro.active
  )
);

create policy "Direccion configura politicas de marketing"
on public.marketing_politicas_publicacion
for insert to authenticated
with check (
  created_by = (select auth.uid())
  and exists (
    select 1 from public.organization_members miembro
    where miembro.organization_id = marketing_politicas_publicacion.organization_id
      and miembro.user_id = (select auth.uid())
      and miembro.active
      and lower(miembro.role) in ('owner', 'admin')
  )
);

create policy "Direccion actualiza politicas de marketing"
on public.marketing_politicas_publicacion
for update to authenticated
using (
  exists (
    select 1 from public.organization_members miembro
    where miembro.organization_id = marketing_politicas_publicacion.organization_id
      and miembro.user_id = (select auth.uid())
      and miembro.active
      and lower(miembro.role) in ('owner', 'admin')
  )
)
with check (
  exists (
    select 1 from public.organization_members miembro
    where miembro.organization_id = marketing_politicas_publicacion.organization_id
      and miembro.user_id = (select auth.uid())
      and miembro.active
      and lower(miembro.role) in ('owner', 'admin')
  )
);

grant select, insert, update on public.marketing_politicas_publicacion to authenticated;

create table if not exists public.marketing_cuentas_canal (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  business_id uuid not null references public.businesses(id) on delete cascade,
  proveedor text not null,
  nombre_cuenta text null,
  external_account_id text null,
  estado text not null default 'PENDIENTE',
  capacidades text[] not null default '{}'::text[],
  permisos text[] not null default '{}'::text[],
  connected_by uuid null,
  ultima_sincronizacion timestamptz null,
  ultimo_error text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint marketing_cuentas_proveedor_check check (
    proveedor in ('META', 'TIKTOK', 'TIKTOK_SHOP', 'WHATSAPP', 'MERCADO_LIBRE')
  ),
  constraint marketing_cuentas_estado_check check (
    estado in ('PENDIENTE', 'AUTORIZANDO', 'CONECTADA', 'EXPIRADA', 'ERROR', 'DESCONECTADA')
  )
);

create unique index if not exists marketing_cuentas_canal_externa_idx
  on public.marketing_cuentas_canal (business_id, proveedor, external_account_id)
  where external_account_id is not null;

create index if not exists marketing_cuentas_canal_contexto_idx
  on public.marketing_cuentas_canal (organization_id, business_id, proveedor);

alter table public.marketing_cuentas_canal enable row level security;

create policy "Miembros consultan conexiones de marketing"
on public.marketing_cuentas_canal
for select to authenticated
using (
  exists (
    select 1 from public.organization_members miembro
    where miembro.organization_id = marketing_cuentas_canal.organization_id
      and miembro.user_id = (select auth.uid())
      and miembro.active
  )
);

grant select on public.marketing_cuentas_canal to authenticated;

comment on table public.marketing_cuentas_canal is
  'Metadatos visibles de conexiones oficiales. Los tokens OAuth nunca se guardan en esta tabla pública.';
