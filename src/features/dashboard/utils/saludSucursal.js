function convertirNumero(valor) {
  const numero = Number(valor);

  return Number.isFinite(numero)
    ? numero
    : 0;
}

function redondear(
  valor,
  decimales = 2
) {
  const factor =
    10 ** decimales;

  return (
    Math.round(
      convertirNumero(valor) *
        factor
    ) / factor
  );
}

function calcularPorcentaje(
  cantidad,
  total
) {
  const cantidadNumero =
    convertirNumero(cantidad);

  const totalNumero =
    convertirNumero(total);

  if (totalNumero <= 0) {
    return 0;
  }

  return (
    cantidadNumero /
    totalNumero
  ) * 100;
}

function crearResultadoBase({
  estado = "por_evaluar",
  nivel = "neutral",
  titulo = "Por evaluar",
  mensaje = "",
  causas = [],
  indicadores = {},
  confianza = 0,
} = {}) {
  return {
    estado,
    nivel,
    titulo,
    mensaje,
    causas,
    indicadores,
    confianza,
  };
}

/*
 * =====================================================
 * MONYS OS
 * MOTOR DE SALUD DE SUCURSAL
 * =====================================================
 *
 * PRINCIPIO:
 *
 * DATOS
 * → VALIDAR
 * → ANALIZAR
 * → EXPLICAR
 * → SEMÁFORO
 *
 * MONYS no debe declarar que una sucursal está mal
 * solamente porque vende menos que otra.
 *
 * La salud se construye principalmente con:
 *
 * 1. datos financieros válidos,
 * 2. historial de la propia sucursal,
 * 3. metas,
 * 4. inventario analizado por MONYS,
 * 5. riesgos operativos.
 *
 * Si todavía no hay evidencia suficiente,
 * la respuesta correcta es:
 *
 * "Construyendo línea base".
 */

export function evaluarSaludSucursal(
  sucursal = {},
  opciones = {}
) {
  /*
   * ===================================================
   * FINANZAS
   * ===================================================
   */

  const ventasTotales =
    convertirNumero(
      sucursal?.ventasTotales
    );

  const costoTotal =
    convertirNumero(
      sucursal?.costoTotal
    );

  const utilidadTotal =
    convertirNumero(
      sucursal?.utilidadTotal
    );

  const diasAnalizados =
    convertirNumero(
      sucursal?.diasAnalizados
    );

  const ventaPromedioDiaria =
    convertirNumero(
      sucursal?.ventaPromedioDiaria
    );

  const productosInventario =
    convertirNumero(
      sucursal?.productosInventario
    );

  const margenUtilidad =
    ventasTotales > 0
      ? (
          utilidadTotal /
          ventasTotales
        ) * 100
      : 0;

  /*
   * ===================================================
   * INVENTARIO INTELIGENTE
   * ===================================================
   *
   * IMPORTANTE:
   *
   * Estos datos YA vienen analizados por
   * inventarioAnalyzer.js.
   *
   * No volvemos a interpretar cantidad === 0
   * como problema automáticamente.
   */

  const resumenInventario =
    sucursal?.resumenInventario ||
    {};

  const totalProductosAnalizados =
    convertirNumero(
      resumenInventario.totalProductos
    ) ||
    productosInventario;

  const productosConExistencia =
    convertirNumero(
      resumenInventario
        .productosConExistencia
    );

  const productosNegativos =
    convertirNumero(
      resumenInventario
        .productosNegativos
    );

  const productosCriticos =
    convertirNumero(
      resumenInventario
        .productosCriticos
    );

  const productosBajos =
    convertirNumero(
      resumenInventario
        .productosBajos
    );

  const productosAgotados =
    convertirNumero(
      resumenInventario
        .productosAgotados
    );

  const productosSaludables =
    convertirNumero(
      resumenInventario
        .productosSaludables
    );

  const productosSobreinventario =
    convertirNumero(
      resumenInventario
        .productosSobreinventario
    );

  const productosSinRotacion =
    convertirNumero(
      resumenInventario
        .productosSinRotacion
    );

  const existenciaTotal =
    convertirNumero(
      resumenInventario
        .existenciaTotal
    );

  const valorInventario =
    convertirNumero(
      resumenInventario
        .valorInventario
    );

  /*
   * ===================================================
   * HISTÓRICO / METAS
   * ===================================================
   */

  const promedioHistoricoDiario =
    convertirNumero(
      opciones
        ?.promedioHistoricoDiario
    );

  const margenObjetivo =
    convertirNumero(
      opciones?.margenObjetivo
    );

  const tieneHistorico =
    promedioHistoricoDiario > 0;

  const tieneObjetivoMargen =
    margenObjetivo > 0;

  const tieneResumenInventario =
    totalProductosAnalizados > 0;

  const causas = [];

  /*
   * ===================================================
   * 1. VALIDACIÓN DE DATOS
   * ===================================================
   */

  if (
    !sucursal ||
    sucursal?.tieneDatos === false
  ) {
    return crearResultadoBase({
      estado: "sin_datos",
      nivel: "neutral",
      titulo: "Sin datos",

      mensaje:
        "MONYS todavía no tiene información suficiente para evaluar esta sucursal.",

      causas: [
        "Faltan reportes suficientes.",
      ],

      confianza: 0,
    });
  }

  if (diasAnalizados <= 0) {
    causas.push(
      "No existe un periodo válido de análisis."
    );
  }

  if (ventasTotales <= 0) {
    causas.push(
      "No existen ventas monetarias válidas para el periodo."
    );
  }

  if (
    diasAnalizados <= 0 ||
    ventasTotales <= 0
  ) {
    return crearResultadoBase({
      estado: "datos_incompletos",
      nivel: "neutral",
      titulo: "Datos incompletos",

      mensaje:
        "MONYS detectó que todavía faltan datos confiables antes de asignar un semáforo.",

      causas,

      indicadores: {
        ventasTotales:
          redondear(
            ventasTotales
          ),

        utilidadTotal:
          redondear(
            utilidadTotal
          ),

        diasAnalizados,

        productosInventario,
      },

      confianza: 20,
    });
  }

  /*
   * ===================================================
   * 2. INDICADORES
   * ===================================================
   */

  const porcentajeNegativos =
    calcularPorcentaje(
      productosNegativos,
      totalProductosAnalizados
    );

  const porcentajeCriticos =
    calcularPorcentaje(
      productosCriticos,
      totalProductosAnalizados
    );

  const porcentajeBajos =
    calcularPorcentaje(
      productosBajos,
      totalProductosAnalizados
    );

  const porcentajeAgotados =
    calcularPorcentaje(
      productosAgotados,
      totalProductosAnalizados
    );

  const porcentajeSobreinventario =
    calcularPorcentaje(
      productosSobreinventario,
      totalProductosAnalizados
    );

  const porcentajeSinRotacion =
    calcularPorcentaje(
      productosSinRotacion,
      totalProductosAnalizados
    );

  const indicadores = {
    ventasTotales:
      redondear(
        ventasTotales
      ),

    costoTotal:
      redondear(
        costoTotal
      ),

    utilidadTotal:
      redondear(
        utilidadTotal
      ),

    margenUtilidad:
      redondear(
        margenUtilidad
      ),

    diasAnalizados,

    ventaPromedioDiaria:
      redondear(
        ventaPromedioDiaria
      ),

    productosInventario,

    totalProductosAnalizados,

    productosConExistencia,

    productosNegativos,

    productosCriticos,

    productosBajos,

    productosAgotados,

    productosSaludables,

    productosSobreinventario,

    productosSinRotacion,

    existenciaTotal,

    valorInventario:
      redondear(
        valorInventario
      ),

    porcentajeNegativos:
      redondear(
        porcentajeNegativos
      ),

    porcentajeCriticos:
      redondear(
        porcentajeCriticos
      ),

    porcentajeBajos:
      redondear(
        porcentajeBajos
      ),

    porcentajeAgotados:
      redondear(
        porcentajeAgotados
      ),

    porcentajeSobreinventario:
      redondear(
        porcentajeSobreinventario
      ),

    porcentajeSinRotacion:
      redondear(
        porcentajeSinRotacion
      ),
  };

  /*
   * ===================================================
   * 3. RIESGO DE INVENTARIO
   * ===================================================
   *
   * Usamos porcentajes para evitar el error de:
   *
   * "hay muchos productos"
   * = automáticamente crítico.
   *
   * 40 productos de 100
   * no significan lo mismo que
   * 40 productos de 4,000.
   */

  let puntosRiesgoInventario = 0;

  let riesgoInventarioSevero =
    false;

  const causasInventario = [];

  /*
   * INVENTARIO NEGATIVO
   */

  if (productosNegativos > 0) {
    if (
      productosNegativos >= 5 ||
      porcentajeNegativos >= 1
    ) {
      puntosRiesgoInventario += 3;

      riesgoInventarioSevero =
        true;
    } else {
      puntosRiesgoInventario += 2;
    }

    causasInventario.push(
      `${productosNegativos} productos tienen inventario negativo y requieren revisión física.`
    );
  }

  /*
   * COBERTURA CRÍTICA
   */

  if (productosCriticos > 0) {
    if (porcentajeCriticos >= 15) {
      puntosRiesgoInventario += 3;

      riesgoInventarioSevero =
        true;
    } else if (
      porcentajeCriticos >= 7
    ) {
      puntosRiesgoInventario += 2;
    } else if (
      porcentajeCriticos >= 2
    ) {
      puntosRiesgoInventario += 1;
    }

    causasInventario.push(
      `${productosCriticos} productos tienen cobertura crítica.`
    );
  }

  /*
   * AGOTADOS
   */

  if (productosAgotados > 0) {
    if (porcentajeAgotados >= 20) {
      puntosRiesgoInventario += 3;

      riesgoInventarioSevero =
        true;
    } else if (
      porcentajeAgotados >= 10
    ) {
      puntosRiesgoInventario += 2;
    } else if (
      porcentajeAgotados >= 3
    ) {
      puntosRiesgoInventario += 1;
    }

    causasInventario.push(
      `${productosAgotados} productos están clasificados como agotados.`
    );
  }

  /*
   * INVENTARIO BAJO
   */

  if (
    productosBajos > 0 &&
    porcentajeBajos >= 10
  ) {
    puntosRiesgoInventario += 1;

    causasInventario.push(
      `${productosBajos} productos presentan inventario bajo.`
    );
  }

  /*
   * SOBREINVENTARIO
   */

  if (productosSobreinventario > 0) {
    if (
      porcentajeSobreinventario >= 25
    ) {
      puntosRiesgoInventario += 2;
    } else if (
      porcentajeSobreinventario >= 10
    ) {
      puntosRiesgoInventario += 1;
    }

    causasInventario.push(
      `${productosSobreinventario} productos presentan sobreinventario.`
    );
  }

  /*
   * SIN ROTACIÓN
   */

  if (
    productosSinRotacion > 0 &&
    porcentajeSinRotacion >= 30
  ) {
    puntosRiesgoInventario += 1;

    causasInventario.push(
      `${productosSinRotacion} productos no muestran rotación suficiente.`
    );
  }

  /*
   * ===================================================
   * 4. LÍNEA BASE
   * ===================================================
   *
   * Si todavía no existe histórico financiero ni
   * objetivo de margen:
   *
   * - NO ponemos verde.
   * - NO ponemos rojo salvo evidencia severa.
   * - Sí podemos poner naranja cuando el inventario
   *   inteligente detecta un riesgo significativo.
   */

  if (
  !tieneHistorico &&
  !tieneObjetivoMargen
) {
  if (
    tieneResumenInventario &&
    puntosRiesgoInventario >= 2
  ) {
    return crearResultadoBase({
      estado:
        "requiere_atencion",

      nivel:
        "naranja",

      titulo:
        "Requiere atención",

      mensaje:
        "MONYS detectó señales reales de inventario que conviene atender mientras construye la línea base financiera.",

      causas:
        causasInventario,

      indicadores,

      confianza: 65,
    });
  }

  return crearResultadoBase({
    estado:
      "por_evaluar",

    nivel:
      "neutral",

    titulo:
      "Construyendo línea base",

    mensaje:
      "Los datos actuales son válidos, pero MONYS necesita más histórico financiero antes de declarar la salud completa de esta sucursal.",

    causas: [
      "Primera línea base financiera disponible.",
      "Falta comparar contra semanas anteriores.",
      ...causasInventario,
    ],

    indicadores,

    confianza: 60,
  });
}

  /*
   * ===================================================
   * 5. COMPARACIÓN HISTÓRICA
   * ===================================================
   */

  let variacionVentas = null;

  if (tieneHistorico) {
    variacionVentas =
      (
        (
          ventaPromedioDiaria -
          promedioHistoricoDiario
        ) /
        promedioHistoricoDiario
      ) * 100;

    indicadores.variacionVentas =
      redondear(
        variacionVentas
      );

    indicadores
      .promedioHistoricoDiario =
      redondear(
        promedioHistoricoDiario
      );
  }

  /*
   * ===================================================
   * 6. META DE MARGEN
   * ===================================================
   */

  let diferenciaMargen = null;

  if (tieneObjetivoMargen) {
    diferenciaMargen =
      margenUtilidad -
      margenObjetivo;

    indicadores.margenObjetivo =
      redondear(
        margenObjetivo
      );

    indicadores.diferenciaMargen =
      redondear(
        diferenciaMargen
      );
  }

  /*
   * ===================================================
   * 7. PUNTUACIÓN GENERAL
   * ===================================================
   */

  let puntosRiesgo =
    puntosRiesgoInventario;

  let puntosPositivos = 0;

  causas.push(
    ...causasInventario
  );

  /*
   * VENTAS VS HISTÓRICO
   */

  if (
    variacionVentas !== null
  ) {
    if (
      variacionVentas <= -20
    ) {
      puntosRiesgo += 3;

      causas.push(
        `Ventas promedio bajaron ${Math.abs(
          redondear(
            variacionVentas
          )
        )}% contra su referencia.`
      );
    } else if (
      variacionVentas <= -10
    ) {
      puntosRiesgo += 2;

      causas.push(
        `Ventas promedio bajaron ${Math.abs(
          redondear(
            variacionVentas
          )
        )}% contra su referencia.`
      );
    } else if (
      variacionVentas < 0
    ) {
      puntosRiesgo += 1;

      causas.push(
        "Las ventas están ligeramente debajo de su referencia."
      );
    } else if (
      variacionVentas >= 10
    ) {
      puntosPositivos += 2;

      causas.push(
        `Ventas promedio crecieron ${redondear(
          variacionVentas
        )}%.`
      );
    } else {
      puntosPositivos += 1;

      causas.push(
        "Las ventas están estables contra su referencia."
      );
    }
  }

  /*
   * MARGEN VS META
   */

  if (
    diferenciaMargen !== null
  ) {
    if (
      diferenciaMargen <= -5
    ) {
      puntosRiesgo += 3;

      causas.push(
        "El margen está significativamente debajo del objetivo."
      );
    } else if (
      diferenciaMargen < 0
    ) {
      puntosRiesgo += 1;

      causas.push(
        "El margen está ligeramente debajo del objetivo."
      );
    } else {
      puntosPositivos += 2;

      causas.push(
        "El margen cumple o supera el objetivo."
      );
    }
  }

  /*
   * ===================================================
   * 8. RESULTADO FINAL
   * ===================================================
   */

  if (puntosRiesgo >= 5) {
    return crearResultadoBase({
      estado: "critica",
      nivel: "rojo",
      titulo: "Crítica",

      mensaje:
        "MONYS detectó una combinación de señales que requiere atención prioritaria.",

      causas,

      indicadores,

      confianza: 85,
    });
  }

  if (puntosRiesgo >= 2) {
    return crearResultadoBase({
      estado:
        "requiere_atencion",

      nivel: "naranja",

      titulo:
        "Requiere atención",

      mensaje:
        "MONYS detectó desviaciones que conviene corregir antes de que aumenten.",

      causas,

      indicadores,

      confianza: 80,
    });
  }

  if (
    puntosPositivos >= 2 &&
    puntosRiesgo === 0
  ) {
    return crearResultadoBase({
      estado: "bajo_control",
      nivel: "verde",

      titulo:
        "Bajo control",

      mensaje:
        "Los indicadores disponibles están dentro de parámetros saludables.",

      causas,

      indicadores,

      confianza: 80,
    });
  }

  return crearResultadoBase({
    estado: "por_evaluar",
    nivel: "neutral",

    titulo: "Por evaluar",

    mensaje:
      "MONYS tiene información válida, pero todavía no existe evidencia suficiente para clasificar esta sucursal con seguridad.",

    causas,

    indicadores,

    confianza: 65,
  });
}

export default evaluarSaludSucursal;