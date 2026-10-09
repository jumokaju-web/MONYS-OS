-- Revisiones bancarias versionadas; no son asientos ni cash_movements.
begin;
create table if not exists public.revisiones_bancarias (
 id uuid primary key default gen_random_uuid(),
 organization_id uuid not null references public.organizations(id),
 business_id uuid not null references public.businesses(id),
 branch_id uuid not null references public.branches(id),
 created_by uuid not null default auth.uid(),
 paquete jsonb not null check (jsonb_typeof(paquete) = 'object' and paquete ->> 'version' = '1' and jsonb_typeof(paquete -> 'cuentas') = 'array' and jsonb_typeof(paquete -> 'movimientos') = 'array'),
 created_at timestamptz not null default now()
);
alter table public.revisiones_bancarias enable row level security;
create index if not exists revisiones_bancarias_contexto_idx on public.revisiones_bancarias(created_by,organization_id,business_id,branch_id,created_at desc);
drop policy if exists revision_bancaria_lectura on public.revisiones_bancarias;
create policy revision_bancaria_lectura on public.revisiones_bancarias for select to authenticated using (
 created_by = (select auth.uid()) and exists (select 1 from public.usuarios u where u.auth_user_id = (select auth.uid()) and u.active = true and u.role = 'owner' and u.organization_id = revisiones_bancarias.organization_id and u.business_id = revisiones_bancarias.business_id and u.branch_id = revisiones_bancarias.branch_id)
);
drop policy if exists revision_bancaria_guardado on public.revisiones_bancarias;
create policy revision_bancaria_guardado on public.revisiones_bancarias for insert to authenticated with check (
 created_by = (select auth.uid()) and exists (select 1 from public.usuarios u where u.auth_user_id = (select auth.uid()) and u.active = true and u.role = 'owner' and u.organization_id = revisiones_bancarias.organization_id and u.business_id = revisiones_bancarias.business_id and u.branch_id = revisiones_bancarias.branch_id)
);
grant select, insert on public.revisiones_bancarias to authenticated;
revoke update, delete on public.revisiones_bancarias from authenticated;
commit;
