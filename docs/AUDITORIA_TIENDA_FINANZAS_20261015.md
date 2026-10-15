# Auditoría de tienda y finanzas · 15 octubre 2026

## Alcance

Chromium aislado con componentes reales y servicios simulados: InicioTienda, CierreTurno e IncidenciaTienda en 390 × 844 y 1366 × 1000. Revisión de propietaria con React/JSDOM. No hubo acceso al navegador autenticado, escrituras en la tienda ni publicación en producción. Flotilla fuera del alcance.

## Resultados

- Funcionan las cuatro vistas; conservan la captura al cambiar de sección.
- Cierre sin apertura previa conserva responsable, fondo real y foto sin fabricar una apertura.
- El historial colectivo no aparece a la empleada. Esto acredita presentación, no permisos del servidor.
- La incidencia puede enviarse independientemente del corte.
- Dos eventos simultáneos de envío generan un solo cierre en esa instancia.
- Sin errores JavaScript ni desbordamiento horizontal en los tamaños probados.
- Revisión exige nota, referencia y las tres comprobaciones para REVISADO.
- Migración de revisión probada en PostgreSQL aislado (PGlite): permisos, concurrencia e historial. No certifica las políticas actuales de cierres_turno ni Storage en producción.

## Correcciones

Bloqueo sincrónico del envío antes de subir foto; liberación al terminar o fallar. Rechazo de montos no finitos en movimientos. La foto exige sucursal y sesión confirmada, eliminando la ruta alternativa “equipo”. Pruebas de regresión para sesión vencida, fallo de autenticación, sucursal ausente y subida con sesión.

El bloqueo de pantalla no sustituye idempotencia en servidor. Una respuesta perdida puede corresponder a un registro ya guardado.

## Prioridades para cerrar el bloque

| Orden | Necesidad | Resultado esperado |
| --- | --- | --- |
| 1 | Verificar políticas reales de cierres_turno y Storage | Acceso por organización, negocio, sucursal y usuario; responsable derivado de identidad en servidor; pruebas de acceso permitido y rechazado. |
| 1 | Revisar evidencias: el cliente usa getPublicUrl | Verificar si el bucket es público; diseñar acceso privado y enlaces temporales antes de incorporar otros negocios. |
| 1 | Cierre único entre dispositivos | Operación transaccional, sesión explícita y clave de idempotencia; consultar estado ante respuesta perdida. |
| 2 | Recuperar borrador tras recarga | Implementado en la rama: cuenta, sucursal y fecha; hasta 12 horas en el dispositivo; recuperación explícita; foto pendiente; bloqueo si cambió la sesión. Pendiente publicar y probar con cuenta real. |
| 2 | Detectar sucursales sin corte | Tablero de sucursales esperadas, apertura, corte, diferencia, revisión y siguiente acción. Requiere calendario y responsables configurados. |
| 2 | Completar aclaraciones | Asignación, respuesta de empleada con evidencia, plazo e historial de resolución. |
| 3 | Mejorar carga inicial | Dividir módulos y medir en red de tienda; el paquete principal supera 2 MB sin comprimir. |

## Criterio de negocio

Cerrar apertura → captura → comprobación → aclaración → revisión antes de ampliar módulos. Mantener faltantes y sobrantes separados: un neto cero no prueba que cada corte sea correcto. La IA puede ordenar prioridades y proponer preguntas; la revisión debe representar evidencia comprobada por una persona.

Antes de vender como SaaS, acreditar aislamiento entre negocios, recuperación de respaldos, altas/bajas y permisos, monitoreo y soporte. Esta auditoría no certifica el sistema como listo para comercialización.

## Referencias oficiales

- https://supabase.com/docs/guides/database/postgres/row-level-security
- https://help.shopify.com/en/manual/sell-in-person/shopify-pos/cash-register-management/register-sessions-in-shopify-pos

Son referencias para contrastar permisos del servidor y efectivo esperado frente al contado. Las prioridades son recomendaciones derivadas de la revisión de MONYS OS.

## Actualización: recuperación y comprobante de envío

Prueba Chromium con servicios simulados: captura de importe, recarga, detección del borrador, bloqueo por sesión distinta, recuperación de la sesión correspondiente, aviso para adjuntar foto, envío con folio y eliminación del borrador. Conserva las pruebas de navegación móvil, incidencias y doble evento de envío. No acredita idempotencia entre dispositivos ni autorización en servidor.

El borrador usa almacenamiento local del navegador: no sincroniza entre equipos, no incluye fotos ni enlaces y no reemplaza un corte enviado. Al pulsar Salir en InicioTienda se borran los borradores de esa cuenta. La eliminación automática por vencimiento se comprueba al intentar leer el borrador. Un fallo del almacenamiento muestra aviso y permite continuar con la captura abierta.

Validación acumulada: 312 pruebas aprobadas; compilación correcta; lint sin errores, con advertencias existentes. Confirmación visible con folio, responsable, venta SICAR y efectivo restante tras respuesta satisfactoria del guardado. Pendiente actualización de vista de prueba y validación real empleada → propietaria.
