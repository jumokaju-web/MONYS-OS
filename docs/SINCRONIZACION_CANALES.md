# Sincronización automática de canales (Mercado Libre y TikTok Shop)

Estado: **diseño**. No hay credenciales, tablas ni funciones desplegadas. Cada pieza requiere revisión y autorización de la propietaria antes de aplicarse. Responsable: Claude (motor y datos); pantallas: ChatGPT/Codex.

## 1. Qué entrega hoy cada fuente (verificado el 27-nov-2026)

| Dato | Mercado Libre (conexión DomUP) | TikTok (conexión TikTok for Business) |
|---|---|---|
| Órdenes y estado (pagada/cancelada, motivo) | Sí | **No** |
| SKU por renglón | Sí (si la publicación lo tiene) | Solo catálogo (sin órdenes) |
| Comisión por venta | Sí (`sale_fee_total`) | **No** |
| Costo de envío del vendedor | Sí (`/shipments/{id}/costs`) | **No** |
| Fecha de liberación del dinero | Sí (`money_release_date`) | **No** |
| Factura de la plataforma (cargos, bonificaciones, publicidad) | Sí (periodo de facturación de ML) | **No** |
| Retenciones ISR/IVA | **No** (la API no las expone; requiere % configurado) | **No** |
| Devoluciones / reembolsos | Parcial (reclamos y devoluciones) | **No** |
| Publicidad | Sí (Product Ads) | Sí (gasto, GMV atribuido a anuncios) |
| Depósitos efectivamente recibidos | No como movimiento bancario: se concilian con `liquidacion_marketplace` en Tesorería | **No** |

**Lo que falta para TikTok Shop:** las APIs de **órdenes**, **finanzas/estados de liquidación** y **devoluciones** de TikTok Shop Partner (Open Platform). Requiere registrar una app en TikTok Shop Partner Center y que la tienda la autorice. Mientras tanto, la alternativa es exportar desde Seller Center: Pedidos → Exportar, y Finanzas → Estados de cuenta.

## 2. Arquitectura propuesta

```
pg_cron (diario 03:30 CDMX) ──▶ Edge Function `sincronizar-canales`
                                   ├─ Mercado Libre API (OAuth por cuenta)
                                   └─ TikTok Shop Partner API (OAuth por tienda)
                                   ▼
                     tablas canal_* (idempotentes por external_id)
                                   ▼
            core/canales/rentabilidadMarketplace.js  ──▶  director financiero
```

- **Credenciales:** tokens OAuth en Supabase Vault, nunca en el repositorio. Renovación automática del refresh token.
- **Ventana:** cada corrida vuelve a leer los últimos 45 días, porque las órdenes cambian de estado y los envíos se facturan tarde. El histórico inicial va de septiembre a noviembre de 2026.
- **Idempotencia:** `unique (business_id, canal, external_id)` con *upsert*. Repetir la corrida no duplica.
- **Aislamiento:** cada cuenta o tienda se liga a un `business_id` (Monys Glam). RLS igual que `ventas_articulos`.
- **Solo lectura en las plataformas:** la sincronización no modifica precios, publicaciones, campañas ni promociones.

### Tablas (borrador; migración aparte, con revisión)

- `canal_cuentas`: `business_id`, `canal` (`mercado_libre` | `tiktok_shop`), `cuenta_externa`, `estado`, `ultimo_sync`, `ultimo_error`.
- `canal_ordenes`: `external_id`, `fecha`, `estado`, `motivo_cancelacion`, `total`, `comision`, `envio_vendedor` (null = desconocido), `fecha_liberacion`, `registrado_en_sicar` (null = por confirmar).
- `canal_orden_items`: `orden_id`, `sku`, `publicacion`, `cantidad`, `precio_unit`, `comision`.
- `canal_cargos`: cargos y bonificaciones de la factura de la plataforma, por periodo (publicidad, mantenimiento, envíos).
- `canal_liquidaciones`: depósitos por fecha de liberación, para cruzarlos con `cash_movements` de categoría `liquidacion_marketplace`.

## 3. Reglas para no duplicar

1. Una venta de marketplace cuenta **una sola vez**. Si la tienda también la registra en SICAR, `registrado_en_sicar = true` y `consolidarCanales` no la vuelve a sumar. Mientras no se confirme, el consolidado queda pendiente.
2. El depósito de la plataforma es **cobro**, no venta (`liquidacion_marketplace`).
3. Comisiones, envíos y publicidad son gasto del canal. Las retenciones de ISR e IVA no son gasto operativo.
4. Las canceladas no son venta, pero se reportan porque afectan la reputación.

## 4. Decisiones pendientes de la propietaria

- ¿Las ventas de Mercado Libre y TikTok también se registran en SICAR?
- % de retenciones de ISR/IVA que aplica cada plataforma, según el régimen fiscal (confirmar con el contador).
- Autorizar la creación de la app de Mercado Libre (credenciales propias) y de la app de TikTok Shop Partner.
- Asignar SKU de SICAR a las publicaciones que no lo tienen.
