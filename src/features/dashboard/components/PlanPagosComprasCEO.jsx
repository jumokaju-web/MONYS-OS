import { useMemo, useState } from "react";
import { construirPlanPagosCompras, simularPlanPagosCompras } from "../utils/planPagosComprasCEO";
import "./PlanPagosComprasCEO.css";

const dinero = new Intl.NumberFormat("es-MX", {
  style: "currency",
  currency: "MXN",
  maximumFractionDigits: 0,
});

const fecha = (valor) => new Intl.DateTimeFormat("es-MX", {
  day: "numeric",
  month: "short",
  timeZone: "UTC",
}).format(new Date(`${valor}T12:00:00Z`));

export default function PlanPagosComprasCEO({
  disponibilidad,
  deudas,
  deudasConsultadas,
  creditosProveedores,
  compraMaestra,
  compraConsultada,
  abrirDirectorFinanciero,
  abrirCompraMaestra,
}) {
  const [horizonte, setHorizonte] = useState("7");
  const [incluirCompra, setIncluirCompra] = useState(false);
  const [reserva, setReserva] = useState("0");
  const plan = useMemo(() => construirPlanPagosCompras({
    disponibilidad,
    deudas,
    deudasConsultadas,
    creditosProveedores,
    compraMaestra,
    compraConsultada,
  }), [compraConsultada, compraMaestra, creditosProveedores, deudas, deudasConsultadas, disponibilidad]);
  const escenario = useMemo(() => simularPlanPagosCompras(plan, {
    horizonte,
    incluirCompra,
    reserva,
  }), [horizonte, incluirCompra, plan, reserva]);

  const prioritarios = plan.programadas.filter((item) => item.dias <= 30).slice(0, 5);

  return (
    <details className="plan-ceo">
      <summary>
        <span><b>PLAN INTELIGENTE</b> · PAGOS Y COMPRAS</span>
        <strong>Ver próximas 13 semanas y probar decisiones</strong>
        <small>{plan.calendarioCompleto
          ? `${dinero.format(plan.total30Dias)} comprometidos a 30 días`
          : plan.fuentesCompletas
            ? `${plan.incompletas.length} obligación${plan.incompletas.length === 1 ? "" : "es"} con datos pendientes`
            : "Faltan fuentes financieras por completar"}</small>
      </summary>

      <div className="plan-ceo__contenido">
        <header className="plan-ceo__encabezado">
          <div>
            <span>CALENDARIO REAL · SIN INVENTAR COBROS</span>
            <h3>Primero protegemos caja; después autorizamos compras.</h3>
          </div>
          <button type="button" onClick={abrirDirectorFinanciero}>Completar obligaciones →</button>
        </header>

        {!plan.calendarioCompleto && (
          <div className="plan-ceo__alerta" role="status">
            <b>Decisión bloqueada con seguridad.</b> {plan.fuentesCompletas
              ? `Hay ${plan.incompletas.length} obligación${plan.incompletas.length === 1 ? "" : "es"} sin fecha o importe.`
              : "Falta consultar créditos o cargar proveedores de todas las sucursales."} MONYS no las convierte en $0.
          </div>
        )}

        <div className="plan-ceo__semaforos">
          <article className={plan.vencidas.length ? "es-rojo" : "es-verde"}>
            <span>VENCIDO</span><strong>{dinero.format(plan.totalVencido)}</strong><small>{plan.vencidas.length} pagos</small>
          </article>
          <article className="es-ambar">
            <span>HOY A 7 DÍAS</span><strong>{dinero.format(plan.total7Dias)}</strong><small>incluye vencidos</small>
          </article>
          <article>
            <span>8 A 30 DÍAS</span><strong>{dinero.format(Math.max(0, plan.total30Dias - plan.total7Dias))}</strong><small>programables</small>
          </article>
          <article>
            <span>SIN FECHA / IMPORTE</span><strong>{plan.incompletas.length}</strong><small>requieren captura</small>
          </article>
        </div>

        <section className="plan-ceo__prioridades" aria-labelledby="prioridades-pago">
          <div>
            <span>ORDEN DE REVISIÓN</span>
            <h4 id="prioridades-pago">Qué pagar primero</h4>
          </div>
          {prioritarios.length ? (
            <ol>{prioritarios.map((item) => (
              <li key={item.id} className={`es-${item.estado}`}>
                <div><b>{item.nombre}</b><small>{item.tipo} · {item.estado === "vencido" ? "Venció" : "Vence"} {fecha(item.fecha)}</small></div>
                <strong>{dinero.format(item.monto)}</strong>
              </li>
            ))}</ol>
          ) : <p>No hay pagos con fecha dentro de los próximos 30 días.</p>}
        </section>

        <section className="plan-ceo__calendario" aria-labelledby="calendario-13">
          <div className="plan-ceo__titulo-fila">
            <div><span>HORIZONTE</span><h4 id="calendario-13">13 semanas</h4></div>
            <small>Desliza para ver todas →</small>
          </div>
          <div className="plan-ceo__semanas">
            {plan.semanas.map((semana) => (
              <article key={semana.numero} className={semana.total > 0 ? "tiene-pagos" : ""}>
                <span>SEMANA {semana.numero}</span>
                <small>{fecha(semana.inicio)}–{fecha(semana.fin)}</small>
                <strong>{semana.pagos.length ? dinero.format(semana.total) : "Sin pagos fechados"}</strong>
                <em>{semana.pagos.length} compromiso{semana.pagos.length === 1 ? "" : "s"}</em>
              </article>
            ))}
          </div>
        </section>

        <section className="plan-ceo__simulador" aria-labelledby="simulador-decision">
          <div className="plan-ceo__simulador-cabecera">
            <div><span>SIMULACIÓN · NO CONTABILIDAD</span><h4 id="simulador-decision">Si pago y compro, ¿cuánto queda?</h4></div>
            <button type="button" onClick={abrirCompraMaestra}>Ver compra propuesta →</button>
          </div>
          <div className="plan-ceo__controles">
            <label>Pagos a cubrir
              <select value={horizonte} onChange={(evento) => setHorizonte(evento.target.value)}>
                <option value="7">Vencidos y próximos 7 días</option>
                <option value="30">Vencidos y próximos 30 días</option>
                <option value="13">Vencidos y próximas 13 semanas</option>
              </select>
            </label>
            <label>Reserva que no quieres tocar
              <input type="number" min="0" step="100" value={reserva} onChange={(evento) => setReserva(evento.target.value)} />
            </label>
            <label className="plan-ceo__check">
              <input type="checkbox" checked={incluirCompra} onChange={(evento) => setIncluirCompra(evento.target.checked)} />
              Incluir Compra Maestra ({plan.inversionCompra === null ? "pendiente" : dinero.format(plan.inversionCompra)})
            </label>
          </div>

          {escenario.calculable ? (
            <div className={`plan-ceo__resultado es-${escenario.estado}`}>
              <div><span>QUEDARÍA DISPONIBLE</span><strong>{dinero.format(escenario.saldoFinal)}</strong></div>
              <p>{escenario.recomendacion}</p>
              <small>Máximo de compra sin quedar en negativo: <b>{dinero.format(escenario.maximoCompra)}</b>.</small>
              <small>{dinero.format(escenario.liquidez)} localizado − {dinero.format(escenario.pagos)} pagos − {dinero.format(escenario.compra)} compra − {dinero.format(escenario.reserva)} reserva.</small>
            </div>
          ) : (
            <div className="plan-ceo__resultado es-bloqueado">
              <div><span>RESULTADO</span><strong>Por confirmar</strong></div>
              <p>{escenario.motivo} Confirma saldos, cajas, vencimientos e importes para liberar la simulación.</p>
            </div>
          )}
        </section>

        <p className="plan-ceo__nota"><b>Regla MONYS:</b> una fecha faltante es una pregunta pendiente, no dinero disponible. Los pagos recurrentes futuros no se inventan; se agregarán cuando estén programados.</p>
      </div>
    </details>
  );
}
