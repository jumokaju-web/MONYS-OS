import { diagnosticoBancario } from '../utils/diagnosticoBancario';
const dinero = n => Number(n).toLocaleString('es-MX', { style: 'currency', currency: 'MXN' });
export default function DiagnosticoEstadoBancario({ paquete, cuenta, onRevisar }) {
  const d = diagnosticoBancario(paquete, cuenta);
  return <section className="banco-diagnostico">
    <h3>Tu siguiente decisión {cuenta ? `· Cuenta ·${cuenta}` : '· Ambas cuentas'}</h3>
    <p>{d.pendientes ? 'Empieza por los movimientos de mayor importe: explicar su destino reduce más rápido la incertidumbre.' : 'Todos los movimientos tienen clasificación. Falta conciliar ventas, documentos y obligaciones antes de calcular rentabilidad.'}</p>
    <div className="banco-resumen"><article><small>Importe pendiente de explicar</small><strong>{dinero(d.importePendiente)}</strong><small>Suma de cargos y abonos pendientes; no es pérdida ni deuda.</small></article><article><small>Avance de revisión</small><strong>{d.confirmados} / {d.total}</strong><small>{d.coberturaImporte}% del importe movido tiene clasificación confirmada.</small></article><article><small>Pagos de crédito y tarjeta</small><strong>{dinero(d.pagosPorDesglosar)}</strong><small>{d.pagosPorDesglosarCantidad} pagos bancarios. Para conocer el gasto real falta separar capital, intereses y compras.</small></article></div>
    {d.mayoresPendientes.length > 0 && <><h4>Los cinco pendientes de mayor importe</h4><div className="banco-lista">{d.mayoresPendientes.map(m => <article key={m.id}><div><b>{m.descripcion}</b><p>{m.fecha_operacion} · Cuenta ·{m.cuenta}</p><p>{m.referencia_visible}</p></div><div><strong>{dinero(Number(m.cargo) + Number(m.abono))}</strong><p>{Number(m.cargo) > 0 ? 'Salida' : 'Entrada'}</p><button onClick={() => onRevisar(m)}>Aclarar este movimiento</button></div></article>)}</div></>}
    <h4>Destino confirmado por ti</h4>
    {d.grupos.length ? <div className="banco-cuentas">{d.grupos.map(g => <article key={g.nombre}><b>{g.nombre}</b><p>{g.movimientos} movimientos</p><p>Salidas {dinero(g.cargos)}</p><p>Entradas {dinero(g.abonos)}</p></article>)}</div> : <p>Aún no hay clasificaciones confirmadas. Las pistas del banco no se cuentan como decisiones aprobadas.</p>}
    <p className="banco-aviso">Estos totales describen el movimiento bancario clasificado. No calculan utilidad ni dinero libre: las ventas SICAR pueden incluir estos mismos cobros, los préstamos requieren seguimiento y las transferencias internas requieren comprobar ambos lados. Clasificar un pago no sustituye su desglose contable.</p>
  </section>;
}
