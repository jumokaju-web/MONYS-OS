/*
 * CALENDARIO OPERATIVO DE SUCURSALES · MONYS OS
 *
 * Interpreta sucursal_vigencias y sucursal_calendario para un mes:
 * - Vigencia: días en que la sucursal opera. Fuera de su vigencia no se
 *   esperan ventas (no es dato faltante). Sin ninguna vigencia registrada,
 *   la vigencia es "desconocida": se asume que opera y se marca.
 * - Días: cerrado, horario_reducido, abierto. Un día sin registro NO es
 *   abierto ni cerrado confirmado: es "sin_registro".
 * - Un cierre no elimina gastos: solo cambia la productividad esperada
 *   (ventas esperadas, días comparables, venta diaria necesaria).
 * Módulo puro.
 */

const DIA = 86400000;
const sumarDias = (dia, n) => new Date(Date.parse(`${dia}T00:00:00Z`) + n * DIA).toISOString().slice(0, 10);
const esFecha = (v) => /^\d{4}-\d{2}-\d{2}$/.test(String(v ?? ""));

export function diasDelMes(mes) {
  const [a, m] = String(mes).split("-").map(Number);
  const ultimo = new Date(Date.UTC(a, m, 0)).toISOString().slice(0, 10);
  const dias = [];
  for (let d = `${mes}-01`; d <= ultimo; d = sumarDias(d, 1)) dias.push(d);
  return dias;
}

function minutos(v) {
  const n = Number(v);
  return v === null || v === undefined || v === "" || !Number.isFinite(n) || n < 0 || n > 1440 ? null : n;
}

/*
 * vigencias: filas de sucursal_vigencias de la sucursal.
 * dias:      filas de sucursal_calendario de la sucursal.
 * hoy:       YYYY-MM-DD; los días desde hoy no se esperan aún.
 */
export function calendarioDelMes({ branchId, mes, vigencias = [], dias = [], hoy = null } = {}) {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(String(mes || ""))) return { calculable: false, faltantes: ["mes válido (YYYY-MM)"] };
  const propias = (vigencias || []).filter((v) => String(v?.branch_id) === String(branchId) && esFecha(v?.operando_desde));
  const registros = new Map(
    (dias || []).filter((d) => String(d?.branch_id) === String(branchId) && esFecha(d?.fecha)).map((d) => [d.fecha, d])
  );
  const vigenciaConocida = propias.length > 0;
  const operaEn = (dia) => !vigenciaConocida || propias.some((v) => v.operando_desde <= dia && (!esFecha(v.operando_hasta) || dia <= v.operando_hasta));

  const salida = {
    branchId: String(branchId),
    mes,
    vigencia: vigenciaConocida ? null : "desconocida",
    diasOperando: [],
    diasFueraDeVigencia: [],
    diasCerrados: [],
    diasReducidos: [],
    diasAbiertosConfirmados: [],
    diasSinRegistro: [],
    diasFuturos: [],
    minutosProgramados: 0,
    minutosReales: 0,
    minutosIncompletos: 0,
  };
  for (const dia of diasDelMes(mes)) {
    if (!operaEn(dia)) {
      salida.diasFueraDeVigencia.push(dia);
      continue;
    }
    if (hoy && dia >= String(hoy).slice(0, 10)) {
      salida.diasFuturos.push(dia);
      continue;
    }
    salida.diasOperando.push(dia);
    const r = registros.get(dia);
    if (!r) {
      salida.diasSinRegistro.push(dia);
      continue;
    }
    if (r.estado === "cerrado") salida.diasCerrados.push(dia);
    else if (r.estado === "horario_reducido") salida.diasReducidos.push({ fecha: dia, minutosProgramados: minutos(r.minutos_programados), minutosReales: minutos(r.minutos_reales), motivo: r.motivo || "" });
    else salida.diasAbiertosConfirmados.push(dia);
    const mp = minutos(r.minutos_programados), mr = minutos(r.minutos_reales);
    if (r.estado !== "cerrado") {
      if (mp === null || mr === null) salida.minutosIncompletos += 1;
      salida.minutosProgramados += mp ?? 0;
      salida.minutosReales += mr ?? 0;
    }
  }
  if (vigenciaConocida) {
    salida.vigencia = !salida.diasOperando.length && !salida.diasFuturos.length ? "no_opera" : salida.diasFueraDeVigencia.length ? "parcial" : "completa";
  }
  // Días en que se espera venta: operando y no cerrados.
  salida.diasConVentaEsperada = salida.diasOperando.filter((d) => !salida.diasCerrados.includes(d));
  return { calculable: true, ...salida };
}

/* Calendario de varias sucursales: { [branchId]: calendarioDelMes }. */
export function calendarioDelNegocio({ sucursales = [], mes, vigencias = [], dias = [], hoy = null } = {}) {
  return Object.fromEntries((sucursales || []).map((s) => [String(s.id), calendarioDelMes({ branchId: s.id, mes, vigencias, dias, hoy })]));
}
