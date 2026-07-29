import { useCallback, useEffect, useState } from "react";
import { obtenerUltimaImportacionVentas } from "../services/dashboardDataService";
import { calcularMetricasDashboard } from "../utils/dashboardMetrics";

export function useDashboardData() {
  const [datosDashboard, setDatosDashboard] = useState(null);
  const [cargandoDashboard, setCargandoDashboard] = useState(true);
  const [errorDashboard, setErrorDashboard] = useState("");

  const cargarDatosDashboard = useCallback(async () => {
    try {
      setCargandoDashboard(true);
      setErrorDashboard("");

      const resultado = await obtenerUltimaImportacionVentas();

      if (!resultado) {
        setDatosDashboard(null);
        return;
      }

      const metricas = calcularMetricasDashboard(
        resultado.detalles
      );

      setDatosDashboard({
        importacion: resultado.importacion,
        metricas,
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
    recargarDashboard: cargarDatosDashboard,
  };
}