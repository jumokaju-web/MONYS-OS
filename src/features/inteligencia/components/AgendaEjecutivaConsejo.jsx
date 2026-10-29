import { useState } from "react";
import "./AgendaEjecutivaConsejo.css";

const AREAS = { financiero: "Finanzas y pagos", comercial: "Ventas", inventario: "Inventario", marketing: "Marketing", rh: "Equipo y operación" };

function Propuesta({ propuesta, fechaCorte, onAbrirDirector, onTomar, puedeTomar, ocupada }) {
  return <article className="agenda-ejecutiva__propuesta">
    <span className="junta-label">{AREAS[propuesta.director] || propuesta.director} · {propuesta.prioridad || "POR REVISAR"}</span>
    <h3>{propuesta.titulo}</h3><p>{propuesta.descripcion}</p>
    <p><small>Responsable propuesto: {propuesta.responsable || "Por definir"}. Tomar la revisión crea seguimiento a tu nombre; no delega automáticamente a otra persona.</small></p>
    <details><summary>Ver evidencia y condiciones</summary><p>{propuesta.fuente} · {fechaCorte || "Fecha pendiente"}</p><p>{propuesta.cruce}</p><p>Impacto económico pendiente de comprobar. La propuesta no autoriza un pago, compra ni cambio laboral.</p></details>
    <div className="agenda-ejecutiva__acciones"><button type="button" onClick={() => onAbrirDirector?.(propuesta.director)}>Ver análisis completo →</button>
      <button type="button" disabled={Boolean(ocupada) || !puedeTomar} onClick={() => onTomar?.(propuesta)}>{ocupada === propuesta.id ? "Guardando…" : "Tomar revisión a mi nombre"}</button></div>
  </article>;
}

export default function AgendaEjecutivaConsejo({ prioridades = [], fechaCorte, onAbrirDirector, onTomar, puedeTomar = false, ocupada = null }) {
  const [filtro, setFiltro] = useState("todas");
  const criticas = prioridades.filter((p) => String(p.prioridad).toUpperCase() === "CRITICA").length;
  const destacadas = prioridades.slice(0, 3);
  const grupos = Object.entries(AREAS).map(([id, nombre]) => ({ id, nombre, filas: prioridades.filter((p) => p.director === id) }));
  const extras = prioridades.filter((p) => !AREAS[p.director]);
  if (extras.length) grupos.push({ id: "otros", nombre: "Otras propuestas", filas: extras });
  const props = { fechaCorte, onAbrirDirector, onTomar, puedeTomar, ocupada };
  return <section className="agenda-ejecutiva" aria-label="Agenda ejecutiva completa">
    <h3>Tres prioridades principales · agenda completa disponible</h3>
    <p>Las tres destacadas ordenan la atención del CEO. No limitan sus decisiones ni eliminan propuestas de las demás áreas. Se muestran los motores conectados del corte y la sucursal activos.</p>
    {criticas > 3 && <p role="alert">Hay {criticas} propuestas críticas. Revisa también las que aparecen en la agenda completa.</p>}
    {!prioridades.length ? <p>No hay propuestas con estas fuentes. Esto no confirma que el negocio esté sin riesgos.</p> : <div className="agenda-ejecutiva__destacadas">{destacadas.map((p) => <Propuesta key={p.id} propuesta={p} {...props} />)}</div>}
    <h3>Agenda completa · {prioridades.length} propuestas</h3>
    <nav aria-label="Filtrar agenda por área"><button type="button" aria-pressed={filtro === "todas"} onClick={() => setFiltro("todas")}>Todas ({prioridades.length})</button>
      {grupos.map((g) => <button type="button" key={g.id} aria-pressed={filtro === g.id} onClick={() => setFiltro(g.id)}>{g.nombre} ({g.filas.length})</button>)}</nav>
    <p>La agenda incluye las tres destacadas. Los responsables y fechas confirmados se consultan en el seguimiento de tareas; estas tarjetas son propuestas.</p>
    {grupos.filter((g) => filtro === "todas" || filtro === g.id).map((g) => <details key={g.id} className="agenda-ejecutiva__grupo" open={filtro !== "todas"}>
      <summary>{g.nombre} · {g.filas.length} propuestas</summary>
      {!g.filas.length ? <p>Sin propuestas de este motor con las fuentes consultadas.</p> : g.filas.map((p) => <Propuesta key={p.id} propuesta={p} {...props} />)}
    </details>)}
  </section>;
}
