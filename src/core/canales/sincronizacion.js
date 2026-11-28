/*
 * ORQUESTACIÓN DE LA SINCRONIZACIÓN DE CANALES · MONYS OS
 *
 * Lógica sin dependencias de red ni de base de datos: recibe un
 * `proveedor` (API de la plataforma) y un `almacen` (Supabase) para poder
 * probarla con simulaciones. La Edge Function solo arma esas piezas.
 *
 * Garantías:
 * - Turno exclusivo por cuenta (lease): nunca dos sincronizaciones a la vez.
 *   Es lo que evita perder credenciales que rotan.
 * - Credenciales: se reutiliza el access token vigente. Si hay que renovar,
 *   el token nuevo se guarda (con reintentos) ANTES de usarlo; si no se
 *   puede guardar, se detiene y se reporta (credencial en riesgo).
 * - Identidad: la cuenta autorizada debe coincidir con la registrada.
 * - dry_run: no escribe datos de negocio ni el estado de la cuenta. Solo
 *   persiste una credencial si la plataforma la rotó (si no, se perdería).
 * - Error: la cuenta queda en ERROR con reintento automático (backoff) y
 *   vuelve a ACTIVA en cuanto una corrida termina bien.
 * - Cobertura: cada corrida informa qué trajo cada fuente y si fue completa.
 */

export const VENTANA_MAXIMA_DIAS = 120;
const MINUTOS_TURNO = 15;

export function esperaReintento(intentos) {
  const minutos = Math.min(24 * 60, 15 * 2 ** Math.max(0, intentos - 1));
  return minutos * 60_000;
}

export function cuentasParaSincronizar(cuentas = [], ahora = new Date()) {
  const t = new Date(ahora).getTime();
  return (cuentas || []).filter(
    (cuenta) =>
      ["ACTIVA", "ERROR"].includes(cuenta?.estado) &&
      (!cuenta.proximo_intento || new Date(cuenta.proximo_intento).getTime() <= t)
  );
}

export function validarVentana(desde, hasta, ahora = new Date()) {
  const a = new Date(`${desde}T00:00:00-06:00`);
  const b = new Date(`${hasta}T23:59:59-06:00`);
  if (Number.isNaN(a.getTime()) || Number.isNaN(b.getTime())) return "Fechas inválidas (usa YYYY-MM-DD).";
  if (b < a) return "La fecha final es anterior a la inicial.";
  if (b.getTime() > new Date(ahora).getTime() + 86400000) return "La fecha final está en el futuro.";
  if ((b - a) / 86400000 > VENTANA_MAXIMA_DIAS) return `La ventana máxima es de ${VENTANA_MAXIMA_DIAS} días; divide la carga histórica.`;
  return null;
}

async function conReintentos(fn, intentos = 3) {
  let ultimo;
  for (let i = 0; i < intentos; i++) {
    try {
      return await fn();
    } catch (error) {
      ultimo = error;
    }
  }
  throw ultimo;
}

/*
 * proveedor: {
 *   credencialVigente(cred, ahora) → boolean
 *   renovar(cred) → credNueva          (no debe guardar nada)
 *   identidad(cred) → id externo de la cuenta/tienda autorizada
 *   descargar(cred, { desde, hasta, ahora, presupuestoMs }) →
 *     { ordenes, publicaciones, liquidaciones, cobertura }
 * }
 * almacen: {
 *   tomarTurno(cuentaId, minutos, ejecucionId) → boolean
 *   renovarTurno(cuentaId, ejecucionId, minutos) → boolean
 *     (extiende solo si el turno sigue siendo suyo y no ha vencido)
 *   liberarTurno(cuentaId, ejecucionId)   (solo libera si el turno es suyo)
 *   leerCredencial(cuentaId) → objeto | null
 *   guardarCredencial(cuentaId, cred, ejecucionId)
 *     (la base rechaza la escritura si el turno ya no es de esta ejecución)
 *   guardarDatos(cuenta, datos, { ejecucionId, confirmarTurno })
 *     (cada lote se escribe en una transacción que valida el turno de
 *     ejecucionId; en Supabase: guardar_lote_canal)
 *   registrarExito(cuentaId, { ahora, cobertura, ejecucionId })
 *   registrarFallo(cuentaId, { ahora, intentos, proximoIntento, mensaje, critico, ejecucionId })
 * }
 *
 * dry_run NO escribe órdenes, publicaciones, liquidaciones ni éxito/fallo
 * ordinario. Excepciones documentadas: toma y libera el turno; si la
 * credencial venció, la renueva y GUARDA la nueva (la plataforma invalida
 * la anterior al rotarla: no guardarla dejaría la cuenta sin acceso); y
 * registra un fallo crítico de credencial para que la cuenta quede marcada.
 */
function turnoPerdido() {
  const error = new Error("El turno de esta sincronización venció y otra corrida pudo tomarlo; no se escribió nada más.");
  error.turnoPerdido = true;
  return error;
}

function idAleatorio() {
  return globalThis.crypto?.randomUUID ? globalThis.crypto.randomUUID() : `${Date.now().toString(16)}-${Math.random().toString(16).slice(2)}`;
}

export async function sincronizarCuenta(cuenta, { proveedor, almacen, desde, hasta, dryRun = false, ahora = new Date(), presupuestoMs = 110_000, generarId = idAleatorio }) {
  const ejecucionId = generarId();
  const base = { cuenta: cuenta.cuenta_externa, canal: cuenta.canal, dryRun, ejecucionId };
  const errorVentana = validarVentana(desde, hasta, ahora);
  if (errorVentana) return { ...base, omitida: true, motivo: errorVentana };

  if (!(await almacen.tomarTurno(cuenta.id, MINUTOS_TURNO, ejecucionId))) {
    return { ...base, omitida: true, motivo: "Otra sincronización de esta cuenta está en curso." };
  }

  let credencialRotada = false;
  try {
    let credencial = await almacen.leerCredencial(cuenta.id);
    if (!credencial) throw new Error("La cuenta no tiene credenciales autorizadas.");

    const confirmarTurno = async () => {
      if (!(await almacen.renovarTurno(cuenta.id, ejecucionId, MINUTOS_TURNO))) throw turnoPerdido();
    };

    if (!proveedor.credencialVigente(credencial, ahora)) {
      // Turno renovado justo antes de rotar: así hay margen para guardar.
      await confirmarTurno();
      const nueva = await proveedor.renovar(credencial);
      if (!nueva?.access_token || !nueva?.refresh_token) throw new Error("La plataforma no devolvió credenciales nuevas.");
      try {
        await conReintentos(() => almacen.guardarCredencial(cuenta.id, nueva, ejecucionId));
      } catch {
        const error = new Error("CREDENCIAL EN RIESGO: la plataforma renovó el acceso pero no se pudo guardar. Reautoriza la cuenta.");
        error.critico = true;
        throw error;
      }
      credencial = nueva;
      credencialRotada = true;
    }

    const identidad = String(await proveedor.identidad(credencial));
    if (identidad !== String(cuenta.cuenta_externa)) {
      throw new Error(`La autorización pertenece a ${identidad}, no a la cuenta registrada ${cuenta.cuenta_externa}.`);
    }

    const datos = await proveedor.descargar(credencial, { desde, hasta, ahora, presupuestoMs });
    const resumen = {
      ...base,
      credencialRotada,
      ordenes: datos.ordenes.length,
      publicaciones: datos.publicaciones.length,
      liquidaciones: datos.liquidaciones.length,
      cobertura: datos.cobertura,
    };
    if (dryRun) return { ...resumen, escrito: false };

    await confirmarTurno();
    await almacen.guardarDatos(cuenta, datos, { ejecucionId, confirmarTurno });
    await almacen.registrarExito(cuenta.id, { ahora, cobertura: datos.cobertura, ejecucionId });
    return { ...resumen, escrito: true };
  } catch (error) {
    const mensaje = String(error?.message || error).slice(0, 1000);
    const intentos = (Number(cuenta.intentos_fallidos) || 0) + 1;
    const critico = Boolean(error?.critico);
    // Un fallo crítico de credencial se registra también en dry_run. Si el
    // turno se perdió (y no es crítico), el estado ya es de otra corrida.
    if (critico || (!dryRun && !error?.turnoPerdido)) {
      await almacen.registrarFallo(cuenta.id, {
        ahora,
        intentos,
        proximoIntento: new Date(new Date(ahora).getTime() + esperaReintento(intentos)).toISOString(),
        mensaje,
        critico,
        ejecucionId,
      });
    }
    return { ...base, credencialRotada, error: mensaje, critico, turnoPerdido: Boolean(error?.turnoPerdido) };
  } finally {
    await almacen.liberarTurno(cuenta.id, ejecucionId);
  }
}

/*
 * Cobertura de una descarga: qué tan completa es cada fuente.
 */
export function medirCobertura({ ordenes = [], publicaciones = [], liquidaciones = [], completa = true, fuentesNoDisponibles = [] }) {
  const pagadas = ordenes.filter((orden) => orden.estado === "paid");
  // Ausente, undefined, NaN, texto o booleano NO cuentan como dato.
  const esMonto = (valor) => typeof valor === "number" && Number.isFinite(valor);
  const esTexto = (valor) => typeof valor === "string" && valor.trim() !== "";
  const conEnvio = pagadas.filter((orden) => esMonto(orden.envio_vendedor)).length;
  const conComision = pagadas.filter((orden) => esMonto(orden.comision)).length;
  const conSku = publicaciones.filter((p) => esTexto(p.sku)).length;
  const conNeto = liquidaciones.filter((l) => esMonto(l.monto_neto)).length;
  const pct = (parte, total) => (total ? Math.round((parte / total) * 1000) / 10 : null);
  return {
    completa,
    ordenes: ordenes.length,
    ordenesPagadas: pagadas.length,
    enviosConCostoPct: pct(conEnvio, pagadas.length),
    comisionesConocidasPct: pct(conComision, pagadas.length),
    publicaciones: publicaciones.length,
    publicacionesConSkuPct: pct(conSku, publicaciones.length),
    liquidaciones: liquidaciones.length,
    liquidacionesConNetoPct: pct(conNeto, liquidaciones.length),
    liquidacionesDerivadas: liquidaciones.filter((l) => l.datos_origen?.derivada_de_orden).length,
    fuentesNoDisponibles,
  };
}
