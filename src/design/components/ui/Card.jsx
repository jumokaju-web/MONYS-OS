import { theme } from "../../design/theme";

const Card = ({ children, style = {} }) => {
  return (
    <div
      style={{
        background: theme.colors.surface,
        borderRadius: theme.borderRadius.medium,
        boxShadow: theme.shadow.card,
        border: `1px solid ${theme.colors.border}`,
        padding: "20px",
        ...style,
      }}
    >
      {children}
    </div>
  );
};

export default Card;