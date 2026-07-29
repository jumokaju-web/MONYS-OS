export default function TarjetaMetrica({
  icono,
  titulo,
  valor,
  detalle,
}) {
  return (
    <article
      style={{
        minHeight: "130px",
        padding: "20px",
        boxSizing: "border-box",
        borderRadius: "16px",
        backgroundColor: "#ffffff",
        border: "1px solid #eadce4",
        boxShadow: "0 6px 18px rgba(70, 45, 60, 0.08)",
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
        <span
          style={{
            fontSize: "24px",
            lineHeight: 1,
          }}
        >
          {icono}
        </span>

        <h3
          style={{
            margin: 0,
            fontSize: "15px",
            lineHeight: "1.3",
            color: "#6b5c65",
          }}
        >
          {titulo}
        </h3>
      </div>

      <p
        style={{
          margin: 0,
          fontSize: "28px",
          lineHeight: "1.2",
          fontWeight: 700,
          color: "#352b32",
          overflowWrap: "anywhere",
        }}
      >
        {valor}
      </p>

      {detalle && (
        <p
          style={{
            margin: "8px 0 0",
            fontSize: "13px",
            lineHeight: "1.4",
            color: "#887780",
          }}
        >
          {detalle}
        </p>
      )}
    </article>
  );
}