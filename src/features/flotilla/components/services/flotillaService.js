import { supabase } from "../../../../supabase";

const CAMPOS_UNIDAD = `
  id,
  placas,
  tipo_operacion,
  tipo_propiedad,
  propietarios,
  da_nombre,
  chofer_nombre,
  quien_saca_nombre,
  estado,
  aplica_admin_chory,
  observaciones
`;

export async function obtenerUnidadesFlotilla() {
  const { data, error } = await supabase
    .from("flotilla_unidades")
    .select(CAMPOS_UNIDAD)
    .order("placas", { ascending: true });

  if (error) {
    console.error("Error al obtener unidades de Flotilla:", error);
    throw new Error("No fue posible cargar las unidades de Flotilla.");
  }

  return Array.isArray(data) ? data : [];
}

export async function obtenerUnidadPorPlacas(
  placas
) {
  if (!placas) {
    throw new Error(
      "Faltan las placas de la unidad."
    );
  }

  const {
    data,
    error,
  } = await supabase
    .from("flotilla_unidades")
    .select(CAMPOS_UNIDAD)
    .eq("placas", placas)
    .single();

  if (error) {
    console.error(
      "Error al obtener unidad de Flotilla:",
      error
    );

    throw new Error(
      "No fue posible cargar la unidad de Flotilla."
    );
  }

  return data;
}
export async function obtenerRutaDeUnidadEnFecha(
  unidadId,
  fecha
) {
  if (!unidadId || !fecha) {
    throw new Error(
      "Faltan la unidad o la fecha de la ruta."
    );
  }

  const { data, error } = await supabase
    .from("flotilla_rutas")
    .select(`
      id,
      unidad_id,
      fecha,
      codigo_ruta,
      tipo_ruta,
      chofer_nombre,
      estado,
      paquetes_total,
      paros_total,
      kilometros_ruta
    `)
    .eq("unidad_id", unidadId)
    .eq("fecha", fecha)
    .order("created_at", {
      ascending: false,
    })
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error(
      "Error al obtener ruta de Flotilla:",
      error
    );

    throw new Error(
      "No fue posible cargar la ruta de Flotilla."
    );
  }

  return data;
}

export async function obtenerRutasFlotillaPeriodo({ desde, hasta }) {
  if (!desde || !hasta) {
    throw new Error("Selecciona el periodo de rutas.");
  }

  const { data, error } = await supabase
    .from("flotilla_rutas")
    .select(`
      id,
      unidad_id,
      fecha,
      codigo_ruta,
      tipo_ruta,
      chofer_nombre,
      estado,
      paquetes_total,
      paros_total,
      kilometros_ruta
    `)
    .gte("fecha", desde)
    .lte("fecha", hasta)
    .order("fecha", { ascending: false });

  if (error) {
    console.error("Error al obtener el periodo de Flotilla:", error);
    throw new Error("No fue posible consultar las rutas del periodo.");
  }

  return Array.isArray(data) ? data : [];
}

function nombrePropietario(unidad) {
  const propietarios = Array.isArray(unidad?.propietarios)
    ? unidad.propietarios
    : [];
  const principal = propietarios[0];

  if (typeof principal === "string") {
    return principal.trim() || "Sin propietario";
  }

  return String(principal?.nombre || "Sin propietario").trim();
}

function esUnidadRental(unidad) {
  const clasificacion = [unidad?.tipo_operacion, unidad?.tipo_propiedad]
    .map((valor) => String(valor || "").toLowerCase())
    .join(" ");

  return clasificacion.includes("rental");
}

export function construirResumenSocios({
  unidades = [],
  rutas = [],
  excluirRental = true,
}) {
  const unidadesValidas = (Array.isArray(unidades) ? unidades : []).filter(
    (unidad) => !excluirRental || !esUnidadRental(unidad)
  );
  const unidadesPorId = new Map(
    unidadesValidas.map((unidad) => [unidad.id, unidad])
  );
  const socios = new Map();

  unidadesValidas.forEach((unidad) => {
    const nombre = nombrePropietario(unidad);
    const actual = socios.get(nombre) || {
      socio: nombre,
      unidades: 0,
      rutas: 0,
      paquetes: 0,
      paros: 0,
      kilometros: 0,
      rutasConPaquetes: 0,
      rutasConKilometros: 0,
    };
    actual.unidades += 1;
    socios.set(nombre, actual);
  });

  (Array.isArray(rutas) ? rutas : []).forEach((ruta) => {
    const unidad = unidadesPorId.get(ruta?.unidad_id);
    if (!unidad) return;

    const nombre = nombrePropietario(unidad);
    const actual = socios.get(nombre);
    const paquetes = Number(ruta?.paquetes_total);
    const paros = Number(ruta?.paros_total);
    const kilometros = Number(ruta?.kilometros_ruta);

    actual.rutas += 1;
    actual.paquetes += Number.isFinite(paquetes) ? paquetes : 0;
    actual.paros += Number.isFinite(paros) ? paros : 0;
    actual.kilometros += Number.isFinite(kilometros) ? kilometros : 0;
    actual.rutasConPaquetes += Number.isFinite(paquetes) ? 1 : 0;
    actual.rutasConKilometros += Number.isFinite(kilometros) ? 1 : 0;
  });

  const totalRutas = [...socios.values()].reduce(
    (total, socio) => total + socio.rutas,
    0
  );

  return [...socios.values()]
    .map((socio) => ({
      ...socio,
      rutasPorUnidad:
        socio.unidades > 0 ? socio.rutas / socio.unidades : 0,
      participacionRutas:
        totalRutas > 0 ? (socio.rutas / totalRutas) * 100 : 0,
      paquetesPromedio:
        socio.rutasConPaquetes > 0
          ? socio.paquetes / socio.rutasConPaquetes
          : null,
      kilometrosPromedio:
        socio.rutasConKilometros > 0
          ? socio.kilometros / socio.rutasConKilometros
          : null,
    }))
    .sort((a, b) => b.rutasPorUnidad - a.rutasPorUnidad);
}

export function suscribirseARutasDeUnidad({
  unidadId,
  onCambio,
  onEstado,
}) {
  if (!unidadId) {
    return () => {};
  }

  const canal = supabase
    .channel(`flotilla-rutas-${unidadId}-${Date.now()}`)
    .on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: "flotilla_rutas",
        filter: `unidad_id=eq.${unidadId}`,
      },
      (cambio) => {
        if (typeof onCambio === "function") {
          onCambio(cambio);
        }
      }
    )
    .subscribe((estado) => {
      if (typeof onEstado === "function") {
        onEstado(estado);
      }
    });

  return () => {
    supabase.removeChannel(canal);
  };
}
