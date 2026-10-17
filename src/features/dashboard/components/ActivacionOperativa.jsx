import { useCallback, useEffect, useMemo, useState } from "react";
import { fechaActualMexico } from "../../inteligencia/services/asistenciaOperativaService";
import { obtenerFuentesActivacionOperativa } from "../services/activacionOperativaService";
import { resumirActivacionOperativa } from "../utils/activacionOperativa";
import "./ActivacionOperativa.css";

const ACCIONES = {
  finanzas: "finanzas",
  equipo: "equipo",
  marketing: "marketing",
  flotilla: "flotilla",
};

export default function ActivacionOperativa({
  organizationId,
  businessId,
  finanzas,
  onAbrirFinanzas,
  onAbrirTesoreria,
  onAbrirEquipo,
  onAbrirMarketing,
  onAbrirFlotilla,
}) {
  const [fuentes, setFuentes] = useState(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState("");

  const cargar = useCallback(async () => {
    if (!organizationId || !businessId) {
      setFuentes(null);
      setError("Falta identificar la organización y el negocio.");
      setCargando(false);
      return;
    }
    setCargando(true);
    setError("");
    try {
      setFuentes(await obtenerFuentesActivacionOperativa({
        organizationId,
        businessId,
      }));
    } catch (fallo) {
      setFuentes(null);
      setError(fallo?.message || "No fue posible comprobar la operación.");
    } finally {
      setCargando(false);
    }
  }, [organizationId, businessId]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  const resumen = useMemo(() => resumirActivacionOperativa({
    hoy: fechaActualMexico(),
    finanzas,
    ...(fuentes || {}),
  }), [finanzas, fuentes]);

  function abrir(modulo) {
    const acciones = {
      finanzas: modulo?.accion === "Abrir Tesorería" ? onAbrirTesoreria : onAbrirFinanzas,
      equipo: onAbrirEquipo,
      marketing: onAbrirMarketing,
      flotilla: onAbrirFlotilla,
    };
    acciones[ACCIONES[modulo?.id]]?.();
  }

  return (
    <section className="activation-center" aria-labelledby="activation-center-title">
      <header>
        <div>
          <span>OPERACIÓN REAL · HOY</span>
          <h2 id="activation-center-title">Qué está trabajando y qué sigue detenido</h2>
          <p>MONYS comprueba datos y pendientes reales. No autoriza pagos, campañas ni decisiones de personal.</p>
        </div>
        <button type="button" onClick={cargar} disabled={cargando}>
          {cargando ? "Comprobando…" : "Actualizar"}
        </button>
      </header>

      {error && <p className="activation-center__error" role="alert">{error}</p>}

      <div className="activation-center__status">
        <div>
          <small>ESTADO GENERAL</small>
          <strong>{cargando ? "Comprobando fuentes" : `${resumen.listos} de ${resumen.total} áreas listas`}</strong>
        </div>
        {!cargando && resumen.prioridad && (
          <button type="button" onClick={() => abrir(resumen.prioridad)}>
            Prioridad: {resumen.prioridad.nombre} →
          </button>
        )}
      </div>

      <div className="activation-center__grid">
        {resumen.modulos.map((modulo) => (
          <article key={modulo.id} data-estado={modulo.estado}>
            <div className="activation-center__card-head">
              <span>{modulo.nombre}</span>
              <b>{modulo.estado === "LISTO" ? "LISTO" : modulo.estado === "ATENCION" ? "ATENCIÓN" : "PENDIENTE"}</b>
            </div>
            <strong>{modulo.etiquetaCifra}</strong>
            <p>{modulo.detalle}</p>
            <button type="button" onClick={() => abrir(modulo)}>{modulo.accion} →</button>
          </article>
        ))}
      </div>

      <footer>
        REAL: registros consultados · PENDIENTE: falta una fuente o dato indispensable · ATENCIÓN: existe trabajo vencido o sin comprobar.
      </footer>
    </section>
  );
}
