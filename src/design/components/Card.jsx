import { COLORS } from "../colors";

function Card({ children }) {
  return (
    <div
      style={{
        background: COLORS.surface,
        borderRadius: "18px",
        padding: "24px",
        boxShadow: `0 8px 24px ${COLORS.shadow}`,
        border: `1px solid ${COLORS.border}`,
        marginBottom: "20px",
      }}
    >
      {children}
    </div>
  );
}

export default Card;