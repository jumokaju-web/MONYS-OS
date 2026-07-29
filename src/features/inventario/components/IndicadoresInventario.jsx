import StatCard from "../../../design/components/StatCard";
import { COLORS } from "../../../design/colors";

function IndicadoresInventario({
  totalProductos,
  stockBajo,
  valorInventario,
  comprasUrgentes,
}) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(240px,1fr))",
        gap: "20px",
        margin: "30px 0",
      }}
    >
      <StatCard
        icono="📦"
        titulo="Productos"
        valor={totalProductos}
        descripcion="Productos registrados"
        color={COLORS.primary}
      />

      <StatCard
        icono="🔴"
        titulo="Stock Bajo"
        valor={stockBajo}
        descripcion="Productos por surtir"
        color={COLORS.danger}
      />

      <StatCard
        icono="💰"
        titulo="Valor Inventario"
        valor={`$${valorInventario}`}
        descripcion="Costo del inventario"
        color={COLORS.success}
      />

      <StatCard
        icono="🛒"
        titulo="Compras Urgentes"
        valor={comprasUrgentes}
        descripcion="Pendientes"
        color={COLORS.warning}
      />
    </div>
  );
}

export default IndicadoresInventario;