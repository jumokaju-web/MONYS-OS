// ======================================================
// MONYS ERP AI
// Director Comercial IA
// ======================================================

import TarjetaIndicador from "../shared/TarjetaIndicador";
import { analizarVentas } from "../../comercial/ventasAnalyzer";

function DirectorComercial({ datosDashboard }) {
  const analisis = analizarVentas(datosDashboard);

  const {
    totalProductos,
    totalPiezas,
    productoMasVendido,
  } = analisis.resumen;

  return (
    <section
      style={{
        marginTop: "30px",
        padding: "28px",
        borderRadius: "22px",
        background:
          "linear-gradient(135deg, #ffffff 0%, #fff4fa 100%)",
        border: "1px solid #e8b9d0",
        boxShadow:
          "0 12px 35px rgba(112, 53, 84, 0.12)",
      }}
    >
      <h2
        style={{
          marginTop: 0,
          fontSize: "28px",
        }}
      >
        🛒 Informe del Director Comercial IA
      </h2>

      <div
        style={{
          display: "grid",
          gridTemplateColumns:
            "repeat(auto-fit, minmax(210px, 1fr))",
          gap: "16px",
          marginTop: "22px",
        }}
      >
        <TarjetaIndicador
          icono="📦"
          titulo="Productos analizados"
          valor={totalProductos}
        />

        <TarjetaIndicador
          icono="🛒"
          titulo="Piezas vendidas"
          valor={totalPiezas}
        />

        <TarjetaIndicador
          icono="⭐"
          titulo="Producto líder"
          valor={
            productoMasVendido?.descripcion ??
            "Sin información"
          }
          subtitulo={
            productoMasVendido
              ? `${productoMasVendido.cantidad} piezas vendidas`
              : ""
          }
        />
      </div>

      <div
        style={{
          marginTop: "22px",
          padding: "18px",
          borderRadius: "15px",
          backgroundColor: "#fff7fb",
          border: "1px solid #efd7e3",
        }}
      >
        <strong>Recomendaciones del Director Comercial</strong>

        <div style={{ marginTop: "12px" }}>
          {analisis.recomendaciones.map((recomendacion, index) => (
            <p
              key={index}
              style={{
                marginBottom: "10px",
                lineHeight: "1.6",
              }}
            >
              {recomendacion.prioridad === "alta"
                ? "🔴"
                : "🟡"}{" "}
              <strong>{recomendacion.titulo}:</strong>{" "}
              {recomendacion.mensaje}
            </p>
          ))}
        </div>
      </div>
    </section>
  );
}

export default DirectorComercial;