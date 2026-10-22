import { useMemo, useState } from "react";
import { anularAjustePrefactura, guardarAjustePrefactura, obtenerDatosPrefacturaPeriodo } from "./services/operacionFlotilla";
import { crearFilasPrefacturaFlotilla, crearPrefacturaFlotilla } from "../utils/operacionFlotilla";
import { crearPrefacturasWhatsApp } from "../utils/prefacturasWhatsApp";
import { evaluarCierreSemanal, periodoPrefacturaSugerido, semanaOperativa } from "../utils/cierreSemanalFlotilla";
import { useBorradorFlotilla } from './useBorradorFlotilla';
import EstadoBorrador from './EstadoBorrador';

function fechaMexico() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Mexico_City" }).format(new Date());
}

function moneda(valor) {
  return new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" }).format(Number(valor) || 0);
}

function escapar(valor) {
  return String(valor ?? "").replace(/[&<>"']/g, (caracter) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[caracter]);
}

const CATEGORIAS_AJUSTE = [
  ["NO_SHOW", "NO SHOW"],
  ["SINIESTRO", "SINIESTRO"],
  ["PENALIZACION", "PENALIZACIÓN"],
  ["FONDO_UNIDAD", "FONDO POR UNIDAD"],
];

export default function FlotillaPrefacturas({ puedeGestionar = true, usuario = null }) {
  const [periodo, setPeriodo] = useState(() => periodoPrefacturaSugerido(fechaMexico()));
  const [cedis, setCedis] = useState("STT1");
  const [operaciones, setOperaciones] = useState([]);
  const [rutasPendientes, setRutasPendientes] = useState([]);
  const [duplicadasIgnoradas, setDuplicadasIgnoradas] = useState([]);
  const [rutasPruebaIgnoradas, setRutasPruebaIgnoradas] = useState([]);
  const [descuentosPnr, setDescuentosPnr] = useState([]);
  const [ajustes, setAjustes] = useState([]);
  const [cargando, setCargando] = useState(false);
  const [consultado, setConsultado] = useState(false);
  const [error, setError] = useState("");
  const [copiado, setCopiado] = useState("");
  const [guardandoAjuste, setGuardandoAjuste] = useState(false);
  const seleccion = useBorradorFlotilla({ usuario, unidad: 'selector', fecha: `${periodo.desde}_${periodo.hasta}`, formulario: 'seleccion-ajuste' }, { grupo: '' }, false);
  const grupoSeleccionado = seleccion.valor.grupo;
  const borradorAjuste = useBorradorFlotilla({ usuario, unidad: grupoSeleccionado || 'sin-seleccionar', fecha: `${periodo.desde}_${periodo.hasta}`, formulario: 'ajuste-prefactura' }, { categoria: 'NO_SHOW', monto: '', observaciones: '', numeroParcialidad: '', totalParcialidades: '24' });
  const formularioAjuste = { ...borradorAjuste.valor, grupo: grupoSeleccionado };
  const setFormularioAjuste = borradorAjuste.controlador.cambiar;
  const prefactura = useMemo(() => crearPrefacturaFlotilla(operaciones, periodo), [operaciones, periodo]);
  const whatsapp = useMemo(() => crearPrefacturasWhatsApp({
    operaciones,
    descuentosPnr,
    ajustes,
    desde: periodo.desde,
    hasta: periodo.hasta,
    cedis,
  }), [operaciones, descuentosPnr, ajustes, periodo, cedis]);
  const cierre = useMemo(() => evaluarCierreSemanal(
    [...operaciones, ...rutasPendientes],
    periodo,
    fechaMexico()
  ), [operaciones, rutasPendientes, periodo]);

  function usarSemanaPorRevisar() {
    setPeriodo(periodoPrefacturaSugerido(fechaMexico()));
    setConsultado(false);
  }

  function usarSemanaActual() {
    setPeriodo(semanaOperativa(fechaMexico()));
    setConsultado(false);
  }

  function aplicarDatos(datos) {
    setOperaciones(datos.operaciones);
    setRutasPendientes(datos.rutasPendientes || []);
    setDuplicadasIgnoradas(datos.duplicadasIgnoradas || []);
    setRutasPruebaIgnoradas(datos.rutasPruebaIgnoradas || []);
    setDescuentosPnr(datos.descuentosPnr);
    setAjustes(datos.ajustes);
  }

  async function consultar() {
    try {
      setCargando(true);
      setError("");
      const datos = await obtenerDatosPrefacturaPeriodo(periodo.desde, periodo.hasta);
      aplicarDatos(datos);
      setConsultado(true);
    } catch (errorConsulta) {
      setError(errorConsulta?.message || "No fue posible preparar la prefactura.");
    } finally {
      setCargando(false);
    }
  }

  async function guardarAjuste() {
    const revision = borradorAjuste.revision;
    const grupo = whatsapp.prefacturas.find((item) => item.clave === formularioAjuste.grupo);
    if (!grupo) return setError("Selecciona el operador al que se aplicará el descuento.");
    if (!(Number(formularioAjuste.monto) > 0)) return setError("Escribe un importe mayor a cero.");
    try {
      setGuardandoAjuste(true);
      setError("");
      await guardarAjustePrefactura({
        grupo,
        periodo,
        categoria: formularioAjuste.categoria,
        monto: formularioAjuste.monto,
        observaciones: formularioAjuste.observaciones,
        numeroParcialidad: formularioAjuste.numeroParcialidad,
        totalParcialidades: formularioAjuste.totalParcialidades,
      });
      borradorAjuste.controlador.confirmar(revision);
      const datos = await obtenerDatosPrefacturaPeriodo(periodo.desde, periodo.hasta);
      aplicarDatos(datos);
    } catch (errorAjuste) {
      setError(errorAjuste?.message || "No fue posible guardar el ajuste.");
    } finally {
      setGuardandoAjuste(false);
    }
  }

  async function anularAjuste(ajusteId) {
    if (!window.confirm("¿Anular este ajuste? El registro permanecerá en el historial.")) return;
    try {
      setGuardandoAjuste(true);
      setError("");
      await anularAjustePrefactura(ajusteId);
      const datos = await obtenerDatosPrefacturaPeriodo(periodo.desde, periodo.hasta);
      aplicarDatos(datos);
    } catch (errorAjuste) {
      setError(errorAjuste?.message || "No fue posible anular el ajuste.");
    } finally {
      setGuardandoAjuste(false);
    }
  }

  async function copiar(texto, clave) {
    try {
      await navigator.clipboard.writeText(texto);
      setCopiado(clave);
      window.setTimeout(() => setCopiado((actual) => actual === clave ? "" : actual), 2200);
    } catch {
      setError("No fue posible copiar automáticamente. Mantén presionado el mensaje para copiarlo.");
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
    <p style={{ fontSize: 12, color: "#526d83" }}>El corte operativo es de lunes a domingo. Sólo entran rutas finalizadas; el domingo por la noche o el lunes se revisa y se descarga.</p>
    <div style={{ display: "flex", gap: 7, flexWrap: "wrap", marginBottom: 9 }}>
      <button type="button" onClick={usarSemanaPorRevisar}>Semana por revisar</button>
      <button type="button" onClick={usarSemanaActual}>Ver esta semana</button>
    </div>
    <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "end" }}>
      <label style={{ fontSize: 11, fontWeight: 800 }}>Desde<input type="date" value={periodo.desde} onChange={(e) => setPeriodo((actual) => ({ ...actual, desde: e.target.value }))} style={{ display: "block", padding: 8, marginTop: 4 }} /></label>
      <label style={{ fontSize: 11, fontWeight: 800 }}>Hasta<input type="date" value={periodo.hasta} onChange={(e) => setPeriodo((actual) => ({ ...actual, hasta: e.target.value }))} style={{ display: "block", padding: 8, marginTop: 4 }} /></label>
      <label style={{ fontSize: 11, fontWeight: 800 }}>CEDIS<input value={cedis} onChange={(e) => setCedis(e.target.value)} placeholder="STT1" style={{ display: "block", width: 95, padding: 8, marginTop: 4 }} /></label>
      <button type="button" onClick={consultar} disabled={cargando}>{cargando ? "Preparando…" : "Preparar prefactura"}</button>
      <button type="button" onClick={descargarExcel} disabled={!consultado || !cierre.listaParaRevision || prefactura.filas.length === 0}>Descargar Excel final</button>
      <button type="button" onClick={imprimirPdf} disabled={!consultado || !cierre.listaParaRevision || prefactura.filas.length === 0}>Guardar PDF final</button>
    </div>
    {error && <p role="alert" style={{ color: "#9a3425", fontWeight: 800 }}>{error}</p>}
    {consultado && <div role="status" style={{ marginTop: 10, padding: 10, borderRadius: 10, background: cierre.listaParaRevision ? "#e7f7ed" : "#fff4df", color: cierre.listaParaRevision ? "#17643a" : "#76551b", fontWeight: 800 }}>
      {cierre.listaParaRevision
        ? `SEMANA CERRADA · ${cierre.rutasFinalizadas} ruta(s) · lista para revisión, no implica pago realizado.`
        : cierre.estado === "PENDIENTE_CIERRES"
          ? `Corte provisional: faltan ${cierre.rutasPendientes} ruta(s) por cerrar. No se pueden descargar ni enviar como finales.`
          : cierre.estado === "SEMANA_EN_CURSO"
            ? "Corte provisional: la semana todavía no termina."
            : cierre.estado === "PERIODO_INCOMPLETO"
              ? "Selecciona una semana completa de lunes a domingo."
              : "No hay rutas cerradas para revisar en esta semana."}
      {duplicadasIgnoradas.length > 0 && <small style={{ display: "block", marginTop: 4 }}>Se ignoraron {duplicadasIgnoradas.length} reintento(s) duplicado(s); no se cobran dos veces.</small>}
      {rutasPruebaIgnoradas.length > 0 && <small style={{ display: "block", marginTop: 4 }}>Se excluyeron {rutasPruebaIgnoradas.length} ruta(s) de usuarios TEST; no afectan pagos.</small>}
    </div>}
    {consultado && <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(135px,1fr))", gap: 8, marginTop: 11 }}>
      {[["Rutas", prefactura.totales.rutas], ["Total prefactura", moneda(prefactura.totales.importePrefactura)], ["Gasolina aprobada", moneda(prefactura.totales.gasolinaAprobada)], ["Préstamo por gasolina", moneda(prefactura.totales.prestamosGasolina)], ["Saldo choferes", moneda(prefactura.totales.saldoChoferes)]].map(([etiqueta, valor]) => <div key={etiqueta} style={{ padding: 9, borderRadius: 9, background: "#fff", border: "1px solid #bfd5e8" }}><small>{etiqueta}</small><b style={{ display: "block" }}>{valor}</b></div>)}
    </div>}
    {puedeGestionar && cierre.listaParaRevision && whatsapp.prefacturas.length > 0 && <div style={{ marginTop: 14, padding: 10, borderRadius: 10, background: "#fff8e8", border: "1px solid #ead09b" }}>
      <h4 style={{ margin: "0 0 5px" }}>Agregar descuento al corte</h4>
      <p style={{ margin: "0 0 8px", fontSize: 11, color: "#6f5a2b" }}>PNR/LOST se toma automáticamente del módulo PNR. Aquí sólo captura los demás descuentos.</p>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(145px,1fr))", gap: 7 }}>
        <label style={{ fontSize: 11, fontWeight: 800 }}>Operador y unidad<select disabled={guardandoAjuste} value={formularioAjuste.grupo} onChange={(e) => seleccion.controlador.cambiar({ grupo: e.target.value })} style={{ width: "100%", padding: 8, marginTop: 4 }}><option value="">Seleccionar…</option>{whatsapp.prefacturas.map((item) => <option key={item.clave} value={item.clave}>{item.operador} · {item.placas}</option>)}</select></label>
        <fieldset disabled={!grupoSeleccionado || guardandoAjuste} style={{ display: 'contents' }}>
        <label style={{ fontSize: 11, fontWeight: 800 }}>Concepto<select value={formularioAjuste.categoria} onChange={(e) => setFormularioAjuste((actual) => ({ ...actual, categoria: e.target.value }))} style={{ width: "100%", padding: 8, marginTop: 4 }}>{CATEGORIAS_AJUSTE.map(([valor, etiqueta]) => <option key={valor} value={valor}>{etiqueta}</option>)}</select></label>
        <label style={{ fontSize: 11, fontWeight: 800 }}>Importe<input type="number" min="0.01" step="0.01" value={formularioAjuste.monto} onChange={(e) => setFormularioAjuste((actual) => ({ ...actual, monto: e.target.value }))} style={{ width: "100%", padding: 8, marginTop: 4 }} /></label>
        {formularioAjuste.categoria === "FONDO_UNIDAD" && <>
          <label style={{ fontSize: 11, fontWeight: 800 }}>Semana acumulada<input type="number" min="1" value={formularioAjuste.numeroParcialidad} onChange={(e) => setFormularioAjuste((actual) => ({ ...actual, numeroParcialidad: e.target.value }))} placeholder="Ej. 11" style={{ width: "100%", padding: 8, marginTop: 4 }} /></label>
          <label style={{ fontSize: 11, fontWeight: 800 }}>Total de semanas<input type="number" min="1" value={formularioAjuste.totalParcialidades} onChange={(e) => setFormularioAjuste((actual) => ({ ...actual, totalParcialidades: e.target.value }))} style={{ width: "100%", padding: 8, marginTop: 4 }} /></label>
        </>}
        <label style={{ fontSize: 11, fontWeight: 800 }}>Nota<input value={formularioAjuste.observaciones} onChange={(e) => setFormularioAjuste((actual) => ({ ...actual, observaciones: e.target.value }))} placeholder="Motivo o referencia" style={{ width: "100%", padding: 8, marginTop: 4 }} /></label>
        </fieldset>
      </div>
      <EstadoBorrador borrador={borradorAjuste} guardando={guardandoAjuste} />
      {!grupoSeleccionado && <p>Selecciona el operador y la unidad para recuperar su borrador.</p>}
      <button type="button" disabled={guardandoAjuste || !grupoSeleccionado} onClick={guardarAjuste} style={{ marginTop: 8 }}>{guardandoAjuste ? "Guardando…" : "Aplicar descuento al corte"}</button>
      {ajustes.filter((item) => item.estado === "APLICADO").length > 0 && <div style={{ marginTop: 9 }}>{ajustes.filter((item) => item.estado === "APLICADO").map((item) => <div key={item.id} style={{ fontSize: 11, padding: "5px 0", borderTop: "1px solid #ead09b" }}><b>{item.chofer_nombre}</b> · {CATEGORIAS_AJUSTE.find(([valor]) => valor === item.categoria)?.[1] || item.categoria} · {moneda(item.monto)} {item.categoria === "FONDO_UNIDAD" ? `(${item.numero_parcialidad}/${item.total_parcialidades})` : ""} <button type="button" disabled={guardandoAjuste} onClick={() => anularAjuste(item.id)} style={{ marginLeft: 5 }}>Anular</button></div>)}</div>}
    </div>}
    {consultado && whatsapp.prefacturas.length === 0 && <p style={{ marginTop: 11, fontSize: 12 }}>No hay rutas en este corte.</p>}
    {cierre.listaParaRevision && whatsapp.prefacturas.length > 0 && <div style={{ marginTop: 14 }}>
      <h4 style={{ margin: "0 0 7px" }}>Mensajes individuales para WhatsApp</h4>
      <p style={{ fontSize: 11, color: "#526d83" }}>El descuento PNR aplicado a este corte aparece en la prefactura y en el pago del driver, pero su saldo se rebaja una sola vez en MONYS.</p>
      <div style={{ display: "grid", gap: 9 }}>
        {whatsapp.prefacturas.map((item) => <details key={item.clave} style={{ padding: 10, borderRadius: 10, background: "#fff", border: "1px solid #bfd5e8" }}>
          <summary style={{ cursor: "pointer", fontWeight: 850 }}>{item.operador} · {item.placas} · {moneda(item.totalDespuesDescuentos)}</summary>
          <small style={{ display: "block", margin: "7px 0", color: "#526d83" }}>{item.socio}</small>
          <pre style={{ whiteSpace: "pre-wrap", fontFamily: "inherit", fontSize: 12, lineHeight: 1.45, background: "#f7fbff", padding: 9, borderRadius: 8 }}>{item.mensaje}</pre>
          <button type="button" onClick={() => copiar(item.mensaje, `prefactura:${item.clave}`)}>{copiado === `prefactura:${item.clave}` ? "✓ Copiado" : "Copiar prefactura"}</button>
          <details style={{ marginTop: 9 }}>
            <summary style={{ cursor: "pointer", fontWeight: 800 }}>Ver pago del driver</summary>
            <pre style={{ whiteSpace: "pre-wrap", fontFamily: "inherit", fontSize: 12, lineHeight: 1.45, background: "#fff8ef", padding: 9, borderRadius: 8 }}>{item.mensajeChofer}</pre>
            <button type="button" onClick={() => copiar(item.mensajeChofer, `chofer:${item.clave}`)}>{copiado === `chofer:${item.clave}` ? "✓ Copiado" : "Copiar pago del driver"}</button>
          </details>
        </details>)}
      </div>
    </div>}
    {whatsapp.resumenesSocio.length > 0 && <div style={{ marginTop: 14 }}>
      <h4 style={{ margin: "0 0 7px" }}>Resumen por socio flotillero</h4>
      <div style={{ display: "grid", gap: 9 }}>
        {whatsapp.resumenesSocio.map((item) => <details key={item.socio} style={{ padding: 10, borderRadius: 10, background: "#fff", border: "1px solid #bfd5e8" }}>
          <summary style={{ cursor: "pointer", fontWeight: 850 }}>{item.titulo} · {moneda(item.total)}</summary>
          <pre style={{ whiteSpace: "pre-wrap", fontFamily: "inherit", fontSize: 12, lineHeight: 1.45, background: "#f7fbff", padding: 9, borderRadius: 8 }}>{item.mensaje}</pre>
          <button type="button" onClick={() => copiar(item.mensaje, `socio:${item.socio}`)}>{copiado === `socio:${item.socio}` ? "✓ Copiado" : "Copiar resumen del socio"}</button>
        </details>)}
      </div>
    </div>}
  </section>;
}

