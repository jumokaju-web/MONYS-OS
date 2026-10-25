import { fechaOperativaMexico } from "../../inteligencia/utils/corteTienda.js";

function numeroReal(valor) {
  if (valor === null || valor === undefined || String(valor).trim() === "") return null;
  const convertido = Number(valor);
  return Number.isFinite(convertido) ? convertido : null;
}

export function fechaCierreEnMexico(cierre = {}) {
  const creada = cierre.created_at ? new Date(cierre.created_at) : null;
  if (creada && !Number.isNaN(creada.getTime())) return fechaOperativaMexico(creada);
  return String(cierre.fecha || "").trim();
}

function cajasEsperadas(nombre) {
  return /centro/i.test(String(nombre || "")) ? ["CAJA_1", "CAJA_2"] : ["CAJA_1"];
}

function nombreCaja(cajaId) {
  if (cajaId === "CAJA_1") return "Caja 1";
  if (cajaId === "CAJA_2") return "Caja 2";
  return "Caja sin identificar";
}

export function resumirCierreDiarioDireccion({ capturas = [], sucursales = [], fecha = fechaOperativaMexico() } = {}) {
  const mapaSucursales = new Map();
  for (const sucursal of Array.isArray(sucursales) ? sucursales : []) {
    if (!sucursal?.id) continue;
    mapaSucursales.set(String(sucursal.id), sucursal.name || sucursal.nombre || "Sucursal");
  }

  const cortesHoy = (Array.isArray(capturas) ? capturas : [])
    .filter((captura) => captura?.tipo === "caja" && fechaCierreEnMexico(captura.cierre) === fecha)
    .sort((a, b) => new Date(b?.cierre?.created_at || 0) - new Date(a?.cierre?.created_at || 0));

  for (const captura of cortesHoy) {
    const id = String(captura?.cierre?.branch_id || "SIN_SUCURSAL");
    if (!mapaSucursales.has(id)) mapaSucursales.set(id, "Sucursal sin identificar");
  }

  const ultimosPorCaja = new Map();
  for (const captura of cortesHoy) {
    const branchId = String(captura?.cierre?.branch_id || "SIN_SUCURSAL");
    const cajaId = String(captura?.datos?.cajaId || "SIN_CAJA");
    const clave = `${branchId}|${cajaId}`;
    if (!ultimosPorCaja.has(clave)) ultimosPorCaja.set(clave, captura);
  }

  const filas = [...mapaSucursales.entries()].map(([branchId, nombre]) => {
    const esperadas = cajasEsperadas(nombre);
    const cajas = esperadas.map((cajaId) => {
      const captura = ultimosPorCaja.get(`${branchId}|${cajaId}`) || null;
      return {
        cajaId,
        nombre: nombreCaja(cajaId),
        estado: !captura ? "faltante" : captura.datos.registroIncompleto ? "incompleto" : "completo",
        captura,
      };
    });
    const sinIdentificar = ultimosPorCaja.get(`${branchId}|SIN_CAJA`);
    if (sinIdentificar) cajas.push({ nombre: nombreCaja(), cajaId: "SIN_CAJA", estado: "incompleto", captura: sinIdentificar });
    return {
      branchId,
      nombre,
      cajas,
      completas: cajas.filter((caja) => caja.estado === "completo").length,
      incompletas: cajas.filter((caja) => caja.estado === "incompleto").length,
      faltantes: cajas.filter((caja) => caja.estado === "faltante").length,
    };
  });

  const evaluables = [...ultimosPorCaja.values()].filter((captura) => !captura.datos.registroIncompleto);
  const sumar = (campo) => evaluables.reduce((total, captura) => total + (numeroReal(captura.datos[campo]) || 0), 0);
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
      branchId: String(captura.cierre.branch_id || "SIN_SUCURSAL"),
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
    cajasEsperadas: filas.reduce((total, fila) => total + fila.cajas.filter((caja) => caja.cajaId !== "SIN_CAJA").length, 0),
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
