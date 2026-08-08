export const TIPOS_REPORTE_SICAR = {
  VENTAS_ARTICULOS: "VENTAS_ARTICULOS",
  CREDITOS_PROVEEDORES: "CREDITOS_PROVEEDORES",
  EXISTENCIAS: "EXISTENCIAS",
  INVENTARIO: "INVENTARIO",
  UTILIDAD_VENTAS: "UTILIDAD_VENTAS",
  INVENTARIO_UTILIDAD: "INVENTARIO_UTILIDAD",
  DESCONOCIDO: "DESCONOCIDO",
};

export const REPORTES_SICAR_CONFIG = [
  {
    tipo: TIPOS_REPORTE_SICAR.VENTAS_ARTICULOS,
    nombre: "Ventas por artículo",
    descripcion:
      "Productos vendidos, cantidades, departamentos y categorías.",
    hojasEsperadas: ["ArticulosV"],
    frasesIdentificacion: [
      "Clave",
      "Descripción",
      "Departamento",
      "Categoría",
    ],
    prioridad: 100,
    permiteAnalizar: [
      "productos_mas_vendidos",
      "productos_menos_vendidos",
      "ventas_por_marca",
      "ventas_por_categoria",
      "cantidad_vendida",
    ],
  },

  {
    tipo: TIPOS_REPORTE_SICAR.INVENTARIO_UTILIDAD,
    nombre: "Inventario y utilidad",
    descripcion:
      "Precios, costos, márgenes, utilidad y existencias por producto.",
    hojasEsperadas: ["PaqueteArts"],
    frasesIdentificacion: [
      "Reporte de Inventario/Utilidad",
      "Precio V.",
      "Precio C.",
      "Margen %",
      "Utilidad Uni.",
      "Utilidad Total",
    ],
    prioridad: 95,
    filaEncabezadosAproximada: 5,
    permiteAnalizar: [
      "margen_por_producto",
      "utilidad_por_producto",
      "valor_utilidad_inventario",
      "productos_rentables",
      "productos_con_margen_bajo",
    ],
  },

  {
    tipo: TIPOS_REPORTE_SICAR.INVENTARIO,
    nombre: "Inventario",
    descripcion:
      "Precio unitario, existencias y valor almacenado por producto.",
    hojasEsperadas: ["Inventario"],
    frasesIdentificacion: [
      "Clave",
      "Descripción",
      "Precio U.",
      "Exis",
    ],
    prioridad: 90,
    filaEncabezadosAproximada: 1,
    permiteAnalizar: [
      "productos_agotados",
      "existencias_negativas",
      "exceso_inventario",
      "valor_inventario",
      "riesgo_desabasto",
    ],
  },

  {
    tipo: TIPOS_REPORTE_SICAR.UTILIDAD_VENTAS,
    nombre: "Utilidad de ventas",
    descripcion:
      "Tickets, ventas, costos y utilidad obtenida durante el periodo.",
    hojasEsperadas: ["GeneralV"],
    frasesIdentificacion: [
      "Documento",
      "Fecha",
      "Folio",
      "Cliente",
      "Caja",
    ],
    prioridad: 85,
    filaEncabezadosAproximada: 1,
    permiteAnalizar: [
      "ventas_por_dia",
      "utilidad_por_dia",
      "ticket_promedio",
      "ventas_por_caja",
      "ventas_por_usuario",
    ],
  },

  {
    tipo: TIPOS_REPORTE_SICAR.EXISTENCIAS,
    nombre: "Existencias",
    descripcion:
      "Catálogo de productos con existencias disponibles.",
    hojasEsperadas: ["Existencias"],
    frasesIdentificacion: [
      "Reporte de Existencias",
      "Departamento:",
      "Categoría:",
      "Clave",
      "Descripción",
    ],
    prioridad: 80,
    filaEncabezadosAproximada: 5,
    permiteAnalizar: [
      "productos_sin_existencia",
      "productos_disponibles",
      "catalogo_productos",
      "inventario_por_departamento",
      "inventario_por_categoria",
    ],
  },

  {
    tipo: TIPOS_REPORTE_SICAR.CREDITOS_PROVEEDORES,
    nombre: "Créditos de proveedores",
    descripcion:
      "Deudas, vencimientos y abonos registrados con proveedores.",
    hojasEsperadas: ["Creditos"],
    frasesIdentificacion: [
      "Reporte de Créditos de Proveedores",
      "Proveedor:",
      "No. Prv",
      "Vencimiento",
      "Lista de Abonos",
    ],
    prioridad: 75,
    permiteAnalizar: [
      "deuda_proveedores",
      "creditos_vencidos",
      "proximos_vencimientos",
      "abonos_realizados",
      "flujo_comprometido",
    ],
  },
];

function normalizarTexto(valor) {
  return String(valor ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();
}

function contieneFrase(texto, frase) {
  const textoNormalizado = normalizarTexto(texto);
  const fraseNormalizada = normalizarTexto(frase);

  return textoNormalizado.includes(fraseNormalizada);
}

export function buscarConfiguracionReporte(tipoReporte) {
  return (
    REPORTES_SICAR_CONFIG.find(
      (reporte) => reporte.tipo === tipoReporte
    ) || null
  );
}

export function detectarTipoReporteSicar({
  nombreHoja = "",
  contenidoTexto = "",
} = {}) {
  const reportesOrdenados = [...REPORTES_SICAR_CONFIG].sort(
    (reporteA, reporteB) =>
      reporteB.prioridad - reporteA.prioridad
  );

  let mejorCoincidencia = null;

  reportesOrdenados.forEach((reporte) => {
    const coincideHoja = reporte.hojasEsperadas.some(
      (hojaEsperada) =>
        normalizarTexto(hojaEsperada) ===
        normalizarTexto(nombreHoja)
    );

    const coincidenciasTexto =
      reporte.frasesIdentificacion.filter((frase) =>
        contieneFrase(contenidoTexto, frase)
      ).length;

    const puntuacion =
      (coincideHoja ? 100 : 0) +
      coincidenciasTexto * 20 +
      reporte.prioridad / 100;

    if (
      !mejorCoincidencia ||
      puntuacion > mejorCoincidencia.puntuacion
    ) {
      mejorCoincidencia = {
        ...reporte,
        puntuacion,
        coincideHoja,
        coincidenciasTexto,
      };
    }
  });

  if (
    !mejorCoincidencia ||
    (!mejorCoincidencia.coincideHoja &&
      mejorCoincidencia.coincidenciasTexto < 2)
  ) {
    return {
      tipo: TIPOS_REPORTE_SICAR.DESCONOCIDO,
      nombre: "Reporte desconocido",
      descripcion:
        "El archivo no coincide con los reportes SICAR configurados.",
      confianza: 0,
      permiteAnalizar: [],
    };
  }

  const confianza = mejorCoincidencia.coincideHoja
    ? Math.min(
        100,
        70 + mejorCoincidencia.coincidenciasTexto * 6
      )
    : Math.min(
        90,
        mejorCoincidencia.coincidenciasTexto * 20
      );

  return {
    tipo: mejorCoincidencia.tipo,
    nombre: mejorCoincidencia.nombre,
    descripcion: mejorCoincidencia.descripcion,
    confianza,
    permiteAnalizar: mejorCoincidencia.permiteAnalizar,
  };
}

export function obtenerReportesSicarDisponibles() {
  return REPORTES_SICAR_CONFIG.map((reporte) => ({
    tipo: reporte.tipo,
    nombre: reporte.nombre,
    descripcion: reporte.descripcion,
    permiteAnalizar: reporte.permiteAnalizar,
  }));
}