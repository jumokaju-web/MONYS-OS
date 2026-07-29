const CLAVE_MEMORIA = "monys-memoria-empresarial";

const memoriaInicial = {
  version: 1,
  ultimaActualizacion: null,
  reportes: {
    ventas: null,
    inventario: null,
    compras: null,
    gastos: null,
    nomina: null,
    bancos: null,
  },
};

function copiarMemoriaInicial() {
  return JSON.parse(JSON.stringify(memoriaInicial));
}

export function obtenerMemoriaEmpresarial() {
  try {
    const memoriaGuardada =
      localStorage.getItem(CLAVE_MEMORIA);

    if (!memoriaGuardada) {
      return copiarMemoriaInicial();
    }

    const memoriaConvertida =
      JSON.parse(memoriaGuardada);

    return {
      ...copiarMemoriaInicial(),
      ...memoriaConvertida,
      reportes: {
        ...copiarMemoriaInicial().reportes,
        ...(memoriaConvertida.reportes || {}),
      },
    };
  } catch (error) {
    console.error(
      "No fue posible leer la memoria empresarial:",
      error
    );

    return copiarMemoriaInicial();
  }
}

export function guardarEnMemoriaEmpresarial(
  tipoReporte,
  informacion
) {
  if (!tipoReporte || !informacion) {
    return obtenerMemoriaEmpresarial();
  }

  const memoriaActual =
    obtenerMemoriaEmpresarial();

  const fechaActual =
    new Date().toISOString();

  const nuevaMemoria = {
    ...memoriaActual,
    ultimaActualizacion: fechaActual,
    reportes: {
      ...memoriaActual.reportes,
      [tipoReporte]: {
        ...informacion,
        fechaGuardado: fechaActual,
      },
    },
  };

  localStorage.setItem(
    CLAVE_MEMORIA,
    JSON.stringify(nuevaMemoria)
  );

  return nuevaMemoria;
}

export function obtenerReporteDeMemoria(tipoReporte) {
  const memoria =
    obtenerMemoriaEmpresarial();

  return memoria.reportes?.[tipoReporte] || null;
}

export function limpiarMemoriaEmpresarial() {
  localStorage.removeItem(CLAVE_MEMORIA);

  return copiarMemoriaInicial();
}