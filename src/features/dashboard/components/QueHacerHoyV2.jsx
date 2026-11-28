import React, { useState } from "react";
import "./QueHacerHoyV2.css";

const money = new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" });
const labels = { ventas: "Ventas", inventario: "Inventario", finanzas: "Finanzas", datos: "Datos" };
const destinations = new Set(["finanzas/estado-resultados","finanzas/venta-necesaria","finanzas/deudas","tesoreria/obligaciones","tesoreria/movimientos","tesoreria/clasificar","tesoreria/conciliar","canales/precio-minimo","canales/rentabilidad","canales/cancelaciones","inventario/costos","inventario/traspasos","inventario/compras","ventas/sucursal","dashboard"]);
const measures = { utilidad_operativa:"Utilidad operativa", utilidad_bruta:"Utilidad bruta", gasto_evitado:"Gasto que puedes evitar", efectivo_por_pagar:"Efectivo por pagar", deficit_efectivo:"Efectivo que te faltaría", intereses_evitados:"Intereses que evitas" };
const measure = m => m == null ? "Riesgo sin importe" : measures[m] || "Impacto por revisar";
const groups = { urgencia_liquidez:"Urgencias de liquidez", oportunidad:"Oportunidades", calidad_datos:"Calidad de datos" };
function period(p) {
  return p?.tipo === "mensual" ? p.mes || "Mensual" : p?.tipo === "dias" ? `${p.dias} días${p.desde ? " desde " + p.desde : ""}` : "Periodo pendiente";
}
function Decision({ item, onReview, all }) {
  const i = item.impacto;
  const known = Number.isFinite(i?.importe) && i?.estado !== "pendiente";
  const principal = all.find(a => a.id === (item.duplicadoDe || item.alternativaDe));
  const allowed = destinations.has(item.accion?.destino);
  const secondary = !!(item.alternativaDe || item.duplicadoDe);
  return <article className="qh-card">
    <small>{item.alcance?.nombre} · {labels[item.categoria] || item.categoria}</small>
    <h3>{item.titulo}</h3>
    <strong className={secondary ? "qh-secondary-amount" : "qh-amount"}>{known ? money.format(i.importe) : "Pendiente"}</strong>
    <small>{measure(i?.medida)} · {period(i?.periodo)} · {known && i?.estado === "estimado" ? "Estimado" : "Pendiente"} · Confianza {item.confianza || "pendiente"}</small>
    {!known && item.faltantes?.[0] && <p>{item.faltantes[0]}</p>}
    <p>{item.motivo}</p>
    {Number.isFinite(item.ventasAsociadas) && <p>{item.origen === "equilibrio" ? "Venta adicional que necesitarías este mes" : item.tipoImpacto === "recuperacion_ventas" ? "Venta perdida contra el mes anterior" : "Ventas asociadas (no utilidad)"}: {money.format(item.ventasAsociadas)}</p>}
    {(item.alternativaDe || item.duplicadoDe) && <p>{item.duplicadoDe ? "Ya incluida" : "Alternativa"}: {principal?.titulo ? principal.titulo + " · " : ""}{item.motivoNoSumar}</p>}
    <details><summary>Evidencia y datos pendientes</summary><p>{typeof item.evidencia === "string" && item.evidencia.trim() ? item.evidencia : "Sin evidencia registrada"}</p><ul>{(item.faltantes || []).map((f, n) => <li key={n}>{typeof f === "string" ? f : f?.motivo || "Dato pendiente"}</li>)}</ul></details>
    <p>{item.accion?.texto}</p>
    <button type="button" disabled={!onReview || !allowed} onClick={() => { if (allowed) onReview?.(item.accion); }}>Revisar</button>
  </article>;
}
export default function QueHacerHoyV2({ tablero, loading = false, onReview }) {
  const [filter, setFilter] = useState("todas");
  const q = tablero?.queHacerHoy;
  if (loading) return <p role="status">Cargando decisiones…</p>;
  if (!q || tablero?.estado === "sin_contexto") return <p role="status">Información pendiente. {tablero?.motivo}</p>;
  const section = (title, items) => <section><h2>{title}</h2>{items?.length ? items.map(item => <Decision key={item.id} item={item} onReview={onReview} all={q.todas || []}/>) : <p>No hay recomendaciones disponibles en esta sección.</p>}</section>;
  return <div className="qh-root">
    <header><small>MONYS OS · Dirección</small><h1>Qué hacer hoy</h1></header>
    {!!tablero.errores?.length && <p role="status">Información parcial: algunas fuentes no pudieron consultarse.</p>}
    {section("Urgencias de liquidez", q.urgenciasLiquidez)}
    {section("Tus prioridades", q.prioridades?.slice(0, 3))}
    <section><h2>Impactos por medida y periodo</h2>{(q.totales || []).map((t,n) => <article className="qh-card" key={n}><small>{groups[t.grupo] || "Impacto"} · {measure(t.medida)} · {period(t.periodo)}</small><strong>{Number.isFinite(t.importe) ? money.format(t.importe) : "Pendiente"}</strong><small>Estimación · {t.cuantas} recomendaciones</small></article>)}<p>{q.nota || "Consulta cada impacto por separado; no se suman ventas, utilidad y efectivo."}</p></section>
    <label>Explorar recomendaciones<select value={filter} onChange={e => setFilter(e.target.value)}><option value="todas">Todas</option>{Object.entries(labels).map(([key,label]) => <option key={key} value={key}>{label}</option>)}</select></label>
    {section("Otras recomendaciones", (filter === "todas" ? [...(q.todas || [])].sort((a,b) => (b.impacto?.importe ?? -Infinity) - (a.impacto?.importe ?? -Infinity)) : q.porCategoria?.[filter])?.filter(a => ![...(q.prioridades || []), ...(q.urgenciasLiquidez || []), ...(q.calidadDatos || [])].some(b => b.id === a.id)))}
    {section("Calidad de datos", q.calidadDatos)}
  </div>;
}
