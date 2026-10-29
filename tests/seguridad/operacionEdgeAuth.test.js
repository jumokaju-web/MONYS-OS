import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { stripTypeScriptTypes } from "node:module";
import vm from "node:vm";

const funciones = ["evaluar-tarea", "analizar-cierre-turno", "analizar-patrones-cierres"];
const fuentes = Object.fromEntries(funciones.map((nombre) => [nombre, stripTypeScriptTypes(
  readFileSync(new URL(`../../supabase/functions/${nombre}/index.ts`, import.meta.url), "utf8")
    .replace(/^import .*;$/gm, ""),
)]));
const perfilBase = { auth_user_id: "u1", organization_id: "org1", business_id: "biz1", branch_id: "br1", active: true, role: "vendedora" };
const tareaBase = { id: "t1", organization_id: "org1", business_id: "biz1", branch_id: "br1", responsable_usuario_id: "u1", titulo: "Ordenar anaquel" };
const cierreBase = { id: "c1", branch_id: "br1", created_by: "u1", pendientes: "Revisar inventario" };

function preparar(nombre, opciones = {}) {
  const perfil = opciones.perfil === undefined ? { ...perfilBase, role: nombre === "analizar-patrones-cierres" ? "owner" : "vendedora" } : opciones.perfil;
  const user = opciones.user === undefined ? { id: "u1", is_anonymous: false } : opciones.user;
  const tarea = opciones.tarea === undefined ? { ...tareaBase } : opciones.tarea;
  const cierre = opciones.cierre === undefined ? { ...cierreBase } : opciones.cierre;
  const authorization = opciones.authorization === undefined ? "Bearer user-token" : opciones.authorization;
  const body = opciones.body || (nombre === "evaluar-tarea" ? { tareaId: "t1" }
    : nombre === "analizar-cierre-turno" ? { cierreId: "c1" } : { branchId: "br1", dias: 7 });
  const llamadas = { cuerpo: 0, auth: 0, openai: 0, lecturas: [], escrituras: [], clientesPrivilegiados: 0 };
  const env = { SUPABASE_URL: "https://example.supabase.co", SUPABASE_ANON_KEY: "anon-key",
    SUPABASE_SERVICE_ROLE_KEY: "service-test-only", OPENAI_API_KEY: "openai-test-only", ...opciones.env };
  let handler;
  class Consulta {
    constructor(tabla, privilegiado) { this.tabla = tabla; this.privilegiado = privilegiado; this.filtros = {}; this.operacion = "select"; }
    select() { assert.equal(this.privilegiado, false, "Ninguna fuente debe leerse con service role"); return this; }
    eq(campo, valor) { this.filtros[campo] = valor; return this; }
    gte(campo, valor) { this.desde = [campo, valor]; return this; }
    in(campo, valores) { this.dentro = [campo, valores]; return this; }
    order() { return this; }
    limit(valor) { this.limite = valor; return this; }
    insert(registro) { this.operacion = "insert"; this.registro = registro; return this; }
    update(registro) { this.operacion = "update"; this.registro = registro; return this; }
    single() { this.unico = true; return this; }
    maybeSingle() { this.unico = true; return this; }
    then(resolve, reject) { return Promise.resolve().then(() => this.resolver()).then(resolve, reject); }
    resolver() {
      if (this.operacion !== "select") {
        llamadas.escrituras.push({ tabla: this.tabla, operacion: this.operacion, privilegiado: this.privilegiado,
          registro: this.registro, filtros: this.filtros });
        if (this.privilegiado) assert(["cierres_turno_analisis", "cierres_patrones_analisis"].includes(this.tabla));
        return { data: null, error: opciones.errorEscritura ? { message: "write rejected" } : null };
      }
      assert.equal(this.privilegiado, false);
      llamadas.lecturas.push({ tabla: this.tabla, filtros: this.filtros, limite: this.limite });
      let data;
      if (this.tabla === "usuarios") { assert.equal(this.filtros.auth_user_id, user.id); data = perfil; }
      else if (this.tabla === "tareas_operativas") data = tarea;
      else if (this.tabla === "tarea_evidencias") data = opciones.evidencias || [
        { id: "e1", tipo: "inicio", archivo_url: "https://example.com/before.png" },
        { id: "e2", tipo: "final", archivo_url: "https://example.com/after.png" },
      ];
      else if (this.tabla === "cierres_turno") data = this.unico ? cierre : opciones.cierres || [cierre];
      else if (this.tabla === "branches") data = opciones.sucursal === undefined ? { id: this.filtros.id, business_id: "biz1" } : opciones.sucursal;
      else if (this.tabla === "businesses") data = opciones.negocio === undefined ? { id: "biz1", organization_id: "org1" } : opciones.negocio;
      else if (this.tabla === "cierres_turno_analisis") data = [];
      else throw new Error(`Lectura no prevista: ${this.tabla}`);
      return { data, error: this.tabla === "usuarios" ? opciones.errorPerfil || null : null };
    }
  }
  vm.runInNewContext(fuentes[nombre], {
    Response, console: { error() {} },
    Deno: { env: { get: (clave) => env[clave] }, serve(fn) { handler = fn; } },
    createClient(url, key, config) {
      assert.equal(url, env.SUPABASE_URL);
      const privilegiado = key === "service-test-only";
      if (privilegiado) llamadas.clientesPrivilegiados += 1;
      else {
        assert.equal(key, "anon-key");
        assert.equal(config.global.headers.Authorization, authorization);
      }
      assert.equal(config.auth.persistSession, false);
      return {
        auth: { async getUser(token) { llamadas.auth += 1; assert.equal(token, "user-token");
          return { data: { user }, error: opciones.errorAuth || null }; } },
        from: (tabla) => new Consulta(tabla, privilegiado),
      };
    },
    async fetch(url, config) {
      llamadas.openai += 1;
      assert.equal(url, "https://api.openai.com/v1/responses");
      if (opciones.errorIA) throw new Error("AI unavailable");
      const solicitud = JSON.parse(config.body);
      if (nombre === "analizar-patrones-cierres") assert.match(solicitud.input[0].content[0].text, /base parcial/);
      const resultado = nombre === "evaluar-tarea" ? { puntuacion_total: 90, resultado: "aprobada", resumen: "Evidencia suficiente" }
        : nombre === "analizar-cierre-turno" ? { prioridad: "normal", resumen_ejecutivo: "Revisar inventario" }
          : { periodo_dias: 999, total_cierres: 999, alertas: [], confianza: 50 };
      return Response.json({ output: [{ content: [{ text: JSON.stringify(resultado) }] }] });
    },
  });
  return { llamadas, async ejecutar() {
    const respuesta = await handler({ method: opciones.method || "POST",
      headers: new Headers(authorization ? { Authorization: authorization } : {}),
      async json() { llamadas.cuerpo += 1; return body; } });
    return { respuesta, resultado: await respuesta.json().catch(() => null) };
  } };
}

for (const nombre of funciones) {
  for (const [descripcion, config] of [
    ["sin token", { authorization: "" }],
    ["token inválido", { errorAuth: { message: "invalid JWT" } }],
    ["sesión anónima", { user: { id: "u1", is_anonymous: true } }],
    ["sin usuario", { user: null }],
  ]) test(`${nombre}: ${descripcion} no lee body, gasta IA ni escribe`, async () => {
    const caso = preparar(nombre, config);
    assert.equal((await caso.ejecutar()).respuesta.status, 401);
    assert.equal(caso.llamadas.cuerpo, 0);
    assert.equal(caso.llamadas.openai, 0);
    assert.equal(caso.llamadas.escrituras.length, 0);
  });
  test(`${nombre}: perfil ajeno o inactivo no autoriza`, async () => {
    for (const perfil of [{ ...perfilBase, auth_user_id: "otra" }, { ...perfilBase, active: false }, { ...perfilBase, organization_id: null }]) {
      const caso = preparar(nombre, { perfil });
      assert.equal((await caso.ejecutar()).respuesta.status, 403);
      assert.equal(caso.llamadas.openai, 0);
      assert.equal(caso.llamadas.escrituras.length, 0);
    }
  });
  test(`${nombre}: método incorrecto no procesa datos y preflight sigue disponible`, async () => {
    const caso = preparar(nombre, { method: "GET" });
    assert.equal((await caso.ejecutar()).respuesta.status, 405);
    assert.equal(caso.llamadas.auth, 0);
    const preflight = preparar(nombre, { method: "OPTIONS", authorization: "" });
    assert.equal((await preflight.ejecutar()).respuesta.status, 200);
    assert.equal(preflight.llamadas.auth, 0);
  });
}

for (const [descripcion, tarea] of [
  ["organización ajena", { ...tareaBase, organization_id: "org2" }],
  ["negocio ajeno", { ...tareaBase, business_id: "biz2" }],
  ["sucursal ajena", { ...tareaBase, branch_id: "br2" }],
  ["responsable ajeno", { ...tareaBase, responsable_usuario_id: "u2" }],
  ["ID ajeno", { ...tareaBase, id: "t2" }],
  ["recurso oculto por RLS", null],
]) test(`evaluar-tarea: ${descripcion} no llama IA ni ejecuta rescate`, async () => {
  const caso = preparar("evaluar-tarea", { tarea });
  assert.equal((await caso.ejecutar()).respuesta.status, 403);
  assert.equal(caso.llamadas.openai, 0);
  assert.equal(caso.llamadas.escrituras.length, 0);
});

test("evaluar-tarea: propia se evalúa y guarda solo con RLS; fallo IA rescata solo tarea autorizada", async () => {
  const caso = preparar("evaluar-tarea");
  assert.equal((await caso.ejecutar()).respuesta.status, 200);
  assert.equal(caso.llamadas.openai, 1);
  assert.equal(caso.llamadas.escrituras.length, 2);
  assert(caso.llamadas.escrituras.every((item) => !item.privilegiado));
  assert.equal(caso.llamadas.clientesPrivilegiados, 0);
  const fallo = preparar("evaluar-tarea", { errorIA: true });
  assert.equal((await fallo.ejecutar()).respuesta.status, 400);
  assert.equal(fallo.llamadas.escrituras.length, 1);
  assert.equal(fallo.llamadas.escrituras[0].registro.evaluacion_estado, "revision_humana");
  assert.equal(fallo.llamadas.escrituras[0].filtros.id, "t1");
  assert.equal(fallo.llamadas.escrituras[0].privilegiado, false);
});

for (const [descripcion, config] of [
  ["ID ajeno", { cierre: { ...cierreBase, id: "c2" } }],
  ["cierre ajeno", { cierre: { ...cierreBase, created_by: "u2" } }],
  ["sucursal ajena", { cierre: { ...cierreBase, branch_id: "br2" } }],
  ["organización ajena", { negocio: { id: "biz1", organization_id: "org2" } }],
  ["negocio ajeno", { sucursal: { id: "br1", business_id: "biz2" }, negocio: { id: "biz2", organization_id: "org1" } }],
]) test(`analizar-cierre-turno: ${descripcion} no gasta IA ni escribe resultado privilegiado`, async () => {
  const caso = preparar("analizar-cierre-turno", config);
  assert.equal((await caso.ejecutar()).respuesta.status, 403);
  assert.equal(caso.llamadas.openai, 0);
  assert.equal(caso.llamadas.escrituras.length, 0);
  assert.equal(caso.llamadas.clientesPrivilegiados, 0);
});

test("analizar-cierre-turno: propio se revalida por RLS y solo INSERT resultado usa privilegio", async () => {
  const caso = preparar("analizar-cierre-turno");
  assert.equal((await caso.ejecutar()).respuesta.status, 200);
  assert.equal(caso.llamadas.openai, 1);
  assert.equal(caso.llamadas.lecturas.filter((item) => item.tabla === "cierres_turno").length, 2);
  assert.equal(caso.llamadas.escrituras.length, 1);
  assert.equal(caso.llamadas.escrituras[0].tabla, "cierres_turno_analisis");
  assert.equal(caso.llamadas.escrituras[0].registro.cierre_id, "c1");
  assert.equal(caso.llamadas.escrituras[0].privilegiado, true);
});

test("patrones: solo dirección y sucursal autorizada acceden; dias fuera de 1..90 no gastan", async () => {
  for (const config of [
    { perfil: perfilBase }, { negocio: { id: "biz1", organization_id: "org2" } },
    ...[0, -1, 91, 1.5, "NaN"].map((dias) => ({ body: { branchId: "br1", dias } })),
  ]) {
    const caso = preparar("analizar-patrones-cierres", config);
    assert([400, 403].includes((await caso.ejecutar()).respuesta.status));
    assert.equal(caso.llamadas.openai, 0);
    assert.equal(caso.llamadas.escrituras.length, 0);
  }
});

test("patrones: límite500, conteos reales y base parcial declarada; solo INSERT resultado de branch validado", async () => {
  const caso = preparar("analizar-patrones-cierres");
  const { respuesta, resultado } = await caso.ejecutar();
  assert.equal(respuesta.status, 200);
  assert.equal(resultado.patrones.periodo_dias, 7);
  assert.equal(resultado.patrones.total_cierres, 1);
  assert.equal(resultado.alcance.datos_parciales, true);
  assert.equal(resultado.alcance.limite_cierres, 500);
  assert.equal(caso.llamadas.lecturas.find((item) => item.tabla === "cierres_turno").limite, 500);
  assert.equal(resultado.guardado, true);
  assert.equal(caso.llamadas.escrituras[0].registro.branch_id, "br1");
  assert.equal(caso.llamadas.escrituras[0].privilegiado, true);
});

test("patrones sin branch devuelve resultado sin fingir guardado ni hacer escritura global", async () => {
  const caso = preparar("analizar-patrones-cierres", { body: { dias: 7 } });
  const { respuesta, resultado } = await caso.ejecutar();
  assert.equal(respuesta.status, 200);
  assert.equal(resultado.guardado, false);
  assert.match(resultado.advertencia, /no se guardó/);
  assert.equal(caso.llamadas.escrituras.length, 0);
  assert.equal(caso.llamadas.clientesPrivilegiados, 0);
});

test("patrones vacíos no gastan IA ni proclaman confianza100; fallo de guardado es explícito", async () => {
  const caso = preparar("analizar-patrones-cierres", { cierres: [], errorEscritura: true });
  const { respuesta, resultado } = await caso.ejecutar();
  assert.equal(respuesta.status, 200);
  assert.equal(caso.llamadas.openai, 0);
  assert.equal(resultado.patrones.confianza, 0);
  assert.equal(resultado.guardado, false);
  assert.match(resultado.advertencia, /no se guardó/);
});
