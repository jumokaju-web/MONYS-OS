import { useCallback, useEffect, useMemo, useState } from "react";
import {
  anularMovimientoFinancieroRH,
  listarMovimientosFinancierosRH,
  marcarMovimientoPagadoRH,
  registrarMovimientoFinancieroRH,
  registrarRecuperacionRH,
} from "../../services/pagosRHService";
import { resumirPagosRH, saldoPorRecuperarMovimiento } from "../../shared/resumenPagosRH";

const inicial = { empleadoId: "", tipo: "NOMINA", monto: "", concepto: "", periodoDesde: "", periodoHasta: "" };
const campo = { width: "100%", boxSizing: "border-box", padding: "9px 10px", border: "1px solid #d9dce5", borderRadius: 9, background: "#fff", font: "inherit" };
const etiquetas = { NOMINA: "Nómina", COMISION: "Comisión", ANTICIPO: "Anticipo", PRESTAMO: "Préstamo" };

function moneda(valor) {
  return new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" }).format(Number(valor) || 0);
}

function fecha(valor) {
  return valor ? new Intl.DateTimeFormat("es-MX", { dateStyle: "medium", timeZone: "America/Mexico_City" }).format(new Date(valor)) : "";
}

export default function CentroPagosRH({ branchId, empleados = [] }) {
  const [movimientos, setMovimientos] = useState([]);
  const [formulario, setFormulario] = useState(inicial);
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState("");
  const [aviso, setAviso] = useState("");
  const [recuperandoId, setRecuperandoId] = useState("");
  const [recuperacion, setRecuperacion] = useState({ monto: "", metodo: "DESCUENTO_NOMINA", nota: "" });

  const cargar = useCallback(async () => {
    if (!branchId) { setMovimientos([]); setCargando(false); return; }
    setCargando(true);
    try { setMovimientos(await listarMovimientosFinancierosRH(branchId)); setError(""); }
    catch (err) { setError(err?.message || "No fue posible cargar los movimientos de personal."); }
    finally { setCargando(false); }
  }, [branchId]);

  useEffect(() => {
    cargar();
    const actualizar = () => cargar();
    window.addEventListener("monys:rh-movimientos", actualizar);
    return () => window.removeEventListener("monys:rh-movimientos", actualizar);
  }, [cargar]);

  const resumen = useMemo(() => resumirPagosRH(movimientos), [movimientos]);
  const empleadosActivos = empleados.filter((item) => item.active);
  const requierePeriodo = formulario.tipo === "NOMINA";

  async function registrar(evento) {
    evento.preventDefault();
    setError(""); setAviso("");
    if (!formulario.empleadoId || !formulario.monto || !formulario.concepto.trim()) {
      setError("Selecciona empleada y captura monto y concepto."); return;
    }
    if (requierePeriodo && (!formulario.periodoDesde || !formulario.periodoHasta)) {
      setError("La nómina requiere periodo desde y hasta."); return;
    }
    setGuardando(true);
    try {
      await registrarMovimientoFinancieroRH(formulario);
      setFormulario(inicial);
      setAviso("Movimiento registrado como pendiente. Todavía no se considera pagado.");
      await cargar();
    } catch (err) { setError(err?.message || "No fue posible registrar el movimiento."); }
    finally { setGuardando(false); }
  }

  async function confirmarPago(movimiento) {
    const referencia = window.prompt(`Referencia o comprobante del pago de ${etiquetas[movimiento.tipo] || movimiento.tipo} a ${movimiento.empleados?.nombre || "la empleada"}:`);
    if (!String(referencia || "").trim()) return;
    if (!window.confirm(`¿Confirmar ${moneda(movimiento.monto)} como pagado? Esta acción quedará registrada.`)) return;
    try {
      setError(""); setAviso("");
      await marcarMovimientoPagadoRH({ movimientoId: movimiento.id, referencia });
      setAviso("Pago confirmado con su referencia.");
      await cargar();
    } catch (err) { setError(err?.message || "No fue posible confirmar el pago."); }
  }

  async function anular(movimiento) {
    const motivo = window.prompt("Escribe por qué se anula este registro. El movimiento permanecerá en el historial:");
    if (!String(motivo || "").trim()) return;
    if (!window.confirm("¿Anular este registro y conservarlo en el historial?")) return;
    try {
      setError(""); setAviso("");
      await anularMovimientoFinancieroRH({ movimientoId: movimiento.id, motivo });
      setAviso("Registro anulado; el historial se conservó.");
      await cargar();
    } catch (err) { setError(err?.message || "No fue posible anular el registro."); }
  }

  async function guardarRecuperacion(evento, movimiento) {
    evento.preventDefault();
    try {
      setError(""); setAviso("");
      await registrarRecuperacionRH({ movimientoId: movimiento.id, ...recuperacion });
      setRecuperandoId(""); setRecuperacion({ monto: "", metodo: "DESCUENTO_NOMINA", nota: "" });
      setAviso("Recuperación registrada. No se creó un descuento automático de nómina.");
      await cargar();
    } catch (err) { setError(err?.message || "No fue posible registrar la recuperación."); }
  }

  return <section style={{ marginTop: 28, padding: 22, borderRadius: 18, background: "linear-gradient(135deg,#fff 0%,#f8f5ff 100%)", border: "1px solid #d9ccef" }}>
    <p style={{ margin: "0 0 6px", color: "#65408c", fontWeight: 800, letterSpacing: ".08em" }}>MONYS OS · CONTROL DE PERSONAL</p>
    <h3 style={{ margin: 0, fontSize: 23 }}>Pagos, anticipos y préstamos</h3>
    <p style={{ color: "#626875" }}>Primero se registra el pendiente; solo cambia a pagado al confirmar la referencia. Los anticipos y préstamos muestran saldo por recuperar y nunca se descuentan automáticamente.</p>

    {error && <p role="alert" style={{ padding: 11, borderRadius: 9, background: "#fff1f1", color: "#982c2c" }}>{error}</p>}
    {aviso && <p role="status" style={{ padding: 11, borderRadius: 9, background: "#effaf3", color: "#23663a" }}>{aviso}</p>}

    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(160px,1fr))", gap: 9, margin: "14px 0" }}>
      {[["Pendiente de confirmar", resumen.pendienteAutorizar], ["Nómina pagada", resumen.nominaPagada], ["Comisiones pagadas", resumen.comisionesPagadas], ["Por recuperar", resumen.porRecuperar]].map(([titulo, valor]) => <div key={titulo} style={{ padding: 12, borderRadius: 11, background: "#fff", border: "1px solid #e4ddef" }}><small style={{ color: "#6b6571" }}>{titulo}</small><strong style={{ display: "block", marginTop: 4, fontSize: 18, color: "#543474" }}>{moneda(valor)}</strong></div>)}
    </div>

    <form onSubmit={registrar} style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(170px,1fr))", gap: 9, padding: 13, borderRadius: 12, background: "#fff" }}>
      <label>Empleada<select style={campo} value={formulario.empleadoId} onChange={(e) => setFormulario((f) => ({ ...f, empleadoId: e.target.value }))}><option value="">Seleccionar</option>{empleadosActivos.map((item) => <option value={item.id} key={item.id}>{item.nombre}</option>)}</select></label>
      <label>Tipo<select style={campo} value={formulario.tipo} onChange={(e) => setFormulario((f) => ({ ...f, tipo: e.target.value }))}><option value="NOMINA">Nómina</option><option value="ANTICIPO">Anticipo</option><option value="PRESTAMO">Préstamo</option></select></label>
      <label>Monto<input style={campo} type="number" min="0.01" step="0.01" value={formulario.monto} onChange={(e) => setFormulario((f) => ({ ...f, monto: e.target.value }))} /></label>
      <label>Concepto<input style={campo} value={formulario.concepto} placeholder="Ej. semana del 5 al 11" onChange={(e) => setFormulario((f) => ({ ...f, concepto: e.target.value }))} /></label>
      {requierePeriodo && <><label>Desde<input style={campo} type="date" value={formulario.periodoDesde} onChange={(e) => setFormulario((f) => ({ ...f, periodoDesde: e.target.value }))} /></label><label>Hasta<input style={campo} type="date" value={formulario.periodoHasta} onChange={(e) => setFormulario((f) => ({ ...f, periodoHasta: e.target.value }))} /></label></>}
      <button disabled={guardando} style={{ alignSelf: "end", padding: 11, border: 0, borderRadius: 9, background: "#65408c", color: "#fff", fontWeight: 800 }}>{guardando ? "Registrando…" : "Registrar pendiente"}</button>
    </form>

    <div style={{ display: "grid", gap: 9, marginTop: 14 }}>
      {cargando ? <p>Cargando historial financiero…</p> : movimientos.length === 0 ? <p>No hay movimientos registrados todavía.</p> : movimientos.map((movimiento) => {
        const saldo = saldoPorRecuperarMovimiento(movimiento);
        return <article key={movimiento.id} style={{ padding: 13, borderRadius: 12, background: "#fff", border: "1px solid #e4ddef" }}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}><div><strong>{movimiento.empleados?.nombre || "Empleada"} · {etiquetas[movimiento.tipo] || movimiento.tipo}</strong><p style={{ margin: "4px 0", color: "#686371" }}>{movimiento.concepto}{movimiento.periodo_desde ? ` · ${movimiento.periodo_desde} a ${movimiento.periodo_hasta}` : ""}</p><small>{movimiento.estado} · registrado {fecha(movimiento.created_at)}{movimiento.referencia_pago ? ` · ref. ${movimiento.referencia_pago}` : ""}</small></div><strong style={{ fontSize: 18 }}>{moneda(movimiento.monto)}</strong></div>
          {saldo > 0 && <p style={{ color: "#8b5a11", fontWeight: 700 }}>Saldo por recuperar: {moneda(saldo)}</p>}
          {movimiento.motivo_anulacion && <p style={{ color: "#983333" }}>Motivo de anulación: {movimiento.motivo_anulacion}</p>}
          <div style={{ display: "flex", gap: 7, flexWrap: "wrap", marginTop: 8 }}>
            {movimiento.estado === "PENDIENTE" && <button type="button" onClick={() => confirmarPago(movimiento)}>Confirmar pago</button>}
            {saldo > 0 && <button type="button" onClick={() => setRecuperandoId(movimiento.id)}>Registrar recuperación</button>}
            {movimiento.estado !== "ANULADO" && <button type="button" onClick={() => anular(movimiento)}>Anular con motivo</button>}
          </div>
          {recuperandoId === movimiento.id && <form onSubmit={(e) => guardarRecuperacion(e, movimiento)} style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(150px,1fr))", gap: 8, marginTop: 10 }}><input style={campo} type="number" min="0.01" max={saldo} step="0.01" placeholder="Monto recuperado" value={recuperacion.monto} onChange={(e) => setRecuperacion((r) => ({ ...r, monto: e.target.value }))} /><select style={campo} value={recuperacion.metodo} onChange={(e) => setRecuperacion((r) => ({ ...r, metodo: e.target.value }))}><option value="DESCUENTO_NOMINA">Descuento de nómina</option><option value="DEPOSITO">Depósito</option><option value="EFECTIVO">Efectivo</option><option value="OTRO">Otro</option></select><input style={campo} placeholder="Nota o referencia" value={recuperacion.nota} onChange={(e) => setRecuperacion((r) => ({ ...r, nota: e.target.value }))} /><button>Guardar recuperación</button></form>}
        </article>;
      })}
    </div>
  </section>;
}
