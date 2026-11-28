import test from "node:test";
import assert from "node:assert/strict";
import {
  accionesDeCompras,
  accionesDeDeudas,
  construirAccionesDelDia,
} from "../../src/core/impacto/accionesDelDia.js";
import {
  ESTADOS_IMPACTO,
  calcularImpactoCompra,
  calcularImpactoTraspaso,
} from "../../src/core/impacto/motorImpactoDinero.js";
import { filtrarPorContexto } from "../../src/features/dashboard/services/accionesDelDiaFiltro.js";

const traspaso = (codigo, utilidad, destino = "B") => ({
  codigo,
  producto: `Producto ${codigo}`,
  cantidadSugerida: 10,
  branchOrigenId: "A",
  branchDestinoId: destino,
  sucursalOrigen: "Centro",
  sucursalDestino: destino === "B" ? "Nueva" : "Otra",
  impactoDinero: calcularImpactoTraspaso({
    cantidad: 10, utilidadUnitaria: utilidad, costoUnitario: 50, ventaDiariaDestino: 1,
    existenciaDestino: 0, ventaDiariaOrigen: 0, existenciaOrigen: 30, costoTraslado: 0,
  }),
});

const compra = (llave, unidades, costo, precio, ventaDiaria = 2) => ({
  llave,
  descripcion: `Compra ${llave}`,
  compraTotal: unidades,
  sucursales: [{ branchId: "A" }],
  impactoDinero: calcularImpactoCompra({ unidades, costoUnitario: costo, precioVenta: precio, ventaDiariaEstimada: ventaDiaria, diasTemporada: 30 }),
});

test("primero lo que no requiere compra, luego lo que espera dinero", () => {
  const datos = construirAccionesDelDia({
    traspasos: [traspaso("T1", 30), traspaso("PIERDE", -5)],
    productosCompra: [compra("C1", 40, 50, 150), compra("C2", 10, 10, 20)],
    deudas: [
      { id: "d1", nombre: "Tarjeta", saldo_actual: 30000, tasa_anual: 60, estado: "ACTIVA" },
      { id: "d2", nombre: "Banco", saldo_actual: 80000, tasa_anual: 18, estado: "ACTIVA" },
    ],
  });

  const ids = datos.principales.map((accion) => accion.id);
  assert.equal(ids[0], "traspaso:T1:A:B");
  assert.deepEqual(ids.slice(1, 3), ["compra:C1", "deuda:d1"]);
  assert.ok(!ids.some((id) => id.includes("PIERDE")));
  assert.equal(datos.resumen.ganancia, 300);
  const interes = Math.round(10000 * 0.6 * (30 / 365) * 100) / 100;
  assert.equal(datos.resumen.gananciaPorConfirmarDinero, Math.round((4000 + 100 + interes) * 100) / 100);
  assert.equal(datos.principales[2].prioridadDefinitiva, true);
  assert.equal(datos.principales[2].titulo, "Abonar primero a Tarjeta");
});

test("la cantidad de compra mostrada coincide con la de inversión y ganancia", () => {
  // 100 piezas, se venden 2 diarias × 30 = 60: inversión de las 100.
  const [accion] = accionesDeCompras([compra("C", 100, 50, 150)]);
  assert.match(accion.titulo, /^Comprar 100 /);
  assert.equal(accion.impacto.inversion, 5000);
  assert.match(accion.detalle, /se venden 60/);
});

test("alternativas de la misma mercancía se marcan y no se suman", () => {
  const datos = construirAccionesDelDia({ traspasos: [traspaso("T1", 20, "C"), traspaso("T1", 30)] });
  assert.equal(datos.alternativas, 1);
  const [principal, alternativa] = datos.principales;
  assert.equal(principal.id, "traspaso:T1:A:B");
  assert.equal(principal.alternativaDe, undefined);
  assert.equal(alternativa.alternativaDe, "traspaso:T1:A:B");
  assert.match(alternativa.alternativaDeTitulo, /Nueva/);
  assert.equal(datos.resumen.ganancia, 300);
});

test("avalancha: sin todas las tasas la prioridad no es definitiva", () => {
  const acciones = accionesDeDeudas([
    { id: "baja", nombre: "Banco", saldo_actual: 50000, tasa_anual: 20, estado: "ACTIVA" },
    { id: "alta", nombre: "Tarjeta", saldo_actual: 4000, tasa_anual: 70, estado: "REESTRUCTURADA" },
    { id: "cerrada", nombre: "Viejo", saldo_actual: 1000, tasa_anual: 99, estado: "LIQUIDADA" },
    { id: "x", nombre: "Proveedor", saldo_actual: 9000, tasa_anual: "", estado: "ACTIVA" },
  ]);
  const [principal, sinTasa] = acciones;
  assert.equal(principal.id, "deuda:alta");
  assert.equal(principal.prioridadDefinitiva, false);
  assert.match(principal.titulo, /más cara de las deudas con tasa/);
  assert.match(principal.detalle, /abono hipotético de \$4,000 por 30 días/);
  assert.ok(principal.impacto.faltantes.some((texto) => texto.includes("tasas de 1 deuda")));
  assert.ok(principal.impacto.supuestos.some((texto) => texto.includes("penalizaciones")));
  assert.equal(principal.impacto.estado, ESTADOS_IMPACTO.REQUIERE_LIQUIDEZ);
  assert.equal(principal.impacto.ahorro, Math.round(4000 * 0.7 * (30 / 365) * 100) / 100);
  assert.equal(sinTasa.id, "deuda:sin-tasa");
  assert.equal(sinTasa.impacto.estado, ESTADOS_IMPACTO.FALTAN_DATOS);
});

test("sin datos no hay acciones ni totales inventados", () => {
  const datos = construirAccionesDelDia({});
  assert.equal(datos.totalAcciones, 0);
  assert.equal(datos.resumen.ganancia, null);
  assert.equal(datos.resumen.gananciaPorConfirmarDinero, null);
  assert.deepEqual(datos.resumen.cobertura, { calculables: 0, total: 0 });
});

test("aislamiento: descarta lo que no pertenece al negocio activo", () => {
  const resultado = filtrarPorContexto({
    organizationId: "org-1",
    businessId: "neg-1",
    sucursales: [
      { id: "A", business_id: "neg-1", active: true },
      { id: "B", business_id: "neg-1", active: true },
      { id: "Z", business_id: "neg-2", active: true },
    ],
    compraMaestra: {
      // Las fuentes de Compra Maestra dicen que Z es del negocio, pero no se les cree.
      fuentes: [{ branchId: "A" }, { branchId: "B" }, { branchId: "Z" }],
      planTraspasos: [traspaso("OK", 30), { ...traspaso("FUERA", 30), branchDestinoId: "Z" }],
      productos: [compra("OK", 10, 10, 20), { ...compra("FUERA", 10, 10, 20), sucursales: [{ branchId: "Z" }] }],
    },
    deudas: [
      { id: "1", organization_id: "org-1", business_id: "neg-1" },
      { id: "2", organization_id: "org-1", business_id: "neg-2" },
      { id: "3", organization_id: "org-2", business_id: "neg-1" },
    ],
  });
  assert.deepEqual(resultado.traspasos.map((item) => item.codigo), ["OK"]);
  assert.deepEqual(resultado.productos.map((item) => item.llave), ["OK"]);
  assert.deepEqual(resultado.deudas.map((item) => item.id), ["1"]);
  assert.equal(resultado.descartados, 4);
});

test("aislamiento: rechaza identificadores ausentes y sucursales inactivas", () => {
  const resultado = filtrarPorContexto({
    organizationId: "org-1",
    businessId: "neg-1",
    sucursales: [
      { id: "A", business_id: "neg-1", active: true },
      { id: "", business_id: "neg-1", active: true },
      { id: "C", business_id: "neg-1", active: false },
    ],
    compraMaestra: {
      planTraspasos: [
        { ...traspaso("SINID", 30), branchOrigenId: null, branchDestinoId: "A" },
        { ...traspaso("VACIO", 30), branchOrigenId: "A", branchDestinoId: "" },
        { ...traspaso("INACTIVA", 30), branchOrigenId: "A", branchDestinoId: "C" },
      ],
      productos: [{ ...compra("SINSUC", 1, 1, 2), sucursales: [] }],
    },
    deudas: [{ id: "x", organization_id: "org-1", business_id: null }],
  });
  assert.equal(resultado.sucursalesAutorizadas, 1);
  assert.equal(resultado.traspasos.length, 0);
  assert.equal(resultado.productos.length, 0);
  assert.equal(resultado.deudas.length, 0);
  assert.equal(resultado.descartados, 5);
});

test("aislamiento: sin negocio activo no autoriza ninguna sucursal", () => {
  const resultado = filtrarPorContexto({
    organizationId: "org-1",
    businessId: "",
    sucursales: [{ id: "A", business_id: "", active: true }],
    compraMaestra: { planTraspasos: [traspaso("OK", 30)] },
  });
  assert.equal(resultado.sucursalesAutorizadas, 0);
  assert.equal(resultado.traspasos.length, 0);
});
