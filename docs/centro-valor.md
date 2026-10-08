# Centro de Valor de MONYS OS

Este bloque conecta dirección, iniciativas de mejora, seguimiento y registro de ingresos del programa. Se abre desde el Dashboard y desde la Junta Directiva. Conserva el Importador y los módulos operativos existentes.

## Contratos de datos

- Las iniciativas son tareas reales de `tareas_operativas`, con nombre `[Valor]`, organización, negocio, sucursal, responsable, fecha y evidencia requerida.
- El resultado estructurado conserva el tipo `INICIATIVA_VALOR_V1`, línea base, duración, fuente, resultado, costo, referencia de evidencia, aprendizaje e historial. No se interpreta una tarea de otro tipo como medición económica.
- Los estados de medición son `BASE_REGISTRADA`, `RESULTADO_REGISTRADO` y `REVISADA`. Guardar un resultado mantiene la tarea en proceso. La revisión humana la termina. La revisión declara quién examinó la referencia; no valida su contenido automáticamente.
- Un ID estable evita una segunda inserción si se reintenta el mismo formulario. Las actualizaciones comparan `updated_at`; ante conflicto, requieren volver a consultar.
- El cambio observado exige igual duración, importe base, importe posterior y costo de acción. No es valor causal atribuible al programa y no se agregan iniciativas que pueden solaparse. El indicador observado debe excluir el costo de la acción, que se descuenta una sola vez.

## Ingresos del software

La pantalla consulta `cash_movements` del negocio y sucursal activos. Reconoce conceptos con prefijos `[MONYS LICENCIA]`, `[MONYS IMPLEMENTACION]` y `[MONYS COSTO]`. Excluye cancelados, movimientos con sentido incorrecto y pendientes de revisión de los totales documentados. No genera movimientos ni facturas. Un costo ausente no significa cero. El saldo mostrado solo compara cobros y costos registrados, no utilidad neta.

El escenario comercial es manual, permanece en sesión y está separado de cobros reales. No infiere ingresos recurrentes, contratos, pagos de impuestos ni clientes inexistentes.

## Alcance y autorización

El módulo requiere Owner activo, sesión vigente y contexto completo comprobado mediante el perfil de `usuarios`. Cada consulta y actualización aplica organización, negocio y sucursal. Estas comprobaciones del cliente complementan las políticas RLS existentes; no sustituyen una auditoría de autorización en servidor. Antes de comercializar deben probarse aislamiento y permisos con dos organizaciones reales. No se aplicaron migraciones ni cambios de políticas en producción durante este bloque.

El Dashboard ahora entrega la importación real a la Junta y conserva IDs y fechas ISO en movimientos. Los motores ejecutivos usan los movimientos del negocio activo; el cruce financiero de Marketing usa la sucursal activa. La carga del corte descarta respuestas de solicitudes anteriores al cambiar de sucursal.

## Verificación y límites

Pruebas automáticas: importes ausentes, ceros confirmados, tipos de movimientos, fechas inválidas, duraciones distintas, costos, escenarios, contexto ajeno, rol inactivo, registro de iniciativa, resultado separado de revisión y conflictos de edición. El repositorio compila con Vite.

La prueba real de guardado, revisión y lectura entre sesiones, las políticas RLS y la apariencia en navegador siguen pendientes de acceso a la sesión. La automatización de facturación, licencias, cobro de suscripciones, alta de clientes, demanda perdida y atribución causal no forman parte de este bloque. Se conserva una ruta de mejora para incorporarlas después de un ciclo verificado.

## Demanda no atendida

El cierre de turno admite solicitudes estructuradas con producto/variante, unidades, motivo, compra no realizada y precio conocido. Se añaden al borrador del cierre y se persisten mediante el guardado ya existente en `cierres_turno`; no se simula un cierre aparte. Las notas anteriores permanecen disponibles y no se extraen cifras de texto libre.

Centro de Valor consulta hasta 200 cierres de la sucursal validada, filtra por fechas y agrupa únicamente misma descripción normalizada y motivo. Los importes son potenciales con precio conocido, no ventas ni utilidad. Puede preparar una iniciativa de revisión de stock, compra o campaña; no genera compras ni autoriza descuentos.

El 8 de octubre se verificaron en producción el inicio Owner, los accesos directos a Junta y Centro de Valor, y la consulta vacía correcta de sus registros. Se encontró y corrigió que la navegación de InicioJefa ocultaba los módulos nuevos. El intento posterior de selección de un archivo SICAR quedó bloqueado por protección del navegador; no se confirmó la importación. La captura estructurada de demanda aún requiere prueba completa de guardado y lectura en sesión.
