import { fechaOperativaMexico } from "../../inteligencia/utils/corteTienda.js";
import { leerAperturaCaja } from "../../inteligencia/utils/capturasFinancierasEquipo.js";

function numeroReal(valor) {
  if (valor === null || valor === undefined || String(valor).trim() === "") return null;
  const convertido = Number(valor);
  return Number.isFinite(convertido) ? convertido : null;
}

function tieneDatosFinancierosCompletos(captura) {
  if (!captura?.datos || captura.datos.registroIncompleto) return false;
  return ["ventaSicar", "cobrado", "efectivoEntregado", "efectivoFinal", "diferenciaVenta", "diferenciaCaja"]
    .every((campo) => numeroReal(captura.datos[campo]) !== null);
}

export function fechaCierreEnMexico(cierre = {}) {
  const creada = cierre.created_at ? new Date(cierre.created_at) : null;
  if (creada && !Number.isNaN(creada.getTime())) return fechaOperativaMexico(creada);
  return String(cierre.fecha || "").trim();
}

function nombreCaja(cajaId) {
  if (cajaId === "CAJA_1") return "Caja 1";
  if (cajaId === "CAJA_2") return "Caja 2";
  return "Caja sin identificar";
}

function branchIdDe(registro = {}) {
  return String(registro?.branch_id || "SIN_SUCURSAL");
}

function ordenarRecientesPrimero(a, b) {
  return new Date(b?.cierre?.created_at || b?.apertura?.abiertoEn || 0) - new Date(a?.cierre?.created_at || a?.apertura?.abiertoEn || 0);
}

function crearTramosCaja({ capturas, cierres, fecha }) {
  const cortesHoy = (Array.isArray(capturas) ? capturas : [])
    .filter((captura) => captura?.tipo === "caja" && fechaCierreEnMexico(captura.cierre) === fecha)
    .sort((a, b) => new Date(b?.cierre?.created_at || 0) - new Date(a?.cierre?.created_at || 0));

  const aperturasHoy = (Array.isArray(cierres) ? cierres : [])
    .map((cierre) => ({ cierre, apertura: leerAperturaCaja(cierre?.observaciones) }))
    .filter(({ cierre, apertura }) => apertura && fechaCierreEnMexico(cierre) === fecha);

  const cortesPorSesion = new Map();
  const cortesSinSesion = [];
  for (const captura of cortesHoy) {
    const sesionCajaId = String(captura?.datos?.sesionCajaId || "").trim();
    if (!sesionCajaId) cortesSinSesion.push(captura);
    else if (!cortesPorSesion.has(sesionCajaId)) cortesPorSesion.set(sesionCajaId, captura);
  }

  const sesionesRepresentadas = new Set();
  const tramos = aperturasHoy.map(({ cierre, apertura }) => {
    const sesionCajaId = String(apertura?.sesionCajaId || cierre?.id || "").trim();
    sesionesRepresentadas.add(sesionCajaId);
    const captura = cortesPorSesion.get(sesionCajaId) || null;
    const cajaId = String(apertura?.cajaId || captura?.datos?.cajaId || "SIN_CAJA");
    return {
      segmentoId: `sesion:${sesionCajaId}`,
      sesionCajaId,
      branchId: branchIdDe(cierre),
      cajaId,
      nombre: apertura?.cajaNombre || nombreCaja(cajaId),
      responsable: apertura?.responsable || captura?.cierre?.responsable || "",
      apertura,
      captura,
      capturas: captura ? [captura] : [],
      estado: !captura ? "faltante" : tieneDatosFinancierosCompletos(captura) ? "completo" : "incompleto",
      turnosReportados: captura ? [String(captura?.datos?.turnoCaja || "SIN_TURNO")] : [],
    };
  });

  for (const [sesionCajaId, captura] of cortesPorSesion) {
    if (sesionesRepresentadas.has(sesionCajaId)) continue;
    const cajaId = String(captura?.datos?.cajaId || "SIN_CAJA");
    tramos.push({
      segmentoId: `corte:${captura?.cierre?.id || sesionCajaId}`,
      sesionCajaId,
      branchId: branchIdDe(captura?.cierre),
      cajaId,
      nombre: captura?.datos?.cajaNombre || nombreCaja(cajaId),
      responsable: captura?.datos?.responsableCierre || captura?.cierre?.responsable || "",
      apertura: null,
      captura,
      capturas: [captura],
      estado: tieneDatosFinancierosCompletos(captura) ? "completo" : "incompleto",
      turnosReportados: [String(captura?.datos?.turnoCaja || "SIN_TURNO")],
    });
  }

  for (const captura of cortesSinSesion) {
    const cajaId = String(captura?.datos?.cajaId || "SIN_CAJA");
    tramos.push({
      segmentoId: `legado:${captura?.cierre?.id || `${branchIdDe(captura?.cierre)}:${cajaId}`}`,
      sesionCajaId: "",
      branchId: branchIdDe(captura?.cierre),
      cajaId,
      nombre: captura?.datos?.cajaNombre || nombreCaja(cajaId),
      responsable: captura?.datos?.responsableCierre || captura?.cierre?.responsable || "",
      apertura: null,
      captura,
      capturas: [captura],
      estado: tieneDatosFinancierosCompletos(captura) ? "completo" : "incompleto",
      turnosReportados: [String(captura?.datos?.turnoCaja || "SIN_TURNO")],
    });
  }

  return tramos.sort(ordenarRecientesPrimero);
}

function cajasEsperadasLegadas(nombre) {
  return /centro/i.test(String(nombre || "")) ? ["CAJA_1", "CAJA_2"] : ["CAJA_1"];
}

function crearTramosLegados({ capturas, mapaSucursales, fecha }) {
  const cortesHoy = (Array.isArray(capturas) ? capturas : [])
    .filter((captura) => captura?.tipo === "caja" && fechaCierreEnMexico(captura.cierre) === fecha)
    .sort((a, b) => new Date(b?.cierre?.created_at || 0) - new Date(a?.cierre?.created_at || 0));
  const ultimosPorCajaTurno = new Map();
  for (const captura of cortesHoy) {
    const branchId = branchIdDe(captura?.cierre);
    const cajaId = String(captura?.datos?.cajaId || "SIN_CAJA");
    const turno = String(captura?.datos?.turnoCaja || "SIN_TURNO");
    const clave = `${branchId}|${cajaId}|${turno}`;
    if (!ultimosPorCajaTurno.has(clave)) ultimosPorCajaTurno.set(clave, captura);
  }
  const porCaja = new Map();
  for (const captura of ultimosPorCajaTurno.values()) {
    const clave = `${branchIdDe(captura?.cierre)}|${String(captura?.datos?.cajaId || "SIN_CAJA")}`;
    porCaja.set(clave, [...(porCaja.get(clave) || []), captura]);
  }
  for (const [clave, lista] of porCaja) {
    const completo = lista.find((captura) => String(captura?.datos?.turnoCaja || "").toUpperCase() === "COMPLETO");
    if (completo) porCaja.set(clave, [completo]);
  }

  const tramos = [];
  for (const [branchId, nombre] of mapaSucursales) {
    for (const cajaId of cajasEsperadasLegadas(nombre)) {
      const lista = porCaja.get(`${branchId}|${cajaId}`) || [];
      const captura = lista.find((item) => item.datos.registroIncompleto) || lista[0] || null;
      tramos.push({
        segmentoId: `legado:${branchId}:${cajaId}`,
        sesionCajaId: "",
        branchId,
        cajaId,
        nombre: nombreCaja(cajaId),
        responsable: captura?.cierre?.responsable || "",
        apertura: null,
        captura,
        capturas: lista,
        estado: !captura ? "faltante" : lista.every(tieneDatosFinancierosCompletos) ? "completo" : "incompleto",
        turnosReportados: lista.map((item) => String(item?.datos?.turnoCaja || "SIN_TURNO")),
      });
    }
  }
  return tramos;
}

export function resumirCierreDiarioDireccion(opciones = {}) {
  const { capturas = [], cierres = [], sucursales = [], fecha = fechaOperativaMexico() } = opciones;
  const mapaSucursales = new Map();
  for (const sucursal of Array.isArray(sucursales) ? sucursales : []) {
    if (!sucursal?.id) continue;
    mapaSucursales.set(String(sucursal.id), sucursal.name || sucursal.nombre || "Sucursal");
  }

  const usaSesionesReales = Object.prototype.hasOwnProperty.call(opciones, "cierres");
  const tramos = usaSesionesReales
    ? crearTramosCaja({ capturas, cierres, fecha })
    : crearTramosLegados({ capturas, mapaSucursales, fecha });
  for (const tramo of tramos) {
    if (!mapaSucursales.has(tramo.branchId)) mapaSucursales.set(tramo.branchId, "Sucursal sin identificar");
  }

  const filas = [...mapaSucursales.entries()].map(([branchId, nombre]) => {
    const cajas = tramos.filter((tramo) => tramo.branchId === branchId);
    return {
      branchId,
      nombre,
      cajas,
      completas: cajas.filter((caja) => caja.estado === "completo").length,
      incompletas: cajas.filter((caja) => caja.estado === "incompleto").length,
      faltantes: cajas.filter((caja) => caja.estado === "faltante").length,
    };
  });

  const evaluables = tramos.flatMap((tramo) => tramo.capturas).filter(tieneDatosFinancierosCompletos);
  const sumar = (campo) => evaluables.length > 0
    ? evaluables.reduce((total, captura) => total + numeroReal(captura.datos[campo]), 0)
    : null;
  const diferencias = evaluables.filter((captura) => {
    const venta = Math.abs(numeroReal(captura.datos.diferenciaVenta) || 0);
    const caja = Math.abs(numeroReal(captura.datos.diferenciaCaja) || 0);
    return venta > 0.009 || caja > 0.009;
  }).length;
  const retiros = evaluables.map((captura) => {
    const monto = numeroReal(captura.datos.efectivoEntregado);
    const destino = String(captura.datos.destinoEfectivoRetirado || "").trim() || null;
    const responsable = String(captura.datos.responsableEfectivoRetirado || "").trim() || null;
    const detalle = String(captura.datos.detalleEfectivoRetirado || "").trim() || null;
    return {
      cierreId: captura.cierre.id,
      branchId: branchIdDe(captura.cierre),
      cajaId: String(captura.datos.cajaId || "SIN_CAJA"),
      monto,
      destino,
      responsable,
      detalle,
      estado: monto === 0 ? "NO_APLICA" : monto !== null && destino && responsable && detalle ? "IDENTIFICADO" : "PENDIENTE",
    };
  });

  return {
    fecha,
    sucursales: filas,
    cajasEsperadas: tramos.length,
    cajasCompletas: filas.reduce((total, fila) => total + fila.completas, 0),
    cajasIncompletas: filas.reduce((total, fila) => total + fila.incompletas, 0),
    cajasFaltantes: filas.reduce((total, fila) => total + fila.faltantes, 0),
    ventaSicar: sumar("ventaSicar"),
    cobrado: sumar("cobrado"),
    efectivoFinal: sumar("efectivoFinal"),
    efectivoEntregado: sumar("efectivoEntregado"),
    retiros,
    diferencias,
  };
}
