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

    presupuesto:
      Number(
        presupuesto || 0
      ),

    ventas_objetivo:
      Number(
        ventasObjetivo || 0
      ),

    utilidad_objetivo:
      Number(
        utilidadObjetivo || 0
      ),

    estrategia_ia:
      estrategiaIA || {},

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