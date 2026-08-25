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

function escaparHtml(valor) {
  return String(valor ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

export default function ListaPreparacionTraspasos({
  traspasos,
  sucursalOrigen,
  sucursalDestino,
}) {
  const lista =
    Array.isArray(traspasos)
      ? traspasos
      : [];

  const totalPiezas =
    lista.reduce(
      (total, traspaso) =>
        total +
        convertirNumero(
          traspaso?.cantidadSugerida
        ),
      0
    );

  const imprimirLista = () => {
    const origen =
      sucursalOrigen ||
      "Origen";

    const destino =
      sucursalDestino ||
      "Destino";

    const filas =
      lista
        .map(
          (
            traspaso,
            indice
          ) => `
            <tr>
              <td>
                ${indice + 1}
              </td>

              <td>
                ${escaparHtml(
                  traspaso?.codigo ||
                    "Sin código"
                )}
              </td>

              <td>
                ${escaparHtml(
                  traspaso?.producto ||
                    "Producto"
                )}
              </td>

              <td class="cantidad">
                ${formatearNumero(
                  traspaso
                    ?.cantidadSugerida
                )}
              </td>

              <td class="check">
                ☐
              </td>
            </tr>
          `
        )
        .join("");

    const ventanaImpresion =
      window.open(
        "",
        "_blank",
        "width=900,height=700"
      );

    if (!ventanaImpresion) {
      window.alert(
        "El navegador bloqueó la ventana de impresión. Permite ventanas emergentes para MONYS OS e inténtalo nuevamente."
      );

      return;
    }

    ventanaImpresion.document.write(`
      <!DOCTYPE html>
      <html lang="es">
        <head>
          <meta charset="UTF-8" />

          <title>
            Lista de Preparación - ${escaparHtml(
              origen
            )} a ${escaparHtml(
              destino
            )}
          </title>

          <style>
            * {
              box-sizing: border-box;
            }

            body {
              margin: 0;
              padding: 28px;
              font-family:
                Arial,
                Helvetica,
                sans-serif;
              color: #222;
            }

            h1 {
              margin:
                0 0 6px;
              font-size: 24px;
            }

            .ruta {
              margin-bottom: 20px;
              font-size: 18px;
              font-weight: 700;
            }

            .resumen {
              display: flex;
              gap: 24px;
              margin-bottom: 22px;
              padding: 12px 14px;
              border: 1px solid #cccccc;
              border-radius: 8px;
            }

            .resumen strong {
              font-size: 18px;
            }

            table {
              width: 100%;
              border-collapse: collapse;
              font-size: 13px;
            }

            th,
            td {
              padding: 8px;
              border:
                1px solid #cccccc;
              text-align: left;
              vertical-align: middle;
            }

            th {
              background: #f2f2f2;
            }

            .cantidad {
              width: 90px;
              text-align: center;
              font-size: 15px;
              font-weight: 700;
            }

            .check {
              width: 55px;
              text-align: center;
              font-size: 20px;
            }

            .nota {
              margin-top: 18px;
              font-size: 12px;
              color: #666666;
            }

            @media print {
              body {
                padding: 0;
              }

              tr {
                break-inside: avoid;
              }
            }
          </style>
        </head>

        <body>
          <h1>
            📋 Lista de Preparación
          </h1>

          <div class="ruta">
            ${escaparHtml(
              origen
            )}
            →
            ${escaparHtml(
              destino
            )}
          </div>

          <div class="resumen">
            <div>
              Productos:
              <strong>
                ${formatearNumero(
                  lista.length
                )}
              </strong>
            </div>

            <div>
              Piezas:
              <strong>
                ${formatearNumero(
                  totalPiezas
                )}
              </strong>
            </div>
          </div>

          <table>
            <thead>
              <tr>
                <th>
                  #
                </th>

                <th>
                  Código
                </th>

                <th>
                  Producto
                </th>

                <th>
                  Piezas
                </th>

                <th>
                  Listo
                </th>
              </tr>
            </thead>

            <tbody>
              ${filas}
            </tbody>
          </table>

          <div class="nota">
            Lista generada por MONYS OS.
            Esta hoja es para preparación y revisión física de mercancía.
          </div>
        </body>
      </html>
    `);

    ventanaImpresion.document.close();

    ventanaImpresion.focus();

    setTimeout(
      () => {
        ventanaImpresion.print();
      },
      300
    );
  };

  if (lista.length === 0) {
    return null;
  }

  return (
    <section
      style={{
        marginBottom: "22px",
        padding: "20px",
        borderRadius: "18px",
        border:
          "1px solid #cde8d7",
        backgroundColor:
          "#fbfffc",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent:
            "space-between",
          alignItems: "flex-start",
          gap: "16px",
          flexWrap: "wrap",
          marginBottom: "18px",
        }}
      >
        <div>
          <p
            style={{
              margin: 0,
              color: "#207a4a",
              fontWeight: 800,
              letterSpacing:
                "0.8px",
            }}
          >
            PREPARACIÓN DE MERCANCÍA
          </p>

          <h3
            style={{
              margin:
                "6px 0 0",
            }}
          >
            📋 Lista de Preparación
          </h3>

          <div
            style={{
              marginTop: "8px",
              color: "#315a9b",
              fontWeight: 800,
            }}
          >
            🏪{" "}
            {sucursalOrigen ||
              "Origen"}
            {" → "}
            🏪{" "}
            {sucursalDestino ||
              "Destino"}
          </div>
        </div>

        <div
          style={{
            display: "flex",
            gap: "10px",
            flexWrap: "wrap",
            alignItems: "stretch",
          }}
        >
          <div
            style={{
              padding:
                "10px 14px",
              borderRadius:
                "12px",
              backgroundColor:
                "#ffffff",
              border:
                "1px solid #cde8d7",
            }}
          >
            <div
              style={{
                color:
                  "#6f666a",
                fontSize:
                  "12px",
              }}
            >
              Productos
            </div>

            <strong
              style={{
                display:
                  "block",
                marginTop:
                  "3px",
                fontSize:
                  "21px",
              }}
            >
              {formatearNumero(
                lista.length
              )}
            </strong>
          </div>

          <div
            style={{
              padding:
                "10px 14px",
              borderRadius:
                "12px",
              backgroundColor:
                "#f3fbf6",
              border:
                "1px solid #cde8d7",
            }}
          >
            <div
              style={{
                color:
                  "#6f666a",
                fontSize:
                  "12px",
              }}
            >
              Piezas
            </div>

            <strong
              style={{
                display:
                  "block",
                marginTop:
                  "3px",
                fontSize:
                  "21px",
                color:
                  "#207a4a",
              }}
            >
              {formatearNumero(
                totalPiezas
              )}
            </strong>
          </div>

          <button
            type="button"
            onClick={
              imprimirLista
            }
            style={{
              padding:
                "10px 16px",
              borderRadius:
                "12px",
              border:
                "1px solid #315a9b",
              backgroundColor:
                "#315a9b",
              color:
                "#ffffff",
              fontWeight: 800,
              cursor: "pointer",
              fontSize: "14px",
            }}
          >
            🖨️ Imprimir lista
          </button>
        </div>
      </div>

      <div
        style={{
          marginBottom: "16px",
          padding: "11px 13px",
          borderRadius: "11px",
          backgroundColor:
            "#fff8ee",
          border:
            "1px solid #f1c27d",
          color: "#8c570c",
          fontSize: "14px",
        }}
      >
        ⚠️ Esta lista es para
        preparar y revisar
        mercancía. Todavía no
        registra ni ejecuta el
        traspaso en MONYS OS.
      </div>

      <div
        style={{
          display: "grid",
          gap: "8px",
        }}
      >
        {lista.map(
          (
            traspaso,
            indice
          ) => (
            <div
              key={
                `${traspaso?.productId || traspaso?.codigo || "producto"}-${indice}`
              }
              style={{
                display: "grid",
                gridTemplateColumns:
                  "42px minmax(0, 1fr) auto",
                gap: "12px",
                alignItems:
                  "center",
                padding:
                  "12px 14px",
                borderRadius:
                  "12px",
                border:
                  "1px solid #e6eee8",
                backgroundColor:
                  "#ffffff",
              }}
            >
              <div
                style={{
                  width: "32px",
                  height: "32px",
                  borderRadius:
                    "50%",
                  display: "flex",
                  alignItems:
                    "center",
                  justifyContent:
                    "center",
                  backgroundColor:
                    "#f3fbf6",
                  color:
                    "#207a4a",
                  fontWeight: 800,
                }}
              >
                {indice + 1}
              </div>

              <div>
                <strong>
                  {traspaso
                    ?.producto ||
                    "Producto"}
                </strong>

                <div
                  style={{
                    marginTop:
                      "3px",
                    color:
                      "#7c7276",
                    fontSize:
                      "14px",
                  }}
                >
                  Código:{" "}
                  {traspaso
                    ?.codigo ||
                    "Sin código"}
                </div>
              </div>

              <div
                style={{
                  textAlign:
                    "right",
                }}
              >
                <strong
                  style={{
                    fontSize:
                      "20px",
                    color:
                      "#315a9b",
                  }}
                >
                  {formatearNumero(
                    traspaso
                      ?.cantidadSugerida
                  )}{" "}
                  pzas
                </strong>

                <div
                  style={{
                    marginTop:
                      "3px",
                    color:
                      "#6f666a",
                    fontSize:
                      "12px",
                  }}
                >
                  preparar
                </div>
              </div>
            </div>
          )
        )}
      </div>
    </section>
  );
}