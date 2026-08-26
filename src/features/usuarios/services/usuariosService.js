import { supabase } from "../../../supabase";

/*
  ==========================================
  USUARIOS
  ==========================================
*/

export async function obtenerUsuarios() {
  const {
    data,
    error,
  } = await supabase
    .from("usuarios")
    .select(`
      id,
      organization_id,
      business_id,
      branch_id,
      auth_user_id,
      nombre,
      correo,
      telefono,
      role,
      active,
      created_at,
      updated_at
    `)
    .order("nombre", {
      ascending: true,
    });

  if (error) {
    throw error;
  }

  return data || [];
}

/*
  ==========================================
  NEGOCIOS
  ==========================================
*/

export async function obtenerNegociosActivos() {
  const {
    data,
    error,
  } = await supabase
    .from("businesses")
    .select(`
      id,
      organization_id,
      name,
      active
    `)
    .eq("active", true)
    .order("name", {
      ascending: true,
    });

  if (error) {
    throw error;
  }

  return data || [];
}

/*
  ==========================================
  SUCURSALES
  ==========================================
*/

export async function obtenerSucursalesActivas() {
  const {
    data,
    error,
  } = await supabase
    .from("branches")
    .select(`
      id,
      business_id,
      name,
      active
    `)
    .eq("active", true)
    .order("name", {
      ascending: true,
    });

  if (error) {
    throw error;
  }

  return data || [];
}

/*
  ==========================================
  VALIDACIÓN DEL NUEVO USUARIO
  ==========================================
*/

export function validarNuevoUsuario({
  nombre,
  correo,
  telefono,
  password,
  role,
  business_id,
  branch_id,
  active,
  negocios = [],
  sucursales = [],
}) {
  if (!nombre?.trim()) {
    throw new Error(
      "Debes escribir el nombre del usuario."
    );
  }

  if (!correo?.trim()) {
    throw new Error(
      "Debes escribir el correo del usuario."
    );
  }

  if (!password || password.length < 8) {
    throw new Error(
      "La contraseña temporal debe tener por lo menos 8 caracteres."
    );
  }

  if (!role) {
    throw new Error(
      "Debes seleccionar un rol."
    );
  }

  if (!business_id) {
    throw new Error(
      "Debes seleccionar un negocio."
    );
  }

  if (!branch_id) {
    throw new Error(
      "Debes seleccionar una sucursal."
    );
  }

  const negocioSeleccionado =
    negocios.find(
      (negocio) =>
        negocio.id === business_id
    );

  if (!negocioSeleccionado) {
    throw new Error(
      "El negocio seleccionado no es válido."
    );
  }

  const sucursalSeleccionada =
    sucursales.find(
      (sucursal) =>
        sucursal.id === branch_id
    );

  if (!sucursalSeleccionada) {
    throw new Error(
      "La sucursal seleccionada no es válida."
    );
  }

  if (
    sucursalSeleccionada.business_id !==
    business_id
  ) {
    throw new Error(
      "La sucursal no pertenece al negocio seleccionado."
    );
  }

  return {
    organization_id:
      negocioSeleccionado.organization_id,

    business_id,

    branch_id,

    nombre:
      nombre.trim(),

    correo:
      correo.trim().toLowerCase(),

    telefono:
      telefono?.trim() || null,

    password,

    role,

    active:
      active !== false,
  };
}

/*
  ==========================================
  CREAR USUARIO COMPLETO
  ==========================================
*/

export async function crearPerfilUsuario(
  nuevoUsuario
) {
  const {
    data,
    error,
  } =
    await supabase.functions.invoke(
      "crear-usuario-monys",
      {
        body: nuevoUsuario,
      }
    );

  if (error) {
    throw error;
  }

  if (!data?.ok) {
    throw new Error(
      data?.error ||
        "No fue posible crear el usuario."
    );
  }

  return data.usuario;
}

export async function cambiarEstadoUsuario(
  usuarioId,
  active
) {
  const {
    data,
    error,
  } = await supabase
    .from("usuarios")
    .update({
      active,
    })
    .eq("id", usuarioId)
    .select()
    .single();

  if (error) {
    throw error;
  }

  return data;
}

export async function eliminarUsuarioMonys(
  usuarioId
) {
  const {
    data,
    error,
  } =
    await supabase.functions.invoke(
      "eliminar-usuario-monys",
      {
        body: {
          usuario_id: usuarioId,
        },
      }
    );

  if (error) {
    throw error;
  }

  if (!data?.ok) {
    throw new Error(
      data?.error ||
        "No fue posible eliminar el usuario."
    );
  }

  return data;
}