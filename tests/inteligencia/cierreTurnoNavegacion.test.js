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
