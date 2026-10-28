import test from "node:test";
import assert from "node:assert/strict";
import { crearPaqueteBbva } from "../../src/features/tesoreria/utils/crearPaqueteBbva.js";

const muestra = () => [
  { pagina: 1, texto: "BBVA No. de Cuenta 0479270035", celdas: [] },
  { pagina: 1, texto: "Fecha de Corte 30/09/2026", celdas: [] },
  { pagina: 2, texto: "FECHA SALDO DESCRIPCIÓN REFERENCIA CARGOS ABONOS OPERACIÓN LIQUIDACIÓN", celdas: [{ texto: "DESCRIPCIÓN", x: 85 }, { texto: "CARGOS", x: 372.6 }, { texto: "ABONOS", x: 429.5 }] },
  { pagina: 2, texto: "01/SEP 01/SEP PAGO PROVEEDOR 10.00", celdas: [{ texto: "01/SEP", x: 20 }, { texto: "01/SEP PAGO PROVEEDOR", x: 54 }, { texto: "10.00", x: 385 }] },
  { pagina: 2, texto: "Referencia proveedor 123", celdas: [{ texto: "Referencia proveedor 123", x: 54 }] },
  { pagina: 2, texto: "02/SEP 02/SEP DEPOSITO EFECTIVO 20.00", celdas: [{ texto: "02/SEP", x: 20 }, { texto: "02/SEP DEPOSITO EFECTIVO", x: 54 }, { texto: "20.00", x: 441 }] },
  { pagina: 2, texto: "Saldo Anterior 100.00", celdas: [] },
  { pagina: 2, texto: "Depósitos / Abonos (+) 1 20.00", celdas: [] },
  { pagina: 2, texto: "Retiros / Cargos (-) 1 10.00", celdas: [] },
  { pagina: 2, texto: "Saldo Final (+) 110.00", celdas: [] },
];

test("convierte un estado BBVA y lo deja listo solo si los movimientos y saldos cuadran", () => {
  const { paquete, resumen } = crearPaqueteBbva(muestra());
  assert.equal(paquete.cuentas[0].terminacion, "0035");
  assert.equal(paquete.movimientos.length, 2);
  assert.equal(paquete.movimientos[0].cargo, "10.00");
  assert.equal(paquete.movimientos[0].referencia_visible, "Referencia proveedor 123");
  assert.equal(paquete.movimientos[1].abono, "20.00");
  assert.equal(resumen.saldoFinal, "110.00");
});

test("bloquea el PDF si el importe extraído no coincide con el resumen BBVA", () => {
  const lineas = muestra();
  lineas[7] = { ...lineas[7], texto: "Depósitos / Abonos (+) 1 21.00" };
  assert.throws(() => crearPaqueteBbva(lineas), /no cuadra/);
});

test("bloquea filas con importes que no se pueden asignar a una sola columna", () => {
  const lineas = muestra();
  lineas[3] = { ...lineas[3], celdas: [...lineas[3].celdas, { texto: "10.00", x: 441 }] };
  assert.throws(() => crearPaqueteBbva(lineas), /separar con seguridad/);
});
