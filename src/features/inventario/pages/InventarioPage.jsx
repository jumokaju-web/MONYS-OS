import {
  useEffect,
  useMemo,
  useState,
} from "react";

import "../inventario.css";

import TablaProductos from "../components/TablaProductos";
import IndicadoresInventario from "../components/IndicadoresInventario";
import FormularioProducto from "../components/FormularioProducto";

import {
  obtenerProductos,
  agregarProducto,
  obtenerSucursalesInventario,
  obtenerExistenciasPorSucursal,
  transferirInventario,
  obtenerTransferenciasInventario,
} from "../services/inventarioService";

function calcularEstadoProducto(
  existencia,
  stockMinimo
) {
  const existenciaActual =
    Number(existencia);

  const minimo =
    Number(stockMinimo) || 5;

  if (existenciaActual <= minimo) {
    return "🔴 Comprar urgente";
  }

  if (
    existenciaActual <=
    minimo * 3
  ) {
    return "🟡 Stock medio";
  }

  return "🟢 Stock saludable";
}

function InventarioPage({
  volverAlDashboard,
}) {
  const [
    productos,
    setProductos,
  ] = useState([]);

  const [
    sucursales,
    setSucursales,
  ] = useState([]);

  const [
    existencias,
    setExistencias,
  ] = useState([]);

  const [
    transferencias,
    setTransferencias,
  ] = useState([]);

  const [
    cargando,
    setCargando,
  ] = useState(true);

  const [
    transfiriendo,
    setTransfiriendo,
  ] = useState(false);

  const [
    mensaje,
    setMensaje,
  ] = useState("");

  const [
    tipoMensaje,
    setTipoMensaje,
  ] = useState("");

  const [
    transferencia,
    setTransferencia,
  ] = useState({
    productId: "",
    branchOrigenId: "",
    branchDestinoId: "",
    cantidad: "",
  });

  useEffect(() => {
    cargarInventarioCompleto();
  }, []);

  async function cargarInventarioCompleto() {
    try {
      setCargando(true);
      setMensaje("");
      setTipoMensaje("");

      const [
        listaProductos,
        listaSucursales,
        listaExistencias,
        listaTransferencias,
      ] = await Promise.all([
        obtenerProductos(),
        obtenerSucursalesInventario(),
        obtenerExistenciasPorSucursal(),
        obtenerTransferenciasInventario(),
      ]);

      setProductos(
        listaProductos
      );

      setSucursales(
        listaSucursales
      );

      setExistencias(
        listaExistencias
      );

      setTransferencias(
        listaTransferencias
      );
    } catch (error) {
      console.error(
        "Error al cargar inventario:",
        error
      );

      setMensaje(
        error?.message ||
          "No fue posible cargar el inventario."
      );

      setTipoMensaje(
        "error"
      );
    } finally {
      setCargando(false);
    }
  }

  async function guardarProducto(
    productoNuevo
  ) {
    try {
      setMensaje("");
      setTipoMensaje("");

      const estado =
        calcularEstadoProducto(
          productoNuevo.existencia,
          productoNuevo.stock_minimo
        );

      const productoGuardado =
        await agregarProducto({
          ...productoNuevo,
          estado,
        });

      setProductos(
        (
          productosActuales
        ) => [
          productoGuardado,
          ...productosActuales,
        ]
      );

      setMensaje(
        "Producto guardado correctamente."
      );

      setTipoMensaje(
        "exito"
      );

      return productoGuardado;
    } catch (error) {
      console.error(
        "Error al guardar producto:",
        error
      );

      setMensaje(
        error?.message ||
          "No fue posible guardar el producto."
      );

      setTipoMensaje(
        "error"
      );

      throw error;
    }
  }

  const sucursalesInventario =
    useMemo(() => {
      const idsSucursales =
        new Set(
          existencias.map(
            (item) =>
              item.branch_id
          )
        );

      return sucursales.filter(
        (sucursal) =>
          idsSucursales.has(
            sucursal.id
          )
      );
    }, [
      sucursales,
      existencias,
    ]);

  function obtenerNombreProducto(
    productId
  ) {
    const producto =
      productos.find(
        (item) =>
          item.id === productId
      );

    return (
      producto?.nombre ||
      "Producto"
    );
  }

  function obtenerNombreSucursal(
    branchId
  ) {
    const sucursal =
      sucursales.find(
        (item) =>
          item.id === branchId
      );

    return (
      sucursal?.name ||
      "Sucursal"
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
      registro?.existencia ||
        0
    );
  }

  const existenciaOrigen =
    transferencia.productId &&
    transferencia.branchOrigenId
      ? obtenerExistencia(
          transferencia.productId,
          transferencia.branchOrigenId
        )
      : null;

  function actualizarTransferencia(
    evento
  ) {
    const {
      name,
      value,
    } = evento.target;

    setTransferencia(
      (anterior) => ({
        ...anterior,
        [name]: value,
      })
    );
  }

  async function realizarTransferencia(
    evento
  ) {
    evento.preventDefault();

    try {
      setTransfiriendo(true);
      setMensaje("");
      setTipoMensaje("");

      await transferirInventario({
        productId:
          transferencia.productId,

        branchOrigenId:
          transferencia.branchOrigenId,

        branchDestinoId:
          transferencia.branchDestinoId,

        cantidad:
          Number(
            transferencia.cantidad
          ),
      });

      setMensaje(
        "Transferencia realizada correctamente."
      );

      setTipoMensaje(
        "exito"
      );

      setTransferencia({
        productId: "",
        branchOrigenId: "",
        branchDestinoId: "",
        cantidad: "",
      });

      await cargarInventarioCompleto();

      setMensaje(
        "Transferencia realizada correctamente."
      );

      setTipoMensaje(
        "exito"
      );
    } catch (error) {
      console.error(
        "Error al transferir inventario:",
        error
      );

      setMensaje(
        error?.message ||
          "No fue posible realizar la transferencia."
      );

      setTipoMensaje(
        "error"
      );
    } finally {
      setTransfiriendo(false);
    }
  }

  const totalProductos =
    productos.length;

  const stockBajo =
    productos.filter(
      (producto) => {
        const existencia =
          Number(
            producto.existencia
          );

        const stockMinimo =
          Number(
            producto.stock_minimo
          ) || 5;

        return (
          existencia <=
          stockMinimo
        );
      }
    ).length;

  const valorInventario =
    productos.reduce(
      (
        total,
        producto
      ) =>
        total +
        Number(
          producto.existencia ||
            0
        ) *
          Number(
            producto.costo ||
              0
          ),
      0
    );

  const comprasUrgentes =
    stockBajo;

  return (
    <main className="inventario-container">
      <h1 className="inventario-titulo">
        📦 Inventario Inteligente
      </h1>

      <p className="inventario-subtitulo">
        Control de productos,
        existencias y movimientos
        entre sucursales.
      </p>

      <button
        className="boton-regresar"
        onClick={
          volverAlDashboard
        }
      >
        ← Regresar al Dashboard
      </button>

      <IndicadoresInventario
        totalProductos={
          totalProductos
        }
        stockBajo={
          stockBajo
        }
        valorInventario={valorInventario.toLocaleString(
          "es-MX",
          {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          }
        )}
        comprasUrgentes={
          comprasUrgentes
        }
      />

      {mensaje && (
        <p
          style={{
            fontWeight: "700",
            marginTop: "16px",
            padding: "12px",
            borderRadius:
              "10px",
            background:
              tipoMensaje ===
              "exito"
                ? "#eefbf3"
                : "#fff3f3",
          }}
        >
          {tipoMensaje ===
          "exito"
            ? "✅ "
            : "⚠️ "}
          {mensaje}
        </p>
      )}

      <section
        style={{
          marginTop: "28px",
          padding: "24px",
          background:
            "#ffffff",
          border:
            "1px solid #ead7e1",
          borderRadius:
            "18px",
        }}
      >
        <h2
          style={{
            marginTop: 0,
          }}
        >
          🔄 Transferir entre
          sucursales
        </h2>

        <p>
          Mueve producto de una
          sucursal a otra y MONYS
          OS actualizará las
          existencias.
        </p>

        <form
          onSubmit={
            realizarTransferencia
          }
          style={{
            display: "grid",
            gap: "16px",
          }}
        >
          <label>
            <strong>
              Producto
            </strong>

            <select
              name="productId"
              value={
                transferencia.productId
              }
              onChange={
                actualizarTransferencia
              }
              required
              style={{
                width: "100%",
                padding: "12px",
                marginTop:
                  "6px",
              }}
            >
              <option value="">
                Selecciona un
                producto
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
                    {
                      producto.nombre
                    }
                    {producto.sku
                      ? ` - ${producto.sku}`
                      : ""}
                  </option>
                )
              )}
            </select>
          </label>

          <label>
            <strong>
              Sucursal de origen
            </strong>

            <select
              name="branchOrigenId"
              value={
                transferencia.branchOrigenId
              }
              onChange={
                actualizarTransferencia
              }
              required
              style={{
                width: "100%",
                padding: "12px",
                marginTop:
                  "6px",
              }}
            >
              <option value="">
                Selecciona origen
              </option>

              {sucursalesInventario.map(
                (
                  sucursal
                ) => (
                  <option
                    key={
                      sucursal.id
                    }
                    value={
                      sucursal.id
                    }
                  >
                    {
                      sucursal.name
                    }
                  </option>
                )
              )}
            </select>
          </label>

          {existenciaOrigen !==
            null && (
            <div
              style={{
                padding:
                  "12px",
                background:
                  "#faf4f7",
                borderRadius:
                  "10px",
                fontWeight:
                  "700",
              }}
            >
              Existencia disponible
              en origen:{" "}
              {existenciaOrigen}{" "}
              piezas
            </div>
          )}

          <label>
            <strong>
              Sucursal de destino
            </strong>

            <select
              name="branchDestinoId"
              value={
                transferencia.branchDestinoId
              }
              onChange={
                actualizarTransferencia
              }
              required
              style={{
                width: "100%",
                padding: "12px",
                marginTop:
                  "6px",
              }}
            >
              <option value="">
                Selecciona destino
              </option>

              {sucursalesInventario
                .filter(
                  (
                    sucursal
                  ) =>
                    sucursal.id !==
                    transferencia.branchOrigenId
                )
                .map(
                  (
                    sucursal
                  ) => (
                    <option
                      key={
                        sucursal.id
                      }
                      value={
                        sucursal.id
                      }
                    >
                      {
                        sucursal.name
                      }
                    </option>
                  )
                )}
            </select>
          </label>

          <label>
            <strong>
              Cantidad
            </strong>

            <input
              type="number"
              name="cantidad"
              min="1"
              step="1"
              value={
                transferencia.cantidad
              }
              onChange={
                actualizarTransferencia
              }
              required
              style={{
                width: "100%",
                padding: "12px",
                marginTop:
                  "6px",
                boxSizing:
                  "border-box",
              }}
            />
          </label>

          <button
            type="submit"
            disabled={
              transfiriendo
            }
            style={{
              padding:
                "14px 20px",
              border: "none",
              borderRadius:
                "12px",
              fontWeight:
                "800",
              cursor:
                transfiriendo
                  ? "not-allowed"
                  : "pointer",
            }}
          >
            {transfiriendo
              ? "Transfiriendo..."
              : "🔄 Transferir producto"}
          </button>
        </form>
      </section>

      <section
        style={{
          marginTop: "28px",
          padding: "24px",
          background:
            "#ffffff",
          border:
            "1px solid #ead7e1",
          borderRadius:
            "18px",
        }}
      >
        <h2
          style={{
            marginTop: 0,
          }}
        >
          🏪 Existencias por
          sucursal
        </h2>

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
              }}
            >
              <thead>
                <tr>
                  <th
                    style={{
                      textAlign:
                        "left",
                      padding:
                        "10px",
                    }}
                  >
                    Producto
                  </th>

                  <th
                    style={{
                      textAlign:
                        "left",
                      padding:
                        "10px",
                    }}
                  >
                    Sucursal
                  </th>

                  <th
                    style={{
                      textAlign:
                        "right",
                      padding:
                        "10px",
                    }}
                  >
                    Existencia
                  </th>
                </tr>
              </thead>

              <tbody>
                {existencias.map(
                  (item) => (
                    <tr
                      key={
                        item.id
                      }
                    >
                      <td
                        style={{
                          padding:
                            "10px",
                          borderTop:
                            "1px solid #eee",
                        }}
                      >
                        {obtenerNombreProducto(
                          item.product_id
                        )}
                      </td>

                      <td
                        style={{
                          padding:
                            "10px",
                          borderTop:
                            "1px solid #eee",
                        }}
                      >
                        {obtenerNombreSucursal(
                          item.branch_id
                        )}
                      </td>

                      <td
                        style={{
                          padding:
                            "10px",
                          textAlign:
                            "right",
                          borderTop:
                            "1px solid #eee",
                          fontWeight:
                            "800",
                        }}
                      >
                        {
                          item.existencia
                        }
                      </td>
                    </tr>
                  )
                )}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section
        style={{
          marginTop: "28px",
        }}
      >
        <FormularioProducto
          onAgregarProducto={
            guardarProducto
          }
        />
      </section>

      <hr />

      {cargando ? (
        <h3>
          Cargando inventario...
        </h3>
      ) : productos.length ===
        0 ? (
        <p>
          No hay productos
          registrados todavía.
        </p>
      ) : (
        <TablaProductos
          productos={
            productos
          }
        />
      )}

      {transferencias.length >
        0 && (
        <p
          style={{
            marginTop: "20px",
            opacity: 0.7,
          }}
        >
          Transferencias
          registradas:{" "}
          <strong>
            {
              transferencias.length
            }
          </strong>
        </p>
      )}
    </main>
  );
}

export default InventarioPage;