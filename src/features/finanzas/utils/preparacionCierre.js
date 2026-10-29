import { consolidarFinanzasSucursales } from "../../inteligencia/shared/resumenSucursalesFinanciero.js";
import { validarCicloLunesDomingo } from "../../inteligencia/utils/cicloFinancieroSemanal.js";
import { fechaOperacionFinanciera } from "../../tesoreria/utils/fechaOperacionFinanciera.js";

export function prepararRutaCierre({ sucursales = [], movimientos, cargandoMovimientos = false, errorMovimientos = false,
  expediente = null, estadoExpediente = "pendiente", negocioEncontrado = false } = {}) {
  const consolidacion = consolidarFinanzasSucursales(sucursales);
  const semana = consolidacion.disponible && sucursales.length >= 2
    && validarCicloLunesDomingo(consolidacion.fechaInicial, consolidacion.fechaFinal).valido;
  const desde = semana ? consolidacion.fechaInicial : null;
  const hasta = semana ? consolidacion.fechaFinal : null;
  const movimientosConsultados = Array.isArray(movimientos) && !cargandoMovimientos && !errorMovimientos;
  const filas = movimientosConsultados ? movimientos.filter((m) => {
    const fecha = fechaOperacionFinanciera(m.fecha ?? m.occurred_at);
    return desde && hasta && fecha && fecha >= desde && fecha <= hasta;
  }) : [];
  const normalizar = (v) => String(v || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  const pendientes = semana && movimientosConsultados
    ? filas.filter((m) => normalizar(m.estado ?? m.status) === "pendiente de revision").length : null;
  const sinFecha = movimientosConsultados
    ? movimientos.filter((m) => !fechaOperacionFinanciera(m.fecha ?? m.occurred_at)).length : null;
  const evidenciaConsultada = semana && estadoExpediente === "consultado" && negocioEncontrado && expediente?.periodoValido
    && expediente.desde === desde && expediente.hasta === hasta;
  const banco = evidenciaConsultada ? expediente.banco : null;
  const bancoIncluyeCorte = Boolean(banco?.revisionId && banco.desdeObservado && banco.hastaObservado
    && banco.desdeObservado <= desde && banco.hastaObservado >= hasta);
  const cobros = evidenciaConsultada ? expediente.cobros : null;
  return {
    desde, hasta, semanaValida: Boolean(semana), motivo: consolidacion.motivo || "Confirma que ambas tiendas tengan el mismo corte de lunes a domingo.",
    pendientes, sinFecha, movimientosConsultados,
    pasos: [
      { id: "tiendas", titulo: "Ventas y utilidad de las tiendas", estado: semana ? "CARGADO" : "PENDIENTE",
        detalle: semana ? `${sucursales.length} sucursales con corte comparable del ${desde} al ${hasta}.` : "Alinea ventas y utilidad de ambas tiendas en la misma semana.", destino: "plan", vista: "panorama", accion: "Revisar resultados" },
      { id: "banco", titulo: "Banco del corte", estado: !evidenciaConsultada ? "POR_CONSULTAR" : bancoIncluyeCorte ? "REVISAR" : "PENDIENTE",
        detalle: !evidenciaConsultada ? "La evidencia bancaria todavía no está confirmada."
          : banco?.revisionId ? `Movimientos observados: ${banco.desdeObservado || "sin fecha"} al ${banco.hastaObservado || "sin fecha"}. ${bancoIncluyeCorte ? "Revisa que incluya todas las cuentas y movimientos." : "No muestran todo el corte seleccionado; incorpora los movimientos que faltan."}`
            : "No hay una revisión bancaria guardada en este negocio y sucursal. Incorpora los movimientos del corte.", destino: "bancos", accion: "Cargar o revisar banco" },
      { id: "flotilla", titulo: "Cobros de Flotilla", estado: !cobros ? "POR_CONSULTAR" : cobros.pendientes > 0 || cobros.fechasPendientes > 0 || cobros.importesPendientes > 0 ? "PENDIENTE" : "REVISAR",
        detalle: !cobros ? "Consulta facturas, fecha de cobro y sus enlaces antes de decidir."
          : `${cobros.cantidad} cobros reportados en la semana; ${cobros.pendientes} pendientes de enlace comprobable. No se suman como un ingreso adicional.`, destino: "plan", vista: "cierre", accion: "Ver expediente de cobros" },
      { id: "movimientos", titulo: "Movimientos y gastos", estado: pendientes === null ? "POR_CONSULTAR" : pendientes > 0 || sinFecha > 0 ? "PENDIENTE" : "REVISAR",
        detalle: pendientes === null ? "No se ha confirmado la consulta de los movimientos de esta semana."
          : `${pendientes} movimientos pendientes dentro del corte.${sinFecha > 0 ? ` Hay además ${sinFecha} registros sin fecha para revisar.` : ""} Confirma también los gastos externos y compromisos; cero pendientes no significa cierre completo.`, destino: "control", accion: "Revisar movimientos" },
    ],
  };
}
