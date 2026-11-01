alter table public.marketing_cuentas_canal
  add column if not exists solicitada_por uuid null,
  add column if not exists solicitada_en timestamptz null;

alter table public.marketing_cuentas_canal
  add constraint marketing_cuentas_cliente_proveedor_unique
  unique (cliente_agencia_id, proveedor);

create policy "Marketing prepara conexiones oficiales"
on public.marketing_cuentas_canal
for insert to authenticated
with check (
  solicitada_por = (select auth.uid())
  and solicitada_en is not null
  and estado = 'PENDIENTE'
  and nombre_cuenta is null
  and external_account_id is null
  and cardinality(capacidades) = 0
  and cardinality(permisos) = 0
  and connected_by is null
  and ultima_sincronizacion is null
  and ultimo_error is null
  and cliente_agencia_id is not null
  and exists (
    select 1 from public.usuarios usuario
    where usuario.organization_id = marketing_cuentas_canal.organization_id
      and usuario.auth_user_id = (select auth.uid())
      and usuario.active
      and lower(usuario.role) in ('owner', 'admin', 'marketing')
  )
);

grant insert on public.marketing_cuentas_canal to authenticated;
