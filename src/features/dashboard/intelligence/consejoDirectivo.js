// ======================================================
// MONYS OS
// Consejo Directivo IA
// ======================================================

import {
  generarResumenDirectorIA,
} from "./directorIA";

function ordenarPorPrioridad(decisiones = []) {
  const orden = {
    alta: 1,
    media: 2,
    baja: 3,
  };

  return [...decisiones].sort(
    (a, b) =>
      (orden[a?.prioridad] || 99) -
      (orden[b?.prioridad] || 99)
  );
}

function eliminarDuplicados(decisiones = []) {
  const registros = new Set();

  return decisiones.filter((decision) => {
    const clave = [
      decision?.titulo || "",
      decision?.descripcion ||
        decision?.mensaje ||
        "",
    ]
      .join("-")
      .toLowerCase()
      .trim();

    if (registros.has(clave)) {
      return false;
    }

    registros.add(clave);
    return true;
  });
}

export function obtenerResumenConsejo({
  datosDashboard,
}) {
  if (!datosDashboard) {
    return {
      resumen:
        "Todavía no hay información suficiente para generar un análisis.",
      estado: "Esperando información",
      nivel: "🟡",
      decisiones: [],
    };
  }

  const decisionesGeneradas =
    generarResumenDirectorIA(datosDashboard);

  const decisionesOrdenadas =
    ordenarPorPrioridad(
      eliminarDuplicados(decisionesGeneradas)
    );

  const decisionesPrincipales =
    decisionesOrdenadas.slice(0, 5);

   const decisionAlta = decisionesPrincipales.find(
  (decision) => decision.prioridad === "alta"
);

const decisionInventario = decisionesPrincipales.find(
  (decision) =>
    String(decision.titulo || "")
      .toLowerCase()
      .includes("inventario")
);

const decisionFinanciera = decisionesPrincipales.find(
  (decision) =>
    String(decision.titulo || "")
      .toLowerCase()
      .includes("financ") ||
    String(decision.titulo || "")
      .toLowerCase()
      .includes("capacidad de compra")
);

const detalleAlta =
  decisionAlta?.descripcion ??
  decisionAlta?.mensaje ??
  "";

const detalleInventario =
  decisionInventario?.descripcion ??
  decisionInventario?.mensaje ??
  "";

const detalleFinanciero =
  decisionFinanciera?.descripcion ??
  decisionFinanciera?.mensaje ??
  "";

let tituloEjecutivo =
  "Seguimiento ejecutivo del día";

let accionEjecutiva =
  "Mantén el seguimiento de la operación y revisa los indicadores principales.";

if (
  decisionAlta &&
  decisionInventario &&
  decisionFinanciera
) {
  tituloEjecutivo =
    "Prioridad comercial con control financiero";

  accionEjecutiva =
    `${detalleAlta} ` +
    `Antes de realizar nuevas compras, revisa la situación de inventario: ${detalleInventario} ` +
    `También considera la recomendación financiera: ${detalleFinanciero}`;
} else if (
  decisionAlta &&
  decisionInventario
) {
  tituloEjecutivo =
    "Prioridad de venta y reposición";

  accionEjecutiva =
    `${detalleAlta} ` +
    `Revisa existencias y atiende esta situación de inventario: ${detalleInventario}`;
} else if (
  decisionAlta &&
  decisionFinanciera
) {
  tituloEjecutivo =
    "Prioridad comercial con límite de compra";

  accionEjecutiva =
    `${detalleAlta} ` +
    `Toma la decisión respetando esta condición financiera: ${detalleFinanciero}`;
} else if (decisionAlta) {
  tituloEjecutivo =
    "Prioridad comercial del día";

  accionEjecutiva = detalleAlta;
} else if (decisionInventario) {
  tituloEjecutivo =
    "Prioridad de inventario";

  accionEjecutiva =
    `Revisa y atiende la siguiente situación: ${detalleInventario}`;
} else if (decisionFinanciera) {
  tituloEjecutivo =
    "Prioridad financiera";

  accionEjecutiva = detalleFinanciero;
}

const decisionEjecutiva =
  decisionesPrincipales.length > 0
    ? {
        titulo: tituloEjecutivo,
        accion: accionEjecutiva,
        prioridad: decisionAlta
          ? "alta"
          : decisionesPrincipales[0]?.prioridad ||
            "media",
        origen: "Consejo Directivo IA",
      }
    : null;

     
  if (decisionesPrincipales.length === 0) {
    return {
      resumen:
        "El Consejo Directivo analizó la información disponible y no encontró decisiones urgentes.",
      estado: "Operación estable",
      nivel: "🟢",
      decisiones: [],
    };
  }

  const hayPrioridadAlta =
    decisionesPrincipales.some(
      (decision) =>
        decision.prioridad === "alta"
    );

  const hayPrioridadMedia =
    decisionesPrincipales.some(
      (decision) =>
        decision.prioridad === "media"
    );

  let estado = "Operación estable";
  let nivel = "🟢";

  if (hayPrioridadAlta) {
    estado = "Atención prioritaria";
    nivel = "🔴";
  } else if (hayPrioridadMedia) {
    estado = "Seguimiento necesario";
    nivel = "🟡";
  }

  const resumen =
    decisionesPrincipales
      .map((decision, index) => {
        const detalle =
          decision.descripcion ??
          decision.mensaje ??
          "Sin detalle disponible.";

        return `${index + 1}. ${decision.titulo}: ${detalle}`;
      })
      .join("\n");

  return {
    resumen,
    estado,
    nivel,
    decisiones: decisionesPrincipales,
    decisionEjecutiva,
};
}