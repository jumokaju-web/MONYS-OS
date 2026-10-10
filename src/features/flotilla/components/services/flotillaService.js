import { supabase } from "../../../../supabase";
import { guardarCierreTurno } from "../../../inteligencia/services/cierresTurnoService";
import {
  crearObservacionesFlotilla,
  leerLiquidacionFlotilla,
} from "../../../inteligencia/utils/capturasFinancierasEquipo";

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
    .maybeSingle();

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

export async function guardarLiquidacionFlotilla({
  branchId,
  responsable,
  unidad,
  ruta,
  valores,
  nota,
}) {
  if (!unidad?.id) throw new Error("Selecciona una unidad para liquidar.");
  if (!String(responsable || "").trim()) {
    throw new Error("Falta el nombre de quien entrega la liquidación.");
  }
  if (String(valores?.ingresoRuta ?? "").trim() === "") {
    throw new Error("Escribe el ingreso cobrado por la ruta, aunque sea $0.");
  }

  return guardarCierreTurno({
    branchId,
    responsable,
    turno: "flotilla",
    pendientes: "Liquidación de flotilla pendiente de revisión por Dirección.",
    incidencias: nota || null,
    observaciones: crearObservacionesFlotilla(
      {
        ...valores,
        unidadId: unidad.id,
        placas: unidad.placas || "Sin placas",
        chofer: unidad.chofer_nombre || responsable,
        propietario: Array.isArray(unidad.propietarios)
          ? unidad.propietarios[0]?.nombre || unidad.propietarios[0] || ""
          : "",
        rutaId: ruta?.id || null,
        codigoRuta: ruta?.codigo_ruta || "Sin ruta registrada",
        paquetes: ruta?.paquetes_total ?? null,
        paros: ruta?.paros_total ?? null,
        kilometros: ruta?.kilometros_ruta ?? null,
      },
      nota
    ),
  });
}

export async function obtenerLiquidacionFlotillaHoy({ unidadId, fecha }) {
  if (!unidadId || !fecha) return null;

  const { data, error } = await supabase
    .from("cierres_turno")
    .select("id,branch_id,responsable,turno,observaciones,fecha,created_at")
    .eq("turno", "flotilla")
    .eq("fecha", fecha)
    .order("created_at", { ascending: false })
    .limit(20);

  if (error) throw new Error("No fue posible consultar la liquidación de hoy.");

  return (
    (data || [])
      .map((cierre) => ({ cierre, datos: leerLiquidacionFlotilla(cierre.observaciones) }))
      .find((item) => item.datos?.unidadId === unidadId) || null
  );
}

export { construirResumenSocios } from "./resumenSocios.js";

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
