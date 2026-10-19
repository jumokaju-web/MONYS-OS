import { useCallback, useEffect, useMemo, useState } from "react";
import { fechaActualMexico } from "../../inteligencia/services/asistenciaOperativaService";
import {
  analizarBacklogOperativo,
  construirColaRescateBacklog,
  construirExpedienteRescate,
} from "../utils/higieneBacklogOperativo";
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
  onAbrirRescate,
  onVolverDashboard,
  vista = "resumen",
  seccionInicial = "vencidas",
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
  const [seccionPagina, setSeccionPagina] = useState(seccionInicial);
  const [indiceRescate, setIndiceRescate] = useState(0);
  const [indiceDuplicado, setIndiceDuplicado] = useState(0);

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

  useEffect(() => {
    setSeccionPagina(seccionInicial);
  }, [seccionInicial]);

  useEffect(() => {
    setIndiceRescate((actual) => Math.min(actual, Math.max(colaRescate.candidatas.length - 1, 0)));
  }, [colaRescate.candidatas.length]);

  useEffect(() => {
    setIndiceDuplicado((actual) => Math.min(actual, Math.max(analisis.gruposDuplicados.length - 1, 0)));
  }, [analisis.gruposDuplicados.length]);

  function abrirRescate(tarea) {
    const disponibles = responsables.filter((item) =>
      item.branch_id === tarea.branch_id && item.accesoConfirmado,
    );
    const responsableActual = disponibles.find((item) =>
      item.responsable_usuario_id === tarea.responsable_usuario_id,
    ) || disponibles.find((item) => item.nombre === tarea.responsable) || null;
    const expediente = construirExpedienteRescate(tarea, {
      sucursal: nombreSucursal(tarea.branch_id, sucursales),
    });
    setTareaRescate(tarea);
    setBorradorRescate({
      nuevaFecha: sumarDias(fechaActualMexico(), 1),
      responsableEmpleadoId: responsableActual?.id || "",
      alcanceExacto: expediente.alcanceSugerido,
      pasos: expediente.pasos,
      evidencias: expediente.evidencias,
      criterioExito: expediente.criterioExitoSugerido,
      motivo: "La tarea venció y se convierte en un plan verificable antes de reasignarla.",
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

  function cambiarTarea(direccion) {
    setTareaRescate(null);
    setBorradorRescate(null);
    setIndiceRescate((actual) => Math.max(0, Math.min(actual + direccion, colaRescate.candidatas.length - 1)));
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function cambiarDuplicado(direccion) {
    setGrupoActivo(null);
    setConfirmacion("");
    setIndiceDuplicado((actual) => Math.max(0, Math.min(actual + direccion, analisis.gruposDuplicados.length - 1)));
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  if (vista === "pagina") {
    const tareaActual = colaRescate.candidatas[indiceRescate] || null;
    const grupoActual = analisis.gruposDuplicados[indiceDuplicado] || null;
    const responsablesSucursal = tareaActual
      ? responsables.filter((item) => item.branch_id === tareaActual.branch_id && item.accesoConfirmado)
      : [];
    const formularioAbierto = tareaActual && tareaRescate?.id === tareaActual.id && borradorRescate;
    const expedienteActual = tareaActual ? construirExpedienteRescate(tareaActual, {
      sucursal: nombreSucursal(tareaActual.branch_id, sucursales),
    }) : null;
    const alcancePlanCompleto = Boolean(
      formularioAbierto && String(borradorRescate.alcanceExacto || "").trim().length >= 12,
    );

    return (
      <main className="backlog-page">
        <header className="backlog-page__header">
          <button type="button" className="backlog-page__back" onClick={onVolverDashboard}>← Volver al inicio</button>
          <div><span>MONYS OS · CONTROL DE EJECUCIÓN</span><h1>Plan de rescate</h1><p>Una decisión a la vez, sin perder el tablero.</p></div>
          <button type="button" className="backlog-page__refresh" onClick={cargar} disabled={cargando}>{cargando ? "Revisando…" : "Actualizar"}</button>
        </header>

        {error && <p className="backlog-hygiene__notice is-error" role="alert">{error}</p>}
        {mensaje && <p className="backlog-hygiene__notice is-success" role="status">{mensaje}</p>}

        <nav className="backlog-page__tabs" aria-label="Secciones del plan de rescate">
          <button type="button" aria-current={seccionPagina === "vencidas" ? "page" : undefined} onClick={() => setSeccionPagina("vencidas")}>Vencidas <b>{colaRescate.total}</b></button>
          <button type="button" aria-current={seccionPagina === "copias" ? "page" : undefined} onClick={() => setSeccionPagina("copias")}>Copias exactas <b>{analisis.gruposDuplicados.length}</b></button>
        </nav>

        {seccionPagina === "vencidas" && (
          <section className="backlog-page__decision" aria-labelledby="rescate-pagina-titulo">
            <div className="backlog-page__status"><span>REAL · {colaRescate.total} tareas vencidas</span><strong>{tareaActual ? `${indiceRescate + 1} de ${colaRescate.candidatas.length}` : "Sin decisiones disponibles"}</strong></div>
            {colaRescate.requierenRevision.length > 0 && <p className="backlog-hygiene__review-lock">PENDIENTE: {colaRescate.requierenRevision.length} tarea{colaRescate.requierenRevision.length === 1 ? " ya fue iniciada" : "s ya fueron iniciadas"}; primero debe revisarse su avance.</p>}
            {errorResponsables && <p className="backlog-hygiene__notice is-error">{errorResponsables}</p>}

            {!cargando && !tareaActual && <div className="backlog-page__empty"><h2>No hay una tarea vencida que pueda reprogramarse</h2><p>Las tareas iniciadas o con resultado permanecen protegidas para revisión.</p></div>}

            {tareaActual && (
              <article className="backlog-page__card" data-nivel={tareaActual.nivel}>
                <div className="backlog-hygiene__rescue-head"><span>{tareaActual.nivel}</span><small>{tareaActual.diasVencida} día{tareaActual.diasVencida === 1 ? "" : "s"} vencida</small></div>
                <h2 id="rescate-pagina-titulo">{tareaActual.titulo}</h2>
                <p className="backlog-page__meta">{nombreSucursal(tareaActual.branch_id, sucursales)} · {tareaActual.area || "Área pendiente"} · {tareaActual.responsable || "Sin responsable"}</p>
                {tareaActual.faltantes.length > 0 && <p className="backlog-page__missing">Falta: {tareaActual.faltantes.join(", ")}.</p>}
                {responsablesSucursal.length === 0 && <div className="backlog-page__blocked"><p>PENDIENTE: no hay una empleada activa con acceso confirmado en esta sucursal. La tarea no puede reasignarse todavía.</p>{onAbrirEquipo && <button type="button" onClick={onAbrirEquipo}>Configurar responsable de {nombreSucursal(tareaActual.branch_id, sucursales)} →</button>}</div>}

                {formularioAbierto ? (
                  <div className="backlog-hygiene__rescue-form">
                    <details className="backlog-plan__truth">
                      <summary>REAL · INFORMACIÓN REGISTRADA <small>Ver fuente</small></summary>
                      <ul>{expedienteActual.hechos.map((hecho) => <li key={hecho}>{hecho}</li>)}</ul>
                    </details>
                    <section className="backlog-plan__proposal">
                      <span>PLAN PROPUESTO · REQUIERE TU AUTORIZACIÓN</span>
                      <p>{expedienteActual.advertencia}</p>
                    </section>
                    <label className="backlog-plan__scope">Alcance exacto que atenderá la empleada
                      <textarea rows={3} maxLength={700} value={borradorRescate.alcanceExacto} onChange={(evento) => setBorradorRescate((actual) => ({ ...actual, alcanceExacto: evento.target.value }))} placeholder="Ejemplo: productos ABC y XYZ, códigos 123 y 456; comparar cierre del 18 de octubre contra SICAR." />
                      {!alcancePlanCompleto && <small>PENDIENTE: {expedienteActual.faltantesPlan.join(", ") || "especifica el producto, código, folio, documento o situación exacta"}. Este texto debe completarse antes de autorizar.</small>}
                    </label>
                    <details className="backlog-plan__steps" open>
                      <summary>QUÉ HARÁ · PASO A PASO <small>{borradorRescate.pasos.length} pasos</small></summary>
                      <ol>{borradorRescate.pasos.map((paso) => <li key={paso}>{paso}</li>)}</ol>
                    </details>
                    <details className="backlog-plan__evidence">
                      <summary>EVIDENCIA PARA CERRAR <small>{borradorRescate.evidencias.length} requisitos</small></summary>
                      <ul>{borradorRescate.evidencias.map((evidencia) => <li key={evidencia}>{evidencia}</li>)}</ul>
                    </details>
                    <label>Nueva fecha<input type="date" min={fechaActualMexico()} value={borradorRescate.nuevaFecha} onChange={(evento) => setBorradorRescate((actual) => ({ ...actual, nuevaFecha: evento.target.value }))} /></label>
                    <label>Responsable con acceso<select value={borradorRescate.responsableEmpleadoId} onChange={(evento) => setBorradorRescate((actual) => ({ ...actual, responsableEmpleadoId: evento.target.value }))}><option value="">Seleccionar</option>{responsablesSucursal.map((item) => <option key={item.id} value={item.id}>{item.nombre} · {item.puesto || "Sin puesto"}</option>)}</select></label>
                    <label className="backlog-plan__wide">Resultado que comprobará el cierre<textarea rows={2} maxLength={400} value={borradorRescate.criterioExito} onChange={(evento) => setBorradorRescate((actual) => ({ ...actual, criterioExito: evento.target.value }))} /></label>
                    <label className="backlog-plan__wide">Por qué se reprograma<textarea rows={2} maxLength={400} value={borradorRescate.motivo} onChange={(evento) => setBorradorRescate((actual) => ({ ...actual, motivo: evento.target.value }))} /></label>
                    <label className="backlog-plan__wide">Para autorizar escribe <b>REPROGRAMAR</b><input autoComplete="off" value={borradorRescate.confirmacion} onChange={(evento) => setBorradorRescate((actual) => ({ ...actual, confirmacion: evento.target.value.toUpperCase() }))} /></label>
                    {responsablesSucursal.length === 0 && <div className="backlog-plan__authorization-lock"><p>Puedes revisar y completar el plan, pero no enviarlo hasta vincular una empleada activa de esta sucursal.</p>{onAbrirEquipo && <button type="button" onClick={onAbrirEquipo}>Configurar responsable →</button>}</div>}
                    <div><button type="button" className="is-secondary" onClick={() => { setTareaRescate(null); setBorradorRescate(null); }} disabled={guardando}>Cancelar</button><button type="button" onClick={guardarRescate} disabled={guardando || borradorRescate.confirmacion !== "REPROGRAMAR" || responsablesSucursal.length === 0 || !alcancePlanCompleto}>{guardando ? "Guardando…" : "Autorizar y enviar"}</button></div>
                  </div>
                ) : (
                  <button type="button" className="backlog-page__primary" onClick={() => abrirRescate(tareaActual)}>Convertir en plan exacto →</button>
                )}
              </article>
            )}

            {colaRescate.candidatas.length > 1 && !formularioAbierto && <div className="backlog-page__pager"><button type="button" onClick={() => cambiarTarea(-1)} disabled={indiceRescate === 0}>← Anterior</button><span>{indiceRescate + 1} / {colaRescate.candidatas.length}</span><button type="button" onClick={() => cambiarTarea(1)} disabled={indiceRescate >= colaRescate.candidatas.length - 1}>Siguiente →</button></div>}
          </section>
        )}

        {seccionPagina === "copias" && (
          <section className="backlog-page__decision" aria-labelledby="copias-pagina-titulo">
            <div className="backlog-page__status"><span>EVIDENCIA · coincidencia exacta</span><strong>{grupoActual ? `${indiceDuplicado + 1} de ${analisis.gruposDuplicados.length}` : "Sin copias"}</strong></div>
            {!cargando && !grupoActual && <div className="backlog-page__empty"><h2>No hay copias exactas por decidir</h2><p>MONYS no mezcla tareas de otra fecha, sucursal o responsable.</p></div>}
            {grupoActual && <article className="backlog-page__card">
              <small>{nombreSucursal(grupoActual.principal.branch_id, sucursales)} · {fechaVisible(grupoActual.principal.fecha)}</small>
              <h2 id="copias-pagina-titulo">{grupoActual.principal.titulo}</h2>
              <p>Se conservará la primera tarea y se cancelará{grupoActual.duplicadas.length === 1 ? "" : "n"} {grupoActual.duplicadas.length} copia{grupoActual.duplicadas.length === 1 ? "" : "s"} idéntica{grupoActual.duplicadas.length === 1 ? "" : "s"}. El historial no se borra.</p>
              {grupoActivo === grupoActual.firma ? <div className="backlog-hygiene__confirm"><label>Para autorizar escribe <b>CONSERVAR UNA</b><input value={confirmacion} onChange={(evento) => setConfirmacion(evento.target.value.toUpperCase())} autoComplete="off" /></label><div><button type="button" className="is-secondary" onClick={() => { setGrupoActivo(null); setConfirmacion(""); }} disabled={guardando}>Cancelar</button><button type="button" onClick={() => confirmarGrupo(grupoActual)} disabled={guardando || confirmacion !== "CONSERVAR UNA"}>{guardando ? "Guardando…" : "Autorizar"}</button></div></div> : <button type="button" className="backlog-page__primary" onClick={() => { setGrupoActivo(grupoActual.firma); setConfirmacion(""); }}>Revisar decisión →</button>}
            </article>}
            {analisis.gruposDuplicados.length > 1 && <div className="backlog-page__pager"><button type="button" onClick={() => cambiarDuplicado(-1)} disabled={indiceDuplicado === 0}>← Anterior</button><span>{indiceDuplicado + 1} / {analisis.gruposDuplicados.length}</span><button type="button" onClick={() => cambiarDuplicado(1)} disabled={indiceDuplicado >= analisis.gruposDuplicados.length - 1}>Siguiente →</button></div>}
          </section>
        )}

        <button type="button" className="backlog-page__bottom-back" onClick={onVolverDashboard}>← Volver al inicio</button>
      </main>
    );
  }

  return (
    <section className="backlog-hygiene" aria-labelledby="backlog-hygiene-title">
      <header>
        <div>
          <span>TRABAJO ATRASADO · REVISIÓN EJECUTIVA</span>
          <h2 id="backlog-hygiene-title">Control del trabajo pendiente</h2>
          <p>Aquí solo ves el resumen. Las decisiones se trabajan en una pantalla independiente y nada cambia sin tu autorización.</p>
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
          <button type="button" onClick={() => { if (onAbrirRescate) onAbrirRescate("vencidas"); else onAbrirEquipo?.(); }}>Abrir plan de rescate →</button>
        </div>
      )}

      {!cargando && analisis.gruposDuplicados.length > 0 && (
        <button type="button" className="backlog-hygiene__copies-link" onClick={() => { if (onAbrirRescate) onAbrirRescate("copias"); else onAbrirEquipo?.(); }}>Revisar {analisis.gruposDuplicados.length} grupo{analisis.gruposDuplicados.length === 1 ? "" : "s"} de copias exactas en otra pantalla →</button>
      )}

      {!cargando && analisis.gruposDuplicados.length === 0 && (
        <p className="backlog-hygiene__empty">No hay copias exactas que MONYS pueda proponer con seguridad.</p>
      )}

      <footer>REAL: tareas consultadas en Supabase · PENDIENTE: dato que impide decidir · Cancelaciones y reprogramaciones conservan motivo, usuario y fecha original.</footer>
    </section>
  );
}
