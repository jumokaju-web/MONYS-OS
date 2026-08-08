function convertirNumero(valor) {
  const numero = Number(valor);

  if (!Number.isFinite(numero)) {
    return 0;
  }

  return numero;
}

function crearPrioridades({
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

  const capacidadCompra = convertirNumero(
    analisisFinanciero?.capacidadCompra
  );

  const porcentajeSalidas = convertirNumero(
    analisisFinanciero?.porcentajeSalidas
  );

  const porcentajeSalud = convertirNumero(
    saludNegocio?.porcentajeGeneral
  );

  const prioridades = [];

  if (balance < 0) {
    prioridades.push({
      nivel: "urgente",
      icono: "🔴",
      titulo: "Recuperar el flujo de efectivo",
      descripcion:
        "Las salidas superan las entradas. Revisa pagos, gastos y cobros antes de autorizar nuevas compras.",
      accion: "Revisar Tesorería",
    });
  }

  if (margenUtilidad > 0 && margenUtilidad < 25) {
    prioridades.push({
      nivel: "alta",
      icono: "🟠",
      titulo: "Proteger el margen de utilidad",
      descripcion:
        `El margen actual es de ${margenUtilidad.toFixed(2)}%. ` +
        "Analiza costos, promociones y precios de venta.",
      accion: "Revisar márgenes",
    });
  }

  if (
    porcentajeSalidas >= 80 &&
    balance >= 0
  ) {
    prioridades.push({
      nivel: "alta",
      icono: "🟠",
      titulo: "Controlar las salidas de dinero",
      descripcion:
        `${porcentajeSalidas.toFixed(2)}% de las entradas ya fue utilizado. ` +
        "Evita gastos que no sean indispensables.",
      accion: "Controlar gastos",
    });
  }

  if (
    capacidadCompra > 0 &&
    balance > 0
  ) {
    prioridades.push({
      nivel: "media",
      icono: "🟡",
      titulo: "Usar con prudencia la capacidad de compra",
      descripcion:
        `Existe una capacidad estimada de compra de ${formatearDinero(
          capacidadCompra
        )}. Prioriza únicamente productos con buena rotación.`,
      accion: "Planear compras",
    });
  }

  if (ventasTotales <= 0) {
    prioridades.push({
      nivel: "media",
      icono: "🟡",
      titulo: "Actualizar ventas de SICAR",
      descripcion:
        "Importa el reporte de ventas para que los directores IA puedan analizar el desempeño comercial.",
      accion: "Importar reporte",
    });
  }

  if (
    porcentajeSalud >= 80 &&
    balance >= 0 &&
    margenUtilidad >= 25
  ) {
    prioridades.push({
      nivel: "positiva",
      icono: "🟢",
      titulo: "Mantener la operación saludable",
      descripcion:
        "Los indicadores actuales son favorables. Conserva el control de gastos y enfoca las compras en productos rentables.",
      accion: "Dar seguimiento",
    });
  }

  if (prioridades.length === 0) {
    prioridades.push({
      nivel: "informativa",
      icono: "🔵",
      titulo: "Completar la información del día",
      descripcion:
        "Registra movimientos e importa ventas para generar prioridades más precisas.",
      accion: "Actualizar datos",
    });
  }

  return prioridades.slice(0, 3);
}

function formatearDinero(valor) {
  return new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency: "MXN",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(convertirNumero(valor));
}

function obtenerEstilo(nivel) {
  const estilos = {
    urgente: {
      fondo: "#fff0f0",
      borde: "#efb8b8",
      color: "#a52d2d",
      etiqueta: "URGENTE",
    },
    alta: {
      fondo: "#fff3ea",
      borde: "#f1c5a7",
      color: "#a14f0d",
      etiqueta: "ALTA",
    },
    media: {
      fondo: "#fff9e6",
      borde: "#efd98e",
      color: "#806500",
      etiqueta: "MEDIA",
    },
    positiva: {
      fondo: "#eefaf2",
      borde: "#bfe6cc",
      color: "#207a4a",
      etiqueta: "SEGUIMIENTO",
    },
    informativa: {
      fondo: "#f2f7ff",
      borde: "#c6d8f2",
      color: "#315d91",
      etiqueta: "INFORMATIVA",
    },
  };

  return estilos[nivel] || estilos.informativa;
}

function PrioridadesHoy({
  datosDashboard = {},
  analisisFinanciero = {},
  saludNegocio = {},
}) {
  const prioridades = crearPrioridades({
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
          DECISIONES MÁS IMPORTANTES
        </p>

        <h2
          style={{
            margin: 0,
            color: "#2f252a",
            fontSize: "clamp(24px, 4vw, 32px)",
          }}
        >
          🎯 Prioridades del día
        </h2>

        <p
          style={{
            margin: "9px 0 0",
            color: "#766970",
            lineHeight: "1.6",
          }}
        >
          Acciones recomendadas según la información actual.
        </p>
      </div>

      <div
        style={{
          display: "grid",
          gap: "15px",
        }}
      >
        {prioridades.map((prioridad, indice) => {
          const estilo = obtenerEstilo(
            prioridad.nivel
          );

          return (
            <article
              key={`${prioridad.titulo}-${indice}`}
              style={{
                padding: "20px",
                borderRadius: "18px",
                backgroundColor: estilo.fondo,
                border: `1px solid ${estilo.borde}`,
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "flex-start",
                  gap: "15px",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    flexShrink: 0,
                    width: "44px",
                    height: "44px",
                    borderRadius: "14px",
                    backgroundColor: "#ffffff",
                    fontSize: "22px",
                  }}
                >
                  {prioridad.icono}
                </div>

                <div
                  style={{
                    flex: 1,
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      flexWrap: "wrap",
                      gap: "10px",
                    }}
                  >
                    <h3
                      style={{
                        margin: 0,
                        color: estilo.color,
                        fontSize: "18px",
                      }}
                    >
                      {indice + 1}. {prioridad.titulo}
                    </h3>

                    <span
                      style={{
                        padding: "6px 10px",
                        borderRadius: "999px",
                        backgroundColor: "#ffffff",
                        color: estilo.color,
                        fontSize: "12px",
                        fontWeight: "800",
                        letterSpacing: "0.6px",
                      }}
                    >
                      {estilo.etiqueta}
                    </span>
                  </div>

                  <p
                    style={{
                      margin: "9px 0 0",
                      color: "#55494f",
                      lineHeight: "1.65",
                    }}
                  >
                    {prioridad.descripcion}
                  </p>

                  <p
                    style={{
                      margin: "12px 0 0",
                      color: estilo.color,
                      fontSize: "14px",
                      fontWeight: "800",
                    }}
                  >
                    Acción sugerida: {prioridad.accion}
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

export default PrioridadesHoy;