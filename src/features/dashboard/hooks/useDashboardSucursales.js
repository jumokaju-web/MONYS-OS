import {
  useCallback,
  useEffect,
  useState,
} from "react";

import {
  useUser,
} from "../../../context/UserContext";

import { supabase } from "../../../supabase";

import {
  obtenerUltimaImportacionVentas,
  obtenerUltimaImportacionInventario,
  obtenerUltimaImportacionUtilidadVentas,
} from "../services/dashboardDataService";

import {
  calcularMetricasDashboard,
} from "../utils/dashboardMetrics";

import {
  evaluarSaludSucursal,
} from "../utils/saludSucursal";

import {
  analizarInventario,
} from "../../inteligencia/analyzers/inventarioAnalyzer";

function convertirNumero(valor) {
  if (
    valor === null ||
    valor === undefined ||
    valor === ""
  ) {
    return 0;
  }

  if (typeof valor === "number") {
    return Number.isFinite(valor)
      ? valor
      : 0;
  }

  let texto = String(valor).trim();

  if (!texto) {
    return 0;
  }

  const negativo =
    texto.startsWith("(") &&
    texto.endsWith(")");

  texto = texto
    .replace(/\$/g, "")
    .replace(/,/g, "")
    .replace(/\s/g, "")
    .replace(/[()]/g, "");

  const numero = Number(texto);

  if (!Number.isFinite(numero)) {
    return 0;
  }

  return negativo
    ? -numero
    : numero;
}

 function convertirFechaValida(valor) {
  if (
    valor === null ||
    valor === undefined ||
    valor === ""
  ) {
    return null;
  }

  const numero =
    Number(valor);

  // Fechas seriales de Excel / SICAR
  if (
    Number.isFinite(numero) &&
    numero > 20000 &&
    numero < 100000
  ) {
    const milisegundosDia =
      24 * 60 * 60 * 1000;

    const fechaExcel =
      new Date(
        Math.round(
          (numero - 25569) *
          milisegundosDia
        )
      );

    if (
      !Number.isNaN(
        fechaExcel.getTime()
      )
    ) {
      return fechaExcel;
    }
  }

  const fecha =
    new Date(valor);

  if (
    Number.isNaN(
      fecha.getTime()
    )
  ) {
    return null;
  }

  return fecha;
}

function obtenerPeriodoDesdeDetalles(
  detalles = []
) {
  for (const detalle of detalles) {
    const datosOriginales =
      detalle?.datos_originales || {};

    const fechaInicio =
      convertirFechaValida(
        datosOriginales.periodoInicio
      );

    const fechaFin =
      convertirFechaValida(
        datosOriginales.periodoFin
      );

    if (
      !fechaInicio ||
      !fechaFin
    ) {
      continue;
    }

    const milisegundosDia =
      1000 * 60 * 60 * 24;

    const diasAnalizados =
      Math.floor(
        (
          fechaFin.getTime() -
          fechaInicio.getTime()
        ) / milisegundosDia
      ) + 1;

    if (
      diasAnalizados <= 0
    ) {
      continue;
    }

    return {
      fechaInicial:
        datosOriginales.periodoInicio,

      fechaFinal:
        datosOriginales.periodoFin,

      diasAnalizados,
    };
  }

  return null;
}

function obtenerPeriodoUtilidad(
  detalles = []
) {
  const fechas = detalles
    .map((detalle) => {
      const datosOriginales =
        detalle?.datos_originales || {};

      return convertirFechaValida(
        datosOriginales.fecha
      );
    })
    .filter(Boolean)
    .sort(
      (a, b) =>
        a.getTime() -
        b.getTime()
    );

  if (fechas.length === 0) {
    return null;
  }

  const fechaInicial =
    fechas[0];

  const fechaFinal =
    fechas[
      fechas.length - 1
    ];

  const milisegundosDia =
    1000 * 60 * 60 * 24;

  const diasAnalizados =
    Math.floor(
      (
        fechaFinal.getTime() -
        fechaInicial.getTime()
      ) / milisegundosDia
    ) + 1;

  return {
    fechaInicial:
      fechaInicial
        .toISOString()
        .slice(0, 10),

    fechaFinal:
      fechaFinal
        .toISOString()
        .slice(0, 10),

    diasAnalizados:
      diasAnalizados > 0
        ? diasAnalizados
        : 1,
  };
}

function calcularDineroDesdeUtilidad(
  detalles = []
) {
  let ventasTotales = 0;
  let costoTotal = 0;
  let utilidadTotal = 0;

  for (const detalle of detalles) {
    const datosOriginales =
      detalle?.datos_originales || {};

    const venta =
      datosOriginales.ventaTotal ??
      datosOriginales.importe ??
      0;

    const costo =
      datosOriginales.costo ??
      0;

    const utilidad =
      datosOriginales.utilidad ??
      0;

    ventasTotales +=
      convertirNumero(
        venta
      );

    costoTotal +=
      convertirNumero(
        costo
      );

    utilidadTotal +=
      convertirNumero(
        utilidad
      );
  }

  const margenUtilidad =
    ventasTotales > 0
      ? (
          utilidadTotal /
          ventasTotales
        ) * 100
      : 0;

  return {
    ventasTotales,
    costoTotal,
    utilidadTotal,
    margenUtilidad,
  };
}

async function prepararSucursal(
  sucursal
) {
  const [
    resultadoVentas,
    resultadoInventario,
    resultadoUtilidad,
  ] = await Promise.all([
    obtenerUltimaImportacionVentas(
      sucursal.id
    ),

    obtenerUltimaImportacionInventario(
      sucursal.id
    ),

    obtenerUltimaImportacionUtilidadVentas(
      sucursal.id
    ),
  ]);

  const ventasReales =
    resultadoVentas?.ventasReales || [];

  const detallesVentasOriginales =
    resultadoVentas?.detalles || [];

  const detallesUtilidad =
    resultadoUtilidad?.detalles || [];

  const detallesInventario =
    resultadoInventario?.detalles || [];

   const tieneVentas =
    ventasReales.length > 0 ||
    detallesVentasOriginales.length > 0;

  const tieneUtilidad =
    detallesUtilidad.length > 0;

  const tieneInventario =
    detallesInventario.length > 0;

  if (
    !tieneVentas &&
    !tieneUtilidad &&
    !tieneInventario
  ) {
    return {
      id: sucursal.id,
      nombre: sucursal.name,
      business_id:
        sucursal.business_id,

      tieneDatos: false,

      ventasTotales: 0,
      costoTotal: 0,
      utilidadTotal: 0,
      margenUtilidad: 0,

      totalPiezas: 0,
      diasAnalizados: 0,

      ventaPromedioDiaria: 0,
      utilidadPromedioDiaria: 0,

      productosInventario: 0,

      estado: "sin_datos",
    };
  }

  /*
   * VENTAS POR ARTÍCULO
   * Se usa principalmente para
   * piezas y productos.
   */

  const datosVentas =
    ventasReales.length > 0
      ? ventasReales
      : detallesVentasOriginales;

  const metricasVentas =
    calcularMetricasDashboard(
      datosVentas,
      []
    );

  const totalPiezas =
    Number(
      metricasVentas?.totalPiezas
    ) || 0;

  /*
   * UTILIDAD DE VENTAS
   * Esta será la fuente oficial
   * de dinero.
   */

  const dineroUtilidad =
    calcularDineroDesdeUtilidad(
      detallesUtilidad
    );

  const ventasTotales =
    tieneUtilidad
      ? dineroUtilidad.ventasTotales
      : Number(
          metricasVentas?.ventasTotales
        ) || 0;

  const costoTotal =
    tieneUtilidad
      ? dineroUtilidad.costoTotal
      : Number(
          metricasVentas?.costoTotal
        ) || 0;

  const utilidadTotal =
    tieneUtilidad
      ? dineroUtilidad.utilidadTotal
      : Number(
          metricasVentas?.utilidadTotal
        ) || 0;

  const margenUtilidad =
    tieneUtilidad
      ? dineroUtilidad.margenUtilidad
      : Number(
          metricasVentas?.margenUtilidad
        ) || 0;

  /*
   * PERIODO
   *
   * Si tenemos Utilidad de ventas,
   * usamos sus fechas porque será
   * nuestro periodo financiero real.
   *
   * Si no, usamos el periodo del
   * reporte de Ventas por artículo.
   */

  const periodoUtilidad =
    obtenerPeriodoUtilidad(
      detallesUtilidad
    );

  const periodoVentas =
    obtenerPeriodoDesdeDetalles(
      detallesVentasOriginales
    );

  const periodoReal =
    periodoUtilidad ||
    periodoVentas;

  const diasAnalizados =
    periodoReal?.diasAnalizados ||
    Number(
      metricasVentas?.diasAnalizados
    ) ||
    0;

  const ventaPromedioDiaria =
    diasAnalizados > 0
      ? ventasTotales /
        diasAnalizados
      : 0;

  const utilidadPromedioDiaria =
    diasAnalizados > 0
      ? utilidadTotal /
        diasAnalizados
      : 0;

     const analisisInventario =
  analizarInventario(
    detallesInventario,
    {
      ventas: datosVentas,
      diasAnalizados,
    }
  );

const resumenInventario =
  analisisInventario?.resumen || {};

    const salud =
  evaluarSaludSucursal({
    id: sucursal.id,
    nombre: sucursal.name,
    tieneDatos: true,
    ventasTotales,
    costoTotal,
    utilidadTotal,
    margenUtilidad,
    totalPiezas,
    diasAnalizados,
    ventaPromedioDiaria,
    utilidadPromedioDiaria,
    productosInventario:
      detallesInventario.length,
    inventario:
  detallesInventario,
  resumenInventario,
    });

  return {
    id: sucursal.id,
    nombre: sucursal.name,

    business_id:
      sucursal.business_id,

    tieneDatos: true,

    ventasTotales,
    costoTotal,
    utilidadTotal,
    margenUtilidad,

    totalPiezas,
    diasAnalizados,

    ventaPromedioDiaria,
    utilidadPromedioDiaria,

    productosInventario:
      detallesInventario.length,

    periodo: periodoReal,

    inventario:
      detallesInventario,

    estado:
      "pendiente_evaluacion",
 
      salud,
    };
}

export function useDashboardSucursales() {
  const {
    usuario,
  } = useUser();

  const [
    sucursalesDashboard,
    setSucursalesDashboard,
  ] = useState([]);

  const [
    cargandoSucursales,
    setCargandoSucursales,
  ] = useState(true);

  const [
    errorSucursales,
    setErrorSucursales,
  ] = useState("");

  const cargarSucursales =
    useCallback(async () => {
      try {
        setCargandoSucursales(true);
        setErrorSucursales("");

        const organizationId =
          usuario?.organization_id ||
          null;

        const businessId =
          usuario?.business_id ||
          null;

        if (
          !organizationId ||
          !businessId
        ) {
          setSucursalesDashboard(
            []
          );

          return;
        }

        const {
          data: sucursales,
          error,
        } = await supabase
          .from("branches")
          .select(`
            id,
            name,
            business_id,
            active
          `)
          .eq(
            "business_id",
            businessId
          )
          .eq(
            "active",
            true
          )
          .order(
            "name",
            {
              ascending: true,
            }
          );

        if (error) {
          throw error;
        }

        const resultados =
          await Promise.all(
            (sucursales || []).map(
              (sucursal) =>
                prepararSucursal(
                  sucursal
                )
            )
          );

        setSucursalesDashboard(
          resultados
        );
      } catch (error) {
        console.error(
          "Error cargando sucursales para Dirección:",
          error
        );

        setErrorSucursales(
          error?.message ||
            "No fue posible analizar las sucursales."
        );

        setSucursalesDashboard(
          []
        );
      } finally {
        setCargandoSucursales(
          false
        );
      }
    }, [
      usuario?.organization_id,
      usuario?.business_id,
    ]);

  useEffect(() => {
    cargarSucursales();
  }, [
    cargarSucursales,
  ]);

  return {
    sucursalesDashboard,
    cargandoSucursales,
    errorSucursales,

    recargarSucursales:
      cargarSucursales,
  };
}