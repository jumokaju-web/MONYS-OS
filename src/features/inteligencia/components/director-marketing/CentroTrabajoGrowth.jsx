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
  oportunidadPrioritaria = null,
  cargandoOportunidades = false,
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

  const campanaPrioritaria = campanas.find(
    (campana) =>
      ["ACTIVA", "PREPARANDO"].includes(
        String(campana?.estado || "").toUpperCase()
      )
  );

  const historialCampana = Array.isArray(
    campanaPrioritaria?.resultado?.historial
  )
    ? campanaPrioritaria.resultado.historial
    : [];

  const accionSugerida = tareaPrioritaria
    ? {
        titulo: tareaPrioritaria.titulo,
        descripcion:
          tareaPrioritaria.descripcion ||
          "Completa esta acción y registra evidencia para que MONYS mida el resultado.",
        criterio: tareaPrioritaria.criterio_exito,
        etiqueta: estado.etiqueta,
        clase: estado.clase,
        boton:
          String(
            tareaPrioritaria.estado || ""
          ).toLowerCase() === "pendiente"
            ? "Empezar tarea"
            : "Continuar tarea",
        ejecutar: onEmpezarPrioridad,
      }
    : campanaPrioritaria
      ? {
          titulo: historialCampana.length
            ? `Actualizar resultados de ${
                campanaPrioritaria.producto ||
                campanaPrioritaria.nombre ||
                "la campaña activa"
              }`
            : `Registrar el primer resultado de ${
                campanaPrioritaria.producto ||
                campanaPrioritaria.nombre ||
                "la campaña activa"
              }`,
          descripcion:
            "Captura gasto, pedidos y venta real. Con esos datos MONYS calculará costo por pedido, utilidad y decidirá si conviene continuar, mejorar, escalar o detener.",
          criterio:
            "Un avance real registrado para que la campaña deje de operar sin medición.",
          etiqueta: "Acción recomendada",
          clase: "growth-workspace__status--active",
          boton: historialCampana.length
            ? "Actualizar resultados"
            : "Registrar primer resultado",
          ejecutar: () =>
            onAbrirModulo?.("RESULTADOS"),
        }
      : oportunidadPrioritaria
      ? {
          titulo: `Validar oportunidad: ${
            oportunidadPrioritaria.nombre ||
            oportunidadPrioritaria.codigo ||
            "producto con potencial"
          }`,
          descripcion:
            "MONYS detectó esta oportunidad con inventario y ventas recientes; muestra el margen cuando la importación lo contiene. Revisa la evidencia y prepara una prueba pequeña antes de invertir.",
          criterio:
            "Seleccionar la oportunidad y preparar una prueba medible; no se estima venta futura sin evidencia.",
          etiqueta: "Oportunidad con datos reales",
          clase: "growth-workspace__status--ready",
          boton: "Revisar y preparar prueba",
          ejecutar: () =>
            onAbrirModulo?.("OPORTUNIDADES"),
        }
      : {
          titulo:
            cargandoOportunidades
              ? "Analizando datos reales para priorizar"
              : "Detectar la mejor oportunidad con datos reales",
          descripcion:
            cargandoOportunidades
              ? "MONYS está cruzando inventario, ventas recientes, utilidad y cobertura de la sucursal seleccionada."
              : "Todavía no hay una oportunidad calculada para esta sucursal. Actualiza los datos de inventario y ventas o entra a Oportunidades para revisar el análisis.",
          criterio:
            "Elegir un producto con inventario, margen y potencial suficientes para una prueba pequeña.",
          etiqueta: "Siguiente paso",
          clase: "growth-workspace__status--ready",
          boton: "Ver oportunidades reales",
          ejecutar: () =>
            onAbrirModulo?.("OPORTUNIDADES"),
        };

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

          <span
            className={`growth-workspace__status ${accionSugerida.clase}`}
          >
            {accionSugerida.etiqueta}
          </span>
        </div>

        <div className="growth-workspace__focus-grid">
          <div>
            <h2>
              {accionSugerida.titulo}
            </h2>

            <p>
              {accionSugerida.descripcion}
            </p>

            {accionSugerida.criterio && (
              <div className="growth-workspace__outcome">
                <span>Resultado esperado</span>
                {accionSugerida.criterio}
              </div>
            )}

            {oportunidadPrioritaria && !tareaPrioritaria && !campanaPrioritaria && (
              <div className="growth-workspace__opportunity-signal">
                <span className="growth-workspace__opportunity-label">
                  Señal encontrada en datos internos
                </span>
                <div className="growth-workspace__opportunity-facts">
                  <span>
                    <strong>{Number(oportunidadPrioritaria.existencia || 0).toLocaleString("es-MX")}</strong>
                    piezas en inventario
                  </span>
                  <span>
                    <strong>{Number(oportunidadPrioritaria.piezasVendidas || 0).toLocaleString("es-MX")}</strong>
                    vendidas en {Number(oportunidadPrioritaria.diasAnalizados || 7)} días
                  </span>
                  <span>
                    <strong>
                      {oportunidadPrioritaria.margenReal !== null && oportunidadPrioritaria.margenReal !== undefined
                        ? `${Number(oportunidadPrioritaria.margenReal).toFixed(1)}%`
                        : "Sin dato"}
                    </strong>
                    margen
                  </span>
                  <span>
                    <strong>
                      {Number(oportunidadPrioritaria.diasCobertura || 0) >= 999
                        ? "Sin rotación"
                        : `${Number(oportunidadPrioritaria.diasCobertura || 0).toFixed(0)} días`}
                    </strong>
                    cobertura estimada
                  </span>
                </div>
                {Array.isArray(oportunidadPrioritaria.razones) && oportunidadPrioritaria.razones.length > 0 && (
                  <small>{oportunidadPrioritaria.razones.join(" · ")}</small>
                )}
                <small className="growth-workspace__opportunity-caveat">
                  La venta potencial no se inventa: se valida con una prueba y resultados reales.
                </small>
              </div>
            )}

            <div className="growth-workspace__actions">
              <button
                type="button"
                className="growth-workspace__primary"
                onClick={accionSugerida.ejecutar}
              >
                {accionSugerida.boton}
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
