function convertirNumero(valor) {
  const numero = Number(valor);

  return Number.isFinite(numero)
    ? numero
    : 0;
}

function formatearNumero(valor) {
  return new Intl.NumberFormat(
    "es-MX"
  ).format(
    convertirNumero(valor)
  );
}

function formatearDinero(valor) {
  return new Intl.NumberFormat(
    "es-MX",
    {
      style: "currency",
      currency: "MXN",
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    }
  ).format(
    convertirNumero(valor)
  );
}

export default function ResumenSucursalesCompra({
  compraMaestra,
  onSeleccionarSucursal,
}) {
  const productos =
    Array.isArray(
      compraMaestra?.productos
    )
      ? compraMaestra.productos
      : [];

  const resumenPorSucursal =
    new Map();

  for (
    const producto of productos
  ) {
    const sucursales =
      Array.isArray(
        producto?.sucursales
      )
        ? producto.sucursales
        : [];

    for (
      const sucursal of sucursales
    ) {
      /*
        Los inventarios negativos
        requieren revisión y NO forman
        parte de la compra automática.
      */
      if (
        sucursal
          ?.requiereRevisionInventario
      ) {
        continue;
      }

      const cantidadComprar =
        Math.max(
          0,
          convertirNumero(
            sucursal
              ?.cantidadComprar
          )
        );

      if (
        cantidadComprar <= 0
      ) {
        continue;
      }

      const branchId =
        String(
          sucursal?.branchId ||
            sucursal?.sucursal ||
            "sin-sucursal"
        );

      const actual =
        resumenPorSucursal.get(
          branchId
        ) || {
          branchId,

          sucursal:
            sucursal?.sucursal ||
            "Sucursal",

          productosComprar: 0,

          piezasComprar: 0,

          inversionEstimada: 0,
        };

      actual.productosComprar += 1;

      actual.piezasComprar +=
        cantidadComprar;

      actual.inversionEstimada +=
        Math.max(
          0,
          convertirNumero(
            sucursal
              ?.inversionEstimada
          )
        );

      resumenPorSucursal.set(
        branchId,
        actual
      );
    }
  }

  const resumen =
    Array.from(
      resumenPorSucursal.values()
    ).sort(
      (a, b) =>
        b.inversionEstimada -
        a.inversionEstimada
    );

  if (
    resumen.length === 0
  ) {
    return null;
  }

  return (
    <section
      style={{
        marginBottom: "28px",
      }}
    >
      <div
        style={{
          marginBottom: "14px",
        }}
      >
        <h2
          style={{
            marginBottom: "6px",
          }}
        >
          🏪 Distribución de la Compra
        </h2>

        <p
          style={{
            margin: 0,
            color: "#6f666a",
          }}
        >
          Compra todo junto y MONYS OS
          conserva cuánto corresponde a
          cada sucursal. Haz clic en una
          sucursal para ver su compra.
        </p>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns:
            "repeat(auto-fit, minmax(260px, 1fr))",
          gap: "16px",
        }}
      >
        {resumen.map(
          (sucursal) => (
            <button
              key={
                sucursal.branchId
              }
              type="button"
              onClick={() => {
                if (
                  typeof onSeleccionarSucursal ===
                  "function"
                ) {
                  onSeleccionarSucursal(
                    sucursal
                  );
                }
              }}
              style={{
                padding: "20px",
                borderRadius: "18px",
                border:
                  "1px solid #ead5df",
                backgroundColor:
                  "#ffffff",
                cursor: "pointer",
                textAlign: "left",
                fontFamily: "inherit",
                fontSize: "inherit",
              }}
            >
              <div
                style={{
                  fontSize: "18px",
                  fontWeight: 800,
                  color: "#6f3153",
                  marginBottom:
                    "14px",
                }}
              >
                🏪{" "}
                {sucursal.sucursal}
              </div>

              <div
                style={{
                  display: "grid",
                  gap: "8px",
                }}
              >
                <div>
                  Productos:{" "}
                  <strong>
                    {formatearNumero(
                      sucursal
                        .productosComprar
                    )}
                  </strong>
                </div>

                <div>
                  Piezas:{" "}
                  <strong>
                    {formatearNumero(
                      sucursal
                        .piezasComprar
                    )}
                  </strong>
                </div>

                <div>
                  Inversión estimada:{" "}
                  <strong
                    style={{
                      color:
                        "#207a4a",
                    }}
                  >
                    {formatearDinero(
                      sucursal
                        .inversionEstimada
                    )}
                  </strong>
                </div>

                <div
                  style={{
                    marginTop: "8px",
                    color: "#8f2858",
                    fontWeight: 800,
                  }}
                >
                  Ver detalle →
                </div>
              </div>
            </button>
          )
        )}
      </div>
    </section>
  );
}