import {
  useState,
} from "react";

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

function escaparHtml(valor) {
  return String(valor ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

export default function ListaMaestraCompra({
  productos,
  totalPiezas,
  inversionTotal,
}) {
  const [
    busqueda,
    setBusqueda,
  ] = useState("");

  const [
    sucursalSeleccionada,
    setSucursalSeleccionada,
  ] = useState("");

  const lista =
    Array.isArray(productos)
      ? productos
      : [];

  const mapaSucursales =
    new Map();

  for (const producto of lista) {
    for (
      const sucursal of
      producto?.sucursales || []
    ) {
      if (
        !sucursal?.branchId ||
        convertirNumero(
          sucursal?.cantidadComprar
        ) <= 0
      ) {
        continue;
      }

      mapaSucursales.set(
        String(
          sucursal.branchId
        ),
        {
          branchId:
            sucursal.branchId,

          sucursal:
            sucursal.sucursal ||
            "Sucursal",
        }
      );
    }
  }

  const sucursales =
    Array.from(
      mapaSucursales.values()
    ).sort(
      (a, b) =>
        String(
          a.sucursal
        ).localeCompare(
          String(
            b.sucursal
          ),
          "es"
        )
    );

  const obtenerDetalleSucursal = (
    producto,
    branchId
  ) => {
    return (
      (
        producto?.sucursales ||
        []
      ).find(
        (item) =>
          String(
            item?.branchId
          ) ===
          String(branchId)
      ) || null
    );
  };

  const obtenerCantidadSucursal = (
    producto,
    branchId
  ) => {
    const sucursal =
      obtenerDetalleSucursal(
        producto,
        branchId
      );

    return Math.max(
      0,
      convertirNumero(
        sucursal?.cantidadComprar
      )
    );
  };

  const obtenerInversionSucursal = (
    producto,
    branchId
  ) => {
    const sucursal =
      obtenerDetalleSucursal(
        producto,
        branchId
      );

    return Math.max(
      0,
      convertirNumero(
        sucursal?.inversionEstimada
      )
    );
  };

  const resumenSucursales =
    sucursales.map(
      (sucursal) => {
        const productosSucursal =
          lista.filter(
            (producto) =>
              obtenerCantidadSucursal(
                producto,
                sucursal.branchId
              ) > 0
          );

        const piezasSucursal =
          productosSucursal.reduce(
            (total, producto) =>
              total +
              obtenerCantidadSucursal(
                producto,
                sucursal.branchId
              ),
            0
          );

        const inversionSucursal =
          productosSucursal.reduce(
            (total, producto) =>
              total +
              obtenerInversionSucursal(
                producto,
                sucursal.branchId
              ),
            0
          );

        return {
          ...sucursal,

          productos:
            productosSucursal.length,

          piezas:
            piezasSucursal,

          inversion:
            inversionSucursal,
        };
      }
    );

  const textoBusqueda =
    busqueda
      .trim()
      .toLowerCase();

  const productosFiltrados =
    lista.filter(
      (producto) => {
        const coincideSucursal =
          !sucursalSeleccionada ||
          obtenerCantidadSucursal(
            producto,
            sucursalSeleccionada
          ) > 0;

        if (!coincideSucursal) {
          return false;
        }

        if (!textoBusqueda) {
          return true;
        }

        const codigo =
          String(
            producto?.codigo || ""
          ).toLowerCase();

        const descripcion =
          String(
            producto?.descripcion || ""
          ).toLowerCase();

        return (
          codigo.includes(
            textoBusqueda
          ) ||
          descripcion.includes(
            textoBusqueda
          )
        );
      }
    );

  const sucursalActiva =
    resumenSucursales.find(
      (sucursal) =>
        String(
          sucursal.branchId
        ) ===
        String(
          sucursalSeleccionada
        )
    );

  const imprimirLista = () => {
    const esCompraSucursal =
      Boolean(sucursalActiva);

    const listaImprimir =
      esCompraSucursal
        ? lista.filter(
            (producto) =>
              obtenerCantidadSucursal(
                producto,
                sucursalActiva.branchId
              ) > 0
          )
        : lista;

    const productosImprimir =
      esCompraSucursal
        ? sucursalActiva.productos
        : lista.length;

    const piezasImprimir =
      esCompraSucursal
        ? sucursalActiva.piezas
        : totalPiezas;

    const inversionImprimir =
      esCompraSucursal
        ? sucursalActiva.inversion
        : inversionTotal;

    const tituloCompra =
      esCompraSucursal
        ? `Lista de Compra - ${sucursalActiva.sucursal}`
        : "Lista Maestra de Compra";

    let encabezadoTabla = "";

    let filas = "";

    if (esCompraSucursal) {
      encabezadoTabla = `
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
            Inversión
          </th>

          <th>
            Listo
          </th>
        </tr>
      `;

      filas =
        listaImprimir
          .map(
            (
              producto,
              indice
            ) => `
              <tr>
                <td>
                  ${indice + 1}
                </td>

                <td>
                  ${escaparHtml(
                    producto?.codigo ||
                      "Sin código"
                  )}
                </td>

                <td>
                  ${escaparHtml(
                    producto?.descripcion ||
                      "Producto"
                  )}
                </td>

                <td class="cantidad total">
                  ${formatearNumero(
                    obtenerCantidadSucursal(
                      producto,
                      sucursalActiva.branchId
                    )
                  )}
                </td>

                <td class="dinero">
                  ${formatearDinero(
                    obtenerInversionSucursal(
                      producto,
                      sucursalActiva.branchId
                    )
                  )}
                </td>

                <td class="check">
                  ☐
                </td>
              </tr>
            `
          )
          .join("");
    } else {
      const encabezadosSucursales =
        sucursales
          .map(
            (sucursal) => `
              <th>
                ${escaparHtml(
                  sucursal.sucursal
                )}
              </th>
            `
          )
          .join("");

      encabezadoTabla = `
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
            Compra total
          </th>

          ${encabezadosSucursales}

          <th>
            Inversión
          </th>

          <th>
            Listo
          </th>
        </tr>
      `;

      filas =
        listaImprimir
          .map(
            (
              producto,
              indice
            ) => {
              const cantidadesSucursales =
                sucursales
                  .map(
                    (sucursal) => `
                      <td class="cantidad">
                        ${formatearNumero(
                          obtenerCantidadSucursal(
                            producto,
                            sucursal.branchId
                          )
                        )}
                      </td>
                    `
                  )
                  .join("");

              return `
                <tr>
                  <td>
                    ${indice + 1}
                  </td>

                  <td>
                    ${escaparHtml(
                      producto?.codigo ||
                        "Sin código"
                    )}
                  </td>

                  <td>
                    ${escaparHtml(
                      producto?.descripcion ||
                        "Producto"
                    )}
                  </td>

                  <td class="cantidad total">
                    ${formatearNumero(
                      producto?.compraTotal
                    )}
                  </td>

                  ${cantidadesSucursales}

                  <td class="dinero">
                    ${formatearDinero(
                      producto?.inversionTotal
                    )}
                  </td>

                  <td class="check">
                    ☐
                  </td>
                </tr>
              `;
            }
          )
          .join("");
    }

    const ventanaImpresion =
      window.open(
        "",
        "_blank",
        "width=1100,height=750"
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
            ${escaparHtml(
              tituloCompra
            )} - MONYS OS
          </title>

          <style>
            * {
              box-sizing: border-box;
            }

            body {
              margin: 0;
              padding: 26px;
              font-family:
                Arial,
                Helvetica,
                sans-serif;
              color: #222222;
            }

            h1 {
              margin:
                0 0 6px;
              font-size: 24px;
            }

            .subtitulo {
              margin-bottom: 20px;
              color: #555555;
            }

            .sucursal {
              margin-bottom: 18px;
              font-size: 18px;
              font-weight: 700;
            }

            .resumen {
              display: flex;
              gap: 24px;
              flex-wrap: wrap;
              margin-bottom: 22px;
              padding: 12px 14px;
              border:
                1px solid #cccccc;
              border-radius: 8px;
            }

            .resumen strong {
              font-size: 18px;
            }

            table {
              width: 100%;
              border-collapse: collapse;
              font-size: 12px;
            }

            th,
            td {
              padding: 7px;
              border:
                1px solid #cccccc;
              text-align: left;
              vertical-align: middle;
            }

            th {
              background:
                #f2f2f2;
            }

            .cantidad {
              text-align: center;
              white-space: nowrap;
            }

            .total {
              font-weight: 700;
            }

            .dinero {
              text-align: right;
              white-space: nowrap;
            }

            .check {
              width: 50px;
              text-align: center;
              font-size: 18px;
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
            🛒 ${escaparHtml(
              tituloCompra
            )}
          </h1>

          <div class="subtitulo">
            ${
              esCompraSucursal
                ? "Compra correspondiente únicamente a la sucursal seleccionada."
                : "Compra consolidada de MONYS OS después de considerar los traspasos recomendados."
            }
          </div>

          ${
            esCompraSucursal
              ? `
                <div class="sucursal">
                  🏪 ${escaparHtml(
                    sucursalActiva.sucursal
                  )}
                </div>
              `
              : ""
          }

          <div class="resumen">
            <div>
              Productos:
              <strong>
                ${formatearNumero(
                  productosImprimir
                )}
              </strong>
            </div>

            <div>
              Piezas:
              <strong>
                ${formatearNumero(
                  piezasImprimir
                )}
              </strong>
            </div>

            <div>
              Inversión estimada:
              <strong>
                ${formatearDinero(
                  inversionImprimir
                )}
              </strong>
            </div>
          </div>

          <table>
            <thead>
              ${encabezadoTabla}
            </thead>

            <tbody>
              ${filas}
            </tbody>
          </table>

          <div class="nota">
            Lista generada por MONYS OS.
            Documento de apoyo para compra y revisión.
            No ejecuta órdenes ni modifica inventarios.
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
        marginBottom: "28px",
        padding: "22px",
        borderRadius: "20px",
        border:
          "1px solid #ead5df",
        backgroundColor:
          "#ffffff",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent:
            "space-between",
          alignItems:
            "flex-start",
          gap: "18px",
          flexWrap: "wrap",
          marginBottom: "18px",
        }}
      >
        <div>
          <p
            style={{
              margin: 0,
              color: "#c7256e",
              fontWeight: 800,
              letterSpacing:
                "0.8px",
            }}
          >
            COMPRA OPERATIVA
          </p>

          <h2
            style={{
              margin:
                "6px 0 0",
            }}
          >
            🛒 Lista Maestra de Compra
          </h2>

          <p
            style={{
              margin:
                "8px 0 0",
              color: "#6f666a",
            }}
          >
            Lo que realmente debes comprar
            después de considerar los
            traspasos recomendados.
          </p>
        </div>

        <button
          type="button"
          onClick={
            imprimirLista
          }
          style={{
            padding:
              "12px 17px",
            borderRadius:
              "12px",
            border:
              "1px solid #8f2858",
            backgroundColor:
              "#8f2858",
            color: "#ffffff",
            fontWeight: 800,
            cursor: "pointer",
            fontSize: "14px",
          }}
        >
          🖨️{" "}
          {sucursalActiva
            ? `Imprimir ${sucursalActiva.sucursal}`
            : "Imprimir compra"}
        </button>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns:
            "repeat(auto-fit, minmax(190px, 1fr))",
          gap: "12px",
          marginBottom: "18px",
        }}
      >
        <div
          style={{
            padding: "14px",
            borderRadius:
              "12px",
            backgroundColor:
              "#faf7f8",
          }}
        >
          Productos

          <strong
            style={{
              display: "block",
              marginTop: "5px",
              fontSize: "24px",
            }}
          >
            {formatearNumero(
              lista.length
            )}
          </strong>
        </div>

        <div
          style={{
            padding: "14px",
            borderRadius:
              "12px",
            backgroundColor:
              "#f3fbf6",
          }}
        >
          Piezas a comprar

          <strong
            style={{
              display: "block",
              marginTop: "5px",
              fontSize: "24px",
            }}
          >
            {formatearNumero(
              totalPiezas
            )}
          </strong>
        </div>

        <div
          style={{
            padding: "14px",
            borderRadius:
              "12px",
            backgroundColor:
              "#fffaf0",
          }}
        >
          Inversión estimada

          <strong
            style={{
              display: "block",
              marginTop: "5px",
              fontSize: "24px",
              color: "#207a4a",
            }}
          >
            {formatearDinero(
              inversionTotal
            )}
          </strong>
        </div>
      </div>

      <div
        style={{
          marginBottom: "16px",
          padding: "12px 14px",
          borderRadius: "12px",
          backgroundColor:
            "#fff8ee",
          border:
            "1px solid #f1c27d",
          color: "#8c570c",
          fontSize: "14px",
        }}
      >
        ⚠️ Esta lista sigue siendo una
        recomendación. MONYS OS todavía
        no genera ni envía órdenes de
        compra automáticamente.
      </div>

      <div
        style={{
          marginBottom: "18px",
        }}
      >
        <h3
          style={{
            margin:
              "0 0 10px",
          }}
        >
          🏪 Filtrar por sucursal
        </h3>

        <div
          style={{
            display: "flex",
            gap: "10px",
            flexWrap: "wrap",
          }}
        >
          <button
            type="button"
            onClick={() =>
              setSucursalSeleccionada("")
            }
            style={{
              padding:
                "10px 14px",
              borderRadius:
                "12px",
              border:
                !sucursalSeleccionada
                  ? "2px solid #8f2858"
                  : "1px solid #e6cbd8",
              backgroundColor:
                !sucursalSeleccionada
                  ? "#fff0f6"
                  : "#ffffff",
              color: "#8f2858",
              fontWeight: 800,
              cursor: "pointer",
            }}
          >
            🏪 Todas (
            {formatearNumero(
              lista.length
            )}
            )
          </button>

          {resumenSucursales.map(
            (sucursal) => {
              const activa =
                String(
                  sucursalSeleccionada
                ) ===
                String(
                  sucursal.branchId
                );

              return (
                <button
                  key={
                    sucursal.branchId
                  }
                  type="button"
                  onClick={() =>
                    setSucursalSeleccionada(
                      activa
                        ? ""
                        : String(
                            sucursal.branchId
                          )
                    )
                  }
                  style={{
                    padding:
                      "10px 14px",
                    borderRadius:
                      "12px",
                    border:
                      activa
                        ? "2px solid #315a9b"
                        : "1px solid #d9e8ff",
                    backgroundColor:
                      activa
                        ? "#eaf3ff"
                        : "#f8fbff",
                    color:
                      "#315a9b",
                    fontWeight: 800,
                    cursor: "pointer",
                  }}
                >
                  🏪{" "}
                  {
                    sucursal.sucursal
                  }
                  {" ("}
                  {formatearNumero(
                    sucursal.productos
                  )}
                  {")"}
                </button>
              );
            }
          )}
        </div>
      </div>

      {sucursalActiva && (
        <div
          style={{
            marginBottom: "18px",
            padding: "12px 14px",
            borderRadius: "12px",
            border:
              "1px solid #d9e8ff",
            backgroundColor:
              "#eaf3ff",
            color: "#315a9b",
            fontWeight: 800,
          }}
        >
          🔎 Mostrando compra para{" "}
          {sucursalActiva.sucursal}
          {" · "}
          {formatearNumero(
            sucursalActiva.productos
          )}{" "}
          productos
          {" · "}
          {formatearNumero(
            sucursalActiva.piezas
          )}{" "}
          piezas
          {" · "}
          {formatearDinero(
            sucursalActiva.inversion
          )}
        </div>
      )}

      <div
        style={{
          marginBottom: "18px",
        }}
      >
        <input
          type="text"
          value={busqueda}
          onChange={(evento) =>
            setBusqueda(
              evento.target.value
            )
          }
          placeholder="Buscar por código o producto..."
          style={{
            width: "100%",
            boxSizing: "border-box",
            padding: "12px 14px",
            borderRadius: "12px",
            border:
              "1px solid #dccbd3",
            outline: "none",
            fontSize: "15px",
            backgroundColor:
              "#ffffff",
          }}
        />

        {(textoBusqueda ||
          sucursalSeleccionada) && (
          <div
            style={{
              marginTop: "10px",
              color: "#6f666a",
              fontSize: "14px",
            }}
          >
            Mostrando{" "}
            <strong>
              {formatearNumero(
                productosFiltrados.length
              )}
            </strong>{" "}
            de{" "}
            <strong>
              {formatearNumero(
                lista.length
              )}
            </strong>{" "}
            productos.
          </div>
        )}
      </div>

      {productosFiltrados.length ===
      0 ? (
        <div
          style={{
            padding: "18px",
            borderRadius: "12px",
            backgroundColor:
              "#faf7f8",
            color: "#6f666a",
          }}
        >
          No hay productos que
          coincidan con los filtros.
        </div>
      ) : (
        <div
          style={{
            display: "grid",
            gap: "9px",
          }}
        >
          {productosFiltrados.map(
            (
              producto,
              indice
            ) => {
              const cantidadMostrar =
                sucursalActiva
                  ? obtenerCantidadSucursal(
                      producto,
                      sucursalActiva.branchId
                    )
                  : convertirNumero(
                      producto?.compraTotal
                    );

              const inversionMostrar =
                sucursalActiva
                  ? obtenerInversionSucursal(
                      producto,
                      sucursalActiva.branchId
                    )
                  : convertirNumero(
                      producto?.inversionTotal
                    );

              return (
                <div
                  key={
                    producto?.llave ||
                    `${producto?.codigo || "producto"}-${indice}`
                  }
                  style={{
                    padding:
                      "14px 16px",
                    borderRadius:
                      "12px",
                    border:
                      "1px solid #eee3e8",
                    backgroundColor:
                      "#fffdfd",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      justifyContent:
                        "space-between",
                      alignItems:
                        "flex-start",
                      gap: "18px",
                      flexWrap: "wrap",
                    }}
                  >
                    <div
                      style={{
                        flex:
                          "1 1 440px",
                      }}
                    >
                      <strong>
                        {producto
                          ?.descripcion ||
                          "Producto"}
                      </strong>

                      <div
                        style={{
                          marginTop:
                            "4px",
                          color:
                            "#7c7276",
                        }}
                      >
                        Código:{" "}
                        {producto
                          ?.codigo ||
                          "Sin código"}
                      </div>

                      <div
                        style={{
                          display: "flex",
                          gap: "8px",
                          flexWrap: "wrap",
                          marginTop:
                            "10px",
                        }}
                      >
                        {sucursales.map(
                          (
                            sucursal
                          ) => {
                            const cantidad =
                              obtenerCantidadSucursal(
                                producto,
                                sucursal.branchId
                              );

                            if (
                              cantidad <= 0
                            ) {
                              return null;
                            }

                            return (
                              <span
                                key={
                                  sucursal.branchId
                                }
                                style={{
                                  padding:
                                    "6px 9px",
                                  borderRadius:
                                    "999px",
                                  backgroundColor:
                                    "#f4f8ff",
                                  color:
                                    "#315a9b",
                                  fontSize:
                                    "13px",
                                  fontWeight:
                                    700,
                                }}
                              >
                                🏪{" "}
                                {
                                  sucursal.sucursal
                                }
                                :{" "}
                                {formatearNumero(
                                  cantidad
                                )}{" "}
                                pzas
                              </span>
                            );
                          }
                        )}
                      </div>
                    </div>

                    <div
                      style={{
                        textAlign:
                          "right",
                        minWidth:
                          "180px",
                      }}
                    >
                      <div
                        style={{
                          color:
                            "#6f666a",
                          fontSize:
                            "13px",
                        }}
                      >
                        {sucursalActiva
                          ? `Comprar para ${sucursalActiva.sucursal}`
                          : "Comprar"}
                      </div>

                      <strong
                        style={{
                          display:
                            "block",
                          marginTop:
                            "3px",
                          fontSize:
                            "23px",
                        }}
                      >
                        {formatearNumero(
                          cantidadMostrar
                        )}{" "}
                        pzas
                      </strong>

                      <div
                        style={{
                          marginTop:
                            "4px",
                          color:
                            "#207a4a",
                          fontWeight:
                            700,
                        }}
                      >
                        {formatearDinero(
                          inversionMostrar
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            }
          )}
        </div>
      )}
    </section>
  );
}