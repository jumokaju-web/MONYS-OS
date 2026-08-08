function convertirNumero(valor) {
  const numero = Number(valor);

  if (!Number.isFinite(numero)) {
    return 0;
  }

  return numero;
}

function crearAlertas({
  datosDashboard = {},
  analisisFinanciero = {},
  saludNegocio = {},
}) {
  const metricas = datosDashboard?.metricas || {};

  const ventasTotales = convertirNumero(
    metricas?.ventasTotales
  );

  const margenUtilidad = convertirNumero(
    metricas?.margenUtilidad
  );

  const balance = convertirNumero(
    analisisFinanciero?.balance
  );

  const porcentajeSalidas = convertirNumero(
    analisisFinanciero?.porcentajeSalidas
  );

  const porcentajeSalud = convertirNumero(
    saludNegocio?.porcentajeGeneral
  );

  const alertas = [];

  if (ventasTotales <= 0) {
    alertas.push({
      nivel: "informativa",
      icono: "ℹ️",
      titulo: "Ventas SICAR pendientes",
      mensaje:
        "Todavía no existe una importación de ventas disponible para el análisis.",
    });
  }

  if (margenUtilidad > 0 && margenUtilidad < 25) {
    alertas.push({
      nivel: "alta",
      icono: "🔴",
      titulo: "Margen de utilidad reducido",
      mensaje:
        `El margen actual es de ${margenUtilidad.toFixed(2)}%. ` +
        "Revisa costos, descuentos y precios de venta.",
    });
  }

  if (balance < 0) {
    alertas.push({
      nivel: "critica",
      icono: "🚨",
      titulo: "Flujo de efectivo negativo",
      mensaje:
        "Las salidas superan las entradas. Evita nuevas compras hasta recuperar liquidez.",
    });
  }

  if (porcentajeSalidas >= 80 && balance >= 0) {
    alertas.push({
      nivel: "media",
      icono: "🟡",
      titulo: "Salidas de dinero elevadas",
      mensaje:
        `${porcentajeSalidas.toFixed(2)}% de las entradas ya fue utilizado. ` +
        "Conviene proteger el efectivo restante.",
    });
  }

  if (porcentajeSalud > 0 && porcentajeSalud < 60) {
    alertas.push({
      nivel: "alta",
      icono: "🔴",
      titulo: "Salud general en riesgo",
      mensaje:
        `La salud del negocio se encuentra en ${porcentajeSalud.toFixed(0)}%. ` +
        "Revisa las prioridades antes de tomar nuevas decisiones.",
    });
  }

  if (alertas.length === 0) {
    alertas.push({
      nivel: "positiva",
      icono: "✅",
      titulo: "Sin alertas críticas",
      mensaje:
        "Los indicadores actuales no muestran riesgos inmediatos. Mantén el seguimiento diario.",
    });
  }

  return alertas.slice(0, 4);
}

function obtenerEstilo(nivel) {
  const estilos = {
    critica: {
      fondo: "#fff0f0",
      borde: "#efb8b8",
      titulo: "#a52d2d",
    },
    alta: {
      fondo: "#fff3ea",
      borde: "#f1c5a7",
      titulo: "#a14f0d",
    },
    media: {
      fondo: "#fff9e6",
      borde: "#efd98e",
      titulo: "#806500",
    },
    informativa: {
      fondo: "#f2f7ff",
      borde: "#c6d8f2",
      titulo: "#315d91",
    },
    positiva: {
      fondo: "#eefaf2",
      borde: "#bfe6cc",
      titulo: "#207a4a",
    },
  };

  return estilos[nivel] || estilos.informativa;
}

function AlertasIA({
  datosDashboard = {},
  analisisFinanciero = {},
  saludNegocio = {},
}) {
  const alertas = crearAlertas({
    datosDashboard,
    analisisFinanciero,
    saludNegocio,
  });

  return (
    <section
      style={{
        marginBottom: "24px",
        padding: "clamp(22px, 4vw, 30px)",
        borderRadius: "24px",
        backgroundColor: "#ffffff",
        border: "1px solid #ecd4df",
        boxShadow:
          "0 10px 28px rgba(111, 53, 82, 0.07)",
      }}
    >
      <div
        style={{
          marginBottom: "20px",
        }}
      >
        <p
          style={{
            margin: "0 0 6px",
            color: "#b44178",
            fontSize: "14px",
            fontWeight: "800",
            letterSpacing: "1.2px",
          }}
        >
          MONITOREO AUTOMÁTICO
        </p>

        <h2
          style={{
            margin: 0,
            color: "#2f252a",
            fontSize: "clamp(24px, 4vw, 32px)",
          }}
        >
          🚨 Alertas inteligentes
        </h2>

        <p
          style={{
            margin: "9px 0 0",
            color: "#766970",
            lineHeight: "1.6",
          }}
        >
          Riesgos y situaciones que requieren seguimiento.
        </p>
      </div>

      <div
        style={{
          display: "grid",
          gap: "14px",
        }}
      >
        {alertas.map((alerta, indice) => {
          const estilo = obtenerEstilo(alerta.nivel);

          return (
            <article
              key={`${alerta.titulo}-${indice}`}
              style={{
                padding: "18px",
                borderRadius: "16px",
                backgroundColor: estilo.fondo,
                border: `1px solid ${estilo.borde}`,
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "flex-start",
                  gap: "13px",
                }}
              >
                <span
                  style={{
                    fontSize: "23px",
                    lineHeight: "1",
                  }}
                >
                  {alerta.icono}
                </span>

                <div>
                  <h3
                    style={{
                      margin: 0,
                      color: estilo.titulo,
                      fontSize: "17px",
                    }}
                  >
                    {alerta.titulo}
                  </h3>

                  <p
                    style={{
                      margin: "7px 0 0",
                      color: "#55494f",
                      lineHeight: "1.6",
                    }}
                  >
                    {alerta.mensaje}
                  </p>
                </div>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}

export default AlertasIA;