/*
 * PRECIO MÍNIMO RENTABLE POR PUBLICACIÓN · MONYS OS
 *
 * Calcula el precio más bajo que, después de comisión, costo fijo por
 * unidad, envío a cargo del vendedor, retenciones de impuestos, extras
 * (publicidad, cupones) y costo SICAR, deja el margen objetivo.
 *
 *   recibe(p) = p − p·comisión − fijo − envío(p) − p·retención − p·extras
 *   utilidad(p) = recibe(p) − costo
 *   meta: utilidad(p) ≥ p·margen (o ≥ ganancia mínima en pesos)
 *
 * El envío puede depender del precio (tramos): se resuelve por búsqueda,
 * no con una fórmula cerrada. Sin costo SICAR, retención o envío
 * conocidos, NO se calcula: se devuelve qué falta. Solo sugiere; no
 * cambia precios. Módulo puro.
 */

function numero(valor) {
  if (valor === null || valor === undefined || typeof valor === "boolean" || typeof valor === "object") return null;
  if (typeof valor === "string" && !valor.trim()) return null;
  const convertido = Number(valor);
  return Number.isFinite(convertido) ? convertido : null;
}

const redondear = (valor) => Math.round(valor * 100) / 100;

/*
 * tramosEnvio: [{ desde, hasta (exclusivo, null = sin límite), costo }]
 * con el costo de envío a cargo del vendedor según el precio.
 */
export function envioPorTramos(tramosEnvio = []) {
  const tramos = (tramosEnvio || [])
    .map((tramo) => ({ desde: numero(tramo.desde) ?? 0, hasta: numero(tramo.hasta), costo: numero(tramo.costo) }))
    .filter((tramo) => tramo.costo !== null && tramo.costo >= 0)
    .sort((a, b) => a.desde - b.desde);
  return (precio) => {
    const tramo = tramos.find((t) => precio >= t.desde && (t.hasta === null || precio < t.hasta));
    return tramo ? tramo.costo : null;
  };
}

export function desglosePrecio(precio, { costoUnitario, comisionPct, costoFijoUnidad = 0, envio, retencionPct, extrasPct = 0 }) {
  const comision = precio * (comisionPct / 100);
  const costoEnvio = envio(precio);
  if (costoEnvio === null) return null;
  const retenciones = precio * (retencionPct / 100);
  const extras = precio * (extrasPct / 100);
  const recibe = precio - comision - costoFijoUnidad - costoEnvio - retenciones - extras;
  const utilidad = recibe - costoUnitario;
  return {
    precio: redondear(precio),
    comision: redondear(comision),
    costoFijo: redondear(costoFijoUnidad),
    envio: redondear(costoEnvio),
    retenciones: redondear(retenciones),
    extras: redondear(extras),
    recibe: redondear(recibe),
    costoSicar: redondear(costoUnitario),
    utilidad: redondear(utilidad),
    margenPct: precio > 0 ? Math.round((utilidad / precio) * 1000) / 10 : null,
  };
}

export function precioMinimoRentable({
  costoUnitario,
  comisionPct,
  costoFijoUnidad = 0,
  tramosEnvio = null,
  envioFijo = null,
  retencionPct,
  extrasPct = 0,
  margenObjetivoPct = null,
  gananciaMinima = null,
  precioActual = null,
  paso = 1,
} = {}) {
  const costo = numero(costoUnitario);
  const comision = numero(comisionPct);
  const fijo = numero(costoFijoUnidad) ?? 0;
  const retencion = numero(retencionPct);
  const extras = numero(extrasPct) ?? 0;
  const margen = numero(margenObjetivoPct);
  const ganancia = numero(gananciaMinima);
  const actual = numero(precioActual);

  const faltantes = [];
  if (costo === null || costo <= 0) faltantes.push("costo SICAR del producto (vincula la publicación)");
  if (comision === null || comision < 0 || comision >= 100) faltantes.push("% de comisión de la plataforma");
  if (retencion === null || retencion < 0 || retencion >= 100) faltantes.push("% de retenciones de ISR/IVA");
  if (margen === null && ganancia === null) faltantes.push("margen objetivo (%) o ganancia mínima ($)");
  if (margen !== null && (margen < 0 || margen >= 100)) faltantes.push("margen objetivo entre 0 y 99%");
  const fijoEnvio = numero(envioFijo);
  if (!tramosEnvio && fijoEnvio === null) faltantes.push("costo de envío a cargo del vendedor (tramos o fijo)");
  if (faltantes.length) return { calculable: false, faltantes };

  const envio = tramosEnvio ? envioPorTramos(tramosEnvio) : () => fijoEnvio;
  const opciones = { costoUnitario: costo, comisionPct: comision, costoFijoUnidad: fijo, envio, retencionPct: retencion, extrasPct: extras };
  const cumple = (precio) => {
    const d = desglosePrecio(precio, opciones);
    if (!d) return null;
    const meta = margen !== null ? precio * (margen / 100) : ganancia;
    return d.utilidad >= meta - 1e-9;
  };

  // Con envío por tramos la utilidad puede bajar al cruzar un umbral, así
  // que se busca el primer precio que cumple recorriendo hacia arriba.
  const limite = Math.max(costo * 20, 10000);
  let minimo = null;
  let sinTramo = false;
  for (let precio = Math.ceil(costo / paso) * paso; precio <= limite; precio += paso) {
    const resultado = cumple(precio);
    if (resultado === null) {
      sinTramo = true;
      continue;
    }
    if (resultado) {
      minimo = precio;
      break;
    }
  }

  if (minimo === null) {
    return {
      calculable: false,
      faltantes: sinTramo ? ["tramo de envío para algún rango de precio"] : [],
      motivo: "Ningún precio razonable alcanza el margen con estos costos.",
    };
  }

  const desglose = desglosePrecio(minimo, opciones);
  const actualDesglose = actual !== null ? desglosePrecio(actual, opciones) : null;
  return {
    calculable: true,
    tipo: "SUGERENCIA",
    precioMinimo: minimo,
    desglose,
    actual: actualDesglose,
    veredicto:
      actualDesglose === null
        ? null
        : actualDesglose.utilidad < 0
          ? "pierde_dinero"
          : actual < minimo
            ? "debajo_del_margen"
            : "cumple",
    diferencia: actual !== null ? redondear(minimo - actual) : null,
    nota: "Sugerencia de precio. MONYS OS no cambia precios: la decisión es de la propietaria.",
  };
}
