// ======================================================
// MONYS OS
// Director Financiero IA
// ======================================================

import TarjetaIndicador from "../shared/TarjetaIndicador";
import { generarAnalisisFinanciero } from "../../ia/directorFinancieroIA";

function DirectorFinanciero({
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

  const {
    ventasTotales,
    costoTotal,
    utilidadTotal,
    margenUtilidad,

    entradasTesoreria,
    salidasTesoreria,
    dineroDisponible,

    movimientosPendientes,
    porcentajeGastos,

    proyeccionVentasMes,
    proyeccionUtilidadMes,

    reservaRecomendada,
    capacidadCompra,

    alertasFinancieras = [],
    decisionPrioritaria,

    accionesPrioritarias = [],

    nivel,
    estado,
    mensaje,
    recomendacion,
  } = analisisFinanciero;

  const formatoDinero = (cantidad) =>
    new Intl.NumberFormat("es-MX", {
      style: "currency",
      currency: "MXN",
      minimumFractionDigits: 2,
    }).format(Number(cantidad) || 0);

  const formatoPorcentaje = (cantidad) =>
    `${(Number(cantidad) || 0).toFixed(2)} %`;

  const colorPrioridad = (prioridad) => {
    if (prioridad === "CRITICA") {
      return {
        fondo: "#fff0f0",
        borde: "#efaaaa",
        icono: "🔴",
      };
    }

    if (prioridad === "ALTA") {
      return {
        fondo: "#fff7ed",
        borde: "#f4c58d",
        icono: "🟠",
      };
    }

    if (prioridad === "MEDIA") {
      return {
        fondo: "#fffde8",
        borde: "#e8d77b",
        icono: "🟡",
      };
    }

    return {
      fondo: "#f2fff6",
      borde: "#b5dfc1",
      icono: "🟢",
    };
  };

  return (
    <section
      style={{
        marginTop: "30px",
        padding: "28px",
        borderRadius: "22px",
        background:
          "linear-gradient(135deg, #ffffff 0%, #fff8ef 100%)",
        border: "1px solid #f3d19c",
        boxShadow:
          "0 12px 35px rgba(180, 120, 40, 0.12)",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          gap: "16px",
          flexWrap: "wrap",
        }}
      >
        <div>
          <p
            style={{
              margin: 0,
              color: "#9a6a29",
              fontWeight: "700",
            }}
          >
            MONYS OS · ANÁLISIS FINANCIERO
          </p>

          <h2
            style={{
              margin: "8px 0 0",
              fontSize: "28px",
            }}
          >
            💰 Informe del Director Financiero IA
          </h2>
        </div>

        <span
          style={{
            padding: "9px 14px",
            borderRadius: "999px",
            backgroundColor: "#ffffff",
            border: "1px solid #ead19f",
            fontWeight: "700",
          }}
        >
          {nivel} {estado}
        </span>
      </div>

      <h3
        style={{
          marginTop: "28px",
          marginBottom: "4px",
          fontSize: "20px",
        }}
      >
        Información de ventas SICAR
      </h3>

      <p
        style={{
          marginTop: 0,
          color: "#756d62",
          lineHeight: "1.7",
        }}
      >
        Resultados calculados con la última
        información disponible.
        <br />

        📅 Periodo analizado:{" "}
        <strong>
          {metricas.fechaInicial
            ? new Date(
                metricas.fechaInicial
              ).toLocaleDateString("es-MX")
            : "Sin fecha"}
        </strong>

        {" "}a{" "}

        <strong>
          {metricas.fechaFinal
            ? new Date(
                metricas.fechaFinal
              ).toLocaleDateString("es-MX")
            : "Sin fecha"}
        </strong>

        {" · "}

        🗓️{" "}
        <strong>
          {Number(
            metricas.diasAnalizados
          ) || 0} días analizados
        </strong>

        <br />

        💵 Venta promedio diaria:{" "}
        <strong>
          {formatoDinero(
            metricas.ventaPromedioDiaria
          )}
        </strong>

        {" · "}

        📈 Utilidad promedio diaria:{" "}
        <strong>
          {formatoDinero(
            metricas.utilidadPromedioDiaria
          )}
        </strong>
      </p>

      <div
        style={{
          display: "grid",
          gridTemplateColumns:
            "repeat(auto-fit, minmax(210px, 1fr))",
          gap: "16px",
          marginTop: "18px",
        }}
      >
        <TarjetaIndicador
          titulo="Ventas Totales"
          valor={formatoDinero(ventasTotales)}
          icono="🛒"
        />

        <TarjetaIndicador
          titulo="Costo Total"
          valor={formatoDinero(costoTotal)}
          icono="🏷️"
        />

        <TarjetaIndicador
          titulo="Utilidad Total"
          valor={formatoDinero(utilidadTotal)}
          icono="📈"
        />

        <TarjetaIndicador
          titulo="Margen"
          valor={formatoPorcentaje(
            margenUtilidad
          )}
          icono="📊"
        />
      </div>

      <h3
        style={{
          marginTop: "30px",
          marginBottom: "4px",
          fontSize: "20px",
        }}
      >
        Flujo real de Tesorería
      </h3>

      <div
        style={{
          display: "grid",
          gridTemplateColumns:
            "repeat(auto-fit, minmax(210px, 1fr))",
          gap: "16px",
          marginTop: "18px",
        }}
      >
        <TarjetaIndicador
          titulo="Entradas"
          valor={formatoDinero(
            entradasTesoreria
          )}
          icono="📥"
        />

        <TarjetaIndicador
          titulo="Salidas"
          valor={formatoDinero(
            salidasTesoreria
          )}
          icono="📤"
        />

        <TarjetaIndicador
          titulo="Disponible"
          valor={formatoDinero(
            dineroDisponible
          )}
          icono="💵"
        />

        <TarjetaIndicador
          titulo="Movimientos pendientes"
          valor={String(
            movimientosPendientes
          )}
          icono="⏳"
        />

        <TarjetaIndicador
          titulo="Porcentaje utilizado"
          valor={formatoPorcentaje(
            porcentajeGastos
          )}
          icono="📉"
        />
      </div>

      <h3
        style={{
          marginTop: "32px",
          marginBottom: "4px",
          fontSize: "20px",
        }}
      >
        Proyección y capacidad financiera
      </h3>

      <div
        style={{
          display: "grid",
          gridTemplateColumns:
            "repeat(auto-fit, minmax(210px, 1fr))",
          gap: "16px",
          marginTop: "18px",
        }}
      >
        <TarjetaIndicador
          titulo="Proyección ventas del mes"
          valor={formatoDinero(
            proyeccionVentasMes
          )}
          icono="📅"
        />

        <TarjetaIndicador
          titulo="Proyección utilidad del mes"
          valor={formatoDinero(
            proyeccionUtilidadMes
          )}
          icono="📈"
        />

        <TarjetaIndicador
          titulo="Capacidad de compra sugerida"
          valor={formatoDinero(
            capacidadCompra
          )}
          icono="🛒"
        />

        <TarjetaIndicador
          titulo="Reserva recomendada"
          valor={formatoDinero(
            reservaRecomendada
          )}
          icono="🏦"
        />
      </div>

      {/* ============================================= */}
      {/* ACCIONES PRIORITARIAS */}
      {/* ============================================= */}

      <div
        style={{
          marginTop: "32px",
          padding: "24px",
          borderRadius: "20px",
          background:
            "linear-gradient(135deg, #fff 0%, #fff5f8 100%)",
          border: "2px solid #e8b8ca",
        }}
      >
        <h2
          style={{
            margin: 0,
            fontSize: "24px",
          }}
        >
          🎯 Acciones Prioritarias de Hoy
        </h2>

        <p
          style={{
            marginTop: "8px",
            color: "#756d62",
          }}
        >
          Ordenadas automáticamente por urgencia
          e impacto financiero.
        </p>

        <div
          style={{
            display: "grid",
            gap: "14px",
            marginTop: "20px",
          }}
        >
          {accionesPrioritarias.map(
            (accion, indice) => {
              const estilo =
                colorPrioridad(
                  accion.prioridad
                );

              return (
                <article
                  key={`${accion.titulo}-${indice}`}
                  style={{
                    padding: "18px",
                    borderRadius: "15px",
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
                      gap: "15px",
                      flexWrap: "wrap",
                    }}
                  >
                    <strong
                      style={{
                        fontSize: "17px",
                      }}
                    >
                      {estilo.icono}{" "}
                      PRIORIDAD {indice + 1}:{" "}
                      {accion.titulo}
                    </strong>

                    <span
                      style={{
                        fontSize: "13px",
                        fontWeight: "700",
                      }}
                    >
                      Impacto: {accion.impacto}
                    </span>
                  </div>

                  <p
                    style={{
                      lineHeight: "1.6",
                      marginBottom: "8px",
                    }}
                  >
                    {accion.descripcion}
                  </p>

                  <small
                    style={{
                      color: "#756d62",
                    }}
                  >
                    Responsable:{" "}
                    {accion.responsable}
                  </small>
                </article>
              );
            }
          )}
        </div>
      </div>

      <div
        style={{
          marginTop: "24px",
          padding: "22px",
          borderRadius: "16px",
          backgroundColor: "#fff7df",
          border: "1px solid #ecd392",
        }}
      >
        <strong
          style={{
            fontSize: "18px",
          }}
        >
          🎯 Decisión prioritaria del CFO
        </strong>

        <p
          style={{
            marginBottom: 0,
            lineHeight: "1.7",
          }}
        >
          {decisionPrioritaria}
        </p>
      </div>

      <div
        style={{
          marginTop: "18px",
          padding: "22px",
          borderRadius: "16px",
          backgroundColor:
            alertasFinancieras.length > 0
              ? "#fff4f4"
              : "#f3fff7",
          border:
            alertasFinancieras.length > 0
              ? "1px solid #efc2c2"
              : "1px solid #bfe2ca",
        }}
      >
        <strong
          style={{
            fontSize: "18px",
          }}
        >
          🚨 Alertas financieras
        </strong>

        {alertasFinancieras.length === 0 ? (
          <p>
            No se detectaron alertas financieras
            críticas.
          </p>
        ) : (
          <ul>
            {alertasFinancieras.map(
              (alerta, indice) => (
                <li key={indice}>
                  {alerta}
                </li>
              )
            )}
          </ul>
        )}
      </div>

      <div
        style={{
          marginTop: "24px",
          padding: "20px",
          borderRadius: "16px",
          backgroundColor: "#ffffff",
          border: "1px solid #f2dfbb",
        }}
      >
        <strong
          style={{
            fontSize: "18px",
          }}
        >
          {nivel} Diagnóstico financiero
        </strong>

        <p
          style={{
            marginBottom: 0,
            lineHeight: "1.7",
          }}
        >
          {mensaje}
        </p>
      </div>

      <div
        style={{
          marginTop: "18px",
          padding: "20px",
          borderRadius: "16px",
          backgroundColor: "#fffdf8",
          border: "1px solid #f2dfbb",
        }}
      >
        <strong
          style={{
            fontSize: "18px",
          }}
        >
          📋 Recomendación del Director Financiero
        </strong>

        <p
          style={{
            marginBottom: 0,
            lineHeight: "1.7",
          }}
        >
          {recomendacion}
        </p>
      </div>
    </section>
  );
}

export default DirectorFinanciero;