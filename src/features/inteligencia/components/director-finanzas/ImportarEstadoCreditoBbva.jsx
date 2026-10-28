import { useState } from "react";
import { extraerTextoPdfGenerico } from "../../../tesoreria/utils/extraerTextoPdfBancario.js";
import { crearPaqueteCreditoBbva } from "../../../tesoreria/utils/crearPaqueteCreditoBbva.js";

const dinero = (valor) => new Intl.NumberFormat("es-MX", {
  style: "currency", currency: "MXN", minimumFractionDigits: 2,
}).format(Number(valor) || 0);

export default function ImportarEstadoCreditoBbva({ deudas = [] }) {
  const [paquete, setPaquete] = useState(null);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState("");

  async function leerEstado(evento) {
    const archivo = evento.target.files?.[0];
    evento.target.value = "";
    if (!archivo) return;
    setCargando(true);
    setPaquete(null);
    setError("");
    try {
      const extraido = await extraerTextoPdfGenerico(archivo);
      setPaquete(crearPaqueteCreditoBbva(extraido.lineas));
    } catch (fallo) {
      setError(fallo?.message || "No se pudo leer el estado del crédito.");
    } finally {
      setCargando(false);
    }
  }

  const existente = paquete && deudas.find((deuda) =>
    String(deuda?.acreedor || "").toLowerCase().includes("bbva")
      && String(deuda?.notas || "").includes(paquete.terminacion)
      && String(deuda?.estado || "").toUpperCase() === "ACTIVA",
  );

  return (
    <section style={{ marginTop: 18, padding: 16, border: "1px solid #d8c9eb", borderRadius: 14, background: "#faf7ff" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
        <div style={{ flex: "1 1 350px" }}>
          <strong>Leer estado mensual del crédito BBVA</strong>
          <p style={{ margin: "5px 0 0", color: "#675a70", fontSize: 13 }}>
            Extrae saldo al corte, saldo en promociones, pago mínimo y desglose. Solo prepara una revisión; no cambia la deuda guardada ni marca pagos como realizados.
          </p>
        </div>
        <label style={{ padding: "10px 13px", borderRadius: 9, background: "#5f4776", color: "white", fontWeight: 800, cursor: "pointer" }}>
          {cargando ? "Leyendo estado…" : "Seleccionar PDF BBVA"}
          <input type="file" accept="application/pdf,.pdf" onChange={leerEstado} disabled={cargando} style={{ position: "absolute", width: 1, height: 1, opacity: 0 }} />
        </label>
      </div>
      {error && <p role="alert" style={{ color: "#9d2838", marginBottom: 0 }}>{error}</p>}
      {paquete && <div style={{ marginTop: 14 }}>
        <p style={{ margin: "0 0 10px" }}><b>{paquete.producto}</b> · termina en {paquete.terminacion} · Titular: {paquete.titular}</p>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(145px,1fr))", gap: 9 }}>
          {[
            ["Saldo al corte", paquete.saldoAlCorte],
            ["Saldo de promociones", paquete.saldoPromociones],
            ["Pago mínimo al corte", paquete.pagoMinimo],
            ["Límite", paquete.limiteCredito],
            ["Disponible en el corte", paquete.creditoDisponibleAlCorte],
            ["Fecha límite del estado", paquete.fechaLimitePago],
          ].map(([etiqueta, valor]) => <article key={etiqueta} style={{ padding: 10, background: "white", borderRadius: 10, border: "1px solid #e7deef" }}>
            <small style={{ color: "#74687d" }}>{etiqueta}</small><strong style={{ display: "block", marginTop: 4 }}>{etiqueta.includes("Fecha") ? valor : dinero(valor)}</strong>
          </article>)}
        </div>
        <p style={{ margin: "10px 0 4px", fontSize: 13 }}>
          Último pago leído: {dinero(paquete.ultimoPago.total)} = capital {dinero(paquete.ultimoPago.capital)} + intereses {dinero(paquete.ultimoPago.intereses)} + IVA {dinero(paquete.ultimoPago.iva)} + comisiones {dinero(paquete.ultimoPago.comisiones)}. Tasa del producto: {paquete.tasaAnualProducto}% anual.
        </p>
        {existente && <p style={{ margin: "8px 0 0", fontSize: 13 }}>Ya existe una deuda BBVA terminación {paquete.terminacion}: {dinero(existente.saldo_actual)} con corte {existente.fecha_corte_dato}. Compara ambos registros antes de actualizar.</p>}
        <p style={{ margin: "8px 0 0", color: "#784d00", fontSize: 12 }}><b>Corte {paquete.corte}.</b> Este saldo ya es histórico. La fecha límite {paquete.fechaLimitePago} ya pasó y el PDF no confirma si ese pago se cubrió después.</p>
      </div>}
    </section>
  );
}
