function obtenerEstiloNivel(nivel) {
  if (nivel === "critico") {
    return {
      icono: "🔴",
      etiqueta: "CRÍTICA",
      color: "#b02a37",
      fondo: "#fdebed",
      borde: "#e5a5ac",
    };
  }

  if (nivel === "alto") {
    return {
      icono: "🟠",
      etiqueta: "IMPORTANTE",
      color: "#bd6500",
      fondo: "#fff0df",
      borde: "#edc18e",
    };
  }

  if (nivel === "medio") {
    return {
      icono: "🟡",
      etiqueta: "ATENCIÓN",
      color: "#9a7200",
      fondo: "#fff8dc",
      borde: "#ead585",
    };
  }

  return {
    icono: "🟢",
    etiqueta: "ESTABLE",
    color: "#208653",
    fondo: "#eaf8f0",
    borde: "#a8dfbd",
  };
}

function DecisionPrioritaria({
  decision,
}) {
  const estilo = obtenerEstiloNivel(
    decision?.nivel
  );

  return (
    <article
      style={{
        padding: "20px",
        borderRadius: "18px",
        backgroundColor: estilo.fondo,
        border: `1px solid ${estilo.borde}`,
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "14px",
          marginBottom: "12px",
        }}
      >
        <span
          style={{
            color: estilo.color,
            fontSize: "13px",
            fontWeight: "900",
            letterSpacing: "1px",
          }}
        >
          {estilo.icono} {estilo.etiqueta}
        </span>

        <span
          style={{
            color: "#765f6b",
            fontSize: "13px",
            fontWeight: "700",
          }}
        >
          {decision?.origen || "MONYS OS"}
        </span>
      </div>

      <h3
        style={{
          margin: "0 0 10px",
          color: "#33272e",
          fontSize: "21px",
        }}
      >
        {decision?.titulo || "Decisión del día"}
      </h3>

      <p
        style={{
          margin: "0 0 14px",
          color: "#5f5058",
          fontSize: "16px",
          lineHeight: "1.6",
        }}
      >
        {decision?.mensaje ||
          "La inteligencia del negocio está analizando esta situación."}
      </p>

      <div
        style={{
          padding: "13px 15px",
          borderRadius: "12px",
          backgroundColor: "rgba(255, 255, 255, 0.75)",
        }}
      >
        <strong
          style={{
            display: "block",
            marginBottom: "5px",
            color: estilo.color,
            fontSize: "13px",
          }}
        >
          ACCIÓN RECOMENDADA
        </strong>

        <span
          style={{
            color: "#4d4047",
            fontSize: "15px",
            lineHeight: "1.5",
          }}
        >
          {decision?.recomendacion ||
            "Revisar la información disponible antes de tomar una decisión."}
        </span>
      </div>
    </article>
  );
}

export default DecisionPrioritaria;