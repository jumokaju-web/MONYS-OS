import { supabase } from "../supabase";
import { combinarPermisosEfectivos } from "./permisosUtils";

export { combinarPermisosEfectivos } from "./permisosUtils";

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

export const PERMISOS_MONYS = [
  {
    permission: "gestionar_personal_operativo",
    label: "Supervisar personal y tiendas",
    description: "Organizar empleadas, sucursales, horarios, responsabilidades y operación diaria, sin nómina ni decisiones de propietaria.",
  },
  {
    permission: "gestionar_estado_usuarios",
    label: "Activar o pausar personal",
    description: "Consultar el directorio y activar o pausar usuarios, sin cambiar roles ni eliminarlos.",
  },
  {
    permission: "ver_finanzas",
    label: "Finanzas y dinero",
    description: "Consultar y registrar movimientos financieros.",
  },
  {
    permission: "ver_ventas",
    label: "Ventas",
    description: "Consultar información y resultados de ventas.",
  },
  {
    permission: "ver_inventario",
    label: "Inventario y compras",
    description: "Consultar inventario y usar Compra Maestra.",
  },
  {
    permission: "ver_logistica",
    label: "Flotilla",
    description: "Entrar al control de rutas, unidades y choferes.",
  },
  {
    permission: "ver_ordenes",
    label: "Centro de Órdenes",
    description: "Consultar y trabajar con órdenes.",
  },
  {
    permission: "registrar_producto_solicitado",
    label: "Producto solicitado",
    description: "Registrar productos pedidos por clientes.",
  },
  {
    permission: "registrar_incidencias",
    label: "Problemas e incidencias",
    description: "Registrar problemas de la operación.",
  },
  {
    permission: "registrar_ideas",
    label: "Ideas y oportunidades",
    description: "Registrar ideas y oportunidades de mejora.",
  },
];

export async function obtenerExcepcionesPermisos(usuarioId) {
  if (!usuarioId) {
    return [];
  }

  const { data, error } = await supabase
    .from("user_permission_overrides")
    .select("permission, allowed, updated_at")
    .eq("usuario_id", usuarioId);

  if (error) {
    throw error;
  }

  return data || [];
}

export async function obtenerPermisosUsuario({ usuarioId, role }) {
  if (!usuarioId || !role) {
    return [];
  }

  const [permisosRol, excepciones] = await Promise.all([
    obtenerPermisosPorRol(role),
    obtenerExcepcionesPermisos(usuarioId),
  ]);

  return combinarPermisosEfectivos(permisosRol, excepciones);
}

export async function obtenerConfiguracionPermisos({ usuarioId, role }) {
  const [permisosRol, excepciones] = await Promise.all([
    obtenerPermisosPorRol(role),
    obtenerExcepcionesPermisos(usuarioId),
  ]);
  const base = new Set(permisosRol);
  const excepcionesPorPermiso = new Map(
    excepciones.map((item) => [item.permission, item.allowed])
  );

  return PERMISOS_MONYS.map((item) => {
    const tieneExcepcion = excepcionesPorPermiso.has(item.permission);
    const override = tieneExcepcion
      ? excepcionesPorPermiso.get(item.permission)
      : null;

    return {
      ...item,
      inherited: base.has(item.permission),
      override,
      effective: override === null ? base.has(item.permission) : override,
    };
  });
}

export async function guardarPermisosUsuario({
  usuarioId,
  cambios,
  motivo,
}) {
  const { data, error } = await supabase.rpc(
    "configurar_permisos_usuario",
    {
      p_usuario_id: usuarioId,
      p_cambios: cambios,
      p_motivo: motivo,
    }
  );

  if (error) {
    throw error;
  }

  return data;
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
