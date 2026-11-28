/*
 * VINCULACIÓN DE PUBLICACIONES CON PRODUCTOS DE SICAR · MONYS OS
 *
 * Liga cada publicación de un marketplace con un producto de SICAR para
 * tomar su costo. Orden de búsqueda:
 *  1. Vínculo manual confirmado (producto_vinculos).
 *  2. SKU de la publicación = código SICAR (normalizado).
 *  3. Código de barras (GTIN/EAN/UPC) = código de barras SICAR.
 * Si no hay coincidencia, o hay más de una, queda "por vincular" con
 * candidatos sugeridos por título. NUNCA se asume un costo: sin vínculo
 * único, costo = null. Módulo puro.
 */

export const ESTADOS_VINCULO = Object.freeze({
  MANUAL: "vinculado_manual",
  SKU: "vinculado_sku",
  CODIGO_BARRAS: "vinculado_codigo_barras",
  AMBIGUO: "ambiguo",
  POR_VINCULAR: "por_vincular",
});

const normalizarCodigo = (valor) => String(valor ?? "").trim().toUpperCase().replace(/\s+/g, "");

// GTIN: solo dígitos; se ignoran ceros a la izquierda (EAN-13 vs UPC-12).
function normalizarGtin(valor) {
  const digitos = String(valor ?? "").replace(/\D/g, "");
  if (digitos.length < 8 || digitos.length > 14) return "";
  return digitos.replace(/^0+/, "");
}

function numero(valor) {
  if (valor === null || valor === undefined || typeof valor === "boolean" || typeof valor === "object") return null;
  if (typeof valor === "string" && !valor.trim()) return null;
  const convertido = Number(valor);
  return Number.isFinite(convertido) ? convertido : null;
}

const palabras = (texto) =>
  new Set(
    String(texto ?? "")
      .toLowerCase()
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .split(/[^a-z0-9.]+/)
      .filter((palabra) => palabra.length > 2)
  );

function similitud(a, b) {
  const pa = palabras(a);
  const pb = palabras(b);
  if (!pa.size || !pb.size) return 0;
  let comunes = 0;
  for (const palabra of pa) if (pb.has(palabra)) comunes += 1;
  return comunes / Math.max(pa.size, pb.size);
}

/*
 * productosSicar: [{ codigo, codigo_barras, descripcion, costo }]
 * publicaciones: [{ canal, publicacion, titulo, sku, codigo_barras }]
 * vinculosManuales: [{ canal, publicacion, codigo_sicar }]
 */
export function vincularPublicaciones({ publicaciones = [], productosSicar = [], vinculosManuales = [] } = {}) {
  const porCodigo = new Map();
  const porGtin = new Map();
  for (const producto of productosSicar || []) {
    const codigo = normalizarCodigo(producto?.codigo);
    if (codigo) porCodigo.set(codigo, [...(porCodigo.get(codigo) || []), producto]);
    const gtin = normalizarGtin(producto?.codigo_barras);
    if (gtin) porGtin.set(gtin, [...(porGtin.get(gtin) || []), producto]);
  }
  const manuales = new Map(
    (vinculosManuales || []).map((vinculo) => [`${vinculo.canal}:${vinculo.publicacion}`, normalizarCodigo(vinculo.codigo_sicar)])
  );

  const resolver = (publicacion) => {
    const manual = manuales.get(`${publicacion.canal}:${publicacion.publicacion}`);
    if (manual) {
      const encontrados = porCodigo.get(manual) || [];
      if (encontrados.length === 1) return { estado: ESTADOS_VINCULO.MANUAL, producto: encontrados[0] };
      return { estado: ESTADOS_VINCULO.POR_VINCULAR, motivo: `el vínculo manual apunta a ${manual}, que no existe en SICAR` };
    }
    const sku = normalizarCodigo(publicacion.sku);
    if (sku) {
      const encontrados = porCodigo.get(sku) || [];
      if (encontrados.length === 1) return { estado: ESTADOS_VINCULO.SKU, producto: encontrados[0] };
      if (encontrados.length > 1) return { estado: ESTADOS_VINCULO.AMBIGUO, motivo: `el SKU ${sku} aparece ${encontrados.length} veces en SICAR`, candidatos: encontrados };
    }
    const gtin = normalizarGtin(publicacion.codigo_barras);
    if (gtin) {
      const encontrados = porGtin.get(gtin) || [];
      if (encontrados.length === 1) return { estado: ESTADOS_VINCULO.CODIGO_BARRAS, producto: encontrados[0] };
      if (encontrados.length > 1) return { estado: ESTADOS_VINCULO.AMBIGUO, motivo: `el código de barras aparece ${encontrados.length} veces en SICAR`, candidatos: encontrados };
    }
    const motivo = !sku && !gtin
      ? "la publicación no tiene SKU ni código de barras"
      : "el SKU o código de barras no existe en SICAR";
    return { estado: ESTADOS_VINCULO.POR_VINCULAR, motivo };
  };

  const resultado = (publicaciones || []).map((publicacion) => {
    const { estado, producto = null, motivo = "", candidatos = null } = resolver(publicacion);
    const sugerencias = producto
      ? []
      : (candidatos ||
          (productosSicar || [])
            .map((item) => ({ item, puntaje: similitud(publicacion.titulo, item.descripcion) }))
            .filter((fila) => fila.puntaje >= 0.34)
            .sort((a, b) => b.puntaje - a.puntaje)
            .slice(0, 3)
            .map((fila) => fila.item)
        ).map((item) => ({ codigo: item.codigo, descripcion: item.descripcion }));
    const costo = producto ? numero(producto.costo) : null;
    return {
      canal: publicacion.canal,
      publicacion: publicacion.publicacion,
      titulo: publicacion.titulo,
      estado,
      codigoSicar: producto?.codigo ?? null,
      costoUnitario: costo !== null && costo > 0 ? costo : null,
      motivo: producto && (costo === null || costo <= 0) ? "el producto de SICAR no tiene costo capturado" : motivo,
      // Las sugerencias son para que una persona confirme; no se usan solas.
      sugerencias,
    };
  });

  const vinculadas = resultado.filter((fila) => fila.codigoSicar);
  return {
    publicaciones: resultado,
    // Costo por número de publicación: sirve aunque la publicación no
    // tenga SKU (vinculada por código de barras o manualmente).
    costosPorPublicacion: Object.fromEntries(
      resultado.filter((fila) => fila.costoUnitario !== null).map((fila) => [fila.publicacion, fila.costoUnitario])
    ),
    resumen: {
      total: resultado.length,
      vinculadas: vinculadas.length,
      conCosto: resultado.filter((fila) => fila.costoUnitario !== null).length,
      porVincular: resultado.filter((fila) => fila.estado === ESTADOS_VINCULO.POR_VINCULAR || fila.estado === ESTADOS_VINCULO.AMBIGUO).length,
    },
    pendientes: resultado.filter((fila) => fila.costoUnitario === null),
  };
}
