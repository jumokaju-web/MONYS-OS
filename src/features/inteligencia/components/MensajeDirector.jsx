function convertirNumero(valor) {
  const numero = Number(valor);
  return Number.isFinite(numero) ? numero : 0;
}

function construirMensaje({ datosDashboard, analisisFinanciero, saludNegocio }) {
  const metricas = datosDashboard?.metricas || {};
  const ventas = convertirNumero(metricas.ventasTotales);
  const margen = convertirNumero(metricas.margenUtilidad);
  const balance = convertirNumero(analisisFinanciero?.balance);
  const capacidadCompra = convertirNumero(analisisFinanciero?.capacidadCompra);
  const salud = convertirNumero(saludNegocio?.porcentajeGeneral);

  if (ventas <= 0) {
    return "Aún no tengo suficientes datos comerciales para emitir una decisión completa. Importa el reporte de SICAR y registra los movimientos de Tesorería para generar un diagnóstico confiable.";
  }

  if (balance < 0) {
    return `La prioridad de hoy es recuperar liquidez. Aunque las ventas suman ${formatearDinero(ventas)}, el flujo disponible es negativo. Recomiendo detener compras no esenciales, revisar pagos inmediatos y concentrar los cobros pendientes.`;
  }

  if (margen > 0 && margen < 25) {
    return `Las ventas mantienen movimiento, pero el margen de ${margen.toFixed(2)}% necesita atención. Antes de aumentar compras, revisa costos, descuentos y precios para proteger la utilidad.`;
  }

  if (salud >= 80) {
    return `El negocio presenta una condición favorable con ${salud.toFixed(0)}% de salud. Puedes mantener la operación y destinar hasta ${formatearDinero(capacidadCompra)} a compras prudentes, priorizando productos de alta rotación y evitando comprometer el efectivo.`;
  }

  if (salud >= 60) {
    return `La operación se encuentra estable, pero requiere disciplina. Mantén controladas las salidas, utiliza con cautela la capacidad de compra de ${formatearDinero(capacidadCompra)} y enfoca las decisiones en productos rentables.`;
  }

  return "La salud general requiere atención. Conviene revisar primero el flujo de efectivo, el margen y los gastos antes de tomar nuevas decisiones de compra o expansión.";
}

function formatearDinero(valor) {
  return new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency: "MXN",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(convertirNumero(valor));
}

function MensajeDirector({
  datosDashboard = {},
  analisisFinanciero = {},
  saludNegocio = {},
}) {
  const mensaje = construirMensaje({
    datosDashboard,
    analisisFinanciero,
    saludNegocio,
  });

  return (
    <section
      style={{
        marginBottom: "24px",
        padding: "clamp(22px, 4vw, 32px)",
        borderRadius: "24px",
        background: "linear-gradient(135deg, #362230 0%, #6f3552 100%)",
        color: "#ffffff",
        boxShadow: "0 14px 34px rgba(73, 35, 57, 0.22)",
      }}
    >
      <p
        style={{
          margin: "0 0 8px",
          color: "#ffd6e8",
          fontSize: "14px",
          fontWeight: "800",
          letterSpacing: "1.2px",
        }}
      >
        👑 DIRECTOR GENERAL IA
      </p>

      <h2
        style={{
          margin: 0,
          fontSize: "clamp(25px, 4vw, 34px)",
        }}
      >
        Decisión ejecutiva del día
      </h2>

      <p
        style={{
          margin: "18px 0 0",
          maxWidth: "940px",
          color: "#fff8fb",
          fontSize: "17px",
          fontWeight: "600",
          lineHeight: "1.8",
        }}
      >
        {mensaje}
      </p>
    </section>
  );
}

export default MensajeDirector;