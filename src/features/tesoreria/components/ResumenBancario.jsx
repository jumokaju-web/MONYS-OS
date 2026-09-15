function formatearDinero(
  valor,
  formatoDinero,
  moneda = "MXN"
) {
  if (
    typeof formatoDinero ===
    "function"
  ) {
    return formatoDinero(valor);
  }

  return new Intl.NumberFormat(
    "es-MX",
    {
      style: "currency",
      currency: moneda,
    }
  ).format(valor);
}

function ResumenBancario({
  resumen = {
    cuentas: [],
    saldoTotal: 0,
  },
  cargando = false,
  error = "",
  formatoDinero,
}) {
  return (
    <section
      style={{
        maxWidth: "900px",
        margin: "24px auto",
        padding: "22px",
        border:
          "1px solid #ead4dc",
        borderRadius: "18px",
        background: "#ffffff",
        boxSizing: "border-box",
      }}
    >
      <div
        style={{
          textAlign: "center",
          marginBottom: "18px",
        }}
      >
        <span
          style={{
            color: "#9e1b5b",
            fontSize: "13px",
            fontWeight: "800",
            letterSpacing: "1px",
          }}
        >
          DINERO EN BANCOS
        </span>

        <h2
          style={{
            margin: "8px 0 4px",
          }}
        >
          {cargando
            ? "Consultando saldos..."
            : formatearDinero(
                resumen.saldoTotal,
                formatoDinero
              )}
        </h2>

        <p
          style={{
            margin: 0,
            color: "#7b6970",
          }}
        >
          Saldo bancario registrado. Todavía no
          representa dinero libre para gastar.
        </p>
      </div>

      {error && (
        <div
          role="alert"
          style={{
            padding: "14px",
            borderRadius: "12px",
            background: "#fff3f5",
            color: "#9e1b3f",
            fontWeight: "700",
            textAlign: "center",
          }}
        >
          ⚠️ {error}
        </div>
      )}

      {!cargando && !error && (
        <div
          style={{
            display: "grid",
            gridTemplateColumns:
              "repeat(auto-fit, minmax(230px, 1fr))",
            gap: "14px",
          }}
        >
          {resumen.cuentas.map(
            (cuenta) => (
              <article
                key={cuenta.id}
                style={{
                  padding: "18px",
                  border:
                    "1px solid #ead4dc",
                  borderRadius: "14px",
                  background: "#fff9fb",
                }}
              >
                <strong
                  style={{
                    display: "block",
                    marginBottom: "8px",
                  }}
                >
                  {cuenta.nombre}
                </strong>

                <span
                  style={{
                    display: "block",
                    color: "#9e1b5b",
                    fontSize: "24px",
                    fontWeight: "800",
                  }}
                >
                  {formatearDinero(
                    cuenta.saldo,
                    formatoDinero,
                    cuenta.moneda
                  )}
                </span>

                <small
                  style={{
                    display: "block",
                    marginTop: "8px",
                    color: "#7b6970",
                  }}
                >
                                      {cuenta.esEstimado
                    ? "Estimado con movimientos hasta: "
                    : "Saldo confirmado: "}

                  {new Date(
                    cuenta.fechaActualizacion ||
                      cuenta.fechaSaldo
                  ).toLocaleString(
                    "es-MX"
                  )}
                </small>
              </article>
            )
          )}
        </div>
      )}
    </section>
  );
}

export default ResumenBancario;