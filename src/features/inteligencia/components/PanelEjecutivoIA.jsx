import { crearContextoInteligencia } from "../shared/crearContextoInteligencia";
import { analizarFinanzas } from "../shared/analizarFinanzas";
import { calcularSaludNegocio } from "../shared/calcularSaludNegocio";
import ResumenEjecutivo from "./ResumenEjecutivo";
import PrioridadesHoy from "./PrioridadesHoy";
import AlertasIA from "./AlertasIA";
import IndicadoresCEO from "./IndicadoresCEO";
import MensajeDirector from "./MensajeDirector";

function convertirNumero(valor) {
  const numero = Number(valor);

  if (!Number.isFinite(numero)) {
    return 0;
  }

  return numero;
}

function formatearDinero(valor) {
  return new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency: "MXN",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(convertirNumero(valor));
}

function formatearPorcentaje(valor) {
  return `${convertirNumero(valor).toFixed(2)}%`;
}

function obtenerEstiloRiesgo(nivel) {
  const estilos = {
    bajo: {
      icono: "🟢",
      fondo: "#eaf8f0",
      color: "#207a4a",
      borde: "#b8e5ca",
    },

    medio: {
      icono: "🟡",
      fondo: "#fff8df",
      color: "#8a6800",
      borde: "#f2dc8b",
    },

    alto: {
      icono: "🟠",
      fondo: "#fff0e4",
      color: "#a14f0d",
      borde: "#f3c59e",
    },

    critico: {
      icono: "🔴",
      fondo: "#fff0f0",
      color: "#a52d2d",
      borde: "#efb8b8",
    },

    "sin-datos": {
      icono: "⚪",
      fondo: "#f5f3f4",
      color: "#6f666a",
      borde: "#ddd7da",
    },
  };

  return estilos[nivel] || estilos["sin-datos"];
}

function TarjetaEjecutiva({
  icono,
  titulo,
  valor,
  detalle,
}) {
  return (
    <article
      style={{
        minHeight: "150px",
        padding: "22px",
        borderRadius: "18px",
        backgroundColor: "#ffffff",
        border: "1px solid #efd6e2",
        boxShadow:
          "0 8px 22px rgba(111, 53, 82, 0.07)",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "11px",
          marginBottom: "15px",
        }}
      >
        <span
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            width: "44px",
            height: "44px",
            borderRadius: "13px",
            backgroundColor: "#fff0f7",
            fontSize: "22px",
          }}
        >
          {icono}
        </span>

        <p
          style={{
            margin: 0,
            color: "#74636c",
            fontWeight: "700",
          }}
        >
          {titulo}
        </p>
      </div>

      <p
        style={{
          margin: 0,
          color: "#2f252a",
          fontSize: "clamp(24px, 3vw, 34px)",
          fontWeight: "800",
        }}
      >
        {valor}
      </p>

      {detalle && (
        <p
          style={{
            margin: "10px 0 0",
            color: "#81747a",
            fontSize: "14px",
            lineHeight: "1.5",
          }}
        >
          {detalle}
        </p>
      )}
    </article>
  );
}

function PanelEjecutivoIA({
  datosDashboard,
  movimientos = [],
}) {
  const contexto = crearContextoInteligencia({
    datosDashboard,
    movimientos,
  });

  const analisis = analizarFinanzas(contexto);

  const saludNegocio = calcularSaludNegocio({
  datosDashboard,
  analisisFinanciero: analisis,
});

  const metricas = datosDashboard?.metricas || {};

  const ventasTotales = convertirNumero(
    metricas?.ventasTotales
  );

  const costoTotal = convertirNumero(
    metricas?.costoTotal
  );

  const utilidadTotal = convertirNumero(
    metricas?.utilidadTotal
  );

  const margenUtilidad = convertirNumero(
    metricas?.margenUtilidad
  );

  const estiloRiesgo = obtenerEstiloRiesgo(
    analisis.nivelRiesgo?.nivel
  );

  const tieneDatosSicar =
    ventasTotales > 0 ||
    costoTotal > 0 ||
    utilidadTotal > 0;

  const tieneMovimientos =
    contexto.tieneMovimientos;


  return (
    <section
      style={{
        marginTop: "30px",
        marginBottom: "30px",
        padding: "clamp(20px, 4vw, 32px)",
        borderRadius: "24px",
        background:
          "linear-gradient(135deg, #fff7fb 0%, #ffffff 100%)",
        border: "1px solid #e8b9d0",
        boxShadow:
          "0 12px 30px rgba(180, 65, 120, 0.10)",
      }}
    >
      <div
        style={{
          marginBottom: "26px",
          padding: "clamp(20px, 4vw, 28px)",
          borderRadius: "22px",
          background:
            "linear-gradient(135deg, #f3fff6 0%, #ffffff 100%)",
          border: "2px solid #d9f1df",
          boxShadow:
            "0 12px 28px rgba(34, 139, 34, 0.08)",
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            flexWrap: "wrap",
            gap: "22px",
          }}
        >
          <div>
            <p
              style={{
                margin: 0,
                color: "#2b8a3e",
                fontSize: "14px",
                fontWeight: "800",
                letterSpacing: "1.2px",
              }}
            >
              ❤️ SALUD GENERAL DEL NEGOCIO
            </p>

            <p
              style={{
                margin: "8px 0 2px",
                color: "#2f252a",
                fontSize: "clamp(42px, 7vw, 58px)",
                fontWeight: "900",
                lineHeight: "1",
              }}
            >
              {saludNegocio.porcentajeGeneral}%
            </p>

            <h3
              style={{
                margin: "10px 0 0",
                color: "#3d3d3d",
                fontSize: "20px",
              }}
            >
              {saludNegocio.icono} {saludNegocio.estado}
            </h3>
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns:
                "repeat(auto-fit, minmax(150px, 1fr))",
              gap: "12px",
              flex: "1 1 330px",
              maxWidth: "470px",
            }}
          >
            <div
              style={{
                padding: "16px",
                borderRadius: "15px",
                backgroundColor: "#ffffff",
                border: "1px solid #d9f1df",
              }}
            >
              <p
                style={{
                  margin: "0 0 6px",
                  color: "#6f6469",
                  fontSize: "14px",
                  fontWeight: "700",
                }}
              >
                📈 Salud de ventas
              </p>

              <strong
                style={{
                  color: "#2f252a",
                  fontSize: "25px",
                }}
              >
                {saludNegocio.saludVentas}%
              </strong>
            </div>

            <div
              style={{
                padding: "16px",
                borderRadius: "15px",
                backgroundColor: "#ffffff",
                border: "1px solid #d9f1df",
              }}
            >
              <p
                style={{
                  margin: "0 0 6px",
                  color: "#6f6469",
                  fontSize: "14px",
                  fontWeight: "700",
                }}
              >
                💰 Salud de liquidez
              </p>

              <strong
                style={{
                  color: "#2f252a",
                  fontSize: "25px",
                }}
              >
                {saludNegocio.saludLiquidez}%
              </strong>
            </div>
          </div>
        </div>

        <div
          style={{
            marginTop: "20px",
            padding: "18px",
            borderRadius: "16px",
            backgroundColor: "#ffffff",
            border: "1px solid #d9f1df",
          }}
        >
          <strong
            style={{
              color: "#2b8a3e",
              fontSize: "14px",
              letterSpacing: "0.8px",
            }}
          >
            🧠 DIRECTOR GENERAL IA
          </strong>

          <p
            style={{
              margin: "10px 0 0",
              color: "#40363b",
              fontSize: "16px",
              fontWeight: "600",
              lineHeight: "1.7",
            }}
          >
            {saludNegocio.recomendacion}
          </p>
        </div>
      </div>

      <ResumenEjecutivo
        saludNegocio={saludNegocio}
        analisisFinanciero={analisis}
        datosDashboard={datosDashboard}
      />

      <div
        style={{
          display: "grid",
          gridTemplateColumns:
            "repeat(auto-fit, minmax(320px, 1fr))",
          gap: "20px",
          alignItems: "start",
        }}
      >
        <PrioridadesHoy
          saludNegocio={saludNegocio}
          analisisFinanciero={analisis}
          datosDashboard={datosDashboard}
        />

        <AlertasIA
          saludNegocio={saludNegocio}
          analisisFinanciero={analisis}
          datosDashboard={datosDashboard}
        />
      </div>

      <IndicadoresCEO
        saludNegocio={saludNegocio}
        analisisFinanciero={analisis}
        datosDashboard={datosDashboard}
      />

      <MensajeDirector
        saludNegocio={saludNegocio}
        analisisFinanciero={analisis}
        datosDashboard={datosDashboard}
      />

      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          justifyContent: "space-between",
          alignItems: "center",
          gap: "15px",
          marginBottom: "26px",
        }}
      >
        <div>
          <p
            style={{
              margin: "0 0 6px",
              color: "#b44178",
              fontSize: "14px",
              fontWeight: "800",
              letterSpacing: "1.5px",
            }}
          >
            MONYS OS · CENTRO DE MANDO
          </p>

          <h2
            style={{
              margin: 0,
              fontSize: "clamp(27px, 4vw, 36px)",
            }}
          >
            📊 Dashboard Ejecutivo IA
          </h2>

          <p
            style={{
              margin: "10px 0 0",
              color: "#6f6469",
              lineHeight: "1.6",
            }}
          >
            Resumen comercial y financiero del negocio.
          </p>
        </div>

        <div
          style={{
            padding: "12px 18px",
            borderRadius: "999px",
            backgroundColor: estiloRiesgo.fondo,
            color: estiloRiesgo.color,
            border: `1px solid ${estiloRiesgo.borde}`,
            fontWeight: "800",
          }}
        >
          {estiloRiesgo.icono}{" "}
          {analisis.nivelRiesgo?.etiqueta}
        </div>
      </div>

      <h3
        style={{
          margin: "0 0 16px",
          fontSize: "21px",
        }}
      >
        🛒 Resultados de ventas SICAR
      </h3>

      <div
        style={{
          display: "grid",
          gridTemplateColumns:
            "repeat(auto-fit, minmax(210px, 1fr))",
          gap: "17px",
        }}
      >
        <TarjetaEjecutiva
          icono="🛒"
          titulo="Ventas totales"
          valor={formatearDinero(ventasTotales)}
          detalle="Ventas de la última importación disponible."
        />

        <TarjetaEjecutiva
          icono="🏷️"
          titulo="Costo total"
          valor={formatearDinero(costoTotal)}
          detalle="Costo estimado de los productos vendidos."
        />

        <TarjetaEjecutiva
          icono="📈"
          titulo="Utilidad total"
          valor={formatearDinero(utilidadTotal)}
          detalle="Resultado de ventas menos costo."
        />

        <TarjetaEjecutiva
          icono="📊"
          titulo="Margen de utilidad"
          valor={formatearPorcentaje(
            margenUtilidad
          )}
          detalle="Porcentaje de utilidad sobre las ventas."
        />
      </div>

      <h3
        style={{
          margin: "30px 0 16px",
          fontSize: "21px",
        }}
      >
        💰 Flujo real de Tesorería
      </h3>

      <div
        style={{
          display: "grid",
          gridTemplateColumns:
            "repeat(auto-fit, minmax(210px, 1fr))",
          gap: "17px",
        }}
      >
        <TarjetaEjecutiva
          icono="📥"
          titulo="Entradas de dinero"
          valor={formatearDinero(
            analisis.totalEntradas
          )}
          detalle="Ingresos registrados y activos."
        />

        <TarjetaEjecutiva
          icono="📤"
          titulo="Salidas de dinero"
          valor={formatearDinero(
            analisis.totalSalidas
          )}
          detalle={`${analisis.porcentajeSalidas}% de las entradas registradas.`}
        />

        <TarjetaEjecutiva
          icono="💵"
          titulo="Dinero disponible"
          valor={formatearDinero(
            analisis.balance
          )}
          detalle="Resultado de entradas menos salidas."
        />

        <TarjetaEjecutiva
          icono="🛍️"
          titulo="Capacidad de compra"
          valor={formatearDinero(
            analisis.capacidadCompra
          )}
          detalle="Estimación prudente para proteger la liquidez."
        />

        <TarjetaEjecutiva
        icono="❤️"
        titulo="Salud financiera"
        valor={`${analisis.saludFinanciera}%`}
        detalle="Calificación general basada en flujo, salidas y nivel de riesgo."
        />

      </div>

      <div
        style={{
          marginTop: "22px",
          padding: "22px",
          borderRadius: "18px",
          backgroundColor: estiloRiesgo.fondo,
          border: `1px solid ${estiloRiesgo.borde}`,
        }}
      >
        <p
          style={{
            margin: "0 0 9px",
            color: estiloRiesgo.color,
            fontSize: "14px",
            fontWeight: "800",
            letterSpacing: "1px",
          }}
        >
          🧠 RECOMENDACIÓN DEL DIRECTOR FINANCIERO
        </p>

        <p
          style={{
            margin: 0,
            color: "#40363b",
            fontSize: "17px",
            lineHeight: "1.7",
            fontWeight: "600",
          }}
        >
          {analisis.recomendacion}
        </p>
      </div>

      {analisis.planAccion?.length > 0 && (
  <div
    style={{
      marginTop: "24px",
      paddingTop: "20px",
      borderTop: "1px solid #d9d9d9",
    }}
  >
    <p
      style={{
        margin: "0 0 12px",
        fontWeight: "700",
        fontSize: "18px",
        color: "#1f2937",
      }}
    >
      📋 PLAN DE ACCIÓN DEL DÍA
    </p>

    {analisis.planAccion.map((accion, index) => (
      <div
        key={index}
        style={{
          display: "flex",
          alignItems: "flex-start",
          gap: "10px",
          marginBottom: "10px",
          color: "#374151",
          lineHeight: "1.6",
        }}
      >
        <span>✅</span>
        <span>{accion}</span>
      </div>
    ))}
  </div>
)}

      {!tieneDatosSicar && (
        <p
          style={{
            margin: "18px 0 0",
            padding: "13px 16px",
            borderRadius: "12px",
            backgroundColor: "#fff8df",
            color: "#75600d",
            lineHeight: "1.5",
          }}
        >
          ℹ️ Todavía no hay información de ventas
          importada desde SICAR. Las primeras cuatro
          tarjetas se actualizarán cuando exista una
          importación disponible.
        </p>
      )}

      {!tieneMovimientos && (
        <p
          style={{
            margin: "12px 0 0",
            padding: "13px 16px",
            borderRadius: "12px",
            backgroundColor: "#f7f4f5",
            color: "#6d6267",
            lineHeight: "1.5",
          }}
        >
          ℹ️ Todavía no existen movimientos de Tesorería.
          El análisis financiero se actualizará cuando
          registres entradas y salidas.
        </p>
      )}
    </section>
  );
}

export default PanelEjecutivoIA;