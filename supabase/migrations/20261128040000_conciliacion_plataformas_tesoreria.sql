-- Conciliación de plataformas en Tesorería (autorizado para PREPARAR por
-- la propietaria el 27-nov-2026; NO aplicar sin su autorización).
-- Depende de 20261128020000_canales_marketplace.sql (canal_cuentas,
-- canal_ordenes, canal_liquidaciones).
--
-- Liga un movimiento de Tesorería (cash_movements) con una o varias
-- operaciones de una cuenta de canal: canal + cuenta + tipo de operación +
-- referencia externa + monto conciliado. Permite conciliación parcial (un
-- cargo de $500 puede tener $300 de comisiones ya incluidas en órdenes y
-- $200 de otro cargo). Así el estado de resultados no duplica comisiones
-- ni ingresos: solo excluye lo que está ligado y verificado.
--
-- referencia_verificada la calcula la base: true solo si la referencia
-- existe en las órdenes o liquidaciones sincronizadas de esa cuenta.

begin;

create table if not exists public.cash_movement_platform_links (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  business_id uuid not null references public.businesses(id) on delete restrict,
  cash_movement_id uuid not null references public.cash_movements(id) on delete restrict,
  cuenta_id uuid not null references public.canal_cuentas(id) on delete restrict,
  canal text not null,
  tipo_operacion text not null,
  referencia_externa text,
  monto_conciliado numeric(14, 2) not null,
  evidencia text,
  referencia_verificada boolean not null default false,
  estado text not null default 'propuesto',
  verificado_por uuid,
  verificado_en timestamptz,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint cmpl_tipo check (tipo_operacion in ('comision', 'envio', 'publicidad', 'cargo_plataforma', 'liquidacion', 'retencion', 'devolucion', 'otro')),
  constraint cmpl_estado check (estado in ('propuesto', 'verificado', 'anulado')),
  constraint cmpl_monto check (monto_conciliado > 0),
  constraint cmpl_verificacion check ((estado = 'verificado') = (verificado_por is not null and verificado_en is not null)),
  constraint cmpl_referencia check (estado <> 'verificado' or length(trim(coalesce(referencia_externa, ''))) > 0 or length(trim(coalesce(evidencia, ''))) > 0)
);
create unique index if not exists cmpl_unico_activo on public.cash_movement_platform_links
  (cash_movement_id, cuenta_id, tipo_operacion, coalesce(referencia_externa, '')) where estado <> 'anulado';
create index if not exists cmpl_negocio_idx on public.cash_movement_platform_links (business_id, cuenta_id);

create table if not exists public.cash_movement_platform_links_auditoria (
  id bigint generated always as identity primary key,
  organization_id uuid not null,
  registro_id uuid not null,
  accion text not null,
  antes jsonb,
  despues jsonb,
  usuario uuid,
  registrado_en timestamptz not null default now()
);

create or replace function private.validar_vinculo_plataforma()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  mov record;
  cuenta record;
  ya_conciliado numeric;
begin
  -- Bloquea el movimiento: dos vínculos simultáneos no exceden su monto.
  select id, organization_id, business_id, amount into mov from public.cash_movements where id = new.cash_movement_id for update;
  if not found then raise exception 'Movimiento de Tesorería inexistente'; end if;
  select id, organization_id, business_id, canal into cuenta from public.canal_cuentas where id = new.cuenta_id;
  if not found then raise exception 'Cuenta de canal inexistente'; end if;
  if mov.organization_id <> new.organization_id or mov.business_id <> new.business_id then
    raise exception 'El movimiento no pertenece a la organización y negocio indicados';
  end if;
  if cuenta.organization_id <> new.organization_id or cuenta.business_id <> new.business_id then
    raise exception 'La cuenta de canal no pertenece al mismo negocio que el movimiento';
  end if;
  new.canal := cuenta.canal; -- el canal sale de la cuenta, no del usuario

  if new.estado <> 'anulado' then
    select coalesce(sum(monto_conciliado), 0) into ya_conciliado
    from public.cash_movement_platform_links
    where cash_movement_id = new.cash_movement_id and estado <> 'anulado' and id <> new.id;
    if ya_conciliado + new.monto_conciliado > abs(mov.amount) then
      raise exception 'Lo conciliado (%) supera el monto del movimiento (%)', ya_conciliado + new.monto_conciliado, abs(mov.amount);
    end if;
  end if;

  new.referencia_verificada := new.referencia_externa is not null and (
    exists (select 1 from public.canal_ordenes o where o.cuenta_id = new.cuenta_id and o.external_id = new.referencia_externa)
    or exists (select 1 from public.canal_liquidaciones l where l.cuenta_id = new.cuenta_id and l.external_id = new.referencia_externa)
  );
  if new.verificado_por is not null and new.verificado_por is distinct from auth.uid()
     and (tg_op = 'INSERT' or new.verificado_por is distinct from old.verificado_por) then
    raise exception 'Solo la persona autenticada puede verificar';
  end if;
  new.updated_at := now();
  return new;
end;
$$;

create or replace function private.auditar_vinculo_plataforma()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.cash_movement_platform_links_auditoria (organization_id, registro_id, accion, antes, despues, usuario)
  values (coalesce(new.organization_id, old.organization_id), coalesce(new.id, old.id), lower(tg_op),
          case when tg_op = 'INSERT' then null else to_jsonb(old) end,
          case when tg_op = 'DELETE' then null else to_jsonb(new) end, auth.uid());
  return coalesce(new, old);
end;
$$;

drop trigger if exists cmpl_validar on public.cash_movement_platform_links;
create trigger cmpl_validar before insert or update on public.cash_movement_platform_links
  for each row execute function private.validar_vinculo_plataforma();
drop trigger if exists cmpl_auditar on public.cash_movement_platform_links;
create trigger cmpl_auditar after insert or update or delete on public.cash_movement_platform_links
  for each row execute function private.auditar_vinculo_plataforma();

alter table public.cash_movement_platform_links enable row level security;
drop policy if exists cmpl_leer on public.cash_movement_platform_links;
create policy cmpl_leer on public.cash_movement_platform_links for select to authenticated
  using (private.has_org_role(organization_id, array['owner','director','admin','finanzas']::text[]));
drop policy if exists cmpl_escribir on public.cash_movement_platform_links;
create policy cmpl_escribir on public.cash_movement_platform_links for all to authenticated
  using (private.has_org_role(organization_id, array['owner','director','admin','finanzas']::text[]))
  with check (private.has_org_role(organization_id, array['owner','director','admin','finanzas']::text[]));

alter table public.cash_movement_platform_links_auditoria enable row level security;
drop policy if exists cmpl_auditoria_leer on public.cash_movement_platform_links_auditoria;
create policy cmpl_auditoria_leer on public.cash_movement_platform_links_auditoria for select to authenticated
  using (private.has_org_role(organization_id, array['owner','director','admin']::text[]));
revoke insert, update, delete on public.cash_movement_platform_links_auditoria from authenticated, anon;

revoke all on function private.validar_vinculo_plataforma() from public, anon, authenticated;
revoke all on function private.auditar_vinculo_plataforma() from public, anon, authenticated;

commit;
