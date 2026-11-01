import test from "node:test";
import assert from "node:assert/strict";
import {
  crearObservacionesAperturaCaja,
  crearObservacionesCorte,
  extraerCapturasFinancieras,
} from "../../inteligencia/utils/capturasFinancierasEquipo.js";
import { resumirCierreDiarioDireccion } from "./cierreDiarioDireccion.js";

const FECHA = "2026-11-01";

function apertura({ id, branchId, sesionCajaId, cajaId = "CAJA_1", responsable }) {
  return {
    id,
    branch_id: branchId,
    fecha: FECHA,
    created_at: `${FECHA}T15:00:00.000Z`,
    observaciones: crearObservacionesAperturaCaja({
      sesionCajaId,
      cajaId,
      cajaNombre: cajaId === "CAJA_2" ? "Caja 2" : "Caja 1",
      responsable,
      abiertoEn: `${FECHA}T15:00:00.000Z`,
    }),
  };
}

function corte({ id, branchId, sesionCajaId, cajaId = "CAJA_1", responsable, hora = "20:00:00.000Z" }) {
  return {
    id,
    branch_id: branchId,
    fecha: FECHA,
    turno: "cierre_caja",
    responsable,
    created_at: `${FECHA}T${hora}`,
    observaciones: crearObservacionesCorte({
      sesionCajaId,
      cajaId,
      cajaNombre: cajaId === "CAJA_2" ? "Caja 2" : "Caja 1",
      turnoCaja: "MATUTINO",
      ventaSicar: 100,
      efectivoVentas: 100,
      tarjeta: 0,
      transferencias: 0,
      otrosCobros: 0,
      fondoInicial: 1000,
      gastosCaja: 0,
      efectivoEntregado: 0,
      efectivoFinal: 1100,
      movimientosCaja: [],
    }),
  };
}

test("General Anaya espera un solo corte cuando una empleada conserva la caja", () => {
  const cierres = [
    apertura({ id: "a1", branchId: "anaya", sesionCajaId: "anaya-yessi", responsable: "Yessi" }),
    corte({ id: "c1", branchId: "anaya", sesionCajaId: "anaya-yessi", responsable: "Yessi" }),
  ];
  const resumen = resumirCierreDiarioDireccion({
    cierres,
    capturas: extraerCapturasFinancieras(cierres),
    sucursales: [{ id: "anaya", nombre: "General Anaya" }],
    fecha: FECHA,
  });

  assert.equal(resumen.cajasEsperadas, 1);
  assert.equal(resumen.cajasCompletas, 1);
  assert.equal(resumen.cajasFaltantes, 0);
  assert.equal(resumen.sucursales[0].cajas[0].responsable, "Yessi");
});

test("Centro cuenta cada relevo real de Caja 1 y Caja 2 sin una meta fija", () => {
  const cierres = [
    apertura({ id: "a1", branchId: "centro", sesionCajaId: "c1-karla", cajaId: "CAJA_1", responsable: "Karla" }),
    corte({ id: "c1", branchId: "centro", sesionCajaId: "c1-karla", cajaId: "CAJA_1", responsable: "Karla", hora: "18:00:00.000Z" }),
    apertura({ id: "a2", branchId: "centro", sesionCajaId: "c1-vita", cajaId: "CAJA_1", responsable: "Vita" }),
    apertura({ id: "a3", branchId: "centro", sesionCajaId: "c2-yessi", cajaId: "CAJA_2", responsable: "Yessi" }),
    corte({ id: "c2", branchId: "centro", sesionCajaId: "c2-yessi", cajaId: "CAJA_2", responsable: "Yessi", hora: "19:00:00.000Z" }),
  ];
  const resumen = resumirCierreDiarioDireccion({
    cierres,
    capturas: extraerCapturasFinancieras(cierres),
    sucursales: [{ id: "centro", nombre: "Centro" }],
    fecha: FECHA,
  });

  assert.equal(resumen.cajasEsperadas, 3);
  assert.equal(resumen.cajasCompletas, 2);
  assert.equal(resumen.cajasFaltantes, 1);
  assert.deepEqual(
    resumen.sucursales[0].cajas.map((caja) => caja.responsable).sort(),
    ["Karla", "Vita", "Yessi"]
  );
  assert.equal(resumen.sucursales[0].cajas.find((caja) => caja.responsable === "Vita").estado, "faltante");
});

test("una sucursal sin aperturas no recibe cortes esperados inventados", () => {
  const resumen = resumirCierreDiarioDireccion({
    capturas: [],
    cierres: [],
    sucursales: [{ id: "centro", nombre: "Centro" }, { id: "anaya", nombre: "General Anaya" }],
    fecha: FECHA,
  });

  assert.equal(resumen.cajasEsperadas, 0);
  assert.equal(resumen.cajasFaltantes, 0);
  assert.deepEqual(resumen.sucursales.map((sucursal) => sucursal.cajas.length), [0, 0]);
});
