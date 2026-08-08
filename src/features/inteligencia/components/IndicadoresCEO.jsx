function convertirNumero(valor) {
  const numero = Number(valor);
  return Number.isFinite(numero) ? numero : 0;
}

function limitar(valor) {
  return Math.max(0, Math.min(100, convertirNumero(valor)));
}

function BarraIndicador({ icono, titulo, valor, detalle }) {
  const porcentaje = limitar(valor);

  return (
    <article
      style={{
        padding: "18px",
        borderRadius: "17px",
        backgroundColor: "#ffffff",
        border: "1px solid #ead7e0",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: "12px",
        }}
      >
        <strong style={{ color: "#493d43" }}>
          {icono} {titulo}
        </strong>
        <strong style={{ color: "#b44178", fontSize: "19px" }}>
          {porcentaje.toFixed(0)}%
        </strong>
      </div>

      <div
        style={{
          height: "11px",
          marginTop: "13px",
          overflow: "hidden",
          borderRadius: "999px",
          backgroundColor: "#f1e7ec",
        }}
      >
        <div
          style={{
            width: `${porcentaje}%`,
            height: "100%",
            borderRadius: "999px",
            background: "linear-gradient(90deg, #c94f88 0%, #7a3658 100%)",
            transition: "width 0.35s ease",
          }}
        />
      </div>

      <p
        style={{
          margin: "9px 0 0",
          color: "#81747a",
          fontSize: "13px",
          lineHeight: "1.5",
        }}
      >
        {detalle}
      </p>
    </article>
  );
}

function IndicadoresCEO({
  datosDashboard = {},
  analisisFinanciero = {},
  saludNegocio = {},
}) {
  const metricas = datosDashboard?.metricas || {};
  const margen = convertirNumero(metricas.margenUtilidad);
  const saludVentas = convertirNumero(saludNegocio.saludVentas);
  const saludLiquidez = convertirNumero(saludNegocio.saludLiquidez);
  const porcentajeSalidas = convertirNumero(
    analisisFinanciero.porcentajeSalidas
  );
  const riesgoControlado = limitar(100 - porcentajeSalidas);

  return (
    <section
      style={{
        marginBottom: "24px",
        padding: "clamp(22px, 4vw, 30px)",
        borderRadius: "24px",
        backgroundColor: "#fff9fc",
        border: "1px solid #ecd4df",
        boxShadow: "0 10px 28px rgba(111, 53, 82, 0.07)",
      }}
    >
      <p
        style={{
          margin: "0 0 6px",
          color: "#b44178",
          fontSize: "14px",
          fontWeight: "800",
          letterSpacing: "1.2px",
        }}
      >
        TABLERO DE CONTROL
      </p>

      <h2
        style={{
          margin: "0 0 20px",
          color: "#2f252a",
          fontSize: "clamp(24px, 4vw, 32px)",
        }}
      >
        📊 Indicadores CEO
      </h2>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
          gap: "15px",
        }}
      >
        <BarraIndicador
          icono="🛒"
          titulo="Ventas"
          valor={saludVentas}
          detalle="Fortaleza comercial según ventas, costos y utilidad."
        />

        <BarraIndicador
          icono="💵"
          titulo="Liquidez"
          valor={saludLiquidez}
          detalle="Capacidad actual para sostener la operación."
        />

        <BarraIndicador
          icono="📈"
          titulo="Margen"
          valor={limitar((margen / 40) * 100)}
          detalle={`Margen real registrado: ${margen.toFixed(2)}%.`}
        />

        <BarraIndicador
          icono="🛡️"
          titulo="Control de riesgo"
          valor={riesgoControlado}
          detalle="Mayor porcentaje significa menor presión de salidas."
        />
      </div>
    </section>
  );
}

export default IndicadoresCEO;