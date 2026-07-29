import { supabase } from "../../../supabase";

const TABLA = "productos";

export async function obtenerProductos() {
  const { data, error } = await supabase
    .from(TABLA)
    .select("*")
    .order("id", { ascending: false });

  if (error) throw error;

  return data ?? [];
}

export async function agregarProducto(producto) {
  const { data, error } = await supabase
    .from(TABLA)
    .insert([
      {
        sku: producto.sku,
        codigo_barras: producto.codigo_barras,
        nombre: producto.nombre,
        marca: producto.marca,
        categoria: producto.categoria,
        proveedor: producto.proveedor,
        costo: producto.costo,
        precio: producto.precio,
        precio_mayoreo: producto.precio_mayoreo,
        existencia: producto.existencia,
        stock_minimo: producto.stock_minimo,
        estado: producto.estado,
      },
    ])
    .select()
    .single();

  if (error) throw error;

  return data;
}