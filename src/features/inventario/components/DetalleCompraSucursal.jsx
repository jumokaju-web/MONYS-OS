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

export default function DetalleCompraSucursal({
  branchId,
  nombreSucursal,
  productos,
  onCerrar,
}) {
  const [
    busqueda,
    setBusqueda,
  ] = useState("");

  const [
    soloConTraspaso,
    setSoloConTraspaso,
  ] = useState(false);

  const listaProductos =
    Array.isArray(productos)
      ? productos
      : [];

  const detalleProductos =
    listaProductos
      .map(
        (producto) => {
          const sucursal =
            (
              producto?.sucursales ||
              []
            ).find(
              (item) =>
                String(
                  item?.branchId
                ) ===
                String(branchId)
            );

          if (
            !sucursal ||
            sucursal
              ?.requiereRevisionInventario
          ) {
            return null;
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
            return null;
          }

          return {
            llave:
              producto?.llave,

            codigo:
              producto?.codigo ||
              "",

            descripcion:
              producto?.descripcion ||
              "Producto sin descripción",

            categoria:
              producto?.categoria ||
              "Sin categoría",

            cantidadComprar,

            existenciaActual:
              convertirNumero(
                sucursal
                  ?.existenciaActual
              ),

            piezasVendidas:
              convertirNumero(
                sucursal
                  ?.piezasVendidas
              ),

            cubiertoPorTraspaso:
              convertirNumero(
                sucursal
                  ?.cubiertoPorTraspaso
              ),

            inversionEstimada:
              convertirNumero(
                sucursal
                  ?.inversionEstimada
              ),
          };
        }
      )
      .filter(Boolean)
      .sort(
        (a, b) =>
          b.cantidadComprar -
          a.cantidadComprar
      );

  const textoBusqueda =
    busqueda
      .trim()
      .toLowerCase();

  const productosFiltrados =
    detalleProductos.filter(
      (producto) => {
        const codigo =
          String(
            producto?.codigo || ""
          ).toLowerCase();

        const descripcion =
          String(
            producto?.descripcion || ""
          ).toLowerCase();

        const categoria =
          String(
            producto?.categoria || ""
          ).toLowerCase();

        const coincideBusqueda =
          !textoBusqueda ||
          codigo.includes(
            textoBusqueda
          ) ||
          descripcion.includes(
            textoBusqueda
          ) ||
          categoria.includes(
            textoBusqueda
          );

        const tieneTraspaso =
          convertirNumero(
            producto
              ?.cubiertoPorTraspaso
          ) > 0;

        const coincideTraspaso =
          !soloConTraspaso ||
          tieneTraspaso;

        return (
          coincideBusqueda &&
          coincideTraspaso
        );
      }
    );

  const totalPiezas =
    detalleProductos.reduce(
      (total, producto) =>
        total +
        producto.cantidadComprar,
      0
    );

  const inversionTotal =
    detalleProductos.reduce(
      (total, producto) =>
        total +
        producto.inversionEstimada,
      0
    );

  if (!branchId) {
    return null;
  }

  return (
    <section
      style={{
        marginBottom: "28px",
        padding: "22px",
        borderRadius: "20px",
        border:
          "1px solid #d9c5cf",
        backgroundColor:
          "#ffffff",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent:
            "space-between",
          alignItems: "center",
          gap: "16px",
          flexWrap: "wrap",
          marginBottom: "20px",
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
            DISTRIBUCIÓN POR SUCURSAL
          </p>

          <h2
            style={{
              margin:
                "6px 0 0",
            }}
          >
            🏪 Compra para{" "}
            {nombreSucursal}
          </h2>
        </div>

        <button
          type="button"
          onClick={onCerrar}
          style={{
            padding:
              "10px 16px",
            borderRadius:
              "10px",
            border:
              "1px solid #e6cbd8",
            backgroundColor:
              "#ffffff",
            color:
              "#8f2858",
            fontWeight: 800,
            cursor: "pointer",
          }}
        >
          ✕ Cerrar detalle
        </button>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns:
            "repeat(auto-fit, minmax(220px, 1fr))",
          gap: "14px",
          marginBottom: "22px",
        }}
      >
        <div
          style={{
            padding: "16px",
            borderRadius:
              "14px",
            backgroundColor:
              "#faf7f8",
          }}
        >
          Productos
          <strong
            style={{
              display:
                "block",
              marginTop:
                "6px",
              fontSize:
                "26px",
            }}
          >
            {formatearNumero(
              detalleProductos.length
            )}
          </strong>
        </div>

        <div
          style={{
            padding: "16px",
            borderRadius:
              "14px",
            backgroundColor:
              "#f3fbf6",
          }}
        >
          Piezas
          <strong
            style={{
              display:
                "block",
              marginTop:
                "6px",
              fontSize:
                "26px",
            }}
          >
            {formatearNumero(
              totalPiezas
            )}
          </strong>
        </div>

        <div
          style={{
            padding: "16px",
            borderRadius:
              "14px",
            backgroundColor:
              "#fffaf0",
          }}
        >
          Inversión estimada
          <strong
            style={{
              display:
                "block",
              marginTop:
                "6px",
              fontSize:
                "26px",
              color:
                "#207a4a",
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
          display: "flex",
          alignItems: "center",
          gap: "12px",
          flexWrap: "wrap",
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
          placeholder={`Buscar producto en ${nombreSucursal}...`}
          style={{
            flex: "1 1 320px",
            minWidth: "240px",
            padding:
              "12px 14px",
            borderRadius:
              "12px",
            border:
              "1px solid #dccbd3",
            outline: "none",
            fontSize: "15px",
            backgroundColor:
              "#ffffff",
          }}
        />

        <label
          style={{
            display: "flex",
            alignItems: "center",
            gap: "8px",
            padding:
              "11px 14px",
            borderRadius:
              "12px",
            border:
              "1px solid #d9e8ff",
            backgroundColor:
              soloConTraspaso
                ? "#eaf3ff"
                : "#ffffff",
            cursor: "pointer",
            fontWeight: 700,
            color: "#315a9b",
            whiteSpace:
              "nowrap",
          }}
        >
          <input
            type="checkbox"
            checked={
              soloConTraspaso
            }
            onChange={(evento) =>
              setSoloConTraspaso(
                evento.target
                  .checked
              )
            }
          />

          🔄 Solo con traspaso
        </label>
      </div>

      {(textoBusqueda ||
        soloConTraspaso) && (
        <div
          style={{
            marginBottom: "14px",
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
              detalleProductos.length
            )}
          </strong>{" "}
          productos.
        </div>
      )}

      {productosFiltrados.length ===
      0 ? (
        <div
          style={{
            padding: "18px",
            borderRadius:
              "12px",
            backgroundColor:
              "#faf7f8",
            color:
              "#6f666a",
          }}
        >
          No hay productos que coincidan con los filtros seleccionados.
        </div>
      ) : (
        <div
          style={{
            display: "grid",
            gap: "10px",
          }}
        >
          {productosFiltrados.map(
            (producto) => (
              <div
                key={
                  producto.llave
                }
                style={{
                  display: "flex",
                  justifyContent:
                    "space-between",
                  alignItems:
                    "center",
                  gap: "18px",
                  flexWrap:
                    "wrap",
                  padding:
                    "14px 16px",
                  borderRadius:
                    "12px",
                  border:
                    producto
                      .cubiertoPorTraspaso >
                    0
                      ? "1px solid #cfe0fa"
                      : "1px solid #eee3e8",
                  backgroundColor:
                    producto
                      .cubiertoPorTraspaso >
                    0
                      ? "#f8fbff"
                      : "#fffdfd",
                }}
              >
                <div>
                  <strong>
                    {
                      producto.descripcion
                    }
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
                    {producto.codigo ||
                      "Sin código"}
                  </div>

                  <div
                    style={{
                      marginTop:
                        "4px",
                      color:
                        "#6f666a",
                    }}
                  >
                    Existencia:{" "}
                    {formatearNumero(
                      producto
                        .existenciaActual
                    )}{" "}
                    · Vendidas:{" "}
                    {formatearNumero(
                      producto
                        .piezasVendidas
                    )}
                  </div>

                  {producto
                    .cubiertoPorTraspaso >
                    0 && (
                    <div
                      style={{
                        marginTop:
                          "4px",
                        color:
                          "#315a9b",
                        fontWeight:
                          700,
                      }}
                    >
                      🔄 Traspaso cubre{" "}
                      {formatearNumero(
                        producto
                          .cubiertoPorTraspaso
                      )}{" "}
                      pzas
                    </div>
                  )}
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
                    }}
                  >
                    {formatearNumero(
                      producto
                        .cantidadComprar
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
                      producto
                        .inversionEstimada
                    )}
                  </div>
                </div>
              </div>
            )
          )}
        </div>
      )}
    </section>
  );
}