function ResumenDirectorGeneral({
  resumen = "Estoy preparando el análisis ejecutivo del negocio.",
  estado = "Inicializando Centro de Inteligencia",
  nivel = "🟡",
}) {
  return (
    <section
      className="resumen-director-general"
      style={{
        width: "min(100%, 1050px)",
        margin: "24px auto",
        padding: "28px",
        borderRadius: "22px",
        background:
          "linear-gradient(135deg, #ffffff 0%, #fff4fa 100%)",
        border: "1px solid #f4cfe1",
        boxShadow: "0 12px 35px rgba(112, 53, 84, 0.12)",
        textAlign: "left",
      }}
    >
      <div
        className="resumen-director-general__encabezado"
        style={{
          display: "flex",
          alignItems: "center",
          gap: "16px",
          paddingBottom: "18px",
          marginBottom: "22px",
          borderBottom: "1px solid #f1d9e5",
        }}
      >
        <span
          className="resumen-director-general__icono"
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            width: "58px",
            height: "58px",
            borderRadius: "18px",
            backgroundColor: "#ffe1ef",
            fontSize: "30px",
          }}
        >
          👨‍💼
        </span>

        <div>
          <p
            className="resumen-director-general__etiqueta"
            style={{
              margin: "0 0 4px",
              color: "#9a476f",
              fontWeight: "700",
            }}
          >
            Director General IA
          </p>

          <h2
            style={{
              margin: 0,
              fontSize: "28px",
            }}
          >
            Resumen Ejecutivo
          </h2>
        </div>
      </div>

      <div
        className="resumen-director-general__mensaje"
        style={{
          padding: "22px",
          borderRadius: "16px",
          backgroundColor: "#ffffff",
          border: "1px solid #f3e4eb",
          fontSize: "18px",
          lineHeight: "1.7",
          whiteSpace: "pre-line",
        }}
      >
        {resumen}
      </div>

      <div
        className="resumen-director-general__estado"
        style={{
          display: "flex",
          alignItems: "flex-start",
          gap: "12px",
          marginTop: "20px",
          padding: "18px",
          borderRadius: "16px",
          backgroundColor: "#faf7f9",
        }}
      >
        <span
          style={{
            fontSize: "22px",
          }}
        >
          {nivel}
        </span>

        <div>
          <strong
            style={{
              display: "block",
              marginBottom: "6px",
              fontSize: "17px",
            }}
          >
            {estado}
          </strong>

          <p
            style={{
              margin: 0,
              color: "#665b61",
              lineHeight: "1.5",
            }}
          >
            Este resumen se genera automáticamente con la
            información coordinada por el Consejo Directivo IA.
          </p>
        </div>
      </div>
    </section>
  );
}

export default ResumenDirectorGeneral;