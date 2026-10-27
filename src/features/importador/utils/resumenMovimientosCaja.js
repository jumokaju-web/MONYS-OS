import { normalizarFechaSicar } from "./periodoSicar.js";

const METODOS = {
  EF: "Efectivo",
  TA: "Tarjeta",
  TR: "Transferencia",
  CH: "Cheque",
};

function redondear(valor) {
  return Math.round((valor + Number.EPSILON) * 100) / 100;
}

export function generarResumenMovimientosCaja(datos = []) {
  const filas = Array.isArray(datos) ? datos : [];
  const grupos = new Map();

  for (const fila of filas) {
    const tipo = String(fila?.tipoMovimiento ?? fila?.tipo ?? "").trim().toUpperCase();
    if (tipo !== "ENTRADA" && tipo !== "SALIDA") continue;

    const codigoMetodo = String(fila?.metodoPago ?? "").trim().toUpperCase();
    const metodo = METODOS[codigoMetodo] || (codigoMetodo ? `Otro (${codigoMetodo})` : "Método no indicado");
    const clave = `${tipo}|${metodo}`;
    const grupo = grupos.get(clave) || { tipo, metodo, movimientos: 0, importe: 0 };
    grupo.movimientos += 1;
    grupo.importe += Number(fila?.monto ?? fila?.total ?? 0) || 0;
    grupos.set(clave, grupo);
  }

  const salidasCheque = filas
    .filter((fila) => String(fila?.tipoMovimiento ?? fila?.tipo ?? "").trim().toUpperCase() === "SALIDA"
      && String(fila?.metodoPago ?? "").trim().toUpperCase() === "CH")
    .map((fila) => ({
      codigo: fila?.codigo ?? "",
      fecha: normalizarFechaSicar(fila?.fecha),
      monto: Number(fila?.monto ?? fila?.total ?? 0) || 0,
      caja: String(fila?.caja ?? "").trim() || "Caja no indicada",
      concepto: String(fila?.comentario ?? fila?.descripcion ?? "").trim(),
      conceptoRegistrado: Boolean(String(fila?.comentario ?? "").trim()),
    }))
    .sort((a, b) => (a.fecha || "").localeCompare(b.fecha || "") || a.monto - b.monto);

  return {
    tipoResumen: "movimientos_caja",
    totalRegistros: filas.length,
    grupos: [...grupos.values()].map((grupo) => ({ ...grupo, importe: redondear(grupo.importe) }))
      .sort((a, b) => a.tipo.localeCompare(b.tipo) || a.metodo.localeCompare(b.metodo)),
    salidasCheque,
    totalSalidasCheque: redondear(salidasCheque.reduce((total, fila) => total + fila.monto, 0)),
    chequesSinConcepto: salidasCheque.filter((fila) => !fila.conceptoRegistrado).length,
  };
}
