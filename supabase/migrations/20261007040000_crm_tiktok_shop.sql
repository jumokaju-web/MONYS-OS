alter table public.crm_oportunidades
  drop constraint if exists crm_oportunidades_canal_check;
alter table public.crm_oportunidades
  add constraint crm_oportunidades_canal_check
  check (canal in ('MOSTRADOR','WHATSAPP','FACEBOOK','INSTAGRAM','TIKTOK','TIKTOK_SHOP','MERCADO_LIBRE','OTRO'));

alter table public.crm_interacciones
  drop constraint if exists crm_interacciones_canal_check;
alter table public.crm_interacciones
  add constraint crm_interacciones_canal_check
  check (canal in ('MOSTRADOR','WHATSAPP','FACEBOOK','INSTAGRAM','TIKTOK','TIKTOK_SHOP','MERCADO_LIBRE','OTRO'));
