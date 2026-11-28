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
 * Sin costo SICAR, comisión, retenciones o envío válidos no calcula: dice
 * qué falta. Solo sugiere; no cambia precios. Módulo puro.
 */

const MAX_ITERACIONES = 100_000;

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
  const retencionIva = precio * (p.retencionIvaPct / 100);
  const retencionIsr = precio * (p.retencionIsrPct / 100);
  const depositoPlataforma = precio - comision - p.costoFijoUnidad - envio - extras - retencionIva - retencionIsr;
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
    depositoPlataforma,
    efectivoDespuesDeRetenciones: depositoPlataforma - p.costoUnitario,
  };
}

const redondearDesglose = (d) =>
  d && Object.fromEntries(Object.entries(d).map(([clave, valor]) => [clave, typeof valor === "number" ? (clave === "margenComercialPct" ? Math.round(valor * 10) / 10 : redondear(valor)) : valor]));

export function precioMinimoRentable(entrada = {}) {
  const faltantes = [];
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
  const retencionIva = leer("retencionIvaPct", { requerido: true, maximoExclusivo: 100, etiqueta: "% de retención de IVA" });
  const retencionIsr = leer("retencionIsrPct", { requerido: true, maximoExclusivo: 100, etiqueta: "% de retención de ISR" });
  const ivaTrasladado = leer("ivaTrasladadoPct", { porDefecto: 0, maximoExclusivo: 100, etiqueta: "% de IVA trasladado" });
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
  const sinPerdida = (d) => d.utilidadComercial >= -1e-9;
  const conMargen = (d) => d.utilidadComercial >= metaPara(d) - 1e-9;

  const limite = Math.max(costo * 20, 10_000);
  if ((limite - costo) / paso > MAX_ITERACIONES) {
    return { calculable: false, faltantes: [`paso de cálculo más grande (máximo ${MAX_ITERACIONES} evaluaciones)`] };
  }
  const buscar = (criterio) => {
    for (let precio = Math.ceil(costo / paso) * paso; precio <= limite; precio += paso) {
      const d = desglosePrecio(precio, p);
      if (d && criterio(d)) return precio;
    }
    return null;
  };
  const precioSinPerdida = buscar(sinPerdida);
  const precioConMargen = buscar(conMargen);

  let evaluacionActual = null;
  if (actual !== null) {
    const d = desglosePrecio(actual, p);
    const veredicto = !d ? "sin_tramo_de_envio" : !sinPerdida(d) ? "pierde_dinero" : !conMargen(d) ? "debajo_del_margen" : "cumple";
    // Descuento máximo: el precio más bajo ≤ actual que cumple, y los
    // rangos intermedios que no cumplen (el envío por tramos puede hacer
    // que un precio menor vuelva a cumplir).
    const rangoQueNoCumple = (criterio, desde) => {
      const huecos = [];
      let inicio = null;
      for (let precio = desde; precio <= actual + 1e-9; precio += paso) {
        const ok = (() => { const x = desglosePrecio(precio, p); return x && criterio(x); })();
        if (!ok && inicio === null) inicio = precio;
        if (ok && inicio !== null) { huecos.push([redondear(inicio), redondear(precio - paso)]); inicio = null; }
      }
      if (inicio !== null) huecos.push([redondear(inicio), redondear(actual)]);
      return huecos;
    };
    const descuento = (minimo, criterio) => {
      if (minimo === null || minimo > actual) return { maximoPct: 0, precioMinimo: minimo, rangosQueNoCumplen: [] };
      return {
        maximoPct: Math.floor(((actual - minimo) / actual) * 1000) / 10,
        precioMinimo: minimo,
        rangosQueNoCumplen: rangoQueNoCumple(criterio, minimo),
      };
    };
    evaluacionActual = {
      veredicto,
      desglose: redondearDesglose(d),
      descuentoSinPerdida: veredicto === "pierde_dinero" ? null : descuento(precioSinPerdida, sinPerdida),
      descuentoConMargen: veredicto === "cumple" ? descuento(precioConMargen, conMargen) : null,
    };
  }

  return {
    calculable: precioConMargen !== null || precioSinPerdida !== null,
    tipo: "SUGERENCIA",
    precioSinPerdida,
    precioConMargen,
    desgloseSinPerdida: precioSinPerdida === null ? null : redondearDesglose(desglosePrecio(precioSinPerdida, p)),
    desgloseConMargen: precioConMargen === null ? null : redondearDesglose(desglosePrecio(precioConMargen, p)),
    actual: evaluacionActual,
    motivo: precioConMargen === null ? "Ningún precio razonable alcanza el margen con estos costos." : "",
    supuestos: [
      ivaTrasladado > 0
        ? `El precio incluye ${ivaTrasladado}% de IVA, que no es ingreso.`
        : "El precio se toma sin desglose de IVA (régimen sin IVA trasladado o por confirmar con el contador).",
      "Las retenciones de IVA e ISR no son gasto: reducen el depósito, no la utilidad comercial.",
    ],
    nota: "Sugerencia de precio. MONYS OS no cambia precios: la decisión es de la propietaria.",
  };
}
