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

function obtenerSaludo() {
  const hora = new Date().getHours();

  if (hora < 12) {
    return "Buenos días";
  }

  if (hora < 19) {
    return "Buenas tardes";
  }

  return "Buenas noches";
}

function obtenerFechaActual() {
  return new Intl.DateTimeFormat("es-MX", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date());
}

function crearResumen({
  porcentajeSalud,
  ventasTotales,
  utilidadTotal,
  balance,
}) {
  if (
    ventasTotales <= 0 &&
    utilidadTotal <= 0 &&
    balance === 0
  ) {
    return (
      "Todavía no existe suficiente información para preparar " +
      "un resumen completo. Importa las ventas de SICAR y registra " +
      "los movimientos de Tesorería."
    );
  }

  if (porcentajeSalud >= 80 && balance >= 0) {
    return (
      "El negocio presenta una condición favorable. " +
      "Las ventas y la liquidez permiten mantener la operación, " +
      "pero es importante continuar vigilando los gastos y las compras."
    );
  }

  if (porcentajeSalud >= 60) {
    return (
      "El negocio se encuentra estable, aunque existen áreas que " +
      "requieren atención. Conviene proteger el efectivo disponible " +
      "y priorizar únicamente las compras necesarias."
    );
  }

  return (
    "La operación requiere atención prioritaria. Antes de realizar " +
    "nuevas compras, revisa las salidas de dinero, el margen de utilidad " +
    "y las decisiones que puedan afectar la liquidez."
  );
}

function ResumenEjecutivo({
  saludNegocio = {},
  analisisFinanciero = {},
  datosDashboard = {},
}) {
  const metricas = datosDashboard?.metricas || {};

  const porcentajeSalud = convertirNumero(
    saludNegocio?.porcentajeGeneral
  );

  const ventasTotales = convertirNumero(
    metricas?.ventasTotales
  );

  const utilidadTotal = convertirNumero(
    metricas?.utilidadTotal
  );

  const balance = convertirNumero(
    analisisFinanciero?.balance
  );

  const resumen = crearResumen({
    porcentajeSalud,
    ventasTotales,
    utilidadTotal,
    balance,
  });

  return (
    <section
      style={{
        marginBottom: "24px",
        padding: "clamp(22px, 4vw, 32px)",
        borderRadius: "24px",
        background:
          "linear-gradient(135deg, #fff7fb 0%, #ffffff 55%, #f7fff9 100%)",
        border: "1px solid #ebc5d7",
        boxShadow:
          "0 12px 30px rgba(128, 54, 91, 0.08)",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          flexWrap: "wrap",
          gap: "22px",
        }}
      >
        <div
          style={{
            flex: "1 1 390px",
          }}
        >
          <p
            style={{
              margin: "0 0 7px",
              color: "#b44178",
              fontSize: "14px",
              fontWeight: "800",
              letterSpacing: "1.2px",
              textTransform: "uppercase",
            }}
          >
            👑 Resumen ejecutivo del día
          </p>

          <h2
            style={{
              margin: 0,
              color: "#2f252a",
              fontSize: "clamp(28px, 4vw, 40px)",
              lineHeight: "1.2",
            }}
          >
            {obtenerSaludo()}, Jefa.
          </h2>

          <p
            style={{
              margin: "9px 0 0",
              color: "#766970",
              fontSize: "16px",
              textTransform: "capitalize",
            }}
          >
            {obtenerFechaActual()}
          </p>

          <p
            style={{
              margin: "22px 0 0",
              color: "#493d43",
              fontSize: "17px",
              fontWeight: "600",
              lineHeight: "1.75",
            }}
          >
            {resumen}
          </p>
        </div>

        <div
          style={{
            flex: "0 1 300px",
            width: "100%",
            padding: "22px",
            borderRadius: "20px",
            backgroundColor: "#ffffff",
            border: "1px solid #ead7e0",
          }}
        >
          <p
            style={{
              margin: "0 0 16px",
              color: "#6f6068",
              fontSize: "14px",
              fontWeight: "800",
              letterSpacing: "0.8px",
            }}
          >
            PANORAMA ACTUAL
          </p>

          <div
            style={{
              display: "grid",
              gap: "15px",
            }}
          >
            <div>
              <span
                style={{
                  color: "#81747a",
                  fontSize: "14px",
                }}
              >
                ❤️ Salud del negocio
              </span>

              <strong
                style={{
                  display: "block",
                  marginTop: "3px",
                  color: "#2f252a",
                  fontSize: "24px",
                }}
              >
                {porcentajeSalud}%
              </strong>
            </div>

            <div>
              <span
                style={{
                  color: "#81747a",
                  fontSize: "14px",
                }}
              >
                🛒 Ventas analizadas
              </span>

              <strong
                style={{
                  display: "block",
                  marginTop: "3px",
                  color: "#2f252a",
                  fontSize: "21px",
                }}
              >
                {formatearDinero(ventasTotales)}
              </strong>
            </div>

            <div>
              <span
                style={{
                  color: "#81747a",
                  fontSize: "14px",
                }}
              >
                💵 Dinero disponible
              </span>

              <strong
                style={{
                  display: "block",
                  marginTop: "3px",
                  color:
                    balance >= 0 ? "#207a4a" : "#a52d2d",
                  fontSize: "21px",
                }}
              >
                {formatearDinero(balance)}
              </strong>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

export default ResumenEjecutivo;