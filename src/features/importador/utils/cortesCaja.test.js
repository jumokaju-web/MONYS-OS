import test from "node:test";
import assert from "node:assert/strict";
import { detectarReporte } from "./detectorReportes.js";
import { normalizarCortesCaja } from "./normalizador.js";
import { resumirCortesCajaSicar } from "../../finanzas/utils/cortesCajaSicar.js";

const encabezado = ["Fecha", "", "Hora", "", "Caja", "", "", "Usuario", "", "Calculado", "", "", "", "Contado", "", "", "", "Diferencia", "", "", "", "", "Retirado"];

test("detecta el reporte de cortes antes de confundirlo con movimientos", () => {
  assert.equal(detectarReporte(encabezado), "Cortes de caja");
});

test("normaliza cortes agrupados y separa el cheque negativo de la diferencia real", () => {
  const filas = [
    encabezado,
    [46314.833055555355, "", 46314.833055555355, "", "Caja 1", "", "", "admin", "", "-$ 70,277.92", "", "", "", "$ 8,096.67", "", "", "", "$ 78,374.59", "", "", "", "", "$ 8,096.67"],
    ["", "", "", "", "", "Efectivo", "", "", "", "", "$ 5,897.41", "", "", "", "$ 5,910.00", "", "", "", "$ 12.59", "", "", "", "", "$ 5,910.00"],
    ["", "", "", "", "", "Cheque", "", "", "", "", "-$ 78,362.00", "", "", "", "$ 0.00", "", "", "", "$ 78,362.00", "", "", "", "", "$ 0.00"],
    ["", "", "", "", "", "Tarjeta", "", "", "", "", "$ 2,186.67", "", "", "", "$ 2,186.67", "", "", "", "$ 0.00", "", "", "", "", "$ 2,186.67"],
  ];
  const [corte] = normalizarCortesCaja(filas, { periodoInicio: "2026-10-19", periodoFin: "2026-10-23" });

  assert.equal(corte.fecha, "2026-10-19");
  assert.equal(corte.hora, "19:59:36");
  assert.equal(corte.contado, 8096.67);
  assert.equal(corte.diferenciaReportada, 78374.59);
  assert.equal(corte.diferenciaOperativa, 12.59);
  assert.equal(corte.alertas.length, 1);
  assert.equal(corte.alertas[0].tipo, "CHEQUE_NEGATIVO_SICAR");
  assert.equal(corte.desgloseContadoCoincide, true);
  assert.equal(corte.periodoFin, "2026-10-23");
  const resumen = resumirCortesCajaSicar([corte]);
  assert.deepEqual(resumen.faltantesPorSucursal.map((item) => item.fecha), ["2026-10-20", "2026-10-21", "2026-10-22", "2026-10-23"]);
});

test("conserva ausencias como null y resume únicamente valores disponibles", () => {
  const filas = [
    encabezado,
    ["20/10/2026", "", "08:00", "", "Caja 2", "", "", "sucursal", "", "100", "", "", "", "", "", "", "", "", "", "", "", "", ""],
  ];
  const cortes = normalizarCortesCaja(filas);
  const resumen = resumirCortesCajaSicar(cortes);

  assert.equal(cortes[0].contado, null);
  assert.equal(cortes[0].diferenciaOperativa, null);
  assert.equal(resumen.totalContado, null);
  assert.equal(resumen.diferenciaOperativa, null);
});
