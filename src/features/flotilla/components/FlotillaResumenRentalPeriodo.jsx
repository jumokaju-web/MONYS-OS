import { useCallback, useEffect, useMemo, useState } from "react";
import { calcularResumenRentalPeriodo } from "../utils/operacionFlotilla";
import { obtenerOperacionRentalPeriodo } from "./services/operacionFlotilla";

function hoyMexico() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Mexico_City" }).format(new Date());
}

function lunesDeSemana(fecha) {
  const valor = new Date(`${fecha}T12:00:00Z`);
  const dia = valor.getUTCDay() || 7;
  valor.setUTCDate(valor.getUTCDate() - dia + 1);
  return valor.toISOString().slice(0, 10);
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
  const [desde, setDesde] = useState(() => lunesDeSemana(hoy));
  const [hasta, setHasta] = useState(hoy);
  const [datos, setDatos] = useState({ operaciones: [], cortes: [] });
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState("");

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
    () => calcularResumenRentalPeriodo(datos.operaciones, datos.cortes),
    [datos]
  );

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
    </div>

    {error && <p role="alert" style={{ color: "#a02e2e", fontWeight: 800 }}>{error}</p>}
    {!error && !cargando && resumen.rutas === 0 && <p style={{ color: "#557063" }}>No hay rutas Rental registradas en este periodo.</p>}

    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(130px,1fr))", gap: 8, marginTop: 11 }}>
      {[
        ["Ingreso", resumen.ingreso],
        ["Ganado choferes", resumen.pagoChoferes],
        ["Adelantos pagados", resumen.adelantosEntregados],
        ["Falta pagar", resumen.saldoPorPagar],
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
          <span style={{ alignSelf: "start", padding: "4px 8px", borderRadius: 999, fontSize: 10, fontWeight: 900, background: chofer.estado === "PENDIENTE" ? "#fff4df" : chofer.estado === "ADELANTO_MAYOR" ? "#ffe7df" : "#e7f7ed", color: chofer.estado === "PENDIENTE" ? "#76551b" : chofer.estado === "ADELANTO_MAYOR" ? "#8a2e1b" : "#17643a" }}>{chofer.estado === "PENDIENTE" ? "PENDIENTE POR LIQUIDAR" : chofer.estado === "ADELANTO_MAYOR" ? "ADELANTO MAYOR A LO GANADO" : "CUBIERTO CON ADELANTOS"}</span>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(105px,1fr))", gap: 7, marginTop: 9 }}>
          <div><small>Ganó</small><b style={{ display: "block" }}>{moneda(chofer.ganado)}</b></div>
          <div><small>Adelantado</small><b style={{ display: "block" }}>{moneda(chofer.adelantos)}</b></div>
          <div><small>Falta pagar</small><b style={{ display: "block", color: "#08734f" }}>{moneda(chofer.saldoPorPagar)}</b></div>
          <div><small>Gas pagada por él</small><b style={{ display: "block" }}>{moneda(chofer.gasolinaChofer)}</b></div>
        </div>
        {(chofer.ambulanciasFavor > 0 || chofer.ambulanciasDescuento > 0) && <small style={{ display: "block", marginTop: 7, color: "#76551b" }}>Ambulancias a favor: {moneda(chofer.ambulanciasFavor)} · descontadas: {moneda(chofer.ambulanciasDescuento)}</small>}
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

    {resumen.hayPerdida ? <p role="status" style={{ color: "#a02e2e", fontWeight: 900 }}>El periodo tiene pérdida neta; no se genera reparto.</p> : <div style={{ display: "grid", gridTemplateColumns: "repeat(3,minmax(0,1fr))", gap: 8, marginTop: 12 }}>
      {resumen.socios.map((socio) => <div key={socio} style={tarjeta}><small>{socio}</small><strong style={{ display: "block", color: "#08734f" }}>{moneda(resumen.repartoSocios[socio])}</strong></div>)}
    </div>}
    <p style={{ marginBottom: 0, color: "#557063", fontSize: 11 }}>Este corte suma las rutas y los cierres diarios guardados dentro del periodo. Los adelantos disminuyen lo pendiente del chofer, pero no reducen dos veces la utilidad.</p>
  </section>;
}
