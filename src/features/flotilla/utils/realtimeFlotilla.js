let secuenciaCanalOperacion = 0;

export function crearNombreCanalOperacion({
  ahora = Date.now(),
  aleatorio = globalThis.crypto?.randomUUID?.(),
} = {}) {
  secuenciaCanalOperacion += 1;
  const sufijo = aleatorio || secuenciaCanalOperacion;
  return `flotilla-operacion-en-vivo-${ahora}-${sufijo}`;
}
