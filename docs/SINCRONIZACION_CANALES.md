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

## 5. Implementación preparada (sin aplicar ni desplegar)

| Pieza | Archivo | Estado |
|---|---|---|
| Tablas `canal_*` y `producto_vinculos` con RLS, y tokens en Vault | `supabase/migrations/20261128020000_canales_marketplace.sql` | Preparada. Probada en Postgres 16 local: idempotente, aislamiento por organización, solo dueña/dirección/admin vinculan, tokens solo para `service_role`. **Sin aplicar.** |
| Edge Function de solo lectura | `supabase/functions/sincronizar-canales/index.ts` | Preparada (`dry_run=1` disponible). **Sin desplegar ni credenciales.** |
| Traducción de las APIs | `src/core/canales/mapeoApis.js` | Con pruebas. |
| Vinculación con SICAR por SKU / código de barras | `src/core/canales/vinculacionSicar.js` | Con pruebas. Sin coincidencia única queda "por vincular": nunca se asume costo. |
| Diagnóstico de cancelaciones | `src/core/canales/diagnosticoCancelaciones.js` | Con pruebas. |
| Resultados diario / semanal / mensual y consolidado | `src/core/canales/resultadosPeriodicos.js` | Con pruebas. Las ventas de los canales no están en SICAR (confirmado), así que se suman sin duplicar. |

### Pasos para activar (cada uno con autorización)

**Mercado Libre (solo lectura)**
1. En https://developers.mercadolibre.com.mx crear una aplicación con permisos de **lectura** (`read`, `offline_access`). No se solicitan permisos de escritura.
2. Autorizar la app desde cada cuenta de vendedor (GGBACFHDE372 y JIMO4520833) y guardar el refresh token con `guardar_token_canal`.
3. Secretos de la función: `ML_CLIENT_ID` y `ML_CLIENT_SECRET`.

**TikTok Shop (solo lectura)**
1. En TikTok Shop Partner Center registrar una app con alcances de **lectura**: órdenes, finanzas, productos y devoluciones.
2. Autorizar la tienda "Mony's glam shop" y guardar `access_token|shop_cipher` con `guardar_token_canal`.
3. Secretos: `TT_APP_KEY` y `TT_APP_SECRET`.
4. Verificar contra la documentación oficial los campos de cargos por orden (`CAMPOS_TIKTOK_POR_VERIFICAR`). Hasta entonces, comisión, envío y retenciones por orden de TikTok quedan en null.

**Programación:** `pg_cron` diario a las 03:30 CDMX llamando a la función con `x-cron-secret`. La primera corrida va en `dry_run=1` con `desde=2026-09-01`.

### Lo que sigue sin fuente automática
- **Retenciones de ISR/IVA de Mercado Libre:** la API no las expone. Se configuran como % (dato del contador).
- **Depósitos bancarios efectivos:** se concilian con Tesorería (`liquidacion_marketplace`). El reporte de liberaciones de Mercado Pago requiere otra autorización.

## 6. Garantías de la sincronización (revisión de ChatGPT/Codex en #170)

La lógica vive en `src/core/canales/sincronizacion.js`, con pruebas que usan simulaciones. La Edge Function solo conecta las APIs con Supabase.

| Garantía | Cómo |
|---|---|
| `dry_run` sin escrituras comerciales | No guarda órdenes, publicaciones ni liquidaciones, ni registra éxito o fallo ordinario. **Excepciones (sí escribe):** (1) toma y libera el turno de la cuenta; (2) si el access token venció, **renueva la credencial y guarda la nueva en Vault**, porque la plataforma invalida la anterior al rotarla; (3) si esa credencial no se pudo guardar, registra el fallo crítico y deja la cuenta `DESCONECTADA`. Por eso un `dry_run` no es una simulación sin efectos sobre las credenciales. |
| Sin corridas simultáneas | `tomar_turno_canal(cuenta, minutos, ejecucion)`: un turno exclusivo de 15 minutos por cuenta, atómico, con un identificador único de ejecución (`sync_ejecucion_id`). `liberar_turno_canal` y el registro de éxito o fallo solo actúan si el turno sigue siendo de esa ejecución: una corrida cuyo turno venció no libera ni pisa el de otra. Además, `renovar_turno_canal` se llama antes de rotar la credencial y antes de cada lote de escritura (cada 50 órdenes, publicaciones, liquidaciones y el marcado de obsoletas): si el turno venció o es de otra corrida, se detiene sin escribir más. `guardar_credencial_canal(cuenta, credencial, ejecucion)` bloquea la fila y rechaza la escritura si el turno no es de esa ejecución o ya venció. El alta inicial (sin ejecución) solo procede si no hay turno activo. |
| Sin pérdida de credenciales | Se reutiliza el access token mientras siga vigente. Al renovar, el token nuevo se guarda con 3 reintentos **antes** de usarlo; si no se puede, la cuenta queda `DESCONECTADA` con aviso de "credencial en riesgo". Una credencial incompleta o inválida nunca reemplaza a la anterior. |
| Recuperación automática | Una cuenta en `ERROR` se reintenta con espera creciente (15 min × 2ⁿ, máximo 24 h) y vuelve a `ACTIVA` en cuanto una corrida sale bien. |
| Identidad | `/users/me` en Mercado Libre y `/authorization/202309/shops` en TikTok deben coincidir con la cuenta registrada. |
| Ventana y tiempo | Máximo 120 días por corrida. El tiempo se reparte entre cuentas; si no alcanza, la cobertura queda `completa: false`. |
| Publicaciones obsoletas | Solo con un barrido completo se marcan como `no_encontrada`. |
| Variantes | Llaves `(publicacion, variacion, sku)`, para que los tonos de un mismo producto no choquen. |
| Cobertura real | Por corrida: órdenes, % de envíos con costo, % de comisiones conocidas, % de publicaciones con SKU, % de liquidaciones con neto, liquidaciones (derivadas o de estado de cuenta) y fuentes no disponibles. Solo cuentan números finitos y SKU no vacíos: `null`, `undefined`, `NaN`, texto o SKU en blanco cuentan como dato faltante. Se guarda en `canal_cuentas.cobertura`. |
| Liquidaciones de Mercado Libre | Se derivan de las órdenes (neto por `money_release_date` y `money_release_status`) y se marcan `derivada_de_orden`. El depósito bancario real se concilia en Tesorería. |
| Credenciales de TikTok | Se renuevan con `/api/v2/token/refresh`; se verifican sus vencimientos. |

### Precio mínimo por publicación (`precioMinimo.js`)

- **Utilidad comercial** = precio sin IVA − comisión − costo fijo − envío − extras − costo SICAR. Las retenciones de IVA e ISR no son gasto.
- **Efectivo después de retenciones** = depósito de la plataforma − costo SICAR. Es caja, no utilidad.
- Entrega **precio sin pérdida**, **precio con margen objetivo** y, para el precio actual, su veredicto evaluado directamente y el **descuento máximo permitido** (sin pérdida y con margen), con los rangos intermedios que no cumplen por los tramos de envío.
- Rechaza negativos, paso inválido, tramos con huecos, solapes, inicio distinto de 0 o sin último tramo abierto. Un solo barrido acotado a 100 000 evaluaciones (incluye el precio actual y los rangos de descuento) y máximo 200 promociones.
- Cada promoción (precio fijo o % de descuento) y el descuento máximo sugerido se reevalúan en su **precio exacto**.
- El IVA trasladado es obligatorio: nunca se asume 0 (si no cobras IVA, captura 0).
- Sin retenciones sí calcula la utilidad comercial. El depósito y el efectivo quedan `null` y aparecen en `pendientes`.
- Solo sugiere. No cambia precios.

**Por verificar contra la documentación oficial al registrar las apps:** los campos de cargos por orden de TikTok y los de `products/search`.
