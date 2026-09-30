import { supabase } from "../../../supabase";

const ESTADOS_EDITABLES = new Set([
  "BORRADOR",
  "REQUIERE_AJUSTES",
]);

function limpiarCanales(canales) {
  return [
    ...new Set(
      (Array.isArray(canales) ? canales : [])
        .map((canal) =>
          String(canal || "")
            .trim()
            .toUpperCase()
        )
        .filter(Boolean)
    ),
  ];
}

function limpiarProductos(productos) {
  return (Array.isArray(productos) ? productos : [])
    .map((producto) => {
      if (typeof producto === "string") {
        return {
          nombre: producto.trim(),
        };
      }

      return {
        codigo:
          String(producto?.codigo || "").trim() ||
          null,
        nombre: String(
          producto?.nombre || ""
        ).trim(),
        precio:
          producto?.precio === null ||
          producto?.precio === undefined
            ? null
            : Number(producto.precio),
        existencia:
          producto?.existencia === null ||
          producto?.existencia === undefined
            ? null
            : Number(producto.existencia),
      };
    })
    .filter((producto) => producto.nombre);
}

function validarBorrador({
  organizationId,
  businessId,
  canales,
  productos,
  contenidosPorCanal,
}) {
  if (!organizationId || !businessId) {
    throw new Error(
      "Falta identificar la empresa de esta publicación."
    );
  }

  if (canales.length === 0) {
    throw new Error(
      "Selecciona por lo menos un canal."
    );
  }

  if (productos.length === 0) {
    throw new Error(
      "Agrega por lo menos un producto real."
    );
  }

  if (
    !contenidosPorCanal ||
    typeof contenidosPorCanal !== "object" ||
    Array.isArray(contenidosPorCanal)
  ) {
    throw new Error(
      "Falta el contenido preparado por canal."
    );
  }
}

export async function crearBorradorPublicacion({
  organizationId,
  businessId,
  branchId = null,
  campanaId = null,
  productos = [],
  canales = [],
  contenidosPorCanal = {},
  programadaPara = null,
} = {}) {
  const canalesLimpios =
    limpiarCanales(canales);

  const productosLimpios =
    limpiarProductos(productos);

  validarBorrador({
    organizationId,
    businessId,
    canales: canalesLimpios,
    productos: productosLimpios,
    contenidosPorCanal,
  });

  const { data, error } = await supabase
    .from("marketing_publicaciones")
    .insert({
      organization_id: organizationId,
      business_id: businessId,
      branch_id: branchId || null,
      campana_id: campanaId || null,
      productos: productosLimpios,
      canales: canalesLimpios,
      contenidos_por_canal:
        contenidosPorCanal,
      programada_para:
        programadaPara || null,
      estado: "BORRADOR",
      requiere_autorizacion: true,
      updated_at: new Date().toISOString(),
    })
    .select()
    .single();

  if (error) {
    throw error;
  }

  return data;
}

export async function obtenerPublicacionesMarketing({
  organizationId,
  businessId = null,
  branchId = null,
  limite = 50,
} = {}) {
  if (!organizationId) {
    return [];
  }

  let consulta = supabase
    .from("marketing_publicaciones")
    .select("*")
    .eq("organization_id", organizationId)
    .order("created_at", {
      ascending: false,
    })
    .limit(Math.max(1, Math.min(100, limite)));

  if (businessId) {
    consulta = consulta.eq(
      "business_id",
      businessId
    );
  }

  if (branchId) {
    consulta = consulta.eq(
      "branch_id",
      branchId
    );
  }

  const { data, error } = await consulta;

  if (error) {
    throw error;
  }

  return data || [];
}

export async function actualizarBorradorPublicacion({
  publicacionId,
  estadoActual,
  productos,
  canales,
  contenidosPorCanal,
  programadaPara = null,
} = {}) {
  if (!ESTADOS_EDITABLES.has(estadoActual)) {
    throw new Error(
      "Esta publicación ya no puede editarse sin una nueva autorización."
    );
  }

  const canalesLimpios =
    limpiarCanales(canales);

  const productosLimpios =
    limpiarProductos(productos);

  if (!publicacionId) {
    throw new Error(
      "Falta identificar la publicación."
    );
  }

  const { data, error } = await supabase
    .from("marketing_publicaciones")
    .update({
      productos: productosLimpios,
      canales: canalesLimpios,
      contenidos_por_canal:
        contenidosPorCanal || {},
      programada_para:
        programadaPara || null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", publicacionId)
    .select()
    .single();

  if (error) {
    throw error;
  }

  return data;
}

export async function solicitarAprobacionPublicacion(
  publicacionId
) {
  const { data, error } = await supabase.rpc(
    "solicitar_aprobacion_publicacion_marketing",
    {
      p_publicacion_id: publicacionId,
    }
  );

  if (error) {
    throw error;
  }

  return data;
}

export async function resolverAprobacionPublicacion({
  publicacionId,
  aprobar,
  observaciones = "",
} = {}) {
  const { data, error } = await supabase.rpc(
    "resolver_aprobacion_publicacion_marketing",
    {
      p_publicacion_id: publicacionId,
      p_aprobar: Boolean(aprobar),
      p_observaciones:
        String(observaciones || "").trim() ||
        null,
    }
  );

  if (error) {
    throw error;
  }

  return data;
}

export async function programarPublicacionMarketing({
  publicacionId,
  programadaPara,
} = {}) {
  if (!publicacionId || !programadaPara) {
    throw new Error(
      "Selecciona la fecha y hora de publicación."
    );
  }

  const fecha = new Date(programadaPara);

  if (Number.isNaN(fecha.getTime())) {
    throw new Error(
      "La fecha de publicación no es válida."
    );
  }

  const { data, error } = await supabase.rpc(
    "programar_publicacion_marketing",
    {
      p_publicacion_id: publicacionId,
      p_programada_para: fecha.toISOString(),
    }
  );

  if (error) {
    throw error;
  }

  return data;
}
