import { supabase } from "../../../supabase";

/*
  Convierte un texto para poder comparar nombres
  aunque tengan mayúsculas, espacios o acentos diferentes.
*/
const normalizarTexto = (valor = "") =>
  String(valor)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();

/*
  Busca un registro por nombre usando diferentes columnas posibles.
  Esto permite trabajar con la estructura actual de MONYS OS.
*/
const buscarPorNombre = (registros, nombreBuscado) => {
  const nombreNormalizado = normalizarTexto(nombreBuscado);

  return registros.find((registro) => {
    const posiblesNombres = [
      registro.name,
      registro.nombre,
      registro.title,
      registro.display_name,
      registro.business_name,
      registro.branch_name,
      registro.account_name,
    ];

    return posiblesNombres.some(
      (nombre) => normalizarTexto(nombre) === nombreNormalizado
    );
  });
};

/*
  Obtiene los datos existentes de una tabla.
*/
const obtenerRegistros = async (tabla) => {
  const { data, error } = await supabase.from(tabla).select("*");

  if (error) {
    throw new Error(
      `No fue posible consultar la tabla ${tabla}: ${error.message}`
    );
  }

  return data || [];
};

/*
  Busca los identificadores necesarios:
  organización, negocio, sucursal y cuenta.
*/
const obtenerContextoMovimiento = async (movimiento) => {
  const [
    organizaciones,
    negocios,
    sucursales,
    cuentas,
  ] = await Promise.all([
    obtenerRegistros("organizations"),
    obtenerRegistros("businesses"),
    obtenerRegistros("branches"),
    obtenerRegistros("accounts"),
  ]);

  const organizacion =
    buscarPorNombre(organizaciones, "Corporativo Monys") ||
    organizaciones[0];

  const negocio =
    buscarPorNombre(negocios, movimiento.negocio) ||
    negocios[0];

  const sucursal =
    buscarPorNombre(sucursales, movimiento.sucursal) ||
    sucursales[0];

  /*
    Primero intenta encontrar una cuenta relacionada
    con el método de pago. Si no existe, toma la primera.
  */
  const cuenta =
    buscarPorNombre(cuentas, movimiento.metodoPago) ||
    cuentas[0];

  if (!organizacion) {
    throw new Error(
      "No existe ninguna organización registrada en Supabase."
    );
  }

  if (!negocio) {
    throw new Error(
      "No existe ningún negocio registrado en Supabase."
    );
  }

  if (!sucursal) {
    throw new Error(
      "No existe ninguna sucursal registrada en Supabase."
    );
  }

  if (!cuenta) {
    throw new Error(
      "No existe ninguna cuenta registrada en Supabase."
    );
  }

  return {
    organizationId: organizacion.id,
    businessId: negocio.id,
    branchId: sucursal.id,
    accountId: cuenta.id,
  };
};

/*
  Guarda una entrada o salida real en cash_movements.
*/
export const guardarMovimientoTesoreria = async (movimiento) => {
  if (!movimiento) {
    throw new Error("No se recibieron datos del movimiento.");
  }

  const monto = Number(movimiento.monto);

  if (!Number.isFinite(monto) || monto <= 0) {
    throw new Error("El monto debe ser mayor a cero.");
  }

  if (!movimiento.concepto?.trim()) {
    throw new Error("El concepto del movimiento es obligatorio.");
  }

  const contexto = await obtenerContextoMovimiento(movimiento);

  const tipo = normalizarTexto(movimiento.tipo);

  const esEntrada = tipo === "entrada";

  const contraparte = esEntrada
    ? movimiento.entregadoPor
    : movimiento.recibidoPor;

  const nuevoMovimiento = {
    organization_id: contexto.organizationId,
    business_id: contexto.businessId,
    branch_id: contexto.branchId,
    account_id: contexto.accountId,

    movement_type: esEntrada ? "ENTRADA" : "SALIDA",
    amount: monto,
    concept: movimiento.concepto.trim(),

    counterparty:
      contraparte?.trim() ||
      movimiento.entregadoPor?.trim() ||
      movimiento.recibidoPor?.trim() ||
      null,

    authorized_by:
      movimiento.recibidoPor?.trim() || null,

    receipt_status: movimiento.comprobante
  ? "Pendiente"
  : "No existe",

    receipt_url: null,
   status: "Pendiente de revisión",
    occurred_at:
      movimiento.fechaRegistro || new Date().toISOString(),
  };

  const { data, error } = await supabase
    .from("cash_movements")
    .insert(nuevoMovimiento)
    .select()
    .single();

  if (error) {
    console.error(
      "Error completo al guardar el movimiento:",
      error
    );

    throw new Error(
      `Supabase no pudo guardar el movimiento: ${error.message}`
    );
  }

  return data;
};

/*
  Obtiene todos los movimientos para historial y saldos.
*/
export const obtenerMovimientosTesoreria = async () => {
  const { data, error } = await supabase
    .from("cash_movements")
    .select("*")
    .order("occurred_at", { ascending: false });

  if (error) {
    throw new Error(
      `No fue posible consultar los movimientos: ${error.message}`
    );
  }

  return data || [];
};
/*
  Actualiza el estado de revisión de un movimiento.
*/
export const actualizarEstadoMovimientoTesoreria = async (
  movimientoId,
  nuevoEstado
) => {
  if (!movimientoId) {
    throw new Error(
      "No se recibió el identificador del movimiento."
    );
  }

  const estadosPermitidos = [
    "Pendiente de revisión",
    "En revisión",
    "Revisado",
    "Cancelado",
  ];

  if (!estadosPermitidos.includes(nuevoEstado)) {
    throw new Error(
      "El estado seleccionado no es válido."
    );
  }

  const { data, error } = await supabase
    .from("cash_movements")
    .update({
      status: nuevoEstado,
    })
    .eq("id", movimientoId)
    .select();

  if (error) {
    console.error(
      "Error al actualizar el estado del movimiento:",
      error
    );

    throw new Error(
      `No fue posible actualizar el estado: ${error.message}`
    );
  }

  if (!data || data.length === 0) {
    throw new Error(
      "Supabase no permitió modificar el movimiento. Probablemente falta un permiso de actualización."
    );
  }

  return data[0];
};