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
  compacto = false,
}) {
  return (
    <article
      style={{
        padding: compacto ? "11px" : "20px",
        borderRadius: compacto ? "11px" : "16px",
        backgroundColor: color,
        border: "1px solid #f1dce6",
        boxShadow: compacto ? "none" : "0 4px 12px rgba(0,0,0,0.05)",

        // Evita que textos largos ensanchen la tarjeta.
        minWidth: 0,
        width: "100%",
        boxSizing: "border-box",
        overflow: "hidden",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: compacto ? "6px" : "10px",
          marginBottom: compacto ? "6px" : "12px",
          minWidth: 0,
        }}
      >
        <span
          style={{
            fontSize: compacto ? "17px" : "24px",
            flexShrink: 0,
          }}
        >
          {icono}
        </span>

        <p
          style={{
            margin: 0,
            color: "#766a70",
            fontWeight: "600",
            fontSize: compacto ? "12px" : "inherit",
            lineHeight: compacto ? "1.25" : "normal",

            // Permite títulos largos.
            minWidth: 0,
            overflowWrap: "anywhere",
            wordBreak: "break-word",
          }}
        >
          {titulo}
        </p>
      </div>

      <strong
        style={{
          display: "block",

          // Mantiene números grandes,
          // pero se adapta mejor en pantallas pequeñas.
          fontSize: compacto ? "clamp(17px, 4.6vw, 22px)" : "clamp(22px, 3vw, 30px)",
          lineHeight: "1.2",

          // Evita desbordamiento de nombres largos.
          maxWidth: "100%",
          overflowWrap: "anywhere",
          wordBreak: "break-word",
          whiteSpace: "normal",
        }}
      >
        {valor}
      </strong>

      {subtitulo && (
        <p
          style={{
            marginTop: compacto ? "5px" : "10px",
            marginBottom: 0,
            color: "#666",
            lineHeight: "1.5",
            fontSize: compacto ? "11px" : "inherit",

            maxWidth: "100%",
            overflowWrap: "anywhere",
            wordBreak: "break-word",
          }}
        >
          {subtitulo}
        </p>
      )}
    </article>
  );
}

export default TarjetaIndicador;
