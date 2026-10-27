import {
  TURNOS_CORTE,
  validarDestinoEfectivoRetirado,
  validarImportesCorte,
} from "../../inteligencia/utils/corteTienda.js";

export const MOTIVOS_CORTE_RECIBIDO = [
  ["SIN_ACCESO", "La empleada todavía no tenía acceso"],
  ["OLVIDO_ENVIO", "La empleada olvidó enviarlo"],
  ["FALLA_TECNICA", "La aplicación o el teléfono falló"],
  ["OTRO", "Otro motivo documentado"],
];

const CAMPOS_IDENTIDAD = [
  ["branchId", "Selecciona la sucursal."],
  ["empleadoId", "Selecciona quién hizo el corte."],
  ["fecha", "Selecciona la fecha real del corte."],
  ["cajaId", "Selecciona la caja del corte."],
  ["turnoCaja", "Selecciona el turno real del corte."],
  ["motivo", "Indica por qué Dirección está registrando este corte."],
];

function fechaCivilValida(valor) {
  return /^\d{4}-\d{2}-\d{2}$/.test(String(valor || ""));
}
export function validarCorteRecibidoDireccion({
  formulario = {},
  foto = null,
  fechaActual,
} = {}) {
  for (const [campo, mensaje] of CAMPOS_IDENTIDAD) {
    if (!String(formulario?.[campo] || "").trim()) return mensaje;
  }

  if (!fechaCivilValida(formulario.fecha)) {
    return "La fecha del corte no es válida.";
  }

  if (fechaActual && formulario.fecha > fechaActual) {
    return "No se puede registrar un corte con fecha futura.";
  }

  if (!TURNOS_CORTE.some(([valor]) => valor === formulario.turnoCaja)) {
    return "Selecciona un turno válido para el corte.";
  }

  if (!String(formulario.detalleMotivo || "").trim()) {
    return "Explica brevemente por qué el corte no se envió desde la cuenta de la empleada.";
  }

  if (!foto) {
    return "Adjunta la foto original del corte de SICAR.";
  }

  if (
    String(formulario.gastosCaja ?? "").trim() === "" ||
    !Number.isFinite(Number(formulario.gastosCaja)) ||
    Number(formulario.gastosCaja) < 0
  ) {
    return "Confirma cuánto salió de caja para otros gastos. Escribe 0 solo si verificaste que no hubo salidas.";
  }

  if (
    Number(formulario.gastosCaja) > 0 &&
    !String(formulario.detalleGastosCaja || "").trim()
  ) {
    return "Explica en qué se usaron las otras salidas de caja.";
  }

  return (
    validarImportesCorte(formulario) ||
    validarDestinoEfectivoRetirado(formulario)
  );
}

export function construirCorteRecibidoDireccion({
  formulario,
  empleado,
  capturadoPor,
  evidencia,
  capturadoEn = new Date().toISOString(),
} = {}) {
  return {
    ventaSicar: formulario.ventaSicar,
    efectivoVentas: formulario.efectivoVentas,
    tarjeta: formulario.tarjeta,
    transferencias: formulario.transferencias,
    otrosCobros: formulario.otrosCobros,
    fondoInicial: formulario.fondoInicial,
    gastosCaja: formulario.gastosCaja,
    detalleGastosCaja: formulario.detalleGastosCaja || null,
    efectivoEntregado: formulario.efectivoEntregado,
    efectivoFinal: formulario.efectivoFinal,
    movimientosCaja: [],
    destinoEfectivoRetirado: formulario.destinoEfectivoRetirado || null,
    responsableEfectivoRetirado:
      formulario.responsableEfectivoRetirado || null,
    detalleEfectivoRetirado: formulario.detalleEfectivoRetirado || null,
    cajaId: formulario.cajaId,
    cajaNombre: formulario.cajaId === "CAJA_2" ? "Caja 2" : "Caja 1",
    turnoCaja: formulario.turnoCaja,
    turnoCajaNombre:
      TURNOS_CORTE.find(([valor]) => valor === formulario.turnoCaja)?.[1] || null,
    sesionCajaId: null,
    responsableApertura: null,
    responsableCaja: empleado.nombre,
    responsableCierre: empleado.nombre,
    sinAperturaPrevia: true,
    inicioRegistroCierre: null,
    fotoCorteUrl: evidencia.archivoUrl || null,
    fotoCortePath: evidencia.archivoPath || null,
    fondoSiguiente: 1000,
    cerradoEn: capturadoEn,
    registroFueraDeFlujo: true,
    fuenteCaptura: "WHATSAPP",
    empleadoId: empleado.id,
    capturadoPorDireccion: String(capturadoPor || "").trim(),
    motivoRegistroTardio: formulario.motivo,
    detalleMotivoRegistroTardio: formulario.detalleMotivo.trim(),
    fechaOriginal: formulario.fecha,
  };
}
