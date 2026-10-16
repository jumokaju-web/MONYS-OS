import { useEffect, useMemo, useState } from "react";
import { obtenerEmpleadosActivosParaAsignacion } from "../../services/empleadosRHService";
import { crearTareaOperativa, obtenerCalendarioTareasOperativas, obtenerEvidenciasTarea } from "../../services/tareasOperativasService";
import { construirIniciativaValorCEO, construirRutaCEOFinanciera, construirTareaRevisionCEO } from "../../utils/rutaCEOFinanciera";
import "./RutaCEOFinanciera.css";

function moneda(valor) {
  if (valor === null || valor === undefined) return "Pendiente";
  return new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency: "MXN",
    maximumFractionDigits: 0,
  }).format(valor);
}

function fecha(valor) {
  if (!valor) return "Sin fecha";
  return new Intl.DateTimeFormat("es-MX", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" })
    .format(new Date(`${valor}T12:00:00Z`));
}

function fechaHoyMexico() {
  const partes = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Mexico_City",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const valores = Object.fromEntries(partes.map(({ type, value }) => [type, value]));
  return `${valores.year}-${valores.month}-${valores.day}`;
}

function moverFechaISO(fechaISOBase, dias) {
  const fechaBase = new Date(`${fechaISOBase}T12:00:00Z`);
  fechaBase.setUTCDate(fechaBase.getUTCDate() + dias);
  return fechaBase.toISOString().slice(0, 10);
}

export default function RutaCEOFinanciera({
  metricas,
  movimientos,
  movimientosPendientes,
  gastosSinClasificar,
  sucursales,
  baseVigente,
  onAbrirImportador,
  organizationId,
  businessId,
  branchId,
  onAbrirValor,
}) {
  const [empleados, setEmpleados] = useState([]);
  const [cargandoEquipo, setCargandoEquipo] = useState(true);
  const [sucursalRevisionId, setSucursalRevisionId] = useState(branchId || "");
  const [errorEquipo, setErrorEquipo] = useState("");
  const [responsableId, setResponsableId] = useState("");
  const [fechaRevision, setFechaRevision] = useState("");
  const [criterioExito, setCriterioExito] = useState("");
  const [guardandoRevision, setGuardandoRevision] = useState(false);
  const [mensajeRevision, setMensajeRevision] = useState("");
  const [historialRevision, setHistorialRevision] = useState([]);
  const [cargandoHistorial, setCargandoHistorial] = useState(false);
  const [errorHistorial, setErrorHistorial] = useState("");
  const [recargarHistorial, setRecargarHistorial] = useState(0);
  const ruta = useMemo(() => construirRutaCEOFinanciera({
    metricas,
    movimientos,
    movimientosPendientes,
    gastosSinClasificar,
    sucursales,
    baseVigente,
  }), [metricas, movimientos, movimientosPendientes, gastosSinClasificar, sucursales, baseVigente]);
  const opcionesSucursal = Array.isArray(sucursales) ? sucursales : [];
  const requiereSeleccionSucursal = !branchId && opcionesSucursal.length > 0;
  const branchAsignacionId = branchId || sucursalRevisionId;
  const formatoValor = (indicador) => {
    if (indicador.valor === null) return "Pendiente";
    return indicador.nombre === "Margen bruto" ? `${indicador.valor.toFixed(1)}%` : moneda(indicador.valor);
  };
  const sucursalActual = ruta.sucursalesResultado.find((sucursal) => sucursal.id === branchId);
  const iniciativaValor = construirIniciativaValorCEO({
    prioridad: ruta.prioridad,
    sucursal: sucursalActual,
    branchIdActual: branchId,
  });

  useEffect(() => {
    let activo = true;
    async function cargarEquipo() {
      if (!branchAsignacionId) {
        setEmpleados([]);
        setErrorEquipo(opcionesSucursal.length > 1
          ? "Selecciona una sucursal para consultar responsables y limitar la tarea."
          : "No se identifica una sucursal para limitar la asignación.");
        setCargandoEquipo(false);
        return;
      }
      setCargandoEquipo(true);
      setErrorEquipo("");
      try {
        const registros = await obtenerEmpleadosActivosParaAsignacion(branchAsignacionId);
        if (!activo) return;
        const vinculados = (registros || []).filter((empleado) => empleado?.usuario_id);
        setEmpleados(vinculados);
        setResponsableId("");
        if (vinculados.length === 0) setErrorEquipo("No hay empleados activos con una cuenta MONYS vinculada en esta sucursal.");
      } catch (error) {
        if (activo) setErrorEquipo(error?.message || "No fue posible consultar los responsables activos.");
      } finally {
        if (activo) setCargandoEquipo(false);
      }
    }
    cargarEquipo();
    return () => { activo = false; };
  }, [branchAsignacionId, opcionesSucursal.length]);

  useEffect(() => {
    let activo = true;
    async function cargarRevisiones() {
      if (!branchAsignacionId) {
        setHistorialRevision([]);
        setCargandoHistorial(false);
        setErrorHistorial("");
        return;
      }
      const hoy = fechaHoyMexico();
      setCargandoHistorial(true);
      setErrorHistorial("");
      try {
        const tareas = await obtenerCalendarioTareasOperativas({
          branchId: branchAsignacionId,
          area: "administracion",
          fechaInicio: moverFechaISO(hoy, -90),
          fechaFin: moverFechaISO(hoy, 90),
        });
        const revisiones = (tareas || [])
          .filter((tarea) => String(tarea?.titulo || "").startsWith("Revisión CEO ·"))
          .sort((a, b) => String(b.fecha || "").localeCompare(String(a.fecha || "")))
          .slice(0, 5);
        const conEvidencia = await Promise.all(revisiones.map(async (tarea) => {
          if (!tarea?.id) return { ...tarea, cantidadEvidencias: null };
          try {
            const evidencias = await obtenerEvidenciasTarea(tarea.id);
            return { ...tarea, cantidadEvidencias: evidencias.length };
          } catch {
            return { ...tarea, cantidadEvidencias: null };
          }
        }));
        if (activo) setHistorialRevision(conEvidencia);
      } catch (error) {
        if (activo) setErrorHistorial(error?.message || "No fue posible consultar las revisiones anteriores.");
      } finally {
        if (activo) setCargandoHistorial(false);
      }
    }
    cargarRevisiones();
    return () => { activo = false; };
  }, [branchAsignacionId, recargarHistorial]);

  async function programarRevision(evento) {
    evento.preventDefault();
    if (guardandoRevision) return;
    setGuardandoRevision(true);
    setMensajeRevision("");
    try {
      const persona = empleados.find((empleado) => empleado.id === responsableId);
      const tarea = construirTareaRevisionCEO({
        prioridad: ruta.prioridad,
        organizationId: organizationId || persona?.organization_id,
        businessId: businessId || persona?.business_id,
        branchId: branchAsignacionId,
        responsable: persona ? { nombre: persona.nombre, usuarioId: persona.usuario_id } : null,
        fechaRevision,
        criterioExito,
      });
      const tareaGuardada = await crearTareaOperativa(tarea);
      setRecargarHistorial((valor) => valor + 1);
      if (tareaGuardada?.criterio_exito !== tarea.criterioExito) {
        setMensajeRevision("Ya existía una revisión con la misma sucursal, persona y fecha. MONYS conservó el registro existente sin sobrescribir su criterio; verifica la tarjeta de revisión abajo.");
      } else {
        setMensajeRevision(`Revisión programada para ${persona.nombre} el ${fecha(fechaRevision)}. La tarea pedirá evidencia y no autoriza compras, pagos ni campañas.`);
      }
    } catch (error) {
      setMensajeRevision(error?.message || "No fue posible programar la revisión.");
    } finally {
      setGuardandoRevision(false);
    }
  }

  return (
    <section className="ceo-route" aria-labelledby="ceo-route-title">
      <header className="ceo-route__header">
        <div>
          <span className="ceo-route__eyebrow">SALA DE MANDO · FORMACIÓN CEO</span>
          <h3 id="ceo-route-title">Decide como directora; rescata con evidencia</h3>
          <p>Una ruta clara para proteger efectivo, recuperar rentabilidad y convertir cada revisión en ejecución medible.</p>
        </div>
        <span className="ceo-route__period">
          {ruta.periodo ? `${fecha(ruta.periodo.inicio)} – ${fecha(ruta.periodo.fin)} · ${ruta.periodo.dias} días` : "Periodo por confirmar"}
        </span>
      </header>

      <div className="ceo-route__focus">
        <div className="ceo-route__focus-label"><span>{ruta.prioridad.estado}</span><span>PRIORIDAD DE DIRECCIÓN</span></div>
        <h4>{ruta.prioridad.titulo}</h4>
        <p>{ruta.prioridad.porQue}</p>
        <div className="ceo-route__decision"><b>Acción sugerida</b><p>{ruta.prioridad.accion}</p></div>
        <div className="ceo-route__question"><b>Pregunta CEO</b><p>{ruta.prioridad.pregunta}</p></div>
        {iniciativaValor && typeof onAbrirValor === "function" && (
          <button type="button" className="ceo-route__button ceo-route__button--secondary" onClick={() => onAbrirValor(iniciativaValor)}>
            Medir esta oportunidad y aprender en Centro de Valor →
          </button>
        )}
        {ruta.prioridad.estado === "PENDIENTE" && onAbrirImportador && (
          <button type="button" className="ceo-route__button" onClick={onAbrirImportador}>Completar o actualizar reportes →</button>
        )}
        <form className="ceo-route__action-form" onSubmit={programarRevision}>
          <strong>Convertir esta prioridad en una revisión asignada</strong>
          <p>La persona documenta la fuente y el resultado. Programar la revisión no aprueba la decisión financiera.</p>
          <div className="ceo-route__form-grid">
            {requiereSeleccionSucursal && <label>Sucursal
              <select value={sucursalRevisionId} onChange={(evento) => { setSucursalRevisionId(evento.target.value); setResponsableId(""); }} required>
                <option value="">Selecciona una sucursal</option>
                {opcionesSucursal.map((sucursal) => <option key={sucursal.id || sucursal.branch_id} value={sucursal.branch_id || sucursal.id}>{sucursal.nombre || sucursal.branch_name || sucursal.name || "Sucursal"}</option>)}
              </select>
            </label>}
            <label>Responsable
              <select value={responsableId} onChange={(evento) => setResponsableId(evento.target.value)} disabled={cargandoEquipo || empleados.length === 0} required>
                <option value="">{cargandoEquipo ? "Consultando equipo…" : "Selecciona una persona"}</option>
                {empleados.map((empleado) => <option key={empleado.id} value={empleado.id}>{empleado.nombre}{empleado.puesto ? ` · ${empleado.puesto}` : ""}</option>)}
              </select>
            </label>
            <label>Fecha de revisión
              <input type="date" min={fechaHoyMexico()} value={fechaRevision} onChange={(evento) => setFechaRevision(evento.target.value)} required />
            </label>
            <label className="ceo-route__criterion">Resultado o evidencia para cerrar
              <textarea value={criterioExito} onChange={(evento) => setCriterioExito(evento.target.value)} maxLength={400} rows={2} placeholder="Ej.: reporte conciliado y diferencias explicadas con evidencia" required />
            </label>
          </div>
          {errorEquipo && <p className="ceo-route__form-message" role="status">{errorEquipo}</p>}
          {mensajeRevision && <p className="ceo-route__form-message" role="status">{mensajeRevision}</p>}
          <button className="ceo-route__button" type="submit" disabled={guardandoRevision || cargandoEquipo || !branchAsignacionId || empleados.length === 0}>
            {guardandoRevision ? "Programando revisión…" : "Programar revisión con evidencia →"}
          </button>
        </form>
        <div className="ceo-route__review-history">
          <strong>Revisiones CEO · últimos 90 días y próximas</strong>
          {cargandoHistorial ? <p>Consultando tareas y evidencia…</p>
            : errorHistorial ? <p role="status">{errorHistorial}</p>
              : historialRevision.length === 0 ? <p>Sin revisiones registradas en esta sucursal. Cuando asignes una, aparecerán aquí su fecha, responsable y evidencia.</p>
                : historialRevision.map((tarea) => (
                  <article key={tarea.id}>
                    <div><b>{tarea.titulo.replace("Revisión CEO · ", "")}</b><small>{fecha(tarea.fecha)} · {tarea.responsable || "Responsable pendiente"} · {String(tarea.estado || "pendiente").replaceAll("_", " ")}</small></div>
                    <p>{tarea.criterio_exito || "Criterio de éxito pendiente"}</p>
                    <small>{tarea.cantidadEvidencias === null ? "Evidencia no consultada" : `${tarea.cantidadEvidencias} evidencia(s) adjunta(s)`}{tarea.estado === "terminada" && " · tarea terminada; el impacto financiero aún debe comprobarse"}</small>
                  </article>
                ))}
        </div>
      </div>

      <div className="ceo-route__metrics" aria-label="Indicadores disponibles">
        {ruta.metricasClave.map((indicador) => (
          <article className="ceo-route__metric" key={indicador.nombre}>
            <span>{indicador.estado}</span>
            <strong>{formatoValor(indicador)}</strong>
            <b>{indicador.nombre}</b>
            <small>{indicador.fuente}</small>
          </article>
        ))}
      </div>

      {ruta.sucursalesResultado.length > 0 && (
        <section className="ceo-route__branches" aria-labelledby="ceo-branches-title">
          <div className="ceo-route__branches-heading">
            <div><span>RESULTADO POR SUCURSAL</span><h4 id="ceo-branches-title">Dónde se genera utilidad bruta</h4></div>
            <strong>{ruta.cortesSucursalComparables ? "REAL · cortes iguales" : ruta.sucursalesResultado.length > 1 ? "PENDIENTE · cortes distintos o sin fecha" : "Una sucursal · sin comparativo"}</strong>
          </div>
          {!ruta.cortesSucursalComparables && ruta.sucursalesResultado.length > 1 && (
            <p className="ceo-route__branch-note">Los importes se muestran con sus fechas de origen; no se ordenan ni se comparan entre sucursales hasta alinear los periodos.</p>
          )}
          <div className="ceo-route__branch-grid">
            {ruta.sucursalesResultado.map((sucursal) => (
              <article className="ceo-route__branch" key={sucursal.id}>
                <h5>{sucursal.nombre}</h5>
                <small>{sucursal.periodo ? `${fecha(sucursal.periodo.inicio)} – ${fecha(sucursal.periodo.fin)}` : "PENDIENTE · fecha del reporte"}</small>
                <div><span>VENTAS <b>{sucursal.ventas === null ? "Pendiente" : "REAL"}</b></span><strong>{moneda(sucursal.ventas)}</strong></div>
                <div><span>UTILIDAD BRUTA <b>{sucursal.utilidad === null ? "Pendiente" : "REAL"}</b></span><strong>{moneda(sucursal.utilidad)}</strong></div>
                <div><span>MARGEN BRUTO <b>{sucursal.margen === null ? "Pendiente" : "ESTIMACIÓN"}</b></span><strong>{sucursal.margen === null ? "Pendiente" : `${sucursal.margen.toFixed(1)}%`}</strong></div>
              </article>
            ))}
          </div>
        </section>
      )}

      <div className="ceo-route__lesson">
        <span>LECCIÓN APLICADA</span>
        <p>{ruta.leccion}</p>
      </div>

      <details className="ceo-route__guide">
        <summary>Cómo leer el tablero y qué falta para dirigir un corporativo</summary>
        <div className="ceo-route__guide-grid">
          <div><b>REAL</b><p>Dato recibido de una fuente y un periodo identificables.</p></div>
          <div><b>ESTIMACIÓN</b><p>Cálculo derivado; se muestra su fórmula. El margen no descuenta gastos operativos.</p></div>
          <div><b>HIPÓTESIS</b><p>Una explicación posible, como atribuir una caída a precio o disponibilidad. Requiere prueba adicional.</p></div>
          <div><b>PENDIENTE</b><p>Falta evidencia. No se reemplaza con cero ni habilita una decisión sensible.</p></div>
        </div>
        <p className="ceo-route__next-data"><b>Siguiente etapa para una lectura corporativa completa:</b> consolidar por sucursal la conciliación de bancos y caja, compromisos con importe y vencimiento, costos completos por producto, antigüedad y rotación de inventario, gasto por sucursal, ventas cobradas vs. pendientes y resultado de cada acción con responsable y fecha. Esta lista describe lo que debe reunir esta vista ejecutiva; no afirma que los datos estén ausentes de otros módulos.</p>
      </details>

      <p className="ceo-route__approval">MONYS ordena la evidencia y enseña el criterio. Mónica conserva la autorización de pagos, compras, descuentos, campañas y cambios de personal.</p>
    </section>
  );
}
