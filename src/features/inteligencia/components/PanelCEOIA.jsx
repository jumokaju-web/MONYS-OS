// ======================================================
// MONYS OS
// Panel Visual del CEO IA
// ======================================================

import CentroAccionesCEO from "./CentroAccionesCEO";

function formatearDinero(valor) {
  return new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency: "MXN",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(Number(valor) || 0);
}

function obtenerEstiloPrioridad(prioridad) {
  if (prioridad === "CRITICA") {
    return {
      icono: "🔴",
      fondo: "#fff0f0",
      borde: "#efb8b8",
      color: "#9e2c2c",
    };
  }

  if (prioridad === "ALTA") {
    return {
      icono: "🟠",
      fondo: "#fff6ed",
      borde: "#efbd84",
      color: "#8a4b16",
    };
  }

  if (prioridad === "MEDIA") {
    return {
      icono: "🟡",
      fondo: "#fffbea",
      borde: "#e4d17d",
      color: "#75610e",
    };
  }

  return {
    icono: "🟢",
    fondo: "#effbf3",
    borde: "#b8dfc6",
    color: "#207a4a",
  };
}

function PanelCEOIA({
  decisionCEO,
}) {
  if (!decisionCEO) {
    return null;
  }

  const decisiones =
    Array.isArray(
      decisionCEO.decisiones
    )
      ? decisionCEO.decisiones
      : [];

  const comprasAutorizadas =
    Array.isArray(
      decisionCEO.comprasAutorizadas
    )
      ? decisionCEO.comprasAutorizadas
      : [];

  const comprasPospuestas =
    Array.isArray(
      decisionCEO.comprasPospuestas
    )
      ? decisionCEO.comprasPospuestas
      : [];

const textoEstadoGeneral = String(
  decisionCEO.estadoGeneral || ""
).toLowerCase();

const semaforoFinanzas =
  textoEstadoGeneral.includes("riesgo") ||
  textoEstadoGeneral.includes("crítica")
    ? {
        nivel: "Rojo",
        icono: "🔴",
        mensaje: "Requiere atención inmediata",
      }
    : textoEstadoGeneral.includes("limitada") ||
      textoEstadoGeneral.includes("ajustada") ||
      textoEstadoGeneral.includes("atención")
    ? {
        nivel: "Amarillo",
        icono: "🟡",
        mensaje: "Liquidez bajo vigilancia",
      }
    : {
        nivel: "Verde",
        icono: "🟢",
        mensaje: "Situación financiera estable",
      };

const semaforoInventario =
  comprasPospuestas.length > 0
    ? {
        nivel: "Amarillo",
        icono: "🟡",
        mensaje: `${comprasPospuestas.length} compras pospuestas`,
      }
    : {
        nivel: "Verde",
        icono: "🟢",
        mensaje: "Inventario sin alertas críticas",
      };

const decisionesComerciales =
  decisiones.filter((decision) =>
    String(decision?.area || "")
      .toLowerCase()
      .includes("comercial")
  );

const hayAlertaComercial =
  decisionesComerciales.some((decision) =>
    ["ALTA", "CRITICA", "CRÍTICA"].includes(
      String(
        decision?.prioridad || ""
      ).toUpperCase()
    )
  );

const semaforoComercial =
  hayAlertaComercial
    ? {
        nivel: "Amarillo",
        icono: "🟡",
        mensaje: "Existen prioridades comerciales",
      }
    : {
        nivel: "Verde",
        icono: "🟢",
        mensaje: "Desempeño comercial favorable",
      };

  return (
    <section
      style={{
        marginTop: "28px",
        marginBottom: "32px",
        padding: "28px",
        borderRadius: "24px",
        background:
          "linear-gradient(135deg, #2c2030 0%, #5e3048 100%)",
        color: "#ffffff",
        boxShadow:
          "0 18px 45px rgba(74, 35, 56, 0.24)",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          gap: "18px",
          flexWrap: "wrap",
        }}
      >
        <div>
          <p
            style={{
              margin: 0,
              opacity: 0.78,
              fontWeight: "800",
              letterSpacing: "1px",
            }}
          >
            MONYS OS · DIRECTOR GENERAL IA
          </p>

          <h2
            style={{
              margin: "8px 0 0",
              fontSize: "30px",
            }}
          ><div
  style={{
    background: "rgba(255,255,255,0.08)",
    borderRadius: "14px",
    padding: "16px",
    marginBottom: "20px",
    textAlign: "center",
  }}
>
  <div
    style={{
      fontSize: "14px",
      color: "#d8cfd6",
      letterSpacing: "1px",
      textTransform: "uppercase",
    }}
  >
    Reunión diaria del Consejo
  </div>

  <h2
    style={{
      margin: "10px 0",
      fontSize: "30px",
      color: "#ffffff",
    }}
  >
    Hola, Jefa 👋
  </h2>

  <p
    style={{
      margin: 0,
      color: "#efe7ec",
      fontSize: "18px",
    }}
  >
    Estas son las decisiones más importantes para hoy.
  </p>
</div>

<div
  style={{
    display: "grid",
   gridTemplateColumns:
  "repeat(3, minmax(0, 1fr))",
    gap: "14px",
    margin: "22px 0 26px",
  }}
>
  <div
    style={{
      padding: "16px",
      borderRadius: "16px",
      background: "rgba(255,255,255,0.10)",
      border: "1px solid rgba(255,255,255,0.18)",
    }}
  >
    <div
      style={{
        fontSize: "14px",
        opacity: 0.8,
        marginBottom: "8px",
      }}
    >
      💰 FINANZAS
    </div>

    <strong
      style={{
        fontSize: "20px",
      }}
    >
      {semaforoFinanzas.icono}{" "}
      {semaforoFinanzas.nivel}
    </strong>

    <p
      style={{
        margin: "8px 0 0",
        fontSize: "14px",
        lineHeight: "1.5",
      }}
    >
      {semaforoFinanzas.mensaje}
    </p>
  </div>

  <div
    style={{
      padding: "16px",
      borderRadius: "16px",
      background: "rgba(255,255,255,0.10)",
      border: "1px solid rgba(255,255,255,0.18)",
    }}
  >
    <div
      style={{
        fontSize: "14px",
        opacity: 0.8,
        marginBottom: "8px",
      }}
    >
      📦 INVENTARIO
    </div>

    <strong
      style={{
        fontSize: "20px",
      }}
    >
      {semaforoInventario.icono}{" "}
      {semaforoInventario.nivel}
    </strong>

    <p
      style={{
        margin: "8px 0 0",
        fontSize: "14px",
        lineHeight: "1.5",
      }}
    >
      {semaforoInventario.mensaje}
    </p>
  </div>

  <div
    style={{
      padding: "16px",
      borderRadius: "16px",
      background: "rgba(255,255,255,0.10)",
      border: "1px solid rgba(255,255,255,0.18)",
    }}
  >
    <div
      style={{
        fontSize: "14px",
        opacity: 0.8,
        marginBottom: "8px",
      }}
    >
      🛒 COMERCIAL
    </div>

    <strong
      style={{
        fontSize: "20px",
      }}
    >
      {semaforoComercial.icono}{" "}
      {semaforoComercial.nivel}
    </strong>

    <p
      style={{
        margin: "8px 0 0",
        fontSize: "14px",
        lineHeight: "1.5",
      }}
    >
      {semaforoComercial.mensaje}
    </p>
  </div>
</div>

            👑 Decisión Ejecutiva del CEO
          </h2>
        </div>

{(() => {
  const puntosPorNivel = {
    Verde: 100,
    Amarillo: 70,
    Rojo: 35,
  };

  const saludGeneral = Math.round(
    (
      (puntosPorNivel[semaforoFinanzas.nivel] || 0) +
      (puntosPorNivel[semaforoInventario.nivel] || 0) +
      (puntosPorNivel[semaforoComercial.nivel] || 0)
    ) / 3
  );

  const estadoSalud =
    saludGeneral >= 85
      ? {
          icono: "🟢",
          titulo: "Salud excelente",
          mensaje:
            "La operación se encuentra en condiciones favorables.",
          fondo: "#eaf8f0",
          borde: "#9fd2ae",
          color: "#207a4a",
        }
      : saludGeneral >= 70
      ? {
          icono: "🟡",
          titulo: "Operación estable con atención",
          mensaje:
            "El negocio funciona, pero existen áreas que requieren seguimiento.",
          fondo: "#fff8df",
          borde: "#e5c75d",
          color: "#8a6800",
        }
      : {
          icono: "🔴",
          titulo: "Intervención prioritaria",
          mensaje:
            "Existen riesgos que requieren atención ejecutiva inmediata.",
          fondo: "#fff0f0",
          borde: "#efb8b8",
          color: "#9e2c2c",
        };

  return (
    <div
      style={{
        margin: "8px 0 28px",
        padding: "24px",
        borderRadius: "20px",
        background: estadoSalud.fondo,
        border: `1px solid ${estadoSalud.borde}`,
        color: "#332d30",
        textAlign: "center",
      }}
    >
      <div
        style={{
          fontSize: "14px",
          fontWeight: "900",
          letterSpacing: "1px",
          color: estadoSalud.color,
        }}
      >
        SALUD GENERAL DEL NEGOCIO
      </div>

      <div
        style={{
          marginTop: "10px",
          fontSize: "46px",
          lineHeight: "1",
          fontWeight: "900",
          color: estadoSalud.color,
        }}
      >
        {saludGeneral}%
      </div>

      <div
        style={{
          width: "100%",
          height: "14px",
          margin: "18px 0 14px",
          borderRadius: "999px",
          background: "rgba(0,0,0,0.08)",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            width: `${saludGeneral}%`,
            height: "100%",
            borderRadius: "999px",
            background: estadoSalud.color,
            transition: "width 0.3s ease",
          }}
        />
      </div>

      <strong
        style={{
          display: "block",
          fontSize: "22px",
          color: estadoSalud.color,
        }}
      >
        {estadoSalud.icono} {estadoSalud.titulo}
      </strong>

      <p
        style={{
          margin: "10px auto 0",
          maxWidth: "650px",
          lineHeight: "1.6",
          fontSize: "16px",
        }}
      >
        {estadoSalud.mensaje}
      </p>
    </div>
  );
})()}

     <div
  style={{
    padding: "12px 18px",
    borderRadius: "999px",
    background:
      decisionCEO.estadoGeneral
        ?.toLowerCase()
        .includes("riesgo") ||
      decisionCEO.estadoGeneral
        ?.toLowerCase()
        .includes("crítica") ||
      decisionCEO.estadoGeneral
        ?.toLowerCase()
        .includes("inmediata")
        ? "#ffe8e8"
        : decisionCEO.estadoGeneral
            ?.toLowerCase()
            .includes("limitada") ||
          decisionCEO.estadoGeneral
            ?.toLowerCase()
            .includes("ajustada") ||
          decisionCEO.estadoGeneral
            ?.toLowerCase()
            .includes("atención")
        ? "#fff4cc"
        : "#e7f8ec",

    border:
      decisionCEO.estadoGeneral
        ?.toLowerCase()
        .includes("riesgo") ||
      decisionCEO.estadoGeneral
        ?.toLowerCase()
        .includes("crítica") ||
      decisionCEO.estadoGeneral
        ?.toLowerCase()
        .includes("inmediata")
        ? "1px solid #f0a5a5"
        : decisionCEO.estadoGeneral
            ?.toLowerCase()
            .includes("limitada") ||
          decisionCEO.estadoGeneral
            ?.toLowerCase()
            .includes("ajustada") ||
          decisionCEO.estadoGeneral
            ?.toLowerCase()
            .includes("atención")
        ? "1px solid #e5c75d"
        : "1px solid #9fd2ae",

    color:
      decisionCEO.estadoGeneral
        ?.toLowerCase()
        .includes("riesgo") ||
      decisionCEO.estadoGeneral
        ?.toLowerCase()
        .includes("crítica") ||
      decisionCEO.estadoGeneral
        ?.toLowerCase()
        .includes("inmediata")
        ? "#9e2c2c"
        : decisionCEO.estadoGeneral
            ?.toLowerCase()
            .includes("limitada") ||
          decisionCEO.estadoGeneral
            ?.toLowerCase()
            .includes("ajustada") ||
          decisionCEO.estadoGeneral
            ?.toLowerCase()
            .includes("atención")
        ? "#8a6800"
        : "#207a4a",

    fontWeight: "900",
  }}
>
  {decisionCEO.estadoGeneral
    ?.toLowerCase()
    .includes("riesgo") ||
  decisionCEO.estadoGeneral
    ?.toLowerCase()
    .includes("crítica") ||
  decisionCEO.estadoGeneral
    ?.toLowerCase()
    .includes("inmediata")
    ? "🔴 "
    : decisionCEO.estadoGeneral
        ?.toLowerCase()
        .includes("limitada") ||
      decisionCEO.estadoGeneral
        ?.toLowerCase()
        .includes("ajustada") ||
      decisionCEO.estadoGeneral
        ?.toLowerCase()
        .includes("atención")
    ? "🟡 "
    : "🟢 "}

  {decisionCEO.estadoGeneral ||
    "Analizando operación"}
</div>

</div>
      <p
        style={{
          margin: "24px 0 0",
          fontSize: "18px",
          lineHeight: "1.7",
        }}
      >
        {decisionCEO.mensajeCEO ||
          "El Consejo está preparando una decisión ejecutiva."}
      </p>

      <div
        style={{
          display: "grid",
         gridTemplateColumns:
  "repeat(3, minmax(0, 1fr))",
          gap: "14px",
          marginTop: "24px",
        }}
      >
        <div
          style={{
            padding: "18px",
            borderRadius: "16px",
            background:
              "rgba(255,255,255,0.10)",
            border:
              "1px solid rgba(255,255,255,0.18)",
          }}
        >
          <div>💵 Dinero disponible</div>

          <strong
            style={{
              display: "block",
              marginTop: "8px",
              fontSize: "22px",
            }}
          >
            {formatearDinero(
              decisionCEO.dineroDisponible
            )}
          </strong>
        </div>

        <div
          style={{
            padding: "18px",
            borderRadius: "16px",
            background:
              "rgba(255,255,255,0.10)",
            border:
              "1px solid rgba(255,255,255,0.18)",
          }}
        >
          <div>🛒 Inventario solicita</div>

          <strong
            style={{
              display: "block",
              marginTop: "8px",
              fontSize: "22px",
            }}
          >
            {formatearDinero(
              decisionCEO.inversionInventario
            )}
          </strong>
        </div>

        <div
          style={{
            padding: "18px",
            borderRadius: "16px",
            background:
              "rgba(255,255,255,0.10)",
            border:
              "1px solid rgba(255,255,255,0.18)",
          }}
        >
          <div>✅ Presupuesto autorizado</div>

          <strong
            style={{
              display: "block",
              marginTop: "8px",
              fontSize: "22px",
            }}
          >
            {formatearDinero(
              decisionCEO.presupuestoCompraAutorizado
            )}
          </strong>
        </div>

        <div
          style={{
            padding: "18px",
            borderRadius: "16px",
            background:
              "rgba(255,255,255,0.10)",
            border:
              "1px solid rgba(255,255,255,0.18)",
          }}
        >
          <div>🏦 Reserva protegida</div>

          <strong
            style={{
              display: "block",
              marginTop: "8px",
              fontSize: "22px",
            }}
          >
            {formatearDinero(
              decisionCEO.reservaRecomendada
            )}
          </strong>
        </div>
      </div>

      <div
        style={{
          marginTop: "26px",
          padding: "22px",
          borderRadius: "18px",
          background: "#ffffff",
          color: "#332d30",
        }}
      >
        <h3
          style={{
            margin: "0 0 6px",
            fontSize: "22px",
          }}
        >
          🎯 Decisiones finales del Consejo
        </h3>

        <p
          style={{
            marginTop: 0,
            color: "#74686e",
          }}
        >
          Finanzas, Comercial e Inventario
          fueron evaluados por el CEO IA.
        </p>

        <div
          style={{
            display: "grid",
            gap: "12px",
            marginTop: "18px",
          }}
        >
          {decisiones.length === 0 ? (
            <div>
              No hay decisiones ejecutivas
              pendientes con la información actual.
            </div>
          ) : (
            decisiones.map(
              (decision, index) => {
                const estilo =
                  obtenerEstiloPrioridad(
                    decision.prioridad
                  );

                return (
                  <article
                    key={`${decision.titulo}-${index}`}
                    style={{
                      padding: "16px",
                      borderRadius: "14px",
                      backgroundColor:
                        estilo.fondo,
                      border:
                        `1px solid ${estilo.borde}`,
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        justifyContent:
                          "space-between",
                        gap: "12px",
                        flexWrap: "wrap",
                      }}
                    >
                      <strong
                        style={{
                          color:
                            estilo.color,
                        }}
                      >
                        {estilo.icono}{" "}
                        PRIORIDAD {index + 1}:{" "}
                        {decision.titulo}
                      </strong>

                      <span
                        style={{
                          fontSize: "13px",
                          fontWeight: "700",
                        }}
                      >
                        {decision.area}
                      </span>
                    </div>

                    <p
                      style={{
                        marginBottom: 0,
                        lineHeight: "1.6",
                      }}
                    >
                      {decision.descripcion}
                    </p>
                  </article>
                );
              }
            )
          )}
        </div>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns:
            "repeat(auto-fit, minmax(280px, 1fr))",
          gap: "16px",
          marginTop: "20px",
        }}
      >
        <div
          style={{
            padding: "20px",
            borderRadius: "17px",
            background: "#effbf3",
            color: "#332d30",
            border:
              "1px solid #b8dfc6",
          }}
        >
          <h3
            style={{
              marginTop: 0,
              color: "#207a4a",
            }}
          >
            ✅ Compras autorizadas
          </h3>

          {comprasAutorizadas.length ===
          0 ? (
            <p>
              No hay compras autorizadas
              actualmente.
            </p>
          ) : (
            comprasAutorizadas
              .slice(0, 5)
              .map(
                (producto, index) => (
                  <div
                    key={`${producto.codigo}-${index}`}
                    style={{
                      padding: "10px 0",
                      borderBottom:
                        "1px solid #d7eadc",
                    }}
                  >
                    <strong>
                      {producto.descripcion}
                    </strong>

                    <div
                      style={{
                        marginTop: "4px",
                        fontSize: "14px",
                      }}
                    >
                      Comprar{" "}
                      {
                        producto.cantidadSugerida
                      }{" "}
                      piezas ·{" "}
                      {formatearDinero(
                        producto.inversionEstimada
                      )}
                    </div>
                  </div>
                )
              )
          )}
        </div>

        <div
          style={{
            padding: "20px",
            borderRadius: "17px",
            background: "#fff8ef",
            color: "#332d30",
            border:
              "1px solid #ecd7aa",
          }}
        >
          <h3
            style={{
              marginTop: 0,
              color: "#8a6800",
            }}
          >
            ⏳ Compras pospuestas
          </h3>

          <p
            style={{
              fontSize: "26px",
              fontWeight: "800",
              marginBottom: "5px",
            }}
          >
            {comprasPospuestas.length}
          </p>

          <p
            style={{
              marginBottom: 0,
              lineHeight: "1.6",
            }}
          >
            Sugerencias fueron pospuestas
            para proteger la liquidez y
            priorizar lo más importante.
          </p>
        </div>
      </div>

   <CentroAccionesCEO
  decisiones={decisiones}
/>
      
    </section>
  );
}

export default PanelCEOIA;