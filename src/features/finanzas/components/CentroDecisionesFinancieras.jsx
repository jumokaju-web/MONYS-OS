import { useMemo } from "react";
import { resumirCentroDecisionesFinancieras } from "../utils/centroDecisionesFinancieras";
import "./CentroDecisionesFinancieras.css";

const moneda = new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN", maximumFractionDigits: 0 });

function Dato({ etiqueta, valor, detalle, estado = "REAL" }) {
  return <article className="finanzas-decision__dato"><span>{estado}</span><strong>{valor}</strong><b>{etiqueta}</b><small>{detalle}</small></article>;
}

export default function CentroDecisionesFinancieras({ movimientos, creditosProveedores, datosDashboard, sucursalesDashboard, onAbrirArea, onAbrirImportador }) {
  const resumen = useMemo(() => resumirCentroDecisionesFinancieras({ movimientos, creditosProveedores, datosDashboard, sucursalesDashboard }), [movimientos, creditosProveedores, datosDashboard, sucursalesDashboard]);
  const ejecutarPrioridad = () => {
    if (resumen.prioridad.destino === "importador") onAbrirImportador?.();
    else if (resumen.prioridad.destino === "disponible") onAbrirArea?.("equipo", "disponible");
    else onAbrirArea?.(resumen.prioridad.destino);
  };

  return <section className="finanzas-decision" aria-labelledby="finanzas-decision-titulo">
    <header className="finanzas-decision__encabezado"><div><span>DIRECCIÓN FINANCIERA · HOY</span><h2 id="finanzas-decision-titulo">Qué hacer y hacia dónde mover el negocio</h2><p>Primero resuelve el bloqueo principal. Después revisa efectivo, resultados y plan.</p></div><button type="button" onClick={() => onAbrirArea?.("plan", "hoy")}>Ver análisis CEO →</button></header>
    <article className={`finanzas-decision__prioridad es-${resumen.prioridad.nivel}`}><div><span>{resumen.prioridad.etiqueta}</span><h3>{resumen.prioridad.titulo}</h3><p>{resumen.prioridad.detalle}</p><small>{resumen.prioridad.evidencia}</small></div><button type="button" onClick={ejecutarPrioridad}>{resumen.prioridad.accion} →</button></article>
    <div className="finanzas-decision__datos" aria-label="Resumen financiero disponible">
      <Dato etiqueta="Movimientos por resolver" valor={resumen.pendientes} detalle={`${resumen.totalMovimientos} movimientos registrados`} />
      <Dato etiqueta="Ventas del corte" valor={resumen.ventas === null ? "Por confirmar" : moneda.format(resumen.ventas)} detalle={resumen.fechaFinal ? `${resumen.alcanceVentas} · al ${resumen.fechaFinal}` : "Falta fecha de corte"} estado={resumen.ventas === null ? "PENDIENTE" : "REAL"} />
      <Dato etiqueta="Utilidad bruta del corte" valor={resumen.utilidad === null ? "Por confirmar" : moneda.format(resumen.utilidad)} detalle="No descuenta todos los gastos hasta conciliarlos" estado={resumen.utilidad === null ? "PENDIENTE" : "REAL"} />
      <Dato etiqueta="Saldo a proveedores" valor={resumen.saldoProveedores === null ? "Por confirmar" : moneda.format(resumen.saldoProveedores)} detalle="Según el último reporte importado" estado={resumen.saldoProveedores === null ? "PENDIENTE" : "REAL"} />
    </div>
    <section className="finanzas-decision__rutas" aria-label="Rutas de decisión">
      <button type="button" onClick={() => onAbrirArea?.("equipo", "disponible")}><span>💵</span><b>Dinero disponible</b><small>Bancos, cajas y compromisos</small></button>
      <button type="button" onClick={() => onAbrirArea?.("control")}><span>🧾</span><b>Resolver movimientos</b><small>{resumen.pendientes} pendientes de revisión</small></button>
      <button type="button" onClick={() => onAbrirArea?.("plan", "panorama")}><span>📊</span><b>Resultados</b><small>Ventas, utilidad y tendencia</small></button>
      <button type="button" onClick={() => onAbrirArea?.("plan", "rescate")}><span>🛟</span><b>Plan de rescate</b><small>Prioridades de los próximos 30 días</small></button>
    </section>
    <p className="finanzas-decision__regla"><b>Regla de Dirección:</b> ventas y utilidad provienen del corte disponible; no significan efectivo libre. El dinero utilizable solo se libera después de confirmar bancos, cajas y obligaciones.</p>
  </section>;
}
