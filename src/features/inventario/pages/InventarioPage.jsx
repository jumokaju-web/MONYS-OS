import { useEffect, useState } from "react";
import "../inventario.css";

import TarjetaProducto from "../components/TarjetaProducto";
import TablaProductos from "../components/TablaProductos";
import IndicadoresInventario from "../components/IndicadoresInventario";
import FormularioProducto from "../components/FormularioProducto";

import {
  obtenerProductos,
  agregarProducto,
} from "../services/inventarioService";

function calcularEstadoProducto(existencia, stockMinimo) {
  const existenciaActual = Number(existencia);
  const minimo = Number(stockMinimo) || 5;

  if (existenciaActual <= minimo) {
    return "🔴 Comprar urgente";
  }

  if (existenciaActual <= minimo * 3) {
    return "🟡 Stock medio";
  }

  return "🟢 Stock saludable";
}

function InventarioPage({ volverAlDashboard }) {
  const [productos, setProductos] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [mensaje, setMensaje] = useState("");
  const [tipoMensaje, setTipoMensaje] = useState("");

  useEffect(() => {
    cargarProductos();
  }, []);

  async function cargarProductos() {
    try {
      setCargando(true);
      setMensaje("");
      setTipoMensaje("");

      const lista = await obtenerProductos();

      setProductos(lista);
    } catch (error) {
      console.error("Error al cargar productos:", error);

      setMensaje(
        error?.message ||
          "No fue posible cargar el inventario."
      );
      setTipoMensaje("error");
    } finally {
      setCargando(false);
    }
  }

  async function guardarProducto(productoNuevo) {
    try {
      setMensaje("");
      setTipoMensaje("");

      const estado = calcularEstadoProducto(
        productoNuevo.existencia,
        productoNuevo.stock_minimo
      );

      const productoGuardado = await agregarProducto({
        ...productoNuevo,
        estado,
      });

      setProductos((productosActuales) => [
        productoGuardado,
        ...productosActuales,
      ]);

      setMensaje("Producto guardado correctamente.");
      setTipoMensaje("exito");

      return productoGuardado;
    } catch (error) {
      console.error("Error al guardar producto:", error);

      setMensaje(
        error?.message ||
          "No fue posible guardar el producto."
      );
      setTipoMensaje("error");

      throw error;
    }
  }

  const totalProductos = productos.length;

  const stockBajo = productos.filter((producto) => {
    const existencia = Number(producto.existencia);
    const stockMinimo = Number(producto.stock_minimo) || 5;

    return existencia <= stockMinimo;
  }).length;

  const valorInventario = productos.reduce(
    (total, producto) =>
      total +
      Number(producto.existencia || 0) *
        Number(producto.costo || 0),
    0
  );

  const comprasUrgentes = productos.filter((producto) => {
    const existencia = Number(producto.existencia);
    const stockMinimo = Number(producto.stock_minimo) || 5;

    return existencia <= stockMinimo;
  }).length;

  return (
    <main className="inventario-container">
      <h1 className="inventario-titulo">
        📦 Inventario Inteligente
      </h1>

      <p className="inventario-subtitulo">
        Bienvenida al módulo de Inventario de MONYS ERP AI.
      </p>

      <button
        className="boton-regresar"
        onClick={volverAlDashboard}
      >
        ← Regresar al Dashboard
      </button>

      <IndicadoresInventario
        totalProductos={totalProductos}
        stockBajo={stockBajo}
        valorInventario={valorInventario.toLocaleString(
          "es-MX",
          {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          }
        )}
        comprasUrgentes={comprasUrgentes}
      />

      {mensaje && (
        <p
          style={{
            fontWeight: "700",
            marginTop: "16px",
          }}
        >
          {tipoMensaje === "exito" ? "✅ " : "⚠️ "}
          {mensaje}
        </p>
      )}

      <FormularioProducto
        onAgregarProducto={guardarProducto}
      />

      <hr />

      {cargando ? (
        <h3>Cargando inventario...</h3>
      ) : productos.length === 0 ? (
        <p>No hay productos registrados todavía.</p>
      ) : (
        <>
        {/*
        <section className="lista-productos">
          {productos.map((producto) => (
            <TarjetaProducto
              key={producto.id}
              nombre={producto.nombre}
              existencia={producto.existencia}
              costo={producto.costo}
              precio={producto.precio}
              estado={calcularEstadoProducto(
                producto.existencia,
                producto.stock_minimo
              )}
            />
          ))}
        </section>
      */}
      <TablaProductos productos={productos} />
      </>
      )}
    </main>
  );
}

export default InventarioPage;