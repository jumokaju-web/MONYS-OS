import { supabase } from "../../../supabase";

export async function crearOrdenCompra({
  titulo,
  descripcion,
  prioridad,
  area,
  costoEstimado,
  origenDecisionId,
}) {
  const orden = {
    titulo:
      titulo || "Orden de compra",

    descripcion:
      descripcion || "",

    prioridad:
      prioridad || "MEDIA",

    area:
      area || "Inventario",

    costo_estimado:
      Number(costoEstimado || 0),

    estado: "PENDIENTE",

    origen_decision_id:
      origenDecisionId,
  };

  const { data, error } =
    await supabase
      .from("ordenes_compra")
      .insert([orden])
      .select()
      .single();

  if (error) {
    throw new Error(
      `No se pudo crear la orden de compra: ${error.message}`
    );
  }

  return data;
}