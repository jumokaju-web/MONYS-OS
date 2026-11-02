import { claveFechaLocal } from "./planSemanalContenidoMarketing.js";

export function resumirMarketingHoy({ publicaciones = [], resultados = [], fecha = new Date() } = {}) {
  const hoy = claveFechaLocal(fecha);
  const lista = Array.isArray(publicaciones) ? publicaciones : [];
  const idsConResultado = new Set((Array.isArray(resultados) ? resultados : []).map((item) => item?.publicacion_id));
  const pendientesAprobacion = lista.filter((item) => item?.estado === "PENDIENTE_APROBACION");
  const programadasHoy = lista.filter((item) =>
    item?.programada_para && claveFechaLocal(item.programada_para) === hoy &&
    ["APROBADA", "PROGRAMADA", "PUBLICANDO"].includes(item?.estado)
  );
  const publicadasHoy = lista.filter((item) =>
    item?.publicada_en && claveFechaLocal(item.publicada_en) === hoy && item?.estado === "PUBLICADA"
  );
  const resultadosPendientes = lista.filter((item) =>
    item?.estado === "PUBLICADA" && !idsConResultado.has(item.id)
  );

  let prioridad = {
    tipo: "PLANEAR",
    titulo: "Preparar la pieza de hoy",
    detalle: "El plan semanal está listo para convertirse en contenido.",
  };
  if (resultadosPendientes.length) prioridad = {
    tipo: "MEDIR",
    titulo: `Registrar resultado de ${resultadosPendientes.length} publicación${resultadosPendientes.length === 1 ? "" : "es"}`,
    detalle: "Captura alcance, mensajes, pedidos, ventas e inversión antes de repetir o aumentar presupuesto.",
  };
  if (programadasHoy.length) prioridad = {
    tipo: "PUBLICAR",
    titulo: `Confirmar ${programadasHoy.length} publicación${programadasHoy.length === 1 ? "" : "es"} de hoy`,
    detalle: "Publica manualmente y pega el enlace real; agendar en MONYS no significa que ya salió en la red.",
  };
  if (pendientesAprobacion.length) prioridad = {
    tipo: "REVISAR",
    titulo: `Resolver ${pendientesAprobacion.length} propuesta${pendientesAprobacion.length === 1 ? "" : "s"}`,
    detalle: "Aprobar, pedir cambios o rechazar antes de preparar nuevas publicaciones.",
  };

  return {
    hoy,
    pendientesAprobacion,
    programadasHoy,
    publicadasHoy,
    resultadosPendientes,
    prioridad,
  };
}
