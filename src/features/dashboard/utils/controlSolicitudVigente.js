export function crearControlSolicitudVigente() {
  let actual = 0;

  return {
    iniciar() {
      actual += 1;
      return actual;
    },
    esVigente(id) {
      return id === actual;
    },
    invalidar() {
      actual += 1;
    },
  };
}
