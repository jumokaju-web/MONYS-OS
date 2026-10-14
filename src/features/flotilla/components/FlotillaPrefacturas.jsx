import { useMemo, useState } from "react";
import { obtenerOperacionFlotillaPeriodo } from "./services/operacionFlotilla";
import { crearFilasPrefacturaFlotilla, crearPrefacturaFlotilla } from "../utils/operacionFlotilla";

function fechaMexico() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Mexico_City" }).format(new Date());
}

function inicioSemana() {
  const hoy = new Date(`${fechaMexico()}T12:00:00`);
  const dia = hoy.getDay() || 7;
  hoy.setDate(hoy.getDate() - dia + 1);
  return [hoy.getFullYear(), String(hoy.getMonth() + 1).padStart(2, "0"), String(hoy.getDate()).padStart(2, "0")].join("-");
}

function moneda(valor) {
  return new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" }).format(Number(valor) || 0);
}

function escapar(valor) {
  return String(valor ?? "").replace(/[&<>"']/g, (caracter) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[caracter]);
}

export default function FlotillaPrefacturas() {
  const [periodo, setPeriodo] = useState({ desde: inicioSemana(), hasta: fechaMexico() });
  const [operaciones, setOperaciones] = useState([]);
  const [cargando, setCargando] = useState(false);
  const [consultado, setConsultado] = useState(false);
  const [error, setError] = useState("");
  const prefactura = useMemo(() => crearPrefacturaFlotilla(operaciones, periodo), [operaciones, periodo]);

  async function consultar() {
    try {
      setCargando(true);
      setError("");
      setOperaciones(await obtenerOperacionFlotillaPeriodo(periodo.desde, periodo.hasta));
      setConsultado(true);
    } catch (errorConsulta) {
      setError(errorConsulta?.message || "No fue posible preparar la prefactura.");
    } finally {
      setCargando(false);
    }
  }

  async function descargarExcel() {
    const XLSX = await import("xlsx");
    const libro = XLSX.utils.book_new();
    const detalle = XLSX.utils.json_to_sheet(crearFilasPrefacturaFlotilla(prefactura));
    const resumen = XLSX.utils.json_to_sheet([{
      Desde: periodo.desde,
      Hasta: periodo.hasta,
      Rutas: prefactura.totales.rutas,
      Kilómetros: prefactura.totales.kilometros,
      "Total prefactura": prefactura.totales.importePrefactura,
      "Gasolina aprobada": prefactura.totales.gasolinaAprobada,
      "Préstamos por gasolina": prefactura.totales.prestamosGasolina,
      "Saldo choferes": prefactura.totales.saldoChoferes,
    }]);
    detalle["!cols"] = [11, 15, 22, 12, 15, 11, 12, 12, 18, 20, 18, 18, 22, 14, 15, 14, 17].map((wch) => ({ wch }));
    XLSX.utils.book_append_sheet(libro, resumen, "Resumen");
    XLSX.utils.book_append_sheet(libro, detalle, "Rutas");
    XLSX.writeFile(libro, `Prefactura_Flotilla_${periodo.desde}_${periodo.hasta}.xlsx`);
  }

  function imprimirPdf() {
    const ventana = window.open("", "_blank", "noopener,noreferrer");
    if (!ventana) {
      setError("El navegador bloqueó la ventana. Permite ventanas emergentes para guardar el PDF.");
      return;
    }
    const filas = prefactura.filas.map((fila) => `<tr><td>${escapar(fila.fecha)}</td><td>${escapar(fila.ruta)}</td><td>${escapar(fila.chofer)}</td><td>${escapar(fila.placas)}</td><td>${escapar(fila.tipoPago)}</td><td>${fila.kilometros}</td><td>${moneda(fila.importeRuta)}</td><td>${moneda(fila.ambulanciasFavor)}</td><td>${moneda(fila.ambulanciasDescuento)}</td><td>${moneda(fila.importePrefactura)}</td><td>${moneda(fila.prestamosGasolina)}</td><td>${escapar(fila.evidencia)}</td></tr>`).join("");
    ventana.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>Prefactura Flotilla</title><style>body{font-family:Arial,sans-serif;color:#172b3a;padding:22px}h1{margin-bottom:4px}.resumen{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin:16px 0}.dato{border:1px solid #bbb;border-radius:8px;padding:8px}table{width:100%;border-collapse:collapse;font-size:10px}th,td{border:1px solid #bbb;padding:5px;text-align:left}th{background:#e8f2f8}@media print{button{display:none}@page{size:landscape;margin:10mm}}</style></head><body><h1>IMPERPAQ LOGÍSTICA · Prefactura</h1><p>Periodo ${escapar(periodo.desde)} al ${escapar(periodo.hasta)}</p><div class="resumen"><div class="dato">Rutas<br><b>${prefactura.totales.rutas}</b></div><div class="dato">Kilómetros<br><b>${prefactura.totales.kilometros}</b></div><div class="dato">Total prefactura<br><b>${moneda(prefactura.totales.importePrefactura)}</b></div><div class="dato">Préstamos por gasolina<br><b>${moneda(prefactura.totales.prestamosGasolina)}</b></div></div><table><thead><tr><th>Fecha</th><th>Ruta</th><th>Chofer</th><th>Placas</th><th>Tipo</th><th>KM</th><th>Ruta</th><th>Amb. +</th><th>Amb. −</th><th>Total</th><th>Préstamo gas</th><th>Evidencia</th></tr></thead><tbody>${filas}</tbody></table><p><b>Gasolina aprobada:</b> ${moneda(prefactura.totales.gasolinaAprobada)} · <b>Adelantos:</b> ${moneda(prefactura.totales.adelantos)} · <b>Saldo choferes:</b> ${moneda(prefactura.totales.saldoChoferes)}</p><button onclick="window.print()">Guardar como PDF</button></body></html>`);
    ventana.document.close();
  }

  return <section style={{ marginTop: 16, padding: 13, borderRadius: 14, background: "#f3f8ff", border: "1px solid #bfd5e8" }}>
    <small style={{ color: "#326d9b", fontWeight: 900 }}>PREFACTURAS</small>
    <h3 style={{ margin: "4px 0" }}>Descarga para Chory</h3>
    <p style={{ fontSize: 12, color: "#526d83" }}>Incluye rutas, bonos de kilometraje, ambulancias, evidencias y descuentos. La gasolina incompleta aparece como préstamo personal, no como gasto.</p>
    <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "end" }}>
      <label style={{ fontSize: 11, fontWeight: 800 }}>Desde<input type="date" value={periodo.desde} onChange={(e) => setPeriodo((actual) => ({ ...actual, desde: e.target.value }))} style={{ display: "block", padding: 8, marginTop: 4 }} /></label>
      <label style={{ fontSize: 11, fontWeight: 800 }}>Hasta<input type="date" value={periodo.hasta} onChange={(e) => setPeriodo((actual) => ({ ...actual, hasta: e.target.value }))} style={{ display: "block", padding: 8, marginTop: 4 }} /></label>
      <button type="button" onClick={consultar} disabled={cargando}>{cargando ? "Preparando…" : "Preparar prefactura"}</button>
      <button type="button" onClick={descargarExcel} disabled={!consultado || prefactura.filas.length === 0}>Descargar Excel</button>
      <button type="button" onClick={imprimirPdf} disabled={!consultado || prefactura.filas.length === 0}>Guardar PDF</button>
    </div>
    {error && <p role="alert" style={{ color: "#9a3425", fontWeight: 800 }}>{error}</p>}
    {consultado && <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(135px,1fr))", gap: 8, marginTop: 11 }}>
      {[["Rutas", prefactura.totales.rutas], ["Total prefactura", moneda(prefactura.totales.importePrefactura)], ["Gasolina aprobada", moneda(prefactura.totales.gasolinaAprobada)], ["Préstamo por gasolina", moneda(prefactura.totales.prestamosGasolina)], ["Saldo choferes", moneda(prefactura.totales.saldoChoferes)]].map(([etiqueta, valor]) => <div key={etiqueta} style={{ padding: 9, borderRadius: 9, background: "#fff", border: "1px solid #bfd5e8" }}><small>{etiqueta}</small><b style={{ display: "block" }}>{valor}</b></div>)}
    </div>}
  </section>;
}
