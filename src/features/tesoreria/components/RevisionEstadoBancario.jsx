import { useMemo, useState } from 'react';
import { validarEstadoBancario } from '../utils/validarEstadoBancario';
import './RevisionEstadoBancario.css';
const categorias = ['Cobro de flotilla', 'Cobro de tienda: conciliar SICAR', 'Transferencia interna', 'Combustible', 'Proveedor', 'Nómina', 'Gasto operativo', 'Pago de crédito', 'Pago de tarjeta', 'Préstamo por recuperar', 'Personal', 'Otro'];
const dinero = n => Number(n).toLocaleString('es-MX', { style: 'currency', currency: 'MXN' });
export default function RevisionEstadoBancario() {
  const [paquete, setPaquete] = useState(null);
  const [error, setError] = useState('');
  const [filtro, setFiltro] = useState('');
  const [cuenta, setCuenta] = useState('');
  const [pendientes, setPendientes] = useState(false);
  const [pagina, setPagina] = useState(0);
  const [editando, setEditando] = useState(null);
  const [categoria, setCategoria] = useState('');
  const [nota, setNota] = useState('');
  const resumen = useMemo(() => paquete ? validarEstadoBancario(paquete) : null, [paquete]);
  const filtrados = useMemo(() => (paquete?.movimientos || []).filter(m => (!cuenta || m.cuenta === cuenta) && (!pendientes || m.revision?.estado !== 'Confirmado') && [m.descripcion, m.referencia_visible, m.categoria, m.revision?.clasificacion, m.revision?.nota].join(' ').toLowerCase().includes(filtro.toLowerCase())), [paquete, cuenta, pendientes, filtro]);
  const cargar = async event => {
    const file = event.target.files?.[0]; event.target.value = ''; if (!file) return;
    try {
      if (file.size > 10 * 1024 * 1024) throw new Error('El archivo supera 10 MB.');
      const nuevo = JSON.parse(await file.text()); validarEstadoBancario(nuevo);
      setPaquete(nuevo); setError(''); setPagina(0); setFiltro(''); setCuenta(''); setEditando(null);
    } catch (e) { setError(e.message || 'No fue posible leer el archivo.'); }
  };
  const descargar = () => {
    validarEstadoBancario(paquete);
    const url = URL.createObjectURL(new Blob([JSON.stringify(paquete, null, 2)], { type: 'application/json' }));
    const link = document.createElement('a'); link.href = url; link.download = 'MONYS-revision-bancaria.json'; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  const confirmar = () => {
    if (!categoria || !nota.trim()) { setError('Selecciona una categoría y explica cómo confirmaste el destino.'); return; }
    setPaquete(actual => ({ ...actual, movimientos: actual.movimientos.map(m => m.id === editando ? { ...m, revision: { estado: 'Confirmado', clasificacion: categoria, nota: nota.trim(), fecha: new Date().toISOString() } } : m) })); setEditando(null); setError('');
  };
  return <section className="banco-revision">
    <div className="banco-revision-head"><div><span>CONCILIACIÓN BANCARIA</span><h2>Revisa el destino de tu dinero</h2></div><label className="banco-carga">Abrir paquete bancario<input type="file" accept=".json,application/json" onChange={cargar} /></label></div>
    <p>Abre el archivo bancario MONYS preparado a partir del estado de cuenta. Se comprobarán movimientos, sumas y saldos antes de mostrarlo. Este paso admite JSON; los PDF se preparan primero.</p>
    <p className="banco-aviso">Revisión en esta sesión: no cambia los saldos de Tesorería ni registra ingresos o gastos. Descarga tu revisión antes de salir o abrir otro paquete; podrás retomarla con el mismo archivo. No se sincroniza entre dispositivos.</p>
    {error && <p role="alert" className="banco-error">{error}</p>}
    {resumen && <>
      <div className="banco-resumen"><article><small>Saldo al cierre del estado</small><strong>{dinero(resumen.saldo)}</strong><small>No equivale a dinero disponible hoy</small></article><article><small>Control bancario</small><strong>{resumen.movimientos} movimientos</strong><small>{resumen.cuentas.length} cuentas cuadran</small></article><article><small>Por clasificar</small><strong>{paquete.movimientos.filter(m => m.revision?.estado !== 'Confirmado').length}</strong><small>Las pistas del banco requieren revisión</small></article></div>
      <div className="banco-cuentas">{resumen.cuentas.map(c => <article key={c.terminacion}><b>Cuenta ·{c.terminacion}</b><p>{c.desde} a {c.hasta}</p><p>Abonos {dinero(c.abonos)} · Cargos {dinero(c.cargos)}</p><strong>{dinero(c.final)} al cierre</strong></article>)}</div>
      <div className="banco-filtros"><input aria-label="Buscar movimiento bancario" placeholder="Nombre, concepto o referencia" value={filtro} onChange={e => { setFiltro(e.target.value); setPagina(0); }} /><select aria-label="Cuenta bancaria" value={cuenta} onChange={e => { setCuenta(e.target.value); setPagina(0); }}><option value="">Todas las cuentas</option>{resumen.cuentas.map(c => <option key={c.terminacion} value={c.terminacion}>·{c.terminacion}</option>)}</select><label><input type="checkbox" checked={pendientes} onChange={e => { setPendientes(e.target.checked); setPagina(0); }} /> Solo pendientes</label><button onClick={descargar}>Descargar mi revisión</button></div>
      <p>{filtrados.length} movimientos encontrados. Las ventas de terminal se concilian con SICAR; las transferencias entre cuentas no son ventas.</p>
      <div className="banco-lista">{filtrados.slice(pagina * 20, (pagina + 1) * 20).map(m => <article key={m.id}><div><small>{m.fecha_operacion} · Cuenta ·{m.cuenta}</small><h3>{m.descripcion}</h3><p>{m.revision?.estado === 'Confirmado' ? m.revision.clasificacion : `Pista: ${m.categoria || 'Por aclarar'}`}</p><details><summary>Referencia y evidencia</summary><p>{m.referencia_visible}</p><p>{m.fuente} · página PDF {m.pagina_pdf} · liquida {m.fecha_liquidacion}</p>{m.revision?.nota && <p>Tu aclaración: {m.revision.nota}</p>}</details></div><div><strong>{Number(m.cargo) > 0 ? 'Salida ' + dinero(m.cargo) : 'Entrada ' + dinero(m.abono)}</strong><p>{m.revision?.estado || 'Por revisar'}</p><button onClick={() => { setEditando(m.id); setCategoria(m.revision?.clasificacion || ''); setNota(m.revision?.nota || ''); setError(''); }}>Aclarar destino</button></div>{editando === m.id && <div className="banco-editor"><label>Clasificación<select value={categoria} onChange={e => setCategoria(e.target.value)}><option value="">Seleccionar</option>{categorias.map(c => <option key={c}>{c}</option>)}</select></label><label>Evidencia y destino<textarea value={nota} onChange={e => setNota(e.target.value)} placeholder="Ejemplo: préstamo a Oscar para uso personal, por recuperar; comprobante revisado." /></label><button onClick={confirmar}>Confirmar clasificación</button><button onClick={() => setEditando(null)}>Cancelar</button></div>}</article>)}</div>
      <div className="banco-filtros"><button disabled={pagina === 0} onClick={() => setPagina(p => p - 1)}>Anterior</button><span>Página {pagina + 1} de {Math.max(1, Math.ceil(filtrados.length / 20))}</span><button disabled={(pagina + 1) * 20 >= filtrados.length} onClick={() => setPagina(p => p + 1)}>Siguiente</button></div>
    </>}
  </section>;
}
