import { supabase } from "../supabase";

export async function obtenerPermisosPorRol(role) {
  if (!role) {
    return [];
  }

  const { data, error } = await supabase
    .from("role_permissions")
    .select("permission, allowed")
    .eq("role", role)
    .eq("allowed", true);

  if (error) {
    throw new Error(
      `No se pudieron cargar los permisos: ${error.message}`
    );
  }

  return (data || []).map(
    (item) => item.permission
  );
}

export async function usuarioTienePermiso({
  role,
  permission,
}) {
  if (!role || !permission) {
    return false;
  }

  const { data, error } = await supabase
    .from("role_permissions")
    .select("permission")
    .eq("role", role)
    .eq("permission", permission)
    .eq("allowed", true)
    .maybeSingle();

  if (error) {
    throw new Error(
      `No se pudo validar el permiso: ${error.message}`
    );
  }

  return Boolean(data);
}