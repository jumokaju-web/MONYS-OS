import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const migracion = await readFile(new URL(
  "../../supabase/migrations/20261014193000_flotilla_incidencias_fotograficas.sql",
  import.meta.url,
), "utf8");

const migracionReportes = await readFile(new URL(
  "../../supabase/migrations/20261014210000_flotilla_reportes_whatsapp.sql",
  import.meta.url,
), "utf8");

test("la migración crea expedientes ligados a ruta, unidad y chofer", () => {
  assert.match(migracion, /create table if not exists public\.flotilla_incidencias/i);
  assert.match(migracion, /alter table public\.flotilla_incidencias[\s\S]*add column if not exists organization_id/i);
  assert.match(migracion, /ruta_id uuid not null references public\.flotilla_rutas/i);
  assert.match(migracion, /unidad_id uuid not null references public\.flotilla_unidades/i);
  assert.match(migracion, /driver_auth_user_id uuid not null references auth\.users/i);
});

test("protege las fotos, el alcance y la revisión administrativa", () => {
  assert.match(migracion, /foto_contexto_path text not null/i);
  assert.match(migracion, /foto_detalle_path text not null/i);
  assert.match(migracion, /flotilla_puede_ver_unidad\(unidad_id\)/i);
  assert.match(migracion, /Solo Administración puede revisar una incidencia/i);
  assert.doesNotMatch(migracion, /grant delete/i);
});

test("los reportes guardan mensaje y datos estructurados", () => {
  assert.match(migracionReportes, /add column if not exists detalle jsonb/i);
  assert.match(migracionReportes, /add column if not exists mensaje_whatsapp text/i);
  assert.match(migracionReportes, /'RETORNO_CEDIS'/i);
  assert.match(migracionReportes, /detalle->>'recibeCedis'/i);
  assert.match(migracionReportes, /tipo not in \([\s\S]*'RETORNO_CEDIS'/i);
});
