const ausente = (valor) => valor === null || valor === undefined || valor === "" || !Number.isFinite(Number(valor));
const numero = (valor) => ausente(valor) ? null : Number(valor);
const fecha = (valor) => {
  if (!valor) return null;
  const dateOnly = String(valor).slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateOnly)) return null;
  const parsed = new Date(`${dateOnly}T00:00:00Z`);
  return Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== dateOnly ? null : parsed;
};
const identidad = (fila) => {
  const codigo = String(fila?.codigo || "").trim().toLocaleLowerCase();
  const nombre = String(fila?.descripcion || "").trim().toLocaleLowerCase();
  return codigo ? `c:${codigo}` : nombre ? `n:${nombre}` : null;
};
const datos = (fila) => fila?.datos_originales && typeof fila.datos_originales === "object" ? fila.datos_originales : fila || {};

function agregado(reporte) {
  const mapa = new Map();
  for (const detalle of reporte?.detalles || []) {
    const original = datos(detalle);
    const key = identidad({ codigo: original.codigo ?? detalle.codigo, descripcion: original.descripcion ?? detalle.descripcion });
    if (!key) continue;
    const current = mapa.get(key) || {
      key,
      codigo: String(original.codigo ?? detalle.codigo ?? "").trim(),
      producto: String(original.descripcion ?? detalle.descripcion ?? "Producto sin descripción").trim(),
      unidades: 0,
      venta: 0,
      costo: 0,
      utilidad: 0,
      unidadesCompletas: true,
      ventasCompletas: true,
      costosCompletos: true,
      utilidadesCompletas: true,
      costoReportadoCompleto: true,
      filas: 0,
    };
    const q = numero(original.cantidad ?? detalle.cantidad);
    const cantidadDisponible = original.cantidadDisponible === true || (q !== null && q > 0);
    const importe = numero(original.importe ?? detalle.importe);
    const importeDisponible = original.importeDisponible === true || (importe !== null && importe > 0);
    const costo = numero(original.costoTotal ?? original.costo ?? detalle.costo);
    const costoDisponible = original.costoDisponible === true;
    const utilidad = numero(original.utilidad ?? detalle.utilidad);
    const utilidadDisponible = original.utilidadDisponible === true || (utilidad !== null && utilidad !== 0);
    current.unidadesCompletas &&= cantidadDisponible;
    current.ventasCompletas &&= importeDisponible;
    current.costosCompletos &&= costoDisponible;
    current.costoReportadoCompleto &&= costoDisponible;
    current.utilidadesCompletas &&= utilidadDisponible;
    if (cantidadDisponible) current.unidades += q;
    if (importeDisponible) current.venta += importe;
    if (costoDisponible) current.costo += costo;
    if (utilidadDisponible) current.utilidad += utilidad;
    current.filas += 1;
    mapa.set(key, current);
  }
  return mapa;
}

function periodoValido(reporte) {
  const inicio = fecha(reporte?.periodo?.fechaInicio || reporte?.periodo?.fechaInicial);
  const fin = fecha(reporte?.periodo?.fechaFin || reporte?.periodo?.fechaFinal);
  if (!inicio || !fin || fin < inicio) return null;
  return { inicio, fin, dias: Math.round((fin - inicio) / 86400000) + 1 };
}

function compararReportes(paquetes) {
  const porSucursal = new Map();
  for (const paquete of paquetes || []) {
    const p = periodoValido(paquete);
    if (!p) continue;
    const lista = porSucursal.get(paquete.importacion?.branch_id) || [];
    lista.push({ ...paquete, rango: p });
    porSucursal.set(paquete.importacion?.branch_id, lista);
  }
  const pares = [];
  for (const [branchId, lista] of porSucursal) {
    lista.sort((a, b) => a.rango.fin - b.rango.fin);
    const unicas = new Map();
    for (const item of lista) {
      const key = `${item.rango.inicio.toISOString()}|${item.rango.fin.toISOString()}`;
      const existente = unicas.get(key);
      if (!existente || new Date(item.importacion?.created_at || 0) > new Date(existente.importacion?.created_at || 0)) unicas.set(key, item);
    }
    const periodosUnicos = [...unicas.values()].sort((a, b) => a.rango.fin - b.rango.fin);
    let elegido = null;
    for (let i = periodosUnicos.length - 1; i > 0; i -= 1) {
      const actual = periodosUnicos[i];
      const anterior = periodosUnicos[i - 1];
      if (actual.rango.dias === anterior.rango.dias && anterior.rango.fin < actual.rango.inicio) {
        elegido = { branchId, anterior, actual };
        break;
      }
    }
    if (elegido) pares.push(elegido);
  }
  return pares;
}

function cambioPorProducto(par, sucursal) {
  const antes = agregado(par.anterior);
  const ahora = agregado(par.actual);
  const keys = new Set([...antes.keys(), ...ahora.keys()]);
  const resultados = [];
  for (const key of keys) {
    const a = antes.get(key);
    const b = ahora.get(key);
    const base = b || a;
    const q0 = a?.unidades ?? 0;
    const q1 = b?.unidades ?? 0;
    const v0 = a?.venta ?? 0;
    const v1 = b?.venta ?? 0;
    const u0 = a?.utilidad ?? 0;
    const u1 = b?.utilidad ?? 0;
    const ventasDisponibles = (!a || a.ventasCompletas) && (!b || b.ventasCompletas);
    const unidadesDisponibles = (!a || a.unidadesCompletas) && (!b || b.unidadesCompletas);
    const utilidadDisponible = (!a || a.utilidadesCompletas) && (!b || b.utilidadesCompletas);
    const cambioVenta = ventasDisponibles ? v1 - v0 : null;
    const cambioUnidades = unidadesDisponibles ? q1 - q0 : null;
    let efectoCantidad = null;
    let efectoPrecio = null;
    if (ventasDisponibles && unidadesDisponibles && q0 > 0 && q1 > 0) {
      const precio0 = v0 / q0;
      const precio1 = v1 / q1;
      efectoCantidad = (q1 - q0) * (precio0 + precio1) / 2;
      efectoPrecio = (precio1 - precio0) * (q0 + q1) / 2;
    }
    const cambioUtilidad = utilidadDisponible ? u1 - u0 : null;
    const costoImplicitoAnterior = ventasDisponibles && utilidadDisponible ? v0 - u0 : null;
    const costoImplicitoActual = ventasDisponibles && utilidadDisponible ? v1 - u1 : null;
    const costosReportadosDisponibles = (!a || a.costosCompletos) && (!b || b.costosCompletos);
    const cambioCostoReportado = costosReportadosDisponibles && (!a || a.costoReportadoCompleto) && (!b || b.costoReportadoCompleto) ? (b?.costo ?? 0) - (a?.costo ?? 0) : null;
    const cambioCostoImplicito = cambioCostoReportado ?? (costoImplicitoAnterior === null ? null : costoImplicitoActual - costoImplicitoAnterior);
    const margenAnterior = ventasDisponibles && utilidadDisponible && v0 > 0 ? (u0 / v0) * 100 : null;
    const margenActual = ventasDisponibles && utilidadDisponible && v1 > 0 ? (u1 / v1) * 100 : null;
    const tipo = cambioVenta === null ? "datos" : cambioVenta > 0 ? "venta_sube" : cambioVenta < 0 ? "venta_baja" : "estable";
    resultados.push({
      key,
      branchId: par.branchId,
      codigo: base.codigo,
      producto: base.producto,
      sucursal,
      cambioVenta,
      cambioUnidades,
      efectoCantidad,
      efectoPrecio,
      cambioUtilidad,
      cambioCostoImplicito,
      costoReportado: cambioCostoReportado !== null,
      cambioMargenPuntos: margenAnterior === null || margenActual === null ? null : margenActual - margenAnterior,
      unidadesActuales: b?.unidadesCompletas ? b.unidades : b ? null : 0,
      ventaActual: b?.ventasCompletas ? b.venta : b ? null : 0,
      utilidadActual: b?.utilidadesCompletas ? b.utilidad : b ? null : 0,
      utilidadActualConfirmada: Boolean(b?.utilidadesCompletas),
      tipo,
      periodoAnterior: par.anterior.rango,
      periodoActual: par.actual.rango,
      evidencia: {
        reportes: [par.anterior, par.actual].map((item) => ({ id: item.importacion?.id, archivo: item.importacion?.archivo_original, inicio: item.rango.inicio.toISOString().slice(0, 10), fin: item.rango.fin.toISOString().slice(0, 10) })),
        ventasCompletas: ventasDisponibles,
        cantidadesCompletas: unidadesDisponibles,
        utilidadesCompletas: utilidadDisponible,
      },
    });
  }
  return resultados;
}

function mapearInventario(paquetes = []) {
  const mapa = new Map();
  for (const paquete of paquetes) {
    for (const fila of paquete.detalles || []) {
      const original = datos(fila);
      const key = identidad({ codigo: original.codigo ?? fila.codigo, descripcion: original.descripcion ?? fila.descripcion });
      if (!key) continue;
      const existencia = numero(original.existencia ?? fila.cantidad);
      const anterior = mapa.get(`${paquete.branch_id}|${key}`);
      if (!anterior || existencia !== null) mapa.set(`${paquete.branch_id}|${key}`, {
        branchId: paquete.branch_id,
        key,
        producto: String(original.descripcion ?? fila.descripcion ?? "Producto sin descripción").trim(),
        codigo: String(original.codigo ?? fila.codigo ?? "").trim(),
        existencia,
        minimo: numero(original.stock_minimo ?? original.minimo),
        fechaCorte: paquete.importacion?.created_at || null,
        reporte: paquete.importacion?.archivo_original || paquete.importacion?.tipo_reporte || "Inventario SICAR",
      });
    }
  }
  return mapa;
}

function crearAccion({ tipo, producto, sucursal, branchId, resumen, evidencia, accion, resultadoEsperado, estado = "REAL" }) {
  return { tipo, producto, sucursal, branchId, resumen, evidencia, accion, responsable: "Encargada de sucursal (asignación pendiente)", fechaRevision: null, resultadoEsperado, estado, requiereAutorizacion: true };
}

function fechaISOValida(valor) {
  if (typeof valor !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(valor)) return false;
  const fecha = new Date(`${valor}T12:00:00Z`);
  return !Number.isNaN(fecha.getTime()) && fecha.toISOString().slice(0, 10) === valor;
}

export function construirTareaCausaSemanal({ accion, responsable, fechaRevision, criterioExito, organizationId, businessId } = {}) {
  if (accion?.estado !== "REAL") throw new Error("Solo se puede asignar una revisión respaldada por evidencia registrada.");
  if (!accion?.branchId) throw new Error("Falta identificar la sucursal de esta revisión.");
  if (!responsable?.nombre?.trim() || !responsable?.usuarioId || responsable.branchId !== accion.branchId) {
    throw new Error("Selecciona una persona activa vinculada a MONYS en la misma sucursal.");
  }
  if (!fechaISOValida(fechaRevision)) throw new Error("Selecciona una fecha de revisión válida.");
  if (!accion.producto || !accion.accion || !accion.evidencia) throw new Error("La recomendación no contiene producto y evidencia suficientes.");
  if (!criterioExito?.trim()) throw new Error("Escribe qué resultado o evidencia confirmará que la revisión se completó.");

  const periodos = (accion.evidencia.reportes || []).map((reporte) => `${reporte.inicio} a ${reporte.fin}`).join(" vs ");
  const fuente = periodos ? `Reportes SICAR comparados: ${periodos}.` : `Corte de inventario SICAR: ${accion.evidencia.fechaCorteInventario || "fecha pendiente"}.`;
  return {
    organizationId: organizationId || responsable.organizationId || null,
    businessId: businessId || responsable.businessId || null,
    branchId: accion.branchId,
    titulo: `Revisión de producto · ${accion.producto}`,
    descripcion: `${accion.resumen} Siguiente revisión sugerida: ${accion.accion}`,
    area: "administracion",
    responsable: responsable.nombre.trim(),
    responsableUsuarioId: responsable.usuarioId,
    prioridad: "normal",
    fecha: fechaRevision,
    instrucciones: `${fuente} Registra qué comprobaste y adjunta evidencia. Esta tarea organiza una revisión; no autoriza compra, traspaso, promoción, descuento ni gasto.`,
    creadaPor: "MONYS OS · Causas del cambio semanal",
    requiereEvidencia: true,
    criterioExito: criterioExito.trim(),
  };
}

export function construirIniciativaValorDesdeCausa({ accion, branchIdActual } = {}) {
  if (accion?.estado !== "REAL" || !accion?.branchId || accion.branchId !== branchIdActual) return null;
  if (accion.evidencia?.utilidadActualConfirmada !== true) return null;
  const utilidadBase = numero(accion.evidencia?.utilidadActual);
  const reporteActual = accion.evidencia?.reportes?.at(-1);
  const inicio = fecha(reporteActual?.inicio);
  const fin = fecha(reporteActual?.fin);
  if (utilidadBase === null || utilidadBase < 0 || (!reporteActual?.id && !reporteActual?.archivo) || !inicio || !fin || fin < inicio) return null;

  const dias = Math.round((fin.getTime() - inicio.getTime()) / 86400000) + 1;
  if (!Number.isInteger(dias) || dias < 1) return null;
  const fuente = reporteActual.archivo || `importación ${reporteActual.id || "SICAR"}`;

  return {
    titulo: `Seguimiento económico · ${accion.producto} · ${accion.sucursal}`.slice(0, 150),
    hipotesis: `Revisar si la acción "${accion.accion}" coincide con una mejora de utilidad bruta en el siguiente corte comparable. Esta comparación es observacional y no prueba causalidad por sí sola.`,
    indicador: "utilidad_bruta",
    base: String(utilidadBase),
    dias: String(dias),
    fuenteBase: `SICAR · ${accion.sucursal} · ${fuente} · ${reporteActual.inicio} a ${reporteActual.fin}`.slice(0, 1000),
    fecha: "",
  };
}

export function analizarCausasCambioSemanal({ reportes = [], inventarios = [], nombresSucursal = {} } = {}) {
  const pares = compararReportes(reportes);
  const cambios = pares.flatMap((par) => cambioPorProducto(par, nombresSucursal[par.branchId] || "Sucursal"));
  const stock = mapearInventario(inventarios);
  const acciones = [];
  const pendientes = [];

  for (const cambio of cambios) {
    if (cambio.tipo === "datos") {
      pendientes.push({ producto: cambio.producto, sucursal: cambio.sucursal, faltan: [!cambio.evidencia.ventasCompletas && "importe disponible en ambos reportes", !cambio.evidencia.cantidadesCompletas && "cantidad confirmada en ambos reportes", !cambio.evidencia.utilidadesCompletas && "utilidad por producto en ambos reportes"].filter(Boolean), periodo: cambio.evidencia.reportes });
    }
    const stockActual = stock.get(`${cambio.branchId}|${cambio.key}`);
    const branchActualId = cambio.branchId;
    const existenciaAlternativa = [...stock.values()].find((item) => item.key === cambio.key && item.branchId !== branchActualId && item.existencia !== null && item.existencia > (item.minimo ?? 0));
    const resumenPartes = [];
    if (cambio.cambioVenta !== null && cambio.cambioVenta !== 0) resumenPartes.push(`La venta registrada ${cambio.cambioVenta > 0 ? "aumentó" : "bajó"} ${Math.abs(cambio.cambioVenta).toLocaleString("es-MX", { style: "currency", currency: "MXN" })} entre dos periodos comparables.`);
    if (cambio.cambioUtilidad !== null && cambio.cambioUtilidad !== 0) resumenPartes.push(`La utilidad bruta ${cambio.cambioUtilidad > 0 ? "subió" : "bajó"} ${Math.abs(cambio.cambioUtilidad).toLocaleString("es-MX", { style: "currency", currency: "MXN" })}.`);
    let resumen = resumenPartes.join(" ");
    if (cambio.cambioCostoImplicito !== null) resumen += ` ${cambio.costoReportado ? "Costo total SICAR" : "Costo implícito estimado (venta menos utilidad)"} ${cambio.cambioCostoImplicito >= 0 ? "+" : "−"}${Math.abs(cambio.cambioCostoImplicito).toLocaleString("es-MX", { style: "currency", currency: "MXN" })}${cambio.cambioMargenPuntos === null ? "" : `; margen ${cambio.cambioMargenPuntos >= 0 ? "+" : "−"}${Math.abs(cambio.cambioMargenPuntos).toFixed(1)} puntos`}.`;
    const drivers = [];
    if (cambio.efectoCantidad !== null) drivers.push(`cantidad ${cambio.efectoCantidad >= 0 ? "+" : "−"}${Math.abs(cambio.efectoCantidad).toLocaleString("es-MX", { style: "currency", currency: "MXN" })}`);
    if (cambio.efectoPrecio !== null) drivers.push(`precio promedio ${cambio.efectoPrecio >= 0 ? "+" : "−"}${Math.abs(cambio.efectoPrecio).toLocaleString("es-MX", { style: "currency", currency: "MXN" })}`);
    if (drivers.length) resumen += ` Descomposición matemática del cambio: ${drivers.join("; ")}; explica el movimiento observado, no prueba su causa.`;
    const evidencia = { reportes: cambio.evidencia.reportes, cambioVenta: cambio.cambioVenta, cambioUnidades: cambio.cambioUnidades, unidadesActuales: cambio.unidadesActuales, cambioUtilidad: cambio.cambioUtilidad, utilidadActual: cambio.utilidadActual, utilidadActualConfirmada: cambio.utilidadActualConfirmada, utilidadesCompletas: cambio.evidencia.utilidadesCompletas, cambioCostoImplicito: cambio.cambioCostoImplicito, costoReportado: cambio.costoReportado, cambioMargenPuntos: cambio.cambioMargenPuntos, inventario: stockActual?.existencia ?? null, fechaCorteInventario: stockActual?.fechaCorte ?? null };
    const mover = cambio.cambioVenta > 0 ? (existenciaAlternativa ? `Confirmar la foto de ${nombresSucursal[existenciaAlternativa.branchId] || "la otra sucursal"} (${existenciaAlternativa.existencia} piezas) y revisar un traspaso; si no alcanza, evaluar reposición con margen y caja. No emitir compra automática.` : "Revisar reposición con proveedor, margen y caja; no emitir compra automática.") : "Revisar precio, costo, exhibición y disponibilidad antes de dejar de comprar.";
    if (existenciaAlternativa) evidencia.inventarioOtraSucursal = { sucursal: nombresSucursal[existenciaAlternativa.branchId] || "Otra sucursal", existencia: existenciaAlternativa.existencia, minimo: existenciaAlternativa.minimo, fechaCorte: existenciaAlternativa.fechaCorte };
    if (cambio.cambioVenta !== null && cambio.cambioVenta !== 0) acciones.push(crearAccion({ tipo: cambio.cambioVenta > 0 ? "venta_arriba" : "venta_abajo", producto: cambio.producto, sucursal: cambio.sucursal, branchId: cambio.branchId, resumen, evidencia, accion: mover, resultadoEsperado: "Confirmar si el cambio se repite en el siguiente corte y proteger utilidad sin comprometer caja." }));
    if (cambio.cambioUtilidad !== null && cambio.cambioUtilidad !== 0) {
      const especialVentaSube = cambio.cambioVenta !== null && cambio.cambioVenta > 0 && cambio.cambioUtilidad < 0;
      const especialUtilidadResiste = cambio.cambioVenta !== null && cambio.cambioVenta < 0 && cambio.cambioUtilidad > 0;
      const tipoUtilidad = especialVentaSube ? "venta_sube_utilidad_baja" : especialUtilidadResiste ? "venta_baja_utilidad_resiste" : cambio.cambioUtilidad > 0 ? "utilidad_arriba" : "utilidad_abajo";
      const resumenUtilidad = especialVentaSube ? "La venta creció y la utilidad bruta bajó; revisar precio neto, descuentos y costo registrado. La comparación no identifica por sí sola cuál factor lo causó." : especialUtilidadResiste ? "La venta bajó mientras la utilidad bruta subió; revisar mezcla, unidades, precio y costo antes de cambiar la oferta." : resumen || "La utilidad por producto cambió entre dos reportes comparables.";
      const accionUtilidad = especialVentaSube ? "Auditar precio, descuentos, costo de reposición y captura SICAR antes de repetir promociones." : especialUtilidadResiste ? "Validar si subió el margen por unidad y probar exhibición sin descuento general." : cambio.cambioUtilidad > 0 ? "Confirmar que el aumento de utilidad se sostiene y revisar costo de reposición antes de comprar." : "Revisar costo, descuento y precio neto registrados antes de repetir la oferta.";
      acciones.push(crearAccion({ tipo: tipoUtilidad, producto: cambio.producto, sucursal: cambio.sucursal, branchId: cambio.branchId, resumen: resumenUtilidad, evidencia, accion: accionUtilidad, resultadoEsperado: "Proteger utilidad bruta confirmada sin asumir causalidad ni comprometer caja." }));
    }

    const umbralBajo = stockActual?.minimo ?? 0;
    if (cambio.cambioUnidades > 0 && stockActual?.existencia !== null && stockActual?.existencia !== undefined && stockActual.existencia <= umbralBajo) acciones.push(crearAccion({ tipo: "demanda_stock_bajo", producto: cambio.producto, sucursal: cambio.sucursal, branchId: cambio.branchId, resumen: `Las unidades subieron en los periodos comparados y la foto más reciente de inventario SICAR reporta ${stockActual.existencia} piezas${stockActual.minimo === null ? "" : ` frente a mínimo ${stockActual.minimo}`}. El corte de stock puede ser de otra fecha que las ventas.`, evidencia, accion: "Contar físicamente y revisar disponibilidad en ambas sucursales; preparar reposición o traspaso solo tras confirmar stock y margen.", resultadoEsperado: "Evitar quiebres confirmados sin comprar inventario que no rote." }));
  }

  for (const inventario of stock.values()) {
    const par = pares.find((item) => item.branchId === inventario.branchId);
    if (!par || inventario.existencia === null || inventario.existencia <= 0) continue;
    const vendido = cambios.find((cambio) => cambio.key === inventario.key && cambio.branchId === inventario.branchId);
    if (vendido && vendido.unidadesActuales === 0 && vendido.evidencia.cantidadesCompletas) acciones.push(crearAccion({ tipo: "stock_sin_movimiento", producto: inventario.producto, sucursal: vendido.sucursal, branchId: inventario.branchId, resumen: `El inventario más reciente reporta ${inventario.existencia} piezas y el reporte SICAR no muestra unidades vendidas en el último periodo comparable. Esto cubre solo ese periodo, no acredita obsolescencia.`, evidencia: { reporteInventario: inventario.reporte, fechaCorteInventario: inventario.fechaCorte, reportes: vendido.evidencia.reportes, existencia: inventario.existencia }, accion: "Validar conteo, antigüedad, estacionalidad y margen; pausar una nueva compra hasta la revisión.", resultadoEsperado: "Reducir riesgo de sobreinventario con una salida comercial aprobada por Dirección." }));
    if (!vendido && inventario.existencia > (inventario.minimo ?? 0)) acciones.push(crearAccion({ tipo: "stock_sin_movimiento", producto: inventario.producto, sucursal: nombresSucursal[inventario.branchId] || "Sucursal", branchId: inventario.branchId, resumen: `El inventario SICAR reporta ${inventario.existencia} piezas y el producto no aparece en las filas de los dos reportes de venta comparables consultados. La ausencia de una fila no acredita por sí sola obsolescencia ni confirma el conteo físico.`, evidencia: { reporteInventario: inventario.reporte, fechaCorteInventario: inventario.fechaCorte, reportes: par && [par.anterior, par.actual].map((item) => ({ id: item.importacion?.id, archivo: item.importacion?.archivo_original, inicio: item.rango.inicio.toISOString().slice(0, 10), fin: item.rango.fin.toISOString().slice(0, 10) })), existencia: inventario.existencia }, accion: "Validar código, conteo, antigüedad, estacionalidad y margen antes de pausar compras o preparar promoción.", resultadoEsperado: "Decidir una salida comercial basada en rotación y margen confirmados." }));
  }

  const sucursalesMismoPeriodo = [];
  const diferenciasSucursal = [];
  for (let i = 0; i < pares.length; i += 1) for (let j = i + 1; j < pares.length; j += 1) {
    const x = pares[i]; const y = pares[j];
    if (x.actual.rango.inicio.getTime() === y.actual.rango.inicio.getTime() && x.actual.rango.fin.getTime() === y.actual.rango.fin.getTime()) {
      const periodo = [x.actual.rango.inicio.toISOString().slice(0, 10), x.actual.rango.fin.toISOString().slice(0, 10)];
      sucursalesMismoPeriodo.push({ branchIds: [x.branchId, y.branchId], periodo });
      const cambiosX = new Map(cambios.filter((item) => item.branchId === x.branchId && item.evidencia.reportes[1].inicio === periodo[0] && item.evidencia.reportes[1].fin === periodo[1]).map((item) => [item.key, item]));
      const cambiosY = new Map(cambios.filter((item) => item.branchId === y.branchId && item.evidencia.reportes[1].inicio === periodo[0] && item.evidencia.reportes[1].fin === periodo[1]).map((item) => [item.key, item]));
      for (const [key, left] of cambiosX) {
        const right = cambiosY.get(key);
        if (!right) continue;
        diferenciasSucursal.push({ producto: left.producto, sucursales: [left.sucursal, right.sucursal], periodo, diferenciaVenta: left.ventaActual === null || right.ventaActual === null ? null : left.ventaActual - right.ventaActual, diferenciaUtilidad: left.utilidadActual === null || right.utilidadActual === null ? null : left.utilidadActual - right.utilidadActual, diferenciaUnidades: left.unidadesActuales === null || right.unidadesActuales === null ? null : left.unidadesActuales - right.unidadesActuales });
      }
    }
  }
  const noComparables = (reportes || []).filter((reporte) => !periodoValido(reporte)).map((reporte) => ({ sucursal: nombresSucursal[reporte.importacion?.branch_id] || "Sucursal", archivo: reporte.importacion?.archivo_original, falta: "fechas del periodo en el detalle o fecha por venta" }));
  if (pares.length === 0) pendientes.push({ producto: null, sucursal: null, faltan: ["dos reportes consecutivos de Ventas por artículo con fechas válidas y la misma duración"], periodo: [] });
  const prioridad = { venta_sube_utilidad_baja: 0, demanda_stock_bajo: 1, utilidad_abajo: 2, venta_abajo: 3, stock_sin_movimiento: 4, utilidad_arriba: 5, venta_baja_utilidad_resiste: 6, venta_arriba: 7 };
  acciones.sort((a, b) => (prioridad[a.tipo] ?? 9) - (prioridad[b.tipo] ?? 9) || (Math.abs(Number(b.evidencia.cambioVenta) || 0) + Math.abs(Number(b.evidencia.cambioUtilidad) || 0)) - (Math.abs(Number(a.evidencia.cambioVenta) || 0) + Math.abs(Number(a.evidencia.cambioUtilidad) || 0)));
  return { estado: pares.length ? "REAL" : "PENDIENTE", acciones, pendientes, comparaciones: cambios, sucursalesMismoPeriodo, diferenciasSucursal, reportesSinPeriodo: noComparables, notaCausalidad: "Comparación observacional. Los cambios describen asociación y descomposición aritmética; no demuestran causalidad." };
}

export function analizarHistorialCausasSemanales(historial = {}, nombresSucursal = {}) {
  return analizarCausasCambioSemanal({
    reportes: historial.ventas || [],
    inventarios: historial.inventarios || [],
    nombresSucursal,
  });
}
