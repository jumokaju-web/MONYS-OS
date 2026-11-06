import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const source = fs.readFileSync('src/features/inteligencia/components/InicioTienda.jsx', 'utf8');

test('la empleada encuentra sus tareas antes que herramientas y explicaciones secundarias', () => {
  const trabajo = source.indexOf('id="employee-work-today"');
  const herramientas = source.indexOf('className="tienda-herramientas"');
  const guia = source.indexOf('className="tienda-ruta-plegada"');

  assert.ok(trabajo > -1, 'debe existir el trabajo de hoy');
  assert.ok(trabajo < herramientas, 'las tareas deben aparecer antes de los registros secundarios');
  assert.ok(herramientas < guia, 'la guía completa debe quedar al final');
});

test('las herramientas y la guía completa inician plegadas', () => {
  assert.match(source, /<details className="tienda-herramientas">/);
  assert.match(source, /<details className="tienda-ruta-plegada">/);
  assert.doesNotMatch(source, /<details className="tienda-(?:herramientas|ruta-plegada)" open/);
});
