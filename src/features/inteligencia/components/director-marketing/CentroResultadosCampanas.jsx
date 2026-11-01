import { useEffect, useMemo, useState } from "react";

import { obtenerResultadosCampanas, registrarResultadoCampana } from "../../services/resultadosMarketingService";
import { analizarResultadoCampana } from "../../utils/analisisResultadosMarketing";
import { claveFechaMexico } from "./calendarioCampanasMarketingUtils";

import "./CentroResultadosCampanas.css";

function nombreCampana(publicacion) {
  return (publicacion?.productos || []).map((producto) => producto.nombre).filter(Boolean).join(", ") || "Campaña sin producto";
}

function dinero(valor) {
  return Number(valor || 0).toLocaleString("es-MX", { style: "currency", currency: "MXN" });
}

const CAMPOS_INICIALES = { alcance: 0, interacciones: 0, mensajes: 0, pedidos: 0, ventas: 0, gasto: 0, evidencia: "", nota: "" };

export default function CentroResultadosCampanas({ organizationId, publicaciones = [], clientesPorId = new Map() }) {
  const hoy = claveFechaMexico(new Date());
  const [resultados, setResultados] = useState([]);
  const [mostrarFormulario, setMostrarFormulario] = useState(false);
  const [publicacionId, setPublicacionId] = useState("");
  const [periodoDesde, setPeriodoDesde] = useState(hoy);
  const [periodoHasta, setPeriodoHasta] = useState(hoy);
  const [campos, setCampos] = useState(CAMPOS_INICIALES);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState("");
  const [mensaje, setMensaje] = useState("");

  const campanasMedibles = useMemo(
    () => publicaciones.filter((publicacion) => !["BORRADOR", "CANCELADA", "REQUIERE_AJUSTES"].includes(publicacion.estado)),
    [publicaciones]
  );
  const publicacionesPorId = useMemo(() => new Map(publicaciones.map((publicacion) => [publicacion.id, publicacion])), [publicaciones]);

  async function cargar() {
    try {
      setResultados(await obtenerResultadosCampanas({ organizationId }));
    } catch (errorCarga) {
      setError(errorCarga?.message || "No fue posible cargar los resultados.");
    }
  }

  useEffect(() => { cargar(); }, [organizationId]);
  useEffect(() => {
    if (!campanasMedibles.some((publicacion) => publicacion.id === publicacionId)) setPublicacionId(campanasMedibles[0]?.id || "");
  }, [campanasMedibles, publicacionId]);

  const resumen = useMemo(() => resultados.reduce((acumulado, resultado) => ({
    ventas: acumulado.ventas + Number(resultado.ventas_atribuidas || 0),
    gasto: acumulado.gasto + Number(resultado.gasto_real || 0),
    mensajes: acumulado.mensajes + Number(resultado.mensajes || 0),
    pedidos: acumulado.pedidos + Number(resultado.pedidos || 0),
  }), { ventas: 0, gasto: 0, mensajes: 0, pedidos: 0 }), [resultados]);

  function cambiarCampo(campo, valor) {
    setCampos((actual) => ({ ...actual, [campo]: valor }));
  }

  async function guardar(evento) {
    evento.preventDefault();
    try {
      setGuardando(true); setError(""); setMensaje("");
      await registrarResultadoCampana({
        organizationId, publicacionId, periodoDesde, periodoHasta,
        alcance: campos.alcance, interacciones: campos.interacciones, mensajes: campos.mensajes,
        pedidos: campos.pedidos, ventasAtribuidas: campos.ventas, gastoReal: campos.gasto,
        evidenciaReferencia: campos.evidencia, nota: campos.nota,
      });
      setCampos(CAMPOS_INICIALES); setMostrarFormulario(false);
      setMensaje("Resultado reportado. MONYS ya actualizó la recomendación.");
      await cargar();
    } catch (errorGuardado) {
      setError(errorGuardado?.message || "No fue posible guardar el resultado.");
    } finally { setGuardando(false); }
  }

  return (
    <section className="campaign-results" aria-labelledby="campaign-results-title">
      <div className="campaign-results__heading">
        <div><span>Equipo de análisis</span><h4 id="campaign-results-title">Resultados de campañas</h4><p>Ventas e inversión son cifras reportadas; no se mezclan con contabilidad hasta verificarlas.</p></div>
        <button type="button" onClick={() => setMostrarFormulario((actual) => !actual)}>{mostrarFormulario ? "Cerrar" : "+ Registrar resultado"}</button>
      </div>

      <div className="campaign-results__summary">
        <div><small>Ventas reportadas</small><strong>{dinero(resumen.ventas)}</strong></div>
        <div><small>Inversión reportada</small><strong>{dinero(resumen.gasto)}</strong></div>
        <div><small>Mensajes</small><strong>{resumen.mensajes}</strong></div>
        <div><small>Pedidos</small><strong>{resumen.pedidos}</strong></div>
      </div>

      {mostrarFormulario && (
        <form className="campaign-results__form" onSubmit={guardar}>
          <label className="is-wide">Campaña<select value={publicacionId} onChange={(evento) => setPublicacionId(evento.target.value)} required><option value="">Selecciona una campaña aprobada</option>{campanasMedibles.map((publicacion) => <option key={publicacion.id} value={publicacion.id}>{clientesPorId.get(publicacion.cliente_agencia_id)?.nombre || "Cliente por asignar"} · {nombreCampana(publicacion)}</option>)}</select></label>
          <label>Desde<input type="date" value={periodoDesde} onChange={(e) => setPeriodoDesde(e.target.value)} required /></label>
          <label>Hasta<input type="date" value={periodoHasta} onChange={(e) => setPeriodoHasta(e.target.value)} required /></label>
          {[["alcance","Alcance"],["interacciones","Interacciones"],["mensajes","Mensajes"],["pedidos","Pedidos"],["ventas","Ventas atribuidas (MXN)"],["gasto","Inversión real (MXN)"]].map(([campo, etiqueta]) => <label key={campo}>{etiqueta}<input type="number" min="0" step={["ventas","gasto"].includes(campo) ? "0.01" : "1"} value={campos[campo]} onChange={(e) => cambiarCampo(campo, e.target.value)} required /></label>)}
          <label className="is-wide">Evidencia o referencia<input value={campos.evidencia} onChange={(e) => cambiarCampo("evidencia", e.target.value)} placeholder="Ej. Captura de Meta del 1 de noviembre" maxLength={500} required /></label>
          <label className="is-wide">Nota opcional<textarea value={campos.nota} onChange={(e) => cambiarCampo("nota", e.target.value)} rows={2} placeholder="Qué funcionó o qué debe cambiar" /></label>
          <button type="submit" disabled={guardando || !publicacionId}>{guardando ? "Guardando…" : "Guardar y analizar"}</button>
        </form>
      )}

      <div className="campaign-results__list">
        {resultados.slice(0, 6).map((resultado) => {
          const publicacion = publicacionesPorId.get(resultado.publicacion_id);
          const analisis = analizarResultadoCampana(resultado);
          return <article key={resultado.id} className={`is-${analisis.accion.toLowerCase()}`}><div><span>{clientesPorId.get(publicacion?.cliente_agencia_id)?.nombre || "Cliente por asignar"}</span><i>{analisis.accion}</i></div><h5>{nombreCampana(publicacion)}</h5><p><b>{analisis.titulo}</b> — {analisis.detalle}</p><small>{resultado.periodo_desde} al {resultado.periodo_hasta} · Ventas {dinero(resultado.ventas_atribuidas)} · Inversión {dinero(resultado.gasto_real)}{analisis.roas !== undefined ? ` · Retorno reportado ${analisis.roas.toFixed(2)}x` : ""}</small></article>;
        })}
        {!resultados.length && <p className="campaign-results__empty">Aún no hay resultados reportados. Registra el primero cuando una campaña tenga datos reales.</p>}
      </div>
      {mensaje && <p className="campaign-results__message">{mensaje}</p>}
      {error && <p className="campaign-results__error">{error}</p>}
    </section>
  );
}
