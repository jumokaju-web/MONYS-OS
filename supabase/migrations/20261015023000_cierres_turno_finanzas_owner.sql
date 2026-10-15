begin;

-- Dirección necesita leer los cierres de su propio negocio aunque hayan sido
-- creados por otra cuenta. La función conserva RLS en la tabla y expone solo
-- filas cuyo branch pertenece exactamente a la organización y negocio de la
-- propietaria autenticada.
create or replace function public.obtener_cierres_turno_finanzas_owner(
  p_limite integer default 100
)
returns setof public.cierres_turno
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_organization_id uuid;
  v_business_id uuid;
begin
  select u.organization_id, u.business_id
    into v_organization_id, v_business_id
  from public.usuarios u
  where u.auth_user_id = auth.uid()
    and u.active = true
    and u.role = 'owner'
  limit 1;

  if v_organization_id is null or v_business_id is null then
    raise exception 'Solo la propietaria activa puede consultar los cortes financieros'
      using errcode = '42501';
  end if;

  return query
  select c.*
  from public.cierres_turno c
  join public.branches s on s.id = c.branch_id
  join public.businesses b on b.id = s.business_id
  where b.id = v_business_id
    and b.organization_id = v_organization_id
  order by c.created_at desc
  limit least(greatest(coalesce(p_limite, 100), 1), 500);
end;
$$;

revoke all on function public.obtener_cierres_turno_finanzas_owner(integer) from public;
revoke all on function public.obtener_cierres_turno_finanzas_owner(integer) from anon;
revoke all on function public.obtener_cierres_turno_finanzas_owner(integer) from authenticated;
grant execute on function public.obtener_cierres_turno_finanzas_owner(integer) to authenticated;

commit;
