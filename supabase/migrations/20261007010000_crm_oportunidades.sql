create table if not exists public.crm_oportunidades (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  business_id uuid not null references public.businesses(id),
  branch_id uuid null references public.branches(id),
  created_by uuid not null default auth.uid() references auth.users(id),
  empleado_id uuid null references public.empleados(id) on delete set null,
  asignado_a uuid null references auth.users(id) on delete set null,
  cliente text not null,
  telefono text null,
  canal text not null default 'MOSTRADOR',
  etapa text not null default 'NUEVO',
  producto_interes text null,
  monto_estimado numeric(14, 2) null,
  proximo_seguimiento date null,
  notas text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint crm_oportunidades_cliente_check check (length(trim(cliente)) >= 2),
  constraint crm_oportunidades_canal_check check (
    canal in ('MOSTRADOR', 'WHATSAPP', 'FACEBOOK', 'INSTAGRAM', 'TIKTOK', 'MERCADO_LIBRE', 'OTRO')
  ),
  constraint crm_oportunidades_etapa_check check (
    etapa in ('NUEVO', 'CONTACTADO', 'COTIZANDO', 'GANADO', 'PERDIDO')
  ),
  constraint crm_oportunidades_monto_check check (
    monto_estimado is null or monto_estimado >= 0
  )
);

create index if not exists crm_oportunidades_pipeline_idx
  on public.crm_oportunidades (business_id, etapa, proximo_seguimiento);

create index if not exists crm_oportunidades_asignacion_idx
  on public.crm_oportunidades (asignado_a, proximo_seguimiento)
  where asignado_a is not null;

alter table public.crm_oportunidades enable row level security;

drop policy if exists "Duenos administran CRM oportunidades"
  on public.crm_oportunidades;
drop policy if exists "Duenos consultan CRM oportunidades"
  on public.crm_oportunidades;
drop policy if exists "Duenos actualizan CRM oportunidades"
  on public.crm_oportunidades;
drop policy if exists "Duenos eliminan CRM oportunidades"
  on public.crm_oportunidades;

create policy "Duenos consultan CRM oportunidades"
on public.crm_oportunidades
for select
to authenticated
using (
  exists (
    select 1
    from public.usuarios usuario
    where usuario.auth_user_id = (select auth.uid())
      and usuario.organization_id = crm_oportunidades.organization_id
      and usuario.active
      and lower(usuario.role) in ('owner', 'admin')
  )
);

create policy "Duenos administran CRM oportunidades"
on public.crm_oportunidades
for insert
to authenticated
with check (
  created_by = (select auth.uid())
  and exists (
    select 1
    from public.usuarios usuario
    where usuario.auth_user_id = (select auth.uid())
      and usuario.organization_id = crm_oportunidades.organization_id
      and usuario.active
      and lower(usuario.role) in ('owner', 'admin')
  )
);

create policy "Duenos actualizan CRM oportunidades"
on public.crm_oportunidades
for update
to authenticated
using (
  exists (
    select 1
    from public.usuarios usuario
    where usuario.auth_user_id = (select auth.uid())
      and usuario.organization_id = crm_oportunidades.organization_id
      and usuario.active
      and lower(usuario.role) in ('owner', 'admin')
  )
)
with check (
  exists (
    select 1
    from public.usuarios usuario
    where usuario.auth_user_id = (select auth.uid())
      and usuario.organization_id = crm_oportunidades.organization_id
      and usuario.active
      and lower(usuario.role) in ('owner', 'admin')
  )
);

create policy "Duenos eliminan CRM oportunidades"
on public.crm_oportunidades
for delete
to authenticated
using (
  exists (
    select 1
    from public.usuarios usuario
    where usuario.auth_user_id = (select auth.uid())
      and usuario.organization_id = crm_oportunidades.organization_id
      and usuario.active
      and lower(usuario.role) in ('owner', 'admin')
  )
);
