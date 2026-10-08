import test from 'node:test';
import assert from 'node:assert/strict';
import { validarEstadoBancario } from '../../src/features/tesoreria/utils/validarEstadoBancario.js';
const base = () => ({ version: 1, cuentas: [{ terminacion: '0035', desde: '2026-09-01', hasta: '2026-09-30', inicial: '10.00', cargos: '2.50', abonos: '0.00', final: '7.50', movimientos: 1 }], movimientos: [{ id: 'a', cuenta: '0035', fecha_operacion: '2026-09-01', fecha_liquidacion: '2026-09-01', descripcion: 'Pago', referencia_visible: 'Concepto', cargo: '2.50', abono: '0.00' }] });
test('reconciles exact cents and rejects tampered balance or duplicate movements', () => {
 assert.equal(validarEstadoBancario(base()).saldo, 7.5);
 const altered = base(); altered.cuentas[0].final = '8.00'; assert.throws(() => validarEstadoBancario(altered), /no cuadra/);
 const duplicated = base(); duplicated.movimientos.push(duplicated.movimientos[0]); assert.throws(() => validarEstadoBancario(duplicated), /duplicado/);
});
test('rejects impossible dates, negative amounts and unsupported confirmations', () => {
 const p=base();p.movimientos[0].fecha_operacion='2026-09-31'; assert.throws(() => validarEstadoBancario(p), /fecha/);
 const n=base();n.movimientos[0].cargo='-2.50';assert.throws(() => validarEstadoBancario(n), /Importe/);
 const c=base();c.movimientos[0].revision={estado:'Confirmado',clasificacion:'Personal',nota:''};assert.throws(() => validarEstadoBancario(c), /nota/);
});
