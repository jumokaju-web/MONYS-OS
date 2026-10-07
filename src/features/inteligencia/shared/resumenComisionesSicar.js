const TASA_COMISION = 0.01;

function texto(valor) {
  return String(valor ?? "").trim();
}

export function normalizarUsuarioSicar(valor) {
  return texto(valor)
    .toLocaleLowerCase("es-MX")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ");
}

function fechaISO(valor) {
  if (valor instanceof Date && Number.isFinite(valor.getTime())) {
    return [valor.getFullYear(), String(valor.getMonth() + 1).padStart(2, "0"), String(valor.getDate()).padStart(2, "0")].join("-");
  }
  if (typeof valor === "number" && valor > 20000 && valor < 90000) {
    const fecha = new Date(Date.UTC(1899, 11, 30) + Math.round(valor) * 86400000);
    return fecha.toISOString().slice(0, 10);
  }
  const cadena = texto(valor);
  if (!cadena) return null;
  const iso = cadena.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})/);
  if (iso) return `${iso[1]}-${String(iso[2]).padStart(2, "0")}-${String(iso[3]).padStart(2, "0")}`;
  const mx = cadena.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})/);
  if (mx) return `${mx[3]}-${String(mx[2]).padStart(2, "0")}-${String(mx[1]).padStart(2, "0")}`;
  const parsed = new Date(cadena);
  return Number.isFinite(parsed.getTime()) ? parsed.toISOString().slice(0, 10) : null;
}

function numero(valor) {
  if (typeof valor === "number") return Number.isFinite(valor) ? valor : 0;
  const limpio = texto(valor).replace(/[$,\s]/g, "");
  const convertido = Number(limpio);
  return Number.isFinite(convertido) ? convertido : 0;
}

function leerVenta(fila) {
  const raw = fila?.datos_originales || fila || {};
  return {
    fecha: fechaISO(raw.fecha),
    folio: texto(raw.folio || raw.codigo || raw.documento),
    usuario: texto(raw.usuario || raw.vendedor),
    venta: numero(raw.ventaTotal ?? raw.totalVenta ?? raw.total_venta),
  };
}

export function resumirComisionesSicar({
  filas = [],
  empleados = [],
  desde,
  hasta,
  tasa = TASA_COMISION,
  oportunidadesCRM = [],
} = {}) {
  const registros = Array.isArray(filas) ? filas : [];
  const personal = Array.isArray(empleados) ? empleados : [];
  const mapeo = new Map();
  for (const empleado of personal) {
    const clave = normalizarUsuarioSicar(empleado.usuario_sicar);
    if (!clave) continue;
    const grupo = mapeo.get(clave) || [];
    grupo.push(empleado);
    mapeo.set(clave, grupo);
  }

  const foliosCRM = new Map();
  for (const oportunidad of Array.isArray(oportunidadesCRM) ? oportunidadesCRM : []) {
    const folio = texto(oportunidad?.folio_venta_sicar).toLocaleLowerCase("es-MX");
    if (!folio || oportunidad?.etapa !== "GANADO") continue;
    const lista = foliosCRM.get(folio) || [];
    lista.push(oportunidad);
    foliosCRM.set(folio, lista);
  }
  const ticketsUnicos = new Map();
  const ajustesPendientesPorFolio = new Map();
  let filasSinIdentidad = 0;
  for (const fila of registros) {
    const venta = leerVenta(fila);
    if (!venta.fecha || !venta.folio) {
      filasSinIdentidad += 1;
      continue;
    }
    if (venta.fecha < desde || venta.fecha > hasta) continue;
    const llave = `${venta.fecha}|${venta.folio.toLocaleLowerCase("es-MX")}`;
    if (venta.venta < 0) {
      if (!ajustesPendientesPorFolio.has(llave)) ajustesPendientesPorFolio.set(llave, venta);
      continue;
    }
    const anterior = ticketsUnicos.get(llave);
    if (!anterior || (!anterior.usuario && venta.usuario)) ticketsUnicos.set(llave, venta);
  }

  const acumulado = new Map();
  const sinAsignar = new Map();
  const conciliacion = [];
  const foliosEnReporte = new Set();
  let ventasPeriodo = 0;
  for (const venta of ticketsUnicos.values()) {
    ventasPeriodo += venta.venta;
    const folioClave = venta.folio.toLocaleLowerCase("es-MX");
    foliosEnReporte.add(folioClave);
    const oportunidades = foliosCRM.get(folioClave) || [];
    const coincidencias = venta.usuario ? (mapeo.get(normalizarUsuarioSicar(venta.usuario)) || []) : [];
    let empleadoCRM = null;
    let estado = "";
    let participantesCRM = [];
    if (oportunidades.length > 1) {
      estado = "CRM_FOLIO_DUPLICADO";
    } else if (oportunidades.length === 1) {
      const oportunidad = oportunidades[0];
      participantesCRM = Array.isArray(oportunidad.participantes_empleados)
        ? oportunidad.participantes_empleados.filter((persona) => persona.id)
        : [];
      const idsParticipantes = new Set([
        ...(Array.isArray(oportunidad.participantes_empleado_ids) ? oportunidad.participantes_empleado_ids : []),
        ...(oportunidad.empleado_id ? [oportunidad.empleado_id] : []),
      ]);
      if (oportunidad.participacion_verificada === false) {
        estado = "CRM_PARTICIPACION_NO_VERIFICADA";
      } else if (idsParticipantes.size > 1) {
        estado = "CRM_MULTIPLES_EMPLEADAS";
      } else if (idsParticipantes.size === 1) {
        const empleadoId = [...idsParticipantes][0];
        empleadoCRM = personal.find((persona) => persona.id === empleadoId)
          || participantesCRM.find((persona) => persona.id === empleadoId)
          || (oportunidad.empleado_id === empleadoId && oportunidad.empleado_nombre
            ? { id: empleadoId, nombre: oportunidad.empleado_nombre }
            : null);
        estado = empleadoCRM ? "CRM_ATRIBUIDO" : "CRM_EMPLEADA_NO_ENCONTRADA";
      } else {
        estado = "CRM_SIN_RESPONSABLE";
      }
    } else if (coincidencias.length === 1) {
      estado = "SICAR_ASIGNADO";
    } else {
      estado = coincidencias.length > 1 ? "SICAR_AMBIGUO" : venta.usuario ? "SIN_ASIGNAR" : "SICAR_SIN_USUARIO";
    }
    const empleadoAsignado = empleadoCRM || (oportunidades.length === 0 && coincidencias.length === 1 ? coincidencias[0] : null);
    conciliacion.push({
      folio: venta.folio,
      fecha: venta.fecha,
      usuarioSicar: venta.usuario,
      empleado: empleadoAsignado?.nombre || "",
      participantes: participantesCRM.map((persona) => persona.nombre).filter(Boolean),
      importe: venta.venta,
      estado,
    });
    if (empleadoAsignado) {
      const empleado = empleadoAsignado;
      const actual = acumulado.get(empleado.id) || {
        empleadoId: empleado.id,
        empleado: empleado.nombre,
        usuarioSicar: venta.usuario,
        tickets: 0,
        ticketsCRM: 0,
        ventas: 0,
        tasa,
        comision: 0,
      };
      actual.tickets += 1;
      if (empleadoCRM) actual.ticketsCRM += 1;
      actual.ventas += venta.venta;
      actual.comision = Math.round(actual.ventas * tasa * 100) / 100;
      acumulado.set(empleado.id, actual);
    } else {
      const key = normalizarUsuarioSicar(venta.usuario) || "SIN_USUARIO_SICAR";
      const actual = sinAsignar.get(key) || {
        usuarioSicar: venta.usuario || "Sin usuario SICAR",
        motivo: oportunidades.length > 1
          ? "CRM_FOLIO_DUPLICADO"
          : oportunidades.length === 1
            ? estado
            : coincidencias.length > 1
              ? "ASIGNACION_AMBIGUA"
              : "SIN_ASIGNAR",
        tickets: 0,
        ventas: 0,
      };
      actual.tickets += 1;
      actual.ventas += venta.venta;
      sinAsignar.set(key, actual);
    }
  }

  for (const venta of ajustesPendientesPorFolio.values()) {
    const folioClave = venta.folio.toLocaleLowerCase("es-MX");
    foliosEnReporte.add(folioClave);
    conciliacion.push({
      folio: venta.folio,
      fecha: venta.fecha,
      usuarioSicar: venta.usuario,
      empleado: "",
      participantes: [],
      importe: venta.venta,
      estado: "AJUSTE_NEGATIVO_PENDIENTE",
    });
  }

  for (const [folio, oportunidades] of foliosCRM) {
    if (foliosEnReporte.has(folio)) continue;
    for (const oportunidad of oportunidades) {
      const participantes = Array.isArray(oportunidad.participantes_empleados)
        ? oportunidad.participantes_empleados.map((persona) => persona.nombre).filter(Boolean)
        : [];
      const idsParticipantes = new Set([
        ...(Array.isArray(oportunidad.participantes_empleado_ids) ? oportunidad.participantes_empleado_ids : []),
        ...(oportunidad.empleado_id ? [oportunidad.empleado_id] : []),
      ]);
      const estado = oportunidades.length > 1
        ? "CRM_DUPLICADO_SIN_TICKET"
        : oportunidad.participacion_verificada === false
          ? "CRM_PARTICIPACION_NO_VERIFICADA"
          : idsParticipantes.size > 1
            ? "CRM_MULTIPLES_EMPLEADAS"
            : "CRM_SIN_TICKET_EN_REPORTE";
      conciliacion.push({
        folio,
        fecha: "",
        usuarioSicar: "",
        empleado: oportunidad.empleado_nombre || personal.find((persona) => persona.id === oportunidad.empleado_id)?.nombre || "",
        participantes,
        importe: null,
        estado,
      });
    }
  }

  const comisiones = [...acumulado.values()].sort((a, b) => b.ventas - a.ventas);
  const comisionTotal = Math.round(comisiones.reduce((suma, fila) => suma + fila.comision, 0) * 100) / 100;
  const ventasAsignadas = comisiones.reduce((suma, fila) => suma + fila.ventas, 0);
  const ventasSinAsignar = [...sinAsignar.values()].reduce((suma, fila) => suma + fila.ventas, 0);
  const ticketsPorRevisar = conciliacion.filter((fila) =>
    fila.importe != null && !["CRM_ATRIBUIDO", "SICAR_ASIGNADO"].includes(fila.estado)
  ).length;
  return {
    tasa,
    tickets: ticketsUnicos.size,
    filasSinIdentidad,
    ajustesNegativosPendientes: {
      tickets: ajustesPendientesPorFolio.size,
      importe: Math.round([...ajustesPendientesPorFolio.values()].reduce((suma, venta) => suma + venta.venta, 0) * 100) / 100,
    },
    ventasPeriodo: Math.round(ventasPeriodo * 100) / 100,
    ventasAsignadas: Math.round(ventasAsignadas * 100) / 100,
    ventasSinAsignar: Math.round(ventasSinAsignar * 100) / 100,
    ticketsPorRevisar,
    comisionTotal,
    comisiones,
    sinAsignar: [...sinAsignar.values()].sort((a, b) => b.ventas - a.ventas),
    conciliacion: conciliacion.sort((a, b) => {
      const revisarA = ["CRM_ATRIBUIDO", "SICAR_ASIGNADO"].includes(a.estado) ? 1 : 0;
      const revisarB = ["CRM_ATRIBUIDO", "SICAR_ASIGNADO"].includes(b.estado) ? 1 : 0;
      return revisarA - revisarB || b.fecha.localeCompare(a.fecha) || a.folio.localeCompare(b.folio);
    }),
  };
}
