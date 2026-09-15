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
  Crea una firma estable con las palabras del concepto.
  Permite reconocer como iguales textos como
  "karla comida" y "comida karla".
*/
const crearFirmaConcepto = (valor = "") =>
  normalizarTexto(valor)
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter(Boolean)
    .sort()
    .join(" ");

const tienePatronSeguro = (valor = "") =>
  crearFirmaConcepto(valor)
    .split(" ")
    .filter(Boolean).length >= 2;

/*
  Busca un registro por nombre usando diferentes columnas posibles.
  Esto permite trabajar con la estructura actual de MONYS OS.
*/
const buscarPorNombre = (registros, nombreBuscado) => {
  const nombreNormalizado =
    normalizarTexto(nombreBuscado);

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
      (nombre) =>
        normalizarTexto(nombre) ===
        nombreNormalizado
    );
  });
};

/*
  Obtiene los datos existentes de una tabla.
*/
const obtenerRegistros = async (tabla) => {
  const { data, error } = await supabase
    .from(tabla)
    .select("*");

  if (error) {
    throw new Error(
      `No fue posible consultar la tabla ${tabla}: ${error.message}`
    );
  }

  return data || [];
};

/*
  Obtiene el usuario autenticado actual.
*/
const obtenerUsuarioAutenticado = async () => {
  const {
    data,
    error,
  } = await supabase.auth.getUser();

  if (error) {
    throw new Error(
      `No fue posible identificar al usuario autenticado: ${error.message}`
    );
  }

  const authUser = data?.user;

  if (!authUser?.id) {
    throw new Error(
      "Debes iniciar sesión para realizar esta operación."
    );
  }

  return authUser;
};

/*
  Busca los identificadores necesarios:
  organización, negocio, sucursal y cuenta.
*/
const obtenerContextoMovimiento = async (
  movimiento
) => {
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

  const negocio =
    buscarPorNombre(
      negocios,
      movimiento.negocio
    ) || negocios[0];

  const sucursal =
    buscarPorNombre(
      sucursales,
      movimiento.sucursal
    ) || sucursales[0];

  /*
    Primero intenta encontrar una cuenta relacionada
    con el método de pago. Si no existe, toma la primera.
  */
    const cuentaSeleccionada =
    movimiento.cuenta
      ? buscarPorNombre(
          cuentas,
          movimiento.cuenta
        )
      : null;

  if (
    movimiento.cuenta &&
    !cuentaSeleccionada
  ) {
    throw new Error(
      `La cuenta "${movimiento.cuenta}" no existe en MONYS OS.`
    );
  }

  const cuenta =
    cuentaSeleccionada ||
    buscarPorNombre(
      cuentas,
      movimiento.metodoPago
    ) ||
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
    organizationId:
      organizacion.id,

    businessId:
      negocio.id,

    branchId:
      sucursal.id,

    accountId:
      cuenta.id,
  };
};

/*
  Guarda una entrada o salida real en cash_movements.
*/
export const guardarMovimientoTesoreria =
  async (movimiento) => {
    if (!movimiento) {
      throw new Error(
        "No se recibieron datos del movimiento."
      );
    }

    const monto =
      Number(movimiento.monto);

    if (
      !Number.isFinite(monto) ||
      monto <= 0
    ) {
      throw new Error(
        "El monto debe ser mayor a cero."
      );
    }

    if (
      !movimiento.concepto?.trim()
    ) {
      throw new Error(
        "El concepto del movimiento es obligatorio."
      );
    }

    const contexto =
      await obtenerContextoMovimiento(
        movimiento
      );

    const authUser =
      await obtenerUsuarioAutenticado();

    const tipo =
      normalizarTexto(
        movimiento.tipo
      );

    const esEntrada =
      tipo === "entrada";

          const conceptoValidado =
      normalizarTexto(
        movimiento.concepto
      ).replace(/\s+/g, " ");

    if (
      !esEntrada &&
      conceptoValidado.split(" ").filter(Boolean)
        .length < 2
    ) {
      throw new Error(
        "Explica mejor para qué salió el dinero. No escribas solamente un nombre o una palabra."
      );
    }

    const conceptosNoPermitidos = [
      "sin comentario",
      "movimiento sin comentario",
      "movimiento de caja sin comentario",
      "salida sin comentario",
    ];

    if (
      !esEntrada &&
      conceptosNoPermitidos.includes(
        conceptoValidado
      )
    ) {
      throw new Error(
        "La salida necesita una explicación real."
      );
    }

    if (
      !esEntrada &&
      !movimiento.recibidoPor?.trim()
    ) {
      throw new Error(
        "Es obligatorio indicar quién recibió el dinero."
      );
    }

    if (
      !esEntrada &&
      !movimiento.expense_category
    ) {
      throw new Error(
        "Es obligatorio seleccionar la categoría."
      );
    }

    if (
      !esEntrada &&
      !movimiento.expense_behavior
    ) {
      throw new Error(
        "Es obligatorio indicar el comportamiento del gasto."
      );
    }

    let rutaComprobante = null;
    let comprobanteSubido = false;

    /*
      Si existe comprobante, se guarda primero
      en Storage privado.

      La primera carpeta SIEMPRE es auth.uid()
      para cumplir las políticas de seguridad.
    */
    if (movimiento.comprobante) {
      const archivo =
        movimiento.comprobante;

      const nombreOriginal =
        archivo.name ||
        "comprobante";

      const nombreSeguro =
        nombreOriginal
          .normalize("NFD")
          .replace(
            /[\u0300-\u036f]/g,
            ""
          )
          .replace(
            /[^a-zA-Z0-9._-]/g,
            "_"
          );

      const identificador =
        typeof crypto !== "undefined" &&
        typeof crypto.randomUUID ===
          "function"
          ? crypto.randomUUID()
          : `${Date.now()}-${Math.random()
              .toString(36)
              .slice(2)}`;

      rutaComprobante =
        `${authUser.id}/` +
        `${Date.now()}-${identificador}-${nombreSeguro}`;

      const {
        error: errorComprobante,
      } = await supabase.storage
        .from(
          "tesoreria-comprobantes"
        )
        .upload(
          rutaComprobante,
          archivo,
          {
            cacheControl: "3600",
            upsert: false,
            contentType:
              archivo.type ||
              undefined,
          }
        );

      if (errorComprobante) {
        console.error(
          "Error al subir comprobante:",
          errorComprobante
        );

        throw new Error(
          `No fue posible subir el comprobante: ${errorComprobante.message}`
        );
      }

      comprobanteSubido = true;
    }

    const contraparte =
      esEntrada
        ? movimiento.entregadoPor
        : movimiento.recibidoPor;

    const nuevoMovimiento = {
      organization_id:
        contexto.organizationId,

      business_id:
        contexto.businessId,

      branch_id:
        contexto.branchId,

      account_id:
        contexto.accountId,

      movement_type:
        esEntrada
          ? "ENTRADA"
          : "SALIDA",

      amount:
        monto,

      concept:
        movimiento.concepto.trim(),
      expense_category:
  movimiento.expense_category || null,

expense_behavior:
  movimiento.expense_behavior ||
  (esEntrada ? "no_aplica" : null),
      counterparty:
        contraparte?.trim() ||
        movimiento.entregadoPor?.trim() ||
        movimiento.recibidoPor?.trim() ||
        null,

      authorized_by:
        movimiento.recibidoPor?.trim() ||
        null,

      receipt_status:
  comprobanteSubido
    ? "Pendiente"
    : "No existe",

      /*
        IMPORTANTE:
        Como el bucket es privado,
        guardamos la RUTA del archivo,
        no una URL pública.
      */
      receipt_url:
        rutaComprobante,

      status:
        "Pendiente de revisión",

      registered_by:
        authUser.id,

      occurred_at:
        movimiento.fechaRegistro ||
        new Date().toISOString(),
    };

    const {
      data,
      error,
    } = await supabase
      .from("cash_movements")
      .insert(nuevoMovimiento)
      .select()
      .single();

    if (error) {
      console.error(
        "Error completo al guardar el movimiento:",
        error
      );

      /*
        Si el movimiento no pudo guardarse,
        eliminamos el archivo recién subido
        para no dejar comprobantes huérfanos.
      */
      if (
        comprobanteSubido &&
        rutaComprobante
      ) {
        await supabase.storage
          .from(
            "tesoreria-comprobantes"
          )
          .remove([
            rutaComprobante,
          ]);
      }

      throw new Error(
        `Supabase no pudo guardar el movimiento: ${error.message}`
      );
    }

    return data;
  };

/*
  Obtiene todos los movimientos para historial y saldos.

  IMPORTANTE:
  El aislamiento y autorización real de lectura
  se controla mediante las políticas RLS de Supabase.
*/
export const obtenerMovimientosTesoreria =
  async () => {
    const {
      data,
      error,
    } = await supabase
      .from("cash_movements")
      .select("*")
      .order(
        "occurred_at",
        {
          ascending: false,
        }
      );

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
export const actualizarEstadoMovimientoTesoreria =
  async (
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

    if (
      !estadosPermitidos.includes(
        nuevoEstado
      )
    ) {
      throw new Error(
        "El estado seleccionado no es válido."
      );
    }

    const {
      data,
      error,
    } = await supabase
      .from("cash_movements")
      .update({
        status:
          nuevoEstado,
      })
      .eq(
        "id",
        movimientoId
      )
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

    if (
      !data ||
      data.length === 0
    ) {
      throw new Error(
        "Supabase no permitió modificar el movimiento. Probablemente falta un permiso de actualización."
      );
    }

    return data[0];
  };

/*
  Actualiza los datos editables de un movimiento.
  La edición conserva el registro original y su identificador.
*/
export const actualizarMovimientoTesoreria =
  async (
    movimientoId,
    cambios = {}
  ) => {
    if (!movimientoId) {
      throw new Error(
        "No se recibió el identificador del movimiento."
      );
    }

    const {
      data: movimientoActual,
      error: errorConsulta,
    } = await supabase
      .from("cash_movements")
      .select(
        "branch_id, movement_type, concept, expense_category, expense_behavior, counterparty"
      )
      .eq("id", movimientoId)
      .single();

    if (errorConsulta || !movimientoActual) {
      throw new Error(
        "No fue posible consultar el movimiento antes de editarlo."
      );
    }

    const actualizacion = {};

    if (
      Object.prototype.hasOwnProperty.call(
        cambios,
        "concepto"
      )
    ) {
      const concepto = String(
        cambios.concepto || ""
      ).trim();

      if (!concepto) {
        throw new Error(
          "El concepto del movimiento es obligatorio."
        );
      }

      actualizacion.concept = concepto;
    }

    if (
      Object.prototype.hasOwnProperty.call(
        cambios,
        "monto"
      )
    ) {
      const monto = Number(
        cambios.monto
      );

      if (
        !Number.isFinite(monto) ||
        monto <= 0
      ) {
        throw new Error(
          "El monto debe ser mayor a cero."
        );
      }

      actualizacion.amount = monto;
    }

    if (
      Object.prototype.hasOwnProperty.call(
        cambios,
        "tipo"
      )
    ) {
      const tipo = normalizarTexto(
        cambios.tipo
      );

      if (
        !["entrada", "salida"].includes(
          tipo
        )
      ) {
        throw new Error(
          "El tipo de movimiento no es válido."
        );
      }

      actualizacion.movement_type =
        tipo === "entrada"
          ? "ENTRADA"
          : "SALIDA";
    }

    if (
      Object.prototype.hasOwnProperty.call(
        cambios,
        "contraparte"
      )
    ) {
      actualizacion.counterparty =
        String(
          cambios.contraparte || ""
        ).trim() || null;
    }

    if (
      Object.prototype.hasOwnProperty.call(
        cambios,
        "categoria"
      )
    ) {
      actualizacion.expense_category =
        cambios.categoria || null;
    }

    if (
      Object.prototype.hasOwnProperty.call(
        cambios,
        "comportamiento"
      )
    ) {
      actualizacion.expense_behavior =
        cambios.comportamiento || null;
    }

    if (
      Object.prototype.hasOwnProperty.call(
        cambios,
        "estado"
      )
    ) {
      const estadosPermitidos = [
        "Pendiente de revisión",
        "En revisión",
        "Revisado",
        "Cancelado",
      ];

      if (
        !estadosPermitidos.includes(
          cambios.estado
        )
      ) {
        throw new Error(
          "El estado seleccionado no es válido."
        );
      }

      actualizacion.status =
        cambios.estado;
    }

    if (
      Object.keys(actualizacion).length === 0
    ) {
      throw new Error(
        "No se recibieron cambios para guardar."
      );
    }

    const {
      data,
      error,
    } = await supabase
      .from("cash_movements")
      .update(actualizacion)
      .eq("id", movimientoId)
      .select()
      .single();

    if (error) {
      console.error(
        "Error al editar el movimiento:",
        error
      );

      throw new Error(
        `No fue posible editar el movimiento: ${error.message}`
      );
    }

    const tipoMemoria =
      actualizacion.movement_type ||
      movimientoActual.movement_type;

    const conceptoMemoria =
      actualizacion.concept ||
      movimientoActual.concept;

    const categoriaMemoria =
      actualizacion.expense_category ??
      movimientoActual.expense_category;

    const comportamientoMemoria =
      actualizacion.expense_behavior ??
      movimientoActual.expense_behavior;

    const contraparteMemoria =
      actualizacion.counterparty ??
      movimientoActual.counterparty;

    if (
      movimientoActual.branch_id &&
      conceptoMemoria &&
      categoriaMemoria &&
      categoriaMemoria !== "sin_clasificar"
    ) {
      const { error: errorMemoria } =
        await supabase
          .from(
            "tesoreria_memoria_clasificacion"
          )
          .upsert(
            {
              branch_id:
                movimientoActual.branch_id,
              patron:
                normalizarTexto(
                  conceptoMemoria
                ),
              tipo_movimiento:
                String(tipoMemoria).toLowerCase() ===
                "entrada"
                  ? "entrada"
                  : "salida",
              categoria: categoriaMemoria,
              comportamiento:
                comportamientoMemoria || null,
              contraparte:
                contraparteMemoria || null,
            },
            {
              onConflict:
                "created_by,branch_id,patron,tipo_movimiento",
            }
          );

      if (errorMemoria) {
        console.warn(
          "El movimiento se actualizó, pero no se pudo guardar la memoria:",
          errorMemoria
        );
      } else {
        const tipoNormalizado =
          String(tipoMemoria).toLowerCase() ===
          "entrada"
            ? "entrada"
            : "salida";

        const {
          data: pendientesSimilares,
          error: errorPendientes,
        } = await supabase
          .from("cash_movements")
          .select("id, concept, movement_type")
          .eq(
            "branch_id",
            movimientoActual.branch_id
          )
          .eq(
            "status",
            "Pendiente de revisión"
          );

        if (errorPendientes) {
          console.warn(
            "MONYS guardó la memoria, pero no pudo buscar pendientes similares:",
            errorPendientes
          );
        } else {
          const idsSimilares =
            !tienePatronSeguro(
              conceptoMemoria
            )
              ? []
              : (pendientesSimilares || [])
              .filter((pendiente) => {
                const tipoPendiente =
                  String(
                    pendiente.movement_type || ""
                  ).toLowerCase() === "entrada"
                    ? "entrada"
                    : "salida";

                return (
                  pendiente.id !== movimientoId &&
                  tipoPendiente === tipoNormalizado &&
                  (
                    normalizarTexto(
                      pendiente.concept
                    ) ===
                      normalizarTexto(
                        conceptoMemoria
                      ) ||
                    crearFirmaConcepto(
                      pendiente.concept
                    ) ===
                      crearFirmaConcepto(
                        conceptoMemoria
                      )
                  )
                );
              })
              .map((pendiente) => pendiente.id);

          if (idsSimilares.length > 0) {
            const {
              error: errorAplicacion,
            } = await supabase
              .from("cash_movements")
              .update({
                expense_category:
                  categoriaMemoria,
                expense_behavior:
                  comportamientoMemoria || null,
                counterparty:
                  contraparteMemoria || null,
                status: "Revisado",
              })
              .in("id", idsSimilares);

            if (errorAplicacion) {
              console.warn(
                "MONYS guardó la memoria, pero no pudo aplicarla a otros pendientes:",
                errorAplicacion
              );
            }
          }
        }
      }
    }

    return data;
  };

/*
  Elimina lógicamente un movimiento.
  No borra información: lo marca como Cancelado.
*/
export const eliminarMovimientoTesoreria =
  async (movimientoId) => {
    if (!movimientoId) {
      throw new Error(
        "No se recibió el identificador del movimiento."
      );
    }

    const {
      data,
      error,
    } = await supabase
      .from("cash_movements")
      .update({
        status: "Cancelado",
      })
      .eq("id", movimientoId)
      .select()
      .single();

    if (error) {
      console.error(
        "Error al cancelar el movimiento:",
        error
      );

      throw new Error(
        `No fue posible cancelar el movimiento: ${error.message}`
      );
    }

    return data;
  };

/*
  Convierte las fechas numéricas de Excel/SICAR
  a una fecha válida para Supabase.
*/
const convertirFechaSicarAISO = (
  fecha,
  hora
) => {
  const fechaNumerica =
    Number(fecha);

  const horaNumerica =
    Number(hora);

  if (
    Number.isFinite(
      fechaNumerica
    ) &&
    fechaNumerica > 10000
  ) {
    let fechaExcel =
      fechaNumerica;

    const fechaYaTieneHora =
      fechaNumerica % 1 !== 0;

    if (
      !fechaYaTieneHora &&
      Number.isFinite(
        horaNumerica
      ) &&
      horaNumerica > 0 &&
      horaNumerica < 1
    ) {
      fechaExcel +=
        horaNumerica;
    }

    const milisegundos =
      (fechaExcel - 25569) *
      86400 *
      1000;

    return new Date(
      milisegundos
    ).toISOString();
  }

  const fechaTexto =
    String(
      fecha ?? ""
    ).trim();

  if (fechaTexto) {
    const fechaInterpretada =
      new Date(
        fechaTexto
      );

    if (
      !Number.isNaN(
        fechaInterpretada.getTime()
      )
    ) {
      return fechaInterpretada.toISOString();
    }
  }

  return new Date().toISOString();
};

/*
  Determina si un concepto contiene alguna
  de las palabras conocidas.
*/
const contieneAlgunaPalabra = (
  texto,
  palabras = []
) =>
  palabras.some((palabra) =>
    texto.includes(
      normalizarTexto(palabra)
    )
  );

/*
  Clasifica automáticamente los movimientos SICAR.

  MONYS solamente deja pendiente aquello
  que realmente necesita una decisión humana.
*/
const clasificarMovimientoSicar = ({
  esEntrada,
  concepto,
}) => {
  const texto =
    normalizarTexto(concepto);

  /*
    Las entradas del reporte de movimientos
    representan dinero recibido en caja.

    No se consideran gastos y no requieren
    clasificación manual.
  */
  if (esEntrada) {
    return {
      categoria:
        "ingreso_caja_sicar",

      comportamiento:
        "no_aplica",

      estado:
        "Revisado",
    };
  }

  /*
    Los cortes de caja son movimientos internos.
    No representan un gasto del negocio.
  */
  if (
    contieneAlgunaPalabra(
      texto,
      [
        "salida por corte de caja",
        "corte de caja",
      ]
    )
  ) {
    return {
      categoria:
        "traspaso_caja",

      comportamiento:
        "no_aplica",

      estado:
        "Revisado",
    };
  }

  /*
    Cancelaciones y ajustes no deben
    disminuir la utilidad como gastos.
  */
  if (
    contieneAlgunaPalabra(
      texto,
      [
        "venta cancelada",
        "cancelacion",
        "cancelado",
      ]
    )
  ) {
    return {
      categoria:
        "ajuste_cancelacion",

      comportamiento:
        "no_aplica",

      estado:
        "Revisado",
    };
  }

  /*
    Registros de prueba no deben participar
    en los indicadores financieros.
  */
  if (
    contieneAlgunaPalabra(
      texto,
      [
        "prueba",
        "pruebas",
        "test",
      ]
    )
  ) {
    return {
      categoria:
        "registro_prueba",

      comportamiento:
        "no_aplica",

      estado:
        "Cancelado",
    };
  }

  /*
    Nómina.
  */
  if (
    contieneAlgunaPalabra(
      texto,
      [
        "sueldo",
        "nomina",
        "salario",
      ]
    )
  ) {
    return {
      categoria:
        "nomina",

      comportamiento:
        "fijo",

      estado:
        "Revisado",
    };
  }

  /*
    Comisiones.
  */
  if (
    contieneAlgunaPalabra(
      texto,
      [
        "comision",
        "comisiones",
      ]
    )
  ) {
    return {
      categoria:
        "comisiones",

      comportamiento:
        "variable",

      estado:
        "Revisado",
    };
  }

  /*
    Transporte y combustible.
  */
  if (
    contieneAlgunaPalabra(
      texto,
      [
        "gasolina",
        "camion",
        "taxi",
        "uber",
        "flete",
        "transporte",
      ]
    )
  ) {
    return {
      categoria:
        "transporte",

      comportamiento:
        "variable",

      estado:
        "Revisado",
    };
  }

  /*
    Artículos de limpieza.
  */
  if (
    contieneAlgunaPalabra(
      texto,
      [
        "fabuloso",
        "pinol",
        "limpieza",
        "jabon",
        "cloro",
      ]
    )
  ) {
    return {
      categoria:
        "limpieza",

      comportamiento:
        "variable",

      estado:
        "Revisado",
    };
  }

  /*
    Las comidas pueden ser gasto del negocio
    o consumo personal. MONYS propone categoría,
    pero solicita confirmación.
  */
  if (
    contieneAlgunaPalabra(
      texto,
      [
        "comida",
        "desayuno",
        "lonche",
        "cena",
      ]
    )
  ) {
    return {
      categoria:
        "alimentos",

      comportamiento:
        "variable",

      estado:
        "Pendiente de revisión",
    };
  }

  /*
    Préstamos y adelantos no deben confundirse
    automáticamente con un gasto.
  */
  if (
    contieneAlgunaPalabra(
      texto,
      [
        "prestamo",
        "adelanto",
        "anticipo",
      ]
    )
  ) {
    return {
      categoria:
        "anticipo_prestamo",

      comportamiento:
        "no_aplica",

      estado:
        "Pendiente de revisión",
    };
  }

  /*
    Si MONYS no tiene evidencia suficiente,
    no inventa: solicita decisión humana.
  */
  return {
    categoria:
      "sin_clasificar",

    comportamiento:
      null,

    estado:
      "Pendiente de revisión",
  };
};

/*
  Guarda en bloque los movimientos importados desde SICAR.

  Consulta el contexto una sola vez para evitar cientos
  de solicitudes innecesarias a Supabase.

  También recibe el branchId seleccionado en el importador
  para evitar asignar movimientos a otra sucursal.
*/
export const guardarMovimientosTesoreriaMasivos =
  async (
    movimientos = [],
    opciones = {}
  ) => {
    if (
      !Array.isArray(
        movimientos
      ) ||
      movimientos.length === 0
    ) {
      return 0;
    }

    const branchIdForzado =
      opciones?.branchId || null;

    const authUser =
      await obtenerUsuarioAutenticado();

    const [
      organizaciones,
      negocios,
      sucursales,
      cuentas,
    ] = await Promise.all([
      obtenerRegistros(
        "organizations"
      ),
      obtenerRegistros(
        "businesses"
      ),
      obtenerRegistros(
        "branches"
      ),
      obtenerRegistros(
        "accounts"
      ),
    ]);

    const organizacion =
      buscarPorNombre(
        organizaciones,
        "Corporativo Monys"
      ) ||
      organizaciones[0];

    const negocioPredeterminado =
      negocios[0];

    const sucursalPredeterminada =
      sucursales[0];

    const cuentaPredeterminada =
      cuentas[0];

    const sucursalForzada =
      branchIdForzado
        ? sucursales.find(
            (sucursal) =>
              String(
                sucursal.id
              ) ===
              String(
                branchIdForzado
              )
          )
        : null;

    if (!organizacion) {
      throw new Error(
        "No existe ninguna organización registrada en Supabase."
      );
    }

    if (
      !negocioPredeterminado
    ) {
      throw new Error(
        "No existe ningún negocio registrado en Supabase."
      );
    }

    if (
      !sucursalPredeterminada
    ) {
      throw new Error(
        "No existe ninguna sucursal registrada en Supabase."
      );
    }

    if (
      branchIdForzado &&
      !sucursalForzada
    ) {
      throw new Error(
        "La sucursal seleccionada no existe o no está disponible."
      );
    }

    if (
      !cuentaPredeterminada
    ) {
      throw new Error(
        "No existe ninguna cuenta registrada en Supabase."
      );
    }

       let reglasMemoria = [];

  const branchMemoriaId =
    branchIdForzado ||
    sucursalPredeterminada?.id ||
    null;

  if (branchMemoriaId) {
    const {
      data: reglasGuardadas,
      error: errorMemoria,
    } = await supabase
      .from(
        "tesoreria_memoria_clasificacion"
      )
      .select(
        "patron, tipo_movimiento, categoria, comportamiento, contraparte"
      )
      .eq("branch_id", branchMemoriaId)
      .eq("activa", true);

    if (errorMemoria) {
      console.warn(
        "No se pudo cargar la memoria de Tesorería:",
        errorMemoria
      );
    } else {
      reglasMemoria =
        reglasGuardadas || [];
    }
  }

    const registros =
      movimientos
        .map(
          (
            movimiento
          ) => {
            const monto =
              Math.abs(
                Number(
                  movimiento.monto ??
                    movimiento.total ??
                    0
                )
              );

            if (
              !Number.isFinite(
                monto
              ) ||
              monto <= 0
            ) {
              return null;
            }

            const tipoNormalizado =
              normalizarTexto(
                movimiento.tipoMovimiento ||
                  movimiento.tipo ||
                  movimiento.movimiento
              );

            const esEntrada =
              [
                "entrada",
                "e",
                "ingreso",
              ].includes(
                tipoNormalizado
              );

            const sucursal =
              sucursalForzada ||
              buscarPorNombre(
                sucursales,
                movimiento.sucursal ||
                  movimiento.caja
              ) ||
              sucursalPredeterminada;

            const negocioDeSucursal =
              sucursal?.business_id
                ? negocios.find(
                    (negocio) =>
                      String(
                        negocio.id
                      ) ===
                      String(
                        sucursal.business_id
                      )
                  )
                : null;

            const negocio =
              negocioDeSucursal ||
              buscarPorNombre(
                negocios,
                movimiento.negocio
              ) ||
              negocioPredeterminado;

            const cuenta =
              buscarPorNombre(
                cuentas,
                movimiento.metodoPago
              ) ||
              cuentaPredeterminada;

            const concepto =
              String(
                movimiento.comentario ||
                  movimiento.descripcion ||
                  (
                    esEntrada
                      ? "Entrada de caja SICAR"
                      : "Movimiento importado desde SICAR"
                  )
              ).trim();

            const usuario =
              String(
                movimiento.usuario ||
                  ""
              ).trim();

             const clasificacionBase =
  clasificarMovimientoSicar({
    esEntrada,
    concepto,
  });

const conceptoNormalizado =
  normalizarTexto(concepto);

const tipoMemoria = esEntrada
  ? "entrada"
  : "salida";

const reglaMemoria =
  reglasMemoria
    .filter((regla) => {
      const patron =
        normalizarTexto(regla.patron);

      return (
        patron &&
        tienePatronSeguro(regla.patron) &&
        (
          conceptoNormalizado.includes(patron) ||
          crearFirmaConcepto(concepto) ===
            crearFirmaConcepto(regla.patron)
        ) &&
        regla.tipo_movimiento ===
          tipoMemoria
      );
    })
    .sort(
      (a, b) =>
        normalizarTexto(b.patron).length -
        normalizarTexto(a.patron).length
    )[0];

const clasificacion = reglaMemoria
  ? {
      ...clasificacionBase,
      categoria:
        reglaMemoria.categoria ||
        clasificacionBase.categoria,
      comportamiento:
        reglaMemoria.comportamiento ??
        clasificacionBase.comportamiento,
    }
  : clasificacionBase;

            return {
              organization_id:
                organizacion.id,

              business_id:
                negocio.id,

              branch_id:
                sucursal.id,

              account_id:
                cuenta.id,

              movement_type:
                esEntrada
                  ? "ENTRADA"
                  : "SALIDA",

              amount:
                monto,

              concept:
                concepto,

              expense_category:
                movimiento.expense_category ||
                clasificacion.categoria,

              expense_behavior:
                movimiento.expense_behavior ??
                clasificacion.comportamiento,

              counterparty:
                usuario || null,

              authorized_by:
                usuario || null,

              receipt_status:
                "No existe",

              receipt_url:
                null,

              status:
                movimiento.status ||
                clasificacion.estado,

              registered_by:
                authUser.id,

              occurred_at:
                convertirFechaSicarAISO(
                  movimiento.fecha,
                  movimiento.hora
                ),
            };
          }
        )
        .filter(Boolean);

    if (
      registros.length === 0
    ) {
      throw new Error(
        "No se encontraron movimientos con monto válido para guardar."
      );
    }

    const tamañoLote =
      200;

    for (
      let inicio = 0;
      inicio <
      registros.length;
      inicio +=
        tamañoLote
    ) {
      const lote =
        registros.slice(
          inicio,
          inicio +
            tamañoLote
        );

      const {
        error,
      } = await supabase
        .from(
          "cash_movements"
        )
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
