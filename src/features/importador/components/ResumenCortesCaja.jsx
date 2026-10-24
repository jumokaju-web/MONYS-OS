const dinero = new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" });

export default function ResumenCortesCaja({ resumen }) {
  if (!resumen) return null;
  return <section style={{ marginTop: 20, padding: 20, border: "1px solid #ead5df", borderRadius: 18, background: "#fff" }}>
    <h3 style={{ marginTop: 0 }}>🧾 Control antes de importar</h3>
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(150px,1fr))", gap: 10 }}>
      <article><small>Cortes detectados</small><strong style={{ display: "block", fontSize: 22 }}>{resumen.totalCortes}</strong></article>
      <article><small>Total contado</small><strong style={{ display: "block", fontSize: 22 }}>{resumen.totalContado === null ? "Sin dato" : dinero.format(resumen.totalContado)}</strong></article>
      <article><small>Diferencia operativa</small><strong style={{ display: "block", fontSize: 22 }}>{resumen.diferenciaOperativa === null ? "Sin dato" : dinero.format(resumen.diferenciaOperativa)}</strong></article>
      <article><small>Anomalías separadas</small><strong style={{ display: "block", fontSize: 22 }}>{resumen.alertas.length}</strong></article>
    </div>
    <p style={{ marginBottom: 0, color: "#6f5b67", lineHeight: 1.5 }}><b>Regla:</b> un cheque negativo sin importe contado ni retirado se conserva como alerta de SICAR, pero no se convierte automáticamente en faltante de efectivo.</p>
    {resumen.faltantesPorSucursal.length > 0 && <p style={{ marginBottom: 0, padding: 12, borderRadius: 10, background: "#fff4dc", color: "#704f18" }}><b>PENDIENTE:</b> {resumen.faltantesPorSucursal.map((item) => item.fecha).join(", ")} no tiene corte en el archivo. No se registra como cero.</p>}
  </section>;
}
