import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { stripTypeScriptTypes } from "node:module";
import vm from "node:vm";

const funciones = ["revisar-marketing", "generar-kit-marketing", "analizar-campana-marketing"];
const fuentes = new Map(funciones.map((nombre) => [nombre, stripTypeScriptTypes(readFileSync(new URL(
  `../../supabase/functions/${nombre}/index.ts`, import.meta.url,
), "utf8").replace(/^import .*;$/gm, ""))]));

// Execute each actual Edge handler, replacing only Auth/DB/network. A denied
// request must not read its body, leak a DB error, or consume an OpenAI call.
function preparar(nombre, { authorization = "Bearer user-token", method = "POST",
  user = { id: "user-1", is_anonymous: false }, authError = null, perfilError = null,
  perfil = { auth_user_id: "user-1", organization_id: "org-1", role: "marketing", active: true },
  env = {}, body = {}, respuestaIA = null } = {}) {
  let handler;
  const llamadas = { body: 0, auth: 0, perfil: 0, openai: 0 };
  const variables = { SUPABASE_URL: "https://example.supabase.co", SUPABASE_ANON_KEY: "anon-key", ...env };
  vm.runInNewContext(fuentes.get(nombre), {
    Response, console: { error() {} },
    Deno: { env: { get: (campo) => variables[campo] }, serve(fn) { handler = fn; } },
    createClient(url, key, opciones) {
      assert.equal(url, variables.SUPABASE_URL);
      assert.equal(key, "anon-key");
      assert.equal(opciones.global.headers.Authorization, authorization);
      assert.equal(opciones.auth.persistSession, false);
      assert.equal(opciones.auth.autoRefreshToken, false);
      return {
        auth: { async getUser(token) {
          llamadas.auth += 1;
          assert.equal(token, "user-token");
          return { data: { user }, error: authError };
        } },
        from(tabla) {
          llamadas.perfil += 1;
          assert.equal(tabla, "usuarios");
          return { select() { return this; }, eq(campo, valor) {
            assert.equal(campo, "auth_user_id");
            assert.equal(valor, user.id);
            return this;
          }, async maybeSingle() { return { data: perfil, error: perfilError }; } };
        },
      };
    },
    async fetch(url) {
      llamadas.openai += 1;
      if (!respuestaIA) throw new Error("La prueba no autoriza llamadas OpenAI");
      assert.equal(url, "https://api.openai.com/v1/chat/completions");
      return Response.json(respuestaIA);
    },
  });
  const request = { method,
    headers: new Headers(authorization ? { Authorization: authorization } : {}),
    async json() { llamadas.body += 1; return body; } };
  return { llamadas, ejecutar: () => handler(request) };
}

test("kit conserva audiencia como hipótesis cuando no hay evidencia del cliente ideal", async () => {
  const caso = preparar("generar-kit-marketing", {
    body: { producto: { nombre: "Gel de cejas", precio: 50, existencia: 5 },
      estrategia: { audiencia: "", oferta: "Precio vigente", objetivo: "Vender" } },
    env: { OPENAI_API_KEY: "test-only-key" },
    respuestaIA: { choices: [{ message: { content: JSON.stringify({ estado: "LISTO", clienteIdeal: {
      perfil: "Persona interesada en maquillaje", clasificacion: "REAL",
    } }) } }] },
  });
  const respuesta = await caso.ejecutar();
  assert.equal(respuesta.status, 200);
  const resultado = await respuesta.json();
  assert.equal(resultado.ok, true);
  assert.equal(resultado.kit.clienteIdeal.clasificacion, "HIPOTESIS");
  assert.deepEqual(caso.llamadas, { body: 1, auth: 1, perfil: 1, openai: 1 });
});

test("kit conserva bloqueo de publicación por existencia pendiente de verificar", async () => {
  const caso = preparar("generar-kit-marketing", {
    body: { producto: { nombre: "Gel de cejas", precio: 50, existencia: 5 },
      estrategia: { audiencia: "", oferta: "Precio vigente", objetivo: "Vender" },
      datosReales: { fuenteExistencia: "PENDIENTE_VERIFICACIÓN" } },
    env: { OPENAI_API_KEY: "test-only-key" },
    respuestaIA: { choices: [{ message: { content: JSON.stringify({ estado: "LISTO" }) } }] },
  });
  const respuesta = await caso.ejecutar();
  assert.equal(respuesta.status, 200);
  const resultado = await respuesta.json();
  assert.equal(resultado.ok, true);
  assert.equal(resultado.listo, false);
  assert.equal(resultado.kit.estado, "REQUIERE_DATOS");
  assert.equal(resultado.kit.clienteIdeal.clasificacion, "HIPOTESIS");
  assert.ok(resultado.kit.datosFaltantes.includes("Verificar existencia actual antes de publicar"));
});

for (const nombre of funciones) {
  for (const authorization of ["", "anon-key", "Bearer", "Bearer token otro"]) {
    test(`${nombre} rechaza encabezado sin sesión: ${authorization || "ausente"}`, async () => {
      const caso = preparar(nombre, { authorization });
      const respuesta = await caso.ejecutar();
      assert.equal(respuesta.status, 401);
      assert.equal((await respuesta.json()).ok, false);
      assert.deepEqual(caso.llamadas, { body: 0, auth: 0, perfil: 0, openai: 0 });
    });
  }

  for (const [titulo, config] of [
    ["token inválido", { authError: { message: "invalid JWT" } }],
    ["sin usuario", { user: null }],
    ["usuario anónimo autenticado", { user: { id: "anon-user", is_anonymous: true } }],
  ]) {
    test(`${nombre} rechaza ${titulo} antes de leer datos`, async () => {
      const caso = preparar(nombre, config);
      assert.equal((await caso.ejecutar()).status, 401);
      assert.deepEqual(caso.llamadas, { body: 0, auth: 1, perfil: 0, openai: 0 });
    });
  }

  for (const [titulo, perfil] of [
    ["perfil ausente", null],
    ["perfil inactivo", { auth_user_id: "user-1", organization_id: "org-1", role: "owner", active: false }],
    ["rol vendedora", { auth_user_id: "user-1", organization_id: "org-1", role: "vendedora", active: true }],
    ["identidad de otro usuario", { auth_user_id: "otro", organization_id: "org-1", role: "owner", active: true }],
    ["sin organización", { auth_user_id: "user-1", role: "owner", active: true }],
  ]) {
    test(`${nombre} no autoriza ${titulo}`, async () => {
      const caso = preparar(nombre, { perfil });
      assert.equal((await caso.ejecutar()).status, 403);
      assert.deepEqual(caso.llamadas, { body: 0, auth: 1, perfil: 1, openai: 0 });
    });
  }

  test(`${nombre} falla cerrado si no puede consultar el perfil`, async () => {
    const caso = preparar(nombre, { perfilError: { message: "database private error" } });
    const respuesta = await caso.ejecutar();
    assert.equal(respuesta.status, 503);
    assert.doesNotMatch(await respuesta.text(), /database private error/);
    assert.deepEqual(caso.llamadas, { body: 0, auth: 1, perfil: 1, openai: 0 });
  });

  for (const role of ["owner", "admin", "marketing"]) {
    test(`${nombre} conserva validación de datos para ${role} autorizado`, async () => {
      const caso = preparar(nombre, { perfil: { auth_user_id: "user-1", organization_id: "org-1", role, active: true } });
      const respuesta = await caso.ejecutar();
      assert.equal(respuesta.status, nombre === "generar-kit-marketing" ? 200 : 400);
      const resultado = await respuesta.json();
      if (nombre === "generar-kit-marketing") {
        assert.equal(resultado.ok, true);
        assert.equal(resultado.listo, false);
        assert.equal(resultado.estado, "REQUIERE_DATOS");
      } else assert.equal(resultado.ok, false);
      assert.deepEqual(caso.llamadas, { body: 1, auth: 1, perfil: 1, openai: 0 });
    });
  }

  test(`${nombre} conserva preflight CORS sin autenticación`, async () => {
    const caso = preparar(nombre, { method: "OPTIONS", authorization: "" });
    const respuesta = await caso.ejecutar();
    assert.equal(respuesta.status, 200);
    assert.equal(respuesta.headers.get("Access-Control-Allow-Methods"), "POST, OPTIONS");
    assert.deepEqual(caso.llamadas, { body: 0, auth: 0, perfil: 0, openai: 0 });
  });

  test(`${nombre} no permite GET aunque exista sesión`, async () => {
    const caso = preparar(nombre, { method: "GET" });
    assert.equal((await caso.ejecutar()).status, 405);
    assert.deepEqual(caso.llamadas, { body: 0, auth: 0, perfil: 0, openai: 0 });
  });

  test(`${nombre} no usa rol editable de user_metadata para autorizar`, async () => {
    const caso = preparar(nombre, { user: { id: "user-1", is_anonymous: false, user_metadata: { role: "owner" } },
      perfil: { auth_user_id: "user-1", organization_id: "org-1", role: "chofer", active: true } });
    assert.equal((await caso.ejecutar()).status, 403);
    assert.equal(caso.llamadas.body, 0);
    assert.equal(caso.llamadas.openai, 0);
  });

  test(`${nombre} falla cerrado si falta configuración Auth`, async () => {
    const caso = preparar(nombre, { env: { SUPABASE_URL: "" } });
    assert.equal((await caso.ejecutar()).status, 503);
    assert.deepEqual(caso.llamadas, { body: 0, auth: 0, perfil: 0, openai: 0 });
  });
}
