alter table public.marketing_clientes_agencia
  add constraint marketing_clientes_agencia_id_organizacion_unique
  unique (id, organization_id);

alter table public.marketing_publicaciones
  add constraint marketing_publicaciones_cliente_organizacion_fk
  foreign key (cliente_agencia_id, organization_id)
  references public.marketing_clientes_agencia (id, organization_id)
  on delete restrict;

alter table public.marketing_cuentas_canal
  add constraint marketing_cuentas_cliente_organizacion_fk
  foreign key (cliente_agencia_id, organization_id)
  references public.marketing_clientes_agencia (id, organization_id)
  on delete restrict;
