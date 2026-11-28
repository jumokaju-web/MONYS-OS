import React, { useState } from "react";
import "./QueHacerHoyV2.css";

const money = new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" });
const labels = { ventas: "Ventas", inventario: "Inventario", finanzas: "Finanzas", datos: "Datos" };
function period(p) {
  return p?.tipo === "mensual" ? p.mes || "Mensual" : p?.tipo === "dias" ? `${p.dias} días` : "Periodo pendiente";
}
function Decision({ item, onReview }) {
  const i = item.impacto;
  const known = Number.isFinite(i?.importe);
  return <article className="qh-card">
    <small>{item.alcance?.nombre} · {labels[item.categoria] || item.categoria}</small>
    <h3>{item.titulo}</h3>
    <strong className="qh-amount">{known ? money.format(i.importe) : "Pendiente"}</strong>
    <small>{i?.medida} · {period(i?.periodo)} · {known ? "Estimado" : "Pendiente"} · Confianza {item.confianza || "pendiente"}</small>
    <p>{item.motivo}</p>
    {Number.isFinite(item.ventasAsociadas) && <p>Ventas asociadas (no utilidad): {money.format(item.ventasAsociadas)}</p>}
    {(item.alternativaDe || item.duplicadoDe) && <p>{item.duplicadoDe ? "Ya incluida" : "Alternativa"}: {item.motivoNoSumar}</p>}
    <details><summary>Evidencia y datos pendientes</summary><p>{typeof item.evidencia === "string" ? item.evidencia : "Consultar fuente de la recomendación."}</p><ul>{(item.faltantes || []).map((f, n) => <li key={n}>{typeof f === "string" ? f : f?.motivo || "Dato pendiente"}</li>)}</ul></details>
    <button type="button" disabled={!onReview || !item.accion?.destino} onClick={() => onReview?.(item.accion)}>Revisar</button>
  </article>;
}
export default function QueHacerHoyV2({ tablero, loading = false, onReview }) {
  const [filter, setFilter] = useState("todas");
  const q = tablero?.queHacerHoy;
  if (loading) return <p role="status">Cargando decisiones…</p>;
  if (!q || tablero?.estado === "sin_contexto") return <p role="status">Información pendiente. {tablero?.motivo}</p>;
  const section = (title, items) => <section><h2>{title}</h2>{items?.length ? items.map(item => <Decision key={item.id} item={item} onReview={onReview}/>) : <p>No hay recomendaciones disponibles en esta sección.</p>}</section>;
  return <div className="qh-root">
    <header><small>MONYS OS · Dirección</small><h1>Qué hacer hoy</h1></header>
    {!!tablero.errores?.length && <p role="status">Información parcial: algunas fuentes no pudieron consultarse.</p>}
    {section("Urgencias de liquidez", q.urgenciasLiquidez)}
    {section("Tus prioridades", q.prioridades?.slice(0, 3))}
    <section><h2>Impactos por medida y periodo</h2><p>Consulta cada impacto por separado; no se suman ventas, utilidad y efectivo.</p></section>
    <label>Explorar recomendaciones<select value={filter} onChange={e => setFilter(e.target.value)}><option value="todas">Todas</option>{Object.entries(labels).map(([key,label]) => <option key={key} value={key}>{label}</option>)}</select></label>
    {section("Otras recomendaciones", (filter === "todas" ? q.todas : q.porCategoria?.[filter])?.filter(a => ![...(q.prioridades || []), ...(q.urgenciasLiquidez || []), ...(q.calidadDatos || [])].some(b => b.id === a.id)))}
    {section("Calidad de datos", q.calidadDatos)}
  </div>;
}
