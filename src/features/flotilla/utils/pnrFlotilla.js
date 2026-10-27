export const ESTADOS_PNR = Object.freeze([
  "EN_INVESTIGACION",
  "ESPERANDO_EVIDENCIA",
  "RESPONDIDO",
  "PENALIDAD_PROPUESTA",
  "PENALIDAD_CONFIRMADA",
  "CONVENIO_SOLICITADO",
  "CONVENIO_ACTIVO",
  "RESUELTO_SIN_COBRO",
  "LIQUIDADO",
]);

export const ESTADOS_PNR_ACTIVOS = new Set([
  "EN_INVESTIGACION",
  "ESPERANDO_EVIDENCIA",
  "RESPONDIDO",
  "PENALIDAD_PROPUESTA",
  "PENALIDAD_CONFIRMADA",
  "CONVENIO_SOLICITADO",
  "CONVENIO_ACTIVO",
]);

export function etiquetaEstadoPnr(estado) {
  return ({
    EN_INVESTIGACION: "En investigación",
    ESPERANDO_EVIDENCIA: "Esperando tu evidencia",
    RESPONDIDO: "Respuesta enviada",
    PENALIDAD_PROPUESTA: "Penalidad por confirmar",
    PENALIDAD_CONFIRMADA: "Penalidad confirmada",
    CONVENIO_SOLICITADO: "Convenio solicitado",
    CONVENIO_ACTIVO: "Convenio activo",
    RESUELTO_SIN_COBRO: "Resuelto sin cobro",
    LIQUIDADO: "Liquidado",
  })[estado] || "En investigación";
}

export function pnrEstaActivo(estado) {
  return ESTADOS_PNR_ACTIVOS.has(String(estado || ""));
}

export function validarAltaPnr({ rutaId, paqueteId, captura }) {
  const errores = [];
  if (!rutaId) errores.push("Selecciona la ruta y el driver del PNR.");
  if (!String(paqueteId || "").trim()) errores.push("Escribe el ID verde del paquete.");
  if (!captura) errores.push("Adjunta la captura del aviso recibido por WhatsApp.");
  return errores;
}

export function calcularSaldoPnr(montoOriginal, descuentos = []) {
  const original = Math.max(0, Number(montoOriginal) || 0);
  const aplicado = (Array.isArray(descuentos) ? descuentos : [])
    .filter((item) => item?.estado !== "ANULADO")
    .reduce((total, item) => total + Math.max(0, Number(item?.monto) || 0), 0);
  return Math.max(0, Math.round((original - aplicado) * 100) / 100);
}

export function validarDescuentoPnr({ saldo, monto, desde, hasta, limiteAutorizado }) {
  const cantidad = Number(monto);
  if (!desde || !hasta || desde > hasta) return "Selecciona un corte semanal válido.";
  if (!Number.isFinite(cantidad) || cantidad <= 0) return "Escribe un descuento válido.";
  if (cantidad > Number(saldo || 0)) return "El descuento no puede superar el saldo pendiente.";
  if (limiteAutorizado !== null && limiteAutorizado !== undefined && limiteAutorizado !== ""
    && Number.isFinite(Number(limiteAutorizado)) && cantidad > Number(limiteAutorizado)) {
    return "El abono no puede superar el monto semanal autorizado.";
  }
  return "";
}

export function resumirPnr(expedientes = []) {
  return (Array.isArray(expedientes) ? expedientes : []).reduce((resultado, item) => ({
    activos: resultado.activos + (pnrEstaActivo(item?.estado) ? 1 : 0),
    conPenalidad: resultado.conPenalidad + (["PENALIDAD_CONFIRMADA", "CONVENIO_SOLICITADO", "CONVENIO_ACTIVO"].includes(item?.estado) ? 1 : 0),
    saldo: resultado.saldo + Math.max(0, Number(item?.saldo) || 0),
  }), { activos: 0, conPenalidad: 0, saldo: 0 });
}
