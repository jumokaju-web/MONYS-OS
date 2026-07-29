function TarjetaDirector({
  icono,
  nombre,
  cargo,
  estado = "Disponible",
  resumen,
  color = "#c2185b",
  children,
}) {
  return (
    <article
      style={{
        padding: "22px",
        borderRadius: "20px",
        background: "#ffffff",
        border: "1px solid #efd7e2",
        boxShadow: "0 10px 24px rgba(121, 72, 95, 0.08)",
        display: "grid",
        gap: "14px",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "space-between",
          gap: "16px",
          flexWrap: "wrap",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "12px",
          }}
        >
          <div
            style={{
              width: "48px",
              height: "48px",
              borderRadius: "16px",
              background: "#fff1f7",
              display: "grid",
              placeItems: "center",
              fontSize: "25px",
            }}
          >
            {icono}
          </div>

          <div>
            <p
              style={{
                margin: 0,
                color: "#9a5f7c",
                fontSize: "12px",
                fontWeight: "800",
                letterSpacing: "1px",
              }}
            >
              {cargo}
            </p>

            <h3
              style={{
                margin: "4px 0 0",
                color: "#2f2430",
                fontSize: "21px",
              }}
            >
              {nombre}
            </h3>
          </div>
        </div>

        <span
          style={{
            padding: "7px 12px",
            borderRadius: "999px",
            background: "#f8edf3",
            color,
            fontSize: "13px",
            fontWeight: "800",
          }}
        >
          {estado}
        </span>
      </div>

      {resumen && (
        <p
          style={{
            margin: 0,
            color: "#6f5965",
            fontSize: "15px",
            lineHeight: "1.6",
          }}
        >
          {resumen}
        </p>
      )}

      {children}
    </article>
  );
}

export default TarjetaDirector;