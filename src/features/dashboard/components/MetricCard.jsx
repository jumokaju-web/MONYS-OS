import Card from "../../../components/ui/Card";
import { theme } from "../../../design/theme";

const MetricCard = ({
  icon,
  title,
  value,
  color = theme.colors.primary,
}) => {
  return (
    <Card>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "12px",
        }}
      >
        <div
          style={{
            fontSize: "30px",
          }}
        >
          {icon}
        </div>

        <div>
          <div
            style={{
              fontSize: "14px",
              color: theme.colors.textSecondary,
            }}
          >
            {title}
          </div>

          <div
            style={{
              fontSize: "28px",
              fontWeight: "bold",
              color,
            }}
          >
            {value}
          </div>
        </div>
      </div>
    </Card>
  );
};

export default MetricCard;