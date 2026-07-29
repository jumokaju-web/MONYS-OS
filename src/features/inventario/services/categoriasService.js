import { supabase } from "../../../supabase";

const TABLA = "categorias";

export async function obtenerCategoriasActivas() {
  const { data, error } = await supabase
    .from(TABLA)
    .select("id, nombre")
    .eq("activa", true)
    .order("nombre", { ascending: true });

  if (error) {
    throw error;
  }

  return data ?? [];
}