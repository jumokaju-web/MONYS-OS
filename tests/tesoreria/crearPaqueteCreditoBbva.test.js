import test from "node:test";
import assert from "node:assert/strict";
import { crearPaqueteCreditoBbva } from "../../src/features/tesoreria/utils/crearPaqueteCreditoBbva.js";

const estado = `
BBVA México
Estado de Cuenta Línea Crédito Digital PyME
ANA KARINA JIMENEZ MEZA
FRANCISCO I MADERO
No. de Crédito 4555 1330 0262 6158
Crédito Disponible $ 17,867.14
Límite de Crédito $ 166,999.00
Saldo Inicial del Periodo +$ 152,792.54
Fecha de Corte 02/10/26
Fecha Límite de Pago 12/10/26
Pagos: -$ 5,715.78
Capital $ 3,584.70 Intereses $ 1,877.08 Comisiones $ 254.00 IVA $ 0.00
Pago para no generar intereses: $ 5,684.46
Capital $ 3,629.36 Intereses $ 1,832.42 Comisiones $ 0.00 IVA $ 222.68
Pago Mínimo $ 5,684.46
Saldo al Corte +$ 149,131.86
Subtotal Saldo Actual $ 143,447.40
Tasa del producto 46.52 %
Movimientos efectuados Crédito
IVA :$254.00 Interes:$1,877.08 Comisiones:$0.00 Capital:$3,584.70
`;

test("separa deuda al corte de saldo promocional y concilia desglose de pago", () => {
  const paquete = crearPaqueteCreditoBbva(estado);
  assert.equal(paquete.terminacion, "6158");
  assert.equal(paquete.titular, "ANA KARINA JIMENEZ MEZA");
  assert.equal(paquete.corte, "2026-10-02");
  assert.equal(paquete.fechaLimitePago, "2026-10-12");
  assert.equal(paquete.saldoAlCorte, "149131.86");
  assert.equal(paquete.saldoPromociones, "143447.40");
  assert.equal(paquete.pagoMinimo, "5684.46");
  assert.deepEqual(paquete.ultimoPago, {
    total: "5715.78",
    capital: "3584.70",
    intereses: "1877.08",
    comisiones: "0.00",
    iva: "254.00",
  });
});

test("rechaza estados donde el saldo al corte no concilia con promociones y pago mínimo", () => {
  assert.throws(
    () => crearPaqueteCreditoBbva(estado.replace("149,131.86", "150,000.00")),
    /no concilian/,
  );
});

test("rechaza un desglose de pago que no coincide con el total", () => {
  assert.throws(
    () => crearPaqueteCreditoBbva(estado.replace("Capital:$3,584.70", "Capital:$3,000.00")),
    /último pago.*no cuadra/,
  );
});

test("rechaza límite y crédito disponible que no concilian con el saldo", () => {
  assert.throws(
    () => crearPaqueteCreditoBbva(estado.replace("17,867.14", "18,000.00")),
    /no concilian/,
  );
});
