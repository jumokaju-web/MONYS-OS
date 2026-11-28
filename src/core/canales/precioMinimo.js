/*
 * PRECIO MÍNIMO RENTABLE POR PUBLICACIÓN · MONYS OS
 *
 * Separa dos resultados que no son lo mismo:
 * - utilidad comercial = precio sin IVA − comisión − costo fijo − envío
 *   − extras (publicidad, cupón) − costo SICAR. Las retenciones de IVA e
 *   ISR NO son gasto: son impuestos que la plataforma entrega al SAT a
 *   cuenta de la tienda.
 * - efectivo después de retenciones = lo que deposita la plataforma menos
 *   el costo SICAR. Es caja, no utilidad.
 *
 * Calcula:
 * - precio sin pérdida: utilidad comercial ≥ 0;
 * - precio con margen: utilidad comercial ≥ margen objetivo (% del precio
 *   sin IVA) o ≥ ganancia mínima en pesos;
 * - para el precio actual: su evaluación directa (no por comparación con
 *   el mínimo, porque con envío por tramos la utilidad no es monótona) y
 *   el descuento máximo permitido, con los rangos intermedios que no
 *   cumplen.
 *
 * Sin costo SICAR, comisión, IVA trasladado (0 explícito si no cobras IVA)
 * o envío válidos no calcula: dice qué falta. Sin retenciones sí calcula la
 * utilidad comercial, pero el efectivo queda pendiente. Cada promoción y
 * cada descuento sugerido se reevalúan en su precio exacto. Todas las
 * iteraciones están acotadas. Solo sugiere; no cambia precios. Módulo puro.
 */

const MAX_ITERACIONES = 100_000;
const MAX_PROMOCIONES = 200;

function numero(valor) {
  if (valor === null || valor === undefined || typeof valor === "boolean" || typeof valor === "object") return null;
  if (typeof valor === "string" && !valor.trim()) return null;
  const convertido = Number(valor);
  return Number.isFinite(convertido) ? convertido : null;
}

const redondear = (valor) => Math.round(valor * 100) / 100;

/*
 * Valida tramos [{ desde, hasta (exclusivo; null = sin límite), costo }]:
 * contiguos desde 0, sin huecos ni solapes, costos ≥ 0, y el último
 * abierto. Devuelve { envio(precio), errores }.
 */
export function validarTramosEnvio(tramosEnvio = []) {
  const errores = [];
  const tramos = (tramosEnvio || []).map((tramo) => ({ desde: numero(tramo?.desde), hasta: tramo?.hasta === null ? null : numero(tramo?.hasta), costo: numero(tramo?.costo), hastaCrudo: tramo?.hasta }));
  if (!tramos.length) errores.push("no hay tramos de envío");
  tramos.sort((a, b) => (a.desde ?? 0) - (b.desde ?? 0));
  tramos.forEach((tramo, i) => {
    if (tramo.desde === null || tramo.desde < 0) errores.push(`tramo ${i + 1}: inicio inválido`);
    if (tramo.costo === null || tramo.costo < 0) errores.push(`tramo ${i + 1}: costo inválido`);
    if (tramo.hastaCrudo !== null && tramo.hasta === null) errores.push(`tramo ${i + 1}: fin inválido`);
    if (tramo.hasta !== null && tramo.desde !== null && tramo.hasta <= tramo.desde) errores.push(`tramo ${i + 1}: fin menor o igual al inicio`);
    const siguiente = tramos[i + 1];
    if (siguiente && tramo.hasta === null) errores.push(`tramo ${i + 1}: sin límite pero hay tramos después`);
    if (siguiente && tramo.hasta !== null && siguiente.desde !== null && siguiente.desde !== tramo.hasta) {
      errores.push(siguiente.desde > tramo.hasta ? `hueco entre ${tramo.hasta} y ${siguiente.desde}` : `tramos solapados en ${siguiente.desde}`);
    }
  });
  if (tramos.length && tramos[0].desde !== 0) errores.push("los tramos deben empezar en 0");
  if (tramos.length && tramos[tramos.length - 1].hasta !== null) errores.push("el último tramo debe quedar sin límite");
  const envio = (precio) => {
    const tramo = tramos.find((t) => precio >= t.desde && (t.hasta === null || precio < t.hasta));
    return tramo ? tramo.costo : null;
  };
  return { envio, errores };
}

/* Compatibilidad con la versión anterior. */
export function envioPorTramos(tramosEnvio = []) {
  return validarTramosEnvio(tramosEnvio).envio;
}

export function desglosePrecio(precio, p) {
  const sinIva = precio / (1 + p.ivaTrasladadoPct / 100);
  const comision = precio * (p.comisionPct / 100);
  const envio = p.envio(precio);
  if (envio === null || envio === undefined) return null;
  const extras = precio * (p.extrasPct / 100);
  const retencionIva = p.retencionIvaPct === null ? null : precio * (p.retencionIvaPct / 100);
  const retencionIsr = p.retencionIsrPct === null ? null : precio * (p.retencionIsrPct / 100);
  const retencionesConocidas = p.retencionIvaPct !== null && p.retencionIsrPct !== null;
  const utilidadComercial = sinIva - comision - p.costoFijoUnidad - envio - extras - p.costoUnitario;
  return {
    precio,
    precioSinIva: sinIva,
    comision,
    costoFijo: p.costoFijoUnidad,
    envio,
    extras,
    retencionIva,
    retencionIsr,
    costoSicar: p.costoUnitario,
    utilidadComercial,
    margenComercialPct: sinIva > 0 ? (utilidadComercial / sinIva) * 100 : null,
    // Sin retenciones conocidas el efectivo queda pendiente, no en cero.
    depositoPlataforma: retencionesConocidas ? precio - comision - p.costoFijoUnidad - envio - extras - retencionIva - retencionIsr : null,
    efectivoDespuesDeRetenciones: retencionesConocidas
      ? precio - comision - p.costoFijoUnidad - envio - extras - retencionIva - retencionIsr - p.costoUnitario
      : null,
  };
}

const redondearDesglose = (d) =>
  d && Object.fromEntries(Object.entries(d).map(([clave, valor]) => [clave, typeof valor === "number" ? (clave === "margenComercialPct" ? Math.round(valor * 10) / 10 : redondear(valor)) : valor]));

export function precioMinimoRentable(entrada = {}) {
  const faltantes = [];
  const pendientes = [];
  const leer = (clave, { requerido = false, minimo = 0, maximoExclusivo = null, porDefecto = null, etiqueta }) => {
    const crudo = entrada[clave];
    if (crudo === undefined || crudo === null || crudo === "") {
      if (requerido) faltantes.push(etiqueta);
      return porDefecto;
    }
    const valor = numero(crudo);
    if (valor === null || valor < minimo || (maximoExclusivo !== null && valor >= maximoExclusivo)) {
      faltantes.push(`${etiqueta} válido`);
      return null;
    }
    return valor;
  };

  const costo = leer("costoUnitario", { requerido: true, etiqueta: "costo SICAR del producto (vincula la publicación)" });
  if (costo === 0) faltantes.push("costo SICAR mayor a cero");
  const comision = leer("comisionPct", { requerido: true, maximoExclusivo: 100, etiqueta: "% de comisión de la plataforma" });
  // IVA: nunca se asume 0. Si no cobras IVA, captura 0 explícito.
  const ivaTrasladado = leer("ivaTrasladadoPct", { requerido: true, maximoExclusivo: 100, etiqueta: "% de IVA trasladado en el precio (0 si no cobras IVA)" });
  // Retenciones: opcionales para la utilidad comercial; sin ellas el efectivo queda pendiente.
  const retencionIva = leer("retencionIvaPct", { maximoExclusivo: 100, etiqueta: "% de retención de IVA" });
  const retencionIsr = leer("retencionIsrPct", { maximoExclusivo: 100, etiqueta: "% de retención de ISR" });
  if (entrada.retencionIvaPct == null || entrada.retencionIvaPct === "") pendientes.push("% de retención de IVA (efectivo pendiente de calcular)");
  if (entrada.retencionIsrPct == null || entrada.retencionIsrPct === "") pendientes.push("% de retención de ISR (efectivo pendiente de calcular)");
  const fijo = leer("costoFijoUnidad", { porDefecto: 0, etiqueta: "costo fijo por unidad" });
  const extras = leer("extrasPct", { porDefecto: 0, maximoExclusivo: 100, etiqueta: "% de extras (publicidad, cupón)" });
  const margen = leer("margenObjetivoPct", { maximoExclusivo: 100, etiqueta: "margen objetivo" });
  const ganancia = leer("gananciaMinima", { etiqueta: "ganancia mínima" });
  const actual = leer("precioActual", { etiqueta: "precio actual" });
  if (actual === 0) faltantes.push("precio actual mayor a cero");
  const paso = leer("paso", { porDefecto: 1, etiqueta: "paso de cálculo" });
  if (paso !== null && (paso <= 0 || paso > 1000)) faltantes.push("paso de cálculo entre 0 y 1000");
  if (margen === null && ganancia === null && !faltantes.some((t) => t.startsWith("margen") || t.startsWith("ganancia"))) {
    faltantes.push("margen objetivo (%) o ganancia mínima ($)");
  }
  const promociones = Array.isArray(entrada.promociones) ? entrada.promociones : [];
  if (promociones.length > MAX_PROMOCIONES) faltantes.push(`máximo ${MAX_PROMOCIONES} promociones por cálculo`);

  let envio = null;
  const envioFijo = leer("envioFijo", { etiqueta: "envío fijo" });
  if (entrada.tramosEnvio) {
    const { envio: porTramos, errores } = validarTramosEnvio(entrada.tramosEnvio);
    if (errores.length) faltantes.push(...errores.map((e) => `tramos de envío: ${e}`));
    else envio = porTramos;
  } else if (envioFijo !== null) {
    envio = () => envioFijo;
  } else if (!faltantes.some((t) => t.startsWith("envío"))) {
    faltantes.push("costo de envío a cargo del vendedor (tramos o fijo)");
  }

  if (faltantes.length) return { calculable: false, faltantes: [...new Set(faltantes)] };

  const p = {
    costoUnitario: costo, comisionPct: comision, retencionIvaPct: retencionIva, retencionIsrPct: retencionIsr,
    ivaTrasladadoPct: ivaTrasladado, costoFijoUnidad: fijo, extrasPct: extras, envio,
  };
  const metaPara = (d) => (margen !== null ? d.precioSinIva * (margen / 100) : ganancia);
  const sinPerdida = (d) => Boolean(d) && d.utilidadComercial >= -1e-9;
  const conMargen = (d) => Boolean(d) && d.utilidadComercial >= metaPara(d) - 1e-9;
  const veredictoDe = (d) => (!d ? "sin_tramo_de_envio" : !sinPerdida(d) ? "pierde_dinero" : !conMargen(d) ? "debajo_del_margen" : "cumple");

  // Un solo barrido acotado sobre una rejilla entera (sin acumular errores
  // de punto flotante): mínimos y rangos intermedios salen del mismo paso.
  const inicio = Math.ceil(costo / paso - 1e-9);
  const fin = Math.floor(Math.max(costo * 20, 10_000, actual ?? 0) / paso + 1e-9);
  if (fin - inicio + 1 > MAX_ITERACIONES) {
    return { calculable: false, faltantes: [`paso de cálculo más grande (máximo ${MAX_ITERACIONES} evaluaciones)`] };
  }
  const precioEn = (k) => Math.round(k * paso * 1e6) / 1e6;
  const marcas = [];
  let kSinPerdida = null;
  let kConMargen = null;
  for (let k = inicio; k <= fin; k++) {
    const d = desglosePrecio(precioEn(k), p);
    const marca = { sinPerdida: sinPerdida(d), conMargen: conMargen(d) };
    marcas.push(marca);
    if (kSinPerdida === null && marca.sinPerdida) kSinPerdida = k;
    if (kConMargen === null && marca.conMargen) kConMargen = k;
  }
  const precioSinPerdida = kSinPerdida === null ? null : precioEn(kSinPerdida);
  const precioConMargen = kConMargen === null ? null : precioEn(kConMargen);

  const evaluar = (precio) => {
    const d = desglosePrecio(precio, p);
    return { precio: redondear(precio), veredicto: veredictoDe(d), desglose: redondearDesglose(d) };
  };

  let evaluacionActual = null;
  if (actual !== null) {
    const veredicto = veredictoDe(desglosePrecio(actual, p));
    const descuento = (kMinimo, clave, criterio) => {
      if (kMinimo === null || precioEn(kMinimo) > actual) return { maximoPct: 0, precioMinimo: kMinimo === null ? null : precioEn(kMinimo), rangosQueNoCumplen: [] };
      // Rangos de la rejilla entre el mínimo y el actual que no cumplen.
      const kActual = Math.floor(actual / paso + 1e-9);
      const rangos = [];
      let abierto = null;
      for (let k = kMinimo; k <= kActual; k++) {
        const ok = marcas[k - inicio][clave];
        if (!ok && abierto === null) abierto = k;
        if (ok && abierto !== null) { rangos.push([redondear(precioEn(abierto)), redondear(precioEn(k - 1))]); abierto = null; }
      }
      if (abierto !== null) rangos.push([redondear(precioEn(abierto)), redondear(actual)]);
      // El descuento se redondea a 0.1% y se reevalúa en su precio exacto;
      // si ese precio exacto no cumple, se baja el descuento (acotado).
      let pct = Math.floor(((actual - precioEn(kMinimo)) / actual) * 1000) / 10;
      let exacto = actual * (1 - pct / 100);
      for (let intentos = 0; pct > 0 && !criterio(desglosePrecio(exacto, p)) && intentos < 1000; intentos++) {
        pct = Math.round((pct - 0.1) * 10) / 10;
        exacto = actual * (1 - pct / 100);
      }
      if (!criterio(desglosePrecio(exacto, p))) pct = 0;
      return { maximoPct: pct, precioMinimo: precioEn(kMinimo), precioExactoConDescuento: redondear(actual * (1 - pct / 100)), rangosQueNoCumplen: rangos };
    };
    evaluacionActual = {
      ...evaluar(actual),
      descuentoSinPerdida: veredicto === "pierde_dinero" || veredicto === "sin_tramo_de_envio" ? null : descuento(kSinPerdida, "sinPerdida", sinPerdida),
      descuentoConMargen: veredicto === "cumple" ? descuento(kConMargen, "conMargen", conMargen) : null,
    };
  }

  // Cada promoción se evalúa en su precio exacto (no en la rejilla).
  const evaluacionPromociones = promociones.map((promo, i) => {
    const nombre = String(promo?.nombre ?? `promoción ${i + 1}`);
    const precioDirecto = numero(promo?.precio);
    const pct = numero(promo?.descuentoPct);
    let precio = null;
    if (precioDirecto !== null && precioDirecto > 0) precio = precioDirecto;
    else if (pct !== null && pct >= 0 && pct < 100 && actual !== null) precio = actual * (1 - pct / 100);
    if (precio === null) return { nombre, calculable: false, faltante: actual === null && pct !== null ? "precio actual para aplicar el descuento" : "precio o % de descuento válido" };
    return { nombre, calculable: true, ...evaluar(precio) };
  });

  return {
    calculable: precioConMargen !== null || precioSinPerdida !== null,
    tipo: "SUGERENCIA",
    precioSinPerdida,
    precioConMargen,
    desgloseSinPerdida: precioSinPerdida === null ? null : redondearDesglose(desglosePrecio(precioSinPerdida, p)),
    desgloseConMargen: precioConMargen === null ? null : redondearDesglose(desglosePrecio(precioConMargen, p)),
    actual: evaluacionActual,
    promociones: evaluacionPromociones,
    pendientes,
    evaluaciones: fin - inicio + 1,
    motivo: precioConMargen === null ? "Ningún precio razonable alcanza el margen con estos costos." : "",
    supuestos: [
      ivaTrasladado > 0
        ? `El precio incluye ${ivaTrasladado}% de IVA, que no es ingreso.`
        : "Capturaste 0% de IVA trasladado: el precio completo se toma como ingreso.",
      "Las retenciones de IVA e ISR no son gasto: reducen el depósito, no la utilidad comercial.",
    ],
    nota: "Sugerencia de precio. MONYS OS no cambia precios: la decisión es de la propietaria.",
  };
}
