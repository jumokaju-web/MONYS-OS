# Estado de resultados mensual por sucursal y canal

Código: `src/core/finanzas/estadoResultados.js` (puro) y `src/features/inteligencia/services/estadoResultadosService.js` (lectura de Supabase).

## Renglones

| Renglón | Fuente | Regla |
|---|---|---|
| Ingresos | SICAR `ventas_articulos` por sucursal y canales (Mercado Libre, TikTok Shop) | Sin IVA. Si no se confirma si el reporte trae IVA, la base queda `por_confirmar`: no se calcula ISR ni utilidad neta |
| Costo de mercancía | SICAR: importe − utilidad del propio reporte. Canales: costo SICAR vinculado por SKU | Un SKU sin costo deja pendiente la utilidad bruta del canal. Nunca se inventa |
| Gastos de venta del canal | Comisiones y envíos de las órdenes, más publicidad del mes | Publicidad desconocida ≠ 0. La comisión de marketplace que también está en Tesorería se excluye (`excluidosPorDuplicado`) |
| Gastos operativos directos | Tesorería con sucursal (renta, nómina, servicios…) | Base pagado en el mes. Distribuciones activas aplicadas (#166) |
| Contribución | Utilidad bruta − gastos de venta − directos | Por sucursal y por canal |
| Gastos generales | Tesorería sin sucursal | No se reparten. El reparto proporcional a ventas va aparte como `SUPUESTO` |
| Utilidad operativa | Contribuciones − generales | |
| Intereses | Devengados (si se entregan) o pagados en el mes | La base se declara |
| ISR | Monto del contador, o estimado con la tasa que indique | El estimado baja la confianza |
| Utilidad neta | Utilidad antes de ISR − ISR | |
| No son gasto | IVA, ISR pagado, capital de deuda, compras de inventario, retiros, financiamiento, traspasos | Se informan aparte |

Las cargas de SICAR que se traslapan no se suman: para cada sucursal y día gana la carga más reciente. Una sucursal sin ventas en el mes es dato faltante, salvo que esté marcada como cerrada. Un canal esperado sin datos (sin sincronizar) deja el consolidado pendiente.

## Comparativos y variaciones

`compararMeses(estados)` da, para cada mes:

- variaciones contra el mes anterior y contra el mismo mes del año anterior;
- el margen bruto en puntos;
- gastos por categoría, ordenados por cambio;
- unidades.

El cambio de utilidad bruta se descompone en **efecto volumen** `(I₂ − I₁)·m₁` y **efecto margen** `I₂·(m₂ − m₁)`, que suman exactamente el total. Un mes en curso no se compara con uno cerrado.

## Recomendaciones

`recomendacionesRentabilidad` revisa el último mes cerrado y busca:

- contribución negativa;
- caída del margen bruto (≥ 2 pts);
- caída de ventas con margen estable;
- gasto que sube ≥ 15% y ≥ $1,000;
- publicaciones con pérdida;
- cargos de canal > 35%;
- cancelaciones > 5%;
- intereses ≥ 30% de la utilidad operativa;
- movimientos sin clasificar.

Cada recomendación trae impacto mensual estimado (o `null`), evidencia y acción, ordenadas por impacto. Todas son `RECOMENDACION` con `requiereAutorizacion: true`: no se cambian precios, campañas, publicaciones ni pagos.

## Confianza

- **Baja:** sin Tesorería, movimientos sin clasificar, base de IVA por confirmar, canal sin sincronizar o utilidad operativa incalculable.
- **Media:** hay faltantes menores, movimientos sin revisar, pagos al SAT sin tipo, ISR estimado, intereses en base pagado o mes en curso.
- **Alta:** nada de lo anterior.

## Pendiente

- Confirmar con el contador si los importes de SICAR incluyen IVA, y la tasa o el monto de ISR.
- Conectar `canalesPorMes` cuando se active la sincronización (#170).
- La pantalla le toca a ChatGPT/Codex; consume `obtenerEstadosDeResultados`.
