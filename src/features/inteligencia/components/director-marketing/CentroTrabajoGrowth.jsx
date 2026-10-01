import "./CentroTrabajoGrowth.css";

function nombreCorto(nombre) {
  return String(nombre || "Equipo")
    .trim()
    .split(/\s+/)[0];
}

function fechaLocal() {
  return new Intl.DateTimeFormat("es-MX", {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone: "America/Mexico_City",
  }).format(new Date());
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

function numeroRegistrado(valor) {
  if (valor === null || valor === undefined || valor === "") {
    return null;
  }

  const numero = Number(valor);
  return Number.isFinite(numero) ? numero : null;
}

function etiquetaAntiguedad(dias) {
  if (dias === null || dias === undefined) {
    return "fecha sin confirmar";
  }

  return dias === 0 ? "hoy" : `hace ${dias} días`;
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
  onTrabajarOportunidad,
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

      const venta = numeroRegistrado(
        resultado.ventaAcumulada
      );
      const inversion = numeroRegistrado(
        resultado.gastoAcumulado
      );
      const utilidad = numeroRegistrado(
        resultado.utilidadEstimadaCampana
      );

      if (venta !== null) {
        resumen.ventas += venta;
        resumen.campanasConVentas += 1;
      }

      if (inversion !== null) {
        resumen.inversion += inversion;
        resumen.campanasConInversion += 1;
      }

      if (utilidad !== null) {
        resumen.utilidad += utilidad;
        resumen.campanasConUtilidad += 1;
      }

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
      campanasConVentas: 0,
      inversion: 0,
      campanasConInversion: 0,
      utilidad: 0,
      campanasConUtilidad: 0,
      decision: null,
    }
  );

  const actualizacionOportunidad =
    oportunidadPrioritaria?.actualizacionDatos || null;
  const oportunidadVigente =
    actualizacionOportunidad?.vigente === true;

  const valorAcumulado = (total, disponibles) => {
    if (disponibles === 0) {
      return "Sin datos";
    }

    const texto = moneda(total);
    return disponibles < campanas.length
      ? `${texto} · parcial`
      : texto;
  };

  const campanaPrioritaria = campanas.find(
    (campana) =>
      ["ACTIVA", "PREPARANDO"].includes(
        String(campana?.estado || "").toUpperCase()
      )
  );

  const productosCampanaPrioritaria = Array.isArray(
    campanaPrioritaria?.estrategia_ia?.productosSeleccionadosGrowth
  )
    ? campanaPrioritaria.estrategia_ia.productosSeleccionadosGrowth
        .map((item) => item?.nombre || item?.producto || "")
        .filter(Boolean)
    : [];

  const productoGrowthPrioritario =
    oportunidadPrioritaria && !oportunidadVigente
      ? "Pendiente de reportes actuales"
      : oportunidadPrioritaria?.nombre ||
    oportunidadPrioritaria?.producto ||
    productosCampanaPrioritaria.join(", ") ||
    campanaPrioritaria?.producto ||
    "Por confirmar con oportunidades reales";

  const canalGrowthPrioritario =
    oportunidadPrioritaria && !oportunidadVigente
      ? "Se define después de validar datos"
      : campanaPrioritaria?.canal_principal ||
    campanaPrioritaria?.estrategia_ia?.canalPrincipal ||
    (Array.isArray(campanaPrioritaria?.estrategia_ia?.canales)
      ? campanaPrioritaria.estrategia_ia.canales.join(", ")
      : "") ||
    "Por definir antes de publicar";

  const evidenciaGrowth =
    oportunidadPrioritaria && !oportunidadVigente
      ? `Ventas: ${etiquetaAntiguedad(actualizacionOportunidad?.ventas?.antiguedadDias)} · inventario: ${etiquetaAntiguedad(actualizacionOportunidad?.inventario?.antiguedadDias)}. Actualiza los reportes antes de decidir.`
      : oportunidadPrioritaria
    ? [
        `${Number(oportunidadPrioritaria.existencia || 0).toLocaleString("es-MX")} piezas en existencia`,
        `${Number(oportunidadPrioritaria.piezasVendidas || 0).toLocaleString("es-MX")} vendidas en ${Number(oportunidadPrioritaria.diasAnalizados || 7)} días`,
        oportunidadPrioritaria.margenReal == null
          ? "margen sin confirmar"
          : `margen ${Number(oportunidadPrioritaria.margenReal).toFixed(1)}%`,
        Number(oportunidadPrioritaria.diasCobertura || 0) >= 999
          ? "sin rotación calculada"
          : `${Number(oportunidadPrioritaria.diasCobertura || 0).toFixed(0)} días de cobertura`,
      ].join(" · ")
    : tareaPrioritaria?.descripcion ||
      "Aún no hay evidencia suficiente para explicar una oportunidad de producto.";

  const historialCampana = Array.isArray(
    campanaPrioritaria?.resultado?.historial
  )
    ? campanaPrioritaria.resultado.historial
    : [];

  const rutaCampana = [
    {
      etiqueta: "Datos SICAR vigentes",
      detalle: oportunidadVigente
        ? "Ventas e inventario recientes"
        : "Actualizar ventas e inventario",
      completado: oportunidadVigente,
    },
    {
      etiqueta: "Campaña preparada",
      detalle: campanaPrioritaria
        ? "Producto, objetivo y canal definidos"
        : "Falta elegir una oportunidad real",
      completado: Boolean(campanaPrioritaria),
    },
    {
      etiqueta: "Contenido preparado",
      detalle: campanaPrioritaria?.estrategia_ia
        ?.kitPublicacion
        ? "Kit disponible para revisión"
        : "Falta generar y revisar el kit",
      completado: Boolean(
        campanaPrioritaria?.estrategia_ia
          ?.kitPublicacion
      ),
    },
    {
      etiqueta: "Seguimiento iniciado",
      detalle:
        String(
          campanaPrioritaria?.estado || ""
        ).toUpperCase() === "ACTIVA"
          ? "Campaña activa dentro de MONYS"
          : "Falta iniciar la medición",
      completado:
        String(
          campanaPrioritaria?.estado || ""
        ).toUpperCase() === "ACTIVA",
    },
    {
      etiqueta: "Resultado comprobado",
      detalle: historialCampana.length
        ? `${historialCampana.length} avance${
            historialCampana.length === 1
              ? ""
              : "s"
          } registrado${
            historialCampana.length === 1
              ? ""
              : "s"
          }`
        : "Falta registrar publicación y resultados",
      completado:
        historialCampana.length > 0,
    },
  ];

  const pasosRutaCompletados =
    rutaCampana.filter(
      (paso) => paso.completado
    ).length;

  const porcentajeRutaCampana =
    Math.round(
      (pasosRutaCompletados /
        rutaCampana.length) *
        100
    );

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
      : oportunidadPrioritaria && !oportunidadVigente
      ? {
          titulo: "Actualizar SICAR antes de recomendar la primera campaña",
          descripcion:
            `La sugerencia disponible usa ventas ${etiquetaAntiguedad(actualizacionOportunidad?.ventas?.antiguedadDias)} e inventario ${etiquetaAntiguedad(actualizacionOportunidad?.inventario?.antiguedadDias)}. Primero actualiza los reportes de la sucursal; después MONYS volverá a priorizar el producto y el canal.`,
          criterio:
            "No preparar una campaña usando ventas o existencias desactualizadas.",
          etiqueta: "Datos desactualizados",
          clase: "growth-workspace__status--warning",
          boton: "Revisar oportunidades",
          ejecutar: () => onAbrirModulo?.("OPORTUNIDADES"),
        }
      : oportunidadPrioritaria
      ? {
          titulo: `Validar oportunidad: ${
            oportunidadPrioritaria.nombre ||
            oportunidadPrioritaria.codigo ||
            "producto con potencial"
          }`,
          descripcion:
            `Datos de la sucursal: ${Number(oportunidadPrioritaria.existencia || 0).toLocaleString("es-MX")} piezas en existencia y ${Number(oportunidadPrioritaria.diasCobertura || 0).toFixed(0)} días de cobertura.${oportunidadPrioritaria.fuente?.ventas ? ` Ventas recientes: ${Number(oportunidadPrioritaria.piezasVendidas || 0).toLocaleString("es-MX")} piezas.` : " No hay ventas recientes coincidentes para confirmar demanda."}${oportunidadPrioritaria.margenReal == null ? " Margen sin confirmar." : ` Margen importado: ${Number(oportunidadPrioritaria.margenReal).toFixed(1)}%.`} ${Array.isArray(oportunidadPrioritaria.razones) && oportunidadPrioritaria.razones.length ? oportunidadPrioritaria.razones.join(" · ") + "." : "Revisa la evidencia disponible."}`,
          criterio:
            "Seleccionar la oportunidad y preparar una prueba medible; no se estima venta futura sin evidencia.",
          etiqueta: "Oportunidad con datos reales",
          clase: "growth-workspace__status--ready",
          boton: "Revisar y preparar prueba",
          ejecutar: () =>
            onTrabajarOportunidad
              ? onTrabajarOportunidad(oportunidadPrioritaria)
              : onAbrirModulo?.("OPORTUNIDADES"),
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
          <span className="growth-workspace__tagline">
            Ideas que venden, resultados que crecen
          </span>
        </div>

        <div className="growth-workspace__company-panel">
          <span className="growth-workspace__date">
            {fechaLocal()}
          </span>
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

        <div className="growth-workspace__daily-context">
          <article>
            <span>Producto prioritario</span>
            <strong>{productoGrowthPrioritario}</strong>
          </article>
          <article>
            <span>Canal</span>
            <strong>{canalGrowthPrioritario}</strong>
          </article>
          <article>
            <span>Por qué</span>
            <strong>{evidenciaGrowth}</strong>
          </article>
          <article>
            <span>Valor que se medirá</span>
            <strong>Ventas confirmadas, pedidos y utilidad incremental. Sin proyección hasta registrar resultados.</strong>
          </article>
        </div>
      </div>

      <section className="growth-workspace__campaign-route">
        <div className="growth-workspace__campaign-route-heading">
          <div>
            <span>Ruta de la campaña</span>
            <strong>
              {pasosRutaCompletados} de {rutaCampana.length} pasos comprobados
            </strong>
          </div>
          <b>{porcentajeRutaCampana}%</b>
        </div>

        <div
          className="growth-workspace__campaign-progress"
          role="progressbar"
          aria-label="Preparación comprobada de la campaña"
          aria-valuemin="0"
          aria-valuemax="100"
          aria-valuenow={porcentajeRutaCampana}
        >
          <span
            style={{
              width: `${porcentajeRutaCampana}%`,
            }}
          />
        </div>

        <div className="growth-workspace__campaign-steps">
          {rutaCampana.map((paso) => (
            <article
              key={paso.etiqueta}
              className={
                paso.completado
                  ? "growth-workspace__campaign-step growth-workspace__campaign-step--done"
                  : "growth-workspace__campaign-step"
              }
            >
              <span aria-hidden="true">
                {paso.completado ? "✓" : "○"}
              </span>
              <div>
                <strong>{paso.etiqueta}</strong>
                <small>{paso.detalle}</small>
              </div>
            </article>
          ))}
        </div>

        <p>
          Este porcentaje mide pasos operativos confirmados; no estima ventas ni resultados futuros.
        </p>
      </section>

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
          <small>tareas cerradas hoy</small>
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
            <span>Campañas en curso</span>
            <strong>{resumenCampanas.activas}</strong>
          </article>
          <article>
            <span>Ventas atribuidas</span>
            <strong>{valorAcumulado(
              resumenCampanas.ventas,
              resumenCampanas.campanasConVentas
            )}</strong>
          </article>
          <article>
            <span>Inversión</span>
            <strong>{valorAcumulado(
              resumenCampanas.inversion,
              resumenCampanas.campanasConInversion
            )}</strong>
          </article>
          <article>
            <span>Utilidad estimada</span>
            <strong>{valorAcumulado(
              resumenCampanas.utilidad,
              resumenCampanas.campanasConUtilidad
            )}</strong>
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
          onClick={() => onAbrirModulo?.("CONTENIDO")}
        >
          <span className="growth-workspace__command-icon">↗</span>
          <span>
            <strong>Preparar publicación</strong>
            <small>Revisar kit · no publica en redes</small>
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

      <p className="growth-workspace__publishing-note">
        Preparar o agendar contenido aquí no lo publica en redes. Para publicar anuncios hace falta conectar la cuenta y autorizarlo.
      </p>

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
