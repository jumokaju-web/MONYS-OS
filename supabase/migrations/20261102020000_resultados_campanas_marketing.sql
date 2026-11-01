alter table public.marketing_publicaciones
  add constraint marketing_publicaciones_id_organizacion_unique
  unique (id, organization_id);

create table public.marketing_resultados_campana (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  publicacion_id uuid not null,
  periodo_desde date not null,
  periodo_hasta date not null,
  alcance integer not null default 0,
  interacciones integer not null default 0,
  mensajes integer not null default 0,
  pedidos integer not null default 0,
  ventas_atribuidas numeric(14,2) not null default 0,
  gasto_real numeric(14,2) not null default 0,
  moneda text not null default 'MXN',
  evidencia_referencia text not null,
  nota text null,
  fuente text not null default 'MANUAL',
  estado_verificacion text not null default 'REPORTADO',
  created_by uuid not null default auth.uid(),
  created_at timestamptz not null default now(),
  constraint marketing_resultados_publicacion_organizacion_fk
    foreign key (publicacion_id, organization_id)
    references public.marketing_publicaciones (id, organization_id)
    on delete cascade,
  constraint marketing_resultados_periodo_check check (periodo_hasta >= periodo_desde),
  constraint marketing_resultados_metricas_check check (
    alcance >= 0 and interacciones >= 0 and mensajes >= 0 and pedidos >= 0
    and ventas_atribuidas >= 0 and gasto_real >= 0
  ),
  constraint marketing_resultados_moneda_check check (moneda in ('MXN', 'USD')),
  constraint marketing_resultados_fuente_check check (fuente in ('MANUAL', 'API')),
  constraint marketing_resultados_estado_check check (estado_verificacion in ('REPORTADO', 'VERIFICADO', 'DESCARTADO')),
  constraint marketing_resultados_evidencia_check check (char_length(trim(evidencia_referencia)) between 5 and 500)
);

create index marketing_resultados_organizacion_fecha_idx
  on public.marketing_resultados_campana (organization_id, created_at desc);

create index marketing_resultados_publicacion_periodo_idx
  on public.marketing_resultados_campana (publicacion_id, periodo_hasta desc);

alter table public.marketing_resultados_campana enable row level security;

create policy "Marketing consulta resultados de su organizacion"
on public.marketing_resultados_campana
for select to authenticated
using (
  exists (
    select 1 from public.usuarios usuario
    where usuario.organization_id = marketing_resultados_campana.organization_id
      and usuario.auth_user_id = (select auth.uid())
      and usuario.active
      and lower(usuario.role) in ('owner', 'admin', 'marketing')
  )
);

create policy "Marketing reporta resultados de su organizacion"
on public.marketing_resultados_campana
for insert to authenticated
with check (
  created_by = (select auth.uid())
  and fuente = 'MANUAL'
  and estado_verificacion = 'REPORTADO'
  and exists (
    select 1 from public.usuarios usuario
    where usuario.organization_id = marketing_resultados_campana.organization_id
      and usuario.auth_user_id = (select auth.uid())
      and usuario.active
      and lower(usuario.role) in ('owner', 'admin', 'marketing')
  )
);

grant select, insert on public.marketing_resultados_campana to authenticated;
