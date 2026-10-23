const PENDIENTE_REVISION = "Pendiente de revisión";

function numeroONulo(valor) {
  if (valor === null || valor === undefined || String(valor).trim() === "") return null;
  const numero = Number(valor);
  return Number.isFinite(numero) ? numero : null;
}

function diasDesde(fecha) {
  if (!fecha) return null;
  const valor = new Date(`${String(fecha).slice(0, 10)}T12:00:00`);
  if (Number.isNaN(valor.getTime())) return null;
  return Math.max(0, Math.floor((Date.now() - valor.getTime()) / 86400000));
}

export function resumirCentroDecisionesFinancieras({ movimientos = [], creditosProveedores = {}, datosDashboard = {}, sucursalesDashboard = [] } = {}) {
  const listaMovimientos = Array.isArray(movimientos) ? movimientos : [];
  const pendientes = listaMovimientos.filter((movimiento) => String(movimiento?.estado || movimiento?.status || "") === PENDIENTE_REVISION);
  const cancelados = listaMovimientos.filter((movimiento) => String(movimiento?.estado || movimiento?.status || "") === "Cancelado").length;
  const metricas = datosDashboard?.metricas || {};
  const consolidacion = consolidarFinanzasSucursales(Array.isArray(sucursalesDashboard) ? sucursalesDashboard : []);
  const fechaFinal = consolidacion.disponible ? consolidacion.fechaFinal : metricas.fechaFinal || null;
  const antiguedadVentas = diasDesde(fechaFinal);
  const ventas = consolidacion.disponible ? numeroONulo(consolidacion.ventas) : numeroONulo(metricas.ventasTotales);
  const utilidad = consolidacion.disponible ? numeroONulo(consolidacion.utilidad) : numeroONulo(metricas.utilidadTotal);
  const saldoProveedores = creditosProveedores?.importacion ? numeroONulo(creditosProveedores?.saldoTotal) : null;
  const sucursales = Array.isArray(sucursalesDashboard) ? sucursalesDashboard.length : 0;

  let prioridad;
  if (pendientes.length > 0) {
    prioridad = { nivel: "alta", etiqueta: "ACCIÓN DE HOY", titulo: `Resolver ${pendientes.length} ${pendientes.length === 1 ? "movimiento pendiente" : "movimientos pendientes"}`, detalle: "Mientras no estén clasificados y revisados, MONYS no debe tratarlos como una base financiera cerrada.", accion: "Abrir movimientos", destino: "control", evidencia: `REAL · ${listaMovimientos.length} movimientos consultados` };
  } else if (!creditosProveedores?.importacion) {
    prioridad = { nivel: "alta", etiqueta: "DATO FALTANTE", titulo: "Cargar los saldos de proveedores", detalle: "Sin obligaciones actualizadas no es seguro decidir cuánto dinero está libre para comprar o pagar.", accion: "Cargar reporte", destino: "importador", evidencia: "PENDIENTE · no hay importación vigente de proveedores" };
  } else if (antiguedadVentas === null || antiguedadVentas > 7) {
    prioridad = { nivel: "media", etiqueta: "ACTUALIZAR BASE", titulo: "Actualizar las ventas de SICAR", detalle: antiguedadVentas === null ? "La fecha del último corte no está confirmada." : `El último corte disponible tiene ${antiguedadVentas} días de antigüedad.`, accion: "Subir reportes", destino: "importador", evidencia: fechaFinal ? `REAL · último corte ${fechaFinal}` : "PENDIENTE · fecha de corte no disponible" };
  } else {
    prioridad = { nivel: "bien", etiqueta: "SIGUIENTE DECISIÓN", titulo: "Confirmar cuánto dinero puedes usar hoy", detalle: "Revisa bancos, cajas y compromisos próximos antes de autorizar compras o pagos.", accion: "Calcular disponibilidad", destino: "disponible", evidencia: "REAL · movimientos y reportes principales sin bloqueo inmediato" };
  }

  return { prioridad, pendientes: pendientes.length, revisados: Math.max(0, listaMovimientos.length - pendientes.length - cancelados), totalMovimientos: listaMovimientos.length, ventas, utilidad, saldoProveedores, fechaFinal, antiguedadVentas, sucursales, alcanceVentas: consolidacion.disponible ? "Todas las sucursales · cortes comparables" : "Corte disponible · sin consolidar" };
}
import { consolidarFinanzasSucursales } from "../../inteligencia/shared/resumenSucursalesFinanciero.js";

