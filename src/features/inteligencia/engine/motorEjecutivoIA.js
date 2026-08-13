import {
  crearOrdenCompra,
} from "../services/ordenesCompraService";

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

export async function ejecutarDecision(decision) {
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
    estado: "EJECUTADA",
    ejecutadaEn:
      new Date().toISOString(),
  };

  switch (tipo) {
    case "COMPRAS_INVENTARIO": {
      const ordenCompra =
        await crearOrdenCompra({
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

      return {
        ...resultadoBase,
        accion:
          "CREAR_ORDEN_COMPRA",
        mensaje:
          "Orden de compra creada correctamente.",
        ordenCompra,
      };
    }

    case "FINANZAS":
      return {
        ...resultadoBase,
        accion:
          "GENERAR_ACCION_FINANCIERA",
        mensaje:
          "La decisión fue enviada al flujo financiero.",
      };

    case "COMERCIAL":
      return {
        ...resultadoBase,
        accion:
          "GENERAR_ACCION_COMERCIAL",
        mensaje:
          "La decisión fue enviada al flujo comercial.",
      };

    case "MARKETING":
      return {
        ...resultadoBase,
        accion:
          "GENERAR_ACCION_MARKETING",
        mensaje:
          "La decisión fue enviada al flujo de Marketing.",
      };

    case "RECURSOS_HUMANOS":
      return {
        ...resultadoBase,
        accion:
          "GENERAR_ACCION_RH",
        mensaje:
          "La decisión fue enviada al flujo de Recursos Humanos.",
      };

    case "LOGISTICA":
      return {
        ...resultadoBase,
        accion:
          "GENERAR_ACCION_LOGISTICA",
        mensaje:
          "La decisión fue enviada al flujo de Logística.",
      };

    default:
      return {
        ...resultadoBase,
        accion:
          "REVISION_EJECUTIVA",
        mensaje:
          "La decisión quedó registrada para revisión ejecutiva.",
      };
  }
}