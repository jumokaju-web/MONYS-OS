import "./CentroTrabajoGrowth.css";

function nombreCorto(nombre) {
  return String(nombre || "Equipo")
    .trim()
    .split(/\s+/)[0];
}

function estadoPrioridad(tarea) {
  const estado = String(
    tarea?.estado || ""
  ).toLowerCase();

  if (estado === "en_proceso") {
    return {
      etiqueta: "En ejecución",
      clase: "growth-workspace__status--active",
    };
  }

  return {
    etiqueta: "Lista para empezar",
    clase: "growth-workspace__status--ready",
  };
}

export default function CentroTrabajoGrowth({
  usuario,
  porcentaje = 0,
  pendientes = 0,
  enProceso = 0,
  terminadas = 0,
  tareasSemana = 0,
  tareaPrioritaria = null,
  onActualizar,
  onEmpezarPrioridad,
  onVerSemana,
  onAbrirModulo,
}) {
  const estado =
    estadoPrioridad(tareaPrioritaria);

  const negocio =
    usuario?.negocio || "MONYS";

  const sucursal =
    usuario?.sucursal || "Operación";

  return (
    <section className="growth-workspace">
      <div className="growth-workspace__glow growth-workspace__glow--one" />
      <div className="growth-workspace__glow growth-workspace__glow--two" />

      <header className="growth-workspace__header">
        <div>
          <div className="growth-workspace__eyebrow">
            MONYS GROWTH OS
          </div>

          <h1>
            Hola, {nombreCorto(
              usuario?.nombre
            )}
          </h1>

          <p>
            Directora de Crecimiento
          </p>
        </div>

        <button
          type="button"
          className="growth-workspace__company"
          onClick={onActualizar}
          title="Actualizar información real"
        >
          <span className="growth-workspace__company-icon">
            M
          </span>

          <span>
            <strong>{negocio}</strong>
            <small>{sucursal}</small>
          </span>

          <span aria-hidden="true">↻</span>
        </button>
      </header>

      <div className="growth-workspace__focus">
        <div className="growth-workspace__focus-topline">
          <span>Prioridad inteligente</span>

          {tareaPrioritaria && (
            <span
              className={`growth-workspace__status ${estado.clase}`}
            >
              {estado.etiqueta}
            </span>
          )}
        </div>

        <div className="growth-workspace__focus-grid">
          <div>
            <h2>
              {tareaPrioritaria?.titulo ||
                "MONYS está listo para priorizar tu siguiente acción"}
            </h2>

            <p>
              {tareaPrioritaria?.descripcion ||
                "Cuando exista una tarea de Marketing asignada, aquí verás qué hacer primero y por qué importa."}
            </p>

            {tareaPrioritaria?.criterio_exito && (
              <div className="growth-workspace__outcome">
                <span>Resultado esperado</span>
                {tareaPrioritaria.criterio_exito}
              </div>
            )}

            <div className="growth-workspace__actions">
              <button
                type="button"
                className="growth-workspace__primary"
                onClick={onEmpezarPrioridad}
                disabled={!tareaPrioritaria}
              >
                {String(
                  tareaPrioritaria?.estado || ""
                ).toLowerCase() ===
                "pendiente"
                  ? "Empezar tarea"
                  : "Continuar tarea"}
                <span aria-hidden="true">→</span>
              </button>

              <button
                type="button"
                className="growth-workspace__secondary"
                onClick={onVerSemana}
              >
                Ver plan semanal
              </button>
            </div>
          </div>

          <div className="growth-workspace__score">
            <div
              className="growth-workspace__ring"
              style={{
                "--growth-progress": `${Math.max(
                  0,
                  Math.min(100, porcentaje)
                ) * 3.6}deg`,
              }}
            >
              <div>
                <strong>{porcentaje}%</strong>
                <span>cumplimiento</span>
              </div>
            </div>

            <small>
              Avance de las tareas reales de hoy
            </small>
          </div>
        </div>
      </div>

      <div className="growth-workspace__metrics">
        <article>
          <span>Semana</span>
          <strong>{tareasSemana}</strong>
          <small>acciones programadas</small>
        </article>

        <article>
          <span>Pendientes</span>
          <strong>{pendientes}</strong>
          <small>requieren atención</small>
        </article>

        <article>
          <span>En proceso</span>
          <strong>{enProceso}</strong>
          <small>en ejecución</small>
        </article>

        <article>
          <span>Terminadas</span>
          <strong>{terminadas}</strong>
          <small>valor entregado hoy</small>
        </article>
      </div>

      <div className="growth-workspace__command-grid">
        <button type="button" onClick={() => onAbrirModulo?.("OPORTUNIDADES")}>
          <span className="growth-workspace__command-icon">⌁</span>
          <span><strong>Ver oportunidades</strong><small>Productos con potencial real</small></span>
          <b aria-hidden="true">→</b>
        </button>
        <button type="button" onClick={() => onAbrirModulo?.("CONTENIDO")}>
          <span className="growth-workspace__command-icon">▶</span>
          <span><strong>Crear contenido</strong><small>Hook, guion, formato y CTA</small></span>
          <b aria-hidden="true">→</b>
        </button>
        <button type="button" onClick={() => onAbrirModulo?.("CAMPANAS")}>
          <span className="growth-workspace__command-icon">◎</span>
          <span><strong>Diseñar campaña</strong><small>Prueba, presupuesto y decisión</small></span>
          <b aria-hidden="true">→</b>
        </button>
        <button type="button" onClick={() => onAbrirModulo?.("RESULTADOS")}>
          <span className="growth-workspace__command-icon">↗</span>
          <span><strong>Registrar resultados</strong><small>Ventas, gasto, utilidad y aprendizaje</small></span>
          <b aria-hidden="true">→</b>
        </button>
      </div>

      <div className="growth-workspace__principle">
        <span>✦</span>
        <p>
          Hoy no se trata de hacer más contenido.
          Se trata de ejecutar la acción con mayor
          probabilidad de producir ventas y aprendizaje.
        </p>
      </div>
    </section>
  );
}
