const GENERICAS = new Set(["de", "del", "la", "las", "los", "sa", "cv", "sadecv", "proveedor", "pago", "transferencia"]);

function texto(valor) {
  return String(valor ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, " ")
    .trim()
    .toLowerCase();
}

function palabrasDistintivas(valor) {
  return texto(valor).split(" ").filter((palabra) => palabra.length >= 4 && !GENERICAS.has(palabra));
}

export function buscarProveedoresParaPago({ banco = {}, movimiento = {}, proveedores = [] } = {}) {
  const contexto = texto([
    banco.descripcion,
    banco.referencia_visible,
    movimiento.concepto ?? movimiento.concept,
    movimiento.descripcion,
  ].filter(Boolean).join(" "));
  if (!contexto) return [];

  return (Array.isArray(proveedores) ? proveedores : []).flatMap((proveedor) => {
    const nombre = proveedor?.nombre || "";
    const nombreNormalizado = texto(nombre);
    const palabras = palabrasDistintivas(nombre);
    const coincidencias = palabras.filter((palabra) => contexto.split(" ").includes(palabra));
    const coincide = nombreNormalizado.length >= 5 && contexto.includes(nombreNormalizado)
      || (palabras.length === 1 && coincidencias.length === 1)
      || coincidencias.length >= 2;
    if (!coincide) return [];
    return [{
      id: proveedor.id || null,
      numeroProveedor: proveedor.numero_proveedor || proveedor.numeroProveedor || null,
      nombre,
      saldoReportado: proveedor.saldo === null || proveedor.saldo === undefined || proveedor.saldo === ""
        ? null
        : Number(proveedor.saldo),
      evidencia: "Coincidencia de nombre en banco o movimiento registrado",
    }];
  });
}

export function resumirPagosProveedores({ banco = [], movimientos = [], proveedores = [], conciliaciones = [] } = {}) {
  const movimientosPorId = new Map((movimientos || []).map((movimiento) => [movimiento.id, movimiento]));
  const bancosPorId = new Map((banco || []).map((movimiento) => [movimiento.id, movimiento]));
  const activas = (conciliaciones || []).filter((item) => item?.estado === "ACTIVA");
  const filas = activas.flatMap((conciliacion) => {
    const movimientoBanco = bancosPorId.get(conciliacion.banco_movimiento_id) || conciliacion.snapshot?.banco;
    const movimientoCaja = movimientosPorId.get(conciliacion.cash_movement_id) || conciliacion.snapshot?.movimiento;
    if (!movimientoBanco || !movimientoCaja || Number(movimientoBanco.cargo) <= 0) return [];
    const candidatosGuardados = conciliacion.snapshot?.proveedores_sugeridos;
    const candidatos = Array.isArray(candidatosGuardados)
      ? candidatosGuardados
      : buscarProveedoresParaPago({ banco: movimientoBanco, movimiento: movimientoCaja, proveedores });
    const categoria = texto(movimientoCaja.categoria ?? movimientoCaja.expense_category);
    if (!candidatos.length && categoria !== "proveedor") return [];
    return [{ conciliacion, banco: movimientoBanco, movimiento: movimientoCaja, candidatos }];
  });
  return {
    filas,
    identificados: filas.filter((fila) => fila.candidatos.length === 1).length,
    ambiguos: filas.filter((fila) => fila.candidatos.length > 1).length,
    sinProveedor: filas.filter((fila) => fila.candidatos.length === 0).length,
  };
}
