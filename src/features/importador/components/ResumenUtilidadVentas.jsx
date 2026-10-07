export default function ResumenUtilidadVentas({ resumen }) {
  if (!resumen) return null;

  const dinero = (valor) =>
    Number(valor || 0).toLocaleString("es-MX", {
      style: "currency",
      currency: "MXN",
      minimumFractionDigits: 2,
    });
  const numero = (valor) => Number(valor || 0).toLocaleString("es-MX");
  const fecha = (valor) => {
    if (!valor) return "Sin fecha";
    const [anio, mes, dia] = valor.split("-").map(Number);
    return new Date(Date.UTC(anio, mes - 1, dia)).toLocaleDateString("es-MX", {
      day: "numeric",
      month: "short",
      year: "numeric",
      timeZone: "UTC",
    });
  };

  return (
    <section style={{ width: "100%", maxWidth: "1000px", margin: "24px auto 0", padding: "24px", boxSizing: "border-box", borderRadius: "18px", background: "#fffafb", border: "1px solid #eadce4", boxShadow: "0 8px 24px rgba(70, 45, 60, 0.10)" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "12px", marginBottom: "20px" }}>
        <div>
          <p style={{ margin: "0 0 5px", color: "#a52968", fontWeight: 800, letterSpacing: "1px", fontSize: "13px" }}>REVISIÓN FINANCIERA SICAR</p>
          <h2 style={{ margin: 0, color: "#352b32", fontSize: "24px" }}>Resumen de ventas</h2>
          <p style={{ margin: "7px 0 0", color: "#756a70" }}>{fecha(resumen.fechaInicio)} – {fecha(resumen.fechaFin)}</p>
        </div>
        <span style={{ padding: "9px 13px", borderRadius: "999px", background: resumen.foliosDuplicados ? "#fff4d8" : "#eaf8f0", color: resumen.foliosDuplicados ? "#8a6800" : "#207a4a", fontWeight: 800 }}>
          {resumen.foliosDuplicados ? `Revisar ${numero(resumen.foliosDuplicados)} folios repetidos` : "Sin folios repetidos"}
        </span>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "12px" }}>
        {[
          ["Ventas", dinero(resumen.ventaTotal), `${numero(resumen.totalRegistros)} tickets SICAR`],
          ["Costo de venta", dinero(resumen.costoTotal), `${numero(resumen.foliosUnicos)} folios únicos`],
          ["Utilidad bruta", dinero(resumen.utilidadTotal), "Antes de gastos operativos"],
          ["Margen bruto", `${Number(resumen.margenUtilidad || 0).toLocaleString("es-MX", { maximumFractionDigits: 1 })}%`, "Utilidad bruta ÷ ventas"],
        ].map(([titulo, valor, detalle]) => (
          <article key={titulo} style={{ padding: "17px", border: "1px solid #eadce4", borderRadius: "14px", background: "#ffffff" }}>
            <p style={{ margin: "0 0 9px", color: "#756a70", fontSize: "14px", fontWeight: 700 }}>{titulo}</p>
            <strong style={{ display: "block", color: "#6f1e4b", fontSize: "22px", lineHeight: 1.25, overflowWrap: "anywhere" }}>{valor}</strong>
            <span style={{ display: "block", marginTop: "7px", color: "#887780", fontSize: "13px" }}>{detalle}</span>
          </article>
        ))}
      </div>
      <p style={{ margin: "16px 0 0", padding: "12px 14px", borderRadius: "12px", background: "#f8f1f5", color: "#6b5c65", lineHeight: 1.5, fontSize: "14px" }}>
        Esta cifra es la utilidad bruta del reporte SICAR. No descuenta renta, nómina, comisiones ni otros gastos. Revisa sucursal, periodo y folios antes de importar.
      </p>
    </section>
  );
}
