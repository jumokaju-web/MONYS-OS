import { useCallback, useEffect, useMemo, useState } from "react";
import {
  confirmarMovimientoChofer,
  guardarCorteRental,
  obtenerCorteRental,
  obtenerOperacionFlotillaEnVivo,
  suscribirseAOperacionFlotilla,
} from "./services/operacionFlotilla";
import { calcularRepartoRental } from "../utils/operacionFlotilla";
import FlotillaAccesosChofer from "./FlotillaAccesosChofer";

function fechaMexico() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Mexico_City" }).format(new Date());
}

function moneda(valor) {
  return new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" }).format(Number(valor) || 0);
}

const tarjeta = {
  background: "#fff",
  border: "1px solid #d5e5f1",
  borderRadius: "14px",
  padding: "13px",
};

export default function FlotillaOperacionEnVivo() {
  const [fecha, setFecha] = useState(fechaMexico);
  const [operaciones, setOperaciones] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState("");
  const [realtime, setRealtime] = useState("CONECTANDO");
  const [confirmando, setConfirmando] = useState("");
  const [rutasApoyadas, setRutasApoyadas] = useState({});
  const [corteRental, setCorteRental] = useState({ ingreso: "", otro_concepto: "", otro_importe: "" });
  const [guardandoRental, setGuardandoRental] = useState(false);

  const cargar = useCallback(async ({ silencioso = false, incluirCorte = !silencioso } = {}) => {
    try {
      if (!silencioso) setCargando(true);
      setError("");
      const [nuevasOperaciones, nuevoCorte] = await Promise.all([
        obtenerOperacionFlotillaEnVivo(fecha),
        incluirCorte ? obtenerCorteRental(fecha) : Promise.resolve(null),
      ]);
      setOperaciones(nuevasOperaciones);
      if (nuevoCorte) setCorteRental({
        ingreso: nuevoCorte.ingreso || "",
        otro_concepto: nuevoCorte.otro_concepto || "",
        otro_importe: nuevoCorte.otro_importe || "",
      });
    } catch (errorConsulta) {
      setError(errorConsulta?.message || "No fue posible cargar Flotilla.");
    } finally {
      if (!silencioso) setCargando(false);
    }
  }, [fecha]);

  useEffect(() => {
    cargar();
    const detener = suscribirseAOperacionFlotilla({
      onCambio: () => cargar({ silencioso: true }),
      onEstado: setRealtime,
    });
    const respaldo = window.setInterval(() => cargar({ silencioso: true }), 60000);
    return () => { detener(); window.clearInterval(respaldo); };
  }, [cargar]);

  const totales = useMemo(() => operaciones.reduce((r, item) => ({
    activas: r.activas + (["CARGADA", "EN_RUTA"].includes(item.estado) ? 1 : 0),
    ganado: r.ganado + item.resumen.ganado,
    gasolina: r.gasolina + item.resumen.gasolina,
    adelantos: r.adelantos + item.resumen.adelantosEntregados,
  }), { activas: 0, ganado: 0, gasolina: 0, adelantos: 0 }), [operaciones]);
  const rental = useMemo(() => calcularRepartoRental(operaciones, corteRental), [operaciones, corteRental]);

  async function cambiarEstado(movimientoId, estado, tipo, datos) {
    try {
      setConfirmando(movimientoId);
      await confirmarMovimientoChofer(movimientoId, estado, tipo, datos);
      await cargar({ silencioso: true });
    } catch (errorCambio) {
      setError(errorCambio?.message || "No fue posible actualizar el adelanto.");
    } finally {
      setConfirmando("");
    }
  }

  async function guardarRental() {
    try {
      setGuardandoRental(true);
      setError("");
      const guardado = await guardarCorteRental(fecha, corteRental);
      setCorteRental({
        ingreso: guardado.ingreso || "",
        otro_concepto: guardado.otro_concepto || "",
        otro_importe: guardado.otro_importe || "",
      });
    } catch (errorGuardado) {
      setError(errorGuardado?.message || "No fue posible guardar el corte de rentals.");
    } finally {
      setGuardandoRental(false);
    }
  }

  return (
    <section style={{ marginBottom: 16, padding: 16, borderRadius: 18, background: "linear-gradient(145deg,#fff,#f1f8ff)", border: "1px solid #c9deef" }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
        <div><small style={{ color: "#3975a6", fontWeight: 900 }}>OPERACIÓN EN VIVO</small><h2 style={{ margin: "5px 0" }}>Rutas, gasolina y adelantos</h2></div>
        <span style={{ alignSelf: "start", color: realtime === "SUBSCRIBED" ? "#247044" : "#805b18", fontWeight: 850 }}>{realtime === "SUBSCRIBED" ? "● En tiempo real" : "● Comprobando conexión"}</span>
      </div>

      <label style={{ display: "block", maxWidth: 220, fontSize: 12, fontWeight: 800 }}>Fecha<input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} style={{ width: "100%", marginTop: 5, padding: 9, border: "1px solid #c9deef", borderRadius: 9 }} /></label>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,minmax(0,1fr))", gap: 8, marginTop: 13 }}>
        {[["Rutas activas", totales.activas], ["Ganado estimado", moneda(totales.ganado)], ["Gasolina", moneda(totales.gasolina)], ["Adelantos entregados", moneda(totales.adelantos)]].map(([label, value]) => <div key={label} style={tarjeta}><small>{label}</small><strong style={{ display: "block", marginTop: 4 }}>{value}</strong></div>)}
      </div>

      {cargando && <p role="status">Consultando movimientos…</p>}
      {error && <p role="alert" style={{ color: "#a02e2e", fontWeight: 750 }}>{error}</p>}
      {!cargando && !error && operaciones.length === 0 && <p style={{ color: "#65798b" }}>Todavía no hay inicios de ruta sincronizados para esta fecha.</p>}

      <div style={{ display: "grid", gap: 10, marginTop: 13 }}>
        {operaciones.map((item) => {
          const adelantos = item.movimientos.filter((mov) => mov.tipo === "ADELANTO");
          const ambulancias = item.movimientos.filter((mov) => ["AMBULANCIA", "AMBULANCIA_DESCUENTO"].includes(mov.tipo));
          const gasolinas = item.movimientos.filter((mov) => mov.tipo === "GASOLINA");
          return <article key={item.id} style={tarjeta}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}><strong>{item.chofer_nombre || "Chofer sin nombre"}</strong><b>{item.estado}</b></div>
            <small>{item.codigo_ruta || "Ruta pendiente"} · {item.unidad?.placas || "Unidad sin placas"}</small>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4,minmax(0,1fr))", gap: 7, marginTop: 10, textAlign: "center" }}>
              <div><small>KM</small><b style={{ display: "block" }}>{item.resumen.kilometros}</b></div><div><small>Ganado</small><b style={{ display: "block" }}>{moneda(item.resumen.ganado)}</b></div><div><small>Gasolina</small><b style={{ display: "block" }}>{moneda(item.resumen.gasolina)}</b></div><div><small>Saldo</small><b style={{ display: "block", color: "#08734f" }}>{moneda(item.resumen.saldoEstimado)}</b></div>
            </div>
            {(item.foto_salida_url || item.foto_cierre_url) && <div style={{ display: "flex", gap: 10, marginTop: 7 }}>
              {item.foto_salida_url && <a href={item.foto_salida_url} target="_blank" rel="noreferrer">Ver foto de salida</a>}
              {item.foto_cierre_url && <a href={item.foto_cierre_url} target="_blank" rel="noreferrer">Ver foto de cierre</a>}
            </div>}
            {gasolinas.map((mov) => <div key={mov.id} style={{ marginTop: 9, padding: 9, borderRadius: 10, background: "#eef8ff" }}>
              <b>Gasolina {moneda(mov.importe)}</b> · {mov.litros || 0} L · pagó {mov.pagador || "sin registrar"}
              {mov.concepto && <small style={{ display: "block" }}>{mov.concepto}</small>}
              {mov.evidencia_url && <a href={mov.evidencia_url} target="_blank" rel="noreferrer">Ver foto de gasolina</a>}
            </div>)}
            {adelantos.map((mov) => <div key={mov.id} style={{ marginTop: 9, padding: 9, borderRadius: 10, background: "#fff8e8" }}>
              <b>Adelanto {moneda(mov.importe)}</b> · {mov.uso || "sin uso"} · {mov.estado}
              {mov.concepto && <small style={{ display: "block" }}>{mov.concepto}</small>}
              {mov.evidencia_url && <a href={mov.evidencia_url} target="_blank" rel="noreferrer">Ver evidencia</a>}
              {mov.estado === "SOLICITADO" && <div style={{ display: "flex", gap: 7, marginTop: 7 }}><button type="button" disabled={confirmando === mov.id} onClick={() => cambiarEstado(mov.id, "ENTREGADO", mov.tipo)}>Marcar entregado</button><button type="button" disabled={confirmando === mov.id} onClick={() => cambiarEstado(mov.id, "RECHAZADO", mov.tipo)}>Rechazar</button></div>}
            </div>)}
            {ambulancias.map((mov) => <div key={mov.id} style={{ marginTop: 9, padding: 9, borderRadius: 10, background: "#fff4df" }}>
              <b>{mov.tipo === "AMBULANCIA_DESCUENTO" ? "Descuento por ambulancia" : "Ambulancia a favor"} {moneda(mov.importe)}</b> · {mov.paradas || 0} paradas · {mov.estado}
              {mov.choferRelacionado && <small style={{ display: "block" }}>{mov.tipo === "AMBULANCIA_DESCUENTO" ? `Ayudó: ${mov.choferRelacionado}` : `Apoyó a: ${mov.choferRelacionado}`}</small>}
              {mov.concepto && <small style={{ display: "block" }}>{mov.concepto}</small>}
              {mov.evidencia_url && <a href={mov.evidencia_url} target="_blank" rel="noreferrer">Ver evidencia</a>}
              {mov.tipo === "AMBULANCIA" && mov.estado === "SOLICITADO" && <div style={{ marginTop: 7 }}>
                <label style={{ display: "block", fontSize: 11, fontWeight: 800 }}>Ruta que recibió el apoyo<select value={rutasApoyadas[mov.registro_id] || mov.ruta_apoyada_id || ""} onChange={(e) => setRutasApoyadas((actual) => ({ ...actual, [mov.registro_id]: e.target.value }))} style={{ display: "block", width: "100%", marginTop: 4, padding: 7 }}><option value="">Seleccionar chofer y ruta</option>{operaciones.filter((ruta) => ruta.id !== item.id).map((ruta) => <option key={ruta.id} value={ruta.id}>{ruta.chofer_nombre || "Chofer"} · {ruta.codigo_ruta || "Ruta"} · {ruta.unidad?.placas || "Sin placas"}</option>)}</select></label>
                <div style={{ display: "flex", gap: 7, marginTop: 7 }}><button type="button" disabled={confirmando === mov.registro_id || !(rutasApoyadas[mov.registro_id] || mov.ruta_apoyada_id)} onClick={() => cambiarEstado(mov.registro_id, "CONFIRMADO", mov.tipo, { rutaApoyadaId: rutasApoyadas[mov.registro_id] || mov.ruta_apoyada_id })}>Confirmar transferencia</button><button type="button" disabled={confirmando === mov.registro_id} onClick={() => cambiarEstado(mov.registro_id, "RECHAZADO", mov.tipo)}>Rechazar</button></div>
              </div>}
            </div>)}
          </article>;
        })}
      </div>
      <p style={{ marginBottom: 0, color: "#66798b", fontSize: 11 }}>Un adelanto solicitado no reduce el saldo hasta que Administración lo marca como entregado. Una ambulancia tampoco cambia pagos hasta confirmarse; entonces se descuenta al chofer apoyado y se abona al ayudante.</p>

      
      <FlotillaAccesosChofer />

      <section style={{ ...tarjeta, marginTop: 16, background: "#f7fff9", borderColor: "#b8dfc4" }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
          <div><small style={{ color: "#237345", fontWeight: 900 }}>RENTALS · UTILIDAD DEL DÍA</small><h3 style={{ margin: "4px 0" }}>Abraham · Chory · Kary</h3></div>
          <b>{rental.rutas} rutas rental</b>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3,minmax(0,1fr))", gap: 8, marginTop: 10 }}>
          <label style={{ fontSize: 11, fontWeight: 800 }}>Cobro confirmado (opcional)<input type="number" min="0" step="0.01" value={corteRental.ingreso} onChange={(e) => setCorteRental((actual) => ({ ...actual, ingreso: e.target.value }))} style={{ width: "100%", marginTop: 4, padding: 8, border: "1px solid #b8dfc4", borderRadius: 8 }} /></label>
          <label style={{ fontSize: 11, fontWeight: 800 }}>Otro gasto<input type="number" min="0" step="0.01" value={corteRental.otro_importe} onChange={(e) => setCorteRental((actual) => ({ ...actual, otro_importe: e.target.value }))} style={{ width: "100%", marginTop: 4, padding: 8, border: "1px solid #b8dfc4", borderRadius: 8 }} /></label>
          <label style={{ fontSize: 11, fontWeight: 800 }}>Concepto<input type="text" placeholder="Taxi, movimiento…" value={corteRental.otro_concepto} onChange={(e) => setCorteRental((actual) => ({ ...actual, otro_concepto: e.target.value }))} style={{ width: "100%", marginTop: 4, padding: 8, border: "1px solid #b8dfc4", borderRadius: 8 }} /></label>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4,minmax(0,1fr))", gap: 8, marginTop: 11 }}>
          {[['Ingreso rental', rental.ingreso], ['Pago choferes', rental.pagoChoferes], ['Gasolina empresa', rental.gasolinaEmpresa], ['Utilidad neta', rental.utilidadNeta]].map(([label, value]) => <div key={label} style={tarjeta}><small>{label}</small><strong style={{ display: "block", color: label === 'Utilidad neta' && rental.hayPerdida ? '#a02e2e' : undefined }}>{moneda(value)}</strong></div>)}
        </div>
        <p style={{ color: "#557063", fontSize: 11 }}>Ingreso automático por rutas: {moneda(rental.ingresoPorTarifa)} · Gasolina pagada por choferes (informativa, no se descuenta de la utilidad): {moneda(rental.gasolinaChofer)} · Otro gasto: {moneda(rental.otroGasto)}</p>
        {rental.hayPerdida ? <p role="status" style={{ color: "#a02e2e", fontWeight: 800 }}>Hay pérdida: se muestra para revisión y no se reparte.</p> : <div style={{ display: "grid", gridTemplateColumns: "repeat(3,minmax(0,1fr))", gap: 8, marginTop: 11 }}>{rental.socios.map((socio) => <div key={socio} style={tarjeta}><small>{socio}</small><strong style={{ display: "block", color: "#08734f" }}>{moneda(rental.repartoSocios?.[socio] ?? rental.partePorSocio)}</strong></div>)}</div>}
        <button type="button" disabled={guardandoRental} onClick={guardarRental} style={{ marginTop: 11 }}>{guardandoRental ? "Guardando…" : "Guardar corte rental"}</button>
        <p style={{ marginBottom: 0, color: "#557063", fontSize: 11 }}>Small: cobra $1,100 y paga $850 al chofer. Large: cobra $1,221 y paga $1,000. Cálculo: ingreso − pago de choferes − gasolina pagada por la empresa − otro gasto. Los adelantos entregados reducen el saldo pendiente del chofer, no la utilidad.</p>
      </section>
    </section>
  );
}
