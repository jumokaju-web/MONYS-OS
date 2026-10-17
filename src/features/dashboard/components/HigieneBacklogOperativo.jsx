import { useCallback, useEffect, useMemo, useState } from "react";
import { fechaActualMexico } from "../../inteligencia/services/asistenciaOperativaService";
import { analizarBacklogOperativo } from "../utils/higieneBacklogOperativo";
import { cancelarCopiasExactas, obtenerBacklogOperativo } from "../services/higieneBacklogService";
import "./HigieneBacklogOperativo.css";

function nombreSucursal(branchId, sucursales) {
  const sucursal = sucursales.find((item) => item?.id === branchId || item?.branch_id === branchId);
  return sucursal?.name || sucursal?.nombre || "Sucursal identificada";
}

function fechaVisible(valor) {
  const fecha = new Date(`${String(valor || "").slice(0, 10)}T12:00:00`);
  return Number.isNaN(fecha.getTime())
    ? "Fecha pendiente"
    : fecha.toLocaleDateString("es-MX", { day: "2-digit", month: "short", year: "numeric" });
}

export default function HigieneBacklogOperativo({
  organizationId,
  businessId,
  sucursales = [],
  onAbrirEquipo,
}) {
  const [tareas, setTareas] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState("");
  const [mensaje, setMensaje] = useState("");
  const [grupoActivo, setGrupoActivo] = useState(null);
  const [confirmacion, setConfirmacion] = useState("");
  const [guardando, setGuardando] = useState(false);

  const cargar = useCallback(async () => {
    if (!organizationId || !businessId) {
      setError("Falta identificar la organización y el negocio.");
      setCargando(false);
      return;
    }
    setCargando(true);
    setError("");
    try {
      setTareas(await obtenerBacklogOperativo({ organizationId, businessId }));
    } catch (fallo) {
      setTareas([]);
      setError(fallo?.message || "No fue posible revisar el trabajo abierto.");
    } finally {
      setCargando(false);
    }
  }, [businessId, organizationId]);

  useEffect(() => { cargar(); }, [cargar]);

  const analisis = useMemo(() => analizarBacklogOperativo(tareas, {
    hoy: fechaActualMexico(),
  }), [tareas]);

  async function confirmarGrupo(grupo) {
    setGuardando(true);
    setError("");
    setMensaje("");
    try {
      const resultado = await cancelarCopiasExactas({
        organizationId,
        businessId,
        principalId: grupo.principal.id,
        duplicadaIds: grupo.duplicadas.map((item) => item.id),
        confirmacion,
      });
      setMensaje(`Listo: se conservó una tarea y se cancelaron ${resultado.canceladas.length} copias. El historial permanece guardado.`);
      setGrupoActivo(null);
      setConfirmacion("");
      await cargar();
    } catch (fallo) {
      setError(fallo?.message || "No fue posible guardar la decisión.");
    } finally {
      setGuardando(false);
    }
  }

  return (
    <section className="backlog-hygiene" aria-labelledby="backlog-hygiene-title">
      <header>
        <div>
          <span>TRABAJO ATRASADO · REVISIÓN EJECUTIVA</span>
          <h2 id="backlog-hygiene-title">Una sola lista para ordenar lo pendiente</h2>
          <p>MONYS separa atraso real, trabajo vigente y copias exactas. Nada se borra ni se cancela sin tu autorización.</p>
        </div>
        <button type="button" className="backlog-hygiene__refresh" onClick={cargar} disabled={cargando}>
          {cargando ? "Revisando…" : "Actualizar"}
        </button>
      </header>

      {error && <p className="backlog-hygiene__notice is-error" role="alert">{error}</p>}
      {mensaje && <p className="backlog-hygiene__notice is-success" role="status">{mensaje}</p>}

      <div className="backlog-hygiene__metrics" aria-label="Resumen real del trabajo abierto">
        <article><small>ABIERTAS</small><strong>{cargando ? "—" : analisis.totalAbiertas}</strong><span>REAL</span></article>
        <article><small>VENCIDAS</small><strong>{cargando ? "—" : analisis.vencidas.length}</strong><span>REAL</span></article>
        <article><small>COPIAS EXACTAS</small><strong>{cargando ? "—" : analisis.copiasExactas}</strong><span>POR AUTORIZAR</span></article>
        <article><small>FECHA INCOMPLETA</small><strong>{cargando ? "—" : analisis.fechaPendiente.length}</strong><span>PENDIENTE</span></article>
      </div>

      {!cargando && (
        <div className="backlog-hygiene__priority">
          <div><small>SIGUIENTE DECISIÓN</small><strong>{analisis.prioridad}</strong></div>
          <button type="button" onClick={onAbrirEquipo}>Reprogramar en Equipo →</button>
        </div>
      )}

      {!cargando && analisis.gruposDuplicados.length > 0 && (
        <details className="backlog-hygiene__duplicates">
          <summary>Revisar {analisis.gruposDuplicados.length} grupo{analisis.gruposDuplicados.length === 1 ? "" : "s"} de copias exactas</summary>
          <p className="backlog-hygiene__rule">EVIDENCIA: coinciden fecha, sucursal, área, responsable, título, instrucciones, hora, checklist y criterio. Las tareas de fechas distintas no se mezclan.</p>
          <div className="backlog-hygiene__list">
            {analisis.gruposDuplicados.map((grupo) => (
              <article key={grupo.firma}>
                <small>{nombreSucursal(grupo.principal.branch_id, sucursales)} · {fechaVisible(grupo.principal.fecha)}</small>
                <h3>{grupo.principal.titulo}</h3>
                <p>Conservar la primera tarea y cancelar {grupo.duplicadas.length} copia{grupo.duplicadas.length === 1 ? "" : "s"} idéntica{grupo.duplicadas.length === 1 ? "" : "s"}.</p>
                {grupoActivo === grupo.firma ? (
                  <div className="backlog-hygiene__confirm">
                    <label>
                      Para autorizar escribe <b>CONSERVAR UNA</b>
                      <input value={confirmacion} onChange={(evento) => setConfirmacion(evento.target.value.toUpperCase())} autoComplete="off" />
                    </label>
                    <div>
                      <button type="button" className="is-secondary" onClick={() => { setGrupoActivo(null); setConfirmacion(""); }} disabled={guardando}>Volver</button>
                      <button type="button" onClick={() => confirmarGrupo(grupo)} disabled={guardando || confirmacion !== "CONSERVAR UNA"}>{guardando ? "Guardando…" : "Autorizar"}</button>
                    </div>
                  </div>
                ) : (
                  <button type="button" onClick={() => { setGrupoActivo(grupo.firma); setConfirmacion(""); }}>
                    Revisar decisión →
                  </button>
                )}
              </article>
            ))}
          </div>
        </details>
      )}

      {!cargando && analisis.gruposDuplicados.length === 0 && (
        <p className="backlog-hygiene__empty">No hay copias exactas que MONYS pueda proponer con seguridad.</p>
      )}

      <footer>REAL: tareas consultadas en Supabase · PENDIENTE: dato que impide decidir · Las canceladas conservan motivo, tarea principal, usuario y fecha.</footer>
    </section>
  );
}
