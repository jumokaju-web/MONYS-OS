import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

const migracion = readFileSync(
  new URL(
    "../../supabase/migrations/20261019183000_endurecer_search_path_funciones_flotilla.sql",
    import.meta.url,
  ),
  "utf8",
);

const funcionesPublic = [
  "anular_ajuste_prefactura_flotilla",
  "aplicar_descuento_pnr_flotilla",
  "flotilla_es_admin_de_organizacion",
  "flotilla_puede_gestionar_pnr",
  "flotilla_puede_ver_unidad",
  "gestionar_pnr_flotilla",
  "guardar_ajuste_prefactura_flotilla",
  "responder_pnr_flotilla",
  "solicitar_convenio_pnr_flotilla",
];

const funcionesExtensions = [
  "activar_chofer_con_codigo",
  "generar_codigo_activacion_chofer",
];

const funcionesAuth = [
  "configurar_acceso_flotilla",
  "desactivar_acceso_flotilla",
];

test("las funciones privilegiadas de Flotilla colocan pg_temp al final", () => {
  for (const funcion of funcionesPublic) {
    assert.match(
      migracion,
      new RegExp(`alter function public\\.${funcion}\\([\\s\\S]*?set search_path = public, pg_temp;`, "i"),
    );
  }

  for (const funcion of funcionesExtensions) {
    assert.match(
      migracion,
      new RegExp(`alter function public\\.${funcion}\\([\\s\\S]*?set search_path = public, extensions, pg_temp;`, "i"),
    );
  }

  for (const funcion of funcionesAuth) {
    assert.match(
      migracion,
      new RegExp(`alter function public\\.${funcion}\\([\\s\\S]*?set search_path = public, auth, pg_temp;`, "i"),
    );
  }
});

test("el endurecimiento no cambia privilegios de ejecución ni cuerpos", () => {
  assert.doesNotMatch(migracion, /grant\s+execute/i);
  assert.doesNotMatch(migracion, /revoke\s+execute/i);
  assert.doesNotMatch(migracion, /create\s+or\s+replace\s+function/i);
});
