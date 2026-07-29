import Card from "./Card";
import { COLORS } from "../colors";

function StatCard({
  icono = "📊",
  titulo,
  valor,
  descripcion = "",
  color = COLORS.primary,
}) {
  return (
    <Card>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "16px",
        }}
      >
        <div
          style={{
            width: "52px",
            height: "52px",
            borderRadius: "14px",
            background: `${color}18`,
            color,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: "26px",
            flexShrink: 0,
          }}
        >
          {icono}
        </div>

        <div>
          <p
            style={{
              margin: 0,
              color: COLORS.textSecondary,
              fontSize: "15px",
              fontWeight: "600",
            }}
          >
            {titulo}
          </p>

          <h3
            style={{
              margin: "6px 0 0",
              color: COLORS.text,
              fontSize: "28px",
            }}
          >
            {valor}
          </h3>

          {descripcion && (
            <p
              style={{
                margin: "6px 0 0",
                color: COLORS.textSecondary,
                fontSize: "13px",
              }}
            >
              {descripcion}
            </p>
          )}
        </div>
      </div>
    </Card>
  );
}

export default StatCard;