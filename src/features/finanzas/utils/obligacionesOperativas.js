function numeroONulo(valor) {
  if (valor === null || valor === undefined || String(valor).trim() === "") return null;
  const numero = Number(valor);
  return Number.isFinite(numero) && numero >= 0 ? numero : null;
}

function fechaValida(valor) {
  const fecha = String(valor || "").slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha)) return false;
  const parsed = new Date(`${fecha}T00:00:00Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === fecha;
}

function sumarPagos(pagos = []) {
  if (!Array.isArray(pagos)) return null;
  let total = 0;
  for (const pago of pagos) {
    const importe = numeroONulo(pago?.importe);
    if (importe === null) return null;
    total += importe;
  }
  return Math.round(total * 100) / 100;
}

export function resumirObligacionesOperativas({ obligaciones, consultadas = false, hoy }) {
  if (!consultadas || !Array.isArray(obligaciones) || !fechaValida(hoy)) {
    return { consultadas: false, completas: false, totalPendiente: null, compromisos7Dias: null, incompletas: null, sobrepagadas: null, filas: [] };
  }

  const limite = new Date(`${hoy}T12:00:00Z`);
  limite.setUTCDate(limite.getUTCDate() + 7);
  const fechaLimite = limite.toISOString().slice(0, 10);
  const filas = [];
  let incompletas = 0;
  let sobrepagadas = 0;
  let frecuenciasNoProyectadas = 0;

  for (const obligacion of obligaciones) {
    if (obligacion?.estado === "CANCELADA") continue;
    const importe = numeroONulo(obligacion?.importe);
    const pagos = sumarPagos(obligacion?.obligaciones_operativas_pagos || obligacion?.pagos || []);
    const fecha = String(obligacion?.fecha_vencimiento || "").slice(0, 10);
    if (importe === null || importe <= 0 || pagos === null || !fechaValida(fecha)) {
      incompletas += 1;
      continue;
    }
    const pendiente = Math.round((importe - pagos) * 100) / 100;
    if (pendiente < -0.01) {
      sobrepagadas += 1;
      incompletas += 1;
      continue;
    }
    if (obligacion?.frecuencia && obligacion.frecuencia !== "UNICA") {
      frecuenciasNoProyectadas += 1;
    }
    const saldoPendiente = Math.max(0, pendiente);
    filas.push({ ...obligacion, saldoPendiente, vencida: fecha < hoy, venceEn7Dias: fecha <= fechaLimite });
  }

  const completas = incompletas === 0 && sobrepagadas === 0 && frecuenciasNoProyectadas === 0;
  const totalPendiente = completas
    ? Math.round(filas.reduce((total, fila) => total + fila.saldoPendiente, 0) * 100) / 100
    : null;
  const compromisos7Dias = completas
    ? Math.round(filas.filter((fila) => fila.venceEn7Dias).reduce((total, fila) => total + fila.saldoPendiente, 0) * 100) / 100
    : null;

  return { consultadas: true, completas, totalPendiente, compromisos7Dias, incompletas, sobrepagadas, frecuenciasNoProyectadas, filas };
}
