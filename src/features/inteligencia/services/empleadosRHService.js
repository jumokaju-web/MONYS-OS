import { supabase } from "../../../supabase";


export async function obtenerEmpleadosRH(
  branchId
) {
  if (!branchId) {
    return [];
  }

  const { data, error } =
    await supabase
      .from("empleados")
      .select(`
        id,
        organization_id,
        business_id,
        branch_id,
        nombre,
        puesto,
        usuario_id,
        active,
        fecha_ingreso,
        sueldo_base,
        periodicidad_pago,
        tipo_contrato,
        fecha_baja,
        created_at,
        updated_at
      `)
      .eq(
        "branch_id",
        branchId
      )
      .order(
        "nombre",
        {
          ascending: true,
        }
      );

  if (error) {
    console.error(
      "Error al obtener empleados RH:",
      error
    );

    throw error;
  }

  return Array.isArray(data)
    ? data
    : [];
}


// ======================================================
// MONYS OS
// EMPLEADOS ACTIVOS PARA ASIGNACIÓN AUTOMÁTICA
// ======================================================

export async function obtenerEmpleadosActivosParaAsignacion(
  branchId
) {
  if (!branchId) {
    return [];
  }

  const {
    data,
    error,
  } = await supabase
    .from("empleados")
    .select(`
      id,
      organization_id,
      business_id,
      branch_id,
      nombre,
      puesto,
      usuario_id,
      active
    `)
    .eq(
      "branch_id",
      branchId
    )
    .eq(
      "active",
      true
    )
    .order(
      "nombre",
      {
        ascending: true,
      }
    );

  if (error) {
    console.error(
      "Error al obtener empleados activos para asignación:",
      error
    );

    throw error;
  }

  return Array.isArray(data)
    ? data
    : [];
}


// ======================================================
// NORMALIZAR TEXTO
// ======================================================

function normalizarTexto(
  valor
) {
  return String(
    valor || ""
  )
    .toLowerCase()
    .normalize("NFD")
    .replace(
      /[\u0300-\u036f]/g,
      ""
    )
    .trim();
}


// ======================================================
// DETECTAR PERFIL NECESARIO PARA UNA TAREA
// ======================================================

function detectarPerfilTarea({
  titulo = "",
  descripcion = "",
  area = "",
} = {}) {
  const texto =
    normalizarTexto(
      `${titulo} ${descripcion} ${area}`
    );


  if (
    texto.includes("marketing") ||
    texto.includes("tiktok") ||
    texto.includes("campana") ||
    texto.includes("publicacion") ||
    texto.includes("contenido") ||
    texto.includes("redes")
  ) {
    return "marketing";
  }


  if (
    texto.includes("inventario") ||
    texto.includes("stock") ||
    texto.includes("faltante") ||
    texto.includes("mercancia") ||
    texto.includes("producto") ||
    texto.includes("acomodar") ||
    texto.includes("reponer") ||
    texto.includes("probador") ||
    texto.includes("bodega")
  ) {
    return "tienda";
  }


  if (
    texto.includes("venta") ||
    texto.includes("cliente") ||
    texto.includes("ticket") ||
    texto.includes("atencion") ||
    texto.includes("mostrador")
  ) {
    return "ventas";
  }


  if (
    texto.includes("limpieza") ||
    texto.includes("limpiar") ||
    texto.includes("orden") ||
    texto.includes("acomodo")
  ) {
    return "tienda";
  }


  if (
    texto.includes("nomina") ||
    texto.includes("empleado") ||
    texto.includes("personal") ||
    texto.includes("capacitacion") ||
    texto.includes("rh")
  ) {
    return "rh";
  }


  if (
    texto.includes("factura") ||
    texto.includes("proveedor") ||
    texto.includes("pago") ||
    texto.includes("administracion")
  ) {
    return "administracion";
  }


  if (
    texto.includes("ruta") ||
    texto.includes("camioneta") ||
    texto.includes("paquete") ||
    texto.includes("chofer") ||
    texto.includes("flotilla")
  ) {
    return "flotilla";
  }


  return normalizarTexto(
    area
  ) || "general";
}


// ======================================================
// CALCULAR COMPATIBILIDAD EMPLEADO / TAREA
// ======================================================

function calcularCompatibilidadEmpleado({
  empleado,
  perfilTarea,
}) {
  const puesto =
    normalizarTexto(
      empleado?.puesto
    );

  if (!puesto) {
    return 1;
  }


  let puntos = 1;


  if (
    perfilTarea === "marketing" &&
    (
      puesto.includes("marketing") ||
      puesto.includes("mercado libre") ||
      puesto.includes("redes") ||
      puesto.includes("contenido")
    )
  ) {
    puntos += 10;
  }


  if (
    perfilTarea === "tienda" &&
    (
      puesto.includes("tienda") ||
      puesto.includes("vendedora") ||
      puesto.includes("ventas") ||
      puesto.includes("encargada") ||
      puesto.includes("encargado")
    )
  ) {
    puntos += 10;
  }


  if (
    perfilTarea === "ventas" &&
    (
      puesto.includes("venta") ||
      puesto.includes("vendedora") ||
      puesto.includes("vendedor") ||
      puesto.includes("encargada") ||
      puesto.includes("encargado")
    )
  ) {
    puntos += 10;
  }


  if (
    perfilTarea === "rh" &&
    (
      puesto.includes("rh") ||
      puesto.includes("recursos humanos") ||
      puesto.includes("administracion")
    )
  ) {
    puntos += 10;
  }


  if (
    perfilTarea === "administracion" &&
    (
      puesto.includes("administracion") ||
      puesto.includes("administrativa") ||
      puesto.includes("administrativo") ||
      puesto.includes("encargada") ||
      puesto.includes("encargado")
    )
  ) {
    puntos += 10;
  }


  if (
    perfilTarea === "flotilla" &&
    (
      puesto.includes("chofer") ||
      puesto.includes("logistica") ||
      puesto.includes("flotilla")
    )
  ) {
    puntos += 10;
  }


  return puntos;
}


// ======================================================
// CONTAR CARGA ACTUAL DEL EMPLEADO
// ======================================================

async function obtenerCargaActualEmpleados({
  branchId,
  fecha,
}) {
  if (!branchId) {
    return {};
  }

  const {
    data,
    error,
  } = await supabase
    .from("tareas_operativas")
    .select(`
      id,
      responsable,
      estado,
      fecha
    `)
    .eq(
      "branch_id",
      branchId
    )
    .eq(
      "fecha",
      fecha
    )
    .neq(
      "estado",
      "cancelada"
    );

  if (error) {
    console.error(
      "Error al obtener carga actual de empleados:",
      error
    );

    return {};
  }


  const carga = {};


  (
    Array.isArray(data)
      ? data
      : []
  ).forEach(
    (tarea) => {
      const responsable =
        normalizarTexto(
          tarea.responsable
        );

      if (!responsable) {
        return;
      }

      carga[responsable] =
        (
          carga[responsable] ||
          0
        ) + 1;
    }
  );


  return carga;
}


// ======================================================
// ASIGNAR RESPONSABLE AUTOMÁTICAMENTE
// ======================================================

export async function asignarResponsableAutomatico({
  branchId,
  titulo = "",
  descripcion = "",
  area = "general",
  fecha = null,
} = {}) {
  if (!branchId) {
    return null;
  }


  const empleados =
    await obtenerEmpleadosActivosParaAsignacion(
      branchId
    );


  if (
    empleados.length === 0
  ) {
    return null;
  }


  const fechaTarea =
    fecha ||
    new Date()
      .toISOString()
      .slice(0, 10);


  const perfilTarea =
    detectarPerfilTarea({
      titulo,
      descripcion,
      area,
    });


  const cargaActual =
    await obtenerCargaActualEmpleados({
      branchId,
      fecha:
        fechaTarea,
    });


  const candidatos =
    empleados
      .map(
        (empleado) => {
          const compatibilidad =
            calcularCompatibilidadEmpleado({
              empleado,
              perfilTarea,
            });

          const nombreNormalizado =
            normalizarTexto(
              empleado.nombre
            );

          const carga =
            cargaActual[
              nombreNormalizado
            ] || 0;


          return {
            empleado,
            compatibilidad,
            carga,
          };
        }
      )
      .sort(
        (a, b) => {
          if (
            b.compatibilidad !==
            a.compatibilidad
          ) {
            return (
              b.compatibilidad -
              a.compatibilidad
            );
          }

          return (
            a.carga -
            b.carga
          );
        }
      );


  const mejor =
    candidatos[0];


  if (!mejor?.empleado) {
    return null;
  }


  return {
    empleadoId:
      mejor.empleado.id,

    usuarioId:
      mejor.empleado.usuario_id ||
      null,

    nombre:
      mejor.empleado.nombre,

    puesto:
      mejor.empleado.puesto ||
      null,

    perfilTarea,

    compatibilidad:
      mejor.compatibilidad,

    cargaActual:
      mejor.carga,

    metodo:
      mejor.compatibilidad >= 10
        ? "PUESTO_COMPATIBLE"
        : "MENOR_CARGA",
  };
}


// ======================================================
// CREAR EMPLEADO
// ======================================================

export async function crearEmpleadoRH({
  organizationId = null,
  businessId = null,
  branchId,
  nombre,
  puesto = null,
  fechaIngreso = null,
  sueldoBase = null,
  periodicidadPago = null,
  tipoContrato = null,
  usuarioId = null,
}) {
  if (!branchId) {
    throw new Error(
      "Falta branch_id para crear el empleado."
    );
  }

  if (!String(nombre || "").trim()) {
    throw new Error(
      "El nombre del empleado es obligatorio."
    );
  }

  let businessIdFinal =
    businessId || null;

  let organizationIdFinal =
    organizationId || null;


  if (
    !businessIdFinal ||
    !organizationIdFinal
  ) {
    const {
      data: sucursal,
      error: errorSucursal,
    } = await supabase
      .from("branches")
      .select(`
        id,
        business_id
      `)
      .eq(
        "id",
        branchId
      )
      .maybeSingle();

    if (errorSucursal) {
      console.error(
        "Error al obtener sucursal para RH:",
        errorSucursal
      );

      throw errorSucursal;
    }

    if (!sucursal) {
      throw new Error(
        "No se encontró la sucursal actual."
      );
    }

    businessIdFinal =
      businessIdFinal ||
      sucursal.business_id ||
      null;
  }


  if (
    !organizationIdFinal &&
    businessIdFinal
  ) {
    const {
      data: negocio,
      error: errorNegocio,
    } = await supabase
      .from("businesses")
      .select(`
        id,
        organization_id
      `)
      .eq(
        "id",
        businessIdFinal
      )
      .maybeSingle();

    if (errorNegocio) {
      console.error(
        "Error al obtener negocio para RH:",
        errorNegocio
      );

      throw errorNegocio;
    }

    if (!negocio) {
      throw new Error(
        "No se encontró el negocio de la sucursal actual."
      );
    }

    organizationIdFinal =
      negocio.organization_id ||
      null;
  }


  if (!organizationIdFinal) {
    throw new Error(
      "No fue posible determinar la organización del empleado."
    );
  }


  const nuevoEmpleado = {
    organization_id:
      organizationIdFinal,

    business_id:
      businessIdFinal,

    branch_id:
      branchId,

    nombre:
      String(nombre).trim(),

    puesto:
      puesto
        ? String(puesto).trim()
        : null,

    usuario_id:
      usuarioId || null,

    active:
      true,

    fecha_ingreso:
      fechaIngreso || null,

    sueldo_base:
      sueldoBase === "" ||
      sueldoBase === null ||
      sueldoBase === undefined
        ? null
        : Number(sueldoBase),

    periodicidad_pago:
      periodicidadPago || null,

    tipo_contrato:
      tipoContrato || null,

    fecha_baja:
      null,

    updated_at:
      new Date().toISOString(),
  };


  const {
    data,
    error,
  } = await supabase
    .from("empleados")
    .insert(
      nuevoEmpleado
    )
    .select()
    .single();

  if (error) {
    console.error(
      "Error al crear empleado RH:",
      error
    );

    throw error;
  }

  return data;
}


// ======================================================
// BAJA
// ======================================================

export async function darDeBajaEmpleadoRH(
  empleadoId
) {
  if (!empleadoId) {
    throw new Error(
      "Falta el id del empleado."
    );
  }

  const fechaBaja =
    new Date()
      .toISOString()
      .slice(0, 10);

  const {
    data,
    error,
  } = await supabase
    .from("empleados")
    .update({
      active:
        false,

      fecha_baja:
        fechaBaja,

      updated_at:
        new Date().toISOString(),
    })
    .eq(
      "id",
      empleadoId
    )
    .select()
    .single();

  if (error) {
    console.error(
      "Error al dar de baja empleado RH:",
      error
    );

    throw error;
  }

  return data;
}


// ======================================================
// REACTIVAR
// ======================================================

export async function reactivarEmpleadoRH(
  empleadoId
) {
  if (!empleadoId) {
    throw new Error(
      "Falta el id del empleado."
    );
  }

  const {
    data,
    error,
  } = await supabase
    .from("empleados")
    .update({
      active:
        true,

      fecha_baja:
        null,

      updated_at:
        new Date().toISOString(),
    })
    .eq(
      "id",
      empleadoId
    )
    .select()
    .single();

  if (error) {
    console.error(
      "Error al reactivar empleado RH:",
      error
    );

    throw error;
  }

  return data;
}


// ======================================================
// ACTUALIZAR
// ======================================================

export async function actualizarEmpleadoRH({
  empleadoId,
  nombre,
  puesto = null,
  fechaIngreso = null,
  sueldoBase = null,
  periodicidadPago = null,
  tipoContrato = null,
}) {
  if (!empleadoId) {
    throw new Error(
      "Falta el id del empleado."
    );
  }

  if (!String(nombre || "").trim()) {
    throw new Error(
      "El nombre del empleado es obligatorio."
    );
  }


  const cambios = {
    nombre:
      String(nombre).trim(),

    puesto:
      puesto
        ? String(puesto).trim()
        : null,

    fecha_ingreso:
      fechaIngreso || null,

    sueldo_base:
      sueldoBase === "" ||
      sueldoBase === null ||
      sueldoBase === undefined
        ? null
        : Number(sueldoBase),

    periodicidad_pago:
      periodicidadPago || null,

    tipo_contrato:
      tipoContrato || null,

    updated_at:
      new Date().toISOString(),
  };


  const {
    data,
    error,
  } = await supabase
    .from("empleados")
    .update(
      cambios
    )
    .eq(
      "id",
      empleadoId
    )
    .select()
    .single();

  if (error) {
    console.error(
      "Error al actualizar empleado RH:",
      error
    );

    throw error;
  }

  return data;
}


// ======================================================
// ELIMINAR
// ======================================================

export async function eliminarEmpleadoRH(
  empleadoId
) {
  if (!empleadoId) {
    throw new Error(
      "Falta el id del empleado."
    );
  }

  const {
    data,
    error,
  } = await supabase
    .from("empleados")
    .delete()
    .eq(
      "id",
      empleadoId
    )
    .select(
      "id"
    );

  if (error) {
    console.error(
      "Error al eliminar empleado RH:",
      error
    );

    throw error;
  }

  if (
    !data ||
    data.length === 0
  ) {
    throw new Error(
      "Supabase no permitió eliminar el empleado. Revisa la política DELETE de empleados."
    );
  }

  return true;
}