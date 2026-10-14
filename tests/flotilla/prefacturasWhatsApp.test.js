import test from "node:test";
import assert from "node:assert/strict";
import { crearPrefacturasWhatsApp } from "../../src/features/flotilla/utils/prefacturasWhatsApp.js";

function ruta(datos = {}) {
  return {
    id: datos.id || "r1",
    unidad_id: datos.unidadId || "u1",
    driver_auth_user_id: datos.driverId || "d1",
    chofer_nombre: datos.chofer || "FERNANDEZ CORONA RICARDO JOSHUA",
    fecha: datos.fecha || "2026-10-02",
    codigo_ruta: datos.codigo || "Z3",
    tipo_ruta: datos.tipoRuta || "SDD",
    tipo_pago: datos.tipoPago || "MLP",
    unidad: {
      placas: datos.placas || "HY0359B",
      tipo_pago_chory: datos.tipoPago || "MLP",
      propietarios: [datos.socio || "Mónica"],
    },
    resumen: {
      kilometros: datos.kilometros ?? 235.11,
      pagoBase: datos.pagoBase ?? 1600,
      bonoKilometraje: datos.bono ?? 425,
      ingresoRental: datos.ingresoRental ?? 0,
      ambulanciasConfirmadas: datos.ambulanciaFavor ?? 0,
      ambulanciasDescontadas: datos.ambulanciaDescuento ?? 0,
      otrosConfirmados: 0,
      ganado: datos.ganado ?? 2025,
      adelantosEntregados: datos.adelantos ?? 0,
      prestamosGasolina: datos.prestamoGasolina ?? 0,
    },
  };
}

test("genera el formato exacto por operador con bono y descuento PNR semanal", () => {
  const resultado = crearPrefacturasWhatsApp({
    operaciones: [ruta()],
    descuentosPnr: [{
      estado: "APLICADO",
      monto: 500,
      pnr: { unidad_id: "u1", driver_auth_user_id: "d1", chofer_nombre: "FERNANDEZ CORONA RICARDO JOSHUA" },
    }],
    desde: "2026-09-28",
    hasta: "2026-10-04",
    cedis: "STT1",
  });

  assert.equal(resultado.prefacturas.length, 1);
  const [prefactura] = resultado.prefacturas;
  assert.match(prefactura.mensaje, /Prefactura: FERNANDEZ CORONA RICARDO JOSHUA/);
  assert.match(prefactura.mensaje, /Viernes — SDD Z3 MLP \$1,600 \+ \$425 Bono \(235\.11 km\) = \$2,025/);
  assert.match(prefactura.mensaje, /-\$ 500 PNRS \/ LOST/);
  assert.match(prefactura.mensaje, /Total después de descuentos: \$1,525/);
  assert.match(prefactura.mensajeChofer, /-\$ 500 PNRS \/ LOST/);
  assert.equal(prefactura.descuentos.pnr, 500);
});

test("rental usa cobro de empresa y se agrupa como flota compartida", () => {
  const resultado = crearPrefacturasWhatsApp({
    operaciones: [ruta({
      tipoPago: "RENTAL_LARGE",
      chofer: "Emmanuel Torres Velazquez",
      placas: "LG-67-379",
      kilometros: 0,
      pagoBase: 1000,
      bono: 0,
      ingresoRental: 1221,
      ganado: 1000,
      socio: "Marlon/Alexis",
      tipoRuta: "",
      codigo: "C1",
      fecha: "2026-09-28",
    })],
    desde: "2026-09-28",
    hasta: "2026-10-04",
  });

  assert.match(resultado.prefacturas[0].mensaje, /Lunes — Ruta C1 Large Rental \$1,221/);
  assert.equal(resultado.prefacturas[0].totalRutas, 1221);
  assert.equal(resultado.resumenesSocio[0].titulo, "RENTAL COMPARTIDA");
  assert.match(resultado.resumenesSocio[0].mensaje, /TOTAL RENTAL COMPARTIDA A COBRAR: \$1,221/);
});

test("separa prefacturas cuando un mismo operador usa unidades distintas", () => {
  const resultado = crearPrefacturasWhatsApp({
    operaciones: [ruta(), ruta({ id: "r2", unidadId: "u2", placas: "JY21009" })],
    desde: "2026-09-28",
    hasta: "2026-10-04",
  });
  assert.equal(resultado.prefacturas.length, 2);
});

test("ambulancia afecta el pago del driver pero no el cobro de rutas del socio", () => {
  const resultado = crearPrefacturasWhatsApp({
    operaciones: [ruta({ ambulanciaFavor: 200, ganado: 2225 })],
    desde: "2026-09-28",
    hasta: "2026-10-04",
  });
  assert.equal(resultado.prefacturas[0].totalRutas, 2025);
  assert.match(resultado.prefacturas[0].mensajeChofer, /Ganado en rutas y apoyos: \$2,225/);
});

