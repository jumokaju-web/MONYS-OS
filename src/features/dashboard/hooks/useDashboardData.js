import {
  useCallback,
  useEffect,
  useState,
  useRef,
} from "react";

import {
  useUser,
} from "../../../context/UserContext";

import {
  obtenerUltimaImportacionVentas,
  obtenerUltimaImportacionInventario,
  obtenerUltimaImportacionUtilidadVentas,
} from "../services/dashboardDataService";

import {
  calcularMetricasDashboard,
} from "../utils/dashboardMetrics";

import { evaluarComparabilidadPeriodos } from "../utils/evaluarComparabilidadPeriodos";

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

export function useDashboardData() {
  const {
    usuario,
  } = useUser();

  const branchId =
    usuario?.branch_id || null;

  const [
    datosDashboard,
    setDatosDashboard,
  ] = useState(null);

  const [
    cargandoDashboard,
    setCargandoDashboard,
  ] = useState(true);

  const [
    errorDashboard,
    setErrorDashboard,
  ] = useState("");

  const solicitudActual = useRef(0);

  const cargarDatosDashboard =
    useCallback(async () => {
      const solicitud = ++solicitudActual.current;
      setDatosDashboard(null);
      try {

      if (!branchId) {
  setDatosDashboard(null);
  setCargandoDashboard(false);
  return;
}

        setCargandoDashboard(true);
        setErrorDashboard("");

        const [
          resultadoVentas,
          resultadoInventario,
          resultadoUtilidad,
        ] = await Promise.all([
          obtenerUltimaImportacionVentas(
            branchId
          ),

          obtenerUltimaImportacionInventario(
            branchId
          ),

          obtenerUltimaImportacionUtilidadVentas(
            branchId
          ),
        ]);

        if (solicitud !== solicitudActual.current) return;

        if (!resultadoVentas) {
          setDatosDashboard(null);
          return;
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

        const periodoVentas =
          obtenerPeriodoDesdeDetalles(
            detallesVentasOriginales
          );

        const periodoUtilidad =
          obtenerPeriodoDesdeDetalles(
            detallesUtilidad
          );

        const comparabilidadProductos =
          evaluarComparabilidadPeriodos(
            periodoVentas,
            periodoUtilidad,
            datosVentas.length > 0 &&
              detallesUtilidad.length > 0
          );

        const metricasBase =
          calcularMetricasDashboard(
            comparabilidadProductos.comparable
              ? datosVentas
              : [],
            detallesUtilidad
          );

        const periodoReal =
          metricasBase?.fuenteFinanciera === "utilidad"
            ? periodoUtilidad
            : periodoVentas;

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

        const metricas = {
          ...metricasBase,

          periodosComparables:
            comparabilidadProductos.comparable,

          fechaInicial:
            periodoReal?.fechaInicial ||
            metricasBase?.fechaInicial ||
            null,

          fechaFinal:
            periodoReal?.fechaFinal ||
            metricasBase?.fechaFinal ||
            null,

          diasAnalizados,

          ventaPromedioDiaria:
            diasAnalizados > 0
              ? ventasTotales /
                diasAnalizados
              : 0,

          utilidadPromedioDiaria:
            diasAnalizados > 0
              ? utilidadTotal /
                diasAnalizados
              : 0,
        };

        setDatosDashboard({
          organization_id: usuario?.organization_id || null,
          business_id: usuario?.business_id || null,
          branch_id:
            branchId,

          comparabilidadProductos,

          importacion:
            resultadoUtilidad?.importacion ||
            resultadoVentas.importacion,

          metricas,

          detalles:
            datosVentas,

          ventasReales,

          ventasOriginales: {
            importacion:
              resultadoVentas.importacion,

            detalles:
              detallesVentasOriginales,

            periodo:
              periodoVentas,
          },

          utilidadVentas: {
            importacion:
              resultadoUtilidad?.importacion ||
              null,

            detalles:
              detallesUtilidad,

            periodo:
              periodoUtilidad,
          },

          inventario: {
            importacion:
              resultadoInventario?.importacion ||
              null,

            detalles:
              detallesInventario,
          },

          inteligencia: {
            comercial: {
              branch_id:
                branchId,

              ventas:
                datosVentas,

              ventasReales,

              ventasOriginales:
                detallesVentasOriginales,

              utilidad:
                detallesUtilidad,

              inventario:
                detallesInventario,

              periodo:
                periodoReal,

              metricas,
            },
          },
        });
      } catch (error) {
        if (solicitud !== solicitudActual.current) return;
        console.error(
          "Error al preparar los datos del Dashboard:",
          error
        );

        setErrorDashboard(
          error.message ||
            "No fue posible cargar los datos del Dashboard."
        );
      } finally {
        if (solicitud === solicitudActual.current) setCargandoDashboard(false);
      }
    }, [branchId, usuario?.organization_id, usuario?.business_id]);

  useEffect(() => {
    cargarDatosDashboard();
  }, [cargarDatosDashboard]);

  return {
    datosDashboard,
    cargandoDashboard,
    errorDashboard,
    recargarDashboard:
      cargarDatosDashboard,
  };
}