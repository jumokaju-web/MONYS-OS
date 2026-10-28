import { useEffect, useMemo, useState } from "react";
import { useUser } from "../../../context/UserContext";
import {
  obtenerPagosProveedoresSicar,
  registrarPagosProveedoresSicar,
} from "../../tesoreria/services/pagosProveedoresSicarService.js";
import { obtenerDetallesMovimientosCajaParaAbonos } from "../services/importadorService.js";
import { obtenerMovimientosParaCruceSicar } from "../../tesoreria/services/tesoreriaService.js";
import { cruzarAbonosConMovimientosSicar, detectarPosiblesDuplicadosAbono } from "../utils/conciliarAbonosProveedorSicar.js";

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
      if (fila.metodoPago !== "CH" || fila.estadoCruce !== "COINCIDENCIA_UNICA" || fila.posiblesDuplicados.length > 0) continue;
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

  async function registrarGrupo(grupo) {
    if (!importacionId) {
      setMensaje("Importa primero este reporte para dejar enlazada la evidencia SICAR.");
      return;
    }
    try {
      setGuardandoProveedor(grupo.nombre);
      setErrorCruce("");
      setMensaje("");
      const registros = grupo.items.map(({ fila, detalle }) => ({
        organizationId: organizationId || usuario?.organization_id,
        businessId: businessId || usuario?.business_id,
        branchId,
        importacionId: detalle.importacion_id,
        detalleId: detalle.id,
        proveedorNombre: fila.proveedorNombre,
        tipoAplicacion: "POR_DETERMINAR",
        fechaPago: fila.fecha,
        importePago: fila.monto,
        evidencia: `Importación de abonos ${importacionId}; archivo ${archivoNombre}; renglón ${fila.codigo}; folio ${fila.folioCheque || "sin folio"}; Caja ${fila.caja}; forma ${fila.metodoPago}; movimiento ${detalle.codigo || `renglón ${detalle.numero_fila}`}; aplicación a factura por confirmar.`.slice(0, 500),
      }));
      const guardados = await registrarPagosProveedoresSicar(registros);
      setPagosGuardados((anteriores) => new Set([...anteriores, ...grupo.items.map(({ detalle }) => detalle.id)]));
      setMensaje(`${guardados.length} abono${guardados.length === 1 ? "" : "s"} de ${grupo.nombre} enlazado${guardados.length === 1 ? "" : "s"}. No se redujo el saldo del proveedor; la aplicación a factura sigue por confirmar.`);
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
            const estado = fila.posiblesDuplicados.length > 0
              ? `Posible registro repetido · ${fila.posiblesDuplicados.length} salida${fila.posiblesDuplicados.length === 1 ? "" : "s"} de Tesorería`
              : fila.estadoCruce === "COINCIDENCIA_UNICA"
              ? pagoRegistrado ? "Proveedor ya enlazado" : `Coincidencia única · ${detalle.codigo || `renglón ${detalle.numero_fila}`}`
              : fila.estadoCruce === "AMBIGUA" ? `${fila.coincidencias.length} filas posibles · revisar`
                : "Sin coincidencia exacta";
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
        <strong>Revisión de posible duplicado · {fila.proveedorNombre} · {dinero.format(fila.monto)}</strong>
        {fila.posiblesDuplicados.map((movimiento) => <p key={movimiento.id}>{new Date(movimiento.occurred_at).toLocaleString("es-MX", { timeZone: "America/Mexico_City" })} · {movimiento.concept} · {movimiento.counterparty || "sin referencia"} · la coincidencia no confirma duplicidad.</p>)}
      </article>)}
      {puedeRegistrar && gruposConfirmables.map((grupo) => <button key={grupo.nombre} type="button" disabled={!importacionId || Boolean(guardandoProveedor)} onClick={() => registrarGrupo(grupo)} style={{ margin: "12px 10px 0 0" }}>
        {guardandoProveedor === grupo.nombre ? "Guardando…" : `Enlazar ${grupo.items.length} cheque${grupo.items.length === 1 ? "" : "s"} de ${grupo.nombre} · ${dinero.format(grupo.total)}`}
      </button>)}
      {filas.some((fila) => fila.metodoPago === "EF") && <p>Los pagos en efectivo se conservan en el reporte, pero el registro de atribución actual cubre cheques. No se guardaron como cheques ni se confundieron con gasto operativo.</p>}
      {gruposConfirmables.length === 0 && !cargandoCruce && !errorCruce && <p>Por ahora no hay cheques con coincidencia única disponibles para enlazar.</p>}
      <p>La aplicación a facturas y la diferencia entre abono parcial y liquidación total quedan por confirmar.</p>
    </section>
  );
}
