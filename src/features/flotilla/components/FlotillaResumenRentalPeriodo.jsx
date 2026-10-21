import { useCallback, useEffect, useMemo, useState } from "react";
import { calcularResumenRentalPeriodo, crearFilasReporteRental } from "../utils/operacionFlotilla";
import {
  anularLiquidacionRental,
  anularRepartoRental,
  guardarLiquidacionRental,
  guardarRepartoRental,
  obtenerOperacionRentalPeriodo,
} from "./services/operacionFlotilla";
import { evaluarCierreSemanal, periodoPrefacturaSugerido, semanaOperativa } from "../utils/cierreSemanalFlotilla";

function hoyMexico() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Mexico_City" }).format(new Date());
}

function moneda(valor) {
  return new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" }).format(Number(valor) || 0);
}

function fechaCorta(fecha) {
  return new Intl.DateTimeFormat("es-MX", { day: "2-digit", month: "short" }).format(new Date(`${fecha}T12:00:00Z`));
}

const tarjeta = {
  background: "#fff",
  border: "1px solid #d7e8dc",
  borderRadius: 14,
  padding: 12,
};

export default function FlotillaResumenRentalPeriodo() {
  const hoy = useMemo(hoyMexico, []);
  const sugerido = useMemo(() => periodoPrefacturaSugerido(hoy), [hoy]);
  const [desde, setDesde] = useState(sugerido.desde);
  const [hasta, setHasta] = useState(sugerido.hasta);
  const [datos, setDatos] = useState({ operaciones: [], rutasPendientes: [], duplicadasIgnoradas: [], cortes: [], liquidaciones: [], repartos: [] });
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState("");
  const [guardandoPago, setGuardandoPago] = useState("");
  const [guardandoReparto, setGuardandoReparto] = useState("");
  const [anulando, setAnulando] = useState("");

  const cargar = useCallback(async () => {
    try {
      setCargando(true);
      setError("");
      setDatos(await obtenerOperacionRentalPeriodo(desde, hasta));
    } catch (errorConsulta) {
      setError(errorConsulta?.message || "No fue posible preparar el corte de Rental.");
    } finally {
      setCargando(false);
    }
  }, [desde, hasta]);

  useEffect(() => { cargar(); }, [cargar]);

  const resumen = useMemo(
    () => calcularResumenRentalPeriodo(datos.operaciones, datos.cortes, datos.liquidaciones, datos.repartos),
    [datos]
  );
  const cierre = useMemo(() => evaluarCierreSemanal(
    [...datos.operaciones, ...(datos.rutasPendientes || [])],
    { desde, hasta },
    hoy
  ), [datos.operaciones, datos.rutasPendientes, desde, hasta, hoy]);

  function elegirPeriodo(periodo) {
    setDesde(periodo.desde);
    setHasta(periodo.hasta);
  }

  async function registrarPago(chofer) {
    if (!cierre.listaParaRevision) return setError("Cierra todas las rutas y usa una semana completa antes de registrar pagos Rental.");
    const confirmado = window.confirm(`Confirma únicamente si ya pagaste ${moneda(chofer.saldoPorPagar)} a ${chofer.chofer}. MONYS registrará el pago, pero no hará una transferencia bancaria.`);
    if (!confirmado) return;
    try {
      setGuardandoPago(`${chofer.chofer}::${chofer.placas}`);
      setError("");
      await guardarLiquidacionRental({ desde, hasta, chofer });
      await cargar();
    } catch (errorPago) {
      setError(errorPago?.message || "No fue posible registrar la liquidación.");
    } finally {
      setGuardandoPago("");
    }
  }

  async function anularPago(chofer) {
    const motivo = window.prompt(`Escribe por qué se anula el pago registrado de ${chofer.chofer}. El registro anterior se conservará en el historial.`);
    if (!String(motivo || "").trim()) return;
    if (!window.confirm("Confirma la anulación. Después podrás registrar la liquidación correcta.")) return;
    try {
      setAnulando(`liquidacion:${chofer.liquidacionId}`);
      setError("");
      await anularLiquidacionRental({ liquidacionId: chofer.liquidacionId, motivo });
      await cargar();
    } catch (errorAnulacion) {
      setError(errorAnulacion?.message || "No fue posible anular la liquidación.");
    } finally {
      setAnulando("");
    }
  }

  async function registrarReparto(socio) {
    if (!cierre.listaParaRevision) return setError("Cierra todas las rutas y revisa la semana antes de repartir utilidad Rental.");
    const monto = resumen.repartoSocios[socio];
    if (!window.confirm(`Confirma únicamente si ya entregaste ${moneda(monto)} a ${socio}. MONYS guardará la entrega, pero no hará una transferencia.`)) return;
    try {
      setGuardandoReparto(socio);
      setError("");
      await guardarRepartoRental({ desde, hasta, socio, resumen });
      await cargar();
    } catch (errorReparto) {
      setError(errorReparto?.message || "No fue posible registrar la entrega al socio.");
    } finally {
      setGuardandoReparto("");
    }
  }

  async function anularReparto(socio) {
    const motivo = window.prompt(`Escribe por qué se anula la entrega registrada a ${socio.socio}. El registro anterior se conservará.`);
    if (!String(motivo || "").trim()) return;
    if (!window.confirm("Confirma la anulación de esta entrega.")) return;
    try {
      setAnulando(`reparto:${socio.repartoId}`);
      setError("");
      await anularRepartoRental({ repartoId: socio.repartoId, motivo });
      await cargar();
    } catch (errorAnulacion) {
      setError(errorAnulacion?.message || "No fue posible anular la entrega.");
    } finally {
      setAnulando("");
    }
  }

  async function descargarExcel() {
    try {
      const XLSX = await import("xlsx");
      const filas = crearFilasReporteRental({ desde, hasta, resumen });
      const libro = XLSX.utils.book_new();
      Object.entries({ Corte: filas.corte, Choferes: filas.choferes, Socios: filas.socios, Dias: filas.dias }).forEach(([nombre, registros]) => {
        const hoja = XLSX.utils.json_to_sheet(registros);
        XLSX.utils.book_append_sheet(libro, hoja, nombre);
      });
      XLSX.writeFile(libro, `Flotilla_Rental_${desde}_${hasta}.xlsx`);
    } catch {
      setError("No fue posible generar el reporte de Excel.");
    }
  }

  return <section style={{ ...tarjeta, marginTop: 16, background: "linear-gradient(145deg,#fbfffc,#edf9f1)", borderColor: "#acd5b9" }}>
    <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
      <div>
        <small style={{ color: "#237345", fontWeight: 900 }}>CORTE RENTAL POR PERIODO</small>
        <h3 style={{ margin: "4px 0" }}>Lo ganado, adelantado y pendiente</h3>
      </div>
      <b>{resumen.rutas} rutas · {resumen.rutasSmall} Small · {resumen.rutasLarge} Large</b>
    </div>

    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(145px,1fr))", gap: 8, marginTop: 10, alignItems: "end" }}>
      <label style={{ fontSize: 11, fontWeight: 800 }}>Desde<input type="date" value={desde} max={hasta} onChange={(e) => setDesde(e.target.value)} style={{ width: "100%", marginTop: 4, padding: 8, borderRadius: 8, border: "1px solid #acd5b9" }} /></label>
      <label style={{ fontSize: 11, fontWeight: 800 }}>Hasta<input type="date" value={hasta} min={desde} max={hoy} onChange={(e) => setHasta(e.target.value)} style={{ width: "100%", marginTop: 4, padding: 8, borderRadius: 8, border: "1px solid #acd5b9" }} /></label>
      <button type="button" disabled={cargando || !desde || !hasta || desde > hasta} onClick={cargar} style={{ minHeight: 36 }}>{cargando ? "Calculando…" : "Actualizar corte"}</button>
      <button type="button" disabled={cargando || !cierre.listaParaRevision || resumen.rutas === 0} onClick={descargarExcel} style={{ minHeight: 36 }}>Descargar Excel final</button>
    </div>

    <div style={{ display: "flex", gap: 7, flexWrap: "wrap", marginTop: 8 }}>
      <button type="button" onClick={() => elegirPeriodo(periodoPrefacturaSugerido(hoy))}>Semana por revisar</button>
      <button type="button" onClick={() => elegirPeriodo(semanaOperativa(hoy))}>Ver esta semana</button>
    </div>

    {!cargando && <div role="status" style={{ marginTop: 10, padding: 10, borderRadius: 10, background: cierre.listaParaRevision ? "#e7f7ed" : "#fff4df", color: cierre.listaParaRevision ? "#17643a" : "#76551b", fontWeight: 800 }}>
      {cierre.listaParaRevision
        ? `Rental listo para revisión: ${cierre.rutasFinalizadas} ruta(s) cerrada(s).`
        : cierre.estado === "PENDIENTE_CIERRES"
          ? `Rental provisional: faltan ${cierre.rutasPendientes} ruta(s) por cerrar. Pagos y reparto permanecen bloqueados.`
          : cierre.estado === "SEMANA_EN_CURSO"
            ? "Rental provisional: la semana todavía no termina."
            : cierre.estado === "PERIODO_INCOMPLETO"
              ? "Selecciona una semana completa de lunes a domingo."
              : "No hay rutas Rental cerradas para revisar."}
      {(datos.duplicadasIgnoradas || []).length > 0 && <small style={{ display: "block", marginTop: 4 }}>Se ignoraron {datos.duplicadasIgnoradas.length} reintento(s) duplicado(s).</small>}
    </div>}

    {error && <p role="alert" style={{ color: "#a02e2e", fontWeight: 800 }}>{error}</p>}
    {!error && !cargando && resumen.rutas === 0 && <p style={{ color: "#557063" }}>No hay rutas Rental registradas en este periodo.</p>}

    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(130px,1fr))", gap: 8, marginTop: 11 }}>
      {[
        ["Ingreso", resumen.ingreso],
        ["Ganado choferes", resumen.pagoChoferes],
        ["Adelantos pagados", resumen.adelantosEntregados],
        ["Pendiente liquidar", resumen.pendienteLiquidar],
        ["Pagado registrado", resumen.pagadoLiquidaciones],
        ["Pagos por revisar", resumen.pagosPorRevisar],
        ["Gas empresa", resumen.gasolinaEmpresa],
        ["Otros gastos", resumen.otrosGastos],
        ["Utilidad neta", resumen.utilidadNeta],
      ].map(([label, valor]) => <div key={label} style={tarjeta}><small>{label}</small><strong style={{ display: "block", color: label === "Utilidad neta" && valor < 0 ? "#a02e2e" : undefined }}>{moneda(valor)}</strong></div>)}
    </div>

    {resumen.adelantoExcedente > 0 && <p role="status" style={{ padding: 9, borderRadius: 10, background: "#fff4df", color: "#76551b", fontWeight: 800 }}>Atención: hay {moneda(resumen.adelantoExcedente)} entregados de más respecto a lo ganado en este periodo. Se conserva como saldo a revisar, no como gasto adicional.</p>}

    <h4 style={{ margin: "15px 0 7px" }}>Cuenta por chofer</h4>
    <div style={{ display: "grid", gap: 8 }}>
      {resumen.choferes.map((chofer) => <article key={`${chofer.chofer}-${chofer.placas}`} style={tarjeta}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}>
          <div><b>{chofer.chofer}</b><small style={{ display: "block" }}>{chofer.placas} · {chofer.rutas} rutas</small></div>
          <span style={{ alignSelf: "start", padding: "4px 8px", borderRadius: 999, fontSize: 10, fontWeight: 900, background: ["PENDIENTE", "CAMBIO_POSTERIOR"].includes(chofer.estado) ? "#fff4df" : chofer.estado === "ADELANTO_MAYOR" ? "#ffe7df" : "#e7f7ed", color: ["PENDIENTE", "CAMBIO_POSTERIOR"].includes(chofer.estado) ? "#76551b" : chofer.estado === "ADELANTO_MAYOR" ? "#8a2e1b" : "#17643a" }}>{chofer.estado === "PAGADO" ? `PAGADO · ${moneda(chofer.montoLiquidado)}` : chofer.estado === "CAMBIO_POSTERIOR" ? "REVISAR · CAMBIARON LOS DATOS" : chofer.estado === "PENDIENTE" ? "PENDIENTE POR LIQUIDAR" : chofer.estado === "ADELANTO_MAYOR" ? "ADELANTO MAYOR A LO GANADO" : "CUBIERTO CON ADELANTOS"}</span>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(105px,1fr))", gap: 7, marginTop: 9 }}>
          <div><small>Ganó</small><b style={{ display: "block" }}>{moneda(chofer.ganado)}</b></div>
          <div><small>Adelantado</small><b style={{ display: "block" }}>{moneda(chofer.adelantos)}</b></div>
          <div><small>Falta pagar</small><b style={{ display: "block", color: "#08734f" }}>{moneda(chofer.saldoPorPagar)}</b></div>
          <div><small>Gas pagada por él</small><b style={{ display: "block" }}>{moneda(chofer.gasolinaChofer)}</b></div>
        </div>
        {(chofer.ambulanciasFavor > 0 || chofer.ambulanciasDescuento > 0) && <small style={{ display: "block", marginTop: 7, color: "#76551b" }}>Ambulancias a favor: {moneda(chofer.ambulanciasFavor)} · descontadas: {moneda(chofer.ambulanciasDescuento)}</small>}
        {chofer.estado === "PENDIENTE" && <button type="button" disabled={!cierre.listaParaRevision || guardandoPago === `${chofer.chofer}::${chofer.placas}`} onClick={() => registrarPago(chofer)} style={{ marginTop: 9 }}>{guardandoPago === `${chofer.chofer}::${chofer.placas}` ? "Registrando…" : `Registrar pago realizado · ${moneda(chofer.saldoPorPagar)}`}</button>}
        {chofer.estado === "PAGADO" && chofer.liquidadoEn && <small style={{ display: "block", marginTop: 7, color: "#17643a" }}>Liquidación registrada el {new Intl.DateTimeFormat("es-MX", { dateStyle: "medium", timeStyle: "short", timeZone: "America/Mexico_City" }).format(new Date(chofer.liquidadoEn))}.</small>}
        {chofer.estado === "CAMBIO_POSTERIOR" && <small role="alert" style={{ display: "block", marginTop: 7, color: "#8a2e1b", fontWeight: 800 }}>El pago guardado fue de {moneda(chofer.montoLiquidado)}, pero las rutas o movimientos cambiaron después. Revisa antes de hacer cualquier ajuste.</small>}
        {["PAGADO", "CAMBIO_POSTERIOR"].includes(chofer.estado) && <button type="button" disabled={anulando === `liquidacion:${chofer.liquidacionId}`} onClick={() => anularPago(chofer)} style={{ marginTop: 8, background: "#fff", color: "#8a2e1b", border: "1px solid #e4b7ad" }}>{anulando === `liquidacion:${chofer.liquidacionId}` ? "Anulando…" : "Anular y corregir liquidación"}</button>}
      </article>)}
    </div>

    <h4 style={{ margin: "15px 0 7px" }}>Resultado por día</h4>
    <div style={{ display: "grid", gap: 6 }}>
      {resumen.dias.map((dia) => <div key={dia.fecha} style={{ ...tarjeta, display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(105px,1fr))", gap: 7 }}>
        <div><small>Fecha</small><b style={{ display: "block" }}>{fechaCorta(dia.fecha)}</b></div>
        <div><small>Rutas</small><b style={{ display: "block" }}>{dia.rutas}</b></div>
        <div><small>Ingreso</small><b style={{ display: "block" }}>{moneda(dia.ingreso)}</b></div>
        <div><small>Utilidad</small><b style={{ display: "block", color: dia.utilidadNeta < 0 ? "#a02e2e" : "#08734f" }}>{moneda(dia.utilidadNeta)}</b></div>
      </div>)}
    </div>

    <h4 style={{ margin: "15px 0 7px" }}>Reparto de utilidad</h4>
    {resumen.hayPerdida ? <p role="status" style={{ color: "#a02e2e", fontWeight: 900 }}>El periodo tiene pérdida neta; no se genera reparto.</p> : <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(190px,1fr))", gap: 8, marginTop: 8 }}>
      {resumen.sociosDetalle.map((socio) => <div key={socio.socio} style={tarjeta}>
        <small>{socio.socio}</small><strong style={{ display: "block", color: "#08734f" }}>{moneda(socio.calculado)}</strong>
        <span style={{ display: "inline-block", marginTop: 6, padding: "4px 8px", borderRadius: 999, fontSize: 10, fontWeight: 900, background: socio.estado === "PAGADO" ? "#e7f7ed" : socio.estado === "CAMBIO_POSTERIOR" ? "#ffe7df" : "#fff4df", color: socio.estado === "PAGADO" ? "#17643a" : socio.estado === "CAMBIO_POSTERIOR" ? "#8a2e1b" : "#76551b" }}>{socio.estado === "PAGADO" ? "ENTREGADO" : socio.estado === "CAMBIO_POSTERIOR" ? "REVISAR · CAMBIÓ EL CORTE" : socio.estado === "SIN_REPARTO" ? "SIN UTILIDAD" : "PENDIENTE DE ENTREGA"}</span>
        {socio.estado === "PENDIENTE" && <button type="button" disabled={!cierre.listaParaRevision || guardandoReparto === socio.socio} onClick={() => registrarReparto(socio.socio)} style={{ marginTop: 8 }}>{guardandoReparto === socio.socio ? "Registrando…" : "Registrar entrega realizada"}</button>}
        {["PAGADO", "CAMBIO_POSTERIOR"].includes(socio.estado) && <button type="button" disabled={anulando === `reparto:${socio.repartoId}`} onClick={() => anularReparto(socio)} style={{ marginTop: 8, background: "#fff", color: "#8a2e1b", border: "1px solid #e4b7ad" }}>{anulando === `reparto:${socio.repartoId}` ? "Anulando…" : "Anular y corregir entrega"}</button>}
      </div>)}
    </div>}
    {(datos.liquidaciones.some((item) => item.estado === "ANULADA") || datos.repartos.some((item) => item.estado === "ANULADO")) && <details style={{ marginTop: 12 }}>
      <summary style={{ cursor: "pointer", fontWeight: 900 }}>Historial de anulaciones</summary>
      <div style={{ display: "grid", gap: 6, marginTop: 8 }}>
        {datos.liquidaciones.filter((item) => item.estado === "ANULADA").map((item) => <small key={item.id} style={tarjeta}>Liquidación anulada · {item.chofer_nombre} · {moneda(item.monto_pagado)} · {item.motivo_anulacion}</small>)}
        {datos.repartos.filter((item) => item.estado === "ANULADO").map((item) => <small key={item.id} style={tarjeta}>Entrega anulada · {item.socio} · {moneda(item.monto_entregado)} · {item.motivo_anulacion}</small>)}
      </div>
    </details>}
    <p style={{ marginBottom: 0, color: "#557063", fontSize: 11 }}>Este corte suma las rutas y los cierres diarios guardados dentro del periodo. Los adelantos disminuyen lo pendiente del chofer, pero no reducen dos veces la utilidad. “Registrar pago” solo deja constancia administrativa; MONYS no realiza transferencias bancarias.</p>
  </section>;
}

