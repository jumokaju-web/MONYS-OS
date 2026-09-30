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

function moneda(valor) {
  return new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency: "MXN",
    maximumFractionDigits: 0,
  }).format(Number(valor || 0));
}

export default function CentroTrabajoGrowth({
  usuario,
  porcentaje = 0,
  pendientes = 0,
  enProceso = 0,
  terminadas = 0,
  tareasSemana = 0,
  tareaPrioritaria = null,
  campanas = [],
  onActualizar,
  onEmpezarPrioridad,
  onVerSemana,
  onAbrirModulo,
  espaciosGrowth = [],
  espacioGrowthActivo = null,
  onCambiarEspacio,
}) {
  const estado =
    estadoPrioridad(tareaPrioritaria);

  const negocio =
    espacioGrowthActivo?.negocio ||
    usuario?.negocio ||
    "MONYS";

  const sucursal =
    espacioGrowthActivo?.sucursal ||
    usuario?.sucursal ||
    "Operación";

  const claveEspacioActivo = [
    espacioGrowthActivo?.organization_id ||
      usuario?.organization_id ||
      "",
    espacioGrowthActivo?.business_id ||
      usuario?.business_id ||
      "",
    espacioGrowthActivo?.branch_id ||
      usuario?.branch_id ||
      "",
  ].join(":");

  const resumenCampanas = campanas.reduce(
    (resumen, campana) => {
      const resultado = campana?.resultado || {};
      const estado = String(
        campana?.estado || ""
      ).toUpperCase();

      if (["ACTIVA", "PREPARANDO"].includes(estado)) {
        resumen.activas += 1;
      }

      resumen.ventas += Number(
        resultado.ventaAcumulada || 0
      );
      resumen.inversion += Number(
        resultado.gastoAcumulado || 0
      );
      resumen.utilidad += Number(
        resultado.utilidadEstimadaCampana || 0
      );

      const decision = String(
        resultado.decisionActual ||
          campana?.decision_ia ||
          ""
      ).toUpperCase();

      if (
        ["PAUSAR", "ESCALAR"].includes(decision) &&
        !resumen.decision
      ) {
        resumen.decision = {
          accion: decision,
          producto:
            campana?.producto ||
            campana?.nombre ||
            "campaña activa",
        };
      }

      return resumen;
    },
    {
      activas: 0,
      ventas: 0,
      inversion: 0,
      utilidad: 0,
      decision: null,
    }
  );

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

        <div className="growth-workspace__company-panel">
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

          {espaciosGrowth.length > 1 && (
            <label className="growth-workspace__workspace-selector">
              <span>Empresa / sucursal</span>
              <select
                value={claveEspacioActivo}
                onChange={(event) =>
                  onCambiarEspacio?.(
                    event.target.value
                  )
                }
              >
                {espaciosGrowth.map((espacio) => {
                  const clave = [
                    espacio.organization_id || "",
                    espacio.business_id || "",
                    espacio.branch_id || "",
                  ].join(":");

                  return (
                    <option key={clave} value={clave}>
                      {espacio.negocio} · {espacio.sucursal}
                    </option>
                  );
                })}
              </select>
            </label>
          )}
        </div>
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

      <div className="growth-workspace__impact">
        <div className="growth-workspace__impact-heading">
          <div>
            <span>Impacto de Marketing</span>
            <strong>Resultados acumulados reales</strong>
          </div>

          <button
            type="button"
            onClick={() => onAbrirModulo?.("RESULTADOS")}
          >
            Ver detalle →
          </button>
        </div>

        <div className="growth-workspace__impact-grid">
          <article>
            <span>Campañas activas</span>
            <strong>{resumenCampanas.activas}</strong>
          </article>
          <article>
            <span>Ventas atribuidas</span>
            <strong>{moneda(resumenCampanas.ventas)}</strong>
          </article>
          <article>
            <span>Inversión</span>
            <strong>{moneda(resumenCampanas.inversion)}</strong>
          </article>
          <article>
            <span>Utilidad estimada</span>
            <strong>{moneda(resumenCampanas.utilidad)}</strong>
          </article>
        </div>

        {resumenCampanas.decision && (
          <div className="growth-workspace__decision">
            <span>Decisión pendiente</span>
            MONYS recomienda {resumenCampanas.decision.accion.toLowerCase()} {resumenCampanas.decision.producto}.
          </div>
        )}
      </div>

      <div className="growth-workspace__command-grid">
        <button
          type="button"
          onClick={() => onAbrirModulo?.("OPORTUNIDADES")}
        >
          <span className="growth-workspace__command-icon">⌁</span>
          <span>
            <strong>Ver oportunidades</strong>
            <small>Productos con potencial real</small>
          </span>
          <b aria-hidden="true">→</b>
        </button>

        <button
          type="button"
          onClick={() => onAbrirModulo?.("CONTENIDO")}
        >
          <span className="growth-workspace__command-icon">▶</span>
          <span>
            <strong>Crear contenido</strong>
            <small>Hook, guion, formato y CTA</small>
          </span>
          <b aria-hidden="true">→</b>
        </button>

        <button
          type="button"
          onClick={() => onAbrirModulo?.("CAMPANAS")}
        >
          <span className="growth-workspace__command-icon">◎</span>
          <span>
            <strong>Diseñar campaña</strong>
            <small>Prueba, presupuesto y decisión</small>
          </span>
          <b aria-hidden="true">→</b>
        </button>

        <button
          type="button"
          onClick={() => onAbrirModulo?.("RESULTADOS")}
        >
          <span className="growth-workspace__command-icon">↗</span>
          <span>
            <strong>Registrar resultados</strong>
            <small>Ventas, gasto, utilidad y aprendizaje</small>
          </span>
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
