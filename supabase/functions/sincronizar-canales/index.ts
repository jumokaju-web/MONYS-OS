// Sincronización diaria de canales (Mercado Libre y TikTok Shop) · MONYS OS
//
// SOLO LECTURA en las plataformas: consulta órdenes, publicaciones, envíos,
// estados de cuenta y la identidad de la cuenta. No modifica precios,
// publicaciones, campañas ni promociones.
//
// La lógica (turnos, credenciales, dry_run, reintentos, cobertura) vive en
// src/core/canales/sincronizacion.js y tiene pruebas. Aquí solo se conectan
// las APIs y Supabase.
//
// Estado: preparada, NO desplegada. Requiere (con autorización):
//   - migración 20261128020000_canales_marketplace.sql aplicada;
//   - secretos: CRON_SECRET, ML_CLIENT_ID, ML_CLIENT_SECRET, TT_APP_KEY, TT_APP_SECRET;
//   - credenciales por cuenta en Vault (guardar_credencial_canal).
//
// POST /sincronizar-canales (header x-cron-secret)
//   ?dry_run=1                      → consulta y mide, sin escribir datos ni estado
//   ?desde=YYYY-MM-DD&hasta=...     → máx. 120 días (por defecto, últimos 45)

import { createClient } from "npm:@supabase/supabase-js@2";
import {
  cadenaFirmaTikTok,
  credencialDesdeRenovacionML,
  credencialDesdeRenovacionTikTok,
  credencialVigente,
  liquidacionTikTokShop,
  liquidacionesDesdeOrdenesML,
  ordenMercadoLibre,
  ordenTikTokShop,
  publicacionesMercadoLibre,
  publicacionesTikTokShop,
} from "../../../src/core/canales/mapeoApis.js";
import { cuentasParaSincronizar, medirCobertura, sincronizarCuenta } from "../../../src/core/canales/sincronizacion.js";

const ML_API = "https://api.mercadolibre.com";
const TT_API = "https://open-api.tiktokglobalshop.com";
const TT_AUTH = "https://auth.tiktok-shops.com";
const VENTANA_DIAS = 45;

const esperar = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function obtenerJson(url: string, opciones: RequestInit = {}, intentos = 3): Promise<any> {
  for (let intento = 1; ; intento++) {
    const respuesta = await fetch(url, opciones);
    if ((respuesta.status === 429 || respuesta.status >= 500) && intento < intentos) {
      await esperar(intento * 20_000);
      continue;
    }
    if (!respuesta.ok) throw new Error(`${opciones.method || "GET"} ${url.split("?")[0]} → ${respuesta.status}`);
    return respuesta.json();
  }
}

/* ---------------- Mercado Libre ---------------- */

const proveedorMercadoLibre = {
  credencialVigente,
  async renovar(cred: any) {
    const datos = await obtenerJson(`${ML_API}/oauth/token`, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded", accept: "application/json" },
      body: new URLSearchParams({
        grant_type: "refresh_token",
        client_id: Deno.env.get("ML_CLIENT_ID")!,
        client_secret: Deno.env.get("ML_CLIENT_SECRET")!,
        refresh_token: cred.refresh_token,
      }),
    });
    return credencialDesdeRenovacionML(datos, cred);
  },
  async identidad(cred: any) {
    const yo = await obtenerJson(`${ML_API}/users/me`, { headers: { authorization: `Bearer ${cred.access_token}` } });
    return yo.id;
  },
  async descargar(cred: any, { desde, hasta, ahora, presupuestoMs }: any) {
    const inicio = Date.now();
    const quedaTiempo = () => Date.now() - inicio < presupuestoMs;
    const auth = { headers: { authorization: `Bearer ${cred.access_token}` } };
    const vendedor = await this.identidad(cred);
    let completa = true;

    const ordenes: any[] = [];
    for (let offset = 0; ; offset += 50) {
      if (!quedaTiempo()) { completa = false; break; }
      const pagina = await obtenerJson(
        `${ML_API}/orders/search?seller=${vendedor}&order.date_created.from=${desde}T00:00:00.000-06:00` +
          `&order.date_created.to=${hasta}T23:59:59.999-06:00&sort=date_asc&limit=50&offset=${offset}`,
        auth
      );
      for (const orden of pagina.results || []) {
        let costoEnvio: number | null = null;
        if (orden.shipping?.id && orden.status !== "cancelled") {
          try {
            const costos = await obtenerJson(`${ML_API}/shipments/${orden.shipping.id}/costs`, { headers: { ...auth.headers, "x-format-new": "true" } });
            const valor = Number(costos?.senders?.[0]?.cost);
            costoEnvio = Number.isFinite(valor) ? valor : null;
          } catch {
            costoEnvio = null; // desconocido, no cero
          }
        }
        ordenes.push(ordenMercadoLibre(orden, { costoEnvio }));
      }
      if (!pagina.results?.length || offset + 50 >= (pagina.paging?.total ?? 0)) break;
    }

    const ids: string[] = [];
    for (let offset = 0; ; offset += 100) {
      if (!quedaTiempo()) { completa = false; break; }
      const pagina = await obtenerJson(`${ML_API}/users/${vendedor}/items/search?limit=100&offset=${offset}`, auth);
      ids.push(...(pagina.results || []));
      if (!pagina.results?.length || offset + 100 >= (pagina.paging?.total ?? 0)) break;
    }
    const publicaciones: any[] = [];
    for (let i = 0; i < ids.length; i += 20) {
      if (!quedaTiempo()) { completa = false; break; }
      const lote = await obtenerJson(`${ML_API}/items?ids=${ids.slice(i, i + 20).join(",")}`, auth);
      for (const fila of lote || []) if (fila?.code === 200) publicaciones.push(...publicacionesMercadoLibre(fila.body));
    }

    const liquidaciones = liquidacionesDesdeOrdenesML(ordenes, { hoy: ahora });
    return {
      ordenes,
      publicaciones,
      liquidaciones,
      cobertura: medirCobertura({
        ordenes, publicaciones, liquidaciones, completa,
        fuentesNoDisponibles: ["retenciones ISR/IVA (no las expone la API)", "depósito bancario (se concilia en Tesorería)"],
      }),
    };
  },
};

/* ---------------- TikTok Shop ---------------- */

async function firmar(texto: string, secreto: string): Promise<string> {
  const clave = await crypto.subtle.importKey("raw", new TextEncoder().encode(secreto), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const firma = await crypto.subtle.sign("HMAC", clave, new TextEncoder().encode(texto));
  return [...new Uint8Array(firma)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function llamadaTikTok(path: string, cred: any, params: Record<string, string> = {}, body?: object, conTienda = true) {
  const appSecret = Deno.env.get("TT_APP_SECRET")!;
  const todos: Record<string, string> = {
    app_key: Deno.env.get("TT_APP_KEY")!,
    timestamp: String(Math.floor(Date.now() / 1000)),
    ...(conTienda ? { shop_cipher: cred.shop_cipher } : {}),
    ...params,
  };
  const cuerpo = body ? JSON.stringify(body) : "";
  todos.sign = await firmar(cadenaFirmaTikTok({ path, params: todos, body: cuerpo, appSecret }), appSecret);
  const datos = await obtenerJson(`${TT_API}${path}?${new URLSearchParams(todos)}`, {
    method: body ? "POST" : "GET", // POST de búsqueda: sigue siendo lectura
    headers: { "x-tts-access-token": cred.access_token, "content-type": "application/json" },
    body: body ? cuerpo : undefined,
  });
  if (datos.code !== 0) throw new Error(`TikTok Shop ${path}: ${datos.message}`);
  return datos.data;
}

const proveedorTikTok = {
  credencialVigente,
  async renovar(cred: any) {
    const params = new URLSearchParams({
      app_key: Deno.env.get("TT_APP_KEY")!,
      app_secret: Deno.env.get("TT_APP_SECRET")!,
      refresh_token: cred.refresh_token,
      grant_type: "refresh_token",
    });
    return credencialDesdeRenovacionTikTok(await obtenerJson(`${TT_AUTH}/api/v2/token/refresh?${params}`), cred);
  },
  async identidad(cred: any) {
    const datos = await llamadaTikTok("/authorization/202309/shops", cred, {}, undefined, false);
    const tienda = (datos.shops || []).find((shop: any) => shop.cipher === cred.shop_cipher);
    if (!tienda) throw new Error("La tienda autorizada no coincide con el shop_cipher guardado.");
    return tienda.id;
  },
  async descargar(cred: any, { desde, hasta, presupuestoMs }: any) {
    const inicioReloj = Date.now();
    const quedaTiempo = () => Date.now() - inicioReloj < presupuestoMs;
    const inicio = Math.floor(new Date(`${desde}T00:00:00-06:00`).getTime() / 1000);
    const fin = Math.floor(new Date(`${hasta}T23:59:59-06:00`).getTime() / 1000);
    let completa = true;

    const paginar = async (path: string, params: Record<string, string>, body: object | undefined, campo: string, mapear: (x: any) => any) => {
      const filas: any[] = [];
      let token: string | undefined;
      do {
        if (!quedaTiempo()) { completa = false; break; }
        const datos = await llamadaTikTok(path, cred, { page_size: "50", ...params, ...(token ? { page_token: token } : {}) }, body);
        filas.push(...(datos[campo] || []).flatMap((x: any) => [mapear(x)].flat()));
        token = datos.next_page_token || undefined;
      } while (token);
      return filas;
    };

    const ordenes = await paginar("/order/202309/orders/search", {}, { create_time_ge: inicio, create_time_lt: fin }, "orders", ordenTikTokShop);
    const liquidaciones = await paginar("/finance/202309/statements",
      { statement_time_ge: String(inicio), statement_time_lt: String(fin), sort_field: "statement_time" }, undefined, "statements", liquidacionTikTokShop);
    const publicaciones = await paginar("/product/202309/products/search", {}, {}, "products", publicacionesTikTokShop);

    return {
      ordenes,
      publicaciones,
      liquidaciones,
      cobertura: medirCobertura({
        ordenes, publicaciones, liquidaciones, completa,
        fuentesNoDisponibles: ["comisión, envío y retenciones por orden (campos por verificar)", "devoluciones"],
      }),
    };
  },
};

/* ---------------- Almacén (Supabase, service_role) ---------------- */

function crearAlmacen(supabase: any) {
  const rpc = async (nombre: string, args: object) => {
    const { data, error } = await supabase.rpc(nombre, args);
    if (error) throw new Error(`${nombre}: ${error.message}`);
    return data;
  };
  return {
    tomarTurno: (cuentaId: string, minutos: number, ejecucionId: string) =>
      rpc("tomar_turno_canal", { p_cuenta_id: cuentaId, p_minutos: minutos, p_ejecucion: ejecucionId }),
    renovarTurno: (cuentaId: string, ejecucionId: string, minutos: number) =>
      rpc("renovar_turno_canal", { p_cuenta_id: cuentaId, p_ejecucion: ejecucionId, p_minutos: minutos }),
    // Solo libera si el turno sigue siendo de esta ejecución.
    liberarTurno: (cuentaId: string, ejecucionId: string) =>
      rpc("liberar_turno_canal", { p_cuenta_id: cuentaId, p_ejecucion: ejecucionId }),
    async leerCredencial(cuentaId: string) {
      const texto = await rpc("leer_credencial_canal", { p_cuenta_id: cuentaId });
      return texto ? JSON.parse(texto) : null;
    },
    // La base rechaza la credencial si el turno ya no es de esta ejecución.
    guardarCredencial: (cuentaId: string, cred: object, ejecucionId: string) =>
      rpc("guardar_credencial_canal", { p_cuenta_id: cuentaId, p_credencial: JSON.stringify(cred), p_ejecucion: ejecucionId }),
    // Cada lote se escribe con guardar_lote_canal: una sola transacción que
    // bloquea la cuenta, valida turno y vencimiento, y hace los upserts.
    // Si el turno ya no es de esta ejecución, la base rechaza el lote.
    // organización, negocio, cuenta y canal los pone la base desde la cuenta.
    async guardarDatos(cuenta: any, datos: any, { ejecucionId }: { ejecucionId: string }) {
      // La marca se toma después de tomar el turno: la base exige que no
      // sea anterior al inicio del turno para marcar ausentes.
      const marca = new Date().toISOString();
      const resumen = { escritas: 0, colisiones: [] as any[], itemsEliminados: 0, obsoletas: 0 };
      const enviar = async (tipo: string, filas: any[] | null, barridoCompleto = false) => {
        const r: any = await rpc("guardar_lote_canal", {
          p_cuenta_id: cuenta.id, p_ejecucion: ejecucionId, p_tipo: tipo, p_filas: filas, p_marca: marca, p_barrido_completo: barridoCompleto,
        });
        resumen.escritas += r?.escritas || 0;
        resumen.colisiones.push(...(r?.colisiones || []));
        resumen.itemsEliminados += r?.itemsEliminados || 0;
        resumen.obsoletas += r?.obsoletas || 0;
      };
      const lote = async (tipo: string, filas: any[], tamano: number) => {
        for (let i = 0; i < filas.length; i += tamano) await enviar(tipo, filas.slice(i, i + tamano));
      };
      await lote("ordenes", datos.ordenes, 50);
      await lote("publicaciones", datos.publicaciones, 200);
      if (datos.publicaciones.length && datos.cobertura?.completa === true) await enviar("marcar_obsoletas", null, true);
      await lote("liquidaciones", datos.liquidaciones, 200);
      return resumen;
    },
    // Éxito y fallo solo se registran si el turno sigue siendo de esta
    // ejecución: una corrida vencida no pisa el estado de otra.
    async registrarExito(cuentaId: string, { ahora, cobertura, ejecucionId }: any) {
      const { error } = await supabase.from("canal_cuentas").update({
        estado: "ACTIVA", intentos_fallidos: 0, proximo_intento: null, ultimo_error: null,
        ultimo_sync: new Date(ahora).toISOString(), cobertura,
      }).eq("id", cuentaId).eq("sync_ejecucion_id", ejecucionId);
      if (error) throw new Error(`registrar éxito: ${error.message}`);
    },
    async registrarFallo(cuentaId: string, { intentos, proximoIntento, mensaje, critico, ejecucionId }: any) {
      // Un fallo crítico de credencial se registra aunque el turno ya no
      // sea propio: la cuenta debe quedar marcada para reautorizar.
      let consulta = supabase.from("canal_cuentas").update({
        estado: critico ? "DESCONECTADA" : "ERROR", intentos_fallidos: intentos, proximo_intento: critico ? null : proximoIntento, ultimo_error: mensaje,
      }).eq("id", cuentaId);
      if (!critico) consulta = consulta.eq("sync_ejecucion_id", ejecucionId);
      const { error } = await consulta;
      if (error) throw new Error(`registrar fallo: ${error.message}`);
    },
  };
}

/* ---------------- Entrada ---------------- */

/* Comparación en tiempo constante; un secreto corto o vacío nunca autoriza. */
function secretoValido(recibido: string | null): boolean {
  const esperado = Deno.env.get("CRON_SECRET") ?? "";
  if (esperado.length < 32 || !recibido) return false;
  const a = new TextEncoder().encode(recibido);
  const b = new TextEncoder().encode(esperado);
  let diferencia = a.length ^ b.length;
  for (let i = 0; i < b.length; i++) diferencia |= (a[i] ?? 0) ^ b[i];
  return diferencia === 0;
}

Deno.serve(async (solicitud) => {
  if (solicitud.method !== "POST") return new Response("Método no permitido", { status: 405 });
  if (!secretoValido(solicitud.headers.get("x-cron-secret"))) {
    return new Response("No autorizado", { status: 401 });
  }
  const url = new URL(solicitud.url);
  const dryRun = url.searchParams.get("dry_run") === "1";
  const ahora = new Date();
  const hoy = new Date(ahora.getTime() - 6 * 3600_000).toISOString().slice(0, 10);
  const desde = url.searchParams.get("desde") || new Date(ahora.getTime() - VENTANA_DIAS * 86400_000).toISOString().slice(0, 10);
  const hasta = url.searchParams.get("hasta") || hoy;

  const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const almacen = crearAlmacen(supabase);
  const { data: cuentas, error } = await supabase.from("canal_cuentas").select("*").in("estado", ["ACTIVA", "ERROR"]);
  if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500 });

  const pendientes = cuentasParaSincronizar(cuentas || [], ahora);
  // Presupuesto de tiempo repartido entre cuentas (límite de la Edge Function).
  const presupuestoMs = Math.max(20_000, Math.floor(110_000 / Math.max(1, pendientes.length)));
  const resultado = [];
  for (const cuenta of pendientes) {
    const proveedor = cuenta.canal === "mercado_libre" ? proveedorMercadoLibre : proveedorTikTok;
    resultado.push(await sincronizarCuenta(cuenta, { proveedor, almacen, desde, hasta, dryRun, ahora, presupuestoMs }));
  }
  return new Response(JSON.stringify({ desde, hasta, dryRun, resultado }), { headers: { "content-type": "application/json" } });
});
