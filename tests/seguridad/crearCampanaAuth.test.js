import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { stripTypeScriptTypes } from "node:module";
import vm from "node:vm";

// Run the actual Edge handler with only external services replaced. No network,
// production credentials or OpenAI usage is needed to verify the access gate.
const fuente = stripTypeScriptTypes(readFileSync(new URL(
  "../../supabase/functions/crear-campana-marketing/index.ts", import.meta.url,
), "utf8").replace(/^import .*;$/gm, ""));

function preparar({ user = { id: "user-1", is_anonymous: false }, authError = null,
  perfil = { auth_user_id: "user-1", organization_id: "org-1", role: "marketing", active: true },
  perfilError = null, env = {}, authorization = "Bearer user-token", method = "POST", body = {},
  respuestaIA = null } = {}) {
  let handler;
  const llamadas = { body: 0, auth: 0, perfil: 0, openai: 0 };
  const variables = { SUPABASE_URL: "https://example.supabase.co", SUPABASE_ANON_KEY: "anon-key", ...env };
  vm.runInNewContext(fuente, {
    Response, console: { error() {} },
    Deno: { env: { get: (nombre) => variables[nombre] }, serve(fn) { handler = fn; } },
    createClient(url, key, opciones) {
      assert.equal(url, variables.SUPABASE_URL);
      assert.equal(key, "anon-key");
      assert.equal(opciones.global.headers.Authorization, authorization);
      assert.equal(opciones.auth.persistSession, false);
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
      assert.equal(url, "https://api.openai.com/v1/responses");
      if (!respuestaIA) throw new Error("No se debe llamar OpenAI en estos casos");
      return Response.json(respuestaIA);
    },
  });
  const request = { method, headers: new Headers(authorization ? { Authorization: authorization } : {}),
    async json() { llamadas.body += 1; return body; } };
  return { llamadas, ejecutar: () => handler(request) };
}

for (const authorization of ["", "anon-key", "Bearer", "Bearer token otro"]) {
  test(`campañas rechaza encabezado sin sesión válida: ${authorization || "ausente"}`, async () => {
    const caso = preparar({ authorization });
    assert.equal((await caso.ejecutar()).status, 401);
    assert.deepEqual(caso.llamadas, { body: 0, auth: 0, perfil: 0, openai: 0 });
  });
}

for (const [titulo, config] of [
  ["token inválido", { authError: { message: "invalid JWT" } }],
  ["sin usuario", { user: null }],
  ["usuario anónimo autenticado", { user: { id: "anon-user", is_anonymous: true } }],
]) {
  test(`campañas rechaza ${titulo} antes de leer datos o gastar IA`, async () => {
    const caso = preparar(config);
    assert.equal((await caso.ejecutar()).status, 401);
    assert.equal(caso.llamadas.body, 0);
    assert.equal(caso.llamadas.perfil, 0);
    assert.equal(caso.llamadas.openai, 0);
  });
}

for (const [titulo, perfil] of [
  ["perfil ausente", null],
  ["perfil inactivo", { auth_user_id: "user-1", organization_id: "org-1", role: "owner", active: false }],
  ["rol vendedora", { auth_user_id: "user-1", organization_id: "org-1", role: "vendedora", active: true }],
  ["identidad de otro usuario", { auth_user_id: "otro", organization_id: "org-1", role: "owner", active: true }],
  ["sin organización", { auth_user_id: "user-1", role: "owner", active: true }],
]) {
  test(`campañas no autoriza ${titulo}`, async () => {
    const caso = preparar({ perfil });
    assert.equal((await caso.ejecutar()).status, 403);
    assert.equal(caso.llamadas.body, 0);
    assert.equal(caso.llamadas.openai, 0);
  });
}

test("campañas falla cerrado cuando no puede verificar el perfil", async () => {
  const caso = preparar({ perfilError: { message: "database error" } });
  const respuesta = await caso.ejecutar();
  assert.equal(respuesta.status, 503);
  assert.equal(caso.llamadas.body, 0);
  assert.equal(caso.llamadas.openai, 0);
  assert.doesNotMatch(await respuesta.text(), /database error/);
});

for (const role of ["owner", "admin", "marketing"]) {
  test(`campañas deja avanzar ${role} activo y conserva la validación del objetivo`, async () => {
    const caso = preparar({ perfil: { auth_user_id: "user-1", organization_id: "org-1", role, active: true } });
    assert.equal((await caso.ejecutar()).status, 400);
    assert.deepEqual(caso.llamadas, { body: 1, auth: 1, perfil: 1, openai: 0 });
  });
}

test("campañas conserva preflight CORS sin autenticación", async () => {
  const caso = preparar({ method: "OPTIONS", authorization: "" });
  const respuesta = await caso.ejecutar();
  assert.equal(respuesta.status, 200);
  assert.equal(respuesta.headers.get("Access-Control-Allow-Methods"), "POST, OPTIONS");
  assert.deepEqual(caso.llamadas, { body: 0, auth: 0, perfil: 0, openai: 0 });
});

test("campañas no confía en rol owner editable de user_metadata", async () => {
  const caso = preparar({ user: { id: "user-1", is_anonymous: false, user_metadata: { role: "owner" } },
    perfil: { auth_user_id: "user-1", organization_id: "org-1", role: "chofer", active: true } });
  assert.equal((await caso.ejecutar()).status, 403);
  assert.equal(caso.llamadas.body, 0);
});

test("campañas falla cerrado si falta configuración de autenticación", async () => {
  const caso = preparar({ env: { SUPABASE_URL: "" } });
  assert.equal((await caso.ejecutar()).status, 503);
  assert.deepEqual(caso.llamadas, { body: 0, auth: 0, perfil: 0, openai: 0 });
});

test("campañas conserva respuesta de estrategia para marketing autorizado", async () => {
  const estrategia = { objetivo: "Venta orgánica", presupuestoInicial: 0 };
  const caso = preparar({ body: { objetivoUsuario: "Vender sin inversión" },
    env: { OPENAI_API_KEY: "test-only-key" }, respuestaIA: { output_text: JSON.stringify(estrategia) } });
  const respuesta = await caso.ejecutar();
  assert.equal(respuesta.status, 200);
  assert.deepEqual(await respuesta.json(), { ok: true, estrategia });
  assert.deepEqual(caso.llamadas, { body: 1, auth: 1, perfil: 1, openai: 1 });
});
