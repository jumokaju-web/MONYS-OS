function numero(valor) {
  if (valor === null || valor === undefined || valor === "") return null;
  const resultado = Number(valor);
  return Number.isFinite(resultado) && resultado >= 0 ? resultado : null;
}

export function analizarResultadoCampana(resultado = {}) {
  const ventas = numero(resultado.ventas_atribuidas);
  const gasto = numero(resultado.gasto_real);
  const alcance = numero(resultado.alcance);
  const mensajes = numero(resultado.mensajes);
  const pedidos = numero(resultado.pedidos);

  if ([ventas, gasto, alcance, mensajes, pedidos].some((valor) => valor === null)) {
    return { accion: "REVISAR", titulo: "Revisar datos", detalle: "Hay cifras faltantes o inválidas; no se calcula rendimiento." };
  }

  if (gasto > 0) {
    const roas = ventas / gasto;
    if (roas >= 3) return { accion: "ESCALAR", titulo: "Escalar con control", detalle: "La venta reportada supera tres veces la inversión. Aumenta gradualmente y vuelve a medir.", roas };
    if (roas >= 1.5) return { accion: "MANTENER", titulo: "Mantener y probar", detalle: "La campaña responde; conserva el presupuesto y prueba una variante.", roas };
    if (roas >= 1) return { accion: "AJUSTAR", titulo: "Ajustar antes de invertir más", detalle: "La venta reportada apenas cubre la inversión publicitaria; mejora oferta o público.", roas };
    return { accion: "PAUSAR", titulo: "Pausar y corregir", detalle: "La venta reportada es menor que la inversión; no aumentes presupuesto todavía.", roas };
  }

  if (pedidos > 0 || ventas > 0) return { accion: "REPETIR", titulo: "Repetir contenido ganador", detalle: "El contenido orgánico reportó pedidos o ventas sin inversión publicitaria." };
  if (alcance > 0 && mensajes === 0) return { accion: "AJUSTAR", titulo: "Mejorar llamado a comprar", detalle: "Hubo alcance, pero no mensajes reportados. Prueba una oferta y una instrucción más clara." };
  return { accion: "MEDIR", titulo: "Seguir midiendo", detalle: "Todavía no hay señales suficientes para cambiar la estrategia." };
}
