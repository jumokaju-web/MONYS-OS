import { supabase } from "../../../supabase";

function convertirNumero(valor) {
  const numero = Number(valor);

  return Number.isFinite(numero)
    ? numero
    : 0;
}

function limpiarTexto(valor) {
  return String(
    valor ?? ""
  ).trim();
}

async function obtenerUsuarioActual() {
  const {
    data,
    error,
  } =
    await supabase.auth.getUser();

  if (error) {
    console.error(
      "Error al obtener usuario actual:",
      error
    );

    return null;
  }

  return data?.user || null;
}

function construirDetalleCompra(
  productos
) {
  const lista =
    Array.isArray(productos)
      ? productos
      : [];

  return lista
    .filter(
      (producto) =>
        convertirNumero(
          producto?.compraTotal
        ) > 0
    )
    .map(
      (producto) => ({
        llave_producto:
          limpiarTexto(
            producto?.llave
          ) ||
          limpiarTexto(
            producto?.codigo
          ) ||
          limpiarTexto(
            producto?.descripcion
          ),

        codigo:
          limpiarTexto(
            producto?.codigo
          ) || null,

        descripcion:
          limpiarTexto(
            producto?.descripcion
          ) ||
          "Producto",

        categoria:
          limpiarTexto(
            producto?.categoria
          ) || null,

        precio_compra:
          Math.max(
            0,
            convertirNumero(
              producto?.precioCompra
            )
          ),

        necesidad_antes_traspasos:
          Math.max(
            0,
            convertirNumero(
              producto
                ?.necesidadTotalAntesTraspasos
            )
          ),

        cubierto_por_traspasos:
          Math.max(
            0,
            convertirNumero(
              producto
                ?.cubiertoPorTraspasos
            )
          ),

        cantidad_comprar:
          Math.max(
            0,
            convertirNumero(
              producto?.compraTotal
            )
          ),

        inversion_estimada:
          Math.max(
            0,
            convertirNumero(
              producto?.inversionTotal
            )
          ),

        sucursales:
          Array.isArray(
            producto?.sucursales
          )
            ? producto.sucursales
            : [],
      })
    )
    .filter(
      (producto) =>
        Boolean(
          producto.llave_producto
        )
    );
}

function construirDetalleTraspasos(
  planTraspasos
) {
  const lista =
    Array.isArray(planTraspasos)
      ? planTraspasos
      : [];

  return lista
    .filter(
      (traspaso) =>
        convertirNumero(
          traspaso
            ?.cantidadSugerida
        ) > 0
    )
    .map(
      (traspaso) => {
        const productoRef =
          limpiarTexto(
            traspaso?.productId
          ) ||
          limpiarTexto(
            traspaso?.codigo
          ) ||
          limpiarTexto(
            traspaso?.producto
          );

        return {
          producto_ref:
            productoRef,

          codigo:
            limpiarTexto(
              traspaso?.codigo
            ) || null,

          producto:
            limpiarTexto(
              traspaso?.producto
            ) ||
            "Producto",

          branch_origen_id:
            traspaso
              ?.branchOrigenId ||
            null,

          sucursal_origen:
            limpiarTexto(
              traspaso
                ?.sucursalOrigen
            ) ||
            "Origen",

          branch_destino_id:
            traspaso
              ?.branchDestinoId ||
            null,

          sucursal_destino:
            limpiarTexto(
              traspaso
                ?.sucursalDestino
            ) ||
            "Destino",

          existencia_origen:
            convertirNumero(
              traspaso
                ?.existenciaOrigen
            ),

          existencia_destino:
            convertirNumero(
              traspaso
                ?.existenciaDestino
            ),

          ventas_origen:
            Math.max(
              0,
              convertirNumero(
                traspaso
                  ?.ventasOrigen
              )
            ),

          ventas_destino:
            Math.max(
              0,
              convertirNumero(
                traspaso
                  ?.ventasDestino
              )
            ),

          cantidad_sugerida:
            Math.max(
              0,
              convertirNumero(
                traspaso
                  ?.cantidadSugerida
              )
            ),

          prioridad:
            [
              "ALTA",
              "MEDIA",
              "BAJA",
            ].includes(
              traspaso?.prioridad
            )
              ? traspaso.prioridad
              : "BAJA",

          motivo:
            limpiarTexto(
              traspaso?.motivo
            ) || null,

          recomendacion:
            limpiarTexto(
              traspaso
                ?.recomendacion
            ) || null,

          datos_recomendacion:
            traspaso || {},
        };
      }
    )
    .filter(
      (traspaso) =>
        Boolean(
          traspaso.producto_ref
        )
    );
}

async function eliminarPlanIncompleto(
  planId
) {
  if (!planId) {
    return;
  }

  const {
    error,
  } = await supabase
    .from("compra_planes")
    .delete()
    .eq(
      "id",
      planId
    );

  if (error) {
    console.error(
      "No fue posible limpiar el plan incompleto:",
      error
    );
  }
}

export async function guardarPlanCompra({
  compraMaestra,
  businessId = null,
}) {
  if (!compraMaestra) {
    throw new Error(
      "No existe una Compra Maestra para guardar."
    );
  }

  const productos =
    Array.isArray(
      compraMaestra?.productos
    )
      ? compraMaestra.productos
      : [];

  const planTraspasos =
    Array.isArray(
      compraMaestra?.planTraspasos
    )
      ? compraMaestra.planTraspasos
      : [];

  if (
    productos.length === 0 &&
    planTraspasos.length === 0
  ) {
    throw new Error(
      "El plan actual no contiene compras ni traspasos para guardar."
    );
  }

  const usuario =
    await obtenerUsuarioActual();

  let planId = null;

  try {
    const resumen = {
      totalProductosRevisionInventario:
        convertirNumero(
          compraMaestra
            ?.totalProductosRevisionInventario
        ),

      totalTraspasos:
        planTraspasos.length,

      totalPiezasTraspaso:
        planTraspasos.reduce(
          (
            total,
            traspaso
          ) =>
            total +
            Math.max(
              0,
              convertirNumero(
                traspaso
                  ?.cantidadSugerida
              )
            ),
          0
        ),

      fechaGeneracion:
        new Date()
          .toISOString(),

      version:
        "compra_maestra_v1",
    };

    const {
      data: planGuardado,
      error: errorPlan,
    } = await supabase
      .from("compra_planes")
      .insert({
        business_id:
          businessId || null,

        estado:
          "borrador",

        cobertura_objetivo_dias:
          Math.max(
            0,
            convertirNumero(
              compraMaestra
                ?.coberturaObjetivoDias
            )
          ),

        total_productos_comprar:
          Math.max(
            0,
            convertirNumero(
              compraMaestra
                ?.totalProductosComprar
            )
          ),

        total_necesidad_antes_traspasos:
          Math.max(
            0,
            convertirNumero(
              compraMaestra
                ?.totalNecesidadAntesTraspasos
            )
          ),

        total_cubierto_por_traspasos:
          Math.max(
            0,
            convertirNumero(
              compraMaestra
                ?.totalCubiertoPorTraspasos
            )
          ),

        total_piezas_comprar:
          Math.max(
            0,
            convertirNumero(
              compraMaestra
                ?.totalPiezasComprar
            )
          ),

        inversion_total:
          Math.max(
            0,
            convertirNumero(
              compraMaestra
                ?.inversionTotal
            )
          ),

        resumen,

        created_by:
          usuario?.id ||
          null,
      })
      .select(
        "id, fecha_plan, estado"
      )
      .single();

    if (errorPlan) {
      throw errorPlan;
    }

    planId =
      planGuardado?.id;

    if (!planId) {
      throw new Error(
        "Supabase no devolvió el ID del plan guardado."
      );
    }

    const detalleCompra =
      construirDetalleCompra(
        productos
      ).map(
        (producto) => ({
          plan_id:
            planId,

          ...producto,
        })
      );

    if (
      detalleCompra.length > 0
    ) {
      const {
        error:
          errorDetalleCompra,
      } = await supabase
        .from(
          "compra_plan_detalle"
        )
        .insert(
          detalleCompra
        );

      if (errorDetalleCompra) {
        throw errorDetalleCompra;
      }
    }

    const detalleTraspasos =
      construirDetalleTraspasos(
        planTraspasos
      ).map(
        (traspaso) => ({
          plan_id:
            planId,

          ...traspaso,
        })
      );

    if (
      detalleTraspasos.length > 0
    ) {
      const {
        error:
          errorTraspasos,
      } = await supabase
        .from(
          "compra_plan_traspasos"
        )
        .insert(
          detalleTraspasos
        );

      if (errorTraspasos) {
        throw errorTraspasos;
      }
    }

    return {
      id:
        planId,

      fechaPlan:
        planGuardado
          ?.fecha_plan,

      estado:
        planGuardado
          ?.estado,

      productosGuardados:
        detalleCompra.length,

      traspasosGuardados:
        detalleTraspasos.length,
    };
  } catch (error) {
    console.error(
      "Error al guardar Plan de Compra:",
      error
    );

    if (planId) {
      await eliminarPlanIncompleto(
        planId
      );
    }

    throw new Error(
      error?.message ||
        "No fue posible guardar el Plan de Compra."
    );
  }
}

export async function obtenerHistorialPlanesCompra(
  limite = 20
) {
  const limiteSeguro = Math.max(
    1,
    Math.min(
      100,
      Number(limite) || 20
    )
  );

  const {
    data,
    error,
  } = await supabase
    .from("compra_planes")
    .select(`
      id,
      fecha_plan,
      estado,
      cobertura_objetivo_dias,
      total_productos_comprar,
      total_necesidad_antes_traspasos,
      total_cubierto_por_traspasos,
      total_piezas_comprar,
      inversion_total,
      resumen,
      created_at
    `)
    .order(
      "fecha_plan",
      {
        ascending: false,
      }
    )
    .limit(
      limiteSeguro
    );

  if (error) {
    console.error(
      "Error al obtener historial de Compra Maestra:",
      error
    );

    throw new Error(
      error?.message ||
        "No fue posible cargar el historial de Compra Maestra."
    );
  }

  const planes =
    Array.isArray(data)
      ? data
      : [];

  return planes.map(
    (plan) => ({
      id:
        plan.id,

      fechaPlan:
        plan.fecha_plan,

      estado:
        plan.estado,

      coberturaObjetivoDias:
        Number(
          plan.cobertura_objetivo_dias
        ) || 0,

      totalProductosComprar:
        Number(
          plan.total_productos_comprar
        ) || 0,

      totalNecesidadAntesTraspasos:
        Number(
          plan.total_necesidad_antes_traspasos
        ) || 0,

      totalCubiertoPorTraspasos:
        Number(
          plan.total_cubierto_por_traspasos
        ) || 0,

      totalPiezasComprar:
        Number(
          plan.total_piezas_comprar
        ) || 0,

      inversionTotal:
        Number(
          plan.inversion_total
        ) || 0,

      resumen:
        plan.resumen || {},

      createdAt:
        plan.created_at,
    })
  );
}

function normalizarSucursalesParaComparar(
  sucursales
) {
  const lista =
    Array.isArray(sucursales)
      ? sucursales
      : [];

  return lista
    .map((sucursal) => {
      const identificador =
        limpiarTexto(
          sucursal?.branchId
        ) ||
        limpiarTexto(
          sucursal?.branch_id
        ) ||
        limpiarTexto(
          sucursal?.sucursal
        ) ||
        limpiarTexto(
          sucursal?.nombreSucursal
        );

      const cantidad =
        Math.max(
          0,
          convertirNumero(
            sucursal?.cantidadComprar ??
              sucursal?.cantidad_comprar
          )
        );

      return {
        identificador,
        cantidad,
      };
    })
    .filter(
      (sucursal) =>
        Boolean(
          sucursal.identificador
        )
    )
    .sort(
      (a, b) =>
        a.identificador.localeCompare(
          b.identificador
        )
    );
}

function normalizarProductosParaComparar(
  productos
) {
  const lista =
    Array.isArray(productos)
      ? productos
      : [];

  return lista
    .map((producto) => ({
      llave:
        limpiarTexto(
          producto?.llave_producto
        ),

      cantidad:
        Math.max(
          0,
          convertirNumero(
            producto?.cantidad_comprar
          )
        ),

      cubiertoPorTraspasos:
        Math.max(
          0,
          convertirNumero(
            producto?.cubierto_por_traspasos
          )
        ),

      sucursales:
        normalizarSucursalesParaComparar(
          producto?.sucursales
        ),
    }))
    .sort(
      (a, b) =>
        a.llave.localeCompare(
          b.llave
        )
    );
}

function normalizarTraspasosParaComparar(
  traspasos
) {
  const lista =
    Array.isArray(traspasos)
      ? traspasos
      : [];

  return lista
    .map((traspaso) => ({
      producto:
        limpiarTexto(
          traspaso?.producto_ref
        ),

      origen:
        limpiarTexto(
          traspaso?.branch_origen_id
        ) ||
        limpiarTexto(
          traspaso?.sucursal_origen
        ),

      destino:
        limpiarTexto(
          traspaso?.branch_destino_id
        ) ||
        limpiarTexto(
          traspaso?.sucursal_destino
        ),

      cantidad:
        Math.max(
          0,
          convertirNumero(
            traspaso?.cantidad_sugerida
          )
        ),
    }))
    .sort((a, b) => {
      const llaveA =
        `${a.producto}|${a.origen}|${a.destino}`;

      const llaveB =
        `${b.producto}|${b.origen}|${b.destino}`;

      return llaveA.localeCompare(
        llaveB
      );
    });
}

export async function verificarPlanActualGuardado(
  compraMaestra
) {
  if (!compraMaestra) {
    return {
      guardado: false,
      planId: null,
    };
  }

  const {
    data: planes,
    error: errorPlan,
  } = await supabase
    .from("compra_planes")
    .select(`
      id,
      total_productos_comprar,
      total_necesidad_antes_traspasos,
      total_cubierto_por_traspasos,
      total_piezas_comprar,
      inversion_total
    `)
    .order(
      "fecha_plan",
      {
        ascending: false,
      }
    )
    .limit(1);

  if (errorPlan) {
    console.error(
      "Error al verificar último plan:",
      errorPlan
    );

    throw new Error(
      errorPlan?.message ||
        "No fue posible verificar el último Plan de Compra."
    );
  }

  const ultimoPlan =
    Array.isArray(planes)
      ? planes[0]
      : null;

  if (!ultimoPlan?.id) {
    return {
      guardado: false,
      planId: null,
    };
  }

  const totalesCoinciden =
    convertirNumero(
      ultimoPlan
        .total_productos_comprar
    ) ===
      convertirNumero(
        compraMaestra
          ?.totalProductosComprar
      ) &&
    convertirNumero(
      ultimoPlan
        .total_necesidad_antes_traspasos
    ) ===
      convertirNumero(
        compraMaestra
          ?.totalNecesidadAntesTraspasos
      ) &&
    convertirNumero(
      ultimoPlan
        .total_cubierto_por_traspasos
    ) ===
      convertirNumero(
        compraMaestra
          ?.totalCubiertoPorTraspasos
      ) &&
    convertirNumero(
      ultimoPlan
        .total_piezas_comprar
    ) ===
      convertirNumero(
        compraMaestra
          ?.totalPiezasComprar
      ) &&
    convertirNumero(
      ultimoPlan
        .inversion_total
    ) ===
      convertirNumero(
        compraMaestra
          ?.inversionTotal
      );

  if (!totalesCoinciden) {
    return {
      guardado: false,
      planId: null,
    };
  }

  const [
    resultadoProductos,
    resultadoTraspasos,
  ] = await Promise.all([
    supabase
      .from(
        "compra_plan_detalle"
      )
      .select(`
        llave_producto,
        cantidad_comprar,
        cubierto_por_traspasos,
        sucursales
      `)
      .eq(
        "plan_id",
        ultimoPlan.id
      ),

    supabase
      .from(
        "compra_plan_traspasos"
      )
      .select(`
        producto_ref,
        branch_origen_id,
        branch_destino_id,
        sucursal_origen,
        sucursal_destino,
        cantidad_sugerida
      `)
      .eq(
        "plan_id",
        ultimoPlan.id
      ),
  ]);

  if (
    resultadoProductos.error
  ) {
    throw new Error(
      resultadoProductos
        .error?.message ||
        "No fue posible comparar los productos guardados."
    );
  }

  if (
    resultadoTraspasos.error
  ) {
    throw new Error(
      resultadoTraspasos
        .error?.message ||
        "No fue posible comparar los traspasos guardados."
    );
  }

  const productosActuales =
    normalizarProductosParaComparar(
      construirDetalleCompra(
        compraMaestra
          ?.productos
      )
    );

  const productosGuardados =
    normalizarProductosParaComparar(
      resultadoProductos.data
    );

  const traspasosActuales =
    normalizarTraspasosParaComparar(
      construirDetalleTraspasos(
        compraMaestra
          ?.planTraspasos
      )
    );

  const traspasosGuardados =
    normalizarTraspasosParaComparar(
      resultadoTraspasos.data
    );

  const mismoDetalle =
    JSON.stringify(
      productosActuales
    ) ===
      JSON.stringify(
        productosGuardados
      ) &&
    JSON.stringify(
      traspasosActuales
    ) ===
      JSON.stringify(
        traspasosGuardados
      );

  return {
    guardado:
      mismoDetalle,

    planId:
      mismoDetalle
        ? ultimoPlan.id
        : null,
  };
}