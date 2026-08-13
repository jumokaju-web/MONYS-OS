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

    role,

    active:
      active !== false,
  };
}

/*
  ==========================================
  GUARDAR PERFIL DE USUARIO
  ==========================================

  IMPORTANTE:
  Esta función crea el registro empresarial
  dentro de public.usuarios.

  Todavía NO crea la cuenta de acceso de
  Supabase Auth.

  No la conectaremos al botón hasta terminar
  la seguridad y autenticación.
*/

export async function crearPerfilUsuario(
  nuevoUsuario
) {
  const {
    data,
    error,
  } = await supabase
    .from("usuarios")
    .insert({
      organization_id:
        nuevoUsuario.organization_id,

      business_id:
        nuevoUsuario.business_id,

      branch_id:
        nuevoUsuario.branch_id,

      nombre:
        nuevoUsuario.nombre,

      correo:
        nuevoUsuario.correo,

      telefono:
        nuevoUsuario.telefono,

      role:
        nuevoUsuario.role,

      active:
        nuevoUsuario.active,

      auth_user_id: null,
    })
    .select()
    .single();

  if (error) {
    throw error;
  }

  return data;
}