import { normalizarFechaSicar } from "./periodoSicar.js";

const PALABRAS_GENERALES = new Set(["A", "AL", "DE", "DEL", "EL", "LA", "LAS", "LO", "LOS", "Y", "PAGO", "PAGOS", "ABONO", "ABONOS", "SALIDA", "CHEQUE", "PROVEEDOR", "COMPRA", "TRANSFERENCIA", "SICAR", "CAJA", "POR", "PARA", "CON", "SA", "CV", "THE", "AND"]);

function centavos(valor) {
  const numero = Number(valor);
  return Number.isFinite(numero) ? Math.round((numero + Number.EPSILON) * 100) : null;
}

function fechaTesoreria(movimiento) {
  return String(movimiento?.occurred_at ?? movimiento?.fecha ?? "").slice(0, 10);
}

function noCancelado(estado) {
  return !String(estado ?? "").toLocaleLowerCase("es-MX").includes("cancel");
}

function palabrasClave(valor) {
  return String(valor ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, " ")
    .trim()
    .split(/\s+/)
    .filter((palabra) => palabra.length >= 2 && !PALABRAS_GENERALES.has(palabra));
}

function compararConceptos(conceptoSicar, conceptoTesoreria) {
  const palabrasTesoreria = new Set(palabrasClave(conceptoTesoreria));
  return palabrasClave(conceptoSicar).filter((palabra) => palabrasTesoreria.has(palabra));
}

export function cruzarChequesSicarConTesoreria(chequesSicar = [], movimientosTesoreria = [], branchId = "") {
  const cheques = (Array.isArray(chequesSicar) ? chequesSicar : []).filter((fila) =>
    String(fila?.tipoMovimiento ?? fila?.tipo ?? "").toUpperCase() === "SALIDA"
    && String(fila?.metodoPago ?? "").trim().toUpperCase() === "CH",
  );
  const movimientos = (Array.isArray(movimientosTesoreria) ? movimientosTesoreria : []).filter((movimiento) =>
    noCancelado(movimiento?.status ?? movimiento?.estado),
  );

  const coincidencias = cheques.map((cheque) => {
    const fecha = normalizarFechaSicar(cheque?.fecha);
    const importe = centavos(cheque?.monto ?? cheque?.total);
    const conceptoSicar = String(cheque?.comentario || cheque?.descripcion || "").trim();
    const candidatos = fecha && importe !== null ? movimientos.filter((movimiento) => {
      const tipo = String(movimiento?.movement_type ?? movimiento?.tipo ?? "").toUpperCase();
      const sucursalCompatible = !branchId || !movimiento?.branch_id || movimiento.branch_id === branchId;
      return tipo === "SALIDA"
        && sucursalCompatible
        && fechaTesoreria(movimiento) === fecha
        && centavos(movimiento?.amount ?? movimiento?.monto) === importe;
    }).map((movimiento) => {
      const conceptoTesoreria = movimiento.concept ?? movimiento.concepto ?? "Sin concepto";
      const palabrasCoincidentes = compararConceptos(conceptoSicar, conceptoTesoreria);
      const sucursalExacta = Boolean(branchId && movimiento.branch_id === branchId);
      return {
        id: movimiento.id,
        concepto: conceptoTesoreria,
        monto: Number(movimiento.amount ?? movimiento.monto),
        fecha: fechaTesoreria(movimiento),
        estado: movimiento.status ?? movimiento.estado ?? "Estado no indicado",
        categoria: movimiento.expense_category ?? movimiento.categoria ?? "Sin clasificar",
        branchId: movimiento.branch_id ?? null,
        alcance: sucursalExacta ? "Sucursal coincidente" : "Registro de negocio sin sucursal especificada",
        recibo: movimiento.receipt_status ?? "Comprobante no indicado",
        palabrasCoincidentes,
      };
    }).sort((a, b) => b.palabrasCoincidentes.length - a.palabrasCoincidentes.length
      || Number(b.branchId === branchId) - Number(a.branchId === branchId)) : [];

    return {
      codigoSicar: cheque?.codigo ?? "",
      fecha,
      monto: importe === null ? null : importe / 100,
      cajaSicar: String(cheque?.caja ?? "").trim() || "Caja no indicada",
      conceptoSicar,
      candidatos,
    };
  });

  const usos = new Map();
  for (const fila of coincidencias) {
    for (const candidato of fila.candidatos) usos.set(candidato.id, (usos.get(candidato.id) || 0) + 1);
  }

  for (const fila of coincidencias) {
    const seReutiliza = fila.candidatos.some((candidato) => usos.get(candidato.id) > 1);
    fila.estadoCruce = fila.candidatos.length === 0
      ? "SIN_COINCIDENCIA"
      : fila.candidatos.length === 1 && !seReutiliza
        ? "CANDIDATA_UNICA"
        : "AMBIGUA";
  }

  return {
    filas: coincidencias,
    candidatasUnicas: coincidencias.filter((fila) => fila.estadoCruce === "CANDIDATA_UNICA").length,
    ambiguas: coincidencias.filter((fila) => fila.estadoCruce === "AMBIGUA").length,
    sinCoincidencia: coincidencias.filter((fila) => fila.estadoCruce === "SIN_COINCIDENCIA").length,
    aclaracion: "La comparación usa fecha, importe y sucursal disponible. No confirma que dos registros sean el mismo pago; revisa concepto, comprobante y forma de pago antes de vincularlos.",
  };
}
