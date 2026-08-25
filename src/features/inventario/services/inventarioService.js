import { supabase } from "../../../supabase";

const TABLA = "productos";

/*
  =========================================================
  PRODUCTOS
  =========================================================
*/

export async function obtenerProductos() {
  const { data, error } = await supabase
    .from(TABLA)
    .select("*")
    .order("id", { ascending: false });

  if (error) {
    throw error;
  }

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

  if (error) {
    throw error;
  }

  return data;
}

/*
  =========================================================
  SUCURSALES
  =========================================================
*/

export async function obtenerSucursalesInventario() {
  const { data, error } = await supabase
    .from("branches")
    .select("id, business_id, name, active")
    .eq("active", true)
    .order("name", { ascending: true });

  if (error) {
    throw new Error(
      `No fue posible cargar las sucursales: ${error.message}`
    );
  }

  return data ?? [];
}

/*
  =========================================================
  EXISTENCIAS POR SUCURSAL
  =========================================================
*/

export async function obtenerExistenciasPorSucursal() {
  const { data, error } = await supabase
    .from("inventario_existencias")
    .select(`
      id,
      organization_id,
      business_id,
      branch_id,
      product_id,
      existencia,
      stock_minimo,
      stock_maximo,
      updated_by,
      created_at,
      updated_at
    `)
    .order("created_at", { ascending: true });

  if (error) {
    throw new Error(
      `No fue posible cargar las existencias por sucursal: ${error.message}`
    );
  }

  return data ?? [];
}

/*
  =========================================================
  TRANSFERIR INVENTARIO
  =========================================================
*/

export async function transferirInventario({
  productId,
  branchOrigenId,
  branchDestinoId,
  cantidad,
}) {
  if (!productId) {
    throw new Error("Selecciona un producto.");
  }

  if (!branchOrigenId) {
    throw new Error("Selecciona la sucursal de origen.");
  }

  if (!branchDestinoId) {
    throw new Error("Selecciona la sucursal de destino.");
  }

  if (branchOrigenId === branchDestinoId) {
    throw new Error(
      "La sucursal de origen y destino deben ser diferentes."
    );
  }

  const cantidadNumero = Number(cantidad);

  if (
    !Number.isInteger(cantidadNumero) ||
    cantidadNumero <= 0
  ) {
    throw new Error(
      "La cantidad debe ser un número entero mayor a cero."
    );
  }

  /*
    Usuario autenticado
  */

  const {
    data: authData,
    error: authError,
  } = await supabase.auth.getUser();

  if (authError) {
    throw new Error(
      `No fue posible identificar al usuario: ${authError.message}`
    );
  }

  const authUserId = authData?.user?.id;

  if (!authUserId) {
    throw new Error(
      "Debes iniciar sesión para transferir inventario."
    );
  }

  /*
    Existencia de origen
  */

  const {
    data: existenciaOrigen,
    error: errorOrigen,
  } = await supabase
    .from("inventario_existencias")
    .select("*")
    .eq("product_id", productId)
    .eq("branch_id", branchOrigenId)
    .single();

  if (errorOrigen) {
    throw new Error(
      `No fue posible consultar la existencia de origen: ${errorOrigen.message}`
    );
  }

  if (
    Number(existenciaOrigen.existencia) <
    cantidadNumero
  ) {
    throw new Error(
      `Existencia insuficiente. Solo hay ${existenciaOrigen.existencia} piezas disponibles.`
    );
  }

  /*
    Existencia de destino
  */

  const {
    data: existenciaDestino,
    error: errorDestino,
  } = await supabase
    .from("inventario_existencias")
    .select("*")
    .eq("product_id", productId)
    .eq("branch_id", branchDestinoId)
    .single();

  if (errorDestino) {
    throw new Error(
      `No fue posible consultar la existencia de destino: ${errorDestino.message}`
    );
  }

  const nuevaExistenciaOrigen =
    Number(existenciaOrigen.existencia) -
    cantidadNumero;

  const nuevaExistenciaDestino =
    Number(existenciaDestino.existencia) +
    cantidadNumero;

  /*
    Descontar del origen
  */

  const {
    error: errorActualizarOrigen,
  } = await supabase
    .from("inventario_existencias")
    .update({
      existencia: nuevaExistenciaOrigen,
      updated_by: authUserId,
      updated_at: new Date().toISOString(),
    })
    .eq("id", existenciaOrigen.id);

  if (errorActualizarOrigen) {
    throw new Error(
      `No fue posible descontar inventario de la sucursal de origen: ${errorActualizarOrigen.message}`
    );
  }

  /*
    Sumar al destino
  */

  const {
    error: errorActualizarDestino,
  } = await supabase
    .from("inventario_existencias")
    .update({
      existencia: nuevaExistenciaDestino,
      updated_by: authUserId,
      updated_at: new Date().toISOString(),
    })
    .eq("id", existenciaDestino.id);

  if (errorActualizarDestino) {
    /*
      Si falla destino, regresamos
      la existencia al origen.
    */

    await supabase
      .from("inventario_existencias")
      .update({
        existencia: existenciaOrigen.existencia,
        updated_by: authUserId,
        updated_at: new Date().toISOString(),
      })
      .eq("id", existenciaOrigen.id);

    throw new Error(
      `No fue posible aumentar inventario en la sucursal destino: ${errorActualizarDestino.message}`
    );
  }

  /*
    Guardar historial
  */

  const {
    data: transferenciaGuardada,
    error: errorTransferencia,
  } = await supabase
    .from("transferencias_inventario")
    .insert({
      organization_id:
        existenciaOrigen.organization_id,

      business_id:
        existenciaOrigen.business_id,

      product_id: productId,

      branch_origen_id:
        branchOrigenId,

      branch_destino_id:
        branchDestinoId,

      cantidad: cantidadNumero,

      estado: "recibida",

      solicitada_por:
        authUserId,

      aprobada_por:
        authUserId,

      recibida_por:
        authUserId,
    })
    .select()
    .single();

  if (errorTransferencia) {
    throw new Error(
      `Las existencias se actualizaron, pero no fue posible registrar el historial: ${errorTransferencia.message}`
    );
  }

  return {
    transferencia: transferenciaGuardada,
    existenciaOrigen: nuevaExistenciaOrigen,
    existenciaDestino: nuevaExistenciaDestino,
  };
}

/*
  =========================================================
  HISTORIAL DE TRANSFERENCIAS
  =========================================================
*/

export async function obtenerTransferenciasInventario() {
  const { data, error } = await supabase
    .from("transferencias_inventario")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(
      `No fue posible cargar las transferencias: ${error.message}`
    );
  }

  return data ?? [];
}