import { generarInsightsDashboard } from "./utils/dashboardInsights";
import knowledgeService from "../../services/knowledgeService";
import { ejecutarMotorDecisiones } from "../../core/engine/motorDecisionesIA";

function DirectorGeneralIA({
  cantidadMovimientos,
  movimientos,
  entradas,
  salidas,
  disponible,
  formatoDinero,
  datosDashboard,
  abrirSalaConsejo,
}) {

 const datosDirectorGeneral = {
  ...(datosDashboard || {}),

  financiero: {
    totalEntradas: Number(entradas || 0),
    totalSalidas: Number(salidas || 0),
    balance: Number(disponible || 0),
  },
};

const insights =
  generarInsightsDashboard(datosDirectorGeneral);

  const empresa = knowledgeService.getCompanyProfile();
  const sucursales = knowledgeService.getBranches();
  const marcas = knowledgeService.getBrands();
  const objetivos = knowledgeService.getObjectives();


  const decisionesIA = ejecutarMotorDecisiones();

  const decisionGeneral =
  decisionesIA.general[0] || {
    titulo: "Sin decisiones",
    mensaje:
      "Todavía no existen decisiones generadas.",
  };

  return (
    <section className="director">
      <div>
        <span className="etiqueta">
          DIRECTOR GENERAL IA
        </span>

        <h2>Buenos días, {empresa.owner}.</h2>

        <p>
          Estás dirigiendo <strong>{empresa.name}</strong>, con{" "}
          <strong>{sucursales.length}</strong> sucursales,{" "}
          <strong>{marcas.length}</strong> marcas registradas y{" "}
          <strong>{objetivos.length}</strong> objetivos empresariales.
        </p>

        <p>
          Tienes <strong>{cantidadMovimientos}</strong> movimientos
          registrados y un disponible de{" "}
          <strong>{formatoDinero(disponible)}</strong>.
        </p>

        <div
  style={{
    marginTop: "18px",
    background: "#fff7ed",
    border: "1px solid #fdba74",
    borderRadius: "12px",
    padding: "18px",
    color: "#1f2937",
  }}
>
  <strong>🧠 Consejo IA</strong>

  <h3
    style={{
      marginTop: "12px",
      marginBottom: "8px",
    }}
  >
    {decisionGeneral.titulo}
  </h3>

 <p
  style={{
    margin: 0,
    color: "#374151",
    fontSize: "16px",
    fontWeight: "500",
    lineHeight: "1.6",
  }}
>
  {decisionGeneral.mensaje}
</p>
</div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns:
              "repeat(auto-fit, minmax(160px, 1fr))",
            gap: "12px",
            marginTop: "20px",
          }}
        >
          <div
            style={{
              background: "rgba(255, 255, 255, 0.95)",
              color: "#1f2937",
              padding: "14px",
              borderRadius: "12px",
            }}
          >
            <strong>🏢 Empresa</strong>
            <div>{empresa.name}</div>
          </div>

          <div
            style={{
              background: "rgba(255, 255, 255, 0.95)",
              color: "#1f2937",
              padding: "14px",
              borderRadius: "12px",
            }}
          >
            <strong>📍 Sucursales</strong>
            <div>{sucursales.length} registradas</div>
          </div>

          <div
            style={{
              background: "rgba(255, 255, 255, 0.95)",
              color: "#1f2937",
              padding: "14px",
              borderRadius: "12px",
            }}
          >
            <strong>💄 Marcas</strong>
            <div>{marcas.length} registradas</div>
          </div>

          <div
            style={{
              background: "rgba(255, 255, 255, 0.95)",
              color: "#1f2937",
              padding: "14px",
              borderRadius: "12px",
            }}
          >
            <strong>🎯 Objetivos</strong>
            <div>{objetivos.length} activos</div>
          </div>
        </div>

        {insights.length > 0 && (
          <div
            style={{
              marginTop: "20px",
              background: "#ffffff",
              color: "#1f2937",
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

    <button onClick={abrirSalaConsejo}>
  Iniciar reunión diaria
</button>
    </section>
  );
}

export default DirectorGeneralIA;