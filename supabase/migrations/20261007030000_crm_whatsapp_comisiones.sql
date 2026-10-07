alter table public.crm_oportunidades
  add column if not exists folio_venta_sicar text null;

create unique index if not exists crm_oportunidades_folio_sicar_sucursal_unico_idx
  on public.crm_oportunidades (
    business_id,
    (coalesce(branch_id, '00000000-0000-0000-0000-000000000000'::uuid)),
    lower(trim(folio_venta_sicar))
  )
  where folio_venta_sicar is not null and trim(folio_venta_sicar) <> '';

alter table public.crm_oportunidades
  drop constraint if exists crm_oportunidades_ganado_folio_check;
alter table public.crm_oportunidades
  add constraint crm_oportunidades_ganado_folio_check
  check (etapa <> 'GANADO' or (folio_venta_sicar is not null and length(trim(folio_venta_sicar)) > 0));

create table if not exists public.crm_interacciones (
  id uuid primary key default gen_random_uuid(),
  oportunidad_id uuid not null references public.crm_oportunidades(id) on delete cascade,
  organization_id uuid not null references public.organizations(id),
  business_id uuid not null references public.businesses(id),
  branch_id uuid null references public.branches(id),
  registrado_por uuid not null default auth.uid() references auth.users(id),
  canal text not null,
  direccion text not null,
  mensaje text not null,
  external_message_id text null,
  source_url text null,
  ocurrio_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  constraint crm_interacciones_canal_check check (canal in ('MOSTRADOR','WHATSAPP','FACEBOOK','INSTAGRAM','TIKTOK','MERCADO_LIBRE','OTRO')),
  constraint crm_interacciones_direccion_check check (direccion in ('ENTRANTE','SALIENTE','NOTA')),
  constraint crm_interacciones_mensaje_check check (length(trim(mensaje)) > 0)
);

create index if not exists crm_interacciones_oportunidad_tiempo_idx
  on public.crm_interacciones (oportunidad_id, ocurrio_at desc);
create index if not exists crm_interacciones_negocio_tiempo_idx
  on public.crm_interacciones (business_id, ocurrio_at desc);
alter table public.crm_interacciones enable row level security;

drop policy if exists "CRM interacciones visibles por oportunidad" on public.crm_interacciones;
drop policy if exists "CRM interacciones registrables por responsable" on public.crm_interacciones;

create policy "CRM interacciones visibles por oportunidad"
on public.crm_interacciones for select to authenticated
using (exists (select 1 from public.crm_oportunidades oportunidad where oportunidad.id = crm_interacciones.oportunidad_id));

create policy "CRM interacciones registrables por responsable"
on public.crm_interacciones for insert to authenticated
with check (
  registrado_por = (select auth.uid())
  and exists (
    select 1 from public.crm_oportunidades oportunidad
    where oportunidad.id = crm_interacciones.oportunidad_id
      and oportunidad.organization_id = crm_interacciones.organization_id
      and oportunidad.business_id = crm_interacciones.business_id
      and (
        exists (select 1 from public.usuarios usuario
          where usuario.auth_user_id = (select auth.uid())
            and usuario.organization_id = oportunidad.organization_id
            and usuario.active and lower(usuario.role) in ('owner','admin'))
        or (oportunidad.asignado_a = (select auth.uid())
          and exists (select 1 from public.empleados empleado
            where empleado.id = oportunidad.empleado_id
              and empleado.usuario_id = (select auth.uid()) and empleado.active))
      )
  )
);
