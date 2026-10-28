import { useEffect, useMemo, useState } from "react";
import { useUser } from "../../../context/UserContext";
import {
  obtenerPagosProveedoresSicar,
  registrarPagosProveedoresSicar,
} from "../../tesoreria/services/pagosProveedoresSicarService.js";
import { obtenerDetallesMovimientosCajaParaAbonos } from "../services/importadorService.js";
import { obtenerMovimientosParaCruceSicar } from "../../tesoreria/services/tesoreriaService.js";
import { cruzarAbonosConMovimientosSicar, detectarPosiblesDuplicadosAbono } from "../utils/conciliarAbonosProveedorSicar.js";
import { prepararRegistrosEnlaceAbonos } from "../utils/prepararRegistrosEnlaceAbonos.js";

const dinero = new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" });
const fechaLocal = (valor) => valor ? new Date(`${valor}T12:00:00`).toLocaleDateString("es-MX") : "Fecha no identificada";

export default function ResumenAbonosProveedores({ resumen, abonos = [], archivoNombre = "Reporte SICAR", importacionId = null, organizationId = null, branchId = null, businessId = null }) {
  const { usuario } = useUser();
  const [detallesMovimiento, setDetallesMovimiento] = useState([]);
  const [movimientosTesoreria, setMovimientosTesoreria] = useState([]);
  const [pagosGuardados, setPagosGuardados] = useState(new Set());
  const [cargandoCruce, setCargandoCruce] = useState(false);
  const [guardandoProveedor, setGuardandoProveedor] = useState("");
  const [errorCruce, setErrorCruce] = useState("");
  const [mensaje, setMensaje] = useState("");

  const desde = useMemo(() => abonos.map((abono) => abono.fecha).filter(Boolean).sort()[0] || "", [abonos]);
  const hasta = useMemo(() => abonos.map((abono) => abono.fecha).filter(Boolean).sort().at(-1) || "", [abonos]);

  useEffect(() => {
    let vigente = true;
    setDetallesMovimiento([]);
    setMovimientosTesoreria([]);
    setPagosGuardados(new Set());
    setErrorCruce("");
    if (!branchId || !desde || !hasta) return () => { vigente = false; };

    setCargandoCruce(true);
    Promise.all([
      obtenerDetallesMovimientosCajaParaAbonos({ branchId, desde, hasta }),
      obtenerMovimientosParaCruceSicar({ branchId, businessId, desde, hasta }),
    ])
      .then(async ([detalles, movimientos]) => {
        if (!vigente) return;
        setDetallesMovimiento(detalles);
        setMovimientosTesoreria(movimientos);
        const importaciones = [...new Set(detalles.map((detalle) => detalle.importacion_id).filter(Boolean))];
        const listas = await Promise.all(importaciones.map((id) => obtenerPagosProveedoresSicar(id)));
        if (!vigente) return;
        setPagosGuardados(new Set(listas.flat().filter((pago) => pago.estado === "ACTIVA").map((pago) => pago.importacion_detalle_id)));
      })
      .catch((error) => {
        if (vigente) setErrorCruce(error?.message || "No fue posible cruzar el reporte con los movimientos de caja.");
      })
      .finally(() => { if (vigente) setCargandoCruce(false); });

    return () => { vigente = false; };
  }, [branchId, businessId, desde, hasta]);

  const filas = useMemo(() => {
    const cruzados = cruzarAbonosConMovimientosSicar(abonos, detallesMovimiento);
    return detectarPosiblesDuplicadosAbono(cruzados, movimientosTesoreria);
  }, [abonos, detallesMovimiento, movimientosTesoreria]);
  const gruposConfirmables = useMemo(() => {
    const grupos = new Map();
    for (const fila of filas) {
      if (fila.metodoPago !== "CH" || fila.estadoCruce !== "COINCIDENCIA_UNICA") continue;
      const detalle = fila.coincidencias[0];
      if (pagosGuardados.has(detalle.id)) continue;
      const nombre = String(fila.proveedorNombre || "").trim();
      if (nombre.length < 2) continue;
      const grupo = grupos.get(nombre) || { nombre, items: [], totalCentavos: 0 };
      grupo.items.push({ fila, detalle });
      grupo.totalCentavos += Math.round(Number(fila.monto) * 100);
      grupos.set(nombre, grupo);
    }
    return [...grupos.values()].map((grupo) => ({ ...grupo, total: grupo.totalCentavos / 100 }));
  }, [filas, pagosGuardados]);

  const cantidadChequesEnlazables = gruposConfirmables.reduce((total, grupo) => total + grupo.items.length, 0);
  const filasCheque = filas.filter((fila) => fila.metodoPago === "CH");
  const cantidadChequesEnlazados = filasCheque.filter((fila) =>
    fila.estadoCruce === "COINCIDENCIA_UNICA" && pagosGuardados.has(fila.coincidencias[0]?.id)
  ).length;
  const cantidadChequesConCruce = filasCheque.filter((fila) => fila.estadoCruce === "COINCIDENCIA_UNICA").length;

  async function registrarGrupos(grupos) {
    if (!importacionId) {
      setMensaje("Importa primero este reporte para dejar enlazada la evidencia SICAR.");
      return;
    }
    try {
      setGuardandoProveedor("todos");
      setErrorCruce("");
      setMensaje("");
      const registros = prepararRegistrosEnlaceAbonos(grupos, {
        organizationId: organizationId || usuario?.organization_id,
        businessId: businessId || usuario?.business_id,
        branchId,
        importacionId,
        archivoNombre,
      });
      const guardados = await registrarPagosProveedoresSicar(registros);
      setPagosGuardados((anteriores) => new Set([...anteriores, ...grupos.flatMap((grupo) => grupo.items.map(({ detalle }) => detalle.id))]));
      const proveedores = [...new Set(grupos.map((grupo) => grupo.nombre))];
      setMensaje(`${guardados.length} cheque${guardados.length === 1 ? "" : "s"} enlazado${guardados.length === 1 ? "" : "s"} con ${proveedores.length} proveedor${proveedores.length === 1 ? "" : "es"}. No se modificaron saldos ni movimientos; la aplicación a facturas queda por confirmar.`);
    } catch (error) {
      setErrorCruce(error?.message || "No se pudo guardar la atribución del proveedor.");
    } finally {
      setGuardandoProveedor("");
    }
  }

  if (!resumen) return null;
  const puedeRegistrar = ["owner", "admin"].includes(String(usuario?.role || "").toLowerCase());

  return (
    <section style={{ width: "100%", maxWidth: 1000, margin: "24px auto 0", padding: 20, boxSizing: "border-box", border: "1px solid #ead5df", borderRadius: 18, background: "#fff" }} aria-label="Resumen de abonos a proveedores SICAR">
      <h2>Abonos a proveedores · SICAR</h2>
      <p>{resumen.cantidad} movimientos · total {dinero.format(resumen.total)} MXN</p>
      <p>Este reporte identifica proveedor, fecha, caja, forma de pago y folio. Importarlo conserva el archivo como evidencia; no crea otra salida ni reduce saldos de proveedores.</p>
      <div style={{ display: "grid", gap: 8, margin: "14px 0" }}>
        {resumen.porProveedor.map((proveedor) => <div key={proveedor.nombre}><strong>{proveedor.nombre}</strong> · {dinero.format(proveedor.total)}</div>)}
      </div>
      <p>{resumen.porMetodo.map((metodo) => `${metodo.cantidad} ${metodo.metodo === "CH" ? "cheques" : metodo.metodo === "EF" ? "pagos en efectivo" : metodo.metodo} · ${dinero.format(metodo.total)}`).join(" · ")}</p>
      {cargandoCruce && <p role="status">Buscando las salidas SICAR exactas por fecha, hora, caja, método e importe…</p>}
      {errorCruce && <p role="alert">{errorCruce}</p>}
      {mensaje && <p role="status">{mensaje}</p>}
      {!importacionId && <p>Importa el archivo para guardar su evidencia. MONYS preparará los vínculos exactos con el reporte “Movimientos de caja”.</p>}
      {filas.some((fila) => fila.estadoCruce === "COINCIDENCIA_UNICA") && <p>Los vínculos propuestos son solo de evidencia. No cambian importes de caja ni saldos de proveedores.</p>}
      <div style={{ overflowX: "auto" }}>
        <table style={{ minWidth: 960, width: "100%", borderCollapse: "collapse" }}>
          <thead><tr>{["Fecha y hora", "Proveedor", "Caja", "Forma", "Folio SICAR", "Referencia", "Importe", "Cruce con movimientos"].map((titulo) => <th key={titulo} scope="col" style={{ textAlign: "left", padding: 8, borderBottom: "1px solid #ead5df" }}>{titulo}</th>)}</tr></thead>
          <tbody>{filas.map((fila) => {
            const detalle = fila.estadoCruce === "COINCIDENCIA_UNICA" ? fila.coincidencias[0] : null;
            const pagoRegistrado = detalle && pagosGuardados.has(detalle.id);
            const estado = fila.estadoCruce === "COINCIDENCIA_UNICA"
              ? pagoRegistrado
                ? "Proveedor ya enlazado"
                : fila.posiblesDuplicados.length > 0
                  ? `Coincidencia SICAR exacta · revisar ${fila.posiblesDuplicados.length} movimiento${fila.posiblesDuplicados.length === 1 ? "" : "s"} de Tesorería`
                  : `Coincidencia única · ${detalle.codigo || `renglón ${detalle.numero_fila}`}`
              : fila.posiblesDuplicados.length > 0
                ? `Coincidencia parecida en Tesorería · no confirma duplicidad`
                : fila.estadoCruce === "AMBIGUA" ? `${fila.coincidencias.length} filas SICAR posibles · revisar`
                  : "Sin coincidencia exacta en movimientos SICAR";
            return <tr key={fila.codigo}>
              <td style={{ padding: 8, borderBottom: "1px solid #f1e8ec" }}>{fechaLocal(fila.fecha)} · {fila.hora || "sin hora"}</td>
              <td style={{ padding: 8, borderBottom: "1px solid #f1e8ec" }}>{fila.proveedorNombre}<small style={{ display: "block" }}>Representante: {fila.representante || "sin dato"}</small></td>
              <td style={{ padding: 8, borderBottom: "1px solid #f1e8ec" }}>{fila.caja || "Sin caja"}</td>
              <td style={{ padding: 8, borderBottom: "1px solid #f1e8ec" }}>{fila.metodoPago === "CH" ? "Cheque" : fila.metodoPago === "EF" ? "Efectivo" : fila.metodoPago}</td>
              <td style={{ padding: 8, borderBottom: "1px solid #f1e8ec" }}>{fila.folioCheque && fila.folioCheque !== "-" ? fila.folioCheque : "Sin folio"}</td>
              <td style={{ padding: 8, borderBottom: "1px solid #f1e8ec" }}>{fila.referencia || "—"}</td>
              <td style={{ padding: 8, borderBottom: "1px solid #f1e8ec" }}>{dinero.format(fila.monto)}</td>
              <td style={{ padding: 8, borderBottom: "1px solid #f1e8ec" }}>{estado}</td>
            </tr>;
          })}</tbody>
        </table>
      </div>
      {filas.filter((fila) => fila.posiblesDuplicados.length > 0).map((fila) => <article key={`duplicado-${fila.codigo}`} role="note" style={{ marginTop: 8, padding: 10, border: "1px solid #edc58c", borderRadius: 10, background: "#fff8ec" }}>
        <strong>Coincidencia para revisar en Tesorería · {fila.proveedorNombre} · {dinero.format(fila.monto)}</strong>
        {fila.posiblesDuplicados.map((movimiento) => <p key={movimiento.id}>{new Date(movimiento.occurred_at).toLocaleString("es-MX", { timeZone: "America/Mexico_City" })} · {movimiento.concept} · {movimiento.counterparty || "sin referencia"} · mismo proveedor, fecha e importe no bastan para confirmar un duplicado.</p>)}
      </article>)}
      {filasCheque.length > 0 && <p role="status" style={{ padding: 12, borderRadius: 10, background: "#f7f1f4" }}>
        Cheques: {filasCheque.length} reportados · {cantidadChequesEnlazados} ya enlazados · {cantidadChequesEnlazables} listos para enlazar
        {cantidadChequesConCruce < filasCheque.length ? ` · ${filasCheque.length - cantidadChequesConCruce} requieren revisión del cruce SICAR` : ""}.
      </p>}
      {puedeRegistrar && cantidadChequesEnlazables > 0 && <button type="button" disabled={!importacionId || Boolean(guardandoProveedor)} onClick={() => registrarGrupos(gruposConfirmables)} style={{ minHeight: 44, padding: "10px 16px", margin: "12px 10px 0 0", border: 0, borderRadius: 9, background: "#6d3553", color: "#fff", fontWeight: 700, cursor: "pointer" }}>
        {guardandoProveedor === "todos" ? "Enlazando…" : `Enlazar ${cantidadChequesEnlazables} cheques exactos`}
      </button>}
      {filas.some((fila) => fila.metodoPago === "EF") && <p>Los pagos en efectivo se conservan en el reporte, pero el registro de atribución actual cubre cheques. No se guardaron como cheques ni se confundieron con gasto operativo.</p>}
      {cantidadChequesEnlazables === 0 && !cargandoCruce && !errorCruce && <p>Por ahora no hay cheques con coincidencia única pendientes de enlace.</p>}
      <p>La aplicación a facturas y la diferencia entre abono parcial y liquidación total quedan por confirmar.</p>
    </section>
  );
}
