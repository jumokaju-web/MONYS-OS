begin;

create table if not exists public.flotilla_revision_evidencias (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  ruta_id uuid not null references public.flotilla_rutas(id) on delete cascade,
  evidencia_key text not null,
  tipo_evidencia text not null check (tipo_evidencia in ('FOTO_SALIDA', 'FOTO_CIERRE', 'GASOLINA', 'AMBULANCIA')),
  referencia_id uuid,
  estado text not null check (estado in ('APROBADA', 'RECHAZADA')),
  motivo text,
  revisado_por uuid not null references auth.users(id) on delete restrict,
  revisado_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (ruta_id, evidencia_key),
  check (
    (estado = 'APROBADA' and motivo is null)
    or (estado = 'RECHAZADA' and nullif(btrim(motivo), '') is not null)
  )
);

create index if not exists flotilla_revision_evidencias_org_ruta_idx
  on public.flotilla_revision_evidencias (organization_id, ruta_id, updated_at desc);

create or replace function public.preparar_revision_evidencia_flotilla()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ruta public.flotilla_rutas%rowtype;
begin
  select * into v_ruta from public.flotilla_rutas where id = new.ruta_id;
  if v_ruta.id is null then raise exception 'Ruta no encontrada'; end if;
  if not public.flotilla_es_admin_de_organizacion(v_ruta.organization_id) then
    raise exception 'Solo Administración puede revisar evidencias';
  end if;

  new.organization_id := v_ruta.organization_id;
  new.revisado_por := (select auth.uid());
  new.revisado_at := now();
  new.updated_at := now();
  new.motivo := case when new.estado = 'RECHAZADA' then nullif(btrim(new.motivo), '') else null end;
  return new;
end;
$$;

drop trigger if exists flotilla_revision_evidencia_preparar on public.flotilla_revision_evidencias;
create trigger flotilla_revision_evidencia_preparar
before insert or update on public.flotilla_revision_evidencias
for each row execute function public.preparar_revision_evidencia_flotilla();

alter table public.flotilla_revision_evidencias enable row level security;
revoke all on public.flotilla_revision_evidencias from anon;
grant select, insert, update on public.flotilla_revision_evidencias to authenticated;

drop policy if exists flotilla_revision_evidencias_select_alcance on public.flotilla_revision_evidencias;
drop policy if exists flotilla_revision_evidencias_insert_admin on public.flotilla_revision_evidencias;
drop policy if exists flotilla_revision_evidencias_update_admin on public.flotilla_revision_evidencias;

create policy flotilla_revision_evidencias_select_alcance on public.flotilla_revision_evidencias
for select to authenticated using (
  public.flotilla_es_admin_de_organizacion(organization_id)
  or exists (
    select 1 from public.flotilla_rutas r
    where r.id = ruta_id and r.driver_auth_user_id = (select auth.uid())
  )
);

create policy flotilla_revision_evidencias_insert_admin on public.flotilla_revision_evidencias
for insert to authenticated with check (public.flotilla_es_admin_de_organizacion(organization_id));

create policy flotilla_revision_evidencias_update_admin on public.flotilla_revision_evidencias
for update to authenticated
using (public.flotilla_es_admin_de_organizacion(organization_id))
with check (public.flotilla_es_admin_de_organizacion(organization_id));

do $$
begin
  begin alter publication supabase_realtime add table public.flotilla_revision_evidencias;
  exception when duplicate_object then null; end;
end $$;

commit;
