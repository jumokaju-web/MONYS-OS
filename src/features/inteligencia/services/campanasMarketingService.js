import { supabase } from "../../../supabase";

import {
  obtenerUltimaImportacionVentas,
  obtenerUltimaImportacionInventario,
  obtenerUltimaImportacionUtilidadArticulos,
} from "../../dashboard/services/dashboardDataService";

import {
  calcularMetricasDashboard,
} from "../../dashboard/utils/dashboardMetrics";

import {
  analizarInventario,
} from "../analyzers/inventarioAnalyzer";

import {
  agruparVentasPorProducto,
} from "../directores/directorComercialIA";

// ======================================================
// MONYS OS
// MOTOR DE CRECIMIENTO Y CAMPAÑAS IA
// Servicio de campañas de marketing
// ======================================================

function normalizarTextoProducto(valor) {
  return String(valor ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function calcularCoincidenciaProducto(
  busqueda,
  producto
) {
  const consulta =
    normalizarTextoProducto(busqueda);

  const codigo =
    normalizarTextoProducto(
      producto?.codigo
    );

  const nombre =
    normalizarTextoProducto(
      producto?.nombre ??
        producto?.descripcion
    );

  if (!consulta) {
    return 0;
  }

  if (
    consulta === codigo ||
    consulta === nombre
  ) {
    return 100;
  }

  if (
    nombre.includes(consulta) ||
    codigo.includes(consulta)
  ) {
    return 92;
  }

  const palabras =
    consulta
      .split(" ")
      .filter(
        (palabra) =>
          palabra.length >= 2
      );

  if (palabras.length === 0) {
    return 0;
  }

  const coincidencias =
    palabras.filter(
      (palabra) =>
        nombre.includes(palabra) ||
        codigo.includes(palabra)
    ).length;

  if (
    coincidencias ===
    palabras.length
  ) {
    return 88;
  }

   return 0;
}

function localizarCoincidenciasProducto(
  productos,
  busqueda
) {
  return (
    Array.isArray(productos)
      ? productos
      : []
  )
    .map((producto) => ({
      producto,
      puntuacion:
        calcularCoincidenciaProducto(
          busqueda,
          producto
        ),
    }))
    .filter(
      (resultado) =>
        resultado.puntuacion >= 70
    )
    .sort(
      (a, b) =>
        b.puntuacion -
        a.puntuacion
    );
}

function obtenerAntiguedadDias(fecha) {
  if (!fecha) return null;

  const fechaValida = new Date(fecha);
  if (Number.isNaN(fechaValida.getTime())) {
    return null;
  }

  return Math.max(
    0,
    Math.floor((Date.now() - fechaValida.getTime()) / 86400000)
  );
}

export async function obtenerContextoRealProductoCampana({
  branchId = null,
  producto = "",
} = {}) {
  const productoBuscado =
    String(producto || "").trim();

  if (!branchId) {
    throw new Error(
      "Falta identificar la sucursal para consultar datos reales."
    );
  }

  if (!productoBuscado) {
    throw new Error(
      "Escribe el producto que deseas analizar."
    );
  }

  const [
    resultadoVentas,
    resultadoInventario,
    resultadoUtilidadArticulos,
  ] = await Promise.all([
    obtenerUltimaImportacionVentas(
      branchId
    ),

    obtenerUltimaImportacionInventario(
      branchId
    ),

    obtenerUltimaImportacionUtilidadArticulos(
      branchId
    ),
  ]);

  const ventasReales =
    resultadoVentas?.ventasReales || [];

  const ventasOriginales =
    resultadoVentas?.detalles || [];

  const ventas =
    ventasReales.length > 0
      ? ventasReales
      : ventasOriginales;

  const utilidadArticulos =
    resultadoUtilidadArticulos
      ?.utilidadArticulos || [];

  const inventario =
    resultadoInventario?.detalles || [];

   
  const metricas =
    calcularMetricasDashboard(
      ventas,
      []
    );

  const fechaCorteVentas =
    metricas?.fechaFinal ||
    resultadoVentas?.importacion?.created_at ||
    null;
  const fechaCargaInventario =
    resultadoInventario?.importacion?.created_at ||
    null;
  const diasMaximosDatosActuales = 7;
  const antiguedadVentasDias =
    obtenerAntiguedadDias(fechaCorteVentas);
  const antiguedadInventarioDias =
    obtenerAntiguedadDias(fechaCargaInventario);
  const actualizacionDatos = {
    diasMaximos: diasMaximosDatosActuales,
    ventas: {
      fecha: fechaCorteVentas,
      antiguedadDias: antiguedadVentasDias,
      vigente:
        antiguedadVentasDias !== null &&
        antiguedadVentasDias <= diasMaximosDatosActuales,
    },
    inventario: {
      fecha: fechaCargaInventario,
      antiguedadDias: antiguedadInventarioDias,
      vigente:
        antiguedadInventarioDias !== null &&
        antiguedadInventarioDias <= diasMaximosDatosActuales,
    },
  };
  actualizacionDatos.vigente =
    actualizacionDatos.ventas.vigente &&
    actualizacionDatos.inventario.vigente;

  const nombreArchivoPeriodo =
  resultadoUtilidadArticulos
    ?.importacion
    ?.archivo_original ||
  resultadoVentas
    ?.importacion
    ?.archivo_original ||
  "";

const coincidenciaPeriodo =
  String(nombreArchivoPeriodo).match(
    /(\d{1,2})\s*(?:al|-)\s*(\d{1,2})/i
  );

const diaInicial =
  Number(
    coincidenciaPeriodo?.[1] || 0
  );

const diaFinal =
  Number(
    coincidenciaPeriodo?.[2] || 0
  );

const diasDesdeArchivo =
  diaInicial > 0 &&
  diaFinal > 0
    ? diaFinal >= diaInicial
      ? diaFinal -
        diaInicial +
        1
      : 7
    : 0;

const diasAnalizados =
  Number(
    metricas?.diasAnalizados
  ) ||
  diasDesdeArchivo ||
  0;

  const productosComerciales =
    agruparVentasPorProducto(
      ventas
    );

  const productosRentables =
    agruparVentasPorProducto(
      utilidadArticulos
    );

  const analisisInventario =
    analizarInventario(
      inventario,
      {
        ventas,
        diasAnalizados,
        diasObjetivoInventario: 30,
      }
    );

  const productosInventario =
    analisisInventario?.productos ||
    [];

  const coincidenciasVentas =
    localizarCoincidenciasProducto(
      productosComerciales,
      productoBuscado
    );

  const coincidenciasRentabilidad =
    localizarCoincidenciasProducto(
      productosRentables,
      productoBuscado
    );

  const coincidenciasInventario =
    localizarCoincidenciasProducto(
      productosInventario,
      productoBuscado
    );

  const ventasCoincidentes =
    coincidenciasVentas.map(
      ({ producto: item }) =>
        item
    );

  const rentabilidadCoincidente =
    coincidenciasRentabilidad.map(
      ({ producto: item }) =>
        item
    );

  const inventarioCoincidente =
    coincidenciasInventario.map(
      ({ producto: item }) =>
        item
    );

  const resumenVentasBase =
    ventasCoincidentes.reduce(
      (acumulado, item) => ({
        piezas:
          acumulado.piezas +
          Number(item?.piezas || 0),

        importe:
          acumulado.importe +
          Number(item?.importe || 0),

        costo:
          acumulado.costo +
          Number(item?.costo || 0),

        utilidad:
          acumulado.utilidad +
          Number(item?.utilidad || 0),
      }),
      {
        piezas: 0,
        importe: 0,
        costo: 0,
        utilidad: 0,
      }
    );

  const resumenRentabilidad =
    rentabilidadCoincidente.reduce(
      (acumulado, item) => ({
        piezas:
          acumulado.piezas +
          Number(item?.piezas || 0),

        importe:
          acumulado.importe +
          Number(item?.importe || 0),

        costo:
          acumulado.costo +
          Number(item?.costo || 0),

        utilidad:
          acumulado.utilidad +
          Number(item?.utilidad || 0),
      }),
      {
        piezas: 0,
        importe: 0,
        costo: 0,
        utilidad: 0,
      }
    );

  const tieneRentabilidad =
    rentabilidadCoincidente.length >
    0;

    const resumenVentas = {
  piezas:
    tieneRentabilidad
      ? resumenRentabilidad.piezas
      : resumenVentasBase.piezas,

    importe:
      tieneRentabilidad
        ? resumenRentabilidad.importe
        : resumenVentasBase.importe,

    costo:
      tieneRentabilidad
        ? resumenRentabilidad.costo
        : resumenVentasBase.costo,

    utilidad:
      tieneRentabilidad
        ? resumenRentabilidad.utilidad
        : resumenVentasBase.utilidad,
  };

  const resumenInventario =
    inventarioCoincidente.reduce(
      (acumulado, item) => ({
        existencia:
          acumulado.existencia +
          Number(
            item?.existencia || 0
          ),

        valorInventario:
          acumulado.valorInventario +
          Number(
            item?.valorInventario || 0
          ),
      }),
      {
        existencia: 0,
        valorInventario: 0,
      }
    );

  const ventaDiaria =
    diasAnalizados > 0
      ? resumenVentas.piezas /
        diasAnalizados
      : 0;

  const diasCobertura =
    ventaDiaria > 0
      ? Math.max(
          0,
          resumenInventario.existencia
        ) / ventaDiaria
      : null;

  const margenReal =
    resumenVentas.importe > 0
      ? (
          resumenVentas.utilidad /
          resumenVentas.importe
        ) * 100
      : null;

  const mejorCoincidencia =
    Math.max(
      coincidenciasVentas[0]
        ?.puntuacion || 0,

      coincidenciasRentabilidad[0]
        ?.puntuacion || 0,

      coincidenciasInventario[0]
        ?.puntuacion || 0
    );

  const tieneVentas =
    ventasCoincidentes.length > 0;

  const tieneInventario =
    inventarioCoincidente.length > 0;

  const confianzaDatos =
    tieneVentas &&
    tieneInventario &&
    tieneRentabilidad
      ? 95
      : tieneVentas &&
        tieneInventario
      ? 90
      : tieneRentabilidad &&
        tieneInventario
      ? 85
      : tieneVentas ||
        tieneInventario ||
        tieneRentabilidad
      ? 65
      : 0;

  return {
    encontrado:
      tieneVentas ||
      tieneInventario ||
      tieneRentabilidad,

    productoBuscado,
    branchId,

    confianzaCoincidencia:
      mejorCoincidencia,

    confianzaDatos,

    actualizacionDatos,

    fuentes: {
      ventas:
        tieneVentas,

      inventario:
        tieneInventario,

      rentabilidad:
        tieneRentabilidad,

      usaVentasReales:
        ventasReales.length > 0,

      importacionVentasId:
        resultadoVentas
          ?.importacion?.id ||
        null,

      importacionInventarioId:
        resultadoInventario
          ?.importacion?.id ||
        null,

      importacionUtilidadArticulosId:
        resultadoUtilidadArticulos
          ?.importacion?.id ||
        null,
    },

    periodo: {
      fechaInicial:
        metricas?.fechaInicial ||
        null,

      fechaFinal:
        metricas?.fechaFinal ||
        null,

      diasAnalizados,
    },

     ventas: {
  ...resumenVentas,
  margenReal,

  variantes:
    tieneRentabilidad
      ? rentabilidadCoincidente
      : ventasCoincidentes,

  variantesHistoricas:
    ventasCoincidentes,

  variantesRentabilidad:
    rentabilidadCoincidente,
},

    inventario: {
      ...resumenInventario,
      ventaDiaria,
      diasCobertura,
      variantes:
        inventarioCoincidente,
    },
  };
}

// ======================================================
// MONYS GROWTH OS
// DETECTOR DE OPORTUNIDADES REALES
// ======================================================

export async function obtenerOportunidadesGrowthOS({
  branchId = null,
} = {}) {
  if (!branchId) {
    throw new Error(
      "Falta identificar la sucursal para detectar oportunidades."
    );
  }

  const [
    resultadoVentas,
    resultadoInventario,
    resultadoUtilidadArticulos,
  ] = await Promise.all([
    obtenerUltimaImportacionVentas(branchId),
    obtenerUltimaImportacionInventario(branchId),
    obtenerUltimaImportacionUtilidadArticulos(
      branchId
    ),
  ]);

  const ventasReales =
    resultadoVentas?.ventasReales || [];

  const ventasOriginales =
    resultadoVentas?.detalles || [];

  const ventas =
    ventasReales.length > 0
      ? ventasReales
      : ventasOriginales;

  const inventario =
    resultadoInventario?.detalles || [];

  const utilidadArticulos =
    resultadoUtilidadArticulos
      ?.utilidadArticulos || [];

  const metricas =
    calcularMetricasDashboard(
      ventas,
      []
    );

  const diasAnalizados =
    Number(
      metricas?.diasAnalizados || 0
    ) || 7;

  const fechaCorteVentas =
    metricas?.fechaFinal ||
    resultadoVentas?.importacion?.created_at ||
    null;
  const fechaCargaInventario =
    resultadoInventario?.importacion?.created_at ||
    null;
  const antiguedadVentasDias =
    obtenerAntiguedadDias(fechaCorteVentas);
  const antiguedadInventarioDias =
    obtenerAntiguedadDias(fechaCargaInventario);
  const diasMaximosDatosActuales = 7;
  const actualizacionDatos = {
    diasMaximos: diasMaximosDatosActuales,
    ventas: {
      fecha: fechaCorteVentas,
      antiguedadDias: antiguedadVentasDias,
      vigente:
        antiguedadVentasDias !== null &&
        antiguedadVentasDias <= diasMaximosDatosActuales,
    },
    inventario: {
      fecha: fechaCargaInventario,
      antiguedadDias: antiguedadInventarioDias,
      vigente:
        antiguedadInventarioDias !== null &&
        antiguedadInventarioDias <= diasMaximosDatosActuales,
    },
  };
  actualizacionDatos.vigente =
    actualizacionDatos.ventas.vigente &&
    actualizacionDatos.inventario.vigente;

  const productosVentas =
    agruparVentasPorProducto(
      ventas
    );

  const productosRentables =
    agruparVentasPorProducto(
      utilidadArticulos
    );

  const analisisInventario =
    analizarInventario(
      inventario,
      {
        ventas,
        diasAnalizados,
        diasObjetivoInventario: 30,
      }
    );

  const productosInventario =
    analisisInventario?.productos || [];

  const oportunidades =
    productosInventario
      .map((itemInventario) => {
        const referenciaProducto =
          String(
            itemInventario?.codigo ||
              itemInventario?.nombre ||
              itemInventario?.descripcion ||
              ""
          ).trim();

        if (!referenciaProducto) {
          return null;
        }

        const coincidenciaRentabilidad =
          localizarCoincidenciasProducto(
            productosRentables,
            referenciaProducto
          )[0]?.producto || null;

        const coincidenciaVentas =
          localizarCoincidenciasProducto(
            productosVentas,
            referenciaProducto
          )[0]?.producto || null;

        const datosVenta =
          coincidenciaRentabilidad ||
          coincidenciaVentas ||
          {};

        const existencia =
          Number(
            itemInventario?.existencia || 0
          );

        const valorInventario =
          Number(
            itemInventario?.valorInventario || 0
          );

        const piezasVendidas =
          Number(
            datosVenta?.piezas || 0
          );

        const importe =
          Number(
            datosVenta?.importe || 0
          );

        const utilidad =
          Number(
            datosVenta?.utilidad || 0
          );

        const ventaDiaria =
          diasAnalizados > 0
            ? piezasVendidas /
              diasAnalizados
            : 0;

        const diasCobertura =
          ventaDiaria > 0
            ? existencia /
              ventaDiaria
            : existencia > 0
            ? 999
            : 0;

        const margenReal =
          importe > 0
            ? (
                utilidad /
                importe
              ) * 100
            : null;

       let prioridad = 0;
const razones = [];

// COBERTURA: máximo 40 puntos.
// Mientras más días de inventario haya,
// mayor urgencia de revisar el producto.
const puntosCobertura =
  diasCobertura > 0
    ? Math.min(
        diasCobertura / 180,
        1
      ) * 40
    : 0;

prioridad += puntosCobertura;

if (diasCobertura >= 90) {
  razones.push(
    "Inventario con cobertura muy alta"
  );
} else if (diasCobertura >= 60) {
  razones.push(
    "Inventario por encima del objetivo"
  );
} else if (diasCobertura >= 45) {
  razones.push(
    "Cobertura elevada"
  );
}

// MARGEN: máximo 25 puntos.
// Premia oportunidades que todavía
// pueden dejar buena utilidad.
if (
  margenReal !== null &&
  margenReal > 0
) {
  const puntosMargen =
    Math.min(
      margenReal / 40,
      1
    ) * 25;

  prioridad += puntosMargen;

  if (margenReal >= 30) {
    razones.push(
      "Buen margen real"
    );
  } else if (margenReal >= 20) {
    razones.push(
      "Margen aprovechable"
    );
  }
}

// CAPITAL INMOVILIZADO: máximo 20 puntos.
// No vale igual tener $2,000 detenidos
// que $20,000 o más.
const puntosCapital =
  Math.min(
    valorInventario / 20000,
    1
  ) * 20;

prioridad += puntosCapital;

if (valorInventario >= 5000) {
  razones.push(
    "Capital importante inmovilizado"
  );
} else if (valorInventario >= 2000) {
  razones.push(
    "Inventario con valor relevante"
  );
}

// DEMANDA COMPROBADA: máximo 15 puntos.
// Para la primera recomendación de Growth no premiamos un producto
// únicamente por estar detenido. Las ventas observadas reducen el riesgo de
// preparar una campaña para algo que todavía no demostró demanda.
const puntosDemanda =
  piezasVendidas > 0
    ? Math.min(
        piezasVendidas / 30,
        1
      ) * 15
    : 0;

prioridad += puntosDemanda;

if (piezasVendidas >= 30) {
  razones.push(
    "Demanda comprobada con ventas reales"
  );
} else if (piezasVendidas > 0) {
  razones.push(
    "Registra ventas reales"
  );
} else if (existencia > 0) {
  razones.push(
    "Sin venta reciente: solo prueba orgánica pequeña"
  );
}

// Guardamos el puntaje limpio.
prioridad =
  Math.round(
    prioridad * 10
  ) / 10;

        return {
          codigo:
            itemInventario?.codigo ||
            null,

          nombre:
            itemInventario?.nombre ||
            itemInventario?.descripcion ||
            referenciaProducto,

          existencia,

          valorInventario,

          piezasVendidas,

          importe,

          utilidad,

          margenReal,

          ventaDiaria,

          diasCobertura,

          diasAnalizados,

          actualizacionDatos,

          prioridad,

          tipoOportunidad:
            piezasVendidas > 0
              ? "ROTACION_CON_DEMANDA"
              : "PRUEBA_DEMANDA",

          confianzaDatos:
            coincidenciaRentabilidad &&
            coincidenciaVentas
              ? "ALTA"
              : piezasVendidas > 0
              ? "MEDIA"
              : "BAJA",

          requierePruebaOrganica:
            piezasVendidas === 0,

          razones,

          fuente: {
            ventas:
              Boolean(
                coincidenciaVentas
              ),

            rentabilidad:
              Boolean(
                coincidenciaRentabilidad
              ),

            inventario: true,
          },
        };
      })
      .filter(
        (item) =>
          item &&
          item.existencia > 0
      )
      .sort(
        (a, b) =>
          b.prioridad -
          a.prioridad
      );

  return {
    branchId,

    diasAnalizados,

    totalProductosAnalizados:
      oportunidades.length,

    oportunidades:
      oportunidades.slice(
        0,
        10
      ),
  };
}

// ======================================================
// MONYS OS
// MOTOR DE CRECIMIENTO Y CAMPAÑAS IA
// Servicio de campañas de marketing
// ======================================================


// ======================================================
// CREAR CAMPAÑA
// ======================================================

export async function crearCampanaMarketing({
  organizationId = null,
  businessId = null,
  branchId = null,

  nombre,
  objetivo,

  canalPrincipal = "",
  producto = "",

  problemaOportunidad = "",
  hipotesis = "",

  audiencia = "",
  oferta = "",

  gancho = "",
  mensaje = "",
  cta = "",

  presupuesto = 0,

  ventasObjetivo = 0,
  utilidadObjetivo = 0,

  estrategiaIA = {},
  simulacionIA = {},

  confianzaIA = 0,
  decisionIA = "",

  fechaInicio = null,
  fechaFin = null,
} = {}) {
  if (!String(nombre || "").trim()) {
    throw new Error(
      "La campaña necesita un nombre."
    );
  }

  if (!String(objetivo || "").trim()) {
    throw new Error(
      "La campaña necesita un objetivo."
    );
  }

  const presupuestoPropuesto = Number(presupuesto || 0);

  if (
    !Number.isFinite(presupuestoPropuesto) ||
    presupuestoPropuesto < 0
  ) {
    throw new Error(
      "El presupuesto propuesto debe ser un número válido y no puede ser negativo."
    );
  }

  const estrategiaNormalizada =
    estrategiaIA && typeof estrategiaIA === "object"
      ? estrategiaIA
      : {};

  const nuevaCampana = {
    organization_id:
      organizationId || null,

    business_id:
      businessId || null,

    branch_id:
      branchId || null,

    nombre:
      String(nombre).trim(),

    objetivo:
      String(objetivo)
        .trim()
        .toUpperCase(),

    estado: "BORRADOR",

    canal_principal:
      String(
        canalPrincipal || ""
      ).trim() || null,

    producto:
      String(
        producto || ""
      ).trim() || null,

    problema_oportunidad:
      String(
        problemaOportunidad || ""
      ).trim() || null,

    hipotesis:
      String(
        hipotesis || ""
      ).trim() || null,

    audiencia:
      String(
        audiencia || ""
      ).trim() || null,

    oferta:
      String(
        oferta || ""
      ).trim() || null,

    gancho:
      String(
        gancho || ""
      ).trim() || null,

    mensaje:
      String(
        mensaje || ""
      ).trim() || null,

    cta:
      String(
        cta || ""
      ).trim() || null,

    presupuesto: 0,

    ventas_objetivo:
      Number(
        ventasObjetivo || 0
      ),

    utilidad_objetivo:
      Number(
        utilidadObjetivo || 0
      ),

    estrategia_ia: {
      ...estrategiaNormalizada,
      controlFinanciero: {
        ...(estrategiaNormalizada.controlFinanciero || {}),
        presupuestoPropuesto,
        presupuestoAutorizado: 0,
        estadoAutorizacion:
          presupuestoPropuesto > 0
            ? "PENDIENTE_MONICA"
            : "SIN_GASTO_PROPUESTO",
        requiereAutorizacion:
          presupuestoPropuesto > 0,
      },
    },

    simulacion_ia:
      simulacionIA || {},

    confianza_ia:
      Number(
        confianzaIA || 0
      ),

    decision_ia:
      String(
        decisionIA || ""
      ).trim() || null,

    fecha_inicio:
      fechaInicio || null,

    fecha_fin:
      fechaFin || null,

    updated_at:
      new Date().toISOString(),
  };

  const {
    data,
    error,
  } = await supabase
    .from(
      "campanas_marketing"
    )
    .insert(
      nuevaCampana
    )
    .select()
    .single();

  if (error) {
    console.error(
      "Error creando campaña:",
      error
    );

    throw new Error(
      "MONYS no pudo crear la campaña."
    );
  }

  return data;
}


// ======================================================
// OBTENER CAMPAÑAS
// ======================================================

export async function obtenerCampanasMarketing({
  organizationId = null,
  businessId = null,
  branchId = null,
} = {}) {
  let consulta =
    supabase
      .from(
        "campanas_marketing"
      )
      .select("*")
      .order(
        "created_at",
        {
          ascending: false,
        }
      );

  if (organizationId) {
    consulta =
      consulta.eq(
        "organization_id",
        organizationId
      );
  }

  if (businessId) {
    consulta =
      consulta.eq(
        "business_id",
        businessId
      );
  }

  if (branchId) {
    consulta =
      consulta.eq(
        "branch_id",
        branchId
      );
  }

  const {
    data,
    error,
  } = await consulta;

  if (error) {
    console.error(
      "Error obteniendo campañas:",
      error
    );

    throw new Error(
      "MONYS no pudo obtener las campañas."
    );
  }

  return data || [];
}


// ======================================================
// OBTENER UNA CAMPAÑA
// ======================================================

export async function obtenerCampanaMarketing(
  campanaId
) {
  if (!campanaId) {
    throw new Error(
      "Falta identificar la campaña."
    );
  }

  const {
    data,
    error,
  } = await supabase
    .from(
      "campanas_marketing"
    )
    .select("*")
    .eq(
      "id",
      campanaId
    )
    .single();

  if (error) {
    console.error(
      "Error obteniendo campaña:",
      error
    );

    throw new Error(
      "MONYS no pudo obtener la campaña."
    );
  }

  return data;
}


// ======================================================
// ACTUALIZAR CAMPAÑA
// ======================================================

export async function actualizarCampanaMarketing(
  campanaId,
  cambios = {}
) {
  if (!campanaId) {
    throw new Error(
      "Falta identificar la campaña."
    );
  }

  const {
    data,
    error,
  } = await supabase
    .from(
      "campanas_marketing"
    )
    .update({
      ...cambios,

      updated_at:
        new Date().toISOString(),
    })
    .eq(
      "id",
      campanaId
    )
    .select()
    .single();

  if (error) {
    console.error(
      "Error actualizando campaña:",
      error
    );

    throw new Error(
      "MONYS no pudo actualizar la campaña."
    );
  }

  return data;
}


// ======================================================
// GUARDAR RESULTADO Y APRENDIZAJE
// ======================================================

export async function guardarAprendizajeCampana({
  campanaId,
  resultado = {},
  aprendizaje = {},
  analisisIA = {},
  decisionIA = "",
  confianzaIA = 0,
} = {}) {
  if (!campanaId) {
    throw new Error(
      "Falta identificar la campaña."
    );
  }

  const {
    data,
    error,
  } = await supabase
    .from(
      "campanas_marketing"
    )
    .update({
      resultado:
        resultado || {},

      aprendizaje:
        aprendizaje || {},

      analisis_ia:
        analisisIA || {},

      decision_ia:
        String(
          decisionIA || ""
        ).trim() || null,

      confianza_ia:
        Number(
          confianzaIA || 0
        ),

      updated_at:
        new Date().toISOString(),
    })
    .eq(
      "id",
      campanaId
    )
    .select()
    .single();

  if (error) {
    console.error(
      "Error guardando aprendizaje:",
      error
    );

    throw new Error(
      "MONYS no pudo guardar el aprendizaje de la campaña."
    );
  }

  return data;
}

// ======================================================
// GENERAR ESTRATEGIA DE CAMPAÑA CON IA
// ======================================================

export async function generarEstrategiaCampanaIA({
  objetivoUsuario = "",
  producto = "",
  canalPreferido = "",
  presupuestoMaximo = 0,
  inventarioDisponible = 0,
  margenEstimado = 0,
  contextoNegocio = "",
  datosVentas = "",
  datosInventario = "",
 canalesNegocio = "",
  notas = "",
} = {}) {
  if (
    !String(
      objetivoUsuario || ""
    ).trim()
  ) {
    throw new Error(
      "Escribe qué quieres lograr con la campaña."
    );
  }

  const {
    data,
    error,
  } = await supabase.functions.invoke(
    "crear-campana-marketing",
    {
      body: {
        objetivoUsuario,
        producto,
        canalPreferido,
        presupuestoMaximo:
          Number(
            presupuestoMaximo || 0
          ),
        inventarioDisponible:
          Number(
            inventarioDisponible || 0
          ),
        margenEstimado:
          Number(
            margenEstimado || 0
          ),
          contextoNegocio,
datosVentas,
datosInventario,
canalesNegocio,
notas,
      },
    }
  );

  if (error) {
    console.error(
      "Error generando estrategia de campaña:",
      error
    );

    throw new Error(
      "MONYS no pudo generar la estrategia de campaña."
    );
  }

  if (!data?.ok) {
    throw new Error(
      data?.error ||
        "MONYS no pudo completar la estrategia."
    );
  }

  if (!data?.estrategia) {
    throw new Error(
      "MONYS no devolvió una estrategia válida."
    );
  }

  return data.estrategia;
}

export async function analizarCampanaFinalizadaIA({
  campana = {},
  resultado = {},
  aprendizajeBase = {},
} = {}) {
  const historial =
    Array.isArray(
      resultado?.historial
    )
      ? resultado.historial
      : [];

  if (historial.length === 0) {
    throw new Error(
      "La campaña no tiene avances reales para analizar."
    );
  }

  const {
    data,
    error,
  } = await supabase.functions.invoke(
    "analizar-campana-marketing",
    {
      body: {
        campana,
        resultado,
        aprendizajeBase,
      },
    }
  );

  if (error) {
    console.error(
      "Error analizando campaña finalizada:",
      error
    );

    throw new Error(
      "MONYS no pudo analizar el aprendizaje de la campaña."
    );
  }

  if (!data?.ok) {
    throw new Error(
      data?.error ||
        "MONYS no pudo completar el análisis de la campaña."
    );
  }

  if (!data?.analisis) {
    throw new Error(
      "MONYS no devolvió un aprendizaje válido."
    );
  }

  return data.analisis;
}

export async function generarKitMarketingIA({
  negocio = {},
  producto = {},
  estrategia = {},
  campana = {},
  canales,
  resultadosAnteriores = {},
  notas = "",
  datosReales = {},
} = {}) {
  const nombreProducto =
    String(producto?.nombre || "").trim();

  const objetivo =
    String(estrategia?.objetivo || "").trim();

  if (!nombreProducto) {
    throw new Error(
      "Falta indicar el producto."
    );
  }

  if (!objetivo) {
    throw new Error(
      "Falta indicar el objetivo."
    );
  }

  const { data, error } =
    await supabase.functions.invoke(
      "generar-kit-marketing",
      {
        body: {
          negocio,

          producto: {
            ...producto,
            nombre: nombreProducto,
            precio: Number(
              producto?.precio || 0
            ),
            existencia: Number(
              producto?.existencia || 0
            ),
          },

          estrategia: {
            ...estrategia,
            objetivo,
            audiencia: String(
              estrategia?.audiencia || ""
            ).trim(),
            oferta: String(
              estrategia?.oferta || ""
            ).trim(),
          },

          campana,

          canales,

          resultadosAnteriores,

          notas,

          datosReales,
        },
      }
    );

  if (error) {
    console.error(
      "Error generando kit de marketing:",
      error
    );

    throw new Error(
      "MONYS no pudo generar el kit de publicación."
    );
  }

  if (!data?.ok) {
    throw new Error(
      data?.error ||
        "MONYS no pudo completar el kit."
    );
  }

  if (!data?.kit && !data?.listo) {
    throw new Error(
      data?.mensaje ||
        "MONYS no devolvió un kit válido."
    );
  }

  return data?.kit || data;
}
