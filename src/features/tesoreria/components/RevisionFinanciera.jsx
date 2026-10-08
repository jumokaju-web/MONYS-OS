import { useState } from 'react';
import { prepararRevisionFinanciera } from '../utils/conciliacionMovimientos';

export default function RevisionFinanciera({ movimientos = [], formatoDinero }) {
  const [filtro, setFiltro] = useState('Todos');
  const revision = prepararRevisionFinanciera(movimientos);
  const motivos = [...new Set(revision.map((item) => item.motivo))];
  const visibles = revision.filter((item) => filtro === 'Todos' || item.motivo === filtro);
  const dinero = formatoDinero || ((valor) => new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(valor));
  return (
    <section style={{ background: '#fff5f8', border: '1px solid #efc8d8', borderRadius: 18, padding: 20, margin: '20px auto', maxWidth: 1100 }}>
      <h2>Conciliar antes de cerrar</h2>
      <p>{revision.length} movimientos requieren comprobar su tratamiento. Esta revisión usa los movimientos cargados en Tesorería; no calcula un saldo de préstamos ni modifica registros.</p>
      <label>Ver movimientos{' '}<select value={filtro} onChange={(evento) => setFiltro(evento.target.value)}>
        <option>Todos</option>{motivos.map((motivo) => <option key={motivo}>{motivo}</option>)}
      </select></label>
      <p>Un comprobante, un mensaje y un descuento de nómina pueden referirse a la misma entrega. Vincúlalos antes de registrar otra salida.</p>
      {visibles.length === 0 ? <p>No hay movimientos de este tipo entre los registros cargados. Esto no confirma que el cierre esté completo.</p> : (
        <div style={{ overflowX: 'auto', maxHeight: 420 }}><table style={{ width: '100%', textAlign: 'left', borderCollapse: 'collapse' }}>
          <thead><tr><th>Fecha</th><th>Movimiento</th><th>Importe</th><th>Revisión necesaria</th></tr></thead>
          <tbody>{visibles.map(({ movimiento: m, motivo, accion }, indice) => {
            const valor = m.monto ?? m.amount;
            const monto = valor === null || valor === undefined || valor === '' ? NaN : Number(valor);
            return <tr key={m.id ?? indice} style={{ borderTop: '1px solid #efc8d8' }}>
              <td style={{ padding: 12 }}>{m.fecha ?? m.occurred_at ?? 'Sin fecha'}</td>
              <td>{m.concepto ?? m.concept ?? 'Sin concepto'}<br /><small>{m.tipo ?? m.movement_type ?? 'Tipo pendiente'} · {m.estado ?? m.status ?? 'Estado pendiente'}</small></td>
              <td>{Number.isFinite(monto) ? dinero(monto) : 'Importe pendiente'}</td>
              <td><strong>{motivo}</strong><br />{accion}</td>
            </tr>;
          })}</tbody>
        </table></div>
      )}
      <button type="button" onClick={() => document.getElementById('historial-tesoreria')?.scrollIntoView({ behavior: 'smooth' })}>Revisar y corregir en el historial</button>
    </section>
  );
}
