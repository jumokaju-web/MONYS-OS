# Contrato del tablero financiero (pantallas de ChatGPT/Codex)

Una sola llamada alimenta todas las pantallas del bloque financiero:

```js
import { obtenerTableroFinanciero } from "src/features/inteligencia/services/estadoResultadosService.js";

const t = await obtenerTableroFinanciero({
  organizationId, businessId,            // del contexto activo (UserContext)
  meses: ["2026-09", "2026-10", "2026-11"],
  bases: { ventasSicar, costoSicar, gastosTesoreria },   // { base: "sin_iva"|"con_iva"|"por_confirmar", ivaPct }
  basesCanales: { mercado_libre: { ventas, cargos } },
  isrPorMes: { "2026-10": { montoDelContador } | { tasaEstimadaPct } },
  publicidadPorMes: { "2026-11": { [cuentaId]: gasto } },
  mesObjetivo: "2026-12",               // default: mes en curso
});
```

Es solo lectura. No duplica cálculos: la pantalla **no suma, no resta ni redondea montos**; todo viene calculado.

## Qué devuelve

| Campo | Uso en pantalla |
|---|---|
| `estado` | `"listo"` o `"sin_contexto"` (con `motivo`). |
| `errores[]` | Avisos de fuentes que no se pudieron leer. |
| `estados[]` | Un estado de resultados por mes (ver abajo). |
| `comparativo.meses[]` | Para cada mes: `vsMesAnterior` y `vsMismoMesAnioAnterior`, con `unidadesComparadas`, `unidadesExcluidas[{nombre, motivo}]`, variaciones `{delta, pct}`, `margenBrutoPp`, `efectoUtilidadBruta {volumen, margen, total}` y `gastos[]`. |
| `recomendaciones[]` | `{clave, titulo, impactoMensual, evidencia, accion, confianza, requiereAutorizacion: true}`, ordenadas por impacto. |
| `equilibrio.porSucursal.sucursales[]` | `{nombre, ventaDiariaActual, margenContribucionPct, diasConVentaEsperada, operativo, operativoConGenerales (SUPUESTO), efectivo, faltantes, avisos}`. Cada bloque trae `{ventaMensual, ventaDiaria, brechaDiaria}`. |
| `equilibrio.consolidado` | Salida de `construirEquilibrioReal` (#166): incluye deuda e impuestos. |
| `gastosQueMasPesan[]` | `{nombre, categoria, devengado, pagado, pendiente, pctIngresos, diasDeVenta}`. |
| `fuentes[]` | `{mes, fuente, estado: real|estimado|parcial|faltante, detalle, accion}`, con lo más urgente primero. |

### Cada estado (`estados[i]`)

- `consolidado`: trae `completo`, `ingresos`, `costoMercancia`, `utilidadBruta` y `margenBrutoPct`. También `gastosVenta`, `gastosDirectos {pagado, devengado}` y `gastosGenerales {pagado, devengado, pendiente}`. Luego `utilidadOperativa {pagado, devengado}`, `intereses`, `utilidadAntesISR`, `isr`, `tipoIsr`, `utilidadNeta` y los márgenes. **`null` = no se puede calcular todavía.**
- `subtotalConocido.<renglón>`: `{valor, incluye[], faltan[]}`. Se muestra cuando el consolidado es `null`.
- `unidades[]` (sucursales y canales) trae:
  - `ingresosRegistrados`, `ingresos`, `costoMercancia`, `utilidadBruta`, `margenBrutoPct`;
  - `gastosVenta`, `gastosDirectos {pagado, devengado, pendiente, porCategoria[]}`;
  - `contribucionPagado` / `contribucionDevengado`, `ventaPromedioDiaria`;
  - `cobertura {diasEsperados, completo, cerrado, sin_dato, parcial, conflicto, diasSinDato[]}`;
  - `calendario`, `indicadores` (canales).
- `obligacionesPendientes`, `noSonGasto {iva, isrPagado, capitalDeuda, compraInventario, retiros…}`, `cargosMarketplace {excluidosPorDuplicado, porConciliar}`, `sucursalesQueNoOperan[]`, `porVincular[]`, `sinClasificar[]`.
- `bases {iva, utilidadOperativa, intereses}`, `provisional[]`, `faltantes[]`, `confianza: alta|media|baja`.

## Reglas de presentación (obligatorias)

1. **`null` nunca se pinta como $0.** Se muestra "Pendiente" con el motivo tomado de `faltantes`.
2. Cada cifra lleva su etiqueta: **Real** (dato completo), **Estimado** (`tipoIsr ESTIMADO*`, `operativoConGenerales`, bases por confirmar) o **Pendiente**.
3. Si `provisional.length > 0`, se muestra la banda "Resultado provisional" con la lista desplegable.
4. Utilidad operativa: se muestra **devengado** como principal y **pagado** como secundario.
5. Comparativos: siempre se muestra "Comparado sobre: …" y las unidades excluidas con su motivo.
6. Recomendaciones: botón **"Revisar"**, nunca "Ejecutar". Nada cambia precios, campañas, publicaciones ni pagos.
7. `ingresosRegistrados` (cuando `ingresos` es `null`) se rotula "registrado hasta ahora", nunca "ventas del mes".

## Pantallas para celular (propuesta)

| # | Pantalla | Contenido | Acción principal |
|---|---|---|---|
| 1 | **Resultado del mes** | Selector de mes; utilidad neta (o la última línea calculable) con etiqueta; tarjetas por sucursal y canal con contribución; banda provisional | Ver detalle |
| 2 | **Estado de resultados** | Renglones del consolidado, `subtotalConocido` cuando falte, `noSonGasto` aparte | Cambiar mes, compartir |
| 3 | **Comparativo** | Variaciones contra el mes anterior y contra el año anterior, efecto volumen y margen en una barra, gastos que más cambiaron | — |
| 4 | **¿Cuánto debo vender hoy?** | Por sucursal: venta diaria necesaria (operativo, efectivo), venta diaria actual y brecha en color; días con venta esperada | — |
| 5 | **Qué me quita utilidad** | `gastosQueMasPesan`: % de ingresos y "días de venta que se come" | Ver categoría |
| 6 | **Acciones con más impacto** | `recomendaciones`, con impacto mensual y evidencia | Revisar |
| 7 | **Calidad de datos** | `fuentes` agrupadas por estado, cada una con su `accion` | Ir a cargar o clasificar |
| 8 | **Calendario de sucursal** | Alta y edición de cierres y horario reducido (motivo obligatorio), vigencias. Escribe en `sucursal_calendario` y `sucursal_vigencias` | Guardar, confirmar |
| 9 | **Conciliar plataforma** | En Tesorería, por movimiento: proponer vínculos (cuenta, tipo, referencia, monto parcial) y verificar. Usa `proponerVinculoPlataforma` / `verificarVinculoPlataforma` | Proponer, verificar |
| 10 | **Vincular productos** | `porVincular` con sugerencias, para confirmar el vínculo con SICAR | Confirmar |

Las pantallas 8 y 9 requieren las migraciones del calendario y la conciliación aplicadas. Antes de eso, el servicio devuelve `null` y la pantalla muestra "Disponible cuando se active".
