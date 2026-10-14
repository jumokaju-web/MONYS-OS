import { useCallback, useEffect, useMemo, useState } from "react";

import {
  agregarEvidenciaPnr,
  aplicarDescuentoPnr,
  gestionarPnrFlotilla,
  obtenerPnrFlotilla,
  obtenerRutasParaPnr,
  registrarPnrFlotilla,
  responderPnrFlotilla,
  solicitarConvenioPnr,
  suscribirseAPnrFlotilla,
} from "./services/pnrFlotilla";
import { etiquetaEstadoPnr, pnrEstaActivo, resumirPnr } from "../utils/pnrFlotilla";

const caja = {
  background: "#fff",
  border: "1px solid #e8c6a2",
  borderRadius: 14,
  padding: 13,
};

const campo = {
  width: "100%",
  marginTop: 4,
  padding: 9,
  borderRadius: 9,
  border: "1px solid #decdbb",
  background: "#fff",
  font: "inherit",
};

function fechaMexico() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Mexico_City" }).format(new Date());
}

function fechaDiasAtras(dias) {
  const fecha = new Date();
  fecha.setDate(fecha.getDate() - dias);
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Mexico_City" }).format(fecha);
}

function corteActual() {
  const fecha = new Date(`${fechaMexico()}T12:00:00Z`);
  const desplazamiento = (fecha.getUTCDay() + 6) % 7;
  fecha.setUTCDate(fecha.getUTCDate() - desplazamiento);
  const desde = fecha.toISOString().slice(0, 10);
  fecha.setUTCDate(fecha.getUTCDate() + 6);
  return { desde, hasta: fecha.toISOString().slice(0, 10) };
}

function moneda(valor) {
  return new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" }).format(Number(valor) || 0);
}

function colorEstado(estado) {
  if (estado === "RESUELTO_SIN_COBRO") return { fondo: "#e8f8ee", color: "#17643a" };
  if (estado === "LIQUIDADO") return { fondo: "#e8f2ff", color: "#24538d" };
  if (String(estado).includes("PENALIDAD") || String(estado).includes("CONVENIO")) {
    return { fondo: "#fff0e7", color: "#914521" };
  }
  return { fondo: "#fff7d9", color: "#755713" };
}

function CabeceraPnr({ pnr }) {
  const color = colorEstado(pnr.estado);
  return <>
    <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "start" }}>
      <div>
        <strong style={{ fontSize: 16 }}>📦 PNR {pnr.paquete_id}</strong>
        <small style={{ display: "block", marginTop: 3 }}>
          {pnr.ruta?.fecha || pnr.fecha_reporte} · Ruta {pnr.ruta?.codigo_ruta || "sin código"} · {pnr.unidad?.placas || "sin placas"}
        </small>
      </div>
      <span style={{ padding: "4px 7px", borderRadius: 999, background: color.fondo, color: color.color, fontSize: 10, fontWeight: 900 }}>
        {etiquetaEstadoPnr(pnr.estado)}
      </span>
    </div>
    {pnr.referencia_operativa && <small style={{ display: "block", marginTop: 5 }}>Referencia negra: <b>{pnr.referencia_operativa}</b></small>}
    {pnr.descripcion && <p style={{ margin: "8px 0" }}>{pnr.descripcion}</p>}
    {pnr.captura_origen_url && <a href={pnr.captura_origen_url} target="_blank" rel="noreferrer" style={{ display: "inline-block", color: "#8a491f", fontWeight: 850 }}>Ver captura original de WhatsApp</a>}
  </>;
}

function EvidenciasPnr({ pnr }) {
  if (!pnr.evidencias?.length) return <small style={{ display: "block", marginTop: 8, color: "#765f4d" }}>Todavía no hay fotografías o capturas del driver.</small>;
  return <div style={{ display: "grid", gridTemplateColumns: "repeat(2,minmax(0,1fr))", gap: 7, marginTop: 9 }}>
    {pnr.evidencias.map((evidencia, indice) => <a key={evidencia.id} href={evidencia.archivo_url || undefined} target="_blank" rel="noreferrer" style={{ color: "#174b7a", textDecoration: "none" }}>
      {evidencia.archivo_url
        ? <img src={evidencia.archivo_url} alt={`Evidencia ${indice + 1}`} style={{ width: "100%", height: 110, objectFit: "cover", borderRadius: 9, background: "#eef3f7" }} />
        : <div style={{ height: 110, display: "grid", placeItems: "center", background: "#f4eee8", borderRadius: 9 }}>Sin acceso</div>}
      <small style={{ display: "block", marginTop: 3, fontWeight: 800 }}>{evidencia.nota || `Evidencia ${indice + 1}`}</small>
    </a>)}
  </div>;
}

function HistorialDescuentos({ pnr }) {
  if (!pnr.descuentos?.length) return null;
  return <div style={{ marginTop: 9, padding: 9, borderRadius: 9, background: "#f7f4f1" }}>
    <b style={{ fontSize: 12 }}>Abonos aplicados</b>
    {pnr.descuentos.map((abono) => <small key={abono.id} style={{ display: "block", marginTop: 4 }}>
      {abono.periodo_desde} al {abono.periodo_hasta}: <b>{moneda(abono.monto)}</b> · aparece en prefactura del socio y pago del driver
    </small>)}
  </div>;
}

function VistaDriver({ pnr, onCambio }) {
  const [respuesta, setRespuesta] = useState(pnr.respuesta_chofer || "");
  const [evidencia, setEvidencia] = useState(null);
  const [montoSemanal, setMontoSemanal] = useState("");
  const [ocupado, setOcupado] = useState(false);
  const [mensaje, setMensaje] = useState("");
  const [error, setError] = useState("");

  async function enviarRespuesta() {
    try {
      setOcupado(true); setError(""); setMensaje("");
      await responderPnrFlotilla({ pnr, respuesta, evidencia });
      setEvidencia(null);
      setMensaje("Tu respuesta y evidencia ya están visibles para Chory y Mónica.");
      await onCambio();
    } catch (fallo) {
      setError(fallo?.message || "No fue posible responder el PNR.");
    } finally { setOcupado(false); }
  }

  async function pedirConvenio() {
    try {
      setOcupado(true); setError(""); setMensaje("");
      await solicitarConvenioPnr({ pnrId: pnr.id, montoSemanal });
      setMensaje("Convenio solicitado. Mónica debe autorizarlo antes de aplicar abonos.");
      await onCambio();
    } catch (fallo) {
      setError(fallo?.message || "No fue posible solicitar el convenio.");
    } finally { setOcupado(false); }
  }

  return <article style={{ ...caja, borderWidth: pnrEstaActivo(pnr.estado) ? 2 : 1 }}>
    <CabeceraPnr pnr={pnr} />
    {pnr.respuesta_chofer && <p style={{ padding: 9, borderRadius: 9, background: "#f3f8ff" }}><b>Tu última respuesta:</b> {pnr.respuesta_chofer}</p>}
    <EvidenciasPnr pnr={pnr} />
    {pnr.penalidad_monto > 0 && <div style={{ marginTop: 9, padding: 10, borderRadius: 10, background: "#fff0e7", color: "#71391e" }}>
      <b>Penalidad: {moneda(pnr.penalidad_monto)}</b><br />Saldo pendiente: <b>{moneda(pnr.saldo)}</b>
      {pnr.convenio_autorizado_monto > 0 && <><br />Abono semanal autorizado: <b>{moneda(pnr.convenio_autorizado_monto)}</b></>}
    </div>}
    {pnr.resolucion && <p style={{ padding: 9, borderRadius: 9, background: "#e8f8ee", color: "#17643a" }}><b>Resolución:</b> {pnr.resolucion}</p>}
    <HistorialDescuentos pnr={pnr} />

    {pnrEstaActivo(pnr.estado) && !["PENALIDAD_CONFIRMADA", "CONVENIO_SOLICITADO", "CONVENIO_ACTIVO"].includes(pnr.estado) && <div style={{ marginTop: 11 }}>
      <label style={{ display: "block", fontSize: 12, fontWeight: 850 }}>Explica qué ocurrió<textarea value={respuesta} onChange={(e) => setRespuesta(e.target.value)} rows={3} style={campo} /></label>
      <label style={{ display: "block", marginTop: 8, fontSize: 12, fontWeight: 850 }}>Foto o captura de evidencia<input type="file" accept="image/jpeg,image/png,image/webp" onChange={(e) => setEvidencia(e.target.files?.[0] || null)} style={{ ...campo, padding: 7 }} /></label>
      <button type="button" disabled={ocupado || respuesta.trim().length < 5} onClick={enviarRespuesta} style={{ width: "100%", marginTop: 9, padding: 10, border: 0, borderRadius: 9, background: "#a84d16", color: "#fff", fontWeight: 900 }}>{ocupado ? "Enviando…" : "Enviar respuesta a Chory y Mónica"}</button>
    </div>}
    {pnr.estado === "PENALIDAD_CONFIRMADA" && <div style={{ marginTop: 11 }}>
      <label style={{ display: "block", fontSize: 12, fontWeight: 850 }}>Si necesitas pagos: ¿cuánto puedes abonar por semana?<input type="number" min="1" max={pnr.saldo} value={montoSemanal} onChange={(e) => setMontoSemanal(e.target.value)} style={campo} /></label>
      <button type="button" disabled={ocupado || !(Number(montoSemanal) > 0)} onClick={pedirConvenio} style={{ width: "100%", marginTop: 8, padding: 10, border: 0, borderRadius: 9, background: "#a84d16", color: "#fff", fontWeight: 900 }}>Solicitar convenio a Mónica</button>
    </div>}
    {error && <p role="alert" style={{ color: "#9b2929", fontWeight: 800 }}>{error}</p>}
    {mensaje && <p role="status" style={{ color: "#17643a", fontWeight: 800 }}>{mensaje}</p>}
  </article>;
}

function FormularioAltaPnr({ rutas, onRegistrado }) {
  const [rutaId, setRutaId] = useState("");
  const [paqueteId, setPaqueteId] = useState("");
  const [referencia, setReferencia] = useState("");
  const [descripcion, setDescripcion] = useState("");
  const [captura, setCaptura] = useState(null);
  const [ocupado, setOcupado] = useState(false);
  const [mensaje, setMensaje] = useState("");
  const [error, setError] = useState("");

  async function guardar(evento) {
    evento.preventDefault();
    const formulario = evento.currentTarget;
    try {
      setOcupado(true); setError(""); setMensaje("");
      await registrarPnrFlotilla({ rutaId, paqueteId, referenciaOperativa: referencia, descripcion, captura });
      setPaqueteId(""); setReferencia(""); setDescripcion(""); setCaptura(null);
      formulario.reset();
      setMensaje("PNR registrado. El recordatorio ya aparecerá en la cuenta del driver.");
      await onRegistrado();
    } catch (fallo) {
      setError(fallo?.message || "No fue posible registrar el PNR.");
    } finally { setOcupado(false); }
  }

  return <form onSubmit={guardar} style={{ ...caja, marginTop: 12, background: "#fffaf5" }}>
    <b>Registrar aviso recibido en WhatsApp</b>
    <p style={{ margin: "5px 0 9px", fontSize: 12 }}>Registra cada paquete como un PNR separado. El número verde es el ID principal.</p>
    <label style={{ display: "block", fontSize: 12, fontWeight: 850 }}>Ruta y driver<select value={rutaId} onChange={(e) => setRutaId(e.target.value)} style={campo}><option value="">Seleccionar…</option>{rutas.map((ruta) => <option key={ruta.id} value={ruta.id}>{ruta.fecha} · {ruta.codigo_ruta || "Sin código"} · {ruta.chofer_nombre} · {ruta.unidad?.placas || "Sin placas"}</option>)}</select></label>
    <label style={{ display: "block", marginTop: 8, fontSize: 12, fontWeight: 850 }}>ID verde del paquete<input value={paqueteId} onChange={(e) => setPaqueteId(e.target.value)} maxLength={80} placeholder="Ej. 48151708615" style={campo} /></label>
    <label style={{ display: "block", marginTop: 8, fontSize: 12, fontWeight: 850 }}>Referencia negra (opcional)<input value={referencia} onChange={(e) => setReferencia(e.target.value)} maxLength={80} placeholder="Ej. 204563920" style={campo} /></label>
    <label style={{ display: "block", marginTop: 8, fontSize: 12, fontWeight: 850 }}>Qué solicitan o qué ocurrió<textarea value={descripcion} onChange={(e) => setDescripcion(e.target.value)} rows={2} maxLength={1200} style={campo} /></label>
    <label style={{ display: "block", marginTop: 8, fontSize: 12, fontWeight: 850 }}>Captura original del aviso<input type="file" required accept="image/jpeg,image/png,image/webp" onChange={(e) => setCaptura(e.target.files?.[0] || null)} style={{ ...campo, padding: 7 }} /></label>
    {error && <p role="alert" style={{ color: "#9b2929", fontWeight: 800 }}>{error}</p>}
    {mensaje && <p role="status" style={{ color: "#17643a", fontWeight: 800 }}>{mensaje}</p>}
    <button type="submit" disabled={ocupado} style={{ width: "100%", marginTop: 10, padding: 10, border: 0, borderRadius: 9, background: "#9b4b1d", color: "#fff", fontWeight: 900 }}>{ocupado ? "Guardando…" : "Crear PNR y avisar al driver"}</button>
  </form>;
}

function TarjetaAdmin({ pnr, onCambio }) {
  const corte = useMemo(corteActual, []);
  const [valores, setValores] = useState({ resolucion: "", monto: "", desde: corte.desde, hasta: corte.hasta, observaciones: "" });
  const [evidencia, setEvidencia] = useState(null);
  const [ocupado, setOcupado] = useState(false);
  const [error, setError] = useState("");
  const [mensaje, setMensaje] = useState("");
  const cambiar = (nombre, valor) => setValores((actual) => ({ ...actual, [nombre]: valor }));

  async function ejecutar(accion) {
    try {
      setOcupado(true); setError(""); setMensaje("");
      await gestionarPnrFlotilla({ pnrId: pnr.id, accion, resolucion: valores.resolucion, monto: valores.monto });
      setMensaje("PNR actualizado. El driver verá el cambio en su aplicación.");
      await onCambio();
    } catch (fallo) { setError(fallo?.message || "No fue posible actualizar el PNR."); }
    finally { setOcupado(false); }
  }

  async function subirEvidencia() {
    try {
      setOcupado(true); setError(""); setMensaje("");
      await agregarEvidenciaPnr({ pnr, archivo: evidencia, nota: valores.observaciones || "Evidencia agregada por administración" });
      setEvidencia(null); setMensaje("Evidencia agregada al expediente."); await onCambio();
    } catch (fallo) { setError(fallo?.message || "No fue posible agregar la evidencia."); }
    finally { setOcupado(false); }
  }

  async function descontar() {
    try {
      setOcupado(true); setError(""); setMensaje("");
      await aplicarDescuentoPnr({ pnrId: pnr.id, saldo: pnr.saldo, desde: valores.desde, hasta: valores.hasta, monto: valores.monto, observaciones: valores.observaciones });
      setValores((actual) => ({ ...actual, monto: "", observaciones: "" }));
      setMensaje("Abono aplicado una sola vez y marcado para ambos documentos."); await onCambio();
    } catch (fallo) { setError(fallo?.message || "No fue posible aplicar el abono."); }
    finally { setOcupado(false); }
  }

  const temprano = ["EN_INVESTIGACION", "ESPERANDO_EVIDENCIA", "RESPONDIDO"].includes(pnr.estado);
  const conCobro = ["PENALIDAD_CONFIRMADA", "CONVENIO_SOLICITADO", "CONVENIO_ACTIVO"].includes(pnr.estado);
  return <article style={caja}>
    <CabeceraPnr pnr={pnr} />
    <small style={{ display: "block", marginTop: 6 }}>Driver: <b>{pnr.chofer_nombre}</b></small>
    {pnr.respuesta_chofer && <p style={{ padding: 9, borderRadius: 9, background: "#f3f8ff" }}><b>Respuesta del driver:</b> {pnr.respuesta_chofer}</p>}
    <EvidenciasPnr pnr={pnr} />
    {pnr.penalidad_monto > 0 && <p style={{ padding: 9, borderRadius: 9, background: "#fff0e7" }}><b>Penalidad:</b> {moneda(pnr.penalidad_monto)} · <b>Saldo:</b> {moneda(pnr.saldo)}{pnr.convenio_solicitado_monto > 0 ? ` · Solicitó ${moneda(pnr.convenio_solicitado_monto)} por semana` : ""}{pnr.convenio_autorizado_monto > 0 ? ` · Autorizado ${moneda(pnr.convenio_autorizado_monto)} por semana` : ""}</p>}
    {pnr.resolucion && <p style={{ padding: 9, borderRadius: 9, background: "#e8f8ee" }}><b>Resolución:</b> {pnr.resolucion}</p>}
    <HistorialDescuentos pnr={pnr} />

    {pnrEstaActivo(pnr.estado) && <div style={{ marginTop: 10, borderTop: "1px solid #ead9c8", paddingTop: 9 }}>
      <label style={{ display: "block", fontSize: 11, fontWeight: 850 }}>Nota, resolución u observación<textarea value={valores.resolucion} onChange={(e) => cambiar("resolucion", e.target.value)} rows={2} style={campo} /></label>
      <label style={{ display: "block", marginTop: 7, fontSize: 11, fontWeight: 850 }}>Importe<input type="number" min="0.01" step="0.01" value={valores.monto} onChange={(e) => cambiar("monto", e.target.value)} style={campo} /></label>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 8 }}>
        {temprano && <button type="button" disabled={ocupado} onClick={() => ejecutar("PEDIR_EVIDENCIA")}>Pedir evidencia</button>}
        {temprano && <button type="button" disabled={ocupado || !(Number(valores.monto) > 0)} onClick={() => ejecutar("PROPONER_PENALIDAD")}>Chory propone penalidad</button>}
        {pnr.estado === "PENALIDAD_PROPUESTA" && <button type="button" disabled={ocupado} onClick={() => ejecutar("CONFIRMAR_PENALIDAD")}>Mónica autoriza penalidad</button>}
        {pnr.estado === "CONVENIO_SOLICITADO" && <button type="button" disabled={ocupado} onClick={() => ejecutar("AUTORIZAR_CONVENIO")}>Mónica autoriza convenio</button>}
        {!conCobro && <button type="button" disabled={ocupado || valores.resolucion.trim().length < 5} onClick={() => ejecutar("RESOLVER_SIN_COBRO")}>Resolver sin cobro</button>}
      </div>
    </div>}

    {conCobro && pnr.saldo > 0 && <div style={{ marginTop: 10, padding: 9, borderRadius: 9, background: "#fff8ef" }}>
      <b style={{ fontSize: 12 }}>Aplicar abono al corte</b>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 7 }}>
        <label style={{ fontSize: 10, fontWeight: 850 }}>Desde<input type="date" value={valores.desde} onChange={(e) => cambiar("desde", e.target.value)} style={campo} /></label>
        <label style={{ fontSize: 10, fontWeight: 850 }}>Hasta<input type="date" value={valores.hasta} onChange={(e) => cambiar("hasta", e.target.value)} style={campo} /></label>
      </div>
      <label style={{ display: "block", marginTop: 7, fontSize: 10, fontWeight: 850 }}>Monto del abono<input type="number" min="0.01" max={pnr.saldo} step="0.01" value={valores.monto} onChange={(e) => cambiar("monto", e.target.value)} style={campo} /></label>
      <label style={{ display: "block", marginTop: 7, fontSize: 10, fontWeight: 850 }}>Observación<input value={valores.observaciones} onChange={(e) => cambiar("observaciones", e.target.value)} style={campo} /></label>
      <button type="button" disabled={ocupado || !(Number(valores.monto) > 0)} onClick={descontar} style={{ width: "100%", marginTop: 8 }}>Aplicar una vez en socio y driver</button>
    </div>}

    {pnrEstaActivo(pnr.estado) && <div style={{ marginTop: 9 }}>
      <label style={{ display: "block", fontSize: 10, fontWeight: 850 }}>Agregar foto o captura al expediente<input type="file" accept="image/jpeg,image/png,image/webp" onChange={(e) => setEvidencia(e.target.files?.[0] || null)} style={{ ...campo, padding: 7 }} /></label>
      <button type="button" disabled={ocupado || !evidencia} onClick={subirEvidencia} style={{ marginTop: 6 }}>Guardar evidencia</button>
    </div>}
    {error && <p role="alert" style={{ color: "#9b2929", fontWeight: 800 }}>{error}</p>}
    {mensaje && <p role="status" style={{ color: "#17643a", fontWeight: 800 }}>{mensaje}</p>}
  </article>;
}

export default function FlotillaPnr({ modoAdministracion = false }) {
  const [pnrs, setPnrs] = useState([]);
  const [rutas, setRutas] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState("");

  const cargar = useCallback(async ({ silencioso = false } = {}) => {
    try {
      if (!silencioso) setCargando(true);
      setError("");
      if (modoAdministracion) {
        const [expedientes, rutasRecientes] = await Promise.all([
          obtenerPnrFlotilla(),
          obtenerRutasParaPnr({ desde: fechaDiasAtras(35), hasta: fechaMexico() }),
        ]);
        setPnrs(expedientes); setRutas(rutasRecientes);
      } else {
        setPnrs(await obtenerPnrFlotilla());
      }
    } catch (fallo) { setError(fallo?.message || "No fue posible consultar los PNR."); }
    finally { if (!silencioso) setCargando(false); }
  }, [modoAdministracion]);

  useEffect(() => {
    cargar();
    const detener = suscribirseAPnrFlotilla(() => cargar({ silencioso: true }));
    return detener;
  }, [cargar]);

  const resumen = useMemo(() => resumirPnr(pnrs), [pnrs]);
  const activos = pnrs.filter((pnr) => pnrEstaActivo(pnr.estado));
  const cerrados = pnrs.filter((pnr) => !pnrEstaActivo(pnr.estado));

  return <section style={{ marginBottom: 16, padding: 15, borderRadius: 18, background: "linear-gradient(145deg,#fffdf9,#fff4e7)", border: "1px solid #e5b989" }}>
    <small style={{ color: "#984719", fontWeight: 900 }}>CONTROL PNR</small>
    <h2 style={{ margin: "5px 0" }}>{modoAdministracion ? "PNR de todos los drivers" : "Tus PNR en seguimiento"}</h2>
    <p style={{ marginTop: 4, fontSize: 12, color: "#765f4d" }}>{modoAdministracion ? "Solo Chory o Mónica pueden cerrar un expediente. Mónica autoriza penalidades y convenios." : "Estos avisos permanecen aquí hasta que Chory o Mónica los resuelvan. Responde y adjunta tus pruebas."}</p>
    <div style={{ display: "grid", gridTemplateColumns: "repeat(3,minmax(0,1fr))", gap: 6, textAlign: "center" }}>
      <div style={caja}><small>Activos</small><strong style={{ display: "block" }}>{resumen.activos}</strong></div>
      <div style={caja}><small>Con cobro</small><strong style={{ display: "block" }}>{resumen.conPenalidad}</strong></div>
      <div style={caja}><small>Saldo</small><strong style={{ display: "block" }}>{moneda(resumen.saldo)}</strong></div>
    </div>
    {modoAdministracion && <FormularioAltaPnr rutas={rutas} onRegistrado={() => cargar({ silencioso: true })} />}
    {cargando && <p role="status">Consultando PNR…</p>}
    {error && <p role="alert" style={{ color: "#9b2929", fontWeight: 800 }}>{error}</p>}
    {!cargando && !error && activos.length === 0 && <p style={{ padding: 10, borderRadius: 9, background: "#e8f8ee", color: "#17643a" }}>No hay PNR activos.</p>}
    <div style={{ display: "grid", gap: 10, marginTop: 12 }}>
      {activos.map((pnr) => modoAdministracion
        ? <TarjetaAdmin key={pnr.id} pnr={pnr} onCambio={() => cargar({ silencioso: true })} />
        : <VistaDriver key={pnr.id} pnr={pnr} onCambio={() => cargar({ silencioso: true })} />)}
    </div>
    {cerrados.length > 0 && <details style={{ marginTop: 12 }}>
      <summary style={{ cursor: "pointer", fontWeight: 850 }}>Historial resuelto ({cerrados.length})</summary>
      <div style={{ display: "grid", gap: 9, marginTop: 9 }}>
        {cerrados.map((pnr) => modoAdministracion
          ? <TarjetaAdmin key={pnr.id} pnr={pnr} onCambio={() => cargar({ silencioso: true })} />
          : <VistaDriver key={pnr.id} pnr={pnr} onCambio={() => cargar({ silencioso: true })} />)}
      </div>
    </details>}
  </section>;
}
