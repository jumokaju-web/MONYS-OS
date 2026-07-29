import { empresaContexto } from "./empresaContexto";
import {
  guardarEnMemoriaEmpresarial,
  obtenerMemoriaEmpresarial,
  obtenerReporteDeMemoria,
} from "./memoriaEmpresarial";

function normalizarTipoReporte(tipoReporte = "") {
  const tipoNormalizado = String(tipoReporte)
    .trim()
    .toLowerCase();

  if (
    tipoNormalizado === "ventas por artículo" ||
    tipoNormalizado === "ventas"
  ) {
    return "ventas";
  }

  if (
    tipoNormalizado === "inventario" ||
    tipoNormalizado === "inventario / utilidad" ||
    tipoNormalizado === "inventario_utilidad"
  ) {
    return "inventario";
  }

  if (tipoNormalizado === "compras") {
    return "compras";
  }

  if (tipoNormalizado === "gastos") {
    return "gastos";
  }

  if (
    tipoNormalizado === "nómina" ||
    tipoNormalizado === "nomina"
  ) {
    return "nomina";
  }

  if (
    tipoNormalizado === "bancos" ||
    tipoNormalizado === "estado bancario" ||
    tipoNormalizado === "estados bancarios"
  ) {
    return "bancos";
  }

  return tipoNormalizado;
}

export function registrarConocimientoReporte({
  tipoReporte,
  resumen,
  nombreArchivo = null,
}) {
  const tipoNormalizado =
    normalizarTipoReporte(tipoReporte);

  if (!tipoNormalizado || !resumen) {
    return {
      guardado: false,
      motivo:
        "No se recibió un tipo de reporte o un resumen válido.",
      memoria: obtenerMemoriaEmpresarial(),
    };
  }

  const informacion = {
    tipoOriginal: tipoReporte,
    tipoNormalizado,
    nombreArchivo,
    resumen,
    empresa: empresaContexto.nombre,
  };

  const memoriaActualizada =
    guardarEnMemoriaEmpresarial(
      tipoNormalizado,
      informacion
    );

  return {
    guardado: true,
    tipoReporte: tipoNormalizado,
    memoria: memoriaActualizada,
  };
}

export function obtenerConocimientoEmpresa() {
  return {
    empresa: empresaContexto,
    memoria: obtenerMemoriaEmpresarial(),
  };
}

export function obtenerConocimientoPorReporte(
  tipoReporte
) {
  const tipoNormalizado =
    normalizarTipoReporte(tipoReporte);

  return obtenerReporteDeMemoria(
    tipoNormalizado
  );
}