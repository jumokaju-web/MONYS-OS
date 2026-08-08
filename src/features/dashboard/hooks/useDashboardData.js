import {
  useCallback,
  useEffect,
  useState,
} from "react";

import {
  obtenerUltimaImportacionVentas,
  obtenerUltimaImportacionInventario,
  obtenerUltimaImportacionUtilidadVentas,
} from "../services/dashboardDataService";

import {
  calcularMetricasDashboard,
} from "../utils/dashboardMetrics";

export function useDashboardData() {
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

  const cargarDatosDashboard =
    useCallback(async () => {
      try {
        setCargandoDashboard(true);
        setErrorDashboard("");

        const [
          resultadoVentas,
          resultadoInventario,
          resultadoUtilidad,
        ] = await Promise.all([
          obtenerUltimaImportacionVentas(),
          obtenerUltimaImportacionInventario(),
          obtenerUltimaImportacionUtilidadVentas(),
        ]);

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

        const metricas =
          calcularMetricasDashboard(
            datosVentas,
            detallesUtilidad
          );

        setDatosDashboard({
          importacion:
            resultadoVentas.importacion,

          metricas,

          /*
            Fuente principal para cálculos.
          */
          detalles:
            datosVentas,

          /*
            Ventas estructuradas guardadas
            en ventas_articulos.
          */
          ventasReales,

          /*
            Conservamos también el contenido
            original importado desde SICAR.
            Esto servirá para enriquecer
            categoría, departamento, marca,
            proveedor u otros campos cuando existan.
          */
          ventasOriginales: {
            importacion:
              resultadoVentas.importacion,

            detalles:
              detallesVentasOriginales,
          },

          /*
            Datos de rentabilidad provenientes
            del reporte Utilidad de ventas.
          */
          utilidadVentas: {
            importacion:
              resultadoUtilidad?.importacion ||
              null,

            detalles:
              detallesUtilidad,
          },

          /*
            Datos de inventario disponibles
            para cruces comerciales.
          */
          inventario: {
            importacion:
              resultadoInventario?.importacion ||
              null,

            detalles:
              detallesInventario,
          },

          /*
            Paquete preparado especialmente
            para los Directores IA.
          */
          inteligencia: {
            comercial: {
              ventas:
                datosVentas,

              ventasReales,

              ventasOriginales:
                detallesVentasOriginales,

              utilidad:
                detallesUtilidad,

              inventario:
                detallesInventario,

              metricas,
            },
          },
        });
      } catch (error) {
        console.error(
          "Error al preparar los datos del Dashboard:",
          error
        );

        setErrorDashboard(
          error.message ||
            "No fue posible cargar los datos del Dashboard."
        );
      } finally {
        setCargandoDashboard(false);
      }
    }, []);

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