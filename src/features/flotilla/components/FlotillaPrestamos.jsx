import { useCallback, useEffect, useMemo, useState } from "react";
import {
  crearPrestamoFlotilla,
  obtenerPrestamosFlotilla,
  registrarAbonoPrestamoFlotilla,
  suscribirseAOperacionFlotilla,
} from "./services/operacionFlotilla";

function fechaMexico() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Mexico_City" }).format(new Date());
}

function moneda(valor) {
  return new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" }).format(Number(valor) || 0);
}

const campo = { width: "100%", boxSizing: "border-box", marginTop: 4, padding: 8, border: "1px solid #d7c9af", borderRadius: 8 };

export default function FlotillaPrestamos({ soloConsulta = false }) {
  const [prestamos, setPrestamos] = useState([]);
  const [formulario, setFormulario] = useState({ tipoBeneficiario: "FLOTISTA", beneficiarioNombre: "Kary", monto: "", concepto: "", fecha: fechaMexico() });
  const [abonos, setAbonos] = useState({});
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState("");
  const [error, setError] = useState("");

  const cargar = useCallback(async ({ silencioso = false } = {}) => {
    try {
      if (!silencioso) setCargando(true);
      setError("");
      setPrestamos(await obtenerPrestamosFlotilla());
    } catch (errorCarga) {
      setError(errorCarga?.message || "No fue posible cargar los préstamos.");
    } finally {
      if (!silencioso) setCargando(false);
    }
  }, []);

  useEffect(() => {
    cargar();
    return suscribirseAOperacionFlotilla({ onCambio: () => cargar({ silencioso: true }) });
  }, [cargar]);

  const totales = useMemo(() => prestamos.reduce((resultado, prestamo) => ({
    saldo: resultado.saldo + (prestamo.estado === "PENDIENTE" ? Number(prestamo.saldo) || 0 : 0),
    pendientes: resultado.pendientes + (prestamo.estado === "PENDIENTE" ? 1 : 0),
  }), { saldo: 0, pendientes: 0 }), [prestamos]);

  async function crear(evento) {
    evento.preventDefault();
    try {
      setGuardando("NUEVO");
      setError("");
      await crearPrestamoFlotilla(formulario);
      setFormulario((actual) => ({ ...actual, monto: "", concepto: "" }));
      await cargar({ silencioso: true });
    } catch (errorGuardado) {
      setError(errorGuardado?.message || "No fue posible registrar el préstamo.");
    } finally {
      setGuardando("");
    }
  }

  async function abonar(prestamo) {
    const datos = abonos[prestamo.id] || {};
    try {
      setGuardando(prestamo.id);
      setError("");
      await registrarAbonoPrestamoFlotilla({ prestamoId: prestamo.id, monto: datos.monto, observaciones: datos.observaciones, fecha: fechaMexico() });
      setAbonos((actual) => ({ ...actual, [prestamo.id]: { monto: "", observaciones: "" } }));
      await cargar({ silencioso: true });
    } catch (errorAbono) {
      setError(errorAbono?.message || "No fue posible registrar el abono.");
    } finally {
      setGuardando("");
    }
  }

  const nombre = formulario.tipoBeneficiario === "FLOTISTA"
    ? <select value={formulario.beneficiarioNombre} onChange={(e) => setFormulario((actual) => ({ ...actual, beneficiarioNombre: e.target.value }))} style={campo}><option>Kary</option><option>Chory</option><option>Abraham</option></select>
    : <input value={formulario.beneficiarioNombre} onChange={(e) => setFormulario((actual) => ({ ...actual, beneficiarioNombre: e.target.value }))} placeholder="Nombre de la empleada o empleado" style={campo} />;

  return <section style={{ marginTop: 16, padding: 13, borderRadius: 14, background: "#fffaf0", border: "1px solid #e2cfaa" }}>
    <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
      <div><small style={{ color: "#7c5b1d", fontWeight: 900 }}>PRÉSTAMOS Y ABONOS</small><h3 style={{ margin: "4px 0" }}>Empleados y flotistas</h3></div>
      <b>{totales.pendientes} pendientes · {moneda(totales.saldo)}</b>
    </div>
    <p style={{ fontSize: 12, color: "#725f3a" }}>Si una gasolina no tiene ticket, tablero antes y tablero después aprobados, MONYS crea aquí un préstamo personal automático al chofer. Los préstamos manuales pueden ser para empleados o para Kary, Chory y Abraham.</p>

    {!soloConsulta && <form onSubmit={crear} style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(150px,1fr))", gap: 8 }}>
      <label style={{ fontSize: 11, fontWeight: 800 }}>Tipo<select value={formulario.tipoBeneficiario} onChange={(e) => setFormulario((actual) => ({ ...actual, tipoBeneficiario: e.target.value, beneficiarioNombre: e.target.value === "FLOTISTA" ? "Kary" : "" }))} style={campo}><option value="FLOTISTA">Flotista</option><option value="EMPLEADO">Empleado</option></select></label>
      <label style={{ fontSize: 11, fontWeight: 800 }}>Beneficiario{nombre}</label>
      <label style={{ fontSize: 11, fontWeight: 800 }}>Monto<input type="number" min="0.01" step="0.01" value={formulario.monto} onChange={(e) => setFormulario((actual) => ({ ...actual, monto: e.target.value }))} style={campo} /></label>
      <label style={{ fontSize: 11, fontWeight: 800 }}>Fecha<input type="date" value={formulario.fecha} onChange={(e) => setFormulario((actual) => ({ ...actual, fecha: e.target.value }))} style={campo} /></label>
      <label style={{ fontSize: 11, fontWeight: 800, gridColumn: "1 / -1" }}>Motivo<input value={formulario.concepto} onChange={(e) => setFormulario((actual) => ({ ...actual, concepto: e.target.value }))} placeholder="Qué se prestó y por qué" style={campo} /></label>
      <button type="submit" disabled={guardando === "NUEVO"}>{guardando === "NUEVO" ? "Guardando…" : "Registrar préstamo"}</button>
    </form>}

    {error && <p role="alert" style={{ color: "#9a3425", fontWeight: 800 }}>{error}</p>}
    {cargando ? <p>Consultando préstamos…</p> : <div style={{ display: "grid", gap: 8, marginTop: 12 }}>
      {prestamos.map((prestamo) => <article key={prestamo.id} style={{ padding: 10, borderRadius: 10, background: "#fff", border: "1px solid #e2cfaa" }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}><b>{prestamo.beneficiario_nombre}</b><b>{prestamo.estado} · saldo {moneda(prestamo.saldo)}</b></div>
        <small>{prestamo.tipo_beneficiario} · {prestamo.fecha} · original {moneda(prestamo.monto_original)}{prestamo.automatico ? " · automático por gasolina" : ""}</small>
        <p style={{ margin: "5px 0", fontSize: 12 }}>{prestamo.concepto}</p>
        {!soloConsulta && prestamo.estado === "PENDIENTE" && <div style={{ display: "grid", gridTemplateColumns: "minmax(100px,150px) 1fr auto", gap: 7 }}>
          <input aria-label={`Abono para ${prestamo.beneficiario_nombre}`} type="number" min="0.01" max={prestamo.saldo} step="0.01" placeholder="Abono" value={abonos[prestamo.id]?.monto || ""} onChange={(e) => setAbonos((actual) => ({ ...actual, [prestamo.id]: { ...actual[prestamo.id], monto: e.target.value } }))} style={campo} />
          <input aria-label={`Nota del abono para ${prestamo.beneficiario_nombre}`} placeholder="Nota del abono" value={abonos[prestamo.id]?.observaciones || ""} onChange={(e) => setAbonos((actual) => ({ ...actual, [prestamo.id]: { ...actual[prestamo.id], observaciones: e.target.value } }))} style={campo} />
          <button type="button" disabled={guardando === prestamo.id || !abonos[prestamo.id]?.monto} onClick={() => abonar(prestamo)}>Abonar</button>
        </div>}
        {prestamo.abonos?.length > 0 && <small style={{ display: "block", marginTop: 7 }}>Abonado: {moneda(prestamo.abonos.reduce((total, abono) => total + Number(abono.monto || 0), 0))} en {prestamo.abonos.length} movimiento(s).</small>}
      </article>)}
      {prestamos.length === 0 && <p style={{ color: "#725f3a" }}>Todavía no hay préstamos registrados.</p>}
    </div>}
  </section>;
}
