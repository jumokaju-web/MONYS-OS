// ======================================================
// MONYS ERP AI
// Componente Reutilizable
// TarjetaIndicador.jsx
// ======================================================

function TarjetaIndicador({
  titulo,
  valor,
  subtitulo = "",
  icono = "📊",
  color = "#f8f8f8",
}) {
  return (
    <article
      style={{
        padding: "20px",
        borderRadius: "16px",
        backgroundColor: color,
        border: "1px solid #f1dce6",
        boxShadow: "0 4px 12px rgba(0,0,0,0.05)",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "10px",
          marginBottom: "12px",
        }}
      >
        <span style={{ fontSize: "24px" }}>{icono}</span>

        <p
          style={{
            margin: 0,
            color: "#766a70",
            fontWeight: "600",
          }}
        >
          {titulo}
        </p>
      </div>

      <strong
        style={{
          display: "block",
          fontSize: "30px",
          lineHeight: "1.2",
        }}
      >
        {valor}
      </strong>

      {subtitulo && (
        <p
          style={{
            marginTop: "10px",
            marginBottom: 0,
            color: "#666",
            lineHeight: "1.5",
          }}
        >
          {subtitulo}
        </p>
      )}
    </article>
  );
}

export default TarjetaIndicador;