import { validarEstadoBancario } from "./validarEstadoBancario.js";

const MESES = { ENE: "01", FEB: "02", MAR: "03", ABR: "04", MAY: "05", JUN: "06", JUL: "07", AGO: "08", SEP: "09", OCT: "10", NOV: "11", DIC: "12" };
const dinero = /\d[\d,]*\.\d{2}/g;
const fechasBbva = /\b(\d{2})\/([A-Z]{3})\b/g;
const dineroNumero = (texto) => {
  const valor = Number(String(texto).replaceAll(",", ""));
  if (!Number.isFinite(valor)) throw new Error("El estado BBVA contiene un importe que no se pudo leer.");
  return Math.round(valor * 100);
};
const isoFecha = (dia, mes, anio) => `${anio}-${MESES[mes] || "00"}-${dia}`;
const formato = (centavos) => (centavos / 100).toFixed(2);

function extraerImporteResumen(texto, patron, etiqueta) {
  const coincidencia = texto.match(patron);
  if (!coincidencia) throw new Error(`Falta “${etiqueta}” en el resumen del estado de cuenta.`);
  return dineroNumero(coincidencia[1]);
}

function obtenerColumnas(lineas) {
  const candidatos = lineas.filter((linea) => /DESCRIPCI[ÓO]N/i.test(linea.texto) && /CARGOS/i.test(linea.texto) && /ABONOS/i.test(linea.texto));
  for (const linea of candidatos) {
    const cargo = linea.celdas.find((celda) => /^CARGOS$/i.test(celda.texto.trim()));
    const abono = linea.celdas.find((celda) => /^ABONOS$/i.test(celda.texto.trim()));
    if (cargo && abono && abono.x > cargo.x) return { pagina: linea.pagina, cargoX: cargo.x, abonoX: abono.x };
  }
  throw new Error("No pude ubicar con seguridad las columnas Cargos y Abonos del PDF BBVA.");
}

function obtenerPeriodo(texto) {
  const periodo = texto.match(/PERIODO\s+DEL\s+(\d{2})\/(\d{2})\/(\d{4})\s+AL\s+(\d{2})\/(\d{2})\/(\d{4})/i);
  if (periodo) return { desde: `${periodo[3]}-${periodo[2]}-${periodo[1]}`, hasta: `${periodo[6]}-${periodo[5]}-${periodo[4]}` };
  const corte = texto.match(/FECHA\s+DE\s+CORTE\s+(\d{2})\/(\d{2})\/(\d{4})/i);
  if (!corte) throw new Error("No pude identificar el periodo mensual del estado de cuenta.");
  return { desde: `${corte[3]}-${corte[2]}-01`, hasta: `${corte[3]}-${corte[2]}-${corte[1]}` };
}

export function crearPaqueteBbva(lineas) {
  if (!Array.isArray(lineas) || lineas.length === 0) throw new Error("El estado de cuenta no contiene filas para revisar.");
  const texto = lineas.map((linea) => linea.texto).join("\n").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase();
  if (!texto.includes("BBVA")) throw new Error("El archivo no parece ser un estado de cuenta BBVA.");
  const cuentaMatch = texto.match(/NO\.\s*DE\s*CUENTA\s+(\d{10})/);
  if (!cuentaMatch) throw new Error("No pude identificar la cuenta BBVA de diez dígitos.");
  const periodo = obtenerPeriodo(texto);
  const inicial = extraerImporteResumen(texto, /SALDO\s+ANTERIOR\s+([\d,]+\.\d{2})/, "Saldo Anterior");
  const abonosResumen = extraerImporteResumen(texto, /DEPOSITOS\s*\/\s*ABONOS\s*\(\+\)\s+\d+\s+([\d,]+\.\d{2})/, "Depósitos / Abonos");
  const cargosResumen = extraerImporteResumen(texto, /RETIROS\s*\/\s*CARGOS\s*\(-\)\s+\d+\s+([\d,]+\.\d{2})/, "Retiros / Cargos");
  const final = extraerImporteResumen(texto, /SALDO\s+FINAL\s*\(\+\)\s+([\d,]+\.\d{2})/, "Saldo Final");
  const conteoAbonos = Number(texto.match(/DEPOSITOS\s*\/\s*ABONOS\s*\(\+\)\s+(\d+)\s+[\d,]+\.\d{2}/)?.[1]);
  const conteoCargos = Number(texto.match(/RETIROS\s*\/\s*CARGOS\s*\(-\)\s+(\d+)\s+[\d,]+\.\d{2}/)?.[1]);
  if (!Number.isInteger(conteoAbonos) || !Number.isInteger(conteoCargos)) throw new Error("No pude leer el número mensual de cargos y abonos del resumen.");

  const columnas = obtenerColumnas(lineas);
  const umbralCargoAbono = (columnas.cargoX + columnas.abonoX) / 2;
  const limiteAbonoSaldo = columnas.abonoX + (columnas.abonoX - columnas.cargoX) * 0.62;
  const filas = lineas.map((linea, indiceLinea) => ({ linea, indiceLinea })).filter(({ linea }) => linea.pagina >= columnas.pagina && /^\s*\d{2}\/[A-Z]{3}\s+\d{2}\/[A-Z]{3}\b/i.test(linea.texto));
  const movimientos = [];
  for (const [indice, registroFila] of filas.entries()) {
    const { linea: fila, indiceLinea } = registroFila;
    const fechas = [...fila.texto.toUpperCase().matchAll(fechasBbva)];
    const [, diaOperacion, mesOperacion] = fechas[0] || [];
    const [, diaLiquidacion, mesLiquidacion] = fechas[1] || [];
    const { desde, hasta } = periodo;
    const anio = hasta.slice(0, 4);
    const fechaOperacion = isoFecha(diaOperacion, mesOperacion, anio);
    const fechaLiquidacion = isoFecha(diaLiquidacion, mesLiquidacion, anio);
    if (!MESES[mesOperacion] || !MESES[mesLiquidacion] || fechaOperacion < desde || fechaOperacion > hasta) {
      throw new Error(`Fecha fuera de periodo o no reconocida en la página ${fila.pagina}.`);
    }
    const importes = fila.celdas.flatMap((celda) => {
      const coincidencias = [...celda.texto.matchAll(dinero)];
      return coincidencias.map((m) => ({ valor: m[0], x: celda.x }));
    }).filter((item) => item.x < limiteAbonoSaldo);
    if (importes.length !== 1) throw new Error(`No pude separar con seguridad el cargo/abono en la página ${fila.pagina}, movimiento ${indice + 1}.`);
    const importe = dineroNumero(importes[0].valor);
    const cargo = importes[0].x < umbralCargoAbono ? importe : 0;
    const abono = cargo ? 0 : importe;
    const descripcion = fila.celdas.filter((celda) => celda.x >= 54 && celda.x < columnas.cargoX).map((celda) => celda.texto.trim()).join(" ").replace(/\s+/g, " ").trim();
    const siguienteFila = filas.slice(indice + 1).find(({ linea }) => linea.pagina === fila.pagina);
    const finContinuacion = siguienteFila?.indiceLinea ?? lineas.findIndex((linea, i) => i > indiceLinea && linea.pagina !== fila.pagina);
    const referencias = lineas.slice(indiceLinea + 1, finContinuacion < 0 ? lineas.length : finContinuacion)
      .filter((linea) => linea.pagina === fila.pagina && !/BBVA MEXICO|NO\.\s*DE\s*CUENTA|PAGINA\s+\d|ESTADO DE CUENTA|FECHA\s+SALDO/i.test(linea.texto))
      .flatMap((linea) => linea.celdas.filter((celda) => celda.x >= 54 && celda.x < columnas.cargoX).map((celda) => celda.texto.trim()))
      .filter(Boolean).join(" ").replace(/\s+/g, " ").trim();
    movimientos.push({
      id: `BBVA-${cuentaMatch[1].slice(-4)}-${indice + 1}`,
      cuenta: cuentaMatch[1].slice(-4),
      fecha_operacion: fechaOperacion,
      fecha_liquidacion: fechaLiquidacion,
      descripcion: descripcion.replace(/^\d{2}\/[A-Z]{3}\s+/i, "").trim() || "Movimiento BBVA",
      referencia_visible: referencias,
      cargo: formato(cargo),
      abono: formato(abono),
      categoria: "",
      pagina_pdf: fila.pagina,
      fuente: "PDF BBVA",
    });
  }

  const cargosCalculados = movimientos.reduce((suma, movimiento) => suma + dineroNumero(movimiento.cargo), 0);
  const abonosCalculados = movimientos.reduce((suma, movimiento) => suma + dineroNumero(movimiento.abono), 0);
  if (movimientos.length !== conteoCargos + conteoAbonos || cargosCalculados !== cargosResumen || abonosCalculados !== abonosResumen) {
    throw new Error(`El PDF no cuadra: detecté ${movimientos.length} movimientos; el banco reporta ${conteoCargos + conteoAbonos}. Revisa las páginas o el formato.`);
  }
  if (inicial + abonosCalculados - cargosCalculados !== final) throw new Error("Los saldos inicial, final, cargos y abonos del PDF no cuadran. No se cargaron movimientos.");
  const paquete = {
    version: 1,
    cuentas: [{ terminacion: cuentaMatch[1].slice(-4), desde: periodo.desde, hasta: periodo.hasta, inicial: formato(inicial), cargos: formato(cargosCalculados), abonos: formato(abonosCalculados), final: formato(final), movimientos: movimientos.length }],
    movimientos,
  };
  validarEstadoBancario(paquete);
  return { paquete, resumen: { movimientos: movimientos.length, cargos: formato(cargosCalculados), abonos: formato(abonosCalculados), saldoInicial: formato(inicial), saldoFinal: formato(final) } };
}
