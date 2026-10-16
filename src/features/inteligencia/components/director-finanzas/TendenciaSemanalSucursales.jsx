import { useEffect, useMemo, useState } from "react";
import { obtenerHistorialCausasSemanales, obtenerHistorialImportacionesUtilidad } from "../../../dashboard/services/dashboardDataService";
import { obtenerEmpleadosActivosParaAsignacion } from "../../services/empleadosRHService";
import { crearTareaOperativa, obtenerCalendarioTareasOperativas, obtenerEvidenciasTarea } from "../../services/tareasOperativasService";
import {
  construirLecturaEjecutiva,
  construirMetaRecuperacion,
  construirTendenciaSemanal,
  resumirImportacionUtilidad,
  seleccionarCandidatosCampana,
} from "../../utils/tendenciaSemanalSucursales";
import { analizarCausasCambioSemanal, construirIniciativaValorDesdeCausa, construirTareaCausaSemanal } from "../../utils/causasCambioSemanal";
import "./TendenciaSemanalSucursales.css";
import "./TendenciaSemanalEjecutiva.css";

const METRICAS = {
  ventas: { etiqueta: "Ventas", valor: (semana) => semana.ventas, variacion: (semana) => semana.variacionVentas, dinero: true },
  utilidadBruta: { etiqueta: "Utilidad bruta", valor: (semana) => semana.utilidadBruta, variacion: (semana) => semana.variacionUtilidad, dinero: true },
  margen: { etiqueta: "Margen", valor: (semana) => semana.margen, variacion: (semana) => semana.variacionMargenPuntos, dinero: false, puntos: true },
};

function moneda(valor) {
  if (valor === null || valor === undefined || !Number.isFinite(Number(valor))) return "Por confirmar";
  return new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency: "MXN",
    maximumFractionDigits: 0,
  }).format(Number(valor) || 0);
}

function porcentaje(valor) {
  return Number.isFinite(Number(valor)) ? `${Number(valor).toFixed(1)}%` : "Sin dato";
}

function fechaCorta(valor) {
  const fecha = new Date(`${valor}T12:00:00Z`);
  return new Intl.DateTimeFormat("es-MX", { day: "numeric", month: "short", timeZone: "UTC" }).format(fecha);
}

function fechaHoyMexico() {
  const partes = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Mexico_City", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date());
  const valores = Object.fromEntries(partes.map(({ type, value }) => [type, value]));
  return `${valores.year}-${valores.month}-${valores.day}`;
}

function moverFechaISO(fechaISO, dias) {
  const fecha = new Date(`${fechaISO}T12:00:00Z`);
  fecha.setUTCDate(fecha.getUTCDate() + dias);
  return fecha.toISOString().slice(0, 10);
}

function fechaEtiqueta(valor) {
  if (!valor || !/^\d{4}-\d{2}-\d{2}$/.test(valor)) return "Fecha pendiente";
  return new Intl.DateTimeFormat("es-MX", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }).format(new Date(`${valor}T12:00:00Z`));
}

function RevisionCausa({ accion, organizationId, businessId, branchIdActual, onAbrirValor }) {
  const [abierta, setAbierta] = useState(false);
  const [empleados, setEmpleados] = useState([]);
  const [responsableId, setResponsableId] = useState("");
  const [fechaRevision, setFechaRevision] = useState("");
  const [criterio, setCriterio] = useState(accion.resultadoEsperado || "");
  const [cargando, setCargando] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [mensaje, setMensaje] = useState("");
  const [mostrarSeguimiento, setMostrarSeguimiento] = useState(false);
  const [historial, setHistorial] = useState([]);
  const [cargandoHistorial, setCargandoHistorial] = useState(false);
  const [errorHistorial, setErrorHistorial] = useState("");
  const [recargaHistorial, setRecargaHistorial] = useState(0);
  const iniciativaValor = construirIniciativaValorDesdeCausa({ accion, branchIdActual });

  useEffect(() => {
    if (!abierta || !accion.branchId) return undefined;
    let vigente = true;
    setCargando(true);
    obtenerEmpleadosActivosParaAsignacion(accion.branchId)
      .then((lista) => {
        if (vigente) setEmpleados((lista || []).filter((persona) => persona.active && persona.usuario_id && persona.branch_id === accion.branchId));
      })
      .catch((error) => {
        if (vigente) setMensaje(error?.message || "No fue posible consultar el equipo de esta sucursal.");
      })
      .finally(() => { if (vigente) setCargando(false); });
    return () => { vigente = false; };
  }, [abierta, accion.branchId]);

  useEffect(() => {
    if (!mostrarSeguimiento || !accion.branchId) return undefined;
    let vigente = true;
    const hoy = fechaHoyMexico();
    setCargandoHistorial(true);
    setErrorHistorial("");
    obtenerCalendarioTareasOperativas({
      branchId: accion.branchId,
      area: "administracion",
      fechaInicio: moverFechaISO(hoy, -90),
      fechaFin: moverFechaISO(hoy, 90),
    }).then(async (tareas) => {
      const titulo = `Revisión de producto · ${accion.producto}`;
      const coincidencias = (tareas || []).filter((tarea) => tarea?.titulo === titulo)
        .sort((a, b) => String(b.fecha || "").localeCompare(String(a.fecha || "")))
        .slice(0, 4);
      const conEvidencia = await Promise.all(coincidencias.map(async (tarea) => {
        try {
          const evidencias = await obtenerEvidenciasTarea(tarea.id);
          return { ...tarea, cantidadEvidencias: evidencias.length };
        } catch {
          return { ...tarea, cantidadEvidencias: null };
        }
      }));
      if (vigente) setHistorial(conEvidencia);
    }).catch((error) => {
      if (vigente) setErrorHistorial(error?.message || "No fue posible consultar el seguimiento de esta revisión.");
    }).finally(() => { if (vigente) setCargandoHistorial(false); });
    return () => { vigente = false; };
  }, [mostrarSeguimiento, accion.branchId, accion.producto, recargaHistorial]);

  async function programar(evento) {
    evento.preventDefault();
    if (guardando) return;
    setGuardando(true);
    setMensaje("");
    try {
      const persona = empleados.find((empleado) => empleado.id === responsableId);
      const tarea = construirTareaCausaSemanal({
        accion,
        responsable: persona ? { nombre: persona.nombre, usuarioId: persona.usuario_id, branchId: persona.branch_id, organizationId: persona.organization_id, businessId: persona.business_id } : null,
        fechaRevision,
        criterioExito: criterio,
        organizationId,
        businessId,
      });
      const guardada = await crearTareaOperativa(tarea);
      setMensaje(guardada?.criterio_exito !== tarea.criterioExito
        ? "Ya había una tarea para esa persona, producto y fecha. Se conservó el criterio previo sin sobrescribirlo; revisa Operación de Hoy."
        : `La revisión quedó registrada o ya estaba programada para ${fechaRevision} con este mismo criterio. Aparecerá en Operación de Hoy y solicitará evidencia.`);
      setRecargaHistorial((valor) => valor + 1);
      setAbierta(false);
    } catch (error) {
      setMensaje(error?.message || "No fue posible programar la revisión.");
    } finally {
      setGuardando(false);
    }
  }

  return (
    <div className="weekly-causes__assignment">
      {iniciativaValor && typeof onAbrirValor === "function" && <button type="button" className="weekly-causes__measure-button" onClick={() => onAbrirValor(iniciativaValor)}>Medir resultado económico en Centro de Valor →</button>}
      <button type="button" className="weekly-causes__assign-button" onClick={() => { setAbierta((valor) => !valor); setMensaje(""); }}>
        {abierta ? "Cerrar asignación" : "Asignar revisión y medir"}
      </button>
      {abierta && <form onSubmit={programar} className="weekly-causes__assignment-form">
        <label>Responsable
          <select value={responsableId} onChange={(evento) => setResponsableId(evento.target.value)} disabled={cargando || empleados.length === 0} required>
            <option value="">{cargando ? "Consultando equipo…" : empleados.length ? "Selecciona una persona" : "Sin personas activas vinculadas a MONYS"}</option>
            {empleados.map((persona) => <option key={persona.id} value={persona.id}>{persona.nombre}{persona.puesto ? ` · ${persona.puesto}` : ""}</option>)}
          </select>
        </label>
        <label>Fecha de revisión<input type="date" min={fechaHoyMexico()} value={fechaRevision} onChange={(evento) => setFechaRevision(evento.target.value)} required /></label>
        <label>Qué confirmará el resultado<textarea value={criterio} onChange={(evento) => setCriterio(evento.target.value)} maxLength={400} rows={2} required /></label>
        <button type="submit" disabled={guardando || cargando || empleados.length === 0}>{guardando ? "Programando…" : "Programar revisión con evidencia"}</button>
      </form>}
      {mensaje && <p role="status" className="weekly-causes__assignment-message">{mensaje}</p>}
      <button type="button" className="weekly-causes__history-toggle" onClick={() => setMostrarSeguimiento((valor) => !valor)}>
        {mostrarSeguimiento ? "Ocultar seguimiento" : "Ver seguimiento y evidencias"}
      </button>
      {mostrarSeguimiento && <div className="weekly-causes__history" aria-live="polite">
        {cargandoHistorial ? <p>Consultando tareas y evidencias…</p>
          : errorHistorial ? <p role="alert">{errorHistorial}</p>
            : historial.length === 0 ? <p>No hay revisiones de este producto registradas en los últimos 90 días ni programadas para los próximos 90 días.</p>
              : historial.map((tarea) => <article key={tarea.id}>
                <b>{fechaEtiqueta(tarea.fecha)} · {tarea.responsable || "Responsable pendiente"}</b>
                <span>Estado: {String(tarea.estado || "pendiente").replaceAll("_", " ")} · {tarea.cantidadEvidencias === null ? "Evidencia no consultada" : `${tarea.cantidadEvidencias} evidencia(s)`}</span>
                <small>{tarea.criterio_exito || "Criterio de éxito pendiente"}{tarea.estado === "terminada" && " · tarea terminada; impacto financiero no comprobado"}</small>
              </article>)}
        <p>La ejecución de la revisión y sus archivos no demuestran por sí solos ventas o utilidad incremental. Para medir el efecto económico, registra el resultado en Centro de Valor.</p>
      </div>}
    </div>
  );
}

export default function TendenciaSemanalSucursales({ sucursales = [], onAbrirImportador, organizationId, businessId, branchId, onAbrirValor }) {
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState("");
  const [errorCausas, setErrorCausas] = useState("");
  const [causas, setCausas] = useState(null);
  const [cargandoCausas, setCargandoCausas] = useState(true);
  const [semanas, setSemanas] = useState([]);
  const [metrica, setMetrica] = useState("ventas");
  const sucursalesClave = useMemo(() => sucursales.map((sucursal) => sucursal.id).filter(Boolean).sort().join(":"), [sucursales]);

  useEffect(() => {
    let activo = true;

    async function cargar() {
      if (!sucursalesClave) {
        setSemanas([]);
        setCausas(null);
        setCargandoCausas(false);
        setCargando(false);
        return;
      }

      try {
        setCargando(true);
        setCargandoCausas(true);
        setError("");
        const ids = sucursalesClave.split(":");
        const [paquetesResultado, causasResultado] = await Promise.allSettled([
          obtenerHistorialImportacionesUtilidad(ids, 8),
          obtenerHistorialCausasSemanales(ids, 6),
        ]);
        if (!activo) return;
        const mapa = new Map(sucursales.map((sucursal) => [sucursal.id, sucursal]));
        if (paquetesResultado.status === "rejected") setError(paquetesResultado.reason?.message || "No fue posible cargar la tendencia semanal.");
        else {
          setError("");
          setSemanas(
            paquetesResultado.value
              .map(({ importacion, detalles }) => resumirImportacionUtilidad({ importacion, detalles, sucursal: mapa.get(importacion.branch_id) }))
              .filter(Boolean),
          );
        }
        if (causasResultado.status === "rejected") setErrorCausas(causasResultado.reason?.message || "No fue posible consultar los reportes de productos.");
        else {
          setErrorCausas("");
          const nombresSucursal = Object.fromEntries(sucursales.map((sucursal) => [sucursal.id, sucursal.nombre || sucursal.name || "Sucursal"]));
          setCausas(analizarCausasCambioSemanal({ ...causasResultado.value, nombresSucursal }));
        }
      } catch (errorCarga) {
        if (activo) setError(errorCarga?.message || "No fue posible cargar la tendencia semanal.");
      } finally {
        if (activo) {
          setCargando(false);
          setCargandoCausas(false);
        }
      }
    }

    cargar();
    return () => { activo = false; };
  }, [sucursalesClave, sucursales]);

  const tendencia = useMemo(() => construirTendenciaSemanal(semanas), [semanas]);
  const lectura = useMemo(() => construirLecturaEjecutiva(tendencia), [tendencia]);
  const configuracion = METRICAS[metrica];
  const maximo = Math.max(...tendencia.semanas.map((semana) => Number(configuracion.valor(semana)) || 0), 1);
  const meta = construirMetaRecuperacion(tendencia.semanas, "General Anaya", 10);
  const sucursalAnaya = sucursales.find((sucursal) => String(sucursal.nombre || sucursal.name || "").toLowerCase().includes("general anaya"));
  const candidatos = seleccionarCandidatosCampana(sucursalAnaya?.inventario || [], 3);
  const ultimaSemanaAnaya = meta?.base || null;
  const centroMismoPeriodo = ultimaSemanaAnaya
    ? tendencia.semanas.find((semana) => semana.sucursal.toLowerCase().includes("centro") && semana.periodoInicio === ultimaSemanaAnaya.periodoInicio && semana.periodoFin === ultimaSemanaAnaya.periodoFin)
    : null;
  const brechaCentro = centroMismoPeriodo ? Math.max(0, centroMismoPeriodo.ventas - ultimaSemanaAnaya.ventas) : null;

  return (
    <section className="weekly-rescue" aria-labelledby="weekly-rescue-title">
      <header className="weekly-rescue__header">
        <div>
          <span>CRECIMIENTO POR SUCURSAL · DATOS SICAR</span>
          <h3 id="weekly-rescue-title">Pulso semanal y rescate de General Anaya</h3>
          <p>Cada nuevo corte se agrega a la historia para saber si la venta subió, bajó y qué acción produjo el cambio.</p>
        </div>
        <strong>{cargando ? "Consultando semanas…" : error ? "Semanas pendientes" : `${tendencia.periodos.length} semana${tendencia.periodos.length === 1 ? "" : "s"} registrada${tendencia.periodos.length === 1 ? "" : "s"}`}</strong>
      </header>

      <div className="weekly-rescue__tabs" aria-label="Métrica de la gráfica">
        {Object.entries(METRICAS).map(([id, opcion]) => (
          <button key={id} type="button" aria-pressed={metrica === id} onClick={() => setMetrica(id)}>{opcion.etiqueta}</button>
        ))}
      </div>

      <section className="weekly-causes" aria-labelledby="weekly-causes-title">
        <header className="weekly-causes__header">
          <div><span>ANÁLISIS FINANCIERO POR PRODUCTO · SICAR</span><h4 id="weekly-causes-title">Causas observadas del cambio semanal</h4><p>Productos que movieron venta, utilidad y unidades; revisión de inventario y siguiente decisión.</p></div>
          <strong>{cargandoCausas ? "Consultando revisiones…" : errorCausas ? "Revisiones pendientes" : !causas ? "Pendiente de SICAR" : `${causas.acciones.length} revisiones sugeridas`}</strong>
        </header>
        <p className="weekly-causes__trust"><b>Lectura observacional:</b> los reportes muestran asociación y descomposición matemática; no prueban por sí solos qué causó el resultado. Toda compra, traspaso o campaña requiere autorización de Mónica.</p>
        {cargandoCausas ? <p className="weekly-causes__empty">Consultando los reportes SICAR disponibles…</p> : errorCausas ? <p role="alert" className="weekly-causes__empty">No se pudieron consultar las ventas e inventarios por producto: {errorCausas}</p> : !causas || causas.pendientes.some((item) => item.faltan?.some((falta) => falta.includes("dos reportes"))) ? <div className="weekly-causes__empty"><p>Pendiente: faltan dos reportes SICAR “Ventas por artículo” con fechas válidas y periodos de igual duración por sucursal. La lectura semanal ejecutiva permanece disponible arriba.</p>{onAbrirImportador && <button type="button" className="weekly-rescue__import" onClick={onAbrirImportador}>Subir reporte SICAR para habilitar el análisis →</button>}</div> : (
          <>
            {causas.sucursalesMismoPeriodo.length > 0 && <p className="weekly-causes__matched">Cortes de productos comparables entre sucursales: {causas.sucursalesMismoPeriodo.map((corte) => `${corte.periodo[0]}–${corte.periodo[1]}`).join(", ")}.</p>}
            {causas.diferenciasSucursal.length > 0 && <details className="weekly-causes__pending"><summary>Diferencias Centro / General Anaya por producto ({causas.diferenciasSucursal.length})</summary>{causas.diferenciasSucursal.slice(0, 8).map((diferencia) => <p key={`${diferencia.producto}-${diferencia.periodo.join(":")}`}><b>{diferencia.producto}</b> · venta {moneda(diferencia.diferenciaVenta)} · utilidad {moneda(diferencia.diferenciaUtilidad)} · unidades {diferencia.diferenciaUnidades === null ? "pendiente" : diferencia.diferenciaUnidades} ({diferencia.sucursales.join(" − ")}). Periodo {diferencia.periodo.join("–")}.</p>)}</details>}
            <div className="weekly-causes__grid">
              {causas.acciones.length === 0 ? <article className="weekly-causes__empty">No se detectaron cambios que ameriten una acción con estos reportes comparables. Consulta los datos pendientes antes de cerrar el análisis.</article> : causas.acciones.slice(0, 12).map((accion, indice) => (
                <article key={`${accion.tipo}-${accion.sucursal}-${accion.producto}-${indice}`} className={`weekly-causes__card weekly-causes__card--${accion.tipo}`}>
                  <div className="weekly-causes__card-title"><span>{accion.estado}</span><small>{accion.sucursal}</small></div>
                  <h5>{accion.producto}</h5>
                  <p>{accion.resumen}</p>
                  <details><summary>Ver evidencia y siguiente acción</summary>
                    <p><b>Periodo:</b> {accion.evidencia.reportes?.map((reporte) => `${reporte.inicio}–${reporte.fin}`).join(" vs ") || `Inventario SICAR al ${String(accion.evidencia.fechaCorteInventario || "sin fecha").slice(0, 10)}`}</p>
                    {accion.evidencia.cambioVenta !== undefined && <p><b>Venta:</b> {moneda(accion.evidencia.cambioVenta)} · <b>Unidades:</b> {accion.evidencia.cambioUnidades === null ? "Pendientes" : accion.evidencia.cambioUnidades} · <b>Utilidad:</b> {moneda(accion.evidencia.cambioUtilidad)}</p>}
                    {accion.evidencia.cambioCostoImplicito !== undefined && accion.evidencia.cambioCostoImplicito !== null && <p><b>Costo implícito estimado (venta menos utilidad):</b> {moneda(accion.evidencia.cambioCostoImplicito)} · <b>Variación de margen:</b> {accion.evidencia.cambioMargenPuntos === null ? "Pendiente" : `${accion.evidencia.cambioMargenPuntos.toFixed(1)} puntos`}</p>}
                    {accion.evidencia.inventario !== null && accion.evidencia.inventario !== undefined && <p><b>Existencia SICAR:</b> {accion.evidencia.inventario} piezas · corte {String(accion.evidencia.fechaCorteInventario || "sin fecha").slice(0, 10)}</p>}
                    {accion.evidencia.inventarioOtraSucursal && <p><b>Otra sucursal:</b> {accion.evidencia.inventarioOtraSucursal.sucursal} registra {accion.evidencia.inventarioOtraSucursal.existencia} piezas en su foto al {String(accion.evidencia.inventarioOtraSucursal.fechaCorte || "sin fecha").slice(0, 10)}. Validar antes de considerar un traspaso.</p>}
                    <p><b>Siguiente acción:</b> {accion.accion}</p><p><b>Responsable sugerida:</b> {accion.responsable}</p><p><b>Fecha de revisión:</b> Pendiente de asignar por Dirección</p><p><b>Resultado esperado:</b> {accion.resultadoEsperado}</p>
                    <p className="weekly-causes__approval">Recomendación de MONYS · autorización de Mónica pendiente.</p>
                  </details>
                  <RevisionCausa accion={accion} organizationId={organizationId} businessId={businessId} branchIdActual={branchId} onAbrirValor={onAbrirValor} />
                </article>
              ))}
            </div>
            {causas.pendientes.length > 0 && <details className="weekly-causes__pending"><summary>Datos pendientes ({causas.pendientes.length})</summary>{causas.pendientes.map((item, indice) => <p key={`${item.sucursal}-${item.producto}-${indice}`}>{item.sucursal || "Sucursales"}{item.producto ? ` · ${item.producto}` : ""}: falta {item.faltan?.join(", ") || "confirmar el periodo comparable"}.</p>)}</details>}
            {causas.reportesSinPeriodo.length > 0 && <p className="weekly-causes__empty">{causas.reportesSinPeriodo.length} reporte(s) no tienen periodo verificable y se excluyeron de la comparación.</p>}
          </>
        )}
      </section>

      {lectura.sucursales.length > 0 && (
        <section className="weekly-rescue__executive" aria-label="Lectura ejecutiva de la última semana">
          <div className="weekly-rescue__executive-title">
            <div><span>LECTURA EJECUTIVA · ÚLTIMO CORTE</span><h4>Qué cambió y qué conviene revisar</h4></div>
            <small className={lectura.comparacionMismoCorte ? "es-listo" : "es-pendiente"}>
              {lectura.comparacionMismoCorte ? "Sucursales comparables" : "Los cortes no coinciden entre sucursales"}
            </small>
          </div>
          <div className="weekly-rescue__executive-grid">
            {lectura.sucursales.map((semana) => (
              <article key={semana.branchId} className={`es-${semana.lectura.estado}`}>
                <div><span>{semana.sucursal}</span><small>{fechaCorta(semana.periodoInicio)}–{fechaCorta(semana.periodoFin)}</small></div>
                <h5>{semana.lectura.titulo}</h5>
                <div className="weekly-rescue__executive-numbers">
                  <p><small>Ventas</small><b>{moneda(semana.ventas)}</b><em>{semana.variacionVentas === null ? "Sin comparación" : `${semana.variacionVentas >= 0 ? "▲" : "▼"} ${Math.abs(semana.variacionVentas).toFixed(1)}%`}</em></p>
                  <p><small>Utilidad</small><b>{moneda(semana.utilidadBruta)}</b><em>{semana.variacionUtilidad === null ? "Sin comparación" : `${semana.variacionUtilidad >= 0 ? "▲" : "▼"} ${Math.abs(semana.variacionUtilidad).toFixed(1)}%`}</em></p>
                  <p><small>Margen</small><b>{porcentaje(semana.margen)}</b><em>{semana.variacionMargenPuntos === null ? "Sin comparación" : `${semana.variacionMargenPuntos >= 0 ? "+" : ""}${semana.variacionMargenPuntos.toFixed(1)} pts`}</em></p>
                </div>
                <p className="weekly-rescue__executive-action"><b>Siguiente revisión:</b> {semana.lectura.accion}</p>
              </article>
            ))}
          </div>
        </section>
      )}

      {cargando ? <p className="weekly-rescue__message">Cargando semanas reales…</p> : error ? <p role="alert" className="weekly-rescue__message weekly-rescue__message--error">{error}</p> : tendencia.periodos.length === 0 ? (
        <p className="weekly-rescue__message">Sube el reporte semanal “Utilidad de ventas” de cada sucursal para iniciar la gráfica.</p>
      ) : (
        <div className="weekly-chart" role="img" aria-label={`Comparación semanal de ${configuracion.etiqueta.toLowerCase()} por sucursal`}>
          {tendencia.periodos.map((periodo) => (
            <article key={periodo.clave} className="weekly-chart__period">
              <div className="weekly-chart__date"><strong>{fechaCorta(periodo.periodoInicio)}–{fechaCorta(periodo.periodoFin)}</strong><span>{periodo.sucursales.length > 1 ? "Comparación completa" : "Falta una sucursal"}</span></div>
              <div className="weekly-chart__bars">
                {periodo.sucursales.map((semana) => {
                  const valor = configuracion.valor(semana);
                  const variacion = configuracion.variacion(semana);
                  const ancho = valor === null || valor === undefined
                    ? 0
                    : Math.max(3, Math.min(100, ((Number(valor) || 0) / maximo) * 100));
                  const esAnaya = semana.sucursal.toLowerCase().includes("general anaya");
                  return (
                    <div key={semana.id} className="weekly-chart__branch">
                      <div><span>{semana.sucursal}</span><strong>{configuracion.dinero ? moneda(valor) : porcentaje(valor)}</strong></div>
                      <div className="weekly-chart__track"><i className={esAnaya ? "is-anaya" : "is-centro"} style={{ width: `${ancho}%` }} /></div>
                      <small>{variacion === null
                        ? "Sin corte anterior comparable"
                        : configuracion.puntos
                          ? `${variacion >= 0 ? "+" : ""}${variacion.toFixed(1)} puntos vs corte anterior`
                          : `${variacion >= 0 ? "▲" : "▼"} ${Math.abs(variacion).toFixed(1)}% vs corte anterior`}</small>
                    </div>
                  );
                })}
              </div>
            </article>
          ))}
        </div>
      )}

      {meta && (
        <div className="weekly-rescue__plan">
          <article className="weekly-rescue__target">
            <span>PRIMER ESCALÓN · 4 SEMANAS</span>
            <h4>Subir General Anaya 10% sin sacrificar margen</h4>
            <div className="weekly-rescue__numbers">
              <div><small>Línea base semanal</small><strong>{moneda(meta.base.ventas)}</strong></div>
              <div><small>Meta semanal inicial</small><strong>{moneda(meta.objetivo)}</strong></div>
              <div><small>Venta adicional</small><strong>{moneda(meta.brecha)}</strong></div>
              <div><small>Incremento promedio</small><strong>{moneda(meta.incrementoDiario)} / día</strong></div>
            </div>
            {brechaCentro !== null && <p>La brecha actual contra Centro es de <b>{moneda(brechaCentro)}</b>. No conviene intentar cerrarla de golpe: primero comprobaremos cuatro incrementos semanales rentables.</p>}
          </article>

          <article className="weekly-rescue__campaign">
            <span>EXPERIMENTO COMERCIAL RECOMENDADO</span>
            <h4>Una campaña pequeña, medible y con inventario real</h4>
            <ol>
              <li>Elegir un solo producto candidato y una oferta sin bajar del margen autorizado.</li>
              <li>Promoverlo 7 días en mostrador, historias y WhatsApp; registrar el canal de cada venta.</li>
              <li>Comparar venta, utilidad y existencias contra esta línea base antes de repetir o pagar publicidad.</li>
            </ol>
          </article>
        </div>
      )}

      <div className="weekly-rescue__products">
        <div>
          <span>CANDIDATOS PARA VALIDAR · NO SON “PRODUCTOS ESTRELLA” TODAVÍA</span>
          <h4>Stock y utilidad potencial disponibles en General Anaya</h4>
          <p>Se eligen por existencia y margen del inventario actual. El reporte “Ventas por artículo” permitirá confirmar demanda y rotación.</p>
        </div>
        {candidatos.length > 0 ? (
          <div className="weekly-rescue__product-grid">
            {candidatos.map((producto, indice) => (
              <article key={`${producto.codigo}-${producto.descripcion}`}>
                <small>OPCIÓN {indice + 1}</small>
                <strong>{producto.descripcion}</strong>
                <span>{producto.existencia} piezas · {moneda(producto.precioVenta)} · margen {porcentaje(producto.margen)}</span>
              </article>
            ))}
          </div>
        ) : <p className="weekly-rescue__message">No hay suficientes productos con stock, precio y utilidad completos para sugerir una prueba.</p>}
        {onAbrirImportador && <button type="button" className="weekly-rescue__import" onClick={onAbrirImportador}>Subir “Ventas por artículo” para elegir productos con demanda real →</button>}
      </div>

      <p className="weekly-rescue__footnote">MONYS mostrará “línea base” hasta reunir una segunda semana. Después calculará automáticamente la variación semanal; una campaña no se declarará exitosa sin venta, utilidad y evidencia del canal.</p>
    </section>
  );
}
