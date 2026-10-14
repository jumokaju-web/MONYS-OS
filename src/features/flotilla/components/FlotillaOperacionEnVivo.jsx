import { useCallback, useEffect, useMemo, useState } from "react";
import {
  confirmarMovimientoChofer,
  guardarRevisionEvidencia,
  guardarCorteRental,
  obtenerCorteRental,
  obtenerOperacionFlotillaEnVivo,
  suscribirseAOperacionFlotilla,
} from "./services/operacionFlotilla";
import { calcularRepartoRental, evaluarGasolina, MOTIVOS_RECHAZO_EVIDENCIA, revisarEvidenciaRuta } from "../utils/operacionFlotilla";
import FlotillaAccesosChofer from "./FlotillaAccesosChofer";
import FlotillaAccesosSocios from "./FlotillaAccesosSocios";
import FlotillaPrestamos from "./FlotillaPrestamos";
import FlotillaPrefacturas from "./FlotillaPrefacturas";
import FlotillaResumenRentalPeriodo from "./FlotillaResumenRentalPeriodo";

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

function ControlRevisionFoto({ revision, guardando, onGuardar }) {
  const [motivo, setMotivo] = useState(revision?.motivo || "");
  const color = revision?.estado === "APROBADA" ? "#17643a" : revision?.estado === "RECHAZADA" ? "#982f24" : "#6b5712";
  const fondo = revision?.estado === "APROBADA" ? "#e7f7ed" : revision?.estado === "RECHAZADA" ? "#ffe7df" : "#fff6d8";

  return <div style={{ marginTop: 7, padding: 8, borderRadius: 9, background: fondo, border: `1px solid ${color}33` }}>
    <small style={{ display: "block", color, fontWeight: 900 }}>
      {revision?.estado === "APROBADA" ? "✓ FOTO APROBADA" : revision?.estado === "RECHAZADA" ? `✕ REPETIR FOTO · ${revision.motivo}` : "PENDIENTE DE REVISIÓN"}
    </small>
    <select aria-label="Motivo para repetir la foto" value={motivo} onChange={(e) => setMotivo(e.target.value)} style={{ width: "100%", marginTop: 6, padding: 7, borderRadius: 8 }}>
      <option value="">Motivo si debe repetirse…</option>
      {MOTIVOS_RECHAZO_EVIDENCIA.map((opcion) => <option key={opcion} value={opcion}>{opcion}</option>)}
    </select>
    <div style={{ display: "flex", gap: 7, marginTop: 7 }}>
      <button type="button" disabled={guardando} onClick={() => onGuardar("APROBADA", null)}>Aprobar foto</button>
      <button type="button" disabled={guardando || !motivo} onClick={() => onGuardar("RECHAZADA", motivo)}>Rechazar y pedir otra</button>
    </div>
  </div>;
}

export default function FlotillaOperacionEnVivo({ usuario = null, soloConsulta = false }) {
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
    evidenciaPendiente: r.evidenciaPendiente + (revisarEvidenciaRuta(item, item.movimientos).estado === "PENDIENTE" ? 1 : 0),
    ganado: r.ganado + item.resumen.ganado,
    gasolina: r.gasolina + item.resumen.gasolina,
    prestamosGasolina: r.prestamosGasolina + item.resumen.prestamosGasolina,
    adelantos: r.adelantos + item.resumen.adelantosEntregados,
  }), { activas: 0, evidenciaPendiente: 0, ganado: 0, gasolina: 0, prestamosGasolina: 0, adelantos: 0 }), [operaciones]);
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

  async function revisarFoto({ rutaId, evidenciaKey, tipoEvidencia, referenciaId = null, estado, motivo }) {
    try {
      setConfirmando(`REVISION:${evidenciaKey}`);
      setError("");
      await guardarRevisionEvidencia({ rutaId, evidenciaKey, tipoEvidencia, referenciaId, estado, motivo });
      await cargar({ silencioso: true });
    } catch (errorRevision) {
      setError(errorRevision?.message || "No fue posible guardar la revisión de la foto.");
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
      {soloConsulta && <p role="status" style={{ padding: 9, borderRadius: 9, background: "#f8f4ff", color: "#65428a", fontWeight: 800 }}>Acceso de socio: puedes consultar tus unidades, resultados y prefacturas; no puedes aprobar ni modificar movimientos.</p>}

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(135px,1fr))", gap: 8, marginTop: 13 }}>
        {[["Rutas activas", totales.activas], ["Evidencia pendiente", totales.evidenciaPendiente], ["Ganado estimado", moneda(totales.ganado)], ["Gasolina aprobada", moneda(totales.gasolina)], ["Préstamo por gasolina", moneda(totales.prestamosGasolina)], ["Adelantos entregados", moneda(totales.adelantos)]].map(([label, value]) => <div key={label} style={{ ...tarjeta, ...((label === "Evidencia pendiente" || label === "Préstamo por gasolina") && Number(value) > 0 ? { borderColor: "#e8a58f", background: "#fff5f0" } : {}) }}><small>{label}</small><strong style={{ display: "block", marginTop: 4 }}>{value}</strong></div>)}
      </div>

      {cargando && <p role="status">Consultando movimientos…</p>}
      {error && <p role="alert" style={{ color: "#a02e2e", fontWeight: 750 }}>{error}</p>}
      {!cargando && !error && operaciones.length === 0 && <p style={{ color: "#65798b" }}>Todavía no hay inicios de ruta sincronizados para esta fecha.</p>}

      <div style={{ display: "grid", gap: 10, marginTop: 13 }}>
        {operaciones.map((item) => {
          const adelantos = item.movimientos.filter((mov) => mov.tipo === "ADELANTO");
          const ambulancias = item.movimientos.filter((mov) => ["AMBULANCIA", "AMBULANCIA_DESCUENTO"].includes(mov.tipo));
          const gasolinas = item.movimientos.filter((mov) => mov.tipo === "GASOLINA");
          const revisionEvidencia = revisarEvidenciaRuta(item, item.movimientos);
          return <article key={item.id} style={tarjeta}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}><strong>{item.chofer_nombre || "Chofer sin nombre"}</strong><div style={{ display: "flex", gap: 7, alignItems: "center" }}><b>{item.estado}</b><span style={{ padding: "3px 7px", borderRadius: 999, fontSize: 10, fontWeight: 900, color: revisionEvidencia.estado === "PENDIENTE" ? "#8a2e1b" : revisionEvidencia.estado === "COMPLETA" ? "#17643a" : "#6b5712", background: revisionEvidencia.estado === "PENDIENTE" ? "#ffe7df" : revisionEvidencia.estado === "COMPLETA" ? "#e7f7ed" : "#fff6d8" }}>{revisionEvidencia.estado === "PENDIENTE" ? "EVIDENCIA PENDIENTE" : revisionEvidencia.estado === "COMPLETA" ? "EVIDENCIA COMPLETA" : "EN CURSO"}</span></div></div>
            <small>{item.codigo_ruta || "Ruta pendiente"} · {item.unidad?.placas || "Unidad sin placas"}</small>
            {revisionEvidencia.faltantes.length > 0 && <div role="alert" style={{ marginTop: 9, padding: 9, borderRadius: 10, background: "#fff5f0", border: "1px solid #f0b49f", color: "#7a3223", fontSize: 11 }}><b>Falta comprobar:</b> {revisionEvidencia.faltantes.join(" · ")}</div>}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4,minmax(0,1fr))", gap: 7, marginTop: 10, textAlign: "center" }}>
              <div><small>KM</small><b style={{ display: "block" }}>{item.resumen.kilometros}</b></div><div><small>Ganado</small><b style={{ display: "block" }}>{moneda(item.resumen.ganado)}</b></div><div><small>Gasolina</small><b style={{ display: "block" }}>{moneda(item.resumen.gasolina)}</b></div><div><small>Saldo</small><b style={{ display: "block", color: "#08734f" }}>{moneda(item.resumen.saldoEstimado)}</b></div>
            </div>
            {(item.foto_salida_url || item.foto_cierre_url) && <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))", gap: 10, marginTop: 9 }}>
              {item.foto_salida_url && <div><a href={item.foto_salida_url} target="_blank" rel="noreferrer">Ver foto de salida</a>{!soloConsulta && <ControlRevisionFoto revision={item.revision_foto_salida} guardando={confirmando === "REVISION:RUTA:SALIDA"} onGuardar={(estado, motivo) => revisarFoto({ rutaId: item.id, evidenciaKey: "RUTA:SALIDA", tipoEvidencia: "FOTO_SALIDA", estado, motivo })} />}</div>}
              {item.foto_cierre_url && <div><a href={item.foto_cierre_url} target="_blank" rel="noreferrer">Ver foto de cierre</a>{!soloConsulta && <ControlRevisionFoto revision={item.revision_foto_cierre} guardando={confirmando === "REVISION:RUTA:CIERRE"} onGuardar={(estado, motivo) => revisarFoto({ rutaId: item.id, evidenciaKey: "RUTA:CIERRE", tipoEvidencia: "FOTO_CIERRE", estado, motivo })} />}</div>}
            </div>}
            {gasolinas.map((mov) => {
              const evaluacion = evaluarGasolina(mov);
              const evidencias = [
                ["Ticket", mov.evidencia_ticket_url, `GASOLINA_TICKET:${mov.id}`, "GASOLINA_TICKET", mov.revision_ticket],
                ["Tablero antes", mov.evidencia_tablero_antes_url, `GASOLINA_TABLERO_ANTES:${mov.id}`, "GASOLINA_TABLERO_ANTES", mov.revision_tablero_antes],
                ["Tablero después", mov.evidencia_tablero_despues_url, `GASOLINA_TABLERO_DESPUES:${mov.id}`, "GASOLINA_TABLERO_DESPUES", mov.revision_tablero_despues],
              ];
              return <div key={mov.id} style={{ marginTop: 9, padding: 9, borderRadius: 10, background: evaluacion.aprobada ? "#eef8ff" : "#fff1eb", border: evaluacion.aprobada ? "1px solid #c9deef" : "1px solid #e8a58f" }}>
                <b>{evaluacion.aprobada ? "Gasolina aprobada" : "Préstamo personal por gasolina"} {moneda(mov.importe)}</b> · {mov.litros || 0} L · pagó {mov.pagador || "sin registrar"}
                {!evaluacion.aprobada && <small role="alert" style={{ display: "block", marginTop: 5, color: "#8a2e1b", fontWeight: 800 }}>No se toma como gasolina. Falta: {evaluacion.faltantes.join(" · ")}.</small>}
                {mov.concepto && <small style={{ display: "block" }}>{mov.concepto}</small>}
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(210px,1fr))", gap: 8, marginTop: 7 }}>
                  {evidencias.map(([etiqueta, url, evidenciaKey, tipoEvidencia, revision]) => <div key={evidenciaKey} style={{ padding: 8, borderRadius: 9, background: "#fff" }}>
                    <b style={{ display: "block", fontSize: 12 }}>{etiqueta}</b>
                    {url ? <><a href={url} target="_blank" rel="noreferrer">Ver foto</a>{!soloConsulta && <ControlRevisionFoto revision={revision} guardando={confirmando === `REVISION:${evidenciaKey}`} onGuardar={(estado, motivo) => revisarFoto({ rutaId: item.id, evidenciaKey, tipoEvidencia, referenciaId: mov.id, estado, motivo })} />}</> : <small style={{ color: "#8a2e1b", fontWeight: 800 }}>No enviada</small>}
                  </div>)}
                </div>
              </div>;
            })}
            {adelantos.map((mov) => <div key={mov.id} style={{ marginTop: 9, padding: 9, borderRadius: 10, background: "#fff8e8" }}>
              <b>Adelanto {moneda(mov.importe)}</b> · {mov.uso || "sin uso"} · {mov.estado}
              {mov.concepto && <small style={{ display: "block" }}>{mov.concepto}</small>}
              {mov.evidencia_url && <a href={mov.evidencia_url} target="_blank" rel="noreferrer">Ver evidencia</a>}
              {!soloConsulta && mov.estado === "SOLICITADO" && <div style={{ display: "flex", gap: 7, marginTop: 7 }}><button type="button" disabled={confirmando === mov.id} onClick={() => cambiarEstado(mov.id, "ENTREGADO", mov.tipo)}>Marcar entregado</button><button type="button" disabled={confirmando === mov.id} onClick={() => cambiarEstado(mov.id, "RECHAZADO", mov.tipo)}>Rechazar</button></div>}
            </div>)}
            {ambulancias.map((mov) => <div key={mov.id} style={{ marginTop: 9, padding: 9, borderRadius: 10, background: "#fff4df" }}>
              <b>{mov.tipo === "AMBULANCIA_DESCUENTO" ? "Descuento por ambulancia" : "Ambulancia a favor"} {moneda(mov.importe)}</b> · {mov.paradas || 0} paradas · {mov.estado}
              {mov.choferRelacionado && <small style={{ display: "block" }}>{mov.tipo === "AMBULANCIA_DESCUENTO" ? `Ayudó: ${mov.choferRelacionado}` : `Apoyó a: ${mov.choferRelacionado}`}</small>}
              {mov.concepto && <small style={{ display: "block" }}>{mov.concepto}</small>}
              {mov.evidencia_url && <><a href={mov.evidencia_url} target="_blank" rel="noreferrer">Ver evidencia</a>{!soloConsulta && mov.tipo === "AMBULANCIA" && <ControlRevisionFoto revision={mov.revision_evidencia} guardando={confirmando === `REVISION:${mov.evidencia_key}`} onGuardar={(estado, motivo) => revisarFoto({ rutaId: item.id, evidenciaKey: mov.evidencia_key, tipoEvidencia: "AMBULANCIA", referenciaId: mov.registro_id, estado, motivo })} />}</>}
              {!soloConsulta && mov.tipo === "AMBULANCIA" && mov.estado === "SOLICITADO" && <div style={{ marginTop: 7 }}>
                <label style={{ display: "block", fontSize: 11, fontWeight: 800 }}>Ruta que recibió el apoyo<select value={rutasApoyadas[mov.registro_id] || mov.ruta_apoyada_id || ""} onChange={(e) => setRutasApoyadas((actual) => ({ ...actual, [mov.registro_id]: e.target.value }))} style={{ display: "block", width: "100%", marginTop: 4, padding: 7 }}><option value="">Seleccionar chofer y ruta</option>{operaciones.filter((ruta) => ruta.id !== item.id).map((ruta) => <option key={ruta.id} value={ruta.id}>{ruta.chofer_nombre || "Chofer"} · {ruta.codigo_ruta || "Ruta"} · {ruta.unidad?.placas || "Sin placas"}</option>)}</select></label>
                <div style={{ display: "flex", gap: 7, marginTop: 7 }}><button type="button" disabled={confirmando === mov.registro_id || !(rutasApoyadas[mov.registro_id] || mov.ruta_apoyada_id)} onClick={() => cambiarEstado(mov.registro_id, "CONFIRMADO", mov.tipo, { rutaApoyadaId: rutasApoyadas[mov.registro_id] || mov.ruta_apoyada_id })}>Confirmar transferencia</button><button type="button" disabled={confirmando === mov.registro_id} onClick={() => cambiarEstado(mov.registro_id, "RECHAZADO", mov.tipo)}>Rechazar</button></div>
              </div>}
            </div>)}
          </article>;
        })}
      </div>
      <p style={{ marginBottom: 0, color: "#66798b", fontSize: 11 }}>MONYS conserva la revisión de cada foto. La gasolina exige ticket, tablero antes y tablero después, y las tres fotos deben aprobarse. Si falta una o se rechaza, el mismo importe se trata como préstamo personal del chofer y no se duplica como gasolina. Un adelanto solicitado no reduce el saldo hasta que Administración lo marca como entregado. Una ambulancia tampoco cambia pagos hasta confirmarse; entonces se descuenta al chofer apoyado y se abona al ayudante.</p>

      {!soloConsulta && <FlotillaAccesosChofer />}
      {!soloConsulta && String(usuario?.role || "").toLowerCase() === "owner" && <FlotillaAccesosSocios />}
      <FlotillaPrestamos soloConsulta={soloConsulta} />
      <FlotillaPrefacturas />

      <section style={{ ...tarjeta, marginTop: 16, background: "#f7fff9", borderColor: "#b8dfc4" }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
          <div><small style={{ color: "#237345", fontWeight: 900 }}>RENTALS · UTILIDAD DEL DÍA</small><h3 style={{ margin: "4px 0" }}>Abraham · Chory · Kary</h3></div>
          <b>{rental.rutas} rutas · {rental.rutasSmall} Small · {rental.rutasLarge} Large</b>
        </div>
        {!soloConsulta && <div style={{ display: "grid", gridTemplateColumns: "repeat(3,minmax(0,1fr))", gap: 8, marginTop: 10 }}>
          <label style={{ fontSize: 11, fontWeight: 800 }}>Cobro confirmado (opcional)<input type="number" min="0" step="0.01" value={corteRental.ingreso} onChange={(e) => setCorteRental((actual) => ({ ...actual, ingreso: e.target.value }))} style={{ width: "100%", marginTop: 4, padding: 8, border: "1px solid #b8dfc4", borderRadius: 8 }} /></label>
          <label style={{ fontSize: 11, fontWeight: 800 }}>Otro gasto<input type="number" min="0" step="0.01" value={corteRental.otro_importe} onChange={(e) => setCorteRental((actual) => ({ ...actual, otro_importe: e.target.value }))} style={{ width: "100%", marginTop: 4, padding: 8, border: "1px solid #b8dfc4", borderRadius: 8 }} /></label>
          <label style={{ fontSize: 11, fontWeight: 800 }}>Concepto<input type="text" placeholder="Taxi, movimiento…" value={corteRental.otro_concepto} onChange={(e) => setCorteRental((actual) => ({ ...actual, otro_concepto: e.target.value }))} style={{ width: "100%", marginTop: 4, padding: 8, border: "1px solid #b8dfc4", borderRadius: 8 }} /></label>
        </div>}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(135px,1fr))", gap: 8, marginTop: 11 }}>
          {[['Ingreso rental', rental.ingreso], ['Ganado choferes', rental.pagoChoferes], ['Adelantos pagados', rental.adelantosEntregados], ['Pendiente choferes', rental.saldoChoferes], ['Gasolina empresa', rental.gasolinaEmpresa], ['Utilidad neta', rental.utilidadNeta]].map(([label, value]) => <div key={label} style={tarjeta}><small>{label}</small><strong style={{ display: "block", color: label === 'Utilidad neta' && rental.hayPerdida ? '#a02e2e' : undefined }}>{moneda(value)}</strong></div>)}
        </div>
        <p style={{ color: "#557063", fontSize: 11 }}>Ingreso automático por rutas: {moneda(rental.ingresoPorTarifa)}{rental.origenIngreso === "REGISTRADO" ? ` · Ajuste contra cobro registrado: ${moneda(rental.ajusteIngreso)}` : ""} · Gasolina pagada por choferes (informativa, no se descuenta de la utilidad): {moneda(rental.gasolinaChofer)} · Otro gasto: {moneda(rental.otroGasto)}</p>
        <h4 style={{ margin: "14px 0 7px" }}>Detalle por ruta</h4>
        {rental.detalleRutas.length === 0 ? <p style={{ color: "#557063", fontSize: 12 }}>No hay rutas Rental para esta fecha.</p> : <div style={{ display: "grid", gap: 8 }}>
          {rental.detalleRutas.map((ruta) => <article key={ruta.id || `${ruta.codigoRuta}-${ruta.placas}`} style={{ ...tarjeta, background: ruta.utilidadRuta < 0 ? "#fff5f0" : "#fff" }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}><b>{ruta.chofer} · {ruta.placas}</b><span style={{ fontWeight: 900 }}>{ruta.etiquetaTipo}</span></div>
            <small>{ruta.codigoRuta}</small>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(105px,1fr))", gap: 7, marginTop: 8 }}>
              {[['Cobro', ruta.ingreso], ['Ganó chofer', ruta.pagoChofer], ['Adelantado', ruta.adelantos], ['Falta pagar', ruta.saldoChofer], ['Gas empresa', ruta.gasolinaEmpresa], ['Utilidad ruta', ruta.utilidadRuta]].map(([label, value]) => <div key={label}><small>{label}</small><b style={{ display: "block", color: label === 'Utilidad ruta' && value < 0 ? '#a02e2e' : undefined }}>{moneda(value)}</b></div>)}
            </div>
            {(ruta.ambulanciasFavor > 0 || ruta.ambulanciasDescuento > 0) && <small style={{ display: "block", marginTop: 7, color: "#76551b" }}>Ambulancia a favor: {moneda(ruta.ambulanciasFavor)} · Descuento por ambulancia: {moneda(ruta.ambulanciasDescuento)}</small>}
          </article>)}
        </div>}
        {rental.hayPerdida ? <p role="status" style={{ color: "#a02e2e", fontWeight: 800 }}>Hay pérdida: se muestra para revisión y no se reparte.</p> : <div style={{ display: "grid", gridTemplateColumns: "repeat(3,minmax(0,1fr))", gap: 8, marginTop: 11 }}>{rental.socios.map((socio) => <div key={socio} style={tarjeta}><small>{socio}</small><strong style={{ display: "block", color: "#08734f" }}>{moneda(rental.repartoSocios?.[socio] ?? rental.partePorSocio)}</strong></div>)}</div>}
        {!soloConsulta && <button type="button" disabled={guardandoRental} onClick={guardarRental} style={{ marginTop: 11 }}>{guardandoRental ? "Guardando…" : "Guardar corte rental"}</button>}
        <p style={{ marginBottom: 0, color: "#557063", fontSize: 11 }}>Small: cobra $1,100 y paga $850 al chofer. Large: cobra $1,221 y paga $1,000. Al ganado del chofer se suman o descuentan ambulancias confirmadas. Cálculo: ingreso − ganado real de choferes − gasolina pagada por la empresa − otro gasto. Los adelantos solo reducen lo pendiente por pagar; no vuelven a descontarse de la utilidad.</p>
      </section>
      {!soloConsulta && <FlotillaResumenRentalPeriodo />}
    </section>
  );
}
