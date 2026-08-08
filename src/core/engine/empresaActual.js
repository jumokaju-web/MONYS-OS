/**
 * =====================================================
 * MONYS OS
 * Memoria Central de la Empresa
 * =====================================================
 *
 * Este archivo representa el estado actual del negocio.
 * Todos los módulos deben leer y actualizar esta información.
 */

const empresaActual = {
  fechaActualizacion: null,

  ventas: {
    total: 0,
    utilidad: 0,
    costo: 0,
    margen: 0,
    ticketPromedio: 0,
    productosVendidos: [],
  },

  inventario: {
    valor: 0,
    productos: [],
    agotados: [],
    sobreInventario: [],
  },

  compras: {
    sugeridas: [],
    presupuestoDisponible: 0,
  },

  proveedores: {
    creditos: [],
    vencimientos: [],
  },

  finanzas: {
    efectivo: 0,
    bancos: 0,
    liquidez: 100,
    saludFinanciera: 100,
  },

  indicadores: {
    saludGeneral: 100,
    nivelRiesgo: "BAJO",
    estado: "SIN INFORMACIÓN",
  },

  directores: {
    financiero: [],
    comercial: [],
    inventario: [],
    logistica: [],
    general: [],
  },
};

/**
 * Obtiene el estado completo de la empresa
 */
export function obtenerEmpresaActual() {
  return empresaActual;
}

/**
 * Actualiza una sección del estado
 */
export function actualizarEmpresa(seccion, datos) {
  empresaActual[seccion] = {
    ...empresaActual[seccion],
    ...datos,
  };

  empresaActual.fechaActualizacion = new Date();
}

/**
 * Reinicia toda la información
 */
export function reiniciarEmpresa() {
  Object.assign(empresaActual, {
    fechaActualizacion: null,

    ventas: {
      total: 0,
      utilidad: 0,
      costo: 0,
      margen: 0,
      ticketPromedio: 0,
      productosVendidos: [],
    },

    inventario: {
      valor: 0,
      productos: [],
      agotados: [],
      sobreInventario: [],
    },

    compras: {
      sugeridas: [],
      presupuestoDisponible: 0,
    },

    proveedores: {
      creditos: [],
      vencimientos: [],
    },

    finanzas: {
      efectivo: 0,
      bancos: 0,
      liquidez: 100,
      saludFinanciera: 100,
    },

    indicadores: {
      saludGeneral: 100,
      nivelRiesgo: "BAJO",
      estado: "SIN INFORMACIÓN",
    },

    directores: {
      financiero: [],
      comercial: [],
      inventario: [],
      logistica: [],
      general: [],
    },
  });
}