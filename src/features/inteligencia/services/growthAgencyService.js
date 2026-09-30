import { supabase } from "../../../supabase";

export async function obtenerEspaciosGrowth({
  organizationId,
} = {}) {
  if (!organizationId) {
    return [];
  }

  const {
    data: negocios,
    error: errorNegocios,
  } = await supabase
    .from("businesses")
    .select("id, organization_id, name, active")
    .eq("organization_id", organizationId)
    .eq("active", true)
    .order("name", {
      ascending: true,
    });

  if (errorNegocios) {
    throw errorNegocios;
  }

  const businessIds = (negocios || []).map(
    (negocio) => negocio.id
  );

  if (businessIds.length === 0) {
    return [];
  }

  const {
    data: sucursales,
    error: errorSucursales,
  } = await supabase
    .from("branches")
    .select("id, business_id, name, active")
    .in("business_id", businessIds)
    .eq("active", true)
    .order("name", {
      ascending: true,
    });

  if (errorSucursales) {
    throw errorSucursales;
  }

  return (negocios || []).flatMap(
    (negocio) => {
      const sucursalesNegocio = (
        sucursales || []
      ).filter(
        (sucursal) =>
          sucursal.business_id === negocio.id
      );

      if (sucursalesNegocio.length === 0) {
        return [
          {
            organization_id:
              negocio.organization_id,
            business_id: negocio.id,
            branch_id: null,
            negocio: negocio.name,
            sucursal: "Todas / No aplica",
          },
        ];
      }

      return sucursalesNegocio.map(
        (sucursal) => ({
          organization_id:
            negocio.organization_id,
          business_id: negocio.id,
          branch_id: sucursal.id,
          negocio: negocio.name,
          sucursal: sucursal.name,
        })
      );
    }
  );
}

export function claveEspacioGrowth(espacio) {
  return [
    espacio?.organization_id || "",
    espacio?.business_id || "",
    espacio?.branch_id || "",
  ].join(":");
}
