function numeroONulo(valor) {
  if (valor === null || valor === undefined || String(valor).trim() === "") return null;
  const numero = Number(valor);
  return Number.isFinite(numero) ? numero : null;
}

function normalizarCaja(valor) {
  const texto = String(valor || "").trim().toUpperCase().replace(/[^A-Z0-9]+/g, "_");
  if (/(^|_)1($|_)/.test(texto)) return "CAJA_1";
  if (/(^|_)2($|_)/.test(texto)) return "CAJA_2";
  return texto || "SIN_CAJA";
}

function cajasEsperadas(cierre = {}) {
  return (Array.isArray(cierre?.sucursales) ? cierre.sucursales : []).flatMap((sucursal) =>
    (Array.isArray(sucursal?.cajas) ? sucursal.cajas : [])
      .filter((caja) => caja?.cajaId && caja.cajaId !== "SIN_CAJA")
      .map((caja) => ({
        branchId: String(sucursal.branchId),
        sucursal: sucursal.nombre || "Sucursal",
        cajaId: caja.cajaId,
        nombre: caja.nombre || caja.cajaId,
      })),
  );
}

function fechaMasReciente(cortes = []) {
  return cortes.map((corte) => String(corte?.fecha || "").slice(0, 10)).filter(Boolean).sort().at(-1) || null;
}

function ordenCorte(corte = {}) {
  return `${corte.fecha || ""}T${corte.hora || "00:00:00"}|${corte.importadoEn || ""}`;
}

export function resumirCortesOficialesParaDisponibilidad({
  importaciones = [],
  cierre = {},
  hoy,
} = {}) {
  const esperadas = cajasEsperadas(cierre);
  const cortes = (Array.isArray(importaciones) ? importaciones : []).flatMap((importacion) =>
    (Array.isArray(importacion?.cortes) ? importacion.cortes : []).map((corte) => ({
      ...corte,
      branchId: String(importacion.branch_id || ""),
      importacionId: importacion.id,
      archivoOriginal: importacion.archivo_original,
      importadoEn: importacion.created_at,
      cajaId: normalizarCaja(corte?.caja),
    })),
  );
  const cortesHoy = cortes
    .filter((corte) => String(corte.fecha || "").slice(0, 10) === hoy)
    .sort((a, b) => ordenCorte(b).localeCompare(ordenCorte(a)));
  const ultimos = new Map();
  for (const corte of cortesHoy) {
    const clave = `${corte.branchId}|${corte.cajaId}`;
    if (!ultimos.has(clave)) ultimos.set(clave, corte);
  }

  const detalle = esperadas.map((esperada) => {
    const corte = ultimos.get(`${esperada.branchId}|${esperada.cajaId}`) || null;
    const efectivo = corte?.metodos?.find((metodo) => metodo?.clave === "efectivo") || null;
    const contado = numeroONulo(efectivo?.contado);
    const retirado = numeroONulo(efectivo?.retirado);
    const diferencia = numeroONulo(corte?.diferenciaOperativa);
    const completo = Boolean(corte)
      && contado !== null
      && retirado !== null
      && diferencia !== null
      && corte.desgloseContadoCoincide !== false;
    return {
      ...esperada,
      corte,
      estado: !corte ? "faltante" : completo ? "completo" : "incompleto",
      efectivoContado: contado,
      efectivoRetirado: retirado,
      efectivoEnCaja: completo ? Math.max(0, contado - retirado) : null,
      diferencia,
    };
  });

  const completos = detalle.filter((item) => item.estado === "completo");
  const faltantes = detalle.filter((item) => item.estado === "faltante");
  const incompletos = detalle.filter((item) => item.estado === "incompleto");
  const completo = esperadas.length > 0 && completos.length === esperadas.length;
  const archivos = [...new Set(cortes.map((corte) => corte.archivoOriginal).filter(Boolean))];

  return {
    disponible: cortes.length > 0,
    vigente: cortesHoy.length > 0,
    completo,
    fechaUltimoCorte: fechaMasReciente(cortes),
    archivos,
    cajasEsperadas: esperadas.length,
    cajasEncontradas: completos.length,
    cajasFaltantes: faltantes.length,
    cajasIncompletas: incompletos.length,
    efectivoEnCaja: completo
      ? completos.reduce((total, item) => total + item.efectivoEnCaja, 0)
      : null,
    efectivoRetirado: completo
      ? completos.reduce((total, item) => total + item.efectivoRetirado, 0)
      : null,
    diferencias: completos.filter((item) => Math.abs(item.diferencia) > 0.009).length,
    detalle,
  };
}
