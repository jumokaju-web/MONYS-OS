import { supabase } from "../../../../supabase";
import { resumirOperacionFlotilla } from "../../utils/operacionFlotilla";

export { calcularAmbulancia, calcularPagoRuta, resumirOperacionFlotilla } from "../../utils/operacionFlotilla";

export async function obtenerUnidadesParaAcceso() {
  const { data, error } = await supabase
    .from("flotilla_unidades")
    .select("id, placas, chofer_nombre, chofer_auth_user_id, tipo_operacion, tipo_pago_chory")
    .not("chofer_nombre", "is", null)
    .order("placas", { ascending: true });

  if (error) throw new Error("No fue posible cargar las unidades para activación.");
  return Array.isArray(data) ? data : [];
}

export async function generarCodigoActivacionChofer(unidadId) {
  if (!unidadId) throw new Error("Selecciona una unidad.");
  const { data, error } = await supabase.rpc("generar_codigo_activacion_chofer", {
    p_unidad_id: unidadId,
  });

  if (error) throw new Error(error.message || "No fue posible generar el código.");
  const resultado = Array.isArray(data) ? data[0] : data;
  if (!resultado?.codigo) throw new Error("La base no devolvió un código de activación.");
  return resultado;
}

async function crearUrlEvidencia(path) {
  if (!path) return null;
  const { data, error } = await supabase.storage
    .from("flotilla-evidencias")
    .createSignedUrl(path, 60 * 60);
  return error ? null : data?.signedUrl || null;
}

export async function obtenerOperacionFlotillaEnVivo(fecha) {
  const { data: operaciones, error } = await supabase
    .from("flotilla_rutas")
    .select(`
      id, organization_id, business_id, branch_id, unidad_id,
      driver_auth_user_id, chofer_nombre, fecha, codigo_ruta, tipo_ruta,
      tipo_pago, estado, hora_inicio_ruta, hora_fin_ruta, km_inicial, km_final,
      kilometros_ruta, gasolina_in, gasolina_out, paquetes_total, paros_total,
      foto_salida_path, foto_cierre_path, updated_at,
      unidad:flotilla_unidades(placas, tipo_operacion, tipo_pago_chory)
    `)
    .eq("fecha", fecha)
    .order("updated_at", { ascending: false });

  if (error) throw new Error("No fue posible consultar la operación de Flotilla.");

  const ids = (operaciones || []).map((item) => item.id);
  if (ids.length === 0) return [];

  const [
    { data: dinero, error: errorDinero },
    { data: ambulancias, error: errorAmbulancias },
    { data: revisiones, error: errorRevisiones },
  ] = await Promise.all([
    supabase
      .from("flotilla_movimientos_dinero")
      .select("id, ruta_id, tipo_movimiento, uso, observaciones, monto, litros, pagador, evidencia_path, estado_conciliacion, created_at")
      .in("ruta_id", ids)
      .order("created_at", { ascending: true }),
    supabase
      .from("flotilla_ambulancias")
      .select("id, ruta_origen_id, ruta_apoyada_id, solicitante, ayudante, pago_por_kilometraje, kilometros_ambulancia, paros_apoyados, estado, observaciones, evidencia_path, created_at")
      .or(`ruta_origen_id.in.(${ids.join(",")}),ruta_apoyada_id.in.(${ids.join(",")})`)
      .order("created_at", { ascending: true }),
    supabase
      .from("flotilla_revision_evidencias")
      .select("id, ruta_id, evidencia_key, tipo_evidencia, referencia_id, estado, motivo, revisado_at")
      .in("ruta_id", ids),
  ]);

  if (errorDinero || errorAmbulancias || errorRevisiones) {
    throw new Error("No fue posible consultar gasolina, ambulancias y revisión de evidencias.");
  }

  const revisionesPorRuta = (revisiones || []).reduce((mapa, revision) => {
    if (!mapa.has(revision.ruta_id)) mapa.set(revision.ruta_id, new Map());
    mapa.get(revision.ruta_id).set(revision.evidencia_key, revision);
    return mapa;
  }, new Map());

  const [operacionesConFotos, dineroConFotos, ambulanciasConFotos] = await Promise.all([
    Promise.all((operaciones || []).map(async (item) => ({
      ...item,
      foto_salida_url: await crearUrlEvidencia(item.foto_salida_path),
      foto_cierre_url: await crearUrlEvidencia(item.foto_cierre_path),
    }))),
    Promise.all((dinero || []).map(async (item) => ({
      ...item,
      evidencia_url: await crearUrlEvidencia(item.evidencia_path),
    }))),
    Promise.all((ambulancias || []).map(async (item) => ({
      ...item,
      evidencia_url: await crearUrlEvidencia(item.evidencia_path),
    }))),
  ]);

  const movimientosDinero = dineroConFotos.map((item) => ({
    id: item.id,
    operacion_id: item.ruta_id,
    tipo: item.tipo_movimiento,
    uso: item.uso,
    concepto: item.observaciones,
    importe: item.monto,
    litros: item.litros,
    pagador: item.pagador,
    evidencia_url: item.evidencia_url,
    evidencia_key: `${item.tipo_movimiento}:${item.id}`,
    estado: item.estado_conciliacion === "CONCILIADO"
      ? (item.tipo_movimiento === "ADELANTO" ? "ENTREGADO" : "CONFIRMADO")
      : item.estado_conciliacion === "DESCARTADO" ? "RECHAZADO"
        : item.tipo_movimiento === "ADELANTO" ? "SOLICITADO" : "CAPTURADO",
    created_at: item.created_at,
  }));
  const movimientosAmbulancia = ambulanciasConFotos.flatMap((item) => {
    const estado = item.estado === "CONFIRMADA" ? "CONFIRMADO"
      : item.estado === "CANCELADA" ? "RECHAZADO" : "SOLICITADO";
    const abono = {
      id: `${item.id}:ABONO`,
      registro_id: item.id,
      operacion_id: item.ruta_origen_id,
      ruta_apoyada_id: item.ruta_apoyada_id,
      tipo: "AMBULANCIA",
      concepto: item.observaciones,
      importe: item.pago_por_kilometraje,
      kilometros: item.kilometros_ambulancia,
      paradas: item.paros_apoyados,
      choferRelacionado: item.solicitante,
      evidencia_url: item.evidencia_url,
      evidencia_key: `AMBULANCIA:${item.id}`,
      estado,
      created_at: item.created_at,
    };
    if (!item.ruta_apoyada_id) return [abono];
    return [abono, {
      ...abono,
      id: `${item.id}:DESCUENTO`,
      operacion_id: item.ruta_apoyada_id,
      tipo: "AMBULANCIA_DESCUENTO",
      choferRelacionado: item.ayudante,
    }];
  });

  return operacionesConFotos.map((operacion) => {
    const revisionesRuta = revisionesPorRuta.get(operacion.id) || new Map();
    const propios = [...movimientosDinero, ...movimientosAmbulancia]
      .filter((item) => item.operacion_id === operacion.id)
      .map((item) => ({ ...item, revision_evidencia: revisionesRuta.get(item.evidencia_key) || null }));
    const operacionRevisada = {
      ...operacion,
      revision_foto_salida: revisionesRuta.get("RUTA:SALIDA") || null,
      revision_foto_cierre: revisionesRuta.get("RUTA:CIERRE") || null,
    };
    return { ...operacionRevisada, movimientos: propios, resumen: resumirOperacionFlotilla(operacionRevisada, propios) };
  });
}

export async function guardarRevisionEvidencia({ rutaId, evidenciaKey, tipoEvidencia, referenciaId = null, estado, motivo = null }) {
  if (!rutaId || !evidenciaKey || !tipoEvidencia || !["APROBADA", "RECHAZADA"].includes(estado)) {
    throw new Error("La revisión de evidencia no es válida.");
  }
  if (estado === "RECHAZADA" && !String(motivo || "").trim()) {
    throw new Error("Selecciona el motivo del rechazo.");
  }

  const { data, error } = await supabase
    .from("flotilla_revision_evidencias")
    .upsert({
      ruta_id: rutaId,
      evidencia_key: evidenciaKey,
      tipo_evidencia: tipoEvidencia,
      referencia_id: referenciaId,
      estado,
      motivo: estado === "RECHAZADA" ? String(motivo).trim() : null,
    }, { onConflict: "ruta_id,evidencia_key" })
    .select("id, ruta_id, evidencia_key, tipo_evidencia, referencia_id, estado, motivo, revisado_at")
    .single();

  if (error) throw new Error(error.message || "No fue posible guardar la revisión de la foto.");
  return data;
}

export async function confirmarMovimientoChofer(movimientoId, estado, tipo, datos = {}) {
  if (!movimientoId || !["CONFIRMADO", "ENTREGADO", "RECHAZADO"].includes(estado)) {
    throw new Error("El movimiento o estado no es válido.");
  }

  const esAmbulancia = tipo === "AMBULANCIA";
  const tabla = esAmbulancia ? "flotilla_ambulancias" : "flotilla_movimientos_dinero";
  if (esAmbulancia && estado === "CONFIRMADO" && !datos.rutaApoyadaId) {
    throw new Error("Selecciona la ruta del chofer que recibió el apoyo.");
  }
  const cambio = esAmbulancia
    ? {
      estado: estado === "RECHAZADO" ? "CANCELADA" : "CONFIRMADA",
      ...(estado === "CONFIRMADO" ? { ruta_apoyada_id: datos.rutaApoyadaId } : {}),
    }
    : { estado_conciliacion: estado === "RECHAZADO" ? "DESCARTADO" : "CONCILIADO" };
  const idRegistro = String(movimientoId).split(":")[0];
  const { error } = await supabase.from(tabla).update(cambio).eq("id", idRegistro);

  if (error) throw new Error(error.message || "No fue posible confirmar el movimiento.");
}

export async function obtenerCorteRental(fecha) {
  const { data, error } = await supabase
    .from("flotilla_rental_cortes")
    .select("id, fecha, ingreso, otro_concepto, otro_importe, updated_at")
    .eq("fecha", fecha)
    .maybeSingle();

  if (error) throw new Error("No fue posible consultar el corte de rentals.");
  return data || { fecha, ingreso: 0, otro_concepto: "", otro_importe: 0 };
}

export async function guardarCorteRental(fecha, corte) {
  const { data: auth, error: authError } = await supabase.auth.getUser();
  if (authError || !auth?.user) throw new Error("La sesión administrativa ya no está activa.");

  const { data: perfil, error: perfilError } = await supabase
    .from("usuarios")
    .select("organization_id")
    .eq("auth_user_id", auth.user.id)
    .eq("active", true)
    .single();
  if (perfilError || !perfil?.organization_id) throw new Error("La cuenta no está vinculada a una organización.");

  const payload = {
    organization_id: perfil.organization_id,
    fecha,
    ingreso: Number(corte.ingreso) || 0,
    otro_concepto: String(corte.otro_concepto || "").trim() || null,
    otro_importe: Number(corte.otro_importe) || 0,
  };
  const { data, error } = await supabase
    .from("flotilla_rental_cortes")
    .upsert(payload, { onConflict: "organization_id,fecha" })
    .select("id, fecha, ingreso, otro_concepto, otro_importe, updated_at")
    .single();

  if (error) throw new Error("No fue posible guardar el corte de rentals.");
  return data;
}

export async function obtenerOperacionRentalPeriodo(desde, hasta) {
  if (!desde || !hasta || desde > hasta) throw new Error("Selecciona un periodo válido para Rental.");

  const [{ data: operaciones, error: errorOperaciones }, { data: cortes, error: errorCortes }] = await Promise.all([
    supabase
      .from("flotilla_rutas")
      .select(`
        id, chofer_nombre, fecha, codigo_ruta, tipo_pago, estado,
        km_inicial, km_final, kilometros_ruta,
        unidad:flotilla_unidades(placas, tipo_pago_chory)
      `)
      .gte("fecha", desde)
      .lte("fecha", hasta)
      .order("fecha", { ascending: true }),
    supabase
      .from("flotilla_rental_cortes")
      .select("id, fecha, ingreso, otro_concepto, otro_importe, updated_at")
      .gte("fecha", desde)
      .lte("fecha", hasta)
      .order("fecha", { ascending: true }),
  ]);

  if (errorOperaciones || errorCortes) throw new Error("No fue posible consultar el periodo de Rental.");

  const rentals = (operaciones || []).filter((item) =>
    ["RENTAL_SMALL", "RENTAL_LARGE"].includes(item.tipo_pago || item.unidad?.tipo_pago_chory)
  );
  const ids = rentals.map((item) => item.id);
  if (ids.length === 0) return { operaciones: [], cortes: cortes || [] };

  const [{ data: dinero, error: errorDinero }, { data: ambulancias, error: errorAmbulancias }] = await Promise.all([
    supabase
      .from("flotilla_movimientos_dinero")
      .select("id, ruta_id, tipo_movimiento, monto, pagador, estado_conciliacion")
      .in("ruta_id", ids),
    supabase
      .from("flotilla_ambulancias")
      .select("id, ruta_origen_id, ruta_apoyada_id, pago_por_kilometraje, estado")
      .or(`ruta_origen_id.in.(${ids.join(",")}),ruta_apoyada_id.in.(${ids.join(",")})`),
  ]);

  if (errorDinero || errorAmbulancias) throw new Error("No fue posible consultar adelantos, gasolina y ambulancias del periodo.");

  const movimientosDinero = (dinero || []).map((item) => ({
    id: item.id,
    operacion_id: item.ruta_id,
    tipo: item.tipo_movimiento,
    importe: item.monto,
    pagador: item.pagador,
    estado: item.estado_conciliacion === "CONCILIADO"
      ? (item.tipo_movimiento === "ADELANTO" ? "ENTREGADO" : "CONFIRMADO")
      : item.estado_conciliacion === "DESCARTADO" ? "RECHAZADO"
        : item.tipo_movimiento === "ADELANTO" ? "SOLICITADO" : "CAPTURADO",
  }));
  const movimientosAmbulancia = (ambulancias || []).flatMap((item) => {
    const estado = item.estado === "CONFIRMADA" ? "CONFIRMADO"
      : item.estado === "CANCELADA" ? "RECHAZADO" : "SOLICITADO";
    const abono = {
      id: `${item.id}:ABONO`,
      operacion_id: item.ruta_origen_id,
      tipo: "AMBULANCIA",
      importe: item.pago_por_kilometraje,
      estado,
    };
    if (!item.ruta_apoyada_id) return [abono];
    return [abono, {
      ...abono,
      id: `${item.id}:DESCUENTO`,
      operacion_id: item.ruta_apoyada_id,
      tipo: "AMBULANCIA_DESCUENTO",
    }];
  });

  return {
    operaciones: rentals.map((operacion) => {
      const movimientos = [...movimientosDinero, ...movimientosAmbulancia]
        .filter((item) => item.operacion_id === operacion.id);
      return { ...operacion, movimientos, resumen: resumirOperacionFlotilla(operacion, movimientos) };
    }),
    cortes: cortes || [],
  };
}

export function suscribirseAOperacionFlotilla({ onCambio, onEstado }) {
  const canal = supabase
    .channel(`flotilla-operacion-en-vivo-${Date.now()}`)
    .on("postgres_changes", { event: "*", schema: "public", table: "flotilla_rutas" }, onCambio)
    .on("postgres_changes", { event: "*", schema: "public", table: "flotilla_movimientos_dinero" }, onCambio)
    .on("postgres_changes", { event: "*", schema: "public", table: "flotilla_ambulancias" }, onCambio)
    .on("postgres_changes", { event: "*", schema: "public", table: "flotilla_revision_evidencias" }, onCambio)
    .on("postgres_changes", { event: "*", schema: "public", table: "flotilla_rental_cortes" }, onCambio)
    .subscribe(onEstado);

  return () => supabase.removeChannel(canal);
}
