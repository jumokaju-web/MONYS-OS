function centavos(valor) {
  const numero = Number(valor);
  return Number.isFinite(numero) ? Math.round(numero * 100) : null;
}

function diaMexico(valor) {
  if (!valor) return null;
  const fecha = new Date(valor);
  if (Number.isNaN(fecha.getTime())) return null;
  const partes = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Mexico_City", year: "numeric", month: "2-digit", day: "2-digit",
  }).formatToParts(fecha);
  const parte = (tipo) => partes.find((item) => item.type === tipo)?.value;
  return `${parte("year")}-${parte("month")}-${parte("day")}`;
}

function diasEntre(a, b) {
  const fechaA = new Date(`${a}T12:00:00Z`).getTime();
  const fechaB = new Date(`${b}T12:00:00Z`).getTime();
  return Math.round(Math.abs(fechaA - fechaB) / 86400000);
}

export function proponerCrucesFacturasEstadoCuenta(facturas = [], paquete = null, toleranciaDias = 3) {
  const banco = Array.isArray(paquete?.movimientos) ? paquete.movimientos : [];
  return (Array.isArray(facturas) ? facturas : [])
    .filter((factura) => factura?.estado_pago === "PAGADA" && factura?.estado_conciliacion !== "CONCILIADA")
    .map((factura) => {
      const total = centavos(factura.total);
      const fechaPago = diaMexico(factura.pagada_en);
      const candidatos = banco.filter((movimiento) => {
        const abono = centavos(movimiento.abono);
        const fechaBanco = movimiento.fecha_operacion || movimiento.fecha_liquidacion;
        return total !== null && abono === total && fechaPago && fechaBanco && diasEntre(fechaPago, fechaBanco) <= toleranciaDias;
      });
      return { factura, candidatos, estado: candidatos.length === 1 ? "COINCIDENCIA_UNICA" : candidatos.length > 1 ? "AMBIGUA" : "SIN_COINCIDENCIA" };
    });
}
