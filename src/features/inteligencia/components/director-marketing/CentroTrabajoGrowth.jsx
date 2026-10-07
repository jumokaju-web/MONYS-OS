import "./CentroTrabajoGrowth.css";
import { resumirResultadosCampanas } from "../../shared/resumenResultadosGrowth";

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
  const estado = String(tarea?.estado || "").toLowerCase();

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

function fechaDato(fecha) {
  if (!fecha) {
    return "Fecha sin confirmar";
  }

  const valor = new Date(fecha);

  if (Number.isNaN(valor.getTime())) {
    return "Fecha sin confirmar";
  }

  return new Intl.DateTimeFormat("es-MX", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "America/Mexico_City",
  }).format(valor);
}

function proximasFechasHabiles(cantidad = 5) {
  const partes = new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    timeZone: "America/Mexico_City",
  }).formatToParts(new Date());
  const valorParte = (tipo) =>
    Number(partes.find((parte) => parte.type === tipo)?.value || 0);
  const fecha = new Date(
    valorParte("year"),
    valorParte("month") - 1,
    valorParte("day"),
    12,
  );
  const fechas = [];

  while (fechas.length < cantidad) {
    fecha.setDate(fecha.getDate() + 1);

    if (![0, 6].includes(fecha.getDay())) {
      fechas.push(
        `${fecha.getFullYear()}-${String(fecha.getMonth() + 1).padStart(
          2,
          "0",
        )}-${String(fecha.getDate()).padStart(2, "0")}`,
      );
    }
  }

  return fechas;
}

export default function CentroTrabajoGrowth({
  usuario,
  porcentaje = 0,
  pendientes = 0,
  enProceso = 0,
  terminadas = 0,
  tareasSemana = 0,
  agendaSemana = [],
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
  const estado = estadoPrioridad(tareaPrioritaria);

  const negocio = espacioGrowthActivo?.negocio || usuario?.negocio || "MONYS";

  const sucursal =
    espacioGrowthActivo?.sucursal || usuario?.sucursal || "Operación";

  const claveEspacioActivo = [
    espacioGrowthActivo?.organization_id || usuario?.organization_id || "",
    espacioGrowthActivo?.business_id || usuario?.business_id || "",
    espacioGrowthActivo?.branch_id || usuario?.branch_id || "",
  ].join(":");

  const resumenCampanas = resumirResultadosCampanas(campanas);

  const actualizacionOportunidad =
    oportunidadPrioritaria?.actualizacionDatos || null;

  const resumenEmbudo = campanas.reduce(
    (resumen, campana) => {
      const resultado = campana?.resultado || {};
      const historial = Array.isArray(resultado.historial)
        ? resultado.historial
        : [];
      const confirmado = (campo) =>
        resultado?.camposConfirmados?.[campo] === true ||
        historial.some(
          (registro) =>
            registro?.camposConfirmados?.[campo] === true ||
            Number(registro?.[campo]) > 0,
        );
      const campos = [
        ["alcance", "alcanceAcumulado"],
        ["mensajes", "mensajesAcumulados"],
        ["pedidos", "pedidosAcumulados"],
        ["venta", "ventaAcumulada"],
      ];

      campos.forEach(([campo, acumulado]) => {
        if (!confirmado(campo)) {
          return;
        }

        resumen[campo] += Math.max(0, Number(resultado?.[acumulado]) || 0);
        resumen.confirmados[campo] += 1;
      });

      return resumen;
    },
    {
      alcance: 0,
      mensajes: 0,
      pedidos: 0,
      venta: 0,
      confirmados: {
        alcance: 0,
        mensajes: 0,
        pedidos: 0,
        venta: 0,
      },
    },
  );

  const etapasEmbudo = [
    {
      clave: "alcance",
      etiqueta: "Alcance",
      icono: "👀",
      valor: resumenEmbudo.alcance.toLocaleString("es-MX"),
      conversion: null,
    },
    {
      clave: "mensajes",
      etiqueta: "Mensajes",
      icono: "💬",
      valor: resumenEmbudo.mensajes.toLocaleString("es-MX"),
      conversion:
        resumenEmbudo.confirmados.alcance > 0 && resumenEmbudo.alcance > 0
          ? `${((resumenEmbudo.mensajes / resumenEmbudo.alcance) * 100).toFixed(1)}% del alcance`
          : null,
    },
    {
      clave: "pedidos",
      etiqueta: "Pedidos",
      icono: "🛍️",
      valor: resumenEmbudo.pedidos.toLocaleString("es-MX"),
      conversion:
        resumenEmbudo.confirmados.mensajes > 0 && resumenEmbudo.mensajes > 0
          ? `${((resumenEmbudo.pedidos / resumenEmbudo.mensajes) * 100).toFixed(1)}% de mensajes`
          : null,
    },
    {
      clave: "venta",
      etiqueta: "Venta confirmada",
      icono: "💵",
      valor: moneda(resumenEmbudo.venta),
      conversion:
        resumenEmbudo.confirmados.pedidos > 0 && resumenEmbudo.pedidos > 0
          ? `${moneda(resumenEmbudo.venta / resumenEmbudo.pedidos)} por pedido`
          : null,
    },
  ];

  const etapasEmbudoConfirmadas = Object.values(
    resumenEmbudo.confirmados,
  ).filter((cantidad) => cantidad > 0).length;
  const textoDecision = {
    PAUSAR: "pausar nueva inversión en",
    REPROGRAMAR_PUBLICACION: "reprogramar la publicación de",
    SOLICITAR_AUTORIZACION_PARA_ESCALAR:
      "solicitar autorización de Mónica antes de escalar",
  }[resumenCampanas.decision?.accion];
  const oportunidadVigente = actualizacionOportunidad?.vigente === true;

  const fuentesCampana = [
    {
      clave: "ventas",
      titulo: "Ventas por artículo",
      descripcion: "Demanda real y productos vendidos",
      dato: actualizacionOportunidad?.ventas,
    },
    {
      clave: "inventario",
      titulo: "Inventario por sucursal",
      descripcion: "Existencia y disponibilidad para vender",
      dato: actualizacionOportunidad?.inventario,
    },
  ];

  const datosFaltantes = fuentesCampana.filter(
    (fuente) => fuente.dato?.vigente !== true,
  );

  const limiteVigencia = Number(actualizacionOportunidad?.diasMaximos || 7);

  const valorAcumulado = (total, disponibles) => {
    if (disponibles === 0) {
      return "Sin datos";
    }

    const texto = moneda(total);
    return disponibles < campanas.length ? `${texto} · parcial` : texto;
  };

  const campanaPrioritaria = campanas.find((campana) =>
    ["ACTIVA", "PREPARANDO"].includes(
      String(campana?.estado || "").toUpperCase(),
    ),
  );

  const productosCampanaPrioritaria = Array.isArray(
    campanaPrioritaria?.estrategia_ia?.productosSeleccionadosGrowth,
  )
    ? campanaPrioritaria.estrategia_ia.productosSeleccionadosGrowth
        .map((item) => item?.nombre || item?.producto || "")
        .filter(Boolean)
    : [];

  const productoGrowthPrioritario = campanaPrioritaria
    ? productosCampanaPrioritaria.join(", ") ||
      campanaPrioritaria?.producto ||
      campanaPrioritaria?.nombre ||
      "Campaña activa"
    : oportunidadPrioritaria && !oportunidadVigente
      ? "Pendiente de reportes actuales"
      : oportunidadPrioritaria?.nombre ||
        oportunidadPrioritaria?.producto ||
        productosCampanaPrioritaria.join(", ") ||
        campanaPrioritaria?.producto ||
        "Por confirmar con oportunidades reales";

  const canalGrowthPrioritario = campanaPrioritaria
    ? campanaPrioritaria?.canal_principal ||
      campanaPrioritaria?.estrategia_ia?.canalPrincipal ||
      (Array.isArray(campanaPrioritaria?.estrategia_ia?.canales)
        ? campanaPrioritaria.estrategia_ia.canales.join(", ")
        : "") ||
      "Por confirmar antes de publicar"
    : oportunidadPrioritaria && !oportunidadVigente
      ? "Se define después de validar datos"
      : campanaPrioritaria?.canal_principal ||
        campanaPrioritaria?.estrategia_ia?.canalPrincipal ||
        (Array.isArray(campanaPrioritaria?.estrategia_ia?.canales)
          ? campanaPrioritaria.estrategia_ia.canales.join(", ")
          : "") ||
        "Por definir antes de publicar";

  const controlFinancieroCampana =
    campanaPrioritaria?.estrategia_ia?.controlFinanciero || {};
  const presupuestoPropuestoCampana = Number(
    controlFinancieroCampana.presupuestoPropuesto || 0,
  );
  const presupuestoAutorizadoCampana = Number(
    campanaPrioritaria?.presupuesto || 0,
  );
  const presupuestoConAutorizacion =
    presupuestoAutorizadoCampana > 0 &&
    (controlFinancieroCampana.estadoAutorizacion === "AUTORIZADO_POR_MONICA" ||
      Number(
        campanaPrioritaria?.resultado?.autorizacionDueno?.presupuestoNuevo || 0,
      ) >= presupuestoAutorizadoCampana);
  const contenidoCampanaListo = Boolean(
    campanaPrioritaria?.estrategia_ia?.kitPublicacion,
  );

  const historialCampana = Array.isArray(
    campanaPrioritaria?.resultado?.historial,
  )
    ? campanaPrioritaria.resultado.historial
    : [];
  const publicacionCampanaConfirmada = historialCampana.some(
    (registro) => registro?.publicacion === "PUBLICADA",
  );
  const ultimaPublicacionCampana = historialCampana.at(-1)?.publicacion || "";

  const evidenciaGrowth = campanaPrioritaria
    ? publicacionCampanaConfirmada
      ? "La publicación ya fue confirmada. Falta registrar alcance, mensajes, pedidos, venta y gasto observados para medir el resultado real."
      : "Existe una campaña preparada dentro de MONYS, pero todavía falta confirmar si realmente se publicó antes de medir resultados."
    : oportunidadPrioritaria && !oportunidadVigente
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
      detalle: campanaPrioritaria?.estrategia_ia?.kitPublicacion
        ? "Kit disponible para revisión"
        : "Falta generar y revisar el kit",
      completado: Boolean(campanaPrioritaria?.estrategia_ia?.kitPublicacion),
    },
    {
      etiqueta: "Publicación confirmada",
      detalle: publicacionCampanaConfirmada
        ? "Kary confirmó que el contenido salió"
        : ultimaPublicacionCampana === "NO_PUBLICADA"
          ? "Kary confirmó que aún no se publicó"
          : "Seguimiento listo; falta confirmar publicación",
      completado: publicacionCampanaConfirmada,
    },
    {
      etiqueta: "Resultado comprobado",
      detalle: historialCampana.length
        ? `${historialCampana.length} avance${
            historialCampana.length === 1 ? "" : "s"
          } registrado${historialCampana.length === 1 ? "" : "s"}`
        : "Falta registrar publicación y resultados",
      completado: historialCampana.length > 0,
    },
  ];

  const pasosRutaCompletados = rutaCampana.filter(
    (paso) => paso.completado,
  ).length;

  const turnosAgencia = [
    {
      icono: "🔎",
      agente: "Analista IA",
      entrega: "Datos y oportunidad",
      paso: rutaCampana[0],
    },
    {
      icono: "🧭",
      agente: "Estratega IA",
      entrega: "Campaña y prueba",
      paso: rutaCampana[1],
    },
    {
      icono: "🎬",
      agente: "Creativo IA",
      entrega: "Contenido y CTA",
      paso: rutaCampana[2],
    },
    {
      icono: "📣",
      agente: "Campañas IA",
      entrega: "Publicación y medición",
      paso: rutaCampana[3],
    },
    {
      icono: "📈",
      agente: "Rentabilidad IA",
      entrega: "Venta, utilidad y decisión",
      paso: rutaCampana[4],
    },
  ];
  const turnoAgenciaActivo = Math.max(
    0,
    turnosAgencia.findIndex((turno) => !turno.paso.completado),
  );

  const porcentajeRutaCampana = Math.round(
    (pasosRutaCompletados / rutaCampana.length) * 100,
  );

  const agendaVisible = (Array.isArray(agendaSemana) ? [...agendaSemana] : [])
    .sort((tareaA, tareaB) =>
      `${tareaA?.fecha || ""} ${tareaA?.hora_limite || "99:99"}`.localeCompare(
        `${tareaB?.fecha || ""} ${tareaB?.hora_limite || "99:99"}`,
      ),
    )
    .slice(0, 5);

  const fechasAgendaPropuesta = proximasFechasHabiles(5);

  const agendaPropuesta = [
    {
      id: "propuesta-enfoque",
      fecha: fechasAgendaPropuesta[0],
      hora: "10:30",
      titulo: `Confirmar producto, existencia y meta de ${
        campanaPrioritaria?.producto ||
        campanaPrioritaria?.nombre ||
        productoGrowthPrioritario
      }`,
    },
    {
      id: "propuesta-contenido",
      fecha: fechasAgendaPropuesta[1],
      hora: "12:00",
      titulo: `Crear y revisar contenido para ${
        campanaPrioritaria?.producto ||
        campanaPrioritaria?.nombre ||
        productoGrowthPrioritario
      }`,
    },
    {
      id: "propuesta-publicacion",
      fecha: fechasAgendaPropuesta[2],
      hora: "18:00",
      titulo: publicacionCampanaConfirmada
        ? `Atender prospectos en ${canalGrowthPrioritario}`
        : `Publicar manualmente y atender prospectos en ${canalGrowthPrioritario}: ${
            campanaPrioritaria?.producto ||
            campanaPrioritaria?.nombre ||
            productoGrowthPrioritario
          }`,
    },
    {
      id: "propuesta-primer-corte",
      fecha: fechasAgendaPropuesta[3],
      hora: "11:00",
      titulo: "Registrar alcance, mensajes, pedidos, venta y gasto real",
    },
    {
      id: "propuesta-decision",
      fecha: fechasAgendaPropuesta[4],
      hora: "17:30",
      titulo: "Revisar utilidad y decidir: continuar, mejorar o detener",
    },
  ];

  const etiquetaFechaAgenda = (fecha) => {
    if (!fecha) {
      return "Fecha pendiente";
    }

    const valor = new Date(`${fecha}T12:00:00`);

    if (Number.isNaN(valor.getTime())) {
      return fecha;
    }

    return new Intl.DateTimeFormat("es-MX", {
      weekday: "short",
      day: "numeric",
      month: "short",
      timeZone: "America/Mexico_City",
    }).format(valor);
  };

  const accionSugerida = campanaPrioritaria
    ? {
        titulo: !publicacionCampanaConfirmada
          ? `Confirmar publicación de ${
              campanaPrioritaria.producto ||
              campanaPrioritaria.nombre ||
              "la campaña preparada"
            }`
          : historialCampana.length
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
        descripcion: !publicacionCampanaConfirmada
          ? "Indica si el contenido realmente se publicó. Después registra únicamente alcance, mensajes, pedidos, venta y gasto observados; MONYS no inventará resultados."
          : "Captura gasto, pedidos y venta real. Con esos datos MONYS calculará costo por pedido, utilidad y decidirá si conviene continuar, mejorar, escalar o detener.",
        criterio: !publicacionCampanaConfirmada
          ? "Separar claramente una campaña preparada dentro de MONYS de una publicación realmente confirmada por Kary."
          : "Un avance real registrado para que la campaña deje de operar sin medición.",
        etiqueta: !publicacionCampanaConfirmada
          ? "Confirmación necesaria"
          : "Acción recomendada",
        clase: !publicacionCampanaConfirmada
          ? "growth-workspace__status--warning"
          : "growth-workspace__status--active",
        boton: !publicacionCampanaConfirmada
          ? "Confirmar publicación"
          : historialCampana.length
            ? "Actualizar resultados"
            : "Registrar primer resultado",
        ejecutar: () => onAbrirModulo?.("RESULTADOS"),
      }
    : oportunidadPrioritaria && !oportunidadVigente
      ? {
          titulo: "Actualizar SICAR antes de recomendar la primera campaña",
          descripcion: `La sugerencia disponible usa ventas ${etiquetaAntiguedad(actualizacionOportunidad?.ventas?.antiguedadDias)} e inventario ${etiquetaAntiguedad(actualizacionOportunidad?.inventario?.antiguedadDias)}. Actualiza los reportes de la sucursal para que MONYS vuelva a priorizar. Mientras tanto puedes preparar un borrador; no publiques ni afirmes precio o existencia hasta confirmarlos.`,
          criterio:
            "El borrador queda para revisión; no se usa como oferta hasta confirmar precio e inventario.",
          etiqueta: "Datos desactualizados",
          clase: "growth-workspace__status--warning",
          boton: "Comprobar nuevamente los datos",
          ejecutar: onActualizar,
          botonSecundario: "Preparar borrador de contenido",
          ejecutarSecundaria: () => onAbrirModulo?.("CONTENIDO"),
        }
      : tareaPrioritaria
        ? {
            titulo: tareaPrioritaria.titulo,
            descripcion:
              tareaPrioritaria.descripcion ||
              "Completa esta acción y registra evidencia para que MONYS mida el resultado.",
            criterio: tareaPrioritaria.criterio_exito,
            etiqueta: estado.etiqueta,
            clase: estado.clase,
            boton:
              String(tareaPrioritaria.estado || "").toLowerCase() ===
              "pendiente"
                ? "Empezar tarea"
                : "Continuar tarea",
            ejecutar: onEmpezarPrioridad,
          }
        : oportunidadPrioritaria
          ? {
              titulo: `${oportunidadPrioritaria.requierePruebaOrganica ? "Probar demanda sin gasto" : "Validar oportunidad"}: ${
                oportunidadPrioritaria.nombre ||
                oportunidadPrioritaria.codigo ||
                "producto con potencial"
              }`,
              descripcion: `Datos de la sucursal: ${Number(oportunidadPrioritaria.existencia || 0).toLocaleString("es-MX")} piezas en existencia y ${Number(oportunidadPrioritaria.diasCobertura || 0).toFixed(0)} días de cobertura.${oportunidadPrioritaria.fuente?.ventas ? ` Ventas recientes: ${Number(oportunidadPrioritaria.piezasVendidas || 0).toLocaleString("es-MX")} piezas.` : " No hay ventas recientes coincidentes para confirmar demanda."}${oportunidadPrioritaria.margenReal == null ? " Margen sin confirmar." : ` Margen importado: ${Number(oportunidadPrioritaria.margenReal).toFixed(1)}%.`} ${Array.isArray(oportunidadPrioritaria.razones) && oportunidadPrioritaria.razones.length ? oportunidadPrioritaria.razones.join(" · ") + "." : "Revisa la evidencia disponible."}`,
              criterio: oportunidadPrioritaria.requierePruebaOrganica
                ? "Publicar una prueba orgánica pequeña y registrar el resultado real antes de proponer presupuesto."
                : "Seleccionar la oportunidad y preparar una prueba medible; no se estima venta futura sin evidencia.",
              etiqueta: oportunidadPrioritaria.requierePruebaOrganica
                ? "Hipótesis · gasto permitido $0"
                : "Demanda comprobada",
              clase: "growth-workspace__status--ready",
              boton: oportunidadPrioritaria.requierePruebaOrganica
                ? "Preparar prueba orgánica"
                : "Revisar y preparar prueba",
              ejecutar: () =>
                onTrabajarOportunidad
                  ? onTrabajarOportunidad(oportunidadPrioritaria)
                  : onAbrirModulo?.("OPORTUNIDADES"),
            }
          : {
              titulo: cargandoOportunidades
                ? "Analizando datos reales para priorizar"
                : "Detectar la mejor oportunidad con datos reales",
              descripcion: cargandoOportunidades
                ? "MONYS está cruzando inventario, ventas recientes, utilidad y cobertura de la sucursal seleccionada."
                : "Todavía no hay una oportunidad calculada para esta sucursal. Actualiza los datos de inventario y ventas o entra a Oportunidades para revisar el análisis.",
              criterio:
                "Elegir un producto con inventario, margen y potencial suficientes para una prueba pequeña.",
              etiqueta: "Siguiente paso",
              clase: "growth-workspace__status--ready",
              boton: "Ver oportunidades reales",
              ejecutar: () => onAbrirModulo?.("OPORTUNIDADES"),
            };

  return (
    <section className="growth-workspace">
      <div className="growth-workspace__glow growth-workspace__glow--one" />
      <div className="growth-workspace__glow growth-workspace__glow--two" />

      <header className="growth-workspace__header">
        <div>
          <div className="growth-workspace__eyebrow">MONYS GROWTH OS</div>

          <h1>Hola, {nombreCorto(usuario?.nombre)}</h1>

          <p>Directora de Crecimiento</p>
          <span className="growth-workspace__tagline">
            Ideas que venden, resultados que crecen
          </span>
        </div>

        <div className="growth-workspace__company-panel">
          <span className="growth-workspace__date">{fechaLocal()}</span>
          <button
            type="button"
            className="growth-workspace__company"
            onClick={onActualizar}
            title="Actualizar información real"
          >
            <span className="growth-workspace__company-icon">M</span>

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
                onChange={(event) => onCambiarEspacio?.(event.target.value)}
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

      <div
        className="growth-workspace__snapshot"
        aria-label="Resumen real de marketing"
      >
        <article>
          <span>Campañas</span>
          <strong>{resumenCampanas.activas}</strong>
          <small>en seguimiento</small>
        </article>
        <article>
          <span>Pendientes</span>
          <strong>{pendientes}</strong>
          <small>para hoy</small>
        </article>
        <article>
          <span>Semana</span>
          <strong>{tareasSemana}</strong>
          <small>acciones reales</small>
        </article>
        <article className={oportunidadVigente ? "is-ready" : "is-warning"}>
          <span>Datos</span>
          <strong>{oportunidadVigente ? "Listos" : "Actualizar"}</strong>
          <small>ventas e inventario</small>
        </article>
      </div>

      <div className="growth-workspace__focus">
        <div className="growth-workspace__focus-topline">
          <span>Prioridad inteligente</span>

          <span className={`growth-workspace__status ${accionSugerida.clase}`}>
            {accionSugerida.etiqueta}
          </span>
        </div>

        <div className="growth-workspace__focus-grid">
          <div>
            <h2>{accionSugerida.titulo}</h2>

            <p>{accionSugerida.descripcion}</p>

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
                onClick={
                  accionSugerida.ejecutarSecundaria || onVerSemana
                }
              >
                {accionSugerida.botonSecundario || "Ver plan semanal"}
              </button>
            </div>
          </div>

          <div className="growth-workspace__score">
            <div
              className="growth-workspace__ring"
              style={{
                "--growth-progress": `${
                  Math.max(0, Math.min(100, porcentaje)) * 3.6
                }deg`,
              }}
            >
              <div>
                <strong>{porcentaje}%</strong>
                <span>cumplimiento</span>
              </div>
            </div>

            <small>Avance de las tareas reales de hoy</small>
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
            <strong>
              Ventas confirmadas, pedidos y utilidad incremental. Sin proyección
              hasta registrar resultados.
            </strong>
          </article>
        </div>
      </div>

      <section className="growth-workspace__agenda-preview">
        <div className="growth-workspace__agenda-heading">
          <div>
            <span>Calendario de trabajo</span>
            <strong>Tu semana con tareas y horarios</strong>
          </div>

          <b>
            {!oportunidadVigente && tareasSemana > 0
              ? `${tareasSemana} en pausa · faltan datos`
              : tareasSemana > 0
                ? `${tareasSemana} programadas`
                : "Borrador IA listo"}
          </b>
        </div>

        {!oportunidadVigente && tareasSemana > 0 && (
          <div className="growth-workspace__agenda-draft-note">
            <span aria-hidden="true">🛡️</span>
            <div>
              <strong>Plan protegido por datos vencidos</strong>
              <p>
                Las tareas se conservan, pero Kary no debe ejecutar una nueva
                campaña hasta que Mónica actualice ventas e inventario SICAR.
              </p>
            </div>
          </div>
        )}

        {agendaVisible.length > 0 ? (
          <div className="growth-workspace__agenda-list">
            {agendaVisible.map((tarea) => (
              <article key={tarea.id}>
                <div>
                  <span>{etiquetaFechaAgenda(tarea.fecha)}</span>
                  <strong>{tarea.hora_limite || "Sin hora"}</strong>
                </div>

                <p>{tarea.titulo}</p>

                <em>
                  {!oportunidadVigente
                    ? "En pausa · datos vencidos"
                    : String(tarea.estado || "pendiente").replaceAll("_", " ")}
                </em>
              </article>
            ))}
          </div>
        ) : (
          <div className="growth-workspace__agenda-draft">
            <div className="growth-workspace__agenda-draft-note">
              <span aria-hidden="true">🛡️</span>
              <div>
                <strong>Plan preparado · pendiente de autorización</strong>
                <p>
                  Estas son propuestas de la Agencia IA; todavía no cuentan como
                  tareas asignadas ni autorizan publicación o gasto.
                </p>
              </div>
            </div>

            <div className="growth-workspace__agenda-list growth-workspace__agenda-list--draft">
              {agendaPropuesta.map((tarea) => (
                <article key={tarea.id}>
                  <div>
                    <span>{etiquetaFechaAgenda(tarea.fecha)}</span>
                    <strong>{tarea.hora}</strong>
                  </div>

                  <p>{tarea.titulo}</p>
                  <em>Borrador IA</em>
                </article>
              ))}
            </div>
          </div>
        )}

        <button
          type="button"
          className="growth-workspace__agenda-button"
          onClick={onVerSemana}
        >
          Ver calendario completo
          <span aria-hidden="true">→</span>
        </button>
      </section>

      <section className="growth-workspace__agency-live">
        <div className="growth-workspace__agency-heading">
          <div>
            <span>Agencia IA trabajando</span>
            <strong>
              {turnosAgencia.every((turno) => turno.paso.completado)
                ? "Ciclo completo · lista para decidir qué repetir"
                : `${turnosAgencia[turnoAgenciaActivo].agente} tiene el siguiente turno`}
            </strong>
          </div>
          <b>
            {turnosAgencia.every((turno) => turno.paso.completado)
              ? "Completado"
              : "En preparación"}
          </b>
        </div>

        <div className="growth-workspace__agency-agents">
          {turnosAgencia.map((turno, indice) => {
            const activo =
              !turno.paso.completado && indice === turnoAgenciaActivo;

            return (
              <article
                key={turno.agente}
                className={
                  turno.paso.completado
                    ? "growth-workspace__agency-agent growth-workspace__agency-agent--done"
                    : activo
                      ? "growth-workspace__agency-agent growth-workspace__agency-agent--active"
                      : "growth-workspace__agency-agent"
                }
              >
                <span aria-hidden="true">{turno.icono}</span>
                <div>
                  <strong>{turno.agente}</strong>
                  <small>{turno.entrega}</small>
                  <em>
                    {turno.paso.completado
                      ? "✓ Entrega comprobada"
                      : activo
                        ? `Ahora: ${turno.paso.detalle}`
                        : "Espera la entrega anterior"}
                  </em>
                </div>
              </article>
            );
          })}
        </div>

        <div className="growth-workspace__agency-next">
          <span>Lo siguiente</span>
          <strong>
            {turnosAgencia.every((turno) => turno.paso.completado)
              ? "Revisar utilidad y conservar el aprendizaje"
              : turnosAgencia[turnoAgenciaActivo].paso.detalle}
          </strong>
          <button type="button" onClick={accionSugerida.ejecutar}>
            {accionSugerida.boton} →
          </button>
        </div>
      </section>

      <section className="growth-workspace__funnel">
        <div className="growth-workspace__funnel-heading">
          <div>
            <span>Embudo de ventas real</span>
            <strong>De contenido visto a dinero comprobado</strong>
          </div>
          <b>
            {etapasEmbudoConfirmadas > 0
              ? `${etapasEmbudoConfirmadas}/4 etapas con datos`
              : "Esperando primer registro"}
          </b>
        </div>

        <div className="growth-workspace__funnel-grid">
          {etapasEmbudo.map((etapa, indice) => {
            const disponible = resumenEmbudo.confirmados[etapa.clave] > 0;

            return (
              <article
                key={etapa.clave}
                className={disponible ? "is-confirmed" : "is-empty"}
              >
                <div className="growth-workspace__funnel-stage">
                  <span aria-hidden="true">{etapa.icono}</span>
                  <small>Etapa {indice + 1}</small>
                </div>
                <strong>{etapa.etiqueta}</strong>
                <b>{disponible ? etapa.valor : "Sin dato"}</b>
                <em>
                  {disponible
                    ? etapa.conversion || "Dato real registrado"
                    : "Pendiente de registrar"}
                </em>
              </article>
            );
          })}
        </div>

        <div className="growth-workspace__funnel-action">
          <p>
            MONYS no rellena huecos con estimaciones. Cada etapa aparece solo
            cuando Kary registra un resultado observado.
          </p>
          <button type="button" onClick={() => onAbrirModulo?.("RESULTADOS")}>
            Registrar resultados →
          </button>
        </div>
      </section>

      <section className="growth-workspace__publishing-center">
        <div className="growth-workspace__publishing-heading">
          <div>
            <span>Centro de publicación</span>
            <strong>
              {contenidoCampanaListo
                ? "Contenido listo para revisión humana"
                : "Preparar primero el kit de publicación"}
            </strong>
          </div>
          <b
            className={
              publicacionCampanaConfirmada ? "is-published" : "is-locked"
            }
          >
            {publicacionCampanaConfirmada
              ? "✓ Publicación confirmada"
              : "🔒 Publicación directa bloqueada"}
          </b>
        </div>

        <div className="growth-workspace__publishing-flow">
          <article className={contenidoCampanaListo ? "is-ready" : ""}>
            <span>1</span>
            <div>
              <strong>Preparar</strong>
              <small>Guion, formato, texto y CTA</small>
            </div>
          </article>
          <article>
            <span>2</span>
            <div>
              <strong>Revisar y autorizar</strong>
              <small>Mónica confirma producto, precio y presupuesto</small>
            </div>
          </article>
          <article className={publicacionCampanaConfirmada ? "is-ready" : ""}>
            <span>3</span>
            <div>
              <strong>Publicar y comprobar</strong>
              <small>
                Conexiones externas pendientes; Kary confirma el resultado real
              </small>
            </div>
          </article>
        </div>

        <div className="growth-workspace__publishing-actions">
          <button type="button" onClick={() => onAbrirModulo?.("CONTENIDO")}>
            {contenidoCampanaListo
              ? "Revisar kit listo"
              : "Preparar publicación"}
          </button>
          <button
            type="button"
            className="is-secondary"
            onClick={() => onAbrirModulo?.("RESULTADOS")}
          >
            Confirmar publicación o resultado
          </button>
        </div>

        <p>
          Meta, TikTok, Mercado Libre, WhatsApp y ChatGPT Ads permanecen sin
          ejecución automática hasta completar sus accesos oficiales.
        </p>
      </section>

      <section className="growth-workspace__approval-light">
        <div className="growth-workspace__approval-heading">
          <div>
            <span>Semáforo de autorización</span>
            <strong>Lo que Kary puede hacer y lo que decide Mónica</strong>
          </div>
          <b>Control humano activo</b>
        </div>

        <div className="growth-workspace__approval-grid">
          <article className={oportunidadVigente ? "is-green" : "is-red"}>
            <span>{oportunidadVigente ? "✓" : "!"}</span>
            <div>
              <strong>Datos para decidir</strong>
              <small>
                {oportunidadVigente
                  ? "Ventas e inventario vigentes"
                  : "Bloqueado hasta actualizar SICAR"}
              </small>
            </div>
          </article>

          <article className={contenidoCampanaListo ? "is-green" : "is-amber"}>
            <span>{contenidoCampanaListo ? "✓" : "○"}</span>
            <div>
              <strong>Contenido</strong>
              <small>
                {contenidoCampanaListo
                  ? "Kit preparado para revisión"
                  : "Kary puede prepararlo; todavía no publica"}
              </small>
            </div>
          </article>

          <article
            className={
              presupuestoConAutorizacion || presupuestoPropuestoCampana === 0
                ? "is-green"
                : "is-red"
            }
          >
            <span>
              {presupuestoConAutorizacion || presupuestoPropuestoCampana === 0
                ? "✓"
                : "🔒"}
            </span>
            <div>
              <strong>Presupuesto y gasto</strong>
              <small>
                {presupuestoConAutorizacion
                  ? `${moneda(presupuestoAutorizadoCampana)} autorizados por Mónica`
                  : presupuestoPropuestoCampana > 0
                    ? `${moneda(presupuestoPropuestoCampana)} propuestos · gasto permitido $0`
                    : "Campaña orgánica · gasto permitido $0"}
              </small>
            </div>
          </article>

          <article className="is-red">
            <span>🔒</span>
            <div>
              <strong>Publicación externa</strong>
              <small>
                Requiere aprobación de Mónica y conexión oficial del canal
              </small>
            </div>
          </article>
        </div>

        <div className="growth-workspace__approval-action">
          <p>
            Kary puede analizar, diseñar y preparar. No puede publicar anuncios
            ni gastar dinero desde MONYS sin autorización.
          </p>
          <button type="button" onClick={() => onAbrirModulo?.("CAMPANAS")}>
            Revisar campaña →
          </button>
        </div>
      </section>

      <section
        className={`growth-workspace__data-readiness ${
          oportunidadVigente
            ? "growth-workspace__data-readiness--ready"
            : "growth-workspace__data-readiness--blocked"
        }`}
      >
        <div className="growth-workspace__data-heading">
          <div>
            <span>Base para decidir</span>
            <strong>
              {oportunidadVigente
                ? "Datos listos para recomendar campaña"
                : "Primera campaña recomendada protegida"}
            </strong>
          </div>

          <b>
            {oportunidadVigente
              ? "✓ Lista"
              : `${datosFaltantes.length} actualización${
                  datosFaltantes.length === 1 ? "" : "es"
                } pendiente${datosFaltantes.length === 1 ? "" : "s"}`}
          </b>
        </div>

        <p>
          {oportunidadVigente
            ? "MONYS ya puede cruzar demanda, existencia y margen para proponer producto, canal y prueba medible. La publicación y cualquier gasto siguen requiriendo autorización humana."
            : `MONYS no sustituye datos antiguos con estimaciones. Actualiza las fuentes marcadas; al volver a cargar esta pantalla se recalcularán producto, canal y acción sugerida. Vigencia máxima: ${limiteVigencia} días.`}
        </p>

        <div className="growth-workspace__data-sources">
          {fuentesCampana.map((fuente) => {
            const vigente = fuente.dato?.vigente === true;

            return (
              <article key={fuente.clave}>
                <span
                  className={
                    vigente
                      ? "growth-workspace__data-icon growth-workspace__data-icon--ready"
                      : "growth-workspace__data-icon growth-workspace__data-icon--blocked"
                  }
                  aria-hidden="true"
                >
                  {vigente ? "✓" : "!"}
                </span>
                <div>
                  <strong>{fuente.titulo}</strong>
                  <small>{fuente.descripcion}</small>
                  <em>
                    {fechaDato(fuente.dato?.fecha)} ·{" "}
                    {etiquetaAntiguedad(fuente.dato?.antiguedadDias)}
                  </em>
                </div>
                <b>{vigente ? "Vigente" : "Actualizar"}</b>
              </article>
            );
          })}
        </div>

        {!oportunidadVigente && (
          <button
            type="button"
            className="growth-workspace__data-refresh"
            onClick={onActualizar}
          >
            ↻ Comprobar nuevamente los datos
          </button>
        )}
      </section>

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
              <span aria-hidden="true">{paso.completado ? "✓" : "○"}</span>
              <div>
                <strong>{paso.etiqueta}</strong>
                <small>{paso.detalle}</small>
              </div>
            </article>
          ))}
        </div>

        <p>
          Este porcentaje mide pasos operativos confirmados; no estima ventas ni
          resultados futuros.
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

          <button type="button" onClick={() => onAbrirModulo?.("RESULTADOS")}>
            Ver detalle →
          </button>
        </div>

        <div className="growth-workspace__impact-grid">
          <article>
            <span>Seguimientos internos</span>
            <strong>{resumenCampanas.activas}</strong>
          </article>
          <article>
            <span>Ventas atribuidas</span>
            <strong>
              {valorAcumulado(
                resumenCampanas.ventas,
                resumenCampanas.campanasConVentas,
              )}
            </strong>
          </article>
          <article>
            <span>Inversión</span>
            <strong>
              {valorAcumulado(
                resumenCampanas.inversion,
                resumenCampanas.campanasConInversion,
              )}
            </strong>
          </article>
          <article>
            <span>Utilidad estimada</span>
            <strong>
              {valorAcumulado(
                resumenCampanas.utilidad,
                resumenCampanas.campanasConUtilidad,
              )}
            </strong>
          </article>
        </div>

        <p
          role="note"
          style={{
            margin: "9px 0 0",
            padding: "10px 12px",
            borderRadius: "12px",
            background: "rgba(255,255,255,.72)",
            color: "#65475a",
            fontSize: "12px",
            lineHeight: 1.5,
          }}
        >
          La utilidad es una estimación: venta atribuida × margen histórico de SICAR − gasto confirmado. Solo se incluye cuando venta y gasto están confirmados; no sustituye la utilidad contable real de cada venta.
        </p>

        {resumenCampanas.decision && (
          <div className="growth-workspace__decision">
            <span>Decisión pendiente</span>
            MONYS recomienda {textoDecision} {resumenCampanas.decision.producto}
            .
          </div>
        )}
      </div>

      <div className="growth-workspace__command-grid">
        <button type="button" onClick={() => onAbrirModulo?.("OPORTUNIDADES")}>
          <span className="growth-workspace__command-icon">⌁</span>
          <span>
            <strong>Ver oportunidades</strong>
            <small>Productos con potencial real</small>
          </span>
          <b aria-hidden="true">→</b>
        </button>

        <button type="button" onClick={() => onAbrirModulo?.("CONTENIDO")}>
          <span className="growth-workspace__command-icon">▶</span>
          <span>
            <strong>Crear contenido</strong>
            <small>Hook, guion, formato y CTA</small>
          </span>
          <b aria-hidden="true">→</b>
        </button>

        <button type="button" onClick={() => onAbrirModulo?.("CAMPANAS")}>
          <span className="growth-workspace__command-icon">◎</span>
          <span>
            <strong>Diseñar campaña</strong>
            <small>Prueba, presupuesto y decisión</small>
          </span>
          <b aria-hidden="true">→</b>
        </button>

        <button type="button" onClick={() => onAbrirModulo?.("CONTENIDO")}>
          <span className="growth-workspace__command-icon">↗</span>
          <span>
            <strong>Preparar publicación</strong>
            <small>Revisar kit · no publica en redes</small>
          </span>
          <b aria-hidden="true">→</b>
        </button>

        <button type="button" onClick={() => onAbrirModulo?.("RESULTADOS")}>
          <span className="growth-workspace__command-icon">↗</span>
          <span>
            <strong>Registrar resultados</strong>
            <small>Ventas, gasto, utilidad y aprendizaje</small>
          </span>
          <b aria-hidden="true">→</b>
        </button>
      </div>

      <p className="growth-workspace__publishing-note">
        Preparar o agendar contenido aquí no lo publica en redes. Para publicar
        anuncios hace falta conectar la cuenta y autorizarlo.
      </p>

      <div className="growth-workspace__principle">
        <span>✦</span>
        <p>
          Hoy no se trata de hacer más contenido. Se trata de ejecutar la acción
          con mayor probabilidad de producir ventas y aprendizaje.
        </p>
      </div>
    </section>
  );
}
