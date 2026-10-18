import { useCallback, useEffect, useMemo, useState } from "react";
import { fechaActualMexico } from "../../inteligencia/services/asistenciaOperativaService";
import { analizarBacklogOperativo, construirColaRescateBacklog } from "../utils/higieneBacklogOperativo";
import {
  cancelarCopiasExactas,
  obtenerBacklogOperativo,
  obtenerResponsablesRescate,
  reprogramarTareaVencida,
} from "../services/higieneBacklogService";
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

function sumarDias(fechaIso, dias) {
  const fecha = new Date(`${fechaIso}T12:00:00Z`);
  fecha.setUTCDate(fecha.getUTCDate() + dias);
  return fecha.toISOString().slice(0, 10);
}

export default function HigieneBacklogOperativo({
  organizationId,
  businessId,
  sucursales = [],
  onAbrirEquipo,
}) {
  const [tareas, setTareas] = useState([]);
  const [responsables, setResponsables] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState("");
  const [mensaje, setMensaje] = useState("");
  const [grupoActivo, setGrupoActivo] = useState(null);
  const [confirmacion, setConfirmacion] = useState("");
  const [guardando, setGuardando] = useState(false);
  const [errorResponsables, setErrorResponsables] = useState("");
  const [tareaRescate, setTareaRescate] = useState(null);
  const [borradorRescate, setBorradorRescate] = useState(null);

  const cargar = useCallback(async () => {
    if (!organizationId || !businessId) {
      setError("Falta identificar la organización y el negocio.");
      setCargando(false);
      return;
    }
    setCargando(true);
    setError("");
    try {
      const [resultadoTareas, resultadoResponsables] = await Promise.allSettled([
        obtenerBacklogOperativo({ organizationId, businessId }),
        obtenerResponsablesRescate({ organizationId, businessId }),
      ]);
      if (resultadoTareas.status === "rejected") throw resultadoTareas.reason;
      setTareas(resultadoTareas.value);
      if (resultadoResponsables.status === "fulfilled") {
        setResponsables(resultadoResponsables.value);
        setErrorResponsables("");
      } else {
        setResponsables([]);
        setErrorResponsables("No fue posible comprobar qué empleadas tienen acceso. La reprogramación queda bloqueada; el resto de la bandeja continúa disponible.");
      }
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
  const colaRescate = useMemo(() => construirColaRescateBacklog(tareas, {
    hoy: fechaActualMexico(),
  }), [tareas]);

  function abrirRescate(tarea) {
    const disponibles = responsables.filter((item) =>
      item.branch_id === tarea.branch_id && item.accesoConfirmado,
    );
    const responsableActual = disponibles.find((item) =>
      item.responsable_usuario_id === tarea.responsable_usuario_id,
    ) || disponibles.find((item) => item.nombre === tarea.responsable) || null;
    setTareaRescate(tarea);
    setBorradorRescate({
      nuevaFecha: sumarDias(fechaActualMexico(), 1),
      responsableEmpleadoId: responsableActual?.id || "",
      criterioExito: tarea.criterio_exito || "",
      motivo: "",
      confirmacion: "",
    });
    setError("");
    setMensaje("");
  }

  async function guardarRescate() {
    setGuardando(true);
    setError("");
    setMensaje("");
    try {
      const actualizada = await reprogramarTareaVencida({
        organizationId,
        businessId,
        tareaId: tareaRescate.id,
        versionOriginal: tareaRescate.updated_at,
        ...borradorRescate,
      });
      setMensaje(`Tarea reprogramada para ${fechaVisible(actualizada.fecha)} y asignada a ${actualizada.responsable}. La fecha anterior quedó en el historial.`);
      setTareaRescate(null);
      setBorradorRescate(null);
      await cargar();
    } catch (fallo) {
      setError(fallo?.message || "No fue posible reprogramar la tarea.");
    } finally {
      setGuardando(false);
    }
  }

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
          <div><small>SIGUIENTE DECISIÓN</small><strong>{analisis.prioridad}</strong><span>{colaRescate.sinUsuarioVinculado} vencida{colaRescate.sinUsuarioVinculado === 1 ? "" : "s"} sin usuario vinculado.</span></div>
          <button type="button" onClick={() => {
            const panel = document.getElementById("backlog-rescue-plan");
            if (panel) {
              panel.open = true;
              panel.scrollIntoView({ behavior: "smooth", block: "start" });
            } else {
              onAbrirEquipo?.();
            }
          }}>Revisar plan de rescate ↓</button>
        </div>
      )}

      {!cargando && colaRescate.total > 0 && (
        <details id="backlog-rescue-plan" className="backlog-hygiene__rescue">
          <summary>Plan de rescate · {colaRescate.total} tarea{colaRescate.total === 1 ? "" : "s"} por decidir</summary>
          <p className="backlog-hygiene__rule">REAL: se priorizan antigüedad, prioridad registrada, falta de usuario y evidencia. MONYS no cierra ni reasigna automáticamente.</p>
          {errorResponsables && <p className="backlog-hygiene__notice is-error">{errorResponsables}</p>}
          {colaRescate.requierenRevision.length > 0 && (
            <p className="backlog-hygiene__review-lock">PENDIENTE: {colaRescate.requierenRevision.length} tarea{colaRescate.requierenRevision.length === 1 ? " ya fue iniciada" : "s ya fueron iniciadas"}; primero debe revisarse su avance.</p>
          )}
          <div className="backlog-hygiene__rescue-list">
            {colaRescate.candidatas.slice(0, 6).map((tarea) => {
              const responsablesSucursal = responsables.filter((item) =>
                item.branch_id === tarea.branch_id && item.accesoConfirmado,
              );
              const formularioAbierto = tareaRescate?.id === tarea.id && borradorRescate;
              return (
                <article key={`rescate-${tarea.id}`} data-nivel={tarea.nivel}>
                  <div className="backlog-hygiene__rescue-head">
                    <span>{tarea.nivel}</span>
                    <small>{tarea.diasVencida} día{tarea.diasVencida === 1 ? "" : "s"} vencida</small>
                  </div>
                  <h3>{tarea.titulo}</h3>
                  <p>{nombreSucursal(tarea.branch_id, sucursales)} · {tarea.responsable || "Sin responsable"}</p>
                  {tarea.faltantes.length > 0 && <small>Falta: {tarea.faltantes.join(", ")}.</small>}
                  {responsablesSucursal.length === 0 && <small>PENDIENTE: no hay una empleada activa con acceso confirmado en esta sucursal.</small>}

                  {formularioAbierto ? (
                    <div className="backlog-hygiene__rescue-form">
                      <label>Nueva fecha<input type="date" min={fechaActualMexico()} value={borradorRescate.nuevaFecha} onChange={(evento) => setBorradorRescate((actual) => ({ ...actual, nuevaFecha: evento.target.value }))} /></label>
                      <label>Responsable con acceso<select value={borradorRescate.responsableEmpleadoId} onChange={(evento) => setBorradorRescate((actual) => ({ ...actual, responsableEmpleadoId: evento.target.value }))}><option value="">Seleccionar</option>{responsablesSucursal.map((item) => <option key={item.id} value={item.id}>{item.nombre} · {item.puesto || "Sin puesto"}</option>)}</select></label>
                      <label>Resultado que comprobará el cierre<textarea rows={2} maxLength={400} value={borradorRescate.criterioExito} onChange={(evento) => setBorradorRescate((actual) => ({ ...actual, criterioExito: evento.target.value }))} /></label>
                      <label>Por qué se reprograma<textarea rows={2} maxLength={400} value={borradorRescate.motivo} onChange={(evento) => setBorradorRescate((actual) => ({ ...actual, motivo: evento.target.value }))} /></label>
                      <label>Para autorizar escribe <b>REPROGRAMAR</b><input autoComplete="off" value={borradorRescate.confirmacion} onChange={(evento) => setBorradorRescate((actual) => ({ ...actual, confirmacion: evento.target.value.toUpperCase() }))} /></label>
                      <div><button type="button" className="is-secondary" onClick={() => { setTareaRescate(null); setBorradorRescate(null); }} disabled={guardando}>Volver</button><button type="button" onClick={guardarRescate} disabled={guardando || borradorRescate.confirmacion !== "REPROGRAMAR"}>{guardando ? "Guardando…" : "Autorizar rescate"}</button></div>
                    </div>
                  ) : (
                    <button type="button" onClick={() => abrirRescate(tarea)} disabled={responsablesSucursal.length === 0}>Preparar rescate →</button>
                  )}
                </article>
              );
            })}
          </div>
          {colaRescate.candidatas.length > 6 && <p className="backlog-hygiene__limit">Se muestran las 6 prioridades mayores de {colaRescate.candidatas.length}. Al resolver una, MONYS carga la siguiente.</p>}
        </details>
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

      <footer>REAL: tareas consultadas en Supabase · PENDIENTE: dato que impide decidir · Cancelaciones y reprogramaciones conservan motivo, usuario y fecha original.</footer>
    </section>
  );
}
