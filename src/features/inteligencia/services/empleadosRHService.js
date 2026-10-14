import { supabase } from "../../../supabase";
import {
  limpiarResponsabilidadesEmpleado,
  resolverResponsabilidadesEmpleado,
} from "../shared/responsabilidadesEmpleado";


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
        responsabilidades,
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

  return anexarAuthUserIds(Array.isArray(data) ? data : []);
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
      responsabilidades,
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


async function anexarAuthUserIds(empleados) {
  const referencias = [...new Set(empleados.map((empleado) => empleado.usuario_id).filter(Boolean).map(String))];
  if (!referencias.length) return empleados.map((empleado) => ({ ...empleado, auth_user_id: null }));

  const [porId, porAuthId] = await Promise.all([
    supabase.from("usuarios").select("id, auth_user_id").in("id", referencias),
    supabase.from("usuarios").select("id, auth_user_id").in("auth_user_id", referencias),
  ]);
  if (porId.error) throw porId.error;
  if (porAuthId.error) throw porAuthId.error;

  const authPorReferencia = new Map();
  for (const usuario of [...(porId.data || []), ...(porAuthId.data || [])]) {
    if (usuario.id && usuario.auth_user_id) authPorReferencia.set(String(usuario.id), usuario.auth_user_id);
    if (usuario.auth_user_id) authPorReferencia.set(String(usuario.auth_user_id), usuario.auth_user_id);
  }
  return empleados.map((empleado) => ({
    ...empleado,
    auth_user_id: authPorReferencia.get(String(empleado.usuario_id)) || null,
  }));
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
    texto.includes("whatsapp") ||
    texto.includes("grupo de whats") ||
    texto.includes("grupos de whats")
  ) {
    return "whatsapp";
  }

  if (
    texto.includes("caja") ||
    texto.includes("corte") ||
    texto.includes("fondo fijo")
  ) {
    return "caja";
  }


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
    return "inventario";
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
  const responsabilidades = new Set(
    resolverResponsabilidadesEmpleado(empleado)
  );

  if (!puesto) {
    return 1;
  }


  let puntos = 1;

  if (
    perfilTarea === "whatsapp" &&
    (
      responsabilidades.has("VENTA_WHATSAPP") ||
      responsabilidades.has("PUBLICAR_GRUPOS_WHATSAPP")
    )
  ) {
    puntos += 14;
  }

  if (
    perfilTarea === "caja" &&
    responsabilidades.has("CAJA_CORTE")
  ) {
    puntos += 14;
  }

  if (
    perfilTarea === "inventario" &&
    responsabilidades.has("INVENTARIO_APOYO")
  ) {
    puntos += 14;
  }


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
    (responsabilidades.has("VENTA_TIENDA") ||
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
    (responsabilidades.has("VENTA_TIENDA") ||
      responsabilidades.has("VENTA_WHATSAPP") ||
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
  requiereUsuarioVinculado = false,
} = {}) {
  if (!branchId) {
    return null;
  }

  const empleados =
    await obtenerEmpleadosActivosParaAsignacion(
      branchId
    );

  if (empleados.length === 0) {
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
      fecha: fechaTarea,
    });

  const perfilesEspecificos = [
    "marketing",
    "tienda",
    "ventas",
    "rh",
    "administracion",
    "flotilla",
  ];

  const requierePerfilEspecifico =
    perfilesEspecificos.includes(
      perfilTarea
    );

  const candidatos =
    empleados
      .filter(
        (empleado) =>
          !requiereUsuarioVinculado ||
          Boolean(empleado?.usuario_id)
      )
      .map((empleado) => {
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
      })
      .filter(
        (candidato) =>
          !requierePerfilEspecifico ||
          candidato.compatibilidad >= 10
      )
      .sort((a, b) => {
        if (
          b.compatibilidad !==
          a.compatibilidad
        ) {
          return (
            b.compatibilidad -
            a.compatibilidad
          );
        }

        return a.carga - b.carga;
      });

  const mejor = candidatos[0];

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
      requierePerfilEspecifico
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
  responsabilidades = [],
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

    responsabilidades:
      limpiarResponsabilidadesEmpleado(responsabilidades),

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

export async function darDeBajaEmpleadoRH({ empleadoId, motivo, fechaBaja = null }) {
  if (!empleadoId) {
    throw new Error(
      "Falta el id del empleado."
    );
  }
  if (!String(motivo || "").trim()) throw new Error("Escribe el motivo de la baja.");
  const { data, error } = await supabase.rpc("registrar_movimiento_laboral_empleado", {
    p_empleado_id: empleadoId,
    p_tipo: "BAJA",
    p_fecha: fechaBaja,
    p_motivo: String(motivo).trim(),
  });

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
  { empleadoId, motivo, fechaReactivacion = null }
) {
  if (!empleadoId) {
    throw new Error(
      "Falta el id del empleado."
    );
  }
  if (!String(motivo || "").trim()) throw new Error("Escribe el motivo de la reactivación.");
  const { data, error } = await supabase.rpc("registrar_movimiento_laboral_empleado", {
    p_empleado_id: empleadoId,
    p_tipo: "REACTIVACION",
    p_fecha: fechaReactivacion,
    p_motivo: String(motivo).trim(),
  });

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
  responsabilidades = [],
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

    responsabilidades:
      limpiarResponsabilidadesEmpleado(responsabilidades),

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


export async function obtenerMovimientosLaboralesRH(branchId) {
  if (!branchId) return [];
  const { data, error } = await supabase
    .from("empleados_movimientos_laborales")
    .select("id,empleado_id,tipo,fecha_efectiva,motivo,estado_anterior,estado_nuevo,registrado_en")
    .eq("branch_id", branchId)
    .order("registrado_en", { ascending: false });
  if (error) throw new Error(error.message || "No fue posible consultar el historial laboral.");
  return data || [];
}
