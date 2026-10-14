import { useCallback, useEffect, useMemo, useState } from "react";

import {
  obtenerIncidenciasFlotilla,
  registrarIncidenciaFlotilla,
  revisarIncidenciaFlotilla,
  suscribirseAIncidenciasFlotilla,
} from "./services/incidenciasFlotilla";
import {
  ESTADOS_INCIDENCIA_FLOTILLA,
  TIPOS_INCIDENCIA_FLOTILLA,
  etiquetaTipoIncidencia,
  tipoIncidenciaRequierePaquete,
} from "../utils/incidenciasFlotilla";

const caja = {
  background: "#fff",
  border: "1px solid #e2d4dc",
  borderRadius: 14,
  padding: 13,
};

function fechaMexico() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Mexico_City" }).format(new Date());
}

function fechaDiasAtras(dias) {
  const fecha = new Date();
  fecha.setDate(fecha.getDate() - dias);
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Mexico_City" }).format(fecha);
}

function estadoColor(estado) {
  if (estado === "RESUELTA") return { fondo: "#e8f8ee", color: "#17643a" };
  if (estado === "RECHAZADA") return { fondo: "#ffe9e4", color: "#963527" };
  if (estado === "EN_REVISION") return { fondo: "#fff4d7", color: "#755713" };
  return { fondo: "#f2e9ff", color: "#674093" };
}

function GaleriaIncidencia({ incidencia }) {
  const fotos = [
    ["Contexto", incidencia.foto_contexto_url],
    ["Detalle o etiqueta", incidencia.foto_detalle_url],
    ...(incidencia.fotos_extra_urls || []).map((url, indice) => [`Adicional ${indice + 1}`, url]),
  ];
  return <div style={{ display: "grid", gridTemplateColumns: "repeat(2,minmax(0,1fr))", gap: 8, marginTop: 10 }}>
    {fotos.map(([etiqueta, url]) => <a key={etiqueta} href={url || undefined} target="_blank" rel="noreferrer" style={{ color: "#174b7a", textDecoration: "none" }}>
      {url ? <img src={url} alt={etiqueta} style={{ width: "100%", height: 125, objectFit: "cover", borderRadius: 10, background: "#eef3f7" }} /> : <div style={{ height: 125, display: "grid", placeItems: "center", borderRadius: 10, background: "#fff1ee", color: "#8a2e1b" }}>Foto no disponible</div>}
      <small style={{ display: "block", marginTop: 4, fontWeight: 850 }}>{etiqueta} · {url ? "Abrir" : "Sin acceso"}</small>
    </a>)}
  </div>;
}

function FormularioIncidencia({ rutaId, unidad, onRegistrada }) {
  const [tipo, setTipo] = useState("");
  const [paqueteId, setPaqueteId] = useState("");
  const [descripcion, setDescripcion] = useState("");
  const [fotoContexto, setFotoContexto] = useState(null);
  const [fotoDetalle, setFotoDetalle] = useState(null);
  const [fotosExtra, setFotosExtra] = useState([]);
  const [guardando, setGuardando] = useState(false);
  const [mensaje, setMensaje] = useState("");
  const [error, setError] = useState("");

  async function enviar(evento) {
    evento.preventDefault();
    const formulario = evento.currentTarget;
    try {
      setGuardando(true);
      setError("");
      setMensaje("");
      const guardada = await registrarIncidenciaFlotilla({
        rutaId,
        tipo,
        paqueteId,
        descripcion,
        fotoContexto,
        fotoDetalle,
        fotosExtra,
      });
      setTipo("");
      setPaqueteId("");
      setDescripcion("");
      setFotoContexto(null);
      setFotoDetalle(null);
      setFotosExtra([]);
      setMensaje(`Incidencia guardada con folio ${String(guardada.id).slice(0, 8)}. Administración ya puede revisarla.`);
      if (typeof onRegistrada === "function") onRegistrada(guardada);
      formulario.reset();
    } catch (errorRegistro) {
      setError(errorRegistro?.message || "No fue posible registrar la incidencia.");
    } finally {
      setGuardando(false);
    }
  }

  return <section style={{ ...caja, marginBottom: 14, borderColor: "#e5bacf", background: "linear-gradient(145deg,#fff,#fff5fa)" }}>
    <small style={{ color: "#a52d65", fontWeight: 900 }}>EXPEDIENTE CON FOTOGRAFÍAS</small>
    <h2 style={{ margin: "5px 0" }}>Reportar incidencia</h2>
    <p style={{ fontSize: 12, color: "#755969" }}>Quedará ligada a la fecha, ruta, unidad y chofer. Las fotografías son privadas y sólo las verá personal autorizado.</p>
    {!rutaId && <p role="alert" style={{ padding: 10, borderRadius: 9, background: "#fff0e8", color: "#8a3a20", fontWeight: 800 }}>Primero debe existir una ruta de hoy para esta unidad.</p>}
    <form onSubmit={enviar}>
      <label style={{ display: "block", fontSize: 12, fontWeight: 850 }}>Unidad<input value={unidad?.placas || "Sin unidad"} readOnly style={{ width: "100%", marginTop: 4, padding: 9, borderRadius: 9, border: "1px solid #e2d4dc", background: "#f6f2f4" }} /></label>
      <label style={{ display: "block", marginTop: 9, fontSize: 12, fontWeight: 850 }}>¿Qué ocurrió?<select value={tipo} onChange={(e) => setTipo(e.target.value)} style={{ width: "100%", marginTop: 4, padding: 9, borderRadius: 9 }}><option value="">Seleccionar…</option>{TIPOS_INCIDENCIA_FLOTILLA.map((opcion) => <option key={opcion.value} value={opcion.value}>{opcion.label}</option>)}</select></label>
      {tipoIncidenciaRequierePaquete(tipo) && <label style={{ display: "block", marginTop: 9, fontSize: 12, fontWeight: 850 }}>ID del paquete<input value={paqueteId} onChange={(e) => setPaqueteId(e.target.value)} maxLength={80} placeholder="Escanea o escribe el ID visible" style={{ width: "100%", marginTop: 4, padding: 9, borderRadius: 9, border: "1px solid #e2d4dc" }} /></label>}
      <label style={{ display: "block", marginTop: 9, fontSize: 12, fontWeight: 850 }}>Explica qué pasó<textarea value={descripcion} onChange={(e) => setDescripcion(e.target.value)} rows={3} maxLength={1200} placeholder="Qué ocurrió, dónde quedó y qué acción tomaste" style={{ width: "100%", marginTop: 4, padding: 9, borderRadius: 9, border: "1px solid #e2d4dc" }} /></label>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginTop: 10 }}>
        <label style={{ fontSize: 11, fontWeight: 850, padding: 9, borderRadius: 10, border: "2px dashed #d7a9c1" }}>1. Foto general<input type="file" accept="image/jpeg,image/png,image/webp" capture="environment" onChange={(e) => setFotoContexto(e.target.files?.[0] || null)} style={{ width: "100%", marginTop: 7 }} /></label>
        <label style={{ fontSize: 11, fontWeight: 850, padding: 9, borderRadius: 10, border: "2px dashed #d7a9c1" }}>2. Detalle o etiqueta<input type="file" accept="image/jpeg,image/png,image/webp" capture="environment" onChange={(e) => setFotoDetalle(e.target.files?.[0] || null)} style={{ width: "100%", marginTop: 7 }} /></label>
      </div>
      <label style={{ display: "block", marginTop: 9, fontSize: 11, fontWeight: 850 }}>Fotografías adicionales · máximo 2<input type="file" accept="image/jpeg,image/png,image/webp" capture="environment" multiple onChange={(e) => setFotosExtra(Array.from(e.target.files || []).slice(0, 2))} style={{ width: "100%", marginTop: 5 }} /></label>
      {error && <p role="alert" style={{ color: "#9b2929", fontWeight: 800 }}>{error}</p>}
      {mensaje && <p role="status" style={{ color: "#17643a", fontWeight: 800 }}>{mensaje}</p>}
      <button type="submit" disabled={guardando || !rutaId} style={{ width: "100%", marginTop: 11, padding: 11, border: 0, borderRadius: 10, background: "#b52769", color: "#fff", fontWeight: 900 }}>{guardando ? "Guardando fotografías…" : "Guardar incidencia y avisar a Chory"}</button>
    </form>
  </section>;
}

function TableroIncidencias({ unidades, soloConsulta }) {
  const [desde, setDesde] = useState(() => fechaDiasAtras(7));
  const [hasta, setHasta] = useState(fechaMexico);
  const [unidadId, setUnidadId] = useState("");
  const [estado, setEstado] = useState("");
  const [incidencias, setIncidencias] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState("");
  const [editando, setEditando] = useState("");
  const [resolucion, setResolucion] = useState("");
  const [guardando, setGuardando] = useState(false);

  const cargar = useCallback(async ({ silencioso = false } = {}) => {
    try {
      if (!silencioso) setCargando(true);
      setError("");
      setIncidencias(await obtenerIncidenciasFlotilla({ desde, hasta, unidadId, estado }));
    } catch (errorConsulta) {
      setError(errorConsulta?.message || "No fue posible consultar las incidencias.");
    } finally {
      if (!silencioso) setCargando(false);
    }
  }, [desde, hasta, unidadId, estado]);

  useEffect(() => {
    cargar();
    const detener = suscribirseAIncidenciasFlotilla(() => cargar({ silencioso: true }));
    return detener;
  }, [cargar]);

  const totales = useMemo(() => incidencias.reduce((resultado, item) => ({
    ...resultado,
    [item.estado]: (resultado[item.estado] || 0) + 1,
  }), {}), [incidencias]);

  async function cambiarEstado(incidenciaId, nuevoEstado) {
    try {
      setGuardando(true);
      setError("");
      await revisarIncidenciaFlotilla({ incidenciaId, estado: nuevoEstado, resolucion });
      setEditando("");
      setResolucion("");
      await cargar({ silencioso: true });
    } catch (errorRevision) {
      setError(errorRevision?.message || "No fue posible revisar la incidencia.");
    } finally {
      setGuardando(false);
    }
  }

  return <section style={{ marginBottom: 16, padding: 16, borderRadius: 18, background: "linear-gradient(145deg,#fff,#fff4f9)", border: "1px solid #e5bacf" }}>
    <small style={{ color: "#a52d65", fontWeight: 900 }}>CONTROL DE INCIDENCIAS</small>
    <h2 style={{ margin: "5px 0" }}>Fotografías y expedientes por fecha</h2>
    <p style={{ fontSize: 12, color: "#755969" }}>Cada expediente conserva ruta, unidad, chofer, fotografías y resolución administrativa.</p>

    <div style={{ display: "grid", gridTemplateColumns: "repeat(2,minmax(0,1fr))", gap: 8 }}>
      <label style={{ fontSize: 11, fontWeight: 850 }}>Desde<input type="date" value={desde} onChange={(e) => setDesde(e.target.value)} style={{ width: "100%", marginTop: 4, padding: 8 }} /></label>
      <label style={{ fontSize: 11, fontWeight: 850 }}>Hasta<input type="date" value={hasta} onChange={(e) => setHasta(e.target.value)} style={{ width: "100%", marginTop: 4, padding: 8 }} /></label>
      <label style={{ fontSize: 11, fontWeight: 850 }}>Unidad<select value={unidadId} onChange={(e) => setUnidadId(e.target.value)} style={{ width: "100%", marginTop: 4, padding: 8 }}><option value="">Todas</option>{(unidades || []).map((item) => <option key={item.id} value={item.id}>{item.placas} · {item.chofer_nombre}</option>)}</select></label>
      <label style={{ fontSize: 11, fontWeight: 850 }}>Estado<select value={estado} onChange={(e) => setEstado(e.target.value)} style={{ width: "100%", marginTop: 4, padding: 8 }}><option value="">Todos</option>{ESTADOS_INCIDENCIA_FLOTILLA.map((valor) => <option key={valor} value={valor}>{valor.replace("_", " ")}</option>)}</select></label>
    </div>

    <div style={{ display: "grid", gridTemplateColumns: "repeat(4,minmax(0,1fr))", gap: 6, marginTop: 10, textAlign: "center" }}>
      {ESTADOS_INCIDENCIA_FLOTILLA.map((valor) => <div key={valor} style={{ ...caja, padding: 8 }}><small>{valor.replace("_", " ")}</small><strong style={{ display: "block" }}>{totales[valor] || 0}</strong></div>)}
    </div>

    {cargando && <p role="status">Consultando expedientes…</p>}
    {error && <p role="alert" style={{ color: "#9b2929", fontWeight: 800 }}>{error}</p>}
    {!cargando && !error && incidencias.length === 0 && <p style={{ color: "#755969" }}>No hay incidencias registradas en este periodo.</p>}

    <div style={{ display: "grid", gap: 10, marginTop: 12 }}>
      {incidencias.map((incidencia) => {
        const color = estadoColor(incidencia.estado);
        return <article key={incidencia.id} style={caja}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "start" }}>
            <div><strong>{etiquetaTipoIncidencia(incidencia.tipo)}</strong><small style={{ display: "block", marginTop: 3 }}>{incidencia.fecha} · {incidencia.unidad?.placas || "Sin placas"} · {incidencia.chofer_nombre}</small></div>
            <span style={{ padding: "4px 7px", borderRadius: 999, background: color.fondo, color: color.color, fontSize: 10, fontWeight: 900 }}>{incidencia.estado.replace("_", " ")}</span>
          </div>
          <small style={{ display: "block", marginTop: 6 }}>Ruta: {incidencia.ruta?.codigo_ruta || "Sin código"}{incidencia.paquete_id ? ` · Paquete: ${incidencia.paquete_id}` : ""} · Folio: {incidencia.id.slice(0, 8)}</small>
          <p style={{ marginBottom: 0 }}>{incidencia.descripcion}</p>
          <GaleriaIncidencia incidencia={incidencia} />
          {incidencia.resolucion && <p style={{ padding: 9, borderRadius: 9, background: color.fondo, color: color.color }}><b>Resolución:</b> {incidencia.resolucion}</p>}
          {!soloConsulta && <div style={{ marginTop: 10 }}>
            {editando === incidencia.id ? <>
              <textarea value={resolucion} onChange={(e) => setResolucion(e.target.value)} rows={2} placeholder="Qué se revisó y cómo se resolvió" style={{ width: "100%", padding: 8, borderRadius: 8 }} />
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 6 }}>
                <button type="button" disabled={guardando} onClick={() => cambiarEstado(incidencia.id, "EN_REVISION")}>Dejar en revisión</button>
                <button type="button" disabled={guardando || !resolucion.trim()} onClick={() => cambiarEstado(incidencia.id, "RESUELTA")}>Marcar resuelta</button>
                <button type="button" disabled={guardando || !resolucion.trim()} onClick={() => cambiarEstado(incidencia.id, "RECHAZADA")}>Rechazar</button>
                <button type="button" disabled={guardando} onClick={() => { setEditando(""); setResolucion(""); }}>Cancelar</button>
              </div>
            </> : <button type="button" onClick={() => { setEditando(incidencia.id); setResolucion(incidencia.resolucion || ""); }}>Revisar expediente</button>}
          </div>}
        </article>;
      })}
    </div>
  </section>;
}

export default function FlotillaIncidencias({
  modoAdministracion = false,
  soloConsulta = false,
  unidades = [],
  rutaId = null,
  unidad = null,
}) {
  return modoAdministracion
    ? <TableroIncidencias unidades={unidades} soloConsulta={soloConsulta} />
    : <FormularioIncidencia rutaId={rutaId} unidad={unidad} />;
}
