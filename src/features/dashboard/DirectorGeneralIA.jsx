import { generarInsightsDashboard } from "./utils/dashboardInsights";

function DirectorGeneralIA({
  cantidadMovimientos,
  disponible,
  formatoDinero,
  datosDashboard,
}) {
  const insights = generarInsightsDashboard(datosDashboard);

  return (
    <section className="director">
      <div>
        <span className="etiqueta">
          DIRECTOR GENERAL IA
        </span>

        <h2>Buenos días, Jefa.</h2>

        <p>
          Tienes <strong>{cantidadMovimientos}</strong> movimientos
          registrados y un disponible de{" "}
          <strong>{formatoDinero(disponible)}</strong>.
        </p>

        {insights.length > 0 && (
          <div
            style={{
              marginTop: "20px",
              background: "#ffffff",
              border: "1px solid #e5e7eb",
              borderRadius: "12px",
              padding: "18px",
            }}
          >
            <h3
              style={{
                marginTop: 0,
                marginBottom: "18px",
              }}
            >
              📋 Resumen Ejecutivo
            </h3>

            {insights.map((insight) => (
              <div
                key={insight.id}
                style={{
                  borderLeft: `6px solid ${insight.color}`,
                  background: "#f9fafb",
                  padding: "12px",
                  borderRadius: "8px",
                  marginBottom: "12px",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    marginBottom: "6px",
                  }}
                >
                  <strong>
                    {insight.icono} {insight.titulo}
                  </strong>

                  <span
                    style={{
                      fontSize: "12px",
                      fontWeight: "bold",
                      color: insight.color,
                    }}
                  >
                    {insight.nivel}
                  </span>
                </div>

                <div>{insight.mensaje}</div>
              </div>
            ))}
          </div>
        )}
      </div>

      <button
        onClick={() =>
          alert(
            "La reunión diaria IA evolucionará en los siguientes sprints."
          )
        }
      >
        Iniciar reunión diaria
      </button>
    </section>
  );
}

export default DirectorGeneralIA;