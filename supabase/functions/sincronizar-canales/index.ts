// Sincronización diaria de canales (Mercado Libre y TikTok Shop) · MONYS OS
//
// SOLO LECTURA en las plataformas: únicamente consulta órdenes,
// publicaciones, envíos y estados de cuenta. No modifica precios,
// publicaciones, campañas ni promociones.
//
// Estado: preparada, NO desplegada. Requiere (con autorización):
//   - migración 20261128020000_canales_marketplace.sql aplicada;
//   - secretos: CRON_SECRET, ML_CLIENT_ID, ML_CLIENT_SECRET,
//     TT_APP_KEY, TT_APP_SECRET;
//   - refresh tokens por cuenta en Vault (funciones private.*_token_canal).
//
// Uso: POST /sincronizar-canales  (header x-cron-secret)
//      ?dry_run=1      → consulta y traduce, pero no escribe.
//      ?desde=YYYY-MM-DD&hasta=YYYY-MM-DD (por defecto: últimos 45 días)

import { createClient } from "npm:@supabase/supabase-js@2";
import {
  liquidacionTikTokShop,
  ordenMercadoLibre,
  ordenTikTokShop,
  publicacionMercadoLibre,
  cadenaFirmaTikTok,
} from "../../../src/core/canales/mapeoApis.js";

const ML_API = "https://api.mercadolibre.com";
const TT_API = "https://open-api.tiktokglobalshop.com";
const VENTANA_DIAS = 45;

type Cuenta = {
  id: string;
  organization_id: string;
  business_id: string;
  canal: "mercado_libre" | "tiktok_shop";
  cuenta_externa: string;
};

const esperar = (ms: number) => new Promise((resolver) => setTimeout(resolver, ms));

async function obtenerJson(url: string, opciones: RequestInit = {}, intentos = 3): Promise<any> {
  for (let intento = 1; ; intento++) {
    const respuesta = await fetch(url, opciones);
    if (respuesta.status === 429 && intento < intentos) {
      await esperar(60_000); // límite de consultas por minuto
      continue;
    }
    if (!respuesta.ok) throw new Error(`${opciones.method || "GET"} ${url.split("?")[0]} → ${respuesta.status}`);
    return respuesta.json();
  }
}

/* ---------------- Credenciales (Vault) ---------------- */

async function leerToken(supabase: any, cuenta: Cuenta): Promise<string> {
  const { data, error } = await supabase.rpc("leer_token_canal", { p_cuenta_id: cuenta.id });
  if (error || !data) throw new Error(`Sin refresh token para la cuenta ${cuenta.cuenta_externa}`);
  return data as string;
}

async function guardarToken(supabase: any, cuenta: Cuenta, token: string) {
  const { error } = await supabase.rpc("guardar_token_canal", { p_cuenta_id: cuenta.id, p_token: token });
  if (error) throw new Error(`No se pudo guardar el refresh token: ${error.message}`);
}

/* ---------------- Mercado Libre ---------------- */

async function tokenMercadoLibre(supabase: any, cuenta: Cuenta): Promise<string> {
  const refresh = await leerToken(supabase, cuenta);
  const datos = await obtenerJson(`${ML_API}/oauth/token`, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded", accept: "application/json" },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      client_id: Deno.env.get("ML_CLIENT_ID")!,
      client_secret: Deno.env.get("ML_CLIENT_SECRET")!,
      refresh_token: refresh,
    }),
  });
  // Mercado Libre rota el refresh token en cada uso: se guarda el nuevo.
  if (datos.refresh_token && datos.refresh_token !== refresh) await guardarToken(supabase, cuenta, datos.refresh_token);
  return datos.access_token;
}

async function sincronizarMercadoLibre(cuenta: Cuenta, token: string, desde: string, hasta: string) {
  const auth = { headers: { authorization: `Bearer ${token}` } };
  const ordenes: any[] = [];
  for (let offset = 0; ; offset += 50) {
    const pagina = await obtenerJson(
      `${ML_API}/orders/search?seller=${cuenta.cuenta_externa}&order.date_created.from=${desde}T00:00:00.000-06:00` +
        `&order.date_created.to=${hasta}T23:59:59.999-06:00&sort=date_asc&limit=50&offset=${offset}`,
      auth
    );
    for (const orden of pagina.results || []) {
      let costoEnvio: number | null = null;
      if (orden.shipping?.id && orden.status !== "cancelled") {
        try {
          const costos = await obtenerJson(`${ML_API}/shipments/${orden.shipping.id}/costs`, {
            headers: { ...auth.headers, "x-format-new": "true" },
          });
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
    const pagina = await obtenerJson(`${ML_API}/users/${cuenta.cuenta_externa}/items/search?limit=100&offset=${offset}`, auth);
    ids.push(...(pagina.results || []));
    if (!pagina.results?.length || offset + 100 >= (pagina.paging?.total ?? 0)) break;
  }
  const publicaciones: any[] = [];
  for (let i = 0; i < ids.length; i += 20) {
    const lote = await obtenerJson(`${ML_API}/items?ids=${ids.slice(i, i + 20).join(",")}`, auth);
    for (const fila of lote || []) if (fila?.code === 200) publicaciones.push(publicacionMercadoLibre(fila.body));
  }
  return { ordenes, publicaciones, liquidaciones: [] };
}

/* ---------------- TikTok Shop ---------------- */

async function firmar(texto: string, secreto: string): Promise<string> {
  const clave = await crypto.subtle.importKey("raw", new TextEncoder().encode(secreto), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const firma = await crypto.subtle.sign("HMAC", clave, new TextEncoder().encode(texto));
  return [...new Uint8Array(firma)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function llamadaTikTok(path: string, token: string, shopCipher: string, params: Record<string, string> = {}, body?: object) {
  const appKey = Deno.env.get("TT_APP_KEY")!;
  const appSecret = Deno.env.get("TT_APP_SECRET")!;
  const todos: Record<string, string> = { app_key: appKey, timestamp: String(Math.floor(Date.now() / 1000)), shop_cipher: shopCipher, ...params };
  const cuerpo = body ? JSON.stringify(body) : "";
  todos.sign = await firmar(cadenaFirmaTikTok({ path, params: todos, body: cuerpo, appSecret }), appSecret);
  const url = `${TT_API}${path}?${new URLSearchParams(todos)}`;
  const datos = await obtenerJson(url, {
    method: body ? "POST" : "GET", // POST de búsqueda: sigue siendo lectura
    headers: { "x-tts-access-token": token, "content-type": "application/json" },
    body: body ? cuerpo : undefined,
  });
  if (datos.code !== 0) throw new Error(`TikTok Shop ${path}: ${datos.message}`);
  return datos.data;
}

async function sincronizarTikTok(cuenta: Cuenta, token: string, shopCipher: string, desde: string, hasta: string) {
  const inicio = Math.floor(new Date(`${desde}T00:00:00-06:00`).getTime() / 1000);
  const fin = Math.floor(new Date(`${hasta}T23:59:59-06:00`).getTime() / 1000);
  const ordenes: any[] = [];
  let pagina: string | undefined;
  do {
    const datos = await llamadaTikTok("/order/202309/orders/search", token, shopCipher,
      { page_size: "50", ...(pagina ? { page_token: pagina } : {}) },
      { create_time_ge: inicio, create_time_lt: fin });
    ordenes.push(...(datos.orders || []).map(ordenTikTokShop));
    pagina = datos.next_page_token || undefined;
  } while (pagina);

  const liquidaciones: any[] = [];
  pagina = undefined;
  do {
    const datos = await llamadaTikTok("/finance/202309/statements", token, shopCipher, {
      statement_time_ge: String(inicio), statement_time_lt: String(fin), page_size: "50", sort_field: "statement_time",
      ...(pagina ? { page_token: pagina } : {}),
    });
    liquidaciones.push(...(datos.statements || []).map(liquidacionTikTokShop));
    pagina = datos.next_page_token || undefined;
  } while (pagina);

  return { ordenes, publicaciones: [], liquidaciones };
}

/* ---------------- Escritura idempotente ---------------- */

async function guardar(supabase: any, cuenta: Cuenta, datos: { ordenes: any[]; publicaciones: any[]; liquidaciones: any[] }) {
  const base = { organization_id: cuenta.organization_id, business_id: cuenta.business_id, cuenta_id: cuenta.id };
  for (const { items, ...orden } of datos.ordenes) {
    const { data, error } = await supabase
      .from("canal_ordenes")
      .upsert({ ...base, ...orden, sincronizado_en: new Date().toISOString() }, { onConflict: "business_id,canal,external_id" })
      .select("id")
      .single();
    if (error) throw new Error(`canal_ordenes: ${error.message}`);
    if (items?.length) {
      const { error: errorItems } = await supabase
        .from("canal_orden_items")
        .upsert(items.map((item: any) => ({ ...item, orden_id: data.id })), { onConflict: "orden_id,publicacion,sku" });
      if (errorItems) throw new Error(`canal_orden_items: ${errorItems.message}`);
    }
  }
  if (datos.publicaciones.length) {
    const { error } = await supabase.from("canal_publicaciones").upsert(
      datos.publicaciones.map((p) => ({ ...base, ...p, sincronizado_en: new Date().toISOString() })),
      { onConflict: "business_id,canal,publicacion" }
    );
    if (error) throw new Error(`canal_publicaciones: ${error.message}`);
  }
  if (datos.liquidaciones.length) {
    const { error } = await supabase.from("canal_liquidaciones").upsert(
      datos.liquidaciones.map((l) => ({ ...base, ...l })),
      { onConflict: "business_id,canal,external_id" }
    );
    if (error) throw new Error(`canal_liquidaciones: ${error.message}`);
  }
}

/* ---------------- Entrada ---------------- */

Deno.serve(async (solicitud) => {
  if (solicitud.headers.get("x-cron-secret") !== Deno.env.get("CRON_SECRET")) {
    return new Response("No autorizado", { status: 401 });
  }
  const url = new URL(solicitud.url);
  const dryRun = url.searchParams.get("dry_run") === "1";
  const hoy = new Date(Date.now() - 6 * 3600_000).toISOString().slice(0, 10);
  const desde = url.searchParams.get("desde") || new Date(Date.now() - VENTANA_DIAS * 86400_000).toISOString().slice(0, 10);
  const hasta = url.searchParams.get("hasta") || hoy;

  const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const { data: cuentas, error } = await supabase.from("canal_cuentas").select("*").eq("estado", "ACTIVA");
  if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500 });

  const resultado: any[] = [];
  for (const cuenta of (cuentas || []) as Cuenta[]) {
    try {
      let datos;
      if (cuenta.canal === "mercado_libre") {
        datos = await sincronizarMercadoLibre(cuenta, await tokenMercadoLibre(supabase, cuenta), desde, hasta);
      } else {
        // TikTok Shop: access token y shop_cipher se obtienen al autorizar la app.
        const [token, shopCipher] = (await leerToken(supabase, cuenta)).split("|");
        datos = await sincronizarTikTok(cuenta, token, shopCipher, desde, hasta);
      }
      if (!dryRun) await guardar(supabase, cuenta, datos);
      await supabase.from("canal_cuentas").update({ ultimo_sync: new Date().toISOString(), ultimo_error: null }).eq("id", cuenta.id);
      resultado.push({ cuenta: cuenta.cuenta_externa, canal: cuenta.canal, ordenes: datos.ordenes.length, publicaciones: datos.publicaciones.length, liquidaciones: datos.liquidaciones.length, dryRun });
    } catch (fallo) {
      const mensaje = String((fallo as Error).message).slice(0, 1000);
      await supabase.from("canal_cuentas").update({ estado: "ERROR", ultimo_error: mensaje }).eq("id", cuenta.id);
      resultado.push({ cuenta: cuenta.cuenta_externa, canal: cuenta.canal, error: mensaje });
    }
  }
  return new Response(JSON.stringify({ desde, hasta, resultado }), { headers: { "content-type": "application/json" } });
});
