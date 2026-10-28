import { resumirCortesOficialesParaDisponibilidad } from "./disponibilidadCortesOficiales.js";

function fechaISO(valor) {
  const texto = String(valor || "").slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(texto)) return null;
  const fecha = new Date(`${texto}T00:00:00.000Z`);
  return Number.isNaN(fecha.getTime()) || fecha.toISOString().slice(0, 10) !== texto
    ? null
    : fecha;
}

function sumarDias(fecha, dias) {
  const resultado = new Date(fecha);
  resultado.setUTCDate(resultado.getUTCDate() + dias);
  return resultado.toISOString().slice(0, 10);
}

export function obtenerSemanaCompletaAnterior(referencia) {
  const fecha = fechaISO(referencia);
  if (!fecha) return null;
  const diasDesdeLunes = (fecha.getUTCDay() + 6) % 7;
  const lunesSemanaActual = sumarDias(fecha, -diasDesdeLunes);
  const domingoAnterior = sumarDias(fechaISO(lunesSemanaActual), -1);
  return {
    inicio: sumarDias(fechaISO(domingoAnterior), -6),
    fin: domingoAnterior,
  };
}

export function resumirRemanenteSemanaAnterior({
  importaciones = [],
  cierre = {},
  referencia,
} = {}) {
  const semana = obtenerSemanaCompletaAnterior(referencia);
  if (!semana) {
    return {
      semana: null,
      completo: false,
      efectivoReportado: null,
      cajas: [],
      motivo: "No hay una fecha válida para buscar la semana anterior.",
    };
  }

  const resumen = resumirCortesOficialesParaDisponibilidad({
    importaciones,
    cierre,
    hoy: semana.fin,
  });
  const completo = resumen.completo && resumen.diferencias === 0;
  return {
    semana,
    completo,
    efectivoReportado: completo ? resumen.efectivoEnCaja : null,
    cajas: resumen.detalle,
    cajasEsperadas: resumen.cajasEsperadas,
    cajasEncontradas: resumen.cajasEncontradas,
    cajasFaltantes: resumen.cajasFaltantes,
    cajasIncompletas: resumen.cajasIncompletas,
    diferencias: resumen.diferencias,
    motivo: completo
      ? "Cortes SICAR completos al domingo y sin diferencias reportadas."
      : `Cierre pendiente: ${resumen.cajasFaltantes} cajas sin corte, ${resumen.cajasIncompletas} incompletas y ${resumen.diferencias} diferencias.`,
  };
}
