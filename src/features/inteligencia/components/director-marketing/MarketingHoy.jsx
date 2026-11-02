import { useEffect, useMemo, useState } from "react";

import { confirmarPublicacionManualMarketing } from "../../services/publicacionesMarketingService";
import { obtenerResultadosCampanas } from "../../services/resultadosMarketingService";
import { resumirMarketingHoy } from "../../utils/marketingHoy";

import "./MarketingHoy.css";

function nombreProducto(publicacion) {
  return (publicacion?.productos || []).map((item) => item?.nombre).filter(Boolean).join(", ") || "Publicación";
}

export default function MarketingHoy({
  organizationId,
  publicaciones = [],
  clientesPorId = new Map(),
  onActualizar,
  onAbrirRevision,
  onAbrirResultados,
}) {
  const [resultados, setResultados] = useState([]);
  const [referencias, setReferencias] = useState({});
  const [guardandoId, setGuardandoId] = useState("");
  const [mensaje, setMensaje] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    let vigente = true;
    obtenerResultadosCampanas({ organizationId })
      .then((registros) => { if (vigente) setResultados(registros); })
      .catch(() => { if (vigente) setResultados([]); });
    return () => { vigente = false; };
  }, [organizationId, publicaciones]);

  const resumen = useMemo(
    () => resumirMarketingHoy({ publicaciones, resultados }),
    [publicaciones, resultados]
  );

  async function confirmar(publicacionId) {
    try {
      setGuardandoId(publicacionId);
      setError("");
      setMensaje("");
      await confirmarPublicacionManualMarketing({
        publicacionId,
        referencia: referencias[publicacionId],
      });
      setReferencias((actuales) => ({ ...actuales, [publicacionId]: "" }));
      setMensaje("Publicación reportada con evidencia. Ya puede capturarse el resultado.");
      await onActualizar?.();
    } catch (errorConfirmacion) {
      setError(errorConfirmacion?.message || "No fue posible confirmar la publicación.");
    } finally {
      setGuardandoId("");
    }
  }

  return (
    <section className="marketing-today" aria-labelledby="marketing-today-title">
      <div className="marketing-today__heading">
        <div><span>Centro diario</span><h4 id="marketing-today-title">Marketing de hoy</h4><p>Una prioridad y el camino completo hasta medir.</p></div>
        <i>{resumen.hoy}</i>
      </div>

      <div className={`marketing-today__priority is-${resumen.prioridad.tipo.toLowerCase()}`}>
        <small>PRIMERO</small>
        <strong>{resumen.prioridad.titulo}</strong>
        <p>{resumen.prioridad.detalle}</p>
        {resumen.prioridad.tipo === "REVISAR" && <button type="button" onClick={onAbrirRevision}>Abrir revisión →</button>}
        {resumen.prioridad.tipo === "MEDIR" && <button type="button" onClick={onAbrirResultados}>Registrar resultados →</button>}
      </div>

      <div className="marketing-today__metrics">
        <button type="button" onClick={onAbrirRevision}><small>Por revisar</small><b>{resumen.pendientesAprobacion.length}</b></button>
        <span><small>Publicar hoy</small><b>{resumen.programadasHoy.length}</b></span>
        <span><small>Publicadas hoy</small><b>{resumen.publicadasHoy.length}</b></span>
        <button type="button" onClick={onAbrirResultados}><small>Falta medir</small><b>{resumen.resultadosPendientes.length}</b></button>
      </div>

      {resumen.programadasHoy.length > 0 && (
        <div className="marketing-today__publish">
          <strong>Confirmar publicaciones manuales</strong>
          <small>Solo confirma después de publicarla realmente en la plataforma.</small>
          {resumen.programadasHoy.map((publicacion) => (
            <article key={publicacion.id}>
              <div><b>{nombreProducto(publicacion)}</b><span>{clientesPorId.get(publicacion.cliente_agencia_id)?.nombre || "Negocio por identificar"}</span></div>
              <small>{(publicacion.canales || []).join(" · ")}</small>
              <input
                value={referencias[publicacion.id] || ""}
                onChange={(evento) => setReferencias((actuales) => ({ ...actuales, [publicacion.id]: evento.target.value }))}
                placeholder="Pega el enlace o referencia de la publicación"
                maxLength={500}
              />
              <button type="button" disabled={guardandoId === publicacion.id} onClick={() => confirmar(publicacion.id)}>
                {guardandoId === publicacion.id ? "Guardando…" : "Confirmar con evidencia"}
              </button>
            </article>
          ))}
        </div>
      )}

      {mensaje && <p className="marketing-today__message">{mensaje}</p>}
      {error && <p className="marketing-today__error">{error}</p>}
    </section>
  );
}
