

export function crearDecisionEjecutiva({
  tipo,
  titulo,
  descripcion,
  prioridad = "MEDIA",
  costo = 0,
  origen = "CEO_IA",
  datos = {},
}) {
  return {
    id: crypto.randomUUID(),
    tipo,
    titulo,
    descripcion,
    prioridad,
    costo,
    origen,
    datos,
    estado: "PENDIENTE",
    creadaEn: new Date().toISOString(),
  };
}

export function aprobarDecision(decision) {
  return {
    ...decision,
    estado: "APROBADA",
    resueltaEn: new Date().toISOString(),
  };
}

export function rechazarDecision(decision) {
  return {
    ...decision,
    estado: "RECHAZADA",
    resueltaEn: new Date().toISOString(),
  };
}

export function ordenarDecisionesPorPrioridad(
  decisiones = []
) {
  const orden = {
    CRITICA: 4,
    ALTA: 3,
    MEDIA: 2,
    BAJA: 1,
  };

  return [...decisiones].sort(
    (a, b) =>
      (orden[b.prioridad] || 0) -
      (orden[a.prioridad] || 0)
  );
}

function obtenerTipoDecision(decision = {}) {
  const texto = [
    decision.tipo,
    decision.accion,
    decision.area,
    decision.titulo,
  ]
    .filter(Boolean)
    .join(" ")
    .toUpperCase();

  if (
    texto.includes("COMPRA") ||
    texto.includes("INVENTARIO") ||
    texto.includes("REABAST")
  ) {
    return "COMPRAS_INVENTARIO";
  }

  if (
    texto.includes("TESORER") ||
    texto.includes("LIQUIDEZ") ||
    texto.includes("GASTO") ||
    texto.includes("FINAN")
  ) {
    return "FINANZAS";
  }

  if (
    texto.includes("VENTA") ||
    texto.includes("COMERCIAL")
  ) {
    return "COMERCIAL";
  }

  if (
    texto.includes("MARKETING") ||
    texto.includes("CAMPAÑA") ||
    texto.includes("PUBLICIDAD")
  ) {
    return "MARKETING";
  }

  if (
    texto.includes("RH") ||
    texto.includes("EMPLEADO") ||
    texto.includes("PERSONAL") ||
    texto.includes("CONTRATAR")
  ) {
    return "RECURSOS_HUMANOS";
  }

  if (
    texto.includes("LOGIST") ||
    texto.includes("RUTA") ||
    texto.includes("CHOFER")
  ) {
    return "LOGISTICA";
  }

  return "GENERAL";
}

export async function ejecutarDecision(decision, { crearOrden = null } = {}) {
  if (!decision) {
    throw new Error(
      "No se recibió una decisión para ejecutar."
    );
  }

  const tipo = obtenerTipoDecision(decision);

  const resultadoBase = {
    decisionId: decision.id || null,
    tipo,
    titulo:
      decision.titulo ||
      "Decisión ejecutiva",
    estado: "PENDIENTE_EJECUCION",
    ejecutadaEn: null,
  };

  switch (tipo) {
    case "COMPRAS_INVENTARIO": {
      const crearOrdenConfirmada = crearOrden || (await import("../services/ordenesCompraService")).crearOrdenCompra;
      const ordenCompra =
        await crearOrdenConfirmada({
          titulo:
            decision.titulo,
          descripcion:
            decision.descripcion,
          prioridad:
            decision.prioridad,
          area:
            decision.area ||
            "Inventario",
          costoEstimado:
            decision.costo,
          origenDecisionId:
            decision.id,
        });

      if (!ordenCompra?.id) throw new Error("No se confirmó el registro de la orden de compra.");

      return {
        ...resultadoBase,
        estado: "ORDEN_CREADA",
        registradaEn: new Date().toISOString(),
        accion:
          "CREAR_ORDEN_COMPRA",
        mensaje:
          "Orden de compra registrada y pendiente de gestión. La compra y su recepción aún no están comprobadas.",
        ordenCompra,
      };
    }

    case "FINANZAS":
      return {
        ...resultadoBase,
        accion:
          "GENERAR_ACCION_FINANCIERA",
        mensaje:
          "Aprobada. Pendiente de registrar y asignar una acción en el área financiero. No se ha ejecutado.",
      };

    case "COMERCIAL":
      return {
        ...resultadoBase,
        accion:
          "GENERAR_ACCION_COMERCIAL",
        mensaje:
          "Aprobada. Pendiente de registrar y asignar una acción en el área comercial. No se ha ejecutado.",
      };

    case "MARKETING":
      return {
        ...resultadoBase,
        accion:
          "GENERAR_ACCION_MARKETING",
        mensaje:
          "Aprobada. Pendiente de registrar y asignar una acción en el área de Marketing. No se ha ejecutado.",
      };

    case "RECURSOS_HUMANOS":
      return {
        ...resultadoBase,
        accion:
          "GENERAR_ACCION_RH",
        mensaje:
          "Aprobada. Pendiente de registrar y asignar una acción en el área de Recursos Humanos. No se ha ejecutado.",
      };

    case "LOGISTICA":
      return {
        ...resultadoBase,
        accion:
          "GENERAR_ACCION_LOGISTICA",
        mensaje:
          "Aprobada. Pendiente de registrar y asignar una acción en el área de Logística. No se ha ejecutado.",
      };

    default:
      return {
        ...resultadoBase,
        accion:
          "REVISION_EJECUTIVA",
        mensaje:
          "Aprobada. Pendiente de asignar una acción y comprobar su resultado.",
      };
  }
}