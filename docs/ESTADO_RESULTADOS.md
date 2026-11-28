# Estado de resultados mensual por sucursal y canal

Código: `src/core/finanzas/estadoResultados.js` (puro) y `src/features/inteligencia/services/estadoResultadosService.js` (lectura de Supabase).

## Renglones

Ingresos → costo de mercancía → utilidad bruta → gastos de venta del canal → gastos directos → **contribución** por unidad → gastos generales → **utilidad operativa** → intereses → utilidad antes de ISR → ISR → **utilidad neta**.

Lo que **no es gasto** se informa aparte: IVA, ISR pagado, capital de deuda, compras de inventario, retiros, financiamiento y traspasos.

## Reglas

| Tema | Regla |
|---|---|
| Dato faltante | Nunca se toma como 0. Cada renglón conocido se conserva aunque falte el siguiente: ingresos sin utilidad, sucursal sin gastos, etc. |
| Subtotales | `subtotalConocido` siempre trae la suma de las unidades conocidas y la lista de las que faltan. `consolidado` solo existe completo. |
| Cobertura SICAR | Una carga cubre los días de su **periodo declarado**. Un día cubierto sin ventas es cero real; un día sin cobertura es faltante. Si el periodo termina el mismo día en que se hizo la carga, ese día queda parcial. Sin periodo declarado, el día queda `sin_confirmar`. |
| Reemplazo de cargas | Gana la carga más nueva que cubre el día **completo**. Una carga parcial más nueva no reemplaza a una completa. Dos cargas completas con totales distintos quedan en conflicto. |
| Disponibilidad | El importe y la utilidad se evalúan por separado. Una bandera `null` (historial) con valor 0 es desconocido; con valor distinto de 0 cuenta, pero queda marcada. |
| Gastos | Se calculan en tres bases. **Pagado** es lo registrado en Tesorería y es provisional: una lista vacía no prueba cero. **Devengado** es la obligación mensual (`gastosFijosDelMes` del motor de equilibrio) o, si no hay obligación, lo pagado. **Pendiente** es lo que vence menos lo pagado. Las obligaciones "OTRO" no se cruzan y se informan aparte. |
| IVA | Hay bases independientes para ventas SICAR, costo SICAR, ventas y cargos de cada canal, y gastos de Tesorería. Una base por confirmar usa el importe tal como viene y el resultado se marca como provisional. Nunca se deduce una base de otra. |
| Cargos de marketplace | Solo se excluye el cargo ligado a una operación (canal + cuenta + referencia) cuyas comisiones ya vienen en las órdenes. Los demás son cargos distintos: se restan y quedan por conciliar. |
| Canales | Solo cuentan las cuentas de `canal_cuentas` del negocio. Una cuenta configurada sin datos del mes es faltante. Sin configuración legible, no se puede confirmar qué canales existen. |
| Aislamiento | Se valida que el negocio sea de la organización. Las sucursales del negocio entran aunque estén inactivas. Las obligaciones y movimientos de otros negocios se ignoran, y los gastos de sucursales ajenas se reportan. |
| ISR | Si hay monto del contador, se usa ese. Si no, se estima con la tasa (`ESTIMADO_PROVISIONAL` si alguna base de IVA está por confirmar). Sin ninguno de los dos, queda faltante. |

## Comparativos

Se comparan periodos equivalentes: solo unidades que operan en ambos meses, con cobertura y costo completos y las mismas bases de IVA. Las aperturas, los cierres y los meses incompletos quedan en `unidadesExcluidas` con su motivo.

Además de la variación mensual, el comparativo incluye:

- **venta promedio diaria**, para meses con distinto número de días;
- **efecto volumen** `(I₂ − I₁)·m₁` y **efecto margen** `I₂·(m₂ − m₁)`, que suman exactamente el cambio de utilidad bruta;
- gastos devengados por categoría;
- comparación contra el mismo mes del año anterior.

Un mes en curso no se compara.

## Recomendaciones

Se revisan:

- contribución negativa;
- caída de margen;
- caída de venta diaria con margen estable;
- gasto que sube;
- publicaciones con pérdida;
- cargos o cancelaciones altos;
- obligaciones sin pago registrado;
- intereses ≥ 30% de la utilidad operativa;
- movimientos sin clasificar;
- cargos de marketplace por conciliar.

Cada una lleva impacto estimado y `requiereAutorizacion: true`.

## Pendiente

- **Fuente de cierres de sucursal:** hoy no existe (`diasCerrados` va vacío), así que un día sin carga se trata como faltante.
- **Campos `canal`, `cuenta_id` y `referencia_externa` en Tesorería:** sin ellos, ningún cargo de marketplace se excluye.
- **Bases de IVA y monto o tasa de ISR del contador:** mientras falten, el resultado sale como provisional.
- **`canalesPorMes`:** se conecta cuando la sincronización de #170 esté activa.
- **Pantalla:** la hace ChatGPT/Codex.
