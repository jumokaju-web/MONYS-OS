// ======================================================
// MONYS OS
// Director General IA
// CEO Ejecutivo
// ======================================================

function convertirNumero(valor) {
  const numero = Number(valor);

  return Number.isFinite(numero)
    ? numero
    : 0;
}

function formatoDinero(valor) {
  return new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency: "MXN",
    minimumFractionDigits: 2,
  }).format(
    convertirNumero(valor)
  );
}

function normalizarPrioridad(valor) {
  const prioridad =
    String(valor || "")
      .trim()
      .toUpperCase();

  if (prioridad === "CRITICA") {
    return "CRITICA";
  }

  if (prioridad === "ALTA") {
    return "ALTA";
  }

  if (prioridad === "MEDIA") {
    return "MEDIA";
  }

  return "BAJA";
}

function obtenerOrdenPrioridad(
  prioridad
) {
  const orden = {
    CRITICA: 1,
    ALTA: 2,
    MEDIA: 3,
    BAJA: 4,
  };

  return (
    orden[
      normalizarPrioridad(
        prioridad
      )
    ] || 4
  );
}

export function generarDecisionCEO({
  analisisFinanciero = null,
  analisisComercial = null,
  analisisInventario = null,
}) {
  const financiero =
    analisisFinanciero || {};

  const comercial =
    analisisComercial || {};

  const inventario =
    analisisInventario || {};

  const accionesFinancieras =
    Array.isArray(
      financiero.accionesPrioritarias
    )
      ? financiero.accionesPrioritarias
      : [];

  const accionesComerciales =
    Array.isArray(
      comercial.accionesPrioritarias
    )
      ? comercial.accionesPrioritarias
      : [];

  const sugerenciasCompra =
    Array.isArray(
      inventario.sugerenciasCompra
    )
      ? inventario.sugerenciasCompra
      : [];

  const resumenInventario =
    inventario.resumen || {};

  const dineroDisponible =
    convertirNumero(
      financiero.dineroDisponible
    );

  const vencimientos30Dias =
    convertirNumero(
      financiero.vencimientos30Dias
    );

  const capacidadCompra =
    convertirNumero(
      financiero.capacidadCompra
    );

  const reservaRecomendada =
    convertirNumero(
      financiero.reservaRecomendada
    );

  const porcentajeGastos =
    convertirNumero(
      financiero.porcentajeGastos
    );

  const utilidadTotal =
    convertirNumero(
      financiero.utilidadTotal
    );

  const margenUtilidad =
    convertirNumero(
      financiero.margenUtilidad
    );

  const inversionInventario =
    convertirNumero(
      resumenInventario.inversionSugerida
    );

  const decisiones = [];

  // ======================================================
  // 1. REVISIÓN DE LIQUIDEZ
  // ======================================================

  let estadoLiquidez =
    "ESTABLE";

  if (
    dineroDisponible < 0 ||
    (
      vencimientos30Dias > 0 &&
      capacidadCompra <= 0
    )
  ) {
    estadoLiquidez =
      "CRITICA";
  } else if (
    porcentajeGastos >= 90
  ) {
    estadoLiquidez =
      "AJUSTADA";
  }

  // ======================================================
  // 2. AUTORIZACIÓN DE COMPRA
  // ======================================================

  let presupuestoCompraAutorizado = 0;

  if (
    estadoLiquidez === "CRITICA"
  ) {
    presupuestoCompraAutorizado = 0;
  } else {
    presupuestoCompraAutorizado =
      Math.max(
        0,
        Math.min(
          capacidadCompra,
          inversionInventario
        )
      );
  }

  const comprasAutorizadas = [];

  let presupuestoRestante =
    presupuestoCompraAutorizado;

  for (
    const producto of sugerenciasCompra
  ) {
    const inversion =
      convertirNumero(
        producto.inversionEstimada
      );

    if (
      inversion <= 0 ||
      presupuestoRestante <= 0
    ) {
      continue;
    }

    if (
      inversion <= presupuestoRestante
    ) {
      comprasAutorizadas.push({
        ...producto,
        estado:
          "AUTORIZADA",
      });

      presupuestoRestante -=
        inversion;
    }
  }

  const comprasPospuestas =
    sugerenciasCompra.filter(
      (producto) =>
        !comprasAutorizadas.some(
          (autorizada) =>
            autorizada.codigo ===
              producto.codigo &&
            autorizada.descripcion ===
              producto.descripcion
        )
    );

  // ======================================================
  // 3. DECISIONES EJECUTIVAS
  // ======================================================

  if (
    estadoLiquidez === "CRITICA"
  ) {
    decisiones.push({
      prioridad: "CRITICA",
      area: "Finanzas",
      titulo:
        "Detener nuevas compras",
      descripcion:
        vencimientos30Dias > 0
          ? `Existen ${formatoDinero(
              vencimientos30Dias
            )} en compromisos con proveedores dentro de los próximos 30 días. No se recomienda autorizar nuevas compras hasta proteger estas obligaciones.`
          : "La liquidez no permite autorizar nuevas compras en este momento.",
      impacto: "ALTO",
    });
  }

  if (
    estadoLiquidez === "AJUSTADA"
  ) {
    decisiones.push({
      prioridad: "ALTA",
      area: "Finanzas",
      titulo:
        "Comprar solo inventario prioritario",
      descripcion:
        `La liquidez está ajustada. Solo se autorizarán compras dentro de un presupuesto máximo de ${formatoDinero(
          presupuestoCompraAutorizado
        )}.`,
      impacto: "ALTO",
    });
  }

  if (
    comprasAutorizadas.length > 0
  ) {
    decisiones.push({
      prioridad: "ALTA",
      area: "Inventario",
      titulo:
        "Autorizar resurtido prioritario",
      descripcion:
        `Se autorizan ${comprasAutorizadas.length} productos por un total aproximado de ${formatoDinero(
          comprasAutorizadas.reduce(
            (total, producto) =>
              total +
              convertirNumero(
                producto.inversionEstimada
              ),
            0
          )
        )}.`,
      impacto: "ALTO",
    });
  }

  if (
    comprasPospuestas.length > 0
  ) {
    decisiones.push({
      prioridad: "MEDIA",
      area: "Inventario",
      titulo:
        "Posponer compras secundarias",
      descripcion:
        `Se posponen ${comprasPospuestas.length} productos para proteger liquidez y priorizar lo más urgente.`,
      impacto: "MEDIO",
    });
  }

  if (
    comercial?.indicadores
      ?.productoLider?.nombre
  ) {
    decisiones.push({
      prioridad: "MEDIA",
      area: "Comercial",
      titulo:
        "Proteger producto líder",
      descripcion:
        `${comercial.indicadores.productoLider.nombre} es el producto líder del periodo. Debe mantenerse disponible.`,
      impacto: "ALTO",
    });
  }

  if (
    margenUtilidad >= 35 &&
    utilidadTotal > 0
  ) {
    decisiones.push({
      prioridad: "BAJA",
      area: "Finanzas",
      titulo:
        "Conservar rentabilidad",
      descripcion:
        `El margen actual es de ${margenUtilidad.toFixed(
          2
        )}%. Evita descuentos o compras que deterioren innecesariamente este margen.`,
      impacto: "MEDIO",
    });
  }

  // ======================================================
  // 4. INTEGRAR ACCIONES DE LOS DIRECTORES
  // ======================================================

  for (
    const accion of accionesFinancieras
  ) {
    decisiones.push({
      prioridad:
        normalizarPrioridad(
          accion.prioridad
        ),

      area:
        "Director Financiero",

      titulo:
        accion.titulo,

      descripcion:
        accion.descripcion,

      impacto:
        accion.impacto || "MEDIO",
    });
  }

  for (
    const accion of accionesComerciales
  ) {
    decisiones.push({
      prioridad:
        normalizarPrioridad(
          accion.prioridad
        ),

      area:
        "Director Comercial",

      titulo:
        accion.titulo,

      descripcion:
        accion.descripcion,

      impacto:
        accion.impacto || "MEDIO",
    });
  }

  // ======================================================
  // 5. ORDENAR Y QUEDARSE CON LO MÁS IMPORTANTE
  // ======================================================

  decisiones.sort(
    (a, b) =>
      obtenerOrdenPrioridad(
        a.prioridad
      ) -
      obtenerOrdenPrioridad(
        b.prioridad
      )
  );

  const decisionesTop =
    decisiones.slice(0, 7);

  // ======================================================
  // 6. MENSAJE DEL CEO
  // ======================================================

  let estadoGeneral =
    "Operación estable";

  let mensajeCEO =
    "La operación se encuentra estable. Mantén el seguimiento diario y ejecuta las prioridades indicadas.";

  if (
    estadoLiquidez === "CRITICA"
  ) {
    if (
      vencimientos30Dias > 0 &&
      capacidadCompra <= 0
    ) {
      estadoGeneral =
        "Liquidez comprometida por obligaciones próximas";

      mensajeCEO =
        `Existen ${formatoDinero(
          vencimientos30Dias
        )} en compromisos con proveedores dentro de los próximos 30 días. No recomiendo autorizar nuevas compras hasta proteger estas obligaciones.`;
    } else {
      estadoGeneral =
        "Atención ejecutiva inmediata";

      mensajeCEO =
        "La prioridad principal es recuperar liquidez. No recomiendo nuevas compras hasta estabilizar el flujo de efectivo.";
    }
  } else if (
    estadoLiquidez === "AJUSTADA" &&
    comprasAutorizadas.length > 0
  ) {
    estadoGeneral =
      "Operación rentable con liquidez limitada";

    mensajeCEO =
      `La operación genera utilidad, pero el efectivo está comprometido. Autoriza únicamente ${comprasAutorizadas.length} compras prioritarias y pospón el resto.`;
  } else if (
    comprasAutorizadas.length > 0
  ) {
    estadoGeneral =
      "Operación favorable con oportunidad de resurtido";

    mensajeCEO =
      `Existe capacidad para atender ${comprasAutorizadas.length} necesidades prioritarias de inventario sin exceder el presupuesto recomendado.`;
  }

  return {
    nombre:
      "Director General IA",

    version:
      "1.0.0",

    estadoGeneral,

    mensajeCEO,

    estadoLiquidez,

    dineroDisponible,

    reservaRecomendada,

    capacidadCompra,

    vencimientos30Dias,

    inversionInventario,

    presupuestoCompraAutorizado,

    comprasAutorizadas,

    comprasPospuestas,

    decisiones:
      decisionesTop,

    resumen: {
      decisionesTotales:
        decisiones.length,

      decisionesMostradas:
        decisionesTop.length,

      comprasSolicitadas:
        sugerenciasCompra.length,

      comprasAutorizadas:
        comprasAutorizadas.length,

      comprasPospuestas:
        comprasPospuestas.length,
    },

    generadoEn:
      new Date().toISOString(),
  };
}