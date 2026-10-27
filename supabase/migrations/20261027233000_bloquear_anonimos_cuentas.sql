begin;

drop policy if exists monys_accounts_select_alcance on public.accounts;
create policy monys_accounts_select_alcance
on public.accounts for select to authenticated
using (
  (select (auth.jwt()->>'is_anonymous')::boolean) is false
  and exists (
    select 1
    from public.usuarios actor
    where actor.auth_user_id = (select auth.uid())
      and actor.active is true
      and actor.organization_id = accounts.organization_id
      and lower(actor.role) in ('owner', 'admin', 'director', 'finanzas', 'encargada', 'vendedora')
      and (
        lower(actor.role) in ('owner', 'admin', 'director')
        or (
          (actor.business_id is null or actor.business_id = accounts.business_id)
          and (actor.branch_id is null or actor.branch_id = accounts.branch_id)
        )
      )
  )
);

commit;
