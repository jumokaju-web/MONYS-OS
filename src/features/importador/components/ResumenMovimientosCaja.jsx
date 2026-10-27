import { useEffect, useState } from "react";
import { obtenerDetallesImportacion } from "../services/importadorService";
import {
  anularConciliacionSicar,
  obtenerConciliacionesSicar,
  registrarConciliacionSicar,
} from "../../tesoreria/services/conciliacionSicarService";

const dinero = new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" });
const fecha = (valor) => valor ? new Date(`${valor}T12:00:00`).toLocaleDateString("es-MX") : "Fecha no identificada";

export default function ResumenMovimientosCaja({ resumen, importacionId, organizationId, businessId, branchId }) {
  const [detalles, setDetalles] = useState([]);
  const [conciliaciones, setConciliaciones] = useState([]);
  const [cargandoVinculos, setCargandoVinculos] = useState(false);
  const [procesando, setProcesando] = useState("");
  const [errorVinculo, setErrorVinculo] = useState("");

  useEffect(() => {
    let activa = true;
    setDetalles([]);
    setConciliaciones([]);
    setErrorVinculo("");
    if (!importacionId) return () => { activa = false; };
    setCargandoVinculos(true);
    Promise.all([obtenerDetallesImportacion(importacionId), obtenerConciliacionesSicar(importacionId)])
      .then(([filas, vinculos]) => {
        if (!activa) return;
        setDetalles(filas);
        setConciliaciones(vinculos);
      })
      .catch((error) => { if (activa) setErrorVinculo(error?.message || "No se pudieron cargar los vínculos guardados."); })
      .finally(() => { if (activa) setCargandoVinculos(false); });
    return () => { activa = false; };
  }, [importacionId]);

  const detallePorCodigo = new Map(detalles.map((fila) => [fila.codigo, fila]));
  const conciliacionPorDetalle = new Map(conciliaciones.filter((fila) => fila.estado === "ACTIVA").map((fila) => [fila.importacion_detalle_id, fila]));

  async function confirmarVinculo(fila, candidato) {
    const detalle = detallePorCodigo.get(fila.codigoSicar);
    if (!detalle?.id || !importacionId) return;
    if (!window.confirm(`Confirma que ${fila.fecha} · ${dinero.format(fila.monto)} por cheque en ${fila.cajaSicar} corresponde al registro “${candidato.concepto}” de Tesorería. El vínculo no cambia saldos, no liquida al proveedor y no borra movimientos.`)) return;
    try {
      setProcesando(candidato.id);
      setErrorVinculo("");
      await registrarConciliacionSicar({ organizationId, businessId, branchId, importacionId, detalleId: detalle.id, movimiento: candidato, fecha: fila.fecha, monto: fila.monto });
      setConciliaciones(await obtenerConciliacionesSicar(importacionId));
    } catch (error) {
      setErrorVinculo(error?.message || "No se pudo guardar el vínculo.");
    } finally {
      setProcesando("");
    }
  }

  async function anularVinculo(conciliacion) {
    const motivo = window.prompt("Explica por qué se corrige este vínculo. El historial se conservará.");
    if (!String(motivo || "").trim()) return;
    if (motivo.trim().length < 5 || motivo.trim().length > 500) {
      setErrorVinculo("El motivo debe tener de 5 a 500 caracteres.");
      return;
    }
    try {
      setProcesando(`anular:${conciliacion.id}`);
      setErrorVinculo("");
      await anularConciliacionSicar(conciliacion.id, motivo);
      setConciliaciones(await obtenerConciliacionesSicar(importacionId));
    } catch (error) {
      setErrorVinculo(error?.message || "No se pudo anular el vínculo.");
    } finally {
      setProcesando("");
    }
  }

  if (!resumen || resumen.tipoResumen !== "movimientos_caja") return null;

  return <section style={{ width: "100%", maxWidth: 1000, margin: "24px auto 0", padding: 20, boxSizing: "border-box", border: "1px solid #ead5df", borderRadius: 18, background: "#fff" }} aria-label="Resumen de movimientos de caja SICAR">
    <h3 style={{ marginTop: 0 }}>Salidas y entradas registradas en SICAR</h3>
    <p>Son movimientos del reporte de caja; no equivalen automáticamente a ventas, gastos ni pagos a proveedores.</p>
    <div style={{ overflowX: "auto" }}>
      <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left" }}>
        <thead><tr><th style={{ padding: 8 }}>Tipo</th><th style={{ padding: 8 }}>Forma de pago</th><th style={{ padding: 8 }}>Movimientos</th><th style={{ padding: 8 }}>Importe</th></tr></thead>
        <tbody>{resumen.grupos.map((grupo) => <tr key={`${grupo.tipo}-${grupo.metodo}`}>
          <td style={{ padding: 8, borderTop: "1px solid #eee" }}>{grupo.tipo === "SALIDA" ? "Salida" : "Entrada"}</td>
          <td style={{ padding: 8, borderTop: "1px solid #eee" }}>{grupo.metodo}</td>
          <td style={{ padding: 8, borderTop: "1px solid #eee" }}>{grupo.movimientos}</td>
          <td style={{ padding: 8, borderTop: "1px solid #eee", fontVariantNumeric: "tabular-nums" }}>{dinero.format(grupo.importe)}</td>
        </tr>)}</tbody>
      </table>
    </div>
    {resumen.salidasCheque.length > 0 && <div style={{ marginTop: 20, padding: 16, borderRadius: 12, background: "#fff8e8", border: "1px solid #ead7a9" }}>
      <h4 style={{ margin: "0 0 8px" }}>Salidas con cheque: {dinero.format(resumen.totalSalidasCheque)} ({resumen.salidasCheque.length})</h4>
      <p style={{ marginTop: 0 }}>SICAR indica que estas salidas fueron por cheque. {resumen.chequesSinConcepto} no tienen concepto capturado. MONYS OS no las atribuye automáticamente a un proveedor aunque el movimiento sea cheque.</p>
      <div style={{ overflowX: "auto" }}><table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left" }}>
        <thead><tr><th style={{ padding: 8 }}>Fecha</th><th style={{ padding: 8 }}>Caja</th><th style={{ padding: 8 }}>Importe</th><th style={{ padding: 8 }}>Concepto / beneficiario</th><th style={{ padding: 8 }}>Folio SICAR</th></tr></thead>
        <tbody>{resumen.salidasCheque.map((fila, indice) => <tr key={`${fila.codigo}-${indice}`}>
          <td style={{ padding: 8, borderTop: "1px solid #eadfbe" }}>{fecha(fila.fecha)}</td><td style={{ padding: 8, borderTop: "1px solid #eadfbe" }}>{fila.caja}</td><td style={{ padding: 8, borderTop: "1px solid #eadfbe", whiteSpace: "nowrap" }}>{dinero.format(fila.monto)}</td><td style={{ padding: 8, borderTop: "1px solid #eadfbe" }}>{fila.concepto || "No indicado en el reporte"}</td><td style={{ padding: 8, borderTop: "1px solid #eadfbe" }}>{fila.codigo || "Sin folio"}</td>
        </tr>)}</tbody>
      </table></div>
      {resumen.cruceTesoreriaError && <p role="alert">No se pudo consultar Tesorería para comparar: {resumen.cruceTesoreriaError}. El resumen SICAR sigue disponible.</p>}
      {errorVinculo && <p role="alert">{errorVinculo}</p>}
      {importacionId && cargandoVinculos && <p role="status">Consultando vínculos guardados…</p>}
      {resumen.cruceTesoreria && <section style={{ marginTop: 18, paddingTop: 12, borderTop: "1px solid #ead7a9" }} aria-label="Coincidencias candidatas con Tesorería">
        <h4>Coincidencias candidatas en Tesorería</h4>
        <p>{resumen.cruceTesoreria.candidatasUnicas} candidatas únicas · {resumen.cruceTesoreria.ambiguas} ambiguas · {resumen.cruceTesoreria.sinCoincidencia} sin coincidencia exacta.</p>
        <p>{resumen.cruceTesoreria.aclaracion} Una coincidencia candidata no modifica ninguno de los registros.</p>
        {resumen.cruceTesoreria.filas.map((fila, indice) => {
          const detalle = detallePorCodigo.get(fila.codigoSicar);
          const conciliacion = detalle?.id ? conciliacionPorDetalle.get(detalle.id) : null;
          const vinculosAnulados = detalle?.id
            ? conciliaciones.filter((vinculo) => vinculo.importacion_detalle_id === detalle.id && vinculo.estado === "ANULADA")
            : [];
          return <article key={`${fila.codigoSicar}-${indice}`} style={{ padding: "10px 0", borderTop: "1px solid #eadfbe" }}>
          <b>{fila.fecha || "Fecha pendiente"} · {fila.codigoSicar || "Cheque sin folio"} · {dinero.format(fila.monto ?? 0)}</b>
          <p style={{ margin: "4px 0" }}>{fila.estadoCruce === "CANDIDATA_UNICA" ? "Una coincidencia candidata" : fila.estadoCruce === "AMBIGUA" ? `${fila.candidatos.length} coincidencias posibles; revisar antes de vincular` : "Sin coincidencia exacta por fecha e importe"}</p>
          {conciliacion && <p><b>VÍNCULO ACTIVO:</b> confirmado el {new Date(conciliacion.registrado_en).toLocaleString("es-MX", { timeZone: "America/Mexico_City" })} · Tesorería {conciliacion.cash_movement_id}<br /><button type="button" disabled={Boolean(procesando)} onClick={() => anularVinculo(conciliacion)}>{procesando === `anular:${conciliacion.id}` ? "Anulando…" : "Corregir vínculo"}</button></p>}
          {vinculosAnulados.length > 0 && <details><summary>Historial de vínculos corregidos · {vinculosAnulados.length}</summary>{vinculosAnulados.map((vinculo) => <p key={vinculo.id}>{new Date(vinculo.anulado_en).toLocaleString("es-MX", { timeZone: "America/Mexico_City" })} · Motivo: {vinculo.motivo_anulacion}</p>)}</details>}
          {!conciliacion && fila.candidatos.map((candidato) => <div key={candidato.id} style={{ margin: "7px 0", padding: 10, borderRadius: 8, background: "#fff" }}>
            <small style={{ display: "block" }}>{candidato.concepto} · {candidato.estado} · {candidato.categoria} · {candidato.alcance} · {candidato.recibo}</small>
            {importacionId && detalle?.id
              ? <button type="button" disabled={Boolean(procesando) || cargandoVinculos} onClick={() => confirmarVinculo(fila, candidato)}>{procesando === candidato.id ? "Guardando vínculo…" : "Confirmar que son el mismo movimiento"}</button>
              : <small>Importa primero el reporte para guardar un vínculo con historial.</small>}
          </div>)}
        </article>;
        })}
      </section>}
    </div>}
  </section>;
}
