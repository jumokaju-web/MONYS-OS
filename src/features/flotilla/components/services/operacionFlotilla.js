import { supabase } from "../../../../supabase";
import { resumirOperacionFlotilla } from "../../utils/operacionFlotilla";
import { crearNombreCanalOperacion } from "../../utils/realtimeFlotilla";
import { separarRutasPorCierre } from "../../utils/cierreSemanalFlotilla";

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

export async function obtenerMiAccesoFlotilla() {
  const { data: auth } = await supabase.auth.getUser();
  if (!auth?.user) return null;
  const { data, error } = await supabase
    .from("flotilla_accesos_usuario")
    .select("id, tipo_acceso, socio_nombre, activo, unidades:flotilla_acceso_unidades(unidad_id)")
    .eq("auth_user_id", auth.user.id)
    .eq("activo", true)
    .maybeSingle();
  if (error) throw new Error("No fue posible consultar el acceso de Flotilla.");
  return data ? { ...data, unidadIds: (data.unidades || []).map((item) => item.unidad_id) } : null;
}

export async function obtenerAccesosFlotilla() {
  const { data, error } = await supabase
    .from("flotilla_accesos_usuario")
    .select("id, correo, nombre, tipo_acceso, socio_nombre, activo, unidades:flotilla_acceso_unidades(unidad_id)")
    .order("nombre", { ascending: true });
  if (error) throw new Error("No fue posible consultar los accesos de Flotilla.");
  return Array.isArray(data) ? data : [];
}

export async function configurarAccesoFlotilla({ correo, tipoAcceso, socioNombre, unidadIds }) {
  if (!String(correo || "").trim()) throw new Error("Escribe el correo de la cuenta MONYS.");
  const { data, error } = await supabase.rpc("configurar_acceso_flotilla", {
    p_correo: String(correo).trim().toLowerCase(),
    p_tipo_acceso: tipoAcceso,
    p_socio_nombre: tipoAcceso === "SOCIO_CONSULTA" ? socioNombre : null,
    p_unidad_ids: tipoAcceso === "SOCIO_CONSULTA" ? unidadIds : [],
  });
  if (error) throw new Error(error.message || "No fue posible configurar el acceso.");
  return Array.isArray(data) ? data[0] : data;
}

export async function desactivarAccesoFlotilla(correo) {
  const { data, error } = await supabase.rpc("desactivar_acceso_flotilla", { p_correo: correo });
  if (error) throw new Error(error.message || "No fue posible quitar el acceso.");
  return data;
}

async function crearUrlEvidencia(path) {
  if (!path) return null;
  const { data, error } = await supabase.storage
    .from("flotilla-evidencias")
    .createSignedUrl(path, 60 * 60);
  return error ? null : data?.signedUrl || null;
}

export async function obtenerOperacionFlotillaEnVivo(
  fecha,
  { incluirPropietarios = true } = {}
) {
  const camposUnidad = incluirPropietarios
    ? "placas, tipo_operacion, tipo_pago_chory, propietarios"
    : "placas, tipo_operacion, tipo_pago_chory";
  const { data: operaciones, error } = await supabase
    .from("flotilla_rutas")
    .select(`
      id, organization_id, business_id, branch_id, unidad_id,
      driver_auth_user_id, chofer_nombre, fecha, codigo_ruta, tipo_ruta,
      tipo_pago, estado, hora_inicio_ruta, hora_fin_ruta, km_inicial, km_final,
      kilometros_ruta, gasolina_in, gasolina_out, paquetes_total, paros_total,
      foto_salida_path, foto_cierre_path, updated_at,
      unidad:flotilla_unidades(${camposUnidad})
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
      .select("id, ruta_id, tipo_movimiento, uso, observaciones, monto, litros, pagador, evidencia_path, evidencia_ticket_path, evidencia_tablero_antes_path, evidencia_tablero_despues_path, clasificacion_gasolina, estado_conciliacion, created_at")
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
      evidencia_ticket_url: await crearUrlEvidencia(item.evidencia_ticket_path || item.evidencia_path),
      evidencia_tablero_antes_url: await crearUrlEvidencia(item.evidencia_tablero_antes_path),
      evidencia_tablero_despues_url: await crearUrlEvidencia(item.evidencia_tablero_despues_path),
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
    evidencia_ticket_url: item.evidencia_ticket_url,
    evidencia_tablero_antes_url: item.evidencia_tablero_antes_url,
    evidencia_tablero_despues_url: item.evidencia_tablero_despues_url,
    evidencia_ticket_path: item.evidencia_ticket_path || item.evidencia_path,
    evidencia_tablero_antes_path: item.evidencia_tablero_antes_path,
    evidencia_tablero_despues_path: item.evidencia_tablero_despues_path,
    clasificacion_gasolina: item.clasificacion_gasolina,
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
      .map((item) => item.tipo === "GASOLINA" ? {
        ...item,
        revision_ticket: revisionesRuta.get(`GASOLINA_TICKET:${item.id}`) || revisionesRuta.get(item.evidencia_key) || null,
        revision_tablero_antes: revisionesRuta.get(`GASOLINA_TABLERO_ANTES:${item.id}`) || null,
        revision_tablero_despues: revisionesRuta.get(`GASOLINA_TABLERO_DESPUES:${item.id}`) || null,
      } : { ...item, revision_evidencia: revisionesRuta.get(item.evidencia_key) || null });
    const operacionRevisada = {
      ...operacion,
      revision_foto_salida: revisionesRuta.get("RUTA:SALIDA") || null,
      revision_foto_cierre: revisionesRuta.get("RUTA:CIERRE") || null,
    };
    return { ...operacionRevisada, movimientos: propios, resumen: resumirOperacionFlotilla(operacionRevisada, propios) };
  });
}

export async function obtenerOperacionFlotillaPeriodo(desde, hasta) {
  if (!desde || !hasta || desde > hasta) throw new Error("Selecciona un periodo válido para la prefactura.");
  const inicio = new Date(`${desde}T12:00:00Z`);
  const fin = new Date(`${hasta}T12:00:00Z`);
  const dias = Math.floor((fin - inicio) / 86400000) + 1;
  if (!Number.isFinite(dias) || dias < 1 || dias > 31) throw new Error("La prefactura permite periodos de hasta 31 días.");

  const fechas = Array.from({ length: dias }, (_, indice) => {
    const fecha = new Date(inicio);
    fecha.setUTCDate(fecha.getUTCDate() + indice);
    return fecha.toISOString().slice(0, 10);
  });
  const resultados = [];
  for (let indice = 0; indice < fechas.length; indice += 7) {
    const bloque = fechas.slice(indice, indice + 7);
    resultados.push(...(await Promise.all(bloque.map((fecha) => obtenerOperacionFlotillaEnVivo(fecha)))).flat());
  }
  return resultados.sort((a, b) => `${a.fecha}-${a.codigo_ruta || ""}`.localeCompare(`${b.fecha}-${b.codigo_ruta || ""}`));
}

export async function obtenerDescuentosPnrPeriodo(desde, hasta) {
  if (!desde || !hasta || desde > hasta) throw new Error("Selecciona un periodo válido para los descuentos PNR.");
  const { data, error } = await supabase
    .from("flotilla_pnr_descuentos")
    .select(`
      id, periodo_desde, periodo_hasta, monto, aplica_socio, aplica_chofer, estado, observaciones,
      pnr:flotilla_pnr_expedientes(
        id, unidad_id, driver_auth_user_id, chofer_nombre, paquete_id,
        unidad:flotilla_unidades(placas, propietarios)
      )
    `)
    .eq("estado", "APLICADO")
    .eq("periodo_desde", desde)
    .eq("periodo_hasta", hasta)
    .order("created_at", { ascending: true });
  if (error) throw new Error(error.message || "No fue posible consultar los descuentos PNR del corte.");
  return Array.isArray(data) ? data : [];
}

export async function obtenerAjustesPrefacturaPeriodo(desde, hasta) {
  if (!desde || !hasta || desde > hasta) throw new Error("Selecciona un periodo válido para los ajustes.");
  const { data, error } = await supabase
    .from("flotilla_prefactura_ajustes")
    .select("id, unidad_id, driver_auth_user_id, chofer_nombre, periodo_desde, periodo_hasta, categoria, monto, numero_parcialidad, total_parcialidades, observaciones, estado, created_at")
    .eq("periodo_desde", desde)
    .eq("periodo_hasta", hasta)
    .order("created_at", { ascending: true });
  if (error) throw new Error(error.message || "No fue posible consultar los ajustes del corte.");
  return Array.isArray(data) ? data : [];
}

export async function guardarAjustePrefactura({ grupo, periodo, categoria, monto, observaciones, numeroParcialidad, totalParcialidades }) {
  if (!grupo?.unidadId) throw new Error("Selecciona el operador y la unidad.");
  const { data, error } = await supabase.rpc("guardar_ajuste_prefactura_flotilla", {
    p_unidad_id: grupo.unidadId,
    p_driver_auth_user_id: grupo.driverAuthUserId || null,
    p_chofer_nombre: grupo.operador,
    p_periodo_desde: periodo.desde,
    p_periodo_hasta: periodo.hasta,
    p_categoria: categoria,
    p_monto: Number(monto),
    p_observaciones: String(observaciones || "").trim() || null,
    p_numero_parcialidad: categoria === "FONDO_UNIDAD" ? Number(numeroParcialidad) : null,
    p_total_parcialidades: categoria === "FONDO_UNIDAD" ? Number(totalParcialidades) : null,
  });
  if (error) throw new Error(error.message || "No fue posible guardar el ajuste.");
  return data;
}

export async function anularAjustePrefactura(ajusteId) {
  const { data, error } = await supabase.rpc("anular_ajuste_prefactura_flotilla", { p_ajuste_id: ajusteId });
  if (error) throw new Error(error.message || "No fue posible anular el ajuste.");
  return data;
}

export async function obtenerDatosPrefacturaPeriodo(desde, hasta) {
  const [operaciones, descuentosPnr, ajustes] = await Promise.all([
    obtenerOperacionFlotillaPeriodo(desde, hasta),
    obtenerDescuentosPnrPeriodo(desde, hasta),
    obtenerAjustesPrefacturaPeriodo(desde, hasta),
  ]);
  const { finalizadas, pendientes, duplicadasIgnoradas, rutasPruebaIgnoradas } = separarRutasPorCierre(operaciones);
  return { operaciones: finalizadas, rutasPendientes: pendientes, duplicadasIgnoradas, rutasPruebaIgnoradas, descuentosPnr, ajustes };
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

export async function obtenerPrestamosFlotilla() {
  const { data, error } = await supabase
    .from("flotilla_prestamos")
    .select("id, tipo_beneficiario, beneficiario_nombre, fecha, concepto, monto_original, saldo, estado, automatico, motivo_cancelacion, created_at, abonos:flotilla_prestamo_abonos(id, fecha, monto, observaciones, created_at)")
    .order("fecha", { ascending: false })
    .order("created_at", { ascending: false });

  if (error) throw new Error("No fue posible consultar los préstamos de Flotilla.");
  return Array.isArray(data) ? data : [];
}

export async function crearPrestamoFlotilla({ tipoBeneficiario, beneficiarioNombre, monto, concepto, fecha }) {
  const cantidad = Number(monto);
  if (!["EMPLEADO", "FLOTISTA"].includes(tipoBeneficiario)) throw new Error("Selecciona empleado o flotista.");
  if (!String(beneficiarioNombre || "").trim()) throw new Error("Escribe el nombre del beneficiario.");
  if (!Number.isFinite(cantidad) || cantidad <= 0) throw new Error("Escribe un monto válido.");
  if (!String(concepto || "").trim()) throw new Error("Escribe el motivo del préstamo.");
  const contexto = await obtenerContextoAdmin();
  const { data, error } = await supabase
    .from("flotilla_prestamos")
    .insert({
      organization_id: contexto.organizationId,
      tipo_beneficiario: tipoBeneficiario,
      beneficiario_nombre: String(beneficiarioNombre).trim(),
      fecha,
      concepto: String(concepto).trim(),
      monto_original: cantidad,
      saldo: cantidad,
      estado: "PENDIENTE",
      automatico: false,
    })
    .select("id")
    .single();

  if (error) throw new Error(error.message || "No fue posible registrar el préstamo.");
  return data;
}

export async function registrarAbonoPrestamoFlotilla({ prestamoId, monto, observaciones, fecha }) {
  const cantidad = Number(monto);
  if (!prestamoId || !Number.isFinite(cantidad) || cantidad <= 0) throw new Error("Escribe un abono válido.");
  const contexto = await obtenerContextoAdmin();
  const { data, error } = await supabase
    .from("flotilla_prestamo_abonos")
    .insert({
      organization_id: contexto.organizationId,
      prestamo_id: prestamoId,
      fecha,
      monto: cantidad,
      observaciones: String(observaciones || "").trim() || null,
    })
    .select("id")
    .single();

  if (error) throw new Error(error.message || "No fue posible registrar el abono.");
  return data;
}

export async function obtenerOperacionRentalPeriodo(desde, hasta) {
  if (!desde || !hasta || desde > hasta) throw new Error("Selecciona un periodo válido para Rental.");

  const [
    { data: operaciones, error: errorOperaciones },
    { data: cortes, error: errorCortes },
    { data: liquidaciones, error: errorLiquidaciones },
    { data: repartos, error: errorRepartos },
  ] = await Promise.all([
    supabase
      .from("flotilla_rutas")
      .select(`
        id, unidad_id, driver_auth_user_id, chofer_nombre, fecha, codigo_ruta, tipo_pago, estado, hora_inicio_ruta, hora_fin_ruta,
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
    supabase
      .from("flotilla_rental_liquidaciones")
      .select("id, periodo_desde, periodo_hasta, chofer_nombre, placas, ganado_calculado, adelantos_entregados, monto_pagado, adelanto_excedente, estado, observaciones, pagado_en, motivo_anulacion, anulada_en")
      .eq("periodo_desde", desde)
      .eq("periodo_hasta", hasta),
    supabase
      .from("flotilla_rental_repartos")
      .select("id, periodo_desde, periodo_hasta, socio, utilidad_calculada, parte_calculada, monto_entregado, estado, observaciones, pagado_en, motivo_anulacion, anulado_en")
      .eq("periodo_desde", desde)
      .eq("periodo_hasta", hasta),
  ]);

  if (errorOperaciones || errorCortes || errorLiquidaciones || errorRepartos) throw new Error("No fue posible consultar el periodo de Rental.");

  const rentalsPeriodo = (operaciones || []).filter((item) =>
    ["RENTAL_SMALL", "RENTAL_LARGE"].includes(item.tipo_pago || item.unidad?.tipo_pago_chory)
  );
  const { finalizadas: rentals, pendientes: rutasPendientes, duplicadasIgnoradas, rutasPruebaIgnoradas } = separarRutasPorCierre(rentalsPeriodo);
  const ids = rentals.map((item) => item.id);
  if (ids.length === 0) return { operaciones: [], rutasPendientes, duplicadasIgnoradas, rutasPruebaIgnoradas, cortes: cortes || [], liquidaciones: liquidaciones || [], repartos: repartos || [] };

  const [{ data: dinero, error: errorDinero }, { data: ambulancias, error: errorAmbulancias }] = await Promise.all([
    supabase
      .from("flotilla_movimientos_dinero")
      .select("id, ruta_id, tipo_movimiento, monto, pagador, clasificacion_gasolina, estado_conciliacion")
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
    clasificacion_gasolina: item.clasificacion_gasolina,
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
    rutasPendientes,
    duplicadasIgnoradas,
    rutasPruebaIgnoradas,
    cortes: cortes || [],
    liquidaciones: liquidaciones || [],
    repartos: repartos || [],
  };
}

async function obtenerContextoAdmin() {
  const { data: auth, error: authError } = await supabase.auth.getUser();
  if (authError || !auth?.user) throw new Error("La sesión administrativa ya no está activa.");
  const { data: perfil, error: perfilError } = await supabase
    .from("usuarios")
    .select("organization_id")
    .eq("auth_user_id", auth.user.id)
    .eq("active", true)
    .single();
  if (perfilError || !perfil?.organization_id) throw new Error("La cuenta no está vinculada a una organización.");
  return { usuarioId: auth.user.id, organizationId: perfil.organization_id };
}

export async function guardarLiquidacionRental({ desde, hasta, chofer, observaciones = "" }) {
  if (!desde || !hasta || desde > hasta || !chofer?.chofer || !chofer?.placas) {
    throw new Error("La liquidación Rental no contiene un periodo y chofer válidos.");
  }
  if (Number(chofer.saldoPorPagar) <= 0) throw new Error("Este chofer no tiene saldo pendiente por pagar.");

  const { usuarioId, organizationId } = await obtenerContextoAdmin();

  const payload = {
    organization_id: organizationId,
    periodo_desde: desde,
    periodo_hasta: hasta,
    chofer_nombre: chofer.chofer,
    placas: chofer.placas,
    ganado_calculado: Number(chofer.ganado) || 0,
    adelantos_entregados: Number(chofer.adelantos) || 0,
    monto_pagado: Number(chofer.saldoPorPagar) || 0,
    adelanto_excedente: Number(chofer.adelantoExcedente) || 0,
    estado: "PAGADA",
    observaciones: String(observaciones || "").trim() || null,
    snapshot: chofer,
    registrado_por: usuarioId,
    pagado_en: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
  const { data, error } = await supabase
    .from("flotilla_rental_liquidaciones")
    .insert(payload)
    .select("id, periodo_desde, periodo_hasta, chofer_nombre, placas, ganado_calculado, adelantos_entregados, monto_pagado, adelanto_excedente, estado, observaciones, pagado_en")
    .single();

  if (error) throw new Error(error.message || "No fue posible registrar la liquidación Rental.");
  return data;
}

export async function anularLiquidacionRental({ liquidacionId, motivo }) {
  if (!liquidacionId || !String(motivo || "").trim()) throw new Error("Escribe el motivo de la anulación.");
  const { usuarioId } = await obtenerContextoAdmin();
  const ahora = new Date().toISOString();
  const { data, error } = await supabase
    .from("flotilla_rental_liquidaciones")
    .update({ estado: "ANULADA", motivo_anulacion: String(motivo).trim(), anulada_por: usuarioId, anulada_en: ahora, updated_at: ahora })
    .eq("id", liquidacionId)
    .eq("estado", "PAGADA")
    .select("id, estado, motivo_anulacion, anulada_en")
    .single();
  if (error) throw new Error(error.message || "No fue posible anular la liquidación.");
  return data;
}

export async function guardarRepartoRental({ desde, hasta, socio, resumen }) {
  if (!desde || !hasta || desde > hasta || !["Abraham", "Chory", "Kary"].includes(socio)) {
    throw new Error("El reparto Rental no contiene un periodo y socio válidos.");
  }
  const parte = Number(resumen?.repartoSocios?.[socio]) || 0;
  if (parte <= 0) throw new Error("Este periodo no tiene utilidad pendiente para repartir.");
  const { usuarioId, organizationId } = await obtenerContextoAdmin();
  const payload = {
    organization_id: organizationId,
    periodo_desde: desde,
    periodo_hasta: hasta,
    socio,
    utilidad_calculada: Number(resumen.utilidadRepartible) || 0,
    parte_calculada: parte,
    monto_entregado: parte,
    estado: "PAGADO",
    snapshot: resumen,
    registrado_por: usuarioId,
    pagado_en: new Date().toISOString(),
  };
  const { data, error } = await supabase
    .from("flotilla_rental_repartos")
    .insert(payload)
    .select("id, periodo_desde, periodo_hasta, socio, utilidad_calculada, parte_calculada, monto_entregado, estado, pagado_en")
    .single();
  if (error) throw new Error(error.message || "No fue posible registrar la entrega al socio.");
  return data;
}

export async function anularRepartoRental({ repartoId, motivo }) {
  if (!repartoId || !String(motivo || "").trim()) throw new Error("Escribe el motivo de la anulación.");
  const { usuarioId } = await obtenerContextoAdmin();
  const ahora = new Date().toISOString();
  const { data, error } = await supabase
    .from("flotilla_rental_repartos")
    .update({ estado: "ANULADO", motivo_anulacion: String(motivo).trim(), anulado_por: usuarioId, anulado_en: ahora, updated_at: ahora })
    .eq("id", repartoId)
    .eq("estado", "PAGADO")
    .select("id, estado, motivo_anulacion, anulado_en")
    .single();
  if (error) throw new Error(error.message || "No fue posible anular la entrega al socio.");
  return data;
}

export function suscribirseAOperacionFlotilla({ onCambio, onEstado }) {
  try {
    const canal = supabase
      .channel(crearNombreCanalOperacion())
      .on("postgres_changes", { event: "*", schema: "public", table: "flotilla_rutas" }, onCambio)
      .on("postgres_changes", { event: "*", schema: "public", table: "flotilla_movimientos_dinero" }, onCambio)
      .on("postgres_changes", { event: "*", schema: "public", table: "flotilla_ambulancias" }, onCambio)
      .on("postgres_changes", { event: "*", schema: "public", table: "flotilla_revision_evidencias" }, onCambio)
      .on("postgres_changes", { event: "*", schema: "public", table: "flotilla_rental_cortes" }, onCambio)
      .on("postgres_changes", { event: "*", schema: "public", table: "flotilla_rental_liquidaciones" }, onCambio)
      .on("postgres_changes", { event: "*", schema: "public", table: "flotilla_rental_repartos" }, onCambio)
      .on("postgres_changes", { event: "*", schema: "public", table: "flotilla_prestamos" }, onCambio)
      .on("postgres_changes", { event: "*", schema: "public", table: "flotilla_prestamo_abonos" }, onCambio)
      .subscribe(onEstado);

    return () => supabase.removeChannel(canal);
  } catch (error) {
    onEstado?.("CHANNEL_ERROR", error);
    return () => {};
  }
}

