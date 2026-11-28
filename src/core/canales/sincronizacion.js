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
 *   tomarTurno(cuentaId, minutos) → boolean
 *   liberarTurno(cuentaId)
 *   leerCredencial(cuentaId) → objeto | null
 *   guardarCredencial(cuentaId, cred)
 *   guardarDatos(cuenta, datos)
 *   registrarExito(cuentaId, { ahora, cobertura })
 *   registrarFallo(cuentaId, { ahora, intentos, proximoIntento, mensaje })
 * }
 */
export async function sincronizarCuenta(cuenta, { proveedor, almacen, desde, hasta, dryRun = false, ahora = new Date(), presupuestoMs = 110_000 }) {
  const base = { cuenta: cuenta.cuenta_externa, canal: cuenta.canal, dryRun };
  const errorVentana = validarVentana(desde, hasta, ahora);
  if (errorVentana) return { ...base, omitida: true, motivo: errorVentana };

  if (!(await almacen.tomarTurno(cuenta.id, MINUTOS_TURNO))) {
    return { ...base, omitida: true, motivo: "Otra sincronización de esta cuenta está en curso." };
  }

  let credencialRotada = false;
  try {
    let credencial = await almacen.leerCredencial(cuenta.id);
    if (!credencial) throw new Error("La cuenta no tiene credenciales autorizadas.");

    if (!proveedor.credencialVigente(credencial, ahora)) {
      const nueva = await proveedor.renovar(credencial);
      if (!nueva?.access_token || !nueva?.refresh_token) throw new Error("La plataforma no devolvió credenciales nuevas.");
      try {
        await conReintentos(() => almacen.guardarCredencial(cuenta.id, nueva));
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

    await almacen.guardarDatos(cuenta, datos);
    await almacen.registrarExito(cuenta.id, { ahora, cobertura: datos.cobertura });
    return { ...resumen, escrito: true };
  } catch (error) {
    const mensaje = String(error?.message || error).slice(0, 1000);
    const intentos = (Number(cuenta.intentos_fallidos) || 0) + 1;
    if (!dryRun) {
      await almacen.registrarFallo(cuenta.id, {
        ahora,
        intentos,
        proximoIntento: new Date(new Date(ahora).getTime() + esperaReintento(intentos)).toISOString(),
        mensaje,
        critico: Boolean(error?.critico),
      });
    }
    return { ...base, credencialRotada, error: mensaje, critico: Boolean(error?.critico) };
  } finally {
    await almacen.liberarTurno(cuenta.id);
  }
}

/*
 * Cobertura de una descarga: qué tan completa es cada fuente.
 */
export function medirCobertura({ ordenes = [], publicaciones = [], liquidaciones = [], completa = true, fuentesNoDisponibles = [] }) {
  const pagadas = ordenes.filter((orden) => orden.estado === "paid");
  const conEnvio = pagadas.filter((orden) => orden.envio_vendedor !== null).length;
  const conComision = pagadas.filter((orden) => orden.comision !== null).length;
  const conSku = publicaciones.filter((p) => p.sku).length;
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
    liquidacionesDerivadas: liquidaciones.filter((l) => l.datos_origen?.derivada_de_orden).length,
    fuentesNoDisponibles,
  };
}
