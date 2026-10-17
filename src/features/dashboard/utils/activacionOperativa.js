const ESTADOS_TAREA_ABIERTA = new Set(["pendiente", "en_proceso", "analizando"]);
const ESTADOS_RUTA_ACTIVA = new Set(["CARGADA", "EN_RUTA"]);
const ESTADOS_INCIDENCIA_CERRADA = new Set(["RESUELTA", "RECHAZADA"]);
const ESTADOS_PNR_CERRADO = new Set(["RESUELTO_SIN_COBRO", "LIQUIDADO", "CANCELADO"]);

function filasFuente(fuente) {
  return fuente?.disponible === true && Array.isArray(fuente.filas)
    ? fuente.filas
    : null;
}

function fechaCivilValida(valor) {
  const texto = String(valor || "").slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(texto) ? texto : null;
}

function esAntes(valor, hoy) {
  const fecha = fechaCivilValida(valor);
  return Boolean(fecha && hoy && fecha < hoy);
}

function antiguedadDias(valor, hoy) {
  const fecha = fechaCivilValida(valor);
  if (!fecha || !hoy) return null;
  const inicio = new Date(`${fecha}T12:00:00Z`).getTime();
  const fin = new Date(`${hoy}T12:00:00Z`).getTime();
  if (!Number.isFinite(inicio) || !Number.isFinite(fin)) return null;
  return Math.floor((fin - inicio) / 86400000);
}

function resultadoRegistrado(resultado) {
  if (!resultado || typeof resultado !== "object") return false;
  const historial = Array.isArray(resultado.historial) ? resultado.historial : [];
  if (historial.length > 0) return true;
  return Object.values(resultado.camposConfirmados || {}).some((valor) => valor === true);
}

function moduloPendiente(id, nombre, accion, motivo) {
  return {
    id,
    nombre,
    estado: "PENDIENTE",
    cifra: null,
    etiquetaCifra: "Dato pendiente",
    detalle: motivo,
    accion,
  };
}

export function resumirActivacionOperativa({
  hoy,
  finanzas = {},
  bancos,
  proveedores,
  empleados,
  perfiles,
  horarios,
  tareas,
  campanas,
  rutas,
  incidenciasFlotilla,
  pnr,
  movimientosFlotilla,
} = {}) {
  const fechaHoy = fechaCivilValida(hoy);
  const filasEmpleados = filasFuente(empleados);
  const filasPerfiles = filasFuente(perfiles);
  const filasHorarios = filasFuente(horarios);
  const filasTareas = filasFuente(tareas);
  const filasCampanas = filasFuente(campanas);
  const filasRutas = filasFuente(rutas);
  const filasIncidencias = filasFuente(incidenciasFlotilla);
  const filasPnr = filasFuente(pnr);
  const filasMovimientosFlotilla = filasFuente(movimientosFlotilla);
  const filasProveedores = filasFuente(proveedores);
  const resumenBancos = bancos?.disponible === true ? bancos.valor : null;

  const modulos = [];

  if (finanzas.disponible !== true || !resumenBancos || !filasProveedores) {
    modulos.push(moduloPendiente(
      "finanzas",
      "Finanzas",
      "Abrir Finanzas",
      finanzas.disponible !== true
        ? finanzas.motivo || "Falta confirmar el corte y los movimientos financieros."
        : !resumenBancos
          ? "No fue posible comprobar las cuentas bancarias y sus saldos."
          : "No fue posible comprobar los reportes de deuda con proveedores.",
    ));
  } else {
    const cuentas = Array.isArray(resumenBancos.cuentas) ? resumenBancos.cuentas : [];
    const saldosPendientes = cuentas.filter((cuenta) => cuenta?.saldo == null).length;
    const proveedoresNoDisponibles = filasProveedores.filter((item) => item?.disponible !== true);
    const sucursalesSinReporte = filasProveedores.filter((item) =>
      item?.disponible === true && !item?.importacion?.created_at
    );
    const reportesVencidos = filasProveedores.filter((item) => {
      if (!item?.importacion?.created_at) return false;
      const antiguedad = antiguedadDias(item.importacion.created_at, fechaHoy);
      return antiguedad === null || antiguedad < 0 || antiguedad > 7;
    });

    if (cuentas.length === 0) {
      modulos.push(moduloPendiente(
        "finanzas", "Finanzas", "Abrir Finanzas",
        "No hay cuentas bancarias activas registradas; falta el saldo real para autorizar pagos o compras.",
      ));
    } else if (saldosPendientes > 0) {
      modulos.push(moduloPendiente(
        "finanzas", "Finanzas", "Abrir Finanzas",
        `${saldosPendientes} cuenta${saldosPendientes === 1 ? "" : "s"} bancaria${saldosPendientes === 1 ? "" : "s"} sin saldo confirmado.`,
      ));
    } else if (proveedoresNoDisponibles.length > 0) {
      modulos.push(moduloPendiente(
        "finanzas", "Finanzas", "Abrir Finanzas",
        `No fue posible comprobar proveedores en ${proveedoresNoDisponibles.map((item) => item.sucursal).join(", ")}.`,
      ));
    } else if (sucursalesSinReporte.length > 0) {
      modulos.push(moduloPendiente(
        "finanzas", "Finanzas", "Abrir Finanzas",
        `Falta el reporte de deuda con proveedores de ${sucursalesSinReporte.map((item) => item.sucursal).join(", ")}.`,
      ));
    } else if (reportesVencidos.length > 0) {
      modulos.push(moduloPendiente(
        "finanzas", "Finanzas", "Abrir Finanzas",
        `El reporte de proveedores de ${reportesVencidos.map((item) => item.sucursal).join(", ")} tiene más de 7 días; actualízalo antes de comprometer efectivo.`,
      ));
    } else {
      const pendientes = Number(finanzas.movimientosPendientes);
      const valorPendientes = Number.isFinite(pendientes) ? pendientes : null;
      const vigente = finanzas.datosVigentes === true;
      modulos.push({
        id: "finanzas",
        nombre: "Finanzas",
        estado: vigente && valorPendientes === 0 ? "LISTO" : "ATENCION",
        cifra: valorPendientes,
        etiquetaCifra: valorPendientes === null
          ? "Movimientos por confirmar"
          : `${valorPendientes} movimiento${valorPendientes === 1 ? "" : "s"} por revisar`,
        detalle: !vigente
          ? "El corte no está vigente; no debe usarse para autorizar salidas."
          : valorPendientes > 0
            ? "Primero concilia las salidas antes de pagar, comprar o invertir."
            : "Corte, bancos y proveedores vigentes; no hay movimientos pendientes detectados.",
        accion: valorPendientes > 0 ? "Abrir Tesorería" : "Abrir Finanzas",
      });
    }
  }

  if (!filasEmpleados || !filasPerfiles || !filasHorarios || !filasTareas) {
    modulos.push(moduloPendiente(
      "equipo",
      "Equipo",
      "Abrir Equipo",
      "No fue posible comprobar accesos, perfiles, horarios y tareas del personal.",
    ));
  } else {
    const activos = filasEmpleados.filter((item) => item.active !== false);
    const accesos = new Set(
      activos.filter((item) => item.usuario_id).map((item) => item.id),
    );
    const perfilesIds = new Set(filasPerfiles.map((item) => item.empleado_id));
    const diasPorEmpleado = filasHorarios.reduce((mapa, item) => {
      if (!item?.empleado_id) return mapa;
      mapa.set(item.empleado_id, (mapa.get(item.empleado_id) || 0) + 1);
      return mapa;
    }, new Map());
    const configurados = activos.filter((item) =>
      accesos.has(item.id) &&
      perfilesIds.has(item.id) &&
      (diasPorEmpleado.get(item.id) || 0) >= 7
    ).length;
    const tareasAbiertas = filasTareas.filter((item) =>
      ESTADOS_TAREA_ABIERTA.has(String(item?.estado || "").toLowerCase())
    );
    const vencidas = tareasAbiertas.filter((item) => esAntes(item.fecha, fechaHoy)).length;
    const faltantes = activos.length - configurados;

    modulos.push({
      id: "equipo",
      nombre: "Equipo",
      estado: faltantes === 0 && vencidas === 0 ? "LISTO" : "ATENCION",
      cifra: activos.length,
      etiquetaCifra: `${configurados} de ${activos.length} perfiles listos`,
      detalle: faltantes > 0
        ? `${faltantes} persona${faltantes === 1 ? "" : "s"} sin acceso, perfil u horario completo.`
        : vencidas > 0
          ? `${vencidas} tarea${vencidas === 1 ? "" : "s"} vencida${vencidas === 1 ? "" : "s"} requieren cierre o reprogramación.`
          : "El personal activo tiene acceso, perfil y calendario completos.",
      accion: "Abrir Equipo",
      secundarios: { tareasAbiertas: tareasAbiertas.length, vencidas },
    });
  }

  if (!filasTareas || !filasCampanas) {
    modulos.push(moduloPendiente(
      "marketing",
      "Marketing",
      "Abrir Marketing",
      "No fue posible comprobar tareas y resultados de campañas.",
    ));
  } else {
    const tareasMarketing = filasTareas.filter((item) =>
      String(item?.area || "").toLowerCase().includes("marketing") &&
      ESTADOS_TAREA_ABIERTA.has(String(item?.estado || "").toLowerCase())
    );
    const vencidas = tareasMarketing.filter((item) => esAntes(item.fecha, fechaHoy)).length;
    const activas = filasCampanas.filter((item) => String(item?.estado || "").toUpperCase() === "ACTIVA");
    const sinResultado = activas.filter((item) => !resultadoRegistrado(item.resultado)).length;

    modulos.push({
      id: "marketing",
      nombre: "Marketing",
      estado: vencidas === 0 && sinResultado === 0 ? "LISTO" : "ATENCION",
      cifra: tareasMarketing.length,
      etiquetaCifra: `${tareasMarketing.length} tarea${tareasMarketing.length === 1 ? "" : "s"} abierta${tareasMarketing.length === 1 ? "" : "s"}`,
      detalle: vencidas > 0
        ? `${vencidas} están vencidas. Depura la semana antes de asignar trabajo nuevo.`
        : sinResultado > 0
          ? `${sinResultado} campaña${sinResultado === 1 ? "" : "s"} activa${sinResultado === 1 ? "" : "s"} sin resultado comprobado.`
          : "Las tareas vigentes y las campañas activas tienen seguimiento registrado.",
      accion: "Abrir Marketing",
      secundarios: { vencidas, campanasActivas: activas.length, sinResultado },
    });
  }

  if (!filasRutas || !filasIncidencias || !filasPnr || !filasMovimientosFlotilla) {
    modulos.push(moduloPendiente(
      "flotilla",
      "Flotilla",
      "Abrir Flotilla",
      "No fue posible comprobar rutas, incidencias, PNR y dinero de Flotilla.",
    ));
  } else if (
    filasRutas.length + filasIncidencias.length + filasPnr.length + filasMovimientosFlotilla.length === 0
  ) {
    modulos.push(moduloPendiente(
      "flotilla",
      "Flotilla",
      "Abrir Flotilla",
      "Flotilla aún no tiene rutas, incidencias, PNR ni movimientos conectados; sin registros no se puede declarar lista.",
    ));
  } else {
    const rutasActivas = filasRutas.filter((item) =>
      ESTADOS_RUTA_ACTIVA.has(String(item?.estado || "").toUpperCase())
    ).length;
    const incidenciasAbiertas = filasIncidencias.filter((item) =>
      !ESTADOS_INCIDENCIA_CERRADA.has(String(item?.estado || "").toUpperCase())
    ).length;
    const pnrActivos = filasPnr.filter((item) =>
      !ESTADOS_PNR_CERRADO.has(String(item?.estado || "").toUpperCase())
    ).length;
    const dineroPendiente = filasMovimientosFlotilla.filter((item) =>
      !["CONCILIADO", "DESCARTADO"].includes(
        String(item?.estado_conciliacion || "").toUpperCase(),
      )
    ).length;
    const revisiones = incidenciasAbiertas + pnrActivos + dineroPendiente;

    modulos.push({
      id: "flotilla",
      nombre: "Flotilla",
      estado: revisiones === 0 ? "LISTO" : "ATENCION",
      cifra: rutasActivas,
      etiquetaCifra: `${rutasActivas} ruta${rutasActivas === 1 ? "" : "s"} activa${rutasActivas === 1 ? "" : "s"}`,
      detalle: revisiones > 0
        ? `${revisiones} ${revisiones === 1 ? "revisión operativa pendiente" : "revisiones operativas pendientes"}.`
        : "Sin incidencias, PNR o movimientos de ruta pendientes detectados.",
      accion: "Abrir Flotilla",
      secundarios: { incidenciasAbiertas, pnrActivos, dineroPendiente },
    });
  }

  const orden = ["finanzas", "equipo", "marketing", "flotilla"];
  const prioridad = [...modulos]
    .filter((item) => item.estado !== "LISTO")
    .sort((a, b) => {
    const peso = { PENDIENTE: 0, ATENCION: 1, LISTO: 2 };
    return (peso[a.estado] - peso[b.estado]) ||
      (orden.indexOf(a.id) - orden.indexOf(b.id));
  })[0] || null;

  return {
    modulos,
    prioridad,
    listos: modulos.filter((item) => item.estado === "LISTO").length,
    total: modulos.length,
  };
}
