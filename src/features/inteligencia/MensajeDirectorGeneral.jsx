import { generarMensajeDirectorGeneral } from "./directorGeneralIA";

function MensajeDirectorGeneral({
  resumen,
  totalProductos,
  totalPiezas,
  productoLider,
  cantidadProductoLider,
}) {

  const analisis = generarMensajeDirectorGeneral({
    totalProductos,
    totalPiezas,
   productoMasVendido: {
  descripcion: productoLider,
  cantidad: cantidadProductoLider,
},
  });

  return (
    <div
      style={{
        display: "grid",
        gap: "18px",
      }}
    >
      <div
        style={{
          display: "grid",
          gap: "12px",
        }}
      >
        <p style={{ margin: 0 }}>
          <strong>{analisis.saludo}</strong>
        </p>

        <p style={{ margin: 0 }}>
          {analisis.estado}
        </p>

        <div>
          <strong>📋 Hallazgos</strong>

          <ul>
            {analisis.hallazgos.map((item, index) => (
              <li key={index}>{item}</li>
            ))}
          </ul>
        </div>

        <div>
          <strong>💡 Recomendaciones</strong>

          <ul>
            {analisis.recomendaciones.map((item, index) => (
              <li key={index}>{item}</li>
            ))}
          </ul>
        </div>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
          gap: "14px",
        }}
      >
        <div
          style={{
            padding: "16px",
            borderRadius: "14px",
            backgroundColor: "#fff7fb",
            border: "1px solid #efd1df",
          }}
        >
          <strong>📦 Productos</strong>
          <br />
          {totalProductos ?? 0}
        </div>

        <div
          style={{
            padding: "16px",
            borderRadius: "14px",
            backgroundColor: "#fff7fb",
            border: "1px solid #efd1df",
          }}
        >
          <strong>🛒 Piezas</strong>
          <br />
          {totalPiezas ?? 0}
        </div>

        <div
          style={{
            padding: "16px",
            borderRadius: "14px",
            backgroundColor: "#fff7fb",
            border: "1px solid #efd1df",
          }}
        >
          <strong>🏆 Producto líder</strong>
          <br />
          {productoLider ?? "Sin datos"}
        </div>
      </div>
    </div>
  );
}

export default MensajeDirectorGeneral;