import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const fuente = readFileSync(
  new URL('../../src/features/inteligencia/components/CierreTurno.jsx', import.meta.url),
  'utf8'
);

test('el cierre es la acción principal y explica dónde capturar los cobros', () => {
  const cierre = fuente.indexOf('Capturar ventas y cierre de');
  const apertura = fuente.indexOf('Abrir ${cajaNombre} para comenzar turno');

  assert.ok(cierre >= 0, 'debe existir una acción visible para capturar el cierre');
  assert.ok(apertura > cierre, 'abrir caja debe quedar después del cierre como acción secundaria');
  assert.match(fuente, /efectivo, tarjeta, transferencias y la foto del corte/i);
  assert.match(fuente, /scrollIntoView/);
  assert.match(fuente, /Ya existe un corte de esta caja y turno/);
  assert.match(fuente, /ESTÁS CAPTURANDO/);
  assert.match(fuente, /seleccionada/);
  assert.match(fuente, /Confirma estos dos datos antes de enviar/);
});

test('el envío del corte queda antes de notas opcionales y los movimientos están plegados', () => {
  const enviar = fuente.indexOf('Guardar y enviar corte');
  const notas = fuente.indexOf('Notas del turno · opcional');

  assert.ok(enviar >= 0, 'debe existir una acción clara para enviar el corte');
  assert.ok(notas > enviar, 'las notas opcionales no deben ocultar el botón de envío');
  assert.match(fuente, /<details className="tienda-movimientos">/);
  assert.match(fuente, /Al aparecer el folio, el corte ya llegó a Dirección/);
  assert.match(fuente, /\{error && <p role="alert">/);
});
