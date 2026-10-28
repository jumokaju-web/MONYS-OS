import { useEffect, useState } from "react";
import { obtenerDetallesImportacion } from "../services/importadorService";
import {
  anularConciliacionSicar,
  obtenerConciliacionesSicar,
  registrarConciliacionSicar,
} from "../../tesoreria/services/conciliacionSicarService";
import {
  anularPagoProveedorSicar,
  obtenerPagosProveedoresSicar,
  registrarPagoProveedorSicar,
  registrarPagosProveedoresSicar,
} from "../../tesoreria/services/pagosProveedoresSicarService";
import { agruparChequesPorProveedor } from "../utils/agruparChequesPorProveedor";

const dinero = new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" });
const fecha = (valor) => valor ? new Date(`${valor}T12:00:00`).toLocaleDateString("es-MX") : "Fecha no identificada";

export default function ResumenMovimientosCaja({ resumen, importacionId, organizationId, businessId, branchId }) {
  const [detalles, setDetalles] = useState([]);
  const [conciliaciones, setConciliaciones] = useState([]);
  const [pagos, setPagos] = useState([]);
  const [seleccionesPago, setSeleccionesPago] = useState({});
  const [cargandoVinculos, setCargandoVinculos] = useState(false);
  const [procesando, setProcesando] = useState("");
  const [errorVinculo, setErrorVinculo] = useState("");

  useEffect(() => {
    let activa = true;
    setDetalles([]);
    setConciliaciones([]);
    setPagos([]);
    setErrorVinculo("");
    if (!importacionId) return () => { activa = false; };
    setCargandoVinculos(true);
    Promise.all([obtenerDetallesImportacion(importacionId), obtenerConciliacionesSicar(importacionId), obtenerPagosProveedoresSicar(importacionId)])
      .then(([filas, vinculos, atribuciones]) => {
        if (!activa) return;
        setDetalles(filas);
        setConciliaciones(vinculos);
        setPagos(atribuciones);
      })
      .catch((error) => { if (activa) setErrorVinculo(error?.message || "No se pudieron cargar los vínculos guardados."); })
      .finally(() => { if (activa) setCargandoVinculos(false); });
    return () => { activa = false; };
  }, [importacionId]);

  const detallePorCodigo = new Map(detalles.map((fila) => [fila.codigo, fila]));
  const conciliacionPorDetalle = new Map(conciliaciones.filter((fila) => fila.estado === "ACTIVA").map((fila) => [fila.importacion_detalle_id, fila]));
  const pagoPorDetalle = new Map(pagos.filter((fila) => fila.estado === "ACTIVA").map((fila) => [fila.importacion_detalle_id, fila]));
  const filasChequeRelacion = resumen?.cruceTesoreria?.filas || (resumen?.salidasCheque || []).map((fila) => ({
    codigoSicar: fila.codigo,
    fecha: fila.fecha,
    monto: fila.monto,
    conceptoSicar: fila.concepto,
    cajaSicar: fila.caja,
    candidatos: [],
    proveedoresCandidatos: [],
    estadoCruce: "SIN_COINCIDENCIA",
  }));
  const gruposCheque = agruparChequesPorProveedor(filasChequeRelacion.map((fila, indice) => ({
    fila,
    detalle: detallePorCodigo.get(fila.codigoSicar),
    indice,
  })).filter((item) => !pagoPorDetalle.has(item.detalle?.id)));
  const grupoPorIndice = new Map(gruposCheque.flatMap((grupo) => grupo.items.map((item) => [item.indice, grupo])));

  async function guardarPago(fila, detalle, clave) {
    if (!detalle?.id) return;
    const seleccionado = seleccionesPago[clave] || {};
    const candidato = Number.isInteger(seleccionado.indice) ? fila.proveedoresCandidatos?.[seleccionado.indice] : null;
    const nombre = seleccionado.nombre ?? candidato?.nombre ?? (fila.proveedoresCandidatos?.length === 1 ? fila.proveedoresCandidatos[0].nombre : "");
    const tipo = seleccionado.tipo || "POR_DETERMINAR";
    try {
      setProcesando(`pago:${clave}`);
      setErrorVinculo("");
      await registrarPagoProveedorSicar({
        organizationId, businessId, branchId, importacionId, detalleId: detalle.id,
        proveedorId: candidato?.id || null, proveedorNombre: nombre,
        numeroProveedor: candidato?.numero_proveedor || candidato?.numeroProveedor || null,
        tipoAplicacion: tipo, fechaPago: fila.fecha, importePago: fila.monto,
        evidencia: `Salida de cheque SICAR ${fila.codigoSicar || "sin folio"}; concepto: ${fila.conceptoSicar || "sin concepto"}`.slice(0, 500),
      });
      setPagos(await obtenerPagosProveedoresSicar(importacionId));
    } catch (error) {
      setErrorVinculo(error?.message || "No se pudo guardar el pago a proveedor.");
    } finally {
      setProcesando("");
    }
  }

  async function guardarGrupoCheque(grupo) {
    const tipoAplicacion = seleccionesPago[`grupo:${grupo.clave}`]?.tipo || "POR_DETERMINAR";
    try {
      setProcesando(`grupo:${grupo.clave}`);
      setErrorVinculo("");
      await registrarPagosProveedoresSicar(grupo.items.map(({ fila, detalle }) => ({
        organizationId, businessId, branchId, importacionId, detalleId: detalle.id,
        proveedorId: grupo.proveedor.id || null,
        proveedorNombre: grupo.proveedor.nombre,
        numeroProveedor: grupo.proveedor.numero_proveedor || grupo.proveedor.numeroProveedor || null,
        tipoAplicacion,
        fechaPago: fila.fecha,
        importePago: fila.monto,
        evidencia: `Lote confirmado de salidas por cheque SICAR; folio ${fila.codigoSicar || "sin folio"}; concepto: ${fila.conceptoSicar || "sin concepto"}`.slice(0, 500),
      })));
      setPagos(await obtenerPagosProveedoresSicar(importacionId));
    } catch (error) {
      setErrorVinculo(error?.message || "No se pudo guardar el grupo de cheques.");
    } finally {
      setProcesando("");
    }
  }

  async function corregirPago(pago) {
    const motivo = window.prompt("Explica por qué se corrige este registro. El historial quedará conservado.");
    if (!String(motivo || "").trim()) return;
    try {
      setProcesando(`pago-anular:${pago.id}`);
      setErrorVinculo("");
      await anularPagoProveedorSicar(pago.id, motivo);
      setPagos(await obtenerPagosProveedoresSicar(importacionId));
    } catch (error) {
      setErrorVinculo(error?.message || "No se pudo corregir el registro.");
    } finally {
      setProcesando("");
    }
  }

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
    <p>En Monys Glam, cada salida SICAR con forma de pago “Cheque” corresponde a un pago a proveedor. El reporte permite identificar el pago, pero puede no indicar si fue abono o liquidación total.</p>
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
      <h4 style={{ margin: "0 0 8px" }}>Pagos a proveedores por cheque: {dinero.format(resumen.totalSalidasCheque)} ({resumen.salidasCheque.length})</h4>
      <p style={{ marginTop: 0 }}>Regla confirmada para Monys Glam: toda salida con cheque es un pago a proveedor. {resumen.chequesSinConcepto} no tienen concepto capturado para identificar a cuál proveedor; el importe por sí solo no indica si liquidó toda la deuda o fue un abono.</p>
      <div style={{ overflowX: "auto" }}><table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left" }}>
        <thead><tr><th style={{ padding: 8 }}>Fecha</th><th style={{ padding: 8 }}>Caja</th><th style={{ padding: 8 }}>Importe</th><th style={{ padding: 8 }}>Proveedor / concepto</th><th style={{ padding: 8 }}>Folio SICAR</th></tr></thead>
        <tbody>{resumen.salidasCheque.map((fila, indice) => <tr key={`${fila.codigo}-${indice}`}>
          <td style={{ padding: 8, borderTop: "1px solid #eadfbe" }}>{fecha(fila.fecha)}</td><td style={{ padding: 8, borderTop: "1px solid #eadfbe" }}>{fila.caja}</td><td style={{ padding: 8, borderTop: "1px solid #eadfbe", whiteSpace: "nowrap" }}>{dinero.format(fila.monto)}</td><td style={{ padding: 8, borderTop: "1px solid #eadfbe" }}>{fila.concepto || "No indicado en el reporte"}</td><td style={{ padding: 8, borderTop: "1px solid #eadfbe" }}>{fila.codigo || "Sin folio"}</td>
        </tr>)}</tbody>
      </table></div>
      {resumen.cruceTesoreriaError && <p role="alert">No se pudo consultar Tesorería para comparar: {resumen.cruceTesoreriaError}. El resumen SICAR sigue disponible.</p>}
      {errorVinculo && <p role="alert">{errorVinculo}</p>}
      {importacionId && cargandoVinculos && <p role="status">Consultando vínculos guardados…</p>}
      {filasChequeRelacion.length > 0 && <section style={{ marginTop: 18, paddingTop: 12, borderTop: "1px solid #ead7a9" }} aria-label="Registro de pagos a proveedores">
        <h4>Registro de pagos a proveedores</h4>
        {resumen.cruceTesoreria && <><p>{resumen.cruceTesoreria.candidatasUnicas} coincidencias únicas con Tesorería · {resumen.cruceTesoreria.ambiguas} ambiguas · {resumen.cruceTesoreria.sinCoincidencia} sin coincidencia exacta.</p><p>{resumen.cruceTesoreria.aclaracion} Una coincidencia candidata no modifica ninguno de los registros.</p></>}
        {!resumen.cruceTesoreria && <p>La comparación con Tesorería no estuvo disponible; puedes registrar proveedor y tipo de aplicación directamente desde el reporte SICAR.</p>}
        {gruposCheque.length > 0 && <div style={{ display: "grid", gap: 10, margin: "14px 0" }}>
          <b>Grupos sugeridos · una confirmación por proveedor</b>
          {gruposCheque.map((grupo) => <article key={grupo.clave} style={{ padding: 14, border: "1px solid #d9c4ce", borderRadius: 10, background: "#fff" }}>
            <strong>{grupo.proveedor.nombre}</strong> · {grupo.items.length} cheques · {dinero.format(grupo.total)}
            <details style={{ marginTop: 6 }}><summary>Ver cheques incluidos</summary>{grupo.items.map(({ fila, indice }) => <div key={`${fila.codigoSicar}-${indice}`}>{fila.fecha} · {fila.codigoSicar || "sin folio"} · {dinero.format(fila.monto)}{fila.conceptoSicar ? ` · ${fila.conceptoSicar}` : ""}</div>)}</details>
            <select aria-label={`Aplicación del grupo ${grupo.proveedor.nombre}`} value={seleccionesPago[`grupo:${grupo.clave}`]?.tipo || "POR_DETERMINAR"} onChange={(evento) => setSeleccionesPago((anterior) => ({ ...anterior, [`grupo:${grupo.clave}`]: { tipo: evento.target.value } }))}><option value="POR_DETERMINAR">Abono o liquidación: por confirmar</option><option value="ABONO">Abonos</option><option value="LIQUIDACION">Liquidaciones totales</option></select>
            <button type="button" disabled={Boolean(procesando) || cargandoVinculos} onClick={() => guardarGrupoCheque(grupo)}>{procesando === `grupo:${grupo.clave}` ? "Guardando grupo…" : `Confirmar proveedor y guardar ${grupo.items.length} cheques`}</button>
            <small style={{ display: "block" }}>Confirma solo si todos corresponden a {grupo.proveedor.nombre}. Los saldos no se modifican.</small>
          </article>)}
        </div>}
        {filasChequeRelacion.map((fila, indice) => {
          const detalle = detallePorCodigo.get(fila.codigoSicar);
          const conciliacion = detalle?.id ? conciliacionPorDetalle.get(detalle.id) : null;
          const vinculosAnulados = detalle?.id
            ? conciliaciones.filter((vinculo) => vinculo.importacion_detalle_id === detalle.id && vinculo.estado === "ANULADA")
            : [];
          return <article key={`${fila.codigoSicar}-${indice}`} style={{ padding: "10px 0", borderTop: "1px solid #eadfbe" }}>
          <b>{fila.fecha || "Fecha pendiente"} · {fila.codigoSicar || "Cheque sin folio"} · {dinero.format(fila.monto ?? 0)}</b>
          {fila.conceptoSicar && <p>Concepto en SICAR: {fila.conceptoSicar}</p>}
          {fila.proveedoresCandidatos?.length === 1
            ? <p><b>Proveedor probable:</b> {fila.proveedoresCandidatos[0].nombre}. Coincide con el último reporte de créditos; falta comprobarlo con la evidencia del cheque.</p>
            : fila.proveedoresCandidatos?.length > 1
              ? <p><b>Proveedores posibles:</b> {fila.proveedoresCandidatos.map((proveedor) => proveedor.nombre).join(", ")}. La referencia no distingue cuál recibió el pago.</p>
              : fila.catalogoProveedoresConsultado
                ? <p>Pago a proveedor confirmado por cheque; el concepto no coincide con un proveedor del último reporte cargado.</p>
                : <p>Pago a proveedor confirmado por cheque; MONYS no tiene un reporte de créditos cargado para sugerir el nombre.</p>}
          <p style={{ margin: "4px 0" }}>{fila.estadoCruce === "CANDIDATA_UNICA" ? "Una coincidencia candidata" : fila.estadoCruce === "AMBIGUA" ? `${fila.candidatos.length} coincidencias posibles; revisar antes de vincular` : "Sin coincidencia exacta por fecha e importe"}</p>
          {conciliacion && <p><b>VÍNCULO ACTIVO:</b> confirmado el {new Date(conciliacion.registrado_en).toLocaleString("es-MX", { timeZone: "America/Mexico_City" })} · Tesorería {conciliacion.cash_movement_id}<br /><button type="button" disabled={Boolean(procesando)} onClick={() => anularVinculo(conciliacion)}>{procesando === `anular:${conciliacion.id}` ? "Anulando…" : "Corregir vínculo"}</button></p>}
          {vinculosAnulados.length > 0 && <details><summary>Historial de vínculos corregidos · {vinculosAnulados.length}</summary>{vinculosAnulados.map((vinculo) => <p key={vinculo.id}>{new Date(vinculo.anulado_en).toLocaleString("es-MX", { timeZone: "America/Mexico_City" })} · Motivo: {vinculo.motivo_anulacion}</p>)}</details>}
          {(() => {
            const pago = detalle?.id ? pagoPorDetalle.get(detalle.id) : null;
            const grupo = grupoPorIndice.get(indice);
            const clave = `${fila.codigoSicar}-${indice}`;
            const seleccion = seleccionesPago[clave] || {};
            if (pago) return <p><b>PAGO A PROVEEDOR REGISTRADO:</b> {pago.proveedor_nombre_snapshot} · {pago.tipo_aplicacion === "ABONO" ? "Abono" : pago.tipo_aplicacion === "LIQUIDACION" ? "Liquidación" : "Aplicación por determinar"} · {dinero.format(Number(pago.importe_pago))}<br /><button type="button" disabled={Boolean(procesando)} onClick={() => corregirPago(pago)}>{procesando === `pago-anular:${pago.id}` ? "Corrigiendo…" : "Corregir registro"}</button></p>;
            if (grupo) return <p><b>Incluido en grupo de {grupo.proveedor.nombre}:</b> {grupo.items.length} cheques por {dinero.format(grupo.total)}. Revisa la confirmación del grupo arriba.</p>;
            return <div style={{ margin: "7px 0", padding: 10, borderRadius: 8, background: "#fff" }}>
              <b>Registrar a qué proveedor se pagó</b>
              {fila.proveedoresCandidatos?.length > 0 ? <select aria-label={`Proveedor del cheque ${fila.codigoSicar}`} value={seleccion.indice ?? (fila.proveedoresCandidatos.length === 1 ? "0" : "")} onChange={(evento) => {
                const indiceCandidato = evento.target.value === "" ? null : Number(evento.target.value);
                const candidatoSeleccionado = Number.isInteger(indiceCandidato) ? fila.proveedoresCandidatos[indiceCandidato] : null;
                setSeleccionesPago((anterior) => ({ ...anterior, [clave]: { ...anterior[clave], indice: indiceCandidato, nombre: candidatoSeleccionado?.nombre || "" } }));
              }}><option value="">Selecciona proveedor…</option>{fila.proveedoresCandidatos.map((item, posicion) => <option key={item.id || `${item.nombre}-${posicion}`} value={posicion}>{item.nombre} · saldo reportado {item.saldoReportado == null ? "sin saldo" : dinero.format(item.saldoReportado)}</option>)}</select>
                : <input aria-label={`Proveedor del cheque ${fila.codigoSicar}`} placeholder="Nombre del proveedor" value={seleccion.nombre || ""} onChange={(evento) => setSeleccionesPago((anterior) => ({ ...anterior, [clave]: { ...anterior[clave], id: "", nombre: evento.target.value } }))} />}
              <select aria-label={`Aplicación del cheque ${fila.codigoSicar}`} value={seleccion.tipo || "POR_DETERMINAR"} onChange={(evento) => setSeleccionesPago((anterior) => ({ ...anterior, [clave]: { ...anterior[clave], tipo: evento.target.value } }))}><option value="POR_DETERMINAR">Abono o liquidación: por confirmar</option><option value="ABONO">Abono</option><option value="LIQUIDACION">Liquidación total</option></select>
              <button type="button" disabled={Boolean(procesando) || cargandoVinculos || !detalle?.id || !fila.fecha || !(Number(fila.monto) > 0)} onClick={() => guardarPago(fila, detalle, clave)}>{procesando === `pago:${clave}` ? "Guardando…" : "Guardar pago a proveedor"}</button>
              <small style={{ display: "block" }}>Esto guarda el historial; no cambia el saldo del reporte ni autoriza nuevos pagos.</small>
            </div>;
          })()}
          {!conciliacion && fila.candidatos.map((candidato) => <div key={candidato.id} style={{ margin: "7px 0", padding: 10, borderRadius: 8, background: "#fff" }}>
            <small style={{ display: "block" }}>{candidato.concepto} · {candidato.estado} · {candidato.categoria} · {candidato.alcance} · {candidato.recibo}</small>
            {candidato.palabrasCoincidentes?.length > 0
              ? <small style={{ display: "block" }}>Texto parecido con SICAR: {candidato.palabrasCoincidentes.join(", ")}. Sigue siendo una candidata; confirma el comprobante antes de vincular.</small>
              : fila.conceptoSicar && <small style={{ display: "block" }}>La fecha y el importe coinciden, pero el texto no confirma el mismo beneficiario.</small>}
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
