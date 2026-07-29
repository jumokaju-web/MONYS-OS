// ======================================================
// MONYS ERP AI
// Director Inventario IA
// ======================================================

function DirectorInventario({ datosDashboard }) {
  const metricas = datosDashboard?.metricas;
  const productoMasVendido = metricas?.productoMasVendido;

  return (
    <section
      style={{
        marginTop: "30px",
        padding: "28px",
        borderRadius: "22px",
        background:
          "linear-gradient(135deg, #ffffff 0%, #eef9ff 100%)",
        border: "1px solid #b8dff5",
        boxShadow: "0 12px 35px rgba(39, 120, 170, 0.12)",
      }}
    >
      <h2
        style={{
          marginTop: 0,
          fontSize: "28px",
        }}
      >
        📦 Informe del Director Inventario IA
      </h2>

      {!metricas || !productoMasVendido ? (
        <p
          style={{
            marginBottom: 0,
            lineHeight: "1.6",
          }}
        >
          No hay información disponible para generar el análisis de
          inventario.
        </p>
      ) : (
        <>
          <div
            style={{
              marginTop: "22px",
              padding: "20px",
              borderRadius: "16px",
              backgroundColor: "#ffffff",
              border: "1px solid #d7eaf5",
            }}
          >
            <p
              style={{
                margin: 0,
                color: "#5f6f78",
              }}
            >
              Producto de mayor rotación
            </p>

            <strong
              style={{
                display: "block",
                marginTop: "8px",
                fontSize: "22px",
                lineHeight: "1.4",
              }}
            >
              {productoMasVendido.descripcion || "Sin información"}
            </strong>

            <p
              style={{
                marginBottom: 0,
                lineHeight: "1.6",
              }}
            >
              Se vendieron{" "}
              <strong>{productoMasVendido.cantidad || 0}</strong>{" "}
              piezas.
            </p>
          </div>

          <div
            style={{
              marginTop: "22px",
              padding: "18px",
              borderRadius: "15px",
              backgroundColor: "#f4fbff",
              border: "1px solid #cfe7f4",
            }}
          >
            <strong>📋 Recomendación del Director Inventario</strong>

            <p
              style={{
                marginBottom: 0,
                lineHeight: "1.6",
              }}
            >
              Revisar las existencias de este producto y considerarlo
              para el próximo pedido al proveedor, ya que actualmente
              es el producto con mayor rotación.
            </p>
          </div>
        </>
      )}
    </section>
  );
}

export default DirectorInventario;