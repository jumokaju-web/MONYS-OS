import { useMemo, useState } from "react";

function TablaProductos({ productos }) {
  const [busqueda, setBusqueda] = useState("");

  function calcularEstado(existencia, stockMinimo) {
    const existenciaActual = Number(existencia);
    const minimo = Number(stockMinimo) || 5;

    if (existenciaActual <= minimo) {
      return {
        texto: "🔴 Compra urgente",
        color: "#b42318",
        fondo: "#fee4e2",
      };
    }

    if (existenciaActual <= minimo * 3) {
      return {
        texto: "🟡 Stock medio",
        color: "#93370d",
        fondo: "#fef0c7",
      };
    }

    return {
      texto: "🟢 Stock saludable",
      color: "#027a48",
      fondo: "#d1fadf",
    };
  }

  const productosFiltrados = useMemo(() => {
    const texto = busqueda.trim().toLowerCase();

    if (!texto) {
      return productos;
    }

    return productos.filter((producto) => {
      const campos = [
        producto.sku,
        producto.codigo_barras,
        producto.nombre,
        producto.marca,
        producto.categoria,
        producto.proveedor,
      ];

      return campos.some((campo) =>
        String(campo ?? "")
          .toLowerCase()
          .includes(texto)
      );
    });
  }, [busqueda, productos]);

  return (
    <section>
      <div style={estiloBuscadorContenedor}>
        <label htmlFor="buscador-productos" style={estiloEtiqueta}>
          Buscar producto
        </label>

        <input
          id="buscador-productos"
          type="search"
          value={busqueda}
          onChange={(evento) => setBusqueda(evento.target.value)}
          placeholder="Busca por SKU, código, nombre, marca, categoría o proveedor"
          style={estiloBuscador}
        />

        <p style={estiloResultados}>
          Mostrando {productosFiltrados.length} de {productos.length} productos
        </p>
      </div>

      <div
        style={{
          overflowX: "auto",
          marginTop: "20px",
        }}
      >
        <table
          style={{
            width: "100%",
            borderCollapse: "collapse",
            background: "#ffffff",
            borderRadius: "12px",
            overflow: "hidden",
          }}
        >
          <thead>
            <tr
              style={{
                background: "#f4e8f1",
              }}
            >
              <th style={estiloEncabezado}>SKU</th>
              <th style={estiloEncabezado}>Producto</th>
              <th style={estiloEncabezado}>Marca</th>
              <th style={estiloEncabezado}>Categoría</th>
              <th style={estiloEncabezado}>Existencia</th>
              <th style={estiloEncabezado}>Stock mínimo</th>
              <th style={estiloEncabezado}>Costo</th>
              <th style={estiloEncabezado}>Precio</th>
              <th style={estiloEncabezado}>Estado</th>
            </tr>
          </thead>

          <tbody>
            {productosFiltrados.length === 0 ? (
              <tr>
                <td colSpan="9" style={estiloSinResultados}>
                  No encontramos productos con esa búsqueda.
                </td>
              </tr>
            ) : (
              productosFiltrados.map((producto, indice) => {
                const estado = calcularEstado(
                  producto.existencia,
                  producto.stock_minimo
                );

                return (
                  <tr
                    key={producto.id}
                    style={{
                      background:
                        indice % 2 === 0 ? "#ffffff" : "#fafafa",
                    }}
                  >
                    <td style={estiloCelda}>
                      {producto.sku || "Sin SKU"}
                    </td>

                    <td style={estiloCelda}>{producto.nombre}</td>

                    <td style={estiloCelda}>
                      {producto.marca || "Sin marca"}
                    </td>

                    <td style={estiloCelda}>
                      {producto.categoria || "Sin categoría"}
                    </td>

                    <td style={estiloCelda}>
                      {producto.existencia}
                    </td>

                    <td style={estiloCelda}>
                      {producto.stock_minimo ?? 5}
                    </td>

                    <td style={estiloCelda}>
                      ${Number(producto.costo || 0).toFixed(2)}
                    </td>

                    <td style={estiloCelda}>
                      ${Number(producto.precio || 0).toFixed(2)}
                    </td>

                    <td style={estiloCelda}>
                      <span
                        style={{
                          display: "inline-block",
                          padding: "6px 10px",
                          borderRadius: "999px",
                          fontWeight: "700",
                          fontSize: "13px",
                          color: estado.color,
                          background: estado.fondo,
                          whiteSpace: "nowrap",
                        }}
                      >
                        {estado.texto}
                      </span>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}

const estiloBuscadorContenedor = {
  background: "#ffffff",
  padding: "18px",
  borderRadius: "14px",
  boxShadow: "0 4px 14px rgba(0, 0, 0, 0.06)",
};

const estiloEtiqueta = {
  display: "block",
  marginBottom: "8px",
  fontWeight: "700",
  color: "#4a2440",
};

const estiloBuscador = {
  width: "100%",
  padding: "12px 14px",
  border: "1px solid #d8c5d2",
  borderRadius: "10px",
  fontSize: "15px",
  outline: "none",
  boxSizing: "border-box",
};

const estiloResultados = {
  marginTop: "10px",
  marginBottom: "0",
  color: "#666666",
  fontSize: "14px",
};

const estiloEncabezado = {
  padding: "14px 12px",
  textAlign: "left",
  fontSize: "14px",
  color: "#4a2440",
  borderBottom: "1px solid #e7d6e2",
  whiteSpace: "nowrap",
};

const estiloCelda = {
  padding: "13px 12px",
  borderBottom: "1px solid #eeeeee",
  fontSize: "14px",
  color: "#333333",
  whiteSpace: "nowrap",
};

const estiloSinResultados = {
  padding: "30px",
  textAlign: "center",
  color: "#777777",
  fontSize: "15px",
};

export default TablaProductos;