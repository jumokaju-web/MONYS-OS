import { supabase } from "../../../supabase";

export async function obtenerEspaciosGrowth({
  organizationId,
} = {}) {
  if (!organizationId) {
    return [];
  }

  const {
    data: negocios,
    error: errorNegocios,
  } = await supabase
    .from("businesses")
    .select("id, organization_id, name, active")
    .eq("organization_id", organizationId)
    .eq("active", true)
    .order("name", {
      ascending: true,
    });

  if (errorNegocios) {
    throw errorNegocios;
  }

  const businessIds = (negocios || []).map(
    (negocio) => negocio.id
  );

  if (businessIds.length === 0) {
    return [];
  }

  const {
    data: sucursales,
    error: errorSucursales,
  } = await supabase
    .from("branches")
    .select("id, business_id, name, active")
    .in("business_id", businessIds)
    .eq("active", true)
    .order("name", {
      ascending: true,
    });

  if (errorSucursales) {
    throw errorSucursales;
  }

  return (negocios || []).flatMap(
    (negocio) => {
      const sucursalesNegocio = (
        sucursales || []
      ).filter(
        (sucursal) =>
          sucursal.business_id === negocio.id
      );

      if (sucursalesNegocio.length === 0) {
        return [
          {
            organization_id:
              negocio.organization_id,
            business_id: negocio.id,
            branch_id: null,
            negocio: negocio.name,
            sucursal: "Todas / No aplica",
          },
        ];
      }

      return sucursalesNegocio.map(
        (sucursal) => ({
          organization_id:
            negocio.organization_id,
          business_id: negocio.id,
          branch_id: sucursal.id,
          negocio: negocio.name,
          sucursal: sucursal.name,
        })
      );
    }
  );
}

export function claveEspacioGrowth(espacio) {
  return [
    espacio?.organization_id || "",
    espacio?.business_id || "",
    espacio?.branch_id || "",
  ].join(":");
}

function tieneContenido(valor) {
  if (Array.isArray(valor)) {
    return valor.length > 0;
  }

  if (valor && typeof valor === "object") {
    return Object.keys(valor).length > 0;
  }

  return Boolean(String(valor || "").trim());
}

function numeroRegistrado(valor) {
  if (valor === null || valor === undefined || valor === "") {
    return null;
  }

  const numero = Number(valor);
  return Number.isFinite(numero) ? numero : null;
}

export function evaluarResultadoCampanaGrowth({
  gastoAcumulado = 0,
  pedidosAcumulados = 0,
  ventaAcumulada = 0,
  margenRealBase = null,
  publicacion = "",
  gastoConfirmado = false,
  pedidosConfirmados = false,
  ventaConfirmada = false,
} = {}) {
  const gasto = Math.max(0, Number(gastoAcumulado) || 0);
  const pedidos = Math.max(0, Number(pedidosAcumulados) || 0);
  const venta = Math.max(0, Number(ventaAcumulada) || 0);
  const margenCandidato = Number(margenRealBase);
  const margen =
    Number.isFinite(margenCandidato) && margenCandidato > 0
      ? margenCandidato
      : null;
  const costoPorPedido =
    gastoConfirmado && pedidosConfirmados && pedidos > 0
      ? gasto / pedidos
      : null;
  const utilidadEstimadaCampana =
    margen === null || !gastoConfirmado || !ventaConfirmada
      ? null
      : venta * (margen / 100) - gasto;
  let decisionActual = "CONTINUAR_MIDIENDO";

  if (publicacion === "NO_PUBLICADA") {
    decisionActual = "REPROGRAMAR_PUBLICACION";
  } else if (
    gastoConfirmado &&
    pedidosConfirmados &&
    pedidos === 0 &&
    gasto >= 90
  ) {
    decisionActual = "PAUSAR";
  } else if (
    utilidadEstimadaCampana !== null &&
    utilidadEstimadaCampana <= 0 &&
    gasto >= 90
  ) {
    decisionActual = "PAUSAR";
  } else if (
    pedidos >= 3 &&
    costoPorPedido !== null &&
    costoPorPedido <= 30 &&
    utilidadEstimadaCampana !== null &&
    utilidadEstimadaCampana > 0
  ) {
    decisionActual = "SOLICITAR_AUTORIZACION_PARA_ESCALAR";
  }

  const faltaMargen = margen === null;
  const faltanResultadosFinancieros =
    !gastoConfirmado || !ventaConfirmada;
  const requiereAutorizacion =
    decisionActual === "SOLICITAR_AUTORIZACION_PARA_ESCALAR";
  const resumen =
    publicacion === "NO_PUBLICADA"
      ? "El contenido no se publicó; todavía no existe evidencia suficiente para evaluar su respuesta comercial."
      : faltanResultadosFinancieros
        ? "La campaña tiene un avance, pero faltan confirmar la venta atribuida o el gasto real para calcular rentabilidad."
      : faltaMargen
        ? `Hay ${pedidos} pedido${pedidos === 1 ? "" : "s"} y venta atribuida registrada, pero falta el margen real para saber si la campaña dejó utilidad.`
        : utilidadEstimadaCampana > 0
          ? "La campaña registra utilidad positiva con el margen real disponible; conviene conservar la evidencia y seguir midiendo antes de aumentar inversión."
          : "La campaña todavía no demuestra utilidad positiva con los datos reales registrados."
  const siguienteAccion =
    decisionActual === "PAUSAR"
      ? "Pausar nueva inversión y revisar contenido, oferta y atribución."
      : decisionActual === "REPROGRAMAR_PUBLICACION"
        ? "Reprogramar la publicación y registrar el resultado real cuando salga."
        : requiereAutorizacion
          ? "Presentar los resultados a Mónica y esperar su autorización antes de escalar o gastar más."
          : faltanResultadosFinancieros
            ? "Confirmar venta atribuida y gasto real; escribe 0 cuando el resultado comprobado haya sido cero."
          : faltaMargen
            ? "Confirmar el margen real del producto para completar la rentabilidad."
            : "Continuar midiendo sin modificar el presupuesto autorizado."

  return {
    costoPorPedido,
    margenRealBase: margen,
    utilidadEstimadaCampana,
    rentabilidadEstado: faltanResultadosFinancieros
      ? "PENDIENTE_RESULTADOS_CONFIRMADOS"
      : faltaMargen
        ? "PENDIENTE_MARGEN_REAL"
        : "CALCULADA_CON_MARGEN_REAL",
    decisionActual,
    aprendizajeProvisional: {
      estado: "PROVISIONAL",
      tipoFuente: "DATO_REAL",
      resumen,
      siguienteAccion,
      requiereAutorizacion,
      faltantes: [
        ...(ventaConfirmada ? [] : ["VENTA_ATRIBUIDA"]),
        ...(gastoConfirmado ? [] : ["GASTO_REAL"]),
        ...(faltaMargen ? ["MARGEN_REAL"] : []),
      ],
      actualizadoEn: new Date().toISOString(),
    },
  };
}

export function orquestarAgenciaGrowth({
  actualizacionDatos = null,
  productoLider = null,
  inventarioProductoLider = null,
  campanasActivas = [],
  campanasFinalizadas = [],
} = {}) {
  const campanaActiva = campanasActivas[0] || null;
  const campanaReferencia =
    campanaActiva || campanasFinalizadas[0] || null;
  const estrategia = campanaReferencia?.estrategia_ia || {};
  const resultado = campanaReferencia?.resultado || {};
  const aprendizaje = campanaReferencia?.aprendizaje || {};
  const historial = Array.isArray(resultado?.historial)
    ? resultado.historial
    : [];
  const publicacionConfirmada = historial.some(
    (registro) => registro?.publicacion === "PUBLICADA"
  );
  const tieneResultados = historial.some((registro) =>
    Object.values(registro?.camposConfirmados || {}).some(
      (confirmado) => confirmado === true
    )
  );
  const campoConfirmado = (campo) =>
    resultado?.camposConfirmados?.[campo] === true ||
    historial.some(
      (registro) =>
        registro?.camposConfirmados?.[campo] === true ||
        Number(registro?.[campo]) > 0
    );
  const ventaConfirmada = campoConfirmado("venta");
  const gastoConfirmado = campoConfirmado("gasto");
  const productoConfirmado =
    tieneContenido(productoLider?.nombre) ||
    tieneContenido(campanaReferencia?.producto);
  const inventarioConfirmado =
    numeroRegistrado(inventarioProductoLider?.existencia) !== null;
  const presupuesto = numeroRegistrado(
    campanaReferencia?.presupuesto
  );
  const venta = numeroRegistrado(resultado?.ventaAcumulada);
  const utilidad = numeroRegistrado(
    resultado?.utilidadEstimadaCampana
  );
  const decisionResultado =
    resultado?.decisionActual || null;
  const decision =
    decisionResultado ||
    campanaReferencia?.decision_ia ||
    null;

  const etapas = [
    {
      id: "CONTEXTO",
      agente: "Estrategia",
      etiqueta: "Contexto real",
      detalle: "Ventas e inventario vigentes de la sucursal",
      completado: actualizacionDatos?.vigente === true,
      destino: "plan-crecimiento-marketing",
      accion: "Actualizar SICAR y volver a comprobar",
    },
    {
      id: "OPORTUNIDAD",
      agente: "Oportunidades",
      etiqueta: "Oportunidad",
      detalle: "Producto, existencia y evidencia comercial",
      completado:
        actualizacionDatos?.vigente === true &&
        productoConfirmado &&
        inventarioConfirmado,
      destino: "plan-crecimiento-marketing",
      accion: "Validar el producto prioritario",
    },
    {
      id: "HIPOTESIS",
      agente: "Estrategia",
      etiqueta: "Hipótesis",
      detalle: "Qué se probará y por qué podría funcionar",
      completado:
        tieneContenido(campanaReferencia?.hipotesis) ||
        tieneContenido(estrategia?.hipotesis),
      destino: "campanas-marketing-activas",
      accion: "Definir una prueba medible",
    },
    {
      id: "CONTENIDO",
      agente: "Creatividad",
      etiqueta: "Contenido",
      detalle: "Gancho, guion, formato, mensaje y CTA",
      completado:
        tieneContenido(estrategia?.kitPublicacion) ||
        (tieneContenido(campanaReferencia?.gancho) &&
          tieneContenido(campanaReferencia?.cta)),
      destino: "campanas-marketing-activas",
      accion: "Generar y revisar el kit de contenido",
    },
    {
      id: "CANAL",
      agente: "Campañas",
      etiqueta: "Canal",
      detalle: "Canal principal y adaptación multicanal",
      completado: tieneContenido(
        campanaReferencia?.canal_principal ||
          estrategia?.canalPrincipal
      ),
      destino: "growth-paid-channels-title",
      accion: "Confirmar canal y conexión",
    },
    {
      id: "INVERSION",
      agente: "Auditoría",
      etiqueta: "Inversión",
      detalle: "Presupuesto registrado; cero también es una decisión",
      completado: presupuesto !== null,
      destino: "campanas-marketing-activas",
      accion: "Registrar presupuesto y autorización",
    },
    {
      id: "PUBLICACION",
      agente: "Campañas",
      etiqueta: "Publicación",
      detalle: "Salida real del contenido confirmada por Kary",
      completado: publicacionConfirmada,
      destino: "campanas-marketing-activas",
      accion: "Confirmar la publicación real",
    },
    {
      id: "RESULTADO",
      agente: "Embudo",
      etiqueta: "Resultado",
      detalle: "Primer avance real comprobado después de publicar",
      completado: tieneResultados,
      destino: "campanas-marketing-activas",
      accion: "Registrar el primer resultado real",
    },
    {
      id: "VENTAS",
      agente: "Embudo",
      etiqueta: "Ventas",
      detalle: "Venta atribuida registrada, incluso si fue cero",
      completado:
        tieneResultados &&
        ventaConfirmada &&
        venta !== null,
      destino: "campanas-marketing-activas",
      accion: "Confirmar ventas atribuidas",
    },
    {
      id: "UTILIDAD",
      agente: "Rentabilidad",
      etiqueta: "Utilidad",
      detalle: "Margen, gasto y utilidad incremental calculados",
      completado:
        tieneResultados &&
        ventaConfirmada &&
        gastoConfirmado &&
        utilidad !== null,
      destino: "campanas-marketing-activas",
      accion: "Calcular utilidad de la campaña",
    },
    {
      id: "APRENDIZAJE",
      agente: "Memoria",
      etiqueta: "Aprendizaje",
      detalle: "Qué funcionó, qué falló y qué no repetir",
      completado:
        tieneContenido(aprendizaje) ||
        campanasFinalizadas.length > 0,
      destino: "historial-aprendizaje-campanas",
      accion: "Finalizar y documentar aprendizaje",
    },
    {
      id: "SIGUIENTE_ACCION",
      agente: "Dirección Growth",
      etiqueta: "Siguiente acción",
      detalle: "Mantener, mejorar, escalar o detener",
      completado:
        tieneResultados &&
        utilidad !== null &&
        tieneContenido(decisionResultado),
      destino: "campanas-marketing-activas",
      accion: "Pedir decisión a MONYS",
    },
  ];

  const completadas = etapas.filter(
    (etapa) => etapa.completado
  ).length;
  const etapasSeguimiento = [
    "PUBLICACION",
    "RESULTADO",
    "VENTAS",
    "UTILIDAD",
    "APRENDIZAJE",
    "SIGUIENTE_ACCION",
  ];
  const siguienteSeguimiento = campanaActiva
    ? etapas.find(
        (etapa) =>
          etapasSeguimiento.includes(etapa.id) &&
          !etapa.completado
      )
    : null;
  const siguiente =
    siguienteSeguimiento ||
    etapas.find((etapa) => !etapa.completado) ||
    null;

  return {
    etapas,
    completadas,
    total: etapas.length,
    porcentaje: Math.round((completadas / etapas.length) * 100),
    siguiente,
    campanaActiva,
    producto:
      campanaReferencia?.producto ||
      productoLider?.nombre ||
      "Producto por confirmar",
    decision: decision || "ESPERANDO DATOS",
  };
}

const HORARIO_POR_ETAPA = {
  CONTEXTO: "10:30",
  OPORTUNIDAD: "11:00",
  HIPOTESIS: "11:30",
  CONTENIDO: "13:00",
  CANAL: "14:00",
  INVERSION: "15:00",
  PUBLICACION: "10:00",
  RESULTADO: "17:00",
  VENTAS: "17:15",
  UTILIDAD: "17:30",
  APRENDIZAJE: "18:00",
  SIGUIENTE_ACCION: "18:15",
};

const INSTRUCCIONES_POR_ETAPA = {
  CONTEXTO:
    "1. Importar ventas por artículo de la sucursal.\n2. Importar inventario actual.\n3. Confirmar que ambos reportes correspondan a la misma sucursal.\n4. Volver a cargar Growth OS.",
  OPORTUNIDAD:
    "1. Revisar producto sugerido.\n2. Confirmar existencia física.\n3. Confirmar precio y margen.\n4. Guardar cualquier diferencia encontrada.",
  HIPOTESIS:
    "1. Definir qué se quiere comprobar.\n2. Elegir una métrica real.\n3. Establecer cuándo continuar y cuándo detener.\n4. No prometer ventas futuras.",
  CONTENIDO:
    "1. Preparar gancho, guion, texto y CTA.\n2. Usar únicamente beneficios confirmados.\n3. Verificar precio e inventario.\n4. Guardar evidencia del contenido final.",
  CANAL:
    "1. Confirmar dónde está la audiencia.\n2. Adaptar formato y CTA.\n3. Validar que la cuenta correcta esté disponible.\n4. No publicar todavía.",
  INVERSION:
    "1. Registrar presupuesto propuesto.\n2. Confirmar disponibilidad financiera.\n3. Dejar la campaña pausada.\n4. Solicitar autorización de Mónica antes de gastar.",
  PUBLICACION:
    "1. Abrir el kit aprobado.\n2. Confirmar el canal y la cuenta correctos.\n3. Publicar manualmente solo si Kary tiene acceso y el contenido fue aprobado.\n4. Registrar si sí se publicó o por qué quedó pendiente.\n5. No activar pauta ni gasto.",
  RESULTADO:
    "1. Registrar alcance o vistas reales.\n2. Registrar mensajes y pedidos nuevos.\n3. Registrar venta y gasto reales.\n4. Adjuntar evidencia si está disponible.\n5. No completar métricas que todavía no se puedan comprobar.",
  VENTAS:
    "1. Confirmar pedidos pagados.\n2. Separar preguntas de ventas reales.\n3. Registrar venta atribuida.\n4. No contar apartados o intenciones sin pago confirmado.",
  UTILIDAD:
    "1. Confirmar ingreso real.\n2. Registrar costo, comisión, empaque, envío y gasto publicitario.\n3. Calcular utilidad incremental.\n4. Señalar cualquier dato faltante.",
  APRENDIZAJE:
    "1. Identificar qué generó respuesta.\n2. Anotar objeciones.\n3. Documentar qué no funcionó.\n4. Guardar una regla útil para la siguiente campaña.",
  SIGUIENTE_ACCION:
    "1. Revisar resultados y utilidad.\n2. Elegir mantener, mejorar, escalar o detener.\n3. Explicar la evidencia.\n4. No aumentar presupuesto sin autorización.",
};

export function construirTareaSiguienteAgenciaGrowth({
  flujo,
  fecha,
} = {}) {
  const siguiente = flujo?.siguiente;

  if (!siguiente || !fecha) {
    return null;
  }

  const permiteDatosDesactualizados = [
    "CONTEXTO",
    "PUBLICACION",
    "RESULTADO",
    "VENTAS",
    "UTILIDAD",
    "APRENDIZAJE",
    "SIGUIENTE_ACCION",
  ].includes(siguiente.id);

  return {
    titulo: `Agencia IA · ${siguiente.accion}: ${flujo.producto}`,
    fecha,
    horaLimite:
      HORARIO_POR_ETAPA[siguiente.id] || "17:00",
    prioridad: "alta",
    descripcion:
      `${siguiente.agente} recibe la siguiente entrega del orquestador. Etapa: ${siguiente.etiqueta}. ${siguiente.detalle}.`,
    instrucciones:
      INSTRUCCIONES_POR_ETAPA[siguiente.id] ||
      "Completar la siguiente etapa y guardar evidencia real.",
    requiereEvidencia: [
      "CONTENIDO",
      "PUBLICACION",
      "RESULTADO",
      "VENTAS",
    ].includes(siguiente.id),
    criterioExito:
      `La etapa ${siguiente.etiqueta} queda comprobada con datos reales y permite continuar al siguiente agente sin inventar información.`,
    origen: "orquestador_growth",
    etapaAgencia: siguiente.id,
    permiteDatosDesactualizados,
  };
}
