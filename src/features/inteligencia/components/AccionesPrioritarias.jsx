// ======================================================
// MONYS OS
// Acciones Prioritarias del Día
// ======================================================

import { generarAnalisisFinanciero } from "../ia/directorFinancieroIA";

function AccionesPrioritarias({
  datosDashboard,
  movimientos = [],
}) {
  const metricas =
    datosDashboard?.metricas || {};

  const analisisFinanciero =
    generarAnalisisFinanciero({
      movimientos,

      ventasTotales:
        metricas.ventasTotales ?? 0,

      costoTotal:
        metricas.costoTotal ?? 0,

      utilidadTotal:
        metricas.utilidadTotal ?? 0,

      margenUtilidad:
        metricas.margenUtilidad ?? 0,

      fechaInicial:
        metricas.fechaInicial ?? null,

      fechaFinal:
        metricas.fechaFinal ?? null,

      diasAnalizados:
        metricas.diasAnalizados ?? 0,

      ventaPromedioDiaria:
        metricas.ventaPromedioDiaria ?? 0,

      utilidadPromedioDiaria:
        metricas.utilidadPromedioDiaria ?? 0,
    });

  const acciones =
    analisisFinanciero?.accionesPrioritarias ||
    [];

  const obtenerEstiloPrioridad = (
    prioridad
  ) => {
    switch (prioridad) {
      case "CRITICA":
        return {
          icono: "🔴",
          fondo: "#fff0f0",
          borde: "#e7a3a3",
          texto: "#8b2020",
        };

      case "ALTA":
        return {
          icono: "🟠",
          fondo: "#fff6ed",
          borde: "#efbd84",
          texto: "#8a4b16",
        };

      case "MEDIA":
        return {
          icono: "🟡",
          fondo: "#fffceb",
          borde: "#dfcc72",
          texto: "#746010",
        };

      default:
        return {
          icono: "🟢",
          fondo: "#effbf3",
          borde: "#a9d8b7",
          texto: "#24633a",
        };
    }
  };

  if (acciones.length === 0) {
    return null;
  }

  return (
    <section
      style={{
        marginTop: "28px",
        marginBottom: "30px",
        padding: "26px",
        borderRadius: "22px",
        background:
          "linear-gradient(135deg, #ffffff 0%, #fff4f8 100%)",
        border: "1px solid #ebc2d1",
        boxShadow:
          "0 10px 30px rgba(112, 45, 75, 0.08)",
      }}
    >
      <div
        style={{
          textAlign: "center",
          marginBottom: "22px",
        }}
      >
        <h2
          style={{
            margin: 0,
            fontSize: "26px",
            fontWeight: "800",
          }}
        >
          🎯 Decisiones prioritarias de hoy
        </h2>

        <p
          style={{
            marginTop: "8px",
            marginBottom: 0,
            color: "#75656d",
            lineHeight: "1.6",
          }}
        >
          MONYS OS ordenó automáticamente
          las acciones que requieren tu atención.
        </p>
      </div>

      <div
        style={{
          display: "grid",
          gap: "14px",
        }}
      >
        {acciones.map(
          (accion, indice) => {
            const estilo =
              obtenerEstiloPrioridad(
                accion.prioridad
              );

            return (
              <article
                key={`${accion.titulo}-${indice}`}
                style={{
                  padding: "18px",
                  borderRadius: "16px",
                  backgroundColor:
                    estilo.fondo,
                  border: `1px solid ${estilo.borde}`,
                }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent:
                      "space-between",
                    alignItems:
                      "flex-start",
                    gap: "12px",
                    flexWrap: "wrap",
                  }}
                >
                  <strong
                    style={{
                      fontSize: "17px",
                      color:
                        estilo.texto,
                    }}
                  >
                    {estilo.icono}{" "}
                    PRIORIDAD {indice + 1}:{" "}
                    {accion.titulo}
                  </strong>

                  <span
                    style={{
                      fontSize: "13px",
                      fontWeight: "800",
                      color:
                        estilo.texto,
                    }}
                  >
                    Impacto:{" "}
                    {accion.impacto}
                  </span>
                </div>

                <p
                  style={{
                    marginTop: "10px",
                    marginBottom: "8px",
                    lineHeight: "1.6",
                    color: "#493e43",
                  }}
                >
                  {accion.descripcion}
                </p>

                <small
                  style={{
                    color: "#75656d",
                    fontWeight: "600",
                  }}
                >
                  Responsable:{" "}
                  {accion.responsable ||
                    "Director Financiero"}
                </small>
              </article>
            );
          }
        )}
      </div>
    </section>
  );
}

export default AccionesPrioritarias;