import test from "node:test";
import assert from "node:assert/strict";

import {
  construirCorteRecibidoDireccion,
  validarCorteRecibidoDireccion,
} from "../../src/features/dashboard/utils/corteRecibidoDireccion.js";

function formulario(overrides = {}) {
  return {
    branchId: "centro",
    empleadoId: "katy",
    fecha: "2026-10-26",
    cajaId: "CAJA_1",
    turnoCaja: "MATUTINO",
    motivo: "SIN_ACCESO",
    detalleMotivo: "La empleada todavía no tenía acceso.",
    ventaSicar: "1000",
    efectivoVentas: "500",
    tarjeta: "300",
    transferencias: "200",
    otrosCobros: "0",
    fondoInicial: "1000",
    gastosCaja: "0",
    detalleGastosCaja: "",
    efectivoEntregado: "500",
    efectivoFinal: "1000",
    destinoEfectivoRetirado: "RESGUARDO",
    responsableEfectivoRetirado: "Mónica",
    detalleEfectivoRetirado: "Sobre de Caja 1",
    ...overrides,
  };
}

test("exige identidad, explicación, foto e importes sin convertir ausencias en cero", () => {
  assert.match(validarCorteRecibidoDireccion({ formulario: formulario({ empleadoId: "" }), foto: {}, fechaActual: "2026-10-26" }), /quién hizo/i);
  assert.match(validarCorteRecibidoDireccion({ formulario: formulario(), foto: null, fechaActual: "2026-10-26" }), /foto original/i);
  assert.match(validarCorteRecibidoDireccion({ formulario: formulario({ tarjeta: "" }), foto: {}, fechaActual: "2026-10-26" }), /importes reales/i);
  assert.equal(validarCorteRecibidoDireccion({ formulario: formulario(), foto: {}, fechaActual: "2026-10-26" }), "");
});
test("rechaza fechas futuras", () => {
  assert.match(validarCorteRecibidoDireccion({ formulario: formulario({ fecha: "2026-10-27" }), foto: {}, fechaActual: "2026-10-26" }), /fecha futura/i);
});

test("rechaza un turno ausente o fuera del catálogo", () => {
  assert.match(validarCorteRecibidoDireccion({ formulario: formulario({ turnoCaja: "" }), foto: {}, fechaActual: "2026-10-26" }), /turno real/i);
  assert.match(validarCorteRecibidoDireccion({ formulario: formulario({ turnoCaja: "INVENTADO" }), foto: {}, fechaActual: "2026-10-26" }), /turno válido/i);
});

test("exige confirmar otras salidas de caja y documentarlas cuando existen", () => {
  assert.match(validarCorteRecibidoDireccion({ formulario: formulario({ gastosCaja: "" }), foto: {}, fechaActual: "2026-10-26" }), /cuánto salió de caja/i);
  assert.match(validarCorteRecibidoDireccion({ formulario: formulario({ gastosCaja: "50" }), foto: {}, fechaActual: "2026-10-26" }), /en qué se usaron/i);
  assert.equal(validarCorteRecibidoDireccion({ formulario: formulario({ gastosCaja: "50", detalleGastosCaja: "Pago de agua a proveedor local" }), foto: {}, fechaActual: "2026-10-26" }), "");
});

test("conserva responsable original, capturista, evidencia y motivo por separado", () => {
  const datos = construirCorteRecibidoDireccion({
    formulario: formulario(),
    empleado: { id: "katy", nombre: "KATY" },
    capturadoPor: "Mónica Jiménez",
    evidencia: { archivoPath: "foto.jpg", archivoUrl: "https://ejemplo/foto.jpg" },
    capturadoEn: "2026-10-26T20:15:00.000Z",
  });
  assert.equal(datos.responsableCierre, "KATY");
  assert.equal(datos.capturadoPorDireccion, "Mónica Jiménez");
  assert.equal(datos.registroFueraDeFlujo, true);
  assert.equal(datos.fuenteCaptura, "WHATSAPP");
  assert.equal(datos.fotoCortePath, "foto.jpg");
  assert.equal(datos.motivoRegistroTardio, "SIN_ACCESO");
  assert.equal(datos.turnoCaja, "MATUTINO");
  assert.equal(datos.turnoCajaNombre, "Mañana");
});
