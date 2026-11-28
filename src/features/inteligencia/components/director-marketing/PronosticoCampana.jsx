import { useState } from "react";
import { historialCampanasConfirmadas } from "../../shared/resumenResultadosGrowth";
import { ESTADOS_IMPACTO, pronosticarCampana } from "../../../../core/impacto/motorImpactoDinero.js";
import "../../../dashboard/components/ImpactoDineroHoy.css";

const dinero = (valor) =>
  new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN", maximumFractionDigits: 0 }).format(Number(valor) || 0);

export default function PronosticoCampana({ campanas = [], margenPorcentaje = null, producto = "" }) {
  const margenInicial = Number(margenPorcentaje);
  const [presupuesto, setPresupuesto] = useState("500");
  const [margen, setMargen] = useState(
    Number.isFinite(margenInicial) && margenInicial > 0 ? String(Math.round(margenInicial * 10) / 10) : ""
  );

  const historial = historialCampanasConfirmadas(campanas);
  const margenDecimal = margen === "" ? null : Number(margen) / 100;
  const pronostico = pronosticarCampana({ presupuesto, margenBruto: margenDecimal, historial });
  const conPronostico = pronostico.estado !== ESTADOS_IMPACTO.FALTAN_DATOS;

  return (
    <section className="impacto-dinero" aria-labelledby="pronostico-campana-titulo">
      <header>
        <span>ANTES DE INVERTIR</span>
        <h3 id="pronostico-campana-titulo">¿Cuánto ganarías con esta campaña?</h3>
      </header>
      {producto && <p className="impacto-dinero__nota">Producto sugerido: {producto}</p>}

      <div className="impacto-dinero__campos">
        <label className="impacto-dinero__campo">
          <span>Presupuesto de publicidad</span>
          <input type="number" inputMode="decimal" min="0" value={presupuesto} onChange={(evento) => setPresupuesto(evento.target.value)} />
        </label>
        <label className="impacto-dinero__campo">
          <span>Margen del producto (%)</span>
          <input type="number" inputMode="decimal" min="0" max="99" value={margen} onChange={(evento) => setMargen(evento.target.value)} placeholder="Ej. 40" />
        </label>
      </div>

      {pronostico.roasEquilibrio && (
        <p className="impacto-dinero__nota">
          Para no perder, cada peso de publicidad debe vender al menos {pronostico.roasEquilibrio} pesos
          {Number(presupuesto) > 0 ? ` (${dinero(Number(presupuesto) * pronostico.roasEquilibrio)} con este presupuesto)` : ""}.
        </p>
      )}

      {conPronostico ? (
        <div className="impacto-dinero__resultado">
          <strong className={pronostico.ganancia > 0 ? "" : "impacto-dinero__negativo"}>
            {pronostico.ganancia > 0 ? "Ganarías" : "Perderías"} {dinero(Math.abs(pronostico.ganancia))}
          </strong>
          <span>Venta esperada: {dinero(pronostico.ventasEsperadas)}</span>
          <ul>
            {pronostico.supuestos.map((supuesto) => <li key={supuesto}>{supuesto}</li>)}
          </ul>
        </div>
      ) : (
        <p className="impacto-dinero__nota">
          {historial.length === 0
            ? "Aún no hay campañas con venta y gasto confirmados. Registra los resultados de la primera prueba para que MONYS pronostique las siguientes."
            : `Falta: ${pronostico.faltantes.join(", ")}.`}
        </p>
      )}
    </section>
  );
}
