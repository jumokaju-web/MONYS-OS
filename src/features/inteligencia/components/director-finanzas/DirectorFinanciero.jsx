// ======================================================
// MONYS ERP AI
// Director Financiero IA
// ======================================================

import TarjetaIndicador from "../shared/TarjetaIndicador";
import { generarAnalisisFinanciero } from "../../ia/directorFinancieroIA";

function DirectorFinanciero({
  datosDashboard,
  movimientos = [],
}) {
  /*
    Información proveniente de la última
    importación disponible de SICAR.
  */
  const metricas = datosDashboard?.metricas;

  /*
    El motor financiero recibe los datos reales
    y devuelve todos los cálculos y diagnósticos.
  */
  const analisisFinanciero =
    generarAnalisisFinanciero({
      movimientos,
      ventasTotales:
        metricas?.ventasTotales ?? 0,
      costoTotal:
        metricas?.costoTotal ?? 0,
      utilidadTotal:
        metricas?.utilidadTotal ?? 0,
      margenUtilidad:
        metricas?.margenUtilidad ?? 0,
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
    nivel,
    estado,
    mensaje,
    recomendacion,
  } = analisisFinanciero;

  /*
    Da formato de pesos mexicanos
    a todas las cantidades.
  */
  const formatoDinero = (cantidad) =>
    new Intl.NumberFormat("es-MX", {
      style: "currency",
      currency: "MXN",
      minimumFractionDigits: 2,
    }).format(Number(cantidad) || 0);

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
        }}
      >
        Resultados calculados con la última
        importación disponible.
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
          valor={`${margenUtilidad.toFixed(2)} %`}
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

      <p
        style={{
          marginTop: 0,
          color: "#756d62",
        }}
      >
        Calculado con las entradas y salidas
        registradas en MONYS OS.
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
      </div>

      <div
        style={{
          marginTop: "18px",
          display: "grid",
          gridTemplateColumns:
            "repeat(auto-fit, minmax(240px, 1fr))",
          gap: "16px",
        }}
      >
        <TarjetaIndicador
          titulo="Porcentaje utilizado"
          valor={`${porcentajeGastos.toFixed(2)} %`}
          subtitulo="Porcentaje de las entradas destinado a salidas."
          icono="📉"
          color="#fffdf8"
        />

        <TarjetaIndicador
          titulo="Saldo del flujo"
          valor={formatoDinero(
            dineroDisponible
          )}
          subtitulo="Resultado de entradas menos salidas registradas."
          icono="⚖️"
          color="#fffdf8"
        />
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
            color: "#5f584e",
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
            color: "#5f584e",
          }}
        >
          {recomendacion}
        </p>
      </div>
    </section>
  );
}

export default DirectorFinanciero;