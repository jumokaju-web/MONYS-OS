import {
  compararRangosSucursales,
  construirComparativoSucursales,
} from "../../shared/resumenSucursalesFinanciero.js";

const dinero = (valor) => new Intl.NumberFormat("es-MX", {
  style: "currency",
  currency: "MXN",
  maximumFractionDigits: 0,
}).format(Number(valor) || 0);

const porcentaje = (valor) => valor === null || valor === undefined
  ? "Pendiente"
  : `${Number(valor).toFixed(1)}%`;

export default function ComparativoSucursalesRescate({
  sucursales = [],
  baseVigente = false,
  antiguedadDias = null,
  movimientosPendientes = 0,
}) {
  const filas = construirComparativoSucursales(sucursales);
  const comparacion = compararRangosSucursales(filas);
  const comparables = comparacion.comparable
    ? filas.filter((fila) => fila.ventas !== null && fila.utilidadBruta !== null)
    : [];
  const ordenadas = [...comparables].sort((a, b) => b.ventas - a.ventas);
  const lider = ordenadas[0];
  const rezago = ordenadas.length > 1 ? ordenadas.at(-1) : null;
  const brechaVentas = lider && rezago ? lider.ventas - rezago.ventas : null;
  const proporcionRezago = lider?.ventas > 0 && rezago
    ? (rezago.ventas / lider.ventas) * 100
    : null;

  return (
    <section
      aria-labelledby="comparativo-sucursales-rescate"
      style={{
        margin: "18px 0",
        padding: 18,
        border: "1px solid #ead3df",
        borderRadius: 16,
        background: "#fff9fc",
      }}
    >
      <p style={{ margin: 0, color: "#8e315e", fontWeight: 850, letterSpacing: ".06em", fontSize: 13 }}>
        BASE SICAR · COMPARACIÓN INTERNA
      </p>
      <h3 id="comparativo-sucursales-rescate" style={{ margin: "6px 0", color: "#3b2330" }}>
        ¿Qué sucursal está aportando y cuál necesita rescate?
      </h3>
      <p style={{ marginTop: 0, color: "#685963", lineHeight: 1.5 }}>
        {comparables.length
          ? `Corte comparable: ${comparables[0].periodoEtiqueta}.`
          : comparacion.mensaje}
      </p>

      {!baseVigente && Number.isFinite(Number(antiguedadDias)) && (
        <p role="alert" style={{ padding: 11, background: "#fff1d2", borderRadius: 10, color: "#704d0c" }}>
          Este corte tiene {antiguedadDias} días. Sirve como antecedente, no como lectura de esta semana. Actualiza ambos reportes SICAR con las mismas fechas.
        </p>
      )}
      {!baseVigente && antiguedadDias === null && (
        <p role="alert" style={{ padding: 11, background: "#fff1d2", borderRadius: 10, color: "#704d0c" }}>
          No hay una fecha de corte válida para esta base. Importa reportes SICAR actuales y comparables antes de decidir.
        </p>
      )}

      {comparables.length ? (
        <>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 420 }}>
              <thead>
                <tr>
                  <th scope="col" style={{ textAlign: "left", padding: 9 }}>Sucursal</th>
                  <th scope="col" style={{ textAlign: "right", padding: 9 }}>Ventas</th>
                  <th scope="col" style={{ textAlign: "right", padding: 9 }}>Utilidad bruta</th>
                  <th scope="col" style={{ textAlign: "right", padding: 9 }}>Margen bruto</th>
                </tr>
              </thead>
              <tbody>
                {ordenadas.map((fila) => (
                  <tr key={fila.id}>
                    <th scope="row" style={{ textAlign: "left", padding: 9, borderTop: "1px solid #eadce3" }}>{fila.nombre}</th>
                    <td style={{ textAlign: "right", padding: 9, borderTop: "1px solid #eadce3" }}>{dinero(fila.ventas)}</td>
                    <td style={{ textAlign: "right", padding: 9, borderTop: "1px solid #eadce3" }}>{dinero(fila.utilidadBruta)}</td>
                    <td style={{ textAlign: "right", padding: 9, borderTop: "1px solid #eadce3" }}>{porcentaje(fila.margenBruto)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {lider && rezago && (
            <p style={{ marginBottom: 0, lineHeight: 1.55 }}>
              En este corte, <strong>{lider.nombre}</strong> vendió {dinero(brechaVentas)} más; {rezago.nombre} alcanzó {porcentaje(proporcionRezago)} de sus ventas. Esto ubica la brecha de volumen, pero no explica por sí solo su causa.
            </p>
          )}
        </>
      ) : (
        <p role="status">Importa reportes de utilidad de ventas para las dos sucursales con el mismo periodo antes de comparar.</p>
      )}

      {Number(movimientosPendientes) > 0 && (
        <p role="status" style={{ color: "#704d0c" }}>
          Hay {movimientosPendientes} movimientos financieros pendientes de revisión; por eso todavía no se puede concluir la utilidad neta ni la rentabilidad final por sucursal.
        </p>
      )}

      <p style={{ marginBottom: 0, color: "#685963", lineHeight: 1.5 }}>
        La utilidad mostrada es bruta. Para decidir dónde ajustar, falta restar renta, nómina y servicios atribuibles a cada sucursal. No compara con la competencia ni recomienda cerrar una tienda con estos datos solos.
      </p>
    </section>
  );
}
