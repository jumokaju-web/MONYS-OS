function numeroReal(valor) {
  if (valor === null || valor === undefined || valor === "") return null;
  const numero = Number(valor);
  return Number.isFinite(numero) ? numero : null;
}

function normalizarFecha(valor) {
  if (valor instanceof Date && !Number.isNaN(valor.getTime())) return valor.toISOString().slice(0, 10);
  if (typeof valor !== "string" || !/^\d{4}-\d{2}-\d{2}/.test(valor)) return null;
  const texto = valor.slice(0, 10);
  const fecha = new Date(`${texto}T12:00:00Z`);
  return !Number.isNaN(fecha.getTime()) && fecha.toISOString().slice(0, 10) === texto ? texto : null;
}

function fechaISOValida(valor) {
  return normalizarFecha(valor) === valor;
}

export function construirTareaRevisionCEO({
  prioridad,
  branchId,
  organizationId,
  businessId,
  responsable,
  fechaRevision,
  criterioExito,
} = {}) {
  if (!branchId) throw new Error("Falta seleccionar la sucursal de la revisión.");
  if (!responsable?.nombre?.trim() || !responsable?.usuarioId) throw new Error("Selecciona a una persona activa con acceso vinculado a MONYS.");
  if (!fechaISOValida(fechaRevision)) throw new Error("Selecciona una fecha de revisión válida.");
  if (!criterioExito?.trim()) throw new Error("Escribe qué resultado o evidencia confirmará que la revisión se completó.");
  if (!prioridad?.accion || !prioridad?.pregunta) throw new Error("La prioridad financiera no está completa.");

  return {
    organizationId: organizationId || null,
    businessId: businessId || null,
    branchId,
    titulo: `Revisión CEO · ${prioridad.titulo}`,
    descripcion: `${prioridad.porQue} Acción sugerida: ${prioridad.accion}`,
    area: "administracion",
    responsable: responsable.nombre.trim(),
    responsableUsuarioId: responsable.usuarioId,
    prioridad: "normal",
    fecha: fechaRevision,
    instrucciones: `${prioridad.accion} Pregunta de Dirección: ${prioridad.pregunta} Registra la fuente consultada y adjunta evidencia. Esta tarea solo organiza la revisión; no autoriza pagos, compras, descuentos ni campañas.`,
    creadaPor: "MONYS OS · Ruta CEO Financiera",
    requiereEvidencia: true,
    criterioExito: criterioExito.trim(),
  };
}

export function construirIniciativaValorCEO({ prioridad, sucursal, branchIdActual } = {}) {
  if (prioridad?.estado !== "REAL" || !sucursal || !branchIdActual || sucursal.id !== branchIdActual) return null;
  const base = numeroReal(sucursal.utilidad);
  if (!sucursal.periodo || base === null || !Number.isInteger(sucursal.diasPeriodo) || sucursal.diasPeriodo < 1) return null;

  return {
    titulo: prioridad.titulo,
    hipotesis: `Prueba propuesta: ${prioridad.accion} Hipótesis por comprobar; el cambio posterior no probará causalidad por sí solo.`,
    indicador: "utilidad_bruta",
    base: String(base),
    dias: String(sucursal.diasPeriodo),
    fuenteBase: `SICAR · ${sucursal.nombre} · ${sucursal.periodo.inicio} a ${sucursal.periodo.fin}`,
    fecha: "",
  };
}

export function construirRutaCEOFinanciera({
  metricas = {},
  movimientos = [],
  movimientosPendientes = null,
  gastosSinClasificar = null,
  sucursales = [],
  baseVigente = false,
} = {}) {
  const ventas = numeroReal(metricas.ventasTotales);
  const costo = numeroReal(metricas.costoTotal);
  const utilidad = numeroReal(metricas.utilidadTotal);
  const dias = numeroReal(metricas.diasAnalizados);
  const inicio = normalizarFecha(metricas.fechaInicial);
  const fin = normalizarFecha(metricas.fechaFinal);
  const fechasValidas = Boolean(inicio && fin && inicio <= fin);
  const diasCalendario = fechasValidas
    ? Math.round((Date.parse(`${fin}T12:00:00Z`) - Date.parse(`${inicio}T12:00:00Z`)) / 86400000) + 1
    : null;
  const diasCoinciden = dias !== null && dias > 0 && diasCalendario !== null && dias === diasCalendario;
  const periodoValido = fechasValidas && diasCoinciden;
  const resultadoCompleto = periodoValido && ventas !== null && costo !== null && utilidad !== null;
  const faltantesResultado = [];
  if (!inicio) faltantesResultado.push("fecha inicial válida del reporte SICAR");
  if (!fin) faltantesResultado.push("fecha final válida del reporte SICAR");
  if (inicio && fin && inicio > fin) faltantesResultado.push("rango de fechas en orden válido");
  if (dias === null || dias <= 0) faltantesResultado.push("duración del corte en días");
  else if (diasCalendario !== null && dias !== diasCalendario) {
    faltantesResultado.push(`duración consistente: el reporte indica ${dias} días y las fechas abarcan ${diasCalendario}`);
  }
  if (ventas === null) faltantesResultado.push("ventas SICAR");
  if (costo === null) faltantesResultado.push("costo de venta SICAR");
  if (utilidad === null) faltantesResultado.push("utilidad bruta SICAR");
  const hayMovimientos = Array.isArray(movimientos) && movimientos.length > 0;
  const pendientes = numeroReal(movimientosPendientes);
  const sinClasificar = numeroReal(gastosSinClasificar);
  const sucursalesResultado = (Array.isArray(sucursales) ? sucursales : []).map((sucursal, indice) => {
    const periodoSucursal = sucursal?.periodo || {};
    const inicioSucursal = normalizarFecha(periodoSucursal.fechaInicial ?? periodoSucursal.fechaInicio);
    const finSucursal = normalizarFecha(periodoSucursal.fechaFinal ?? periodoSucursal.fechaFin);
    const ventasSucursal = numeroReal(sucursal?.ventasTotales);
    const utilidadSucursal = numeroReal(sucursal?.utilidadTotal);
    const rangoValido = Boolean(inicioSucursal && finSucursal && inicioSucursal <= finSucursal);
    const diasPeriodo = rangoValido
      ? Math.round((Date.parse(`${finSucursal}T12:00:00Z`) - Date.parse(`${inicioSucursal}T12:00:00Z`)) / 86400000) + 1
      : null;
    return {
      id: sucursal?.branch_id || sucursal?.id || `sucursal-${indice + 1}`,
      nombre: sucursal?.nombre || sucursal?.branch_name || sucursal?.name || `Sucursal ${indice + 1}`,
      periodo: rangoValido ? { inicio: inicioSucursal, fin: finSucursal } : null,
      diasPeriodo,
      ventas: ventasSucursal,
      utilidad: utilidadSucursal,
      margen: ventasSucursal !== null && ventasSucursal > 0 && utilidadSucursal !== null
        ? (utilidadSucursal / ventasSucursal) * 100
        : null,
    };
  });
  const rangosSucursal = sucursalesResultado.map((sucursal) => sucursal.periodo && `${sucursal.periodo.inicio}:${sucursal.periodo.fin}`);
  const cortesSucursalComparables = sucursalesResultado.length > 1
    && rangosSucursal.every(Boolean)
    && new Set(rangosSucursal).size === 1;

  let prioridad;
  if (!resultadoCompleto || !baseVigente) {
    prioridad = {
      titulo: "Primero confirma la verdad del periodo",
      estado: "PENDIENTE",
      porQue: !resultadoCompleto
        ? `Falta confirmar: ${faltantesResultado.join("; ")}.`
        : "El corte tiene cifras, pero está desactualizado para una decisión nueva.",
      accion: !resultadoCompleto
        ? "Completa o corrige únicamente los datos indicados del reporte SICAR y vuelve a revisar antes de comparar resultados o proponer compras."
        : "Actualizar ventas y costo por sucursal con fechas y periodos comparables antes de aprobar una expansión, descuento o compra importante.",
      pregunta: "¿Qué cifra confirmada cambiaría mi decisión y de qué fuente proviene?",
    };
  } else if (!hayMovimientos || pendientes === null || pendientes > 0) {
    prioridad = {
      titulo: "Protege liquidez antes de comprometer efectivo",
      estado: hayMovimientos ? "PENDIENTE" : "PENDIENTE",
      porQue: !hayMovimientos
        ? "No hay movimientos financieros disponibles para revisar bancos, caja y salidas."
        : pendientes === null
          ? "Hay movimientos, pero falta confirmar cuántos siguen pendientes de clasificar."
          : `${pendientes} movimiento(s) aún requieren revisión.`,
      accion: "Conciliar bancos y caja; después contrastar pagos con vencimiento, importe y consecuencia. El saldo contable no equivale por sí solo a efectivo libre.",
      pregunta: "Después de pagos inevitables y reserva aprobada, ¿qué efectivo queda realmente disponible?",
    };
  } else if (sinClasificar === null || sinClasificar > 0) {
    prioridad = {
      titulo: "Aclara el costo de operar antes de recortar o crecer",
      estado: "PENDIENTE",
      porQue: sinClasificar === null
        ? "No se confirmó el importe de gastos sin clasificar."
        : `El importe reportado de gastos sin clasificar es ${new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN", maximumFractionDigits: 0 }).format(sinClasificar)}.`,
      accion: "Clasificar gastos y separar costos variables, fijos, necesarios y renegociables. Proteger primero lo que sostiene ventas, seguridad y cumplimiento.",
      pregunta: "¿Qué gasto desaparece sin dañar ventas, servicio, equipo o cumplimiento?",
    };
  } else {
    prioridad = {
      titulo: "Convierte el margen en una decisión de sucursal",
      estado: "REAL",
      porQue: "El periodo de SICAR está vigente y las cifras de venta, costo y utilidad están disponibles; aún deben contrastarse con caja e inventario antes de comprometer capital.",
      accion: "Compara el resultado por sucursal y por producto; elige una acción pequeña, define responsable, fecha de revisión y métrica de éxito.",
      pregunta: "¿La siguiente unidad de venta deja utilidad después del costo y puede cobrarse sin poner en riesgo la liquidez?",
    };
  }

  const margen = periodoValido && ventas !== null && ventas > 0 && utilidad !== null
    ? (utilidad / ventas) * 100
    : null;
  const metricasClave = [
    { nombre: "Ventas del periodo", valor: ventas, estado: periodoValido && ventas !== null ? "REAL" : "PENDIENTE", fuente: "SICAR · periodo indicado" },
    { nombre: "Costo de venta", valor: costo, estado: periodoValido && costo !== null ? "REAL" : "PENDIENTE", fuente: "SICAR · costo reportado" },
    { nombre: "Utilidad bruta", valor: utilidad, estado: periodoValido && utilidad !== null ? "REAL" : "PENDIENTE", fuente: "SICAR · cifra reportada" },
    { nombre: "Margen bruto", valor: margen, estado: margen === null ? "PENDIENTE" : "ESTIMACIÓN", fuente: "Cálculo: utilidad bruta ÷ ventas; no descuenta gastos operativos" },
  ];

  return {
    prioridad,
    metricasClave,
    faltantesResultado,
    periodo: periodoValido ? { inicio, fin, dias } : null,
    sucursalesResultado,
    cortesSucursalComparables,
    leccion: "Un CEO no decide por ventas aisladas: protege caja, confirma margen, asigna capital donde puede recuperarse y revisa el resultado contra una meta con fecha.",
    reglas: [
      "REAL: importado de una fuente y periodo identificables.",
      "ESTIMACIÓN: cálculo derivado; muestra su fórmula y supuestos.",
      "HIPÓTESIS: explicación posible que aún debe probarse.",
      "PENDIENTE: falta evidencia; no se sustituye por cero.",
    ],
  };
}
