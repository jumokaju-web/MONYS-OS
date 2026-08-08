import DecisionPrioritaria from "./DecisionPrioritaria";
import {
  generarDecisionesIA,
} from "../motor/motorDecisionesIA";

function PanelDecisionesPrioritarias({
  datosDashboard,
  movimientos = [],
}) {
  const decisiones = generarDecisionesIA({
    datosDashboard,
    movimientos,
  });

  return (
    <section
      style={{
        marginTop: "30px",
        marginBottom: "35px",
        padding: "24px",
        borderRadius: "20px",
        backgroundColor: "#fffdf7",
        border: "1px solid #f2d98a",
      }}
    >
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "12px",
          marginBottom: "20px",
        }}
      >
        <div>
          <p
            style={{
              margin: "0 0 5px",
              color: "#9a7200",
              fontSize: "12px",
              fontWeight: "900",
              letterSpacing: "1px",
            }}
          >
            MOTOR DE DECISIONES IA 2.0
          </p>

          <h2
            style={{
              margin: 0,
              color: "#33272e",
              fontSize: "28px",
            }}
          >
            📋 Decisiones Prioritarias de Hoy
          </h2>
        </div>

        <span
          style={{
            padding: "8px 13px",
            borderRadius: "999px",
            backgroundColor: "#fff4c7",
            color: "#806000",
            fontSize: "14px",
            fontWeight: "800",
          }}
        >
          {decisiones.length}{" "}
          {decisiones.length === 1
            ? "decisión detectada"
            : "decisiones detectadas"}
        </span>
      </div>

      {decisiones.length > 0 ? (
        <div
          style={{
            display: "grid",
            gap: "15px",
          }}
        >
          {decisiones.map((decision) => (
            <DecisionPrioritaria
              key={decision.id}
              decision={decision}
            />
          ))}
        </div>
      ) : (
        <div
          style={{
            padding: "20px",
            borderRadius: "16px",
            backgroundColor: "#eaf8f0",
            border: "1px solid #a8dfbd",
          }}
        >
          <strong
            style={{
              display: "block",
              marginBottom: "7px",
              color: "#208653",
              fontSize: "17px",
            }}
          >
            🟢 Operación sin decisiones pendientes
          </strong>

          <span
            style={{
              color: "#4d5f54",
              lineHeight: "1.6",
            }}
          >
            MONYS OS no detectó situaciones que requieran
            atención con la información disponible.
          </span>
        </div>
      )}
    </section>
  );
}

export default PanelDecisionesPrioritarias;