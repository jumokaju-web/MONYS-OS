// Borradores locales: nunca equivalen a un movimiento confirmado en el servidor.
export function claveBorradorFlotilla({ usuario, unidad, fecha, formulario }) {
  const partes = [usuario?.organization_id, usuario?.business_id, usuario?.auth_user_id, unidad, fecha, formulario];
  return partes.every((p) => typeof p === 'string' && p.length)
    ? `monys:flotilla:borrador:v1:${partes.map(encodeURIComponent).join(':')}` : null;
}

export function crearBorradorFlotilla(storage, clave, inicial) {
  let estado = { valor: { ...inicial }, pendiente: false, mensaje: '', revision: 0 };
  let base = { ...inicial };
  const listeners = new Set();
  const publicar = (cambios) => { estado = { ...estado, ...cambios }; listeners.forEach((fn) => fn()); };
  if (clave) {
    try {
      const texto = storage.getItem(clave);
      if (texto) {
        const dato = JSON.parse(texto);
        if (dato.version !== 1 || !dato.valor || typeof dato.valor !== 'object' ||
          !Object.keys(inicial).every((k) => typeof dato.valor[k] === 'string')) throw new Error('Formato inválido');
        estado = { ...estado, valor: Object.fromEntries(Object.keys(inicial).map((k) => [k, dato.valor[k]])), pendiente: true, mensaje: 'Borrador recuperado · solo en este dispositivo' };
      }
    } catch { estado = { ...estado, mensaje: 'No se pudo recuperar el borrador. No se eliminará automáticamente.' }; }
  }
  return {
    getSnapshot: () => estado,
    subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn); },
    cambiar(cambio) {
      const valor = typeof cambio === 'function' ? cambio(estado.valor) : cambio;
      publicar({ valor, pendiente: true, revision: estado.revision + 1, mensaje: 'Guardando…' });
      try {
        if (!clave || !storage) throw new Error('Sin almacenamiento');
        storage.setItem(clave, JSON.stringify({ version: 1, guardadoEn: new Date().toISOString(), valor }));
        publicar({ mensaje: 'Borrador guardado · solo en este dispositivo' });
      } catch { publicar({ mensaje: 'Sin respaldo local: guarda en MONYS OS antes de salir.' }); }
    },
    cargarServidor(valor) {
      base = { ...valor };
      if (!estado.pendiente) publicar({ valor: base });
    },
    confirmar(revision, valor = inicial) {
      // Una respuesta antigua nunca elimina lo escrito mientras se guardaba.
      if (estado.revision !== revision) return;
      try {
        if (clave) storage.removeItem(clave);
        base = { ...valor };
        publicar({ valor: base, pendiente: false, mensaje: 'Guardado en MONYS OS' });
      } catch { publicar({ mensaje: 'Guardado en MONYS OS; no se pudo limpiar el borrador local.' }); }
    },
    descartar() {
      try {
        if (clave) storage.removeItem(clave);
        publicar({ valor: { ...base }, pendiente: false, revision: estado.revision + 1, mensaje: 'Borrador descartado' });
      } catch { publicar({ mensaje: 'No se pudo descartar el borrador local.' }); }
    },
  };
}
