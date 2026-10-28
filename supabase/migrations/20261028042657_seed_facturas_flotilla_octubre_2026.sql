insert into public.flotilla_facturas_ingreso (
  organization_id, business_id, emisor, folio,
  periodo_desde, periodo_hasta, emitida_en, forma_pago, metodo_pago, moneda,
  subtotal, iva, total, estado_pago, pagada_en, estado_conciliacion, nota_auditoria
)
select o.id, b.id, x.emisor, x.folio, x.periodo_desde, x.periodo_hasta,
       x.emitida_en, '03', 'PUE', 'MXN', x.subtotal, x.iva, x.total,
       'PAGADA', x.emitida_en, 'PENDIENTE',
       'CFDI tipo Ingreso pagado por transferencia según factura. Cuenta y movimiento bancario aún sin conciliar.'
from public.organizations o
join public.businesses b on b.organization_id = o.id
cross join (values
  ('Mónica Janeth Jimenez Meza', 'F0000000013', date '2026-10-12', date '2026-10-18', timestamptz '2026-10-23 15:59:50-06', 34797.00::numeric, 5567.52::numeric, 40364.52::numeric),
  ('Ana Karina Jimenez Meza', 'F0000000118', date '2026-10-12', date '2026-10-18', timestamptz '2026-10-23 15:58:15-06', 20650.00::numeric, 3304.00::numeric, 23954.00::numeric)
) as x(emisor, folio, periodo_desde, periodo_hasta, emitida_en, subtotal, iva, total)
where o.name = 'Corporativo Monys'
  and b.name = 'Flotilla Jiménez Camionetas'
on conflict (organization_id, business_id, emisor, folio) do nothing;
