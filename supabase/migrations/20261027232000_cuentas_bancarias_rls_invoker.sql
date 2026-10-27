begin;

create unique index if not exists account_ownership_events_account_once_idx
  on public.account_ownership_events (account_id);

alter table public.accounts enable row level security;
grant update (business_id, branch_id, ownership_scope, ownership_confirmed_by, ownership_confirmed_at)
  on public.accounts to authenticated;

drop policy if exists accounts_owner_classifies_pending_bank
  on public.accounts;
create policy accounts_owner_classifies_pending_bank
on public.accounts for update to authenticated
using (
  business_id is null
  and ownership_scope = 'PENDIENTE'
  and active is true
  and account_type = 'banco'
  and (select (auth.jwt()->>'is_anonymous')::boolean) is false
  and exists (
    select 1 from public.usuarios actor
    where actor.auth_user_id = (select auth.uid())
      and actor.active is true
      and lower(actor.role) = 'owner'
      and actor.organization_id = accounts.organization_id
  )
)
with check (
  ownership_scope in ('EMPRESA', 'PERSONAL', 'MIXTA')
  and ownership_confirmed_by = (select auth.uid())
  and ownership_confirmed_at is not null
  and active is true
  and account_type = 'banco'
  and (select (auth.jwt()->>'is_anonymous')::boolean) is false
  and exists (
    select 1 from public.usuarios actor
    where actor.auth_user_id = (select auth.uid())
      and actor.active is true
      and lower(actor.role) = 'owner'
      and actor.organization_id = accounts.organization_id
  )
  and (
    (
      ownership_scope = 'EMPRESA'
      and business_id is not null
      and exists (
        select 1 from public.businesses b
        where b.id = accounts.business_id
          and b.organization_id = accounts.organization_id
          and b.active is true
      )
    )
    or
    (ownership_scope in ('PERSONAL', 'MIXTA') and business_id is null and branch_id is null)
  )
);

grant insert on public.account_ownership_events to authenticated;
drop policy if exists account_ownership_events_owner_insert
  on public.account_ownership_events;
create policy account_ownership_events_owner_insert
on public.account_ownership_events for insert to authenticated
with check (
  (select (auth.jwt()->>'is_anonymous')::boolean) is false
  and changed_by = (select auth.uid())
  and length(trim(note)) between 5 and 500
  and exists (
    select 1 from public.usuarios actor
    where actor.auth_user_id = (select auth.uid())
      and actor.active is true
      and lower(actor.role) = 'owner'
      and actor.organization_id = account_ownership_events.organization_id
  )
  and exists (
    select 1 from public.accounts a
    where a.id = account_ownership_events.account_id
      and a.organization_id = account_ownership_events.organization_id
      and a.ownership_scope = account_ownership_events.ownership_scope
      and a.business_id is not distinct from account_ownership_events.business_id
      and a.ownership_confirmed_by = account_ownership_events.changed_by
      and a.ownership_confirmed_at = account_ownership_events.changed_at
  )
);

create or replace function public.clasificar_cuenta_bancaria(
  p_account_id uuid,
  p_clasificacion text,
  p_business_id uuid,
  p_nota text
)
returns jsonb
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_actor public.usuarios%rowtype;
  v_account public.accounts%rowtype;
  v_scope text := upper(trim(coalesce(p_clasificacion, '')));
  v_note text := trim(coalesce(p_nota, ''));
  v_business_id uuid;
  v_confirmed_at timestamptz := now();
begin
  if coalesce((auth.jwt()->>'is_anonymous')::boolean, true) then
    raise exception 'Se requiere una sesión autenticada de Dirección.';
  end if;

  select * into v_actor
  from public.usuarios
  where auth_user_id = (select auth.uid())
    and active is true
    and lower(role) = 'owner';
  if not found then
    raise exception 'Solo la propietaria activa puede clasificar cuentas bancarias.';
  end if;

  if v_scope not in ('EMPRESA', 'PERSONAL', 'MIXTA') then
    raise exception 'Selecciona si la cuenta es de empresa, personal o mixta.';
  end if;
  if length(v_note) < 5 or length(v_note) > 500 then
    raise exception 'La nota debe tener entre 5 y 500 caracteres.';
  end if;

  select * into v_account
  from public.accounts
  where id = p_account_id
    and organization_id = v_actor.organization_id
    and active is true
    and account_type = 'banco'
  for update;
  if not found then
    raise exception 'La cuenta no existe, no está activa o no pertenece a la organización.';
  end if;
  if v_account.ownership_scope <> 'PENDIENTE' or v_account.business_id is not null then
    raise exception 'Esta cuenta ya tiene una clasificación. Solicita una corrección auditada.';
  end if;

  if v_scope = 'EMPRESA' then
    if p_business_id is null then
      raise exception 'Selecciona el negocio al que pertenece la cuenta.';
    end if;
    if not exists (
      select 1 from public.businesses b
      where b.id = p_business_id
        and b.organization_id = v_actor.organization_id
        and b.active is true
    ) then
      raise exception 'El negocio seleccionado no pertenece a la organización activa.';
    end if;
    v_business_id := p_business_id;
  else
    if p_business_id is not null then
      raise exception 'Las cuentas personales o mixtas no se asignan al saldo empresarial.';
    end if;
    v_business_id := null;
  end if;

  update public.accounts
  set business_id = v_business_id,
      branch_id = null,
      ownership_scope = v_scope,
      ownership_confirmed_by = (select auth.uid()),
      ownership_confirmed_at = v_confirmed_at
  where id = p_account_id;

  insert into public.account_ownership_events (
    account_id, organization_id, business_id, ownership_scope, note, changed_by, changed_at
  ) values (
    p_account_id, v_actor.organization_id, v_business_id, v_scope, v_note, (select auth.uid()), v_confirmed_at
  );

  return jsonb_build_object(
    'account_id', p_account_id,
    'ownership_scope', v_scope,
    'business_id', v_business_id,
    'confirmed_at', v_confirmed_at
  );
end;
$$;

commit;
