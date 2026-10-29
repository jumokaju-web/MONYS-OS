export const DESTINOS_DIRECCION = [
  "operacion",
  "finanzas",
  "inventario",
  "compraMaestra",
  "marketing",
  "flotilla",
  "equipo",
  "junta",
  "tesoreria",
  "reportes",
  "usuarios",
];

export function crearNavegacionDireccion(acciones = {}) {
  const navegacion = {
    operacion: acciones.abrirOperacion,
    finanzas: acciones.abrirFinanzas,
    inventario: acciones.abrirInventario,
    compraMaestra: acciones.abrirCompraMaestra,
    marketing: acciones.abrirMarketing,
    flotilla: acciones.abrirFlotilla,
    equipo: acciones.abrirEquipo,
    junta: acciones.abrirJunta,
    tesoreria: acciones.abrirTesoreria,
    reportes: acciones.abrirReportes,
    usuarios: acciones.abrirUsuarios,
  };

  return Object.fromEntries(
    DESTINOS_DIRECCION.map((destino) => [
      destino,
      typeof navegacion[destino] === "function" ? navegacion[destino] : () => false,
    ]),
  );
}
