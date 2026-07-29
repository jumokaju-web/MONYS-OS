import { COLORS } from "../colors";

function PrimaryButton({
  children,
  onClick,
  type = "button",
}) {
  return (
    <button
      type={type}
      onClick={onClick}
      style={{
        background: COLORS.primary,
        color: "#fff",
        border: "none",
        borderRadius: "12px",
        padding: "14px 24px",
        fontSize: "16px",
        fontWeight: "600",
        cursor: "pointer",
        transition: "0.2s",
      }}
      onMouseEnter={(evento) => {
        evento.currentTarget.style.background = COLORS.primaryDark;
      }}
      onMouseLeave={(evento) => {
        evento.currentTarget.style.background = COLORS.primary;
      }}
    >
      {children}
    </button>
  );
}

export default PrimaryButton;