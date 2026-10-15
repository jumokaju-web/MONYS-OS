import { fechaOperativaMexico } from '../utils/corteTienda';
import { useRef, useState } from 'react';
import { guardarCierreTurno } from '../services/cierresTurnoService';
export default function IncidenciaTienda({ usuario, branchId }) {
  const [texto, setTexto] = useState('');
  const [guardando, setGuardando] = useState(false);
  const [mensaje, setMensaje] = useState('');
  const [error, setError] = useState('');
  const enviando = useRef(false);
  async function guardar(e) {
    e.preventDefault();
    if (enviando.current) return;
    if (!branchId || !usuario?.nombre) { setError('No se pudo confirmar tu cuenta y sucursal. Avisa a Dirección.'); return; }
    if (texto.trim().length < 10) { setError('Describe qué pasó con al menos 10 caracteres.'); return; }
    enviando.current=true; setGuardando(true); setError(''); setMensaje('');
    try {
      await guardarCierreTurno({ branchId, responsable: usuario.nombre, turno: 'incidencia_tienda', incidencias: texto.trim(), fecha: fechaOperativaMexico(), observaciones: 'Incidencia registrada desde la cuenta de la empleada, independiente del corte de caja.' });
      setTexto(''); setMensaje('Incidencia guardada en MONYS para revisión de Dirección.');
    } catch(e) { setError(e.message || 'No se pudo guardar. Tu texto sigue aquí para reintentar.'); }
    finally { enviando.current=false; setGuardando(false); }
  }
  return <form className="tienda-incidencia" onSubmit={guardar}><span>REGISTRO DEL TURNO</span><h3>¿Qué pasó en la tienda?</h3><p>Registra el problema, qué hiciste y qué apoyo necesitas. Puedes enviarlo aunque no tengas una caja abierta.</p><label>Descripción<textarea value={texto} onChange={e=>{setTexto(e.target.value);setMensaje('');}} minLength={10} maxLength={2000} required rows={5} placeholder="Ej. el internet dejó de funcionar; pude cobrar en efectivo y necesito que revisen el módem."/></label><button type="submit" disabled={guardando || texto.trim().length<10}>{guardando?'Guardando…':'Guardar incidencia'}</button>{mensaje&&<p role="status">{mensaje}</p>}{error&&<p role="alert">{error}</p>}</form>;
}
