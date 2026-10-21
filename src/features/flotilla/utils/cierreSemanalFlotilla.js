const DIA_MS = 86400000;

function fechaValida(fecha) {
  const valor = new Date(`${fecha}T12:00:00Z`);
  return Number.isNaN(valor.getTime()) ? null : valor;
}

function fechaIso(valor) {
  return valor.toISOString().slice(0, 10);
}

export function semanaOperativa(fecha) {
  const valor = fechaValida(fecha);
  if (!valor) return { desde: "", hasta: "" };
  const dia = valor.getUTCDay() || 7;
  const lunes = new Date(valor);
  lunes.setUTCDate(lunes.getUTCDate() - dia + 1);
  const domingo = new Date(lunes);
  domingo.setUTCDate(domingo.getUTCDate() + 6);
  return { desde: fechaIso(lunes), hasta: fechaIso(domingo) };
}

export function periodoPrefacturaSugerido(fechaHoy) {
  const actual = semanaOperativa(fechaHoy);
  const valor = fechaValida(fechaHoy);
  if (!valor || !actual.desde) return actual;
  if (valor.getUTCDay() === 0) return actual;
  const lunesAnterior = fechaValida(actual.desde);
  lunesAnterior.setUTCDate(lunesAnterior.getUTCDate() - 7);
  return semanaOperativa(fechaIso(lunesAnterior));
}

export function rutaFinalizada(ruta = {}) {
  return ruta.estado === "FINALIZADA" && Boolean(ruta.hora_fin_ruta);
}

export function separarRutasPorCierre(operaciones = []) {
  const finalizadas = [];
  const pendientes = [];
  const duplicadasIgnoradas = [];
  const grupos = new Map();
  (Array.isArray(operaciones) ? operaciones : []).forEach((ruta, indice) => {
    const identidad = [ruta.fecha, ruta.unidad_id || ruta.unidad?.placas, ruta.driver_auth_user_id || ruta.chofer_nombre, ruta.codigo_ruta]
      .map((valor) => String(valor || "").trim().toLowerCase())
      .join("::");
    const clave = identidad.replaceAll(":", "") ? identidad : `ruta-${ruta.id || indice}`;
    const grupo = grupos.get(clave) || [];
    grupo.push(ruta);
    grupos.set(clave, grupo);
  });
  grupos.forEach((grupo) => {
    const cerradas = grupo.filter(rutaFinalizada).sort((a, b) => String(b.hora_fin_ruta).localeCompare(String(a.hora_fin_ruta)));
    if (cerradas.length > 0) {
      finalizadas.push(cerradas[0]);
      duplicadasIgnoradas.push(...grupo.filter((item) => item !== cerradas[0]));
      return;
    }
    const ordenadas = [...grupo].sort((a, b) => String(b.hora_inicio_ruta || b.created_at || "").localeCompare(String(a.hora_inicio_ruta || a.created_at || "")));
    pendientes.push(ordenadas[0]);
    duplicadasIgnoradas.push(...ordenadas.slice(1));
  });
  return { finalizadas, pendientes, duplicadasIgnoradas };
}

export function evaluarCierreSemanal(operaciones = [], periodo = {}, fechaHoy = "") {
  const { finalizadas, pendientes, duplicadasIgnoradas } = separarRutasPorCierre(operaciones);
  const semana = semanaOperativa(periodo.desde);
  const periodoLunesDomingo = semana.desde === periodo.desde && semana.hasta === periodo.hasta;
  const hoy = fechaValida(fechaHoy);
  const fin = fechaValida(periodo.hasta);
  const periodoTerminado = Boolean(hoy && fin && fin <= hoy);

  let estado = "LISTA_REVISION";
  if (!periodoLunesDomingo) estado = "PERIODO_INCOMPLETO";
  else if (pendientes.length > 0) estado = "PENDIENTE_CIERRES";
  else if (!periodoTerminado) estado = "SEMANA_EN_CURSO";
  else if (finalizadas.length === 0) estado = "SIN_RUTAS";

  return {
    estado,
    periodoLunesDomingo,
    periodoTerminado,
    rutasFinalizadas: finalizadas.length,
    rutasPendientes: pendientes.length,
    finalizadas,
    pendientes,
    duplicadasIgnoradas,
    listaParaRevision: estado === "LISTA_REVISION",
  };
}

export const DIA_EN_MILISEGUNDOS = DIA_MS;
