import { useDashboardData } from "../hooks/useDashboardData";

const DashboardPage = () => {
  const {
    datosDashboard,
    cargandoDashboard,
    errorDashboard,
  } = useDashboardData();

  if (cargandoDashboard) {
    return <h2>Cargando Dashboard...</h2>;
  }

  if (errorDashboard) {
    return <h2>Error: {errorDashboard}</h2>;
  }

  if (!datosDashboard) {
    return <h2>No existe ninguna importación procesada.</h2>;
  }

  return (
    <div style={{ padding: "30px" }}>
      <h1>MONYS Data Engine</h1>

      <h2>Última importación</h2>

      <pre>
        {JSON.stringify(
          datosDashboard.importacion,
          null,
          2
        )}
      </pre>

      <h2>Métricas</h2>

      <pre>
        {JSON.stringify(
          datosDashboard.metricas,
          null,
          2
        )}
      </pre>
    </div>
  );
};

export default DashboardPage;