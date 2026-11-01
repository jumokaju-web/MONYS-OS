const TIPO_RESULTADO = "conteo_inventario_v1";

function texto(valor) {
  return String(valor ?? "").trim();
}

function numeroFinito(valor) {
  if (valor === "" || valor === null || valor === undefined) return null;
  const numero = Number(valor);
  return Number.isFinite(numero) ? numero : null;
}

export function prepararDetalleConteoInventario(productos = []) {
  return (Array.isArray(productos) ? productos : []).map((producto, indice) => {
    const codigo = texto(producto?.codigo);
    const nombre = texto(producto?.descripcion || producto?.producto) || "Producto sin nombre";
    const existenciaSistema = numeroFinito(producto?.existencia);

    return {
      id: `${codigo || "sin-codigo"}-${indice + 1}`,
      codigo: codigo || null,
      producto: nombre,
      existenciaSistema,
      motivo: texto(producto?.motivoRevision || producto?.nivelInventario) || "REVISAR",
    };
  });
}

export function leerResultadoConteoInventario(resultado) {
  if (!resultado) return null;

  try {
    const registro = typeof resultado === "string" ? JSON.parse(resultado) : resultado;
    if (registro?.tipo !== TIPO_RESULTADO || !Array.isArray(registro?.productos)) return null;
    return registro;
  } catch {
    return null;
  }
}

export function crearCapturaConteoInicial(detalle = [], resultado = null) {
  const guardado = leerResultadoConteoInventario(resultado);
  const porId = new Map((guardado?.productos || []).map((producto) => [texto(producto?.id), producto]));

  return Object.fromEntries((Array.isArray(detalle) ? detalle : []).map((producto) => {
    const previo = porId.get(texto(producto?.id));
    return [producto.id, {
      existenciaFisica: previo?.existenciaFisica ?? "",
      observacion: texto(previo?.observacion),
    }];
  }));
}

export function validarCapturaConteoInventario(detalle = [], capturas = {}) {
  const productos = Array.isArray(detalle) ? detalle : [];
  if (!productos.length) {
    return { valido: false, mensaje: "La tarea no contiene productos estructurados.", productos: [] };
  }

  const preparados = [];
  for (const producto of productos) {
    const captura = capturas?.[producto.id] || {};
    const existenciaFisica = numeroFinito(captura.existenciaFisica);
    if (existenciaFisica === null || existenciaFisica < 0 || !Number.isInteger(existenciaFisica)) {
      return {
        valido: false,
        mensaje: `Captura piezas completas para ${producto.producto || producto.codigo || "cada producto"}.`,
        productos: preparados,
      };
    }

    const existenciaSistema = numeroFinito(producto.existenciaSistema);
    const diferencia = existenciaSistema === null ? null : existenciaFisica - existenciaSistema;
    const observacion = texto(captura.observacion);
    if (diferencia !== null && diferencia !== 0 && !observacion) {
      return {
        valido: false,
        mensaje: `Explica la diferencia de ${producto.producto || producto.codigo || "este producto"}.`,
        productos: preparados,
      };
    }

    preparados.push({
      id: texto(producto.id),
      codigo: texto(producto.codigo) || null,
      producto: texto(producto.producto) || "Producto",
      existenciaSistema,
      existenciaFisica,
      diferencia,
      motivo: texto(producto.motivo) || null,
      observacion: observacion || null,
    });
  }

  return { valido: true, mensaje: "Conteo completo.", productos: preparados };
}

export function crearResultadoConteoInventario(detalle = [], capturas = {}) {
  const validacion = validarCapturaConteoInventario(detalle, capturas);
  if (!validacion.valido) throw new Error(validacion.mensaje);

  return JSON.stringify({
    tipo: TIPO_RESULTADO,
    productos: validacion.productos,
  });
}

