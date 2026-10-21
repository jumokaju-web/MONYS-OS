export default function EstadoBorrador({ borrador, guardando = false }) {
  return <div style={{ marginTop: 8, padding: 9, borderRadius: 9, background: '#edf5ff', color: '#285878' }}>
    <span role="status" aria-live="polite">{guardando ? 'Guardando…' : borrador.mensaje || 'Los cambios se respaldan en este dispositivo al escribir.'}</span>
    {borrador.pendiente && <button type="button" disabled={guardando} style={{ marginLeft: 8, minHeight: 40 }} onClick={() => {
      if (window.confirm('¿Descartar este borrador? Se conserva lo ya guardado en MONYS OS.')) borrador.controlador.descartar();
    }}>Descartar borrador</button>}
  </div>;
}
