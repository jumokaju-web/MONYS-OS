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

/*
  Convierte las fechas numéricas de Excel/SICAR
  a una fecha válida para Supabase.
*/
const convertirFechaSicarAISO = (fecha, hora) => {
  const fechaNumerica = Number(fecha);
  const horaNumerica = Number(hora);

  if (
    Number.isFinite(fechaNumerica) &&
    fechaNumerica > 10000
  ) {
    let fechaExcel = fechaNumerica;

    const fechaYaTieneHora =
      fechaNumerica % 1 !== 0;

    if (
      !fechaYaTieneHora &&
      Number.isFinite(horaNumerica) &&
      horaNumerica > 0 &&
      horaNumerica < 1
    ) {
      fechaExcel += horaNumerica;
    }

    const milisegundos =
      (fechaExcel - 25569) * 86400 * 1000;

    return new Date(milisegundos).toISOString();
  }

  const fechaTexto = String(fecha ?? "").trim();

  if (fechaTexto) {
    const fechaInterpretada = new Date(fechaTexto);

    if (!Number.isNaN(fechaInterpretada.getTime())) {
      return fechaInterpretada.toISOString();
    }
  }

  return new Date().toISOString();
};

/*
  Guarda en bloque los movimientos importados desde SICAR.
  Consulta el contexto una sola vez para evitar cientos
  de solicitudes innecesarias a Supabase.
*/
export const guardarMovimientosTesoreriaMasivos = async (
  movimientos = []
) => {
  if (
    !Array.isArray(movimientos) ||
    movimientos.length === 0
  ) {
    return 0;
  }

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
    buscarPorNombre(
      organizaciones,
      "Corporativo Monys"
    ) || organizaciones[0];

  const negocioPredeterminado = negocios[0];
  const sucursalPredeterminada = sucursales[0];
  const cuentaPredeterminada = cuentas[0];

  if (!organizacion) {
    throw new Error(
      "No existe ninguna organización registrada en Supabase."
    );
  }

  if (!negocioPredeterminado) {
    throw new Error(
      "No existe ningún negocio registrado en Supabase."
    );
  }

  if (!sucursalPredeterminada) {
    throw new Error(
      "No existe ninguna sucursal registrada en Supabase."
    );
  }

  if (!cuentaPredeterminada) {
    throw new Error(
      "No existe ninguna cuenta registrada en Supabase."
    );
  }

 
const registros = movimientos
  .map((movimiento) => {
    const monto = Math.abs(
      Number(
        movimiento.monto ??
          movimiento.total ??
          0
      )
    );

    if (!Number.isFinite(monto) || monto <= 0) {
      return null;
    }

    const tipoNormalizado = normalizarTexto(
      movimiento.tipoMovimiento ||
        movimiento.tipo
    );

    const esEntrada =
      tipoNormalizado === "entrada";

    const negocio =
      buscarPorNombre(
        negocios,
        movimiento.negocio
      ) || negocioPredeterminado;

    const sucursal =
      buscarPorNombre(
        sucursales,
        movimiento.sucursal ||
          movimiento.caja
      ) || sucursalPredeterminada;

    const cuenta =
      buscarPorNombre(
        cuentas,
        movimiento.metodoPago
      ) || cuentaPredeterminada;

    const concepto = String(
      movimiento.comentario ||
        movimiento.descripcion ||
        "Movimiento importado desde SICAR"
    ).trim();

    const usuario = String(
      movimiento.usuario || ""
    ).trim();

    return {
      organization_id: organizacion.id,
      business_id: negocio.id,
      branch_id: sucursal.id,
      account_id: cuenta.id,

      movement_type: esEntrada
        ? "ENTRADA"
        : "SALIDA",

      amount: monto,
      concept: concepto,

      counterparty: usuario || null,
      authorized_by: usuario || null,

      receipt_status: "No existe",
      receipt_url: null,

      status: "Pendiente de revisión",

      registered_by: null,

      occurred_at: convertirFechaSicarAISO(
        movimiento.fecha,
        movimiento.hora
      ),
    };
  })
  .filter(Boolean);

if (registros.length === 0) {
  throw new Error(
    "No se encontraron movimientos con monto válido para guardar."
  );
}

const tamañoLote = 200;

for (
  let inicio = 0;
  inicio < registros.length;
  inicio += tamañoLote
) {
  const lote = registros.slice(
    inicio,
    inicio + tamañoLote
  );

  const { error } = await supabase
    .from("cash_movements")
    .insert(lote);

  if (error) {
    console.error(
      "Error al guardar movimientos SICAR:",
      error
    );

    throw new Error(
      `No se pudieron guardar los movimientos de caja: ${error.message}`
    );
  }
}

return registros.length;
};