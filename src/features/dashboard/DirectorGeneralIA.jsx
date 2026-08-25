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
      totalEntradas: Number(
        entradas || 0
      ),
      totalSalidas: Number(
        salidas || 0
      ),
      balance: Number(
        disponible || 0
      ),
    },
  };

  const insights =
    generarInsightsDashboard(
      datosDirectorGeneral
    );

  const empresa =
    knowledgeService.getCompanyProfile();

  const sucursales =
    knowledgeService.getBranches();

  const marcas =
    knowledgeService.getBrands();

  const objetivos =
    knowledgeService.getObjectives();

  const decisionesIA =
    ejecutarMotorDecisiones();

  const decisionGeneral =
    decisionesIA.general[0] || {
      titulo: "Sin decisiones",
      mensaje:
        "Todavía no existen decisiones generadas.",
    };

  const insightsImportantes =
    insights.slice(0, 3);

  return (
    <section className="director">
      <div>
        {/* ENCABEZADO COMPACTO */}

        <div
          style={{
            display: "flex",
            justifyContent:
              "space-between",
            alignItems: "center",
            gap: "16px",
            flexWrap: "wrap",
          }}
        >
          <div>
            <span className="etiqueta">
              DIRECTOR GENERAL IA
            </span>

            <h2
              style={{
                marginBottom: "6px",
              }}
            >
              Buenos días,{" "}
              {empresa.owner}.
            </h2>

            <p
              style={{
                marginTop: 0,
              }}
            >
              Disponible:{" "}
              <strong>
                {formatoDinero(
                  disponible
                )}
              </strong>
              {" · "}
              {cantidadMovimientos}{" "}
              movimientos
            </p>
          </div>

          {/* JUNTA SIEMPRE VISIBLE */}

          <button
            type="button"
            onClick={
              abrirSalaConsejo
            }
            style={{
              padding:
                "15px 22px",
              borderRadius:
                "12px",
              border:
                "none",
              background:
                "#ffffff",
              color:
                "#8f174f",
              fontSize:
                "16px",
              fontWeight:
                "900",
              cursor:
                "pointer",
              boxShadow:
                "0 6px 18px rgba(0,0,0,0.12)",
            }}
          >
            👑 Iniciar reunión diaria
          </button>
        </div>

        {/* CONSEJO IA */}

        <div
          style={{
            marginTop: "16px",
            background: "#fff7ed",
            border:
              "1px solid #fdba74",
            borderRadius: "12px",
            padding: "15px",
            color: "#1f2937",
          }}
        >
          <strong>
            🧠 Consejo IA
          </strong>

          <h3
            style={{
              margin:
                "8px 0 5px",
            }}
          >
            {
              decisionGeneral.titulo
            }
          </h3>

          <p
            style={{
              margin: 0,
              color: "#374151",
              lineHeight: "1.5",
            }}
          >
            {
              decisionGeneral.mensaje
            }
          </p>
        </div>

        {/* DATOS EMPRESA COMPACTOS */}

        <div
          style={{
            display: "grid",
            gridTemplateColumns:
              "repeat(auto-fit, minmax(140px, 1fr))",
            gap: "10px",
            marginTop: "14px",
          }}
        >
          <div
            style={{
              background:
                "rgba(255,255,255,0.95)",
              color: "#1f2937",
              padding: "11px",
              borderRadius:
                "10px",
            }}
          >
            <strong>
              📍 Sucursales
            </strong>
            <div>
              {sucursales.length}
            </div>
          </div>

          <div
            style={{
              background:
                "rgba(255,255,255,0.95)",
              color: "#1f2937",
              padding: "11px",
              borderRadius:
                "10px",
            }}
          >
            <strong>
              💄 Marcas
            </strong>
            <div>
              {marcas.length}
            </div>
          </div>

          <div
            style={{
              background:
                "rgba(255,255,255,0.95)",
              color: "#1f2937",
              padding: "11px",
              borderRadius:
                "10px",
            }}
          >
            <strong>
              🎯 Objetivos
            </strong>
            <div>
              {objetivos.length}
            </div>
          </div>
        </div>

        {/* SOLO 3 ALERTAS IMPORTANTES */}

        {insightsImportantes.length >
          0 && (
          <div
            style={{
              marginTop:
                "14px",
            }}
          >
            {insightsImportantes.map(
              (insight) => (
                <div
                  key={
                    insight.id
                  }
                  style={{
                    display:
                      "flex",
                    justifyContent:
                      "space-between",
                    alignItems:
                      "center",
                    gap: "12px",
                    background:
                      "#ffffff",
                    color:
                      "#1f2937",
                    borderLeft: `5px solid ${insight.color}`,
                    borderRadius:
                      "9px",
                    padding:
                      "10px 12px",
                    marginBottom:
                      "8px",
                  }}
                >
                  <div>
                    <strong>
                      {
                        insight.icono
                      }{" "}
                      {
                        insight.titulo
                      }
                    </strong>

                    <div
                      style={{
                        marginTop:
                          "3px",
                        fontSize:
                          "14px",
                      }}
                    >
                      {
                        insight.mensaje
                      }
                    </div>
                  </div>

                  <span
                    style={{
                      fontSize:
                        "11px",
                      fontWeight:
                        "900",
                      color:
                        insight.color,
                    }}
                  >
                    {
                      insight.nivel
                    }
                  </span>
                </div>
              )
            )}
          </div>
        )}

        {/* TODO EL INFORME QUEDA PLEGADO */}

        {insights.length >
          insightsImportantes.length && (
          <details
            style={{
              marginTop:
                "12px",
              background:
                "rgba(255,255,255,0.95)",
              color:
                "#1f2937",
              borderRadius:
                "10px",
              overflow:
                "hidden",
            }}
          >
            <summary
              style={{
                padding:
                  "12px 14px",
                cursor:
                  "pointer",
                fontWeight:
                  "800",
              }}
            >
              📋 Ver resumen ejecutivo
              completo (
              {insights.length})
            </summary>

            <div
              style={{
                padding:
                  "4px 14px 14px",
              }}
            >
              {insights.map(
                (insight) => (
                  <div
                    key={`completo-${insight.id}`}
                    style={{
                      borderLeft: `5px solid ${insight.color}`,
                      background:
                        "#f9fafb",
                      padding:
                        "10px",
                      borderRadius:
                        "8px",
                      marginBottom:
                        "8px",
                    }}
                  >
                    <strong>
                      {
                        insight.icono
                      }{" "}
                      {
                        insight.titulo
                      }
                    </strong>

                    <div
                      style={{
                        marginTop:
                          "4px",
                      }}
                    >
                      {
                        insight.mensaje
                      }
                    </div>
                  </div>
                )
              )}
            </div>
          </details>
        )}
      </div>
    </section>
  );
}

export default DirectorGeneralIA;