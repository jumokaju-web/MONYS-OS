import {
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  obtenerProductos,
  obtenerSucursalesInventario,
  obtenerExistenciasPorSucursal,
  transferirInventario,
  obtenerTransferenciasInventario,
} from "../services/inventarioService";

function TransferenciasInventario() {
  const [productos, setProductos] =
    useState([]);

  const [sucursales, setSucursales] =
    useState([]);

  const [existencias, setExistencias] =
    useState([]);

  const [transferencias, setTransferencias] =
    useState([]);

  const [cargando, setCargando] =
    useState(true);

  const [guardando, setGuardando] =
    useState(false);

  const [mensaje, setMensaje] =
    useState("");

  const [tipoMensaje, setTipoMensaje] =
    useState("");

  const [formulario, setFormulario] =
    useState({
      productId: "",
      branchOrigenId: "",
      branchDestinoId: "",
      cantidad: "",
    });

  useEffect(() => {
    cargarDatos();
  }, []);

  async function cargarDatos() {
    try {
      setCargando(true);

      const [
        productosData,
        sucursalesData,
        existenciasData,
        transferenciasData,
      ] = await Promise.all([
        obtenerProductos(),
        obtenerSucursalesInventario(),
        obtenerExistenciasPorSucursal(),
        obtenerTransferenciasInventario(),
      ]);

      setProductos(
        productosData ?? []
      );

      setSucursales(
        sucursalesData ?? []
      );

      setExistencias(
        existenciasData ?? []
      );

      setTransferencias(
        transferenciasData ?? []
      );
    } catch (error) {
      console.error(
        "Error al cargar transferencias:",
        error
      );

      setMensaje(
        error?.message ||
          "No fue posible cargar la información."
      );

      setTipoMensaje("error");
    } finally {
      setCargando(false);
    }
  }

  const sucursalesDisponibles =
    useMemo(() => {
      const ids =
        new Set(
          existencias.map(
            (registro) =>
              registro.branch_id
          )
        );

      return sucursales.filter(
        (sucursal) =>
          ids.has(sucursal.id)
      );
    }, [
      sucursales,
      existencias,
    ]);

  function actualizarCampo(evento) {
    const {
      name,
      value,
    } = evento.target;

    setFormulario(
      (anterior) => ({
        ...anterior,
        [name]: value,
      })
    );
  }

  function obtenerProducto(
    productId
  ) {
    return productos.find(
      (producto) =>
        producto.id === productId
    );
  }

  function obtenerSucursal(
    branchId
  ) {
    return sucursales.find(
      (sucursal) =>
        sucursal.id === branchId
    );
  }

  function obtenerExistencia(
    productId,
    branchId
  ) {
    const registro =
      existencias.find(
        (item) =>
          item.product_id ===
            productId &&
          item.branch_id ===
            branchId
      );

    return Number(
      registro?.existencia ?? 0
    );
  }

  const existenciaOrigen =
    formulario.productId &&
    formulario.branchOrigenId
      ? obtenerExistencia(
          formulario.productId,
          formulario.branchOrigenId
        )
      : null;

  const existenciaDestino =
    formulario.productId &&
    formulario.branchDestinoId
      ? obtenerExistencia(
          formulario.productId,
          formulario.branchDestinoId
        )
      : null;

  async function realizarTransferencia(
    evento
  ) {
    evento.preventDefault();

    try {
      setGuardando(true);
      setMensaje("");
      setTipoMensaje("");

      await transferirInventario({
        productId:
          formulario.productId,

        branchOrigenId:
          formulario.branchOrigenId,

        branchDestinoId:
          formulario.branchDestinoId,

        cantidad:
          Number(
            formulario.cantidad
          ),
      });

      setFormulario({
        productId: "",
        branchOrigenId: "",
        branchDestinoId: "",
        cantidad: "",
      });

      await cargarDatos();

      setMensaje(
        "Transferencia realizada correctamente."
      );

      setTipoMensaje("exito");
    } catch (error) {
      console.error(
        "Error al realizar transferencia:",
        error
      );

      setMensaje(
        error?.message ||
          "No fue posible realizar la transferencia."
      );

      setTipoMensaje("error");
    } finally {
      setGuardando(false);
    }
  }

  if (cargando) {
    return (
      <section
        style={{
          marginTop: "24px",
          padding: "24px",
          borderRadius: "18px",
          backgroundColor: "#ffffff",
          border:
            "1px solid #ead7e1",
        }}
      >
        <strong>
          Cargando transferencias
          de inventario...
        </strong>
      </section>
    );
  }

  return (
    <section
      style={{
        marginTop: "24px",
        padding: "24px",
        borderRadius: "20px",
        background:
          "linear-gradient(135deg, #ffffff 0%, #fff5fa 100%)",
        border:
          "1px solid #e8bfd2",
        boxShadow:
          "0 10px 28px rgba(151, 63, 107, 0.10)",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent:
            "space-between",
          alignItems: "center",
          gap: "15px",
          flexWrap: "wrap",
        }}
      >
        <div>
          <p
            style={{
              margin: "0 0 5px",
              color: "#b44178",
              fontWeight: "800",
              letterSpacing:
                "0.8px",
            }}
          >
            MONYS OS · INVENTARIO
          </p>

          <h2
            style={{
              margin: 0,
              fontSize: "26px",
            }}
          >
            🔄 Transferencias entre
            sucursales
          </h2>
        </div>

        <div
          style={{
            padding:
              "9px 14px",
            borderRadius:
              "999px",
            backgroundColor:
              "#f3fff6",
            color: "#207a4a",
            border:
              "1px solid #ccebd5",
            fontWeight: "800",
          }}
        >
          {
            transferencias.length
          }{" "}
          movimientos
        </div>
      </div>

      <p
        style={{
          color: "#675a60",
          lineHeight: "1.6",
        }}
      >
        Mueve mercancía de una
        sucursal a otra y MONYS OS
        actualizará las existencias
        y guardará el historial del
        movimiento.
      </p>

      {mensaje && (
        <div
          style={{
            marginTop: "16px",
            padding: "13px",
            borderRadius:
              "12px",
            backgroundColor:
              tipoMensaje ===
              "exito"
                ? "#eefbf3"
                : "#fff0f0",
            border:
              tipoMensaje ===
              "exito"
                ? "1px solid #b8e5ca"
                : "1px solid #efb8b8",
            color:
              tipoMensaje ===
              "exito"
                ? "#207a4a"
                : "#a52d2d",
            fontWeight: "700",
          }}
        >
          {tipoMensaje === "exito"
            ? "✅ "
            : "⚠️ "}
          {mensaje}
        </div>
      )}

      <form
        onSubmit={
          realizarTransferencia
        }
        style={{
          display: "grid",
          gap: "16px",
          marginTop: "22px",
        }}
      >
        <label>
          <strong>
            Producto
          </strong>

          <select
            name="productId"
            value={
              formulario.productId
            }
            onChange={
              actualizarCampo
            }
            required
            style={{
              width: "100%",
              marginTop: "7px",
              padding: "12px",
              borderRadius:
                "10px",
              border:
                "1px solid #d9cbd2",
              backgroundColor:
                "#ffffff",
            }}
          >
            <option value="">
              Selecciona un producto
            </option>

            {productos.map(
              (producto) => (
                <option
                  key={
                    producto.id
                  }
                  value={
                    producto.id
                  }
                >
                  {producto.nombre}
                  {producto.sku
                    ? ` · ${producto.sku}`
                    : ""}
                </option>
              )
            )}
          </select>
        </label>

        <div
          style={{
            display: "grid",
            gridTemplateColumns:
              "repeat(auto-fit, minmax(230px, 1fr))",
            gap: "16px",
          }}
        >
          <label>
            <strong>
              Sale de
            </strong>

            <select
              name="branchOrigenId"
              value={
                formulario.branchOrigenId
              }
              onChange={
                actualizarCampo
              }
              required
              style={{
                width: "100%",
                marginTop: "7px",
                padding: "12px",
                borderRadius:
                  "10px",
                border:
                  "1px solid #d9cbd2",
                backgroundColor:
                  "#ffffff",
              }}
            >
              <option value="">
                Selecciona origen
              </option>

              {sucursalesDisponibles.map(
                (sucursal) => (
                  <option
                    key={
                      sucursal.id
                    }
                    value={
                      sucursal.id
                    }
                  >
                    {sucursal.name}
                  </option>
                )
              )}
            </select>

            {existenciaOrigen !==
              null && (
              <div
                style={{
                  marginTop:
                    "8px",
                  padding:
                    "9px 11px",
                  borderRadius:
                    "9px",
                  backgroundColor:
                    "#fff8df",
                  color:
                    "#75600d",
                  fontWeight:
                    "700",
                }}
              >
                Disponible:{" "}
                {
                  existenciaOrigen
                }{" "}
                piezas
              </div>
            )}
          </label>

          <label>
            <strong>
              Llega a
            </strong>

            <select
              name="branchDestinoId"
              value={
                formulario.branchDestinoId
              }
              onChange={
                actualizarCampo
              }
              required
              style={{
                width: "100%",
                marginTop: "7px",
                padding: "12px",
                borderRadius:
                  "10px",
                border:
                  "1px solid #d9cbd2",
                backgroundColor:
                  "#ffffff",
              }}
            >
              <option value="">
                Selecciona destino
              </option>

              {sucursalesDisponibles
                .filter(
                  (sucursal) =>
                    sucursal.id !==
                    formulario.branchOrigenId
                )
                .map(
                  (sucursal) => (
                    <option
                      key={
                        sucursal.id
                      }
                      value={
                        sucursal.id
                      }
                    >
                      {sucursal.name}
                    </option>
                  )
                )}
            </select>

            {existenciaDestino !==
              null && (
              <div
                style={{
                  marginTop:
                    "8px",
                  padding:
                    "9px 11px",
                  borderRadius:
                    "9px",
                  backgroundColor:
                    "#eef9ff",
                  color:
                    "#287da9",
                  fontWeight:
                    "700",
                }}
              >
                Existencia actual:{" "}
                {
                  existenciaDestino
                }{" "}
                piezas
              </div>
            )}
          </label>
        </div>

        <label>
          <strong>
            Cantidad a transferir
          </strong>

          <input
            type="number"
            name="cantidad"
            min="1"
            step="1"
            value={
              formulario.cantidad
            }
            onChange={
              actualizarCampo
            }
            required
            placeholder="Ejemplo: 5"
            style={{
              width: "100%",
              boxSizing:
                "border-box",
              marginTop: "7px",
              padding: "12px",
              borderRadius:
                "10px",
              border:
                "1px solid #d9cbd2",
            }}
          />
        </label>

        <button
          type="submit"
          disabled={
            guardando
          }
          style={{
            padding:
              "14px 18px",
            borderRadius:
              "12px",
            border: "none",
            backgroundColor:
              guardando
                ? "#d9cbd2"
                : "#b44178",
            color: "#ffffff",
            fontSize: "16px",
            fontWeight: "800",
            cursor:
              guardando
                ? "not-allowed"
                : "pointer",
          }}
        >
          {guardando
            ? "Transfiriendo..."
            : "🔄 Realizar transferencia"}
        </button>
      </form>

      <div
        style={{
          marginTop: "28px",
        }}
      >
        <h3>
          🏪 Existencias actuales
          por sucursal
        </h3>

        {existencias.length ===
        0 ? (
          <p>
            No hay existencias por
            sucursal registradas.
          </p>
        ) : (
          <div
            style={{
              overflowX:
                "auto",
            }}
          >
            <table
              style={{
                width: "100%",
                borderCollapse:
                  "collapse",
                backgroundColor:
                  "#ffffff",
              }}
            >
              <thead>
                <tr>
                  <th
                    style={{
                      textAlign:
                        "left",
                      padding:
                        "11px",
                    }}
                  >
                    Producto
                  </th>

                  <th
                    style={{
                      textAlign:
                        "left",
                      padding:
                        "11px",
                    }}
                  >
                    Sucursal
                  </th>

                  <th
                    style={{
                      textAlign:
                        "right",
                      padding:
                        "11px",
                    }}
                  >
                    Existencia
                  </th>
                </tr>
              </thead>

              <tbody>
                {existencias.map(
                  (registro) => {
                    const producto =
                      obtenerProducto(
                        registro.product_id
                      );

                    const sucursal =
                      obtenerSucursal(
                        registro.branch_id
                      );

                    return (
                      <tr
                        key={
                          registro.id
                        }
                      >
                        <td
                          style={{
                            padding:
                              "11px",
                            borderTop:
                              "1px solid #eee",
                          }}
                        >
                          {producto?.nombre ||
                            "Producto"}
                        </td>

                        <td
                          style={{
                            padding:
                              "11px",
                            borderTop:
                              "1px solid #eee",
                          }}
                        >
                          {sucursal?.name ||
                            "Sucursal"}
                        </td>

                        <td
                          style={{
                            padding:
                              "11px",
                            borderTop:
                              "1px solid #eee",
                            textAlign:
                              "right",
                            fontWeight:
                              "800",
                          }}
                        >
                          {
                            registro.existencia
                          }
                        </td>
                      </tr>
                    );
                  }
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </section>
  );
}

export default TransferenciasInventario;