function limitarPorcentaje(valor) {
  return Math.max(
    0,
    Math.min(100, Math.round(valor))
  );
}

function calcularSaludComercial(metricas) {
  const totalPiezas = Number(
    metricas?.totalPiezas || 0
  );

  const productoMasVendido =
    metricas?.productoMasVendido;

  if (totalPiezas <= 0) {
    return 35;
  }

  if (productoMasVendido) {
    return 90;
  }

  return 70;
}

function calcularSaludInventario(metricas) {
  const totalProductos = Number(
    metricas?.totalProductos || 0
  );

  if (totalProductos <= 0) {
    return 30;
  }

  if (totalProductos >= 20) {
    return 88;
  }

  if (totalProductos >= 10) {
    return 78;
  }

  return 65;
}

function calcularSaludFinanciera(
  movimientos = []
) {
  if (movimientos.length === 0) {
    return 45;
  }

  return 80;
}

function calcularSaludTesoreria(
  movimientos = []
) {
  if (movimientos.length === 0) {
    return 40;
  }

  const entradas = movimientos
    .filter(
      (movimiento) =>
        String(movimiento?.tipo || "")
          .trim()
          .toUpperCase() === "ENTRADA"
    )
    .reduce(
      (total, movimiento) =>
        total +
        Number(movimiento?.monto || 0),
      0
    );

  const salidas = movimientos
    .filter(
      (movimiento) =>
        String(movimiento?.tipo || "")
          .trim()
          .toUpperCase() === "SALIDA"
    )
    .reduce(
      (total, movimiento) =>
        total +
        Number(movimiento?.monto || 0),
      0
    );

  if (entradas === 0 && salidas === 0) {
    return 50;
  }

  if (entradas >= salidas) {
    return 85;
  }

  return 55;
}

function obtenerEstadoSalud(porcentaje) {
  if (porcentaje >= 85) {
    return {
      nivel: "excelente",
      etiqueta: "Negocio saludable",
    };
  }

  if (porcentaje >= 70) {
    return {
      nivel: "estable",
      etiqueta: "Negocio estable",
    };
  }

  if (porcentaje >= 50) {
    return {
      nivel: "atencion",
      etiqueta: "Atención requerida",
    };
  }

  return {
    nivel: "critico",
    etiqueta: "Riesgo operativo",
  };
}

function calcularSaludNegocio({
  datosDashboard,
  movimientos = [],
}) {
  const metricas =
    datosDashboard?.metricas || {};

  const comercial = limitarPorcentaje(
    calcularSaludComercial(metricas)
  );

  const inventario = limitarPorcentaje(
    calcularSaludInventario(metricas)
  );

  const financiera = limitarPorcentaje(
    calcularSaludFinanciera(movimientos)
  );

  const tesoreria = limitarPorcentaje(
    calcularSaludTesoreria(movimientos)
  );

  const general = limitarPorcentaje(
    (
      comercial +
      inventario +
      financiera +
      tesoreria
    ) / 4
  );

  return {
    comercial,
    inventario,
    financiera,
    tesoreria,
    general,
    estado: obtenerEstadoSalud(general),
  };
}

export {
  calcularSaludNegocio,
  obtenerEstadoSalud,
};