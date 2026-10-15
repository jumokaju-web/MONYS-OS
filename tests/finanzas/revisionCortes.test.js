import test from 'node:test';
import assert from 'node:assert/strict';
import { estadoRevisionCorte, validarRevisionCorte } from '../../src/features/finanzas/utils/revisionCortes.js';
const captura = { cierre: { observaciones: 'original' } };
const valido = { estado: 'REVISADO', nota: 'Se comprobaron los importes y sus fuentes.', evidencia: 'Corte SICAR 123', comprobaciones: { sicar: true, cobros: true, movimientos: true } };
test('solo conserva revisión vigente cuando coincide el corte original', () => {
 assert.equal(estadoRevisionCorte(captura), 'PENDIENTE');
 assert.equal(estadoRevisionCorte(captura, { estado: 'REVISADO', snapshot_observaciones: 'original' }), 'REVISADO');
 assert.equal(estadoRevisionCorte(captura, { estado: 'REVISADO', snapshot_observaciones: 'otro' }), 'DESACTUALIZADO');
});
test('revisado exige todas las fuentes comprobadas sin aceptar texto como booleano', () => {
 assert.equal(validarRevisionCorte(valido), '');
 for (const c of ['sicar', 'cobros', 'movimientos']) {
  assert.ok(validarRevisionCorte({ ...valido, comprobaciones: { ...valido.comprobaciones, [c]: false } }));
  assert.ok(validarRevisionCorte({ ...valido, comprobaciones: { ...valido.comprobaciones, [c]: 'true' } }));
 }
});
test('aclaración admite comprobaciones pendientes pero siempre exige explicación y referencia', () => {
 assert.equal(validarRevisionCorte({ ...valido, estado: 'ACLARAR', comprobaciones: {} }), '');
 assert.ok(validarRevisionCorte({ ...valido, nota: '   ' }));
 assert.ok(validarRevisionCorte({ ...valido, evidencia: '' }));
 assert.ok(validarRevisionCorte({ ...valido, estado: 'PAGADO' }));
 assert.ok(validarRevisionCorte({ ...valido, nota: 'x'.repeat(2001) }));
});
