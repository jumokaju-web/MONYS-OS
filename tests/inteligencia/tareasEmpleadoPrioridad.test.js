import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const operacion = fs.readFileSync('src/features/inteligencia/components/OperacionEmpleado.jsx', 'utf8');
const inicio = fs.readFileSync('src/features/inteligencia/components/InicioTienda.jsx', 'utf8');

test('la portada muestra primero una sola prioridad y permite consultar las demás', () => {
  assert.match(operacion, /const tareasVisibles = useMemo/);
  assert.match(operacion, /PRIORIDAD DE AHORA/);
  assert.match(operacion, /Ver las otras /);
});

test('cada tarea ofrece iniciar, continuar o reportar un problema real', () => {
  assert.match(operacion, /▶ Iniciar tarea/);
  assert.match(operacion, /Continuar y terminar →/);
  assert.match(operacion, /¿No puedes continuar\? Reportar problema/);
  assert.match(inicio, /onReportarProblema=\{puedeRegistrarIncidencias \? reportarProblemaTarea : null\}/);
});

test('reportar un problema abre incidencias con el nombre de la tarea', () => {
  assert.match(inicio, /No pude continuar con la tarea/);
  assert.match(inicio, /incidenciaInicial=\{incidenciaInicial\}/);
});
