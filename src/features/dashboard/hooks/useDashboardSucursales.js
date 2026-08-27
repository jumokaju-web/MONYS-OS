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

function convertirFechaValida(valor) {
  if (!valor) {
    return null;
  }

  const fecha = new Date(valor);

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

  if (!resultadoVentas) {
    return {
      id: sucursal.id,
      nombre: sucursal.name,
      tieneDatos: false,

      ventasTotales: 0,
      utilidadTotal: 0,
      margenUtilidad: 0,
      totalPiezas: 0,
      diasAnalizados: 0,

      productosInventario: 0,

      estado: "sin_datos",
    };
  }

  const ventasReales =
    resultadoVentas.ventasReales || [];

  const detallesVentasOriginales =
    resultadoVentas.detalles || [];

  const datosVentas =
    ventasReales.length > 0
      ? ventasReales
      : detallesVentasOriginales;

  const detallesUtilidad =
    resultadoUtilidad?.detalles || [];

  const detallesInventario =
    resultadoInventario?.detalles || [];

  const metricasBase =
    calcularMetricasDashboard(
      datosVentas,
      detallesUtilidad
    );

  const periodoReal =
    obtenerPeriodoDesdeDetalles(
      detallesVentasOriginales
    );

  const diasAnalizados =
    periodoReal?.diasAnalizados ||
    metricasBase?.diasAnalizados ||
    0;

  const ventasTotales =
    Number(
      metricasBase?.ventasTotales
    ) || 0;

  const utilidadTotal =
    Number(
      metricasBase?.utilidadTotal
    ) || 0;

  const margenUtilidad =
    Number(
      metricasBase?.margenUtilidad
    ) || 0;

  const totalPiezas =
    Number(
      metricasBase?.totalPiezas
    ) || 0;

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

  return {
    id: sucursal.id,
    nombre: sucursal.name,

    organization_id:
      sucursal.organization_id,

    business_id:
      sucursal.business_id,

    tieneDatos: true,

    ventasTotales,
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

    estado: "pendiente_evaluacion",
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
          setSucursalesDashboard([]);
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
            organization_id,
            business_id,
            active
          `)
          .eq(
            "organization_id",
            organizationId
          )
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

        setSucursalesDashboard([]);
      } finally {
        setCargandoSucursales(false);
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