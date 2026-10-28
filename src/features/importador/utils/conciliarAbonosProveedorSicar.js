import { normalizarFechaSicar } from "./periodoSicar.js";
import { normalizarHoraSicar } from "./normalizador.js";

const limpiar = (valor) => String(valor ?? "").trim().toLocaleLowerCase("es-MX").normalize("NFD").replace(/[\u0300-\u036f]/g, "");
const centavos = (valor) => Number.isFinite(Number(valor)) ? Math.round(Number(valor) * 100) : 0;

function firmaSicar(fila, { proveedor = false } = {}) {
  const datos = fila?.datos_originales || fila || {};
  const fechaOriginal = datos.fecha;
  const fecha = normalizarFechaSicar(fechaOriginal);
  const hora = normalizarHoraSicar(proveedor ? datos.hora : (datos.hora ?? fechaOriginal));
  const tipo = String(datos.tipoMovimiento || datos.tipo || "").trim().toUpperCase();
  const metodo = String(datos.metodoPago || "").trim().toUpperCase();
  const caja = limpiar(datos.caja);
  const monto = centavos(datos.monto ?? datos.total);
  if (!fecha || !hora || !caja || !metodo || monto <= 0) return null;
  if (!proveedor && tipo !== "SALIDA") return null;
  return [fecha, hora, caja, metodo, monto].join("|");
}

/** Cruza contra el renglón de salida SICAR, sin editar registros ni elegir duplicados. */
export function cruzarAbonosConMovimientosSicar(abonos = [], detallesMovimiento = []) {
  const porFirma = new Map();
  for (const detalle of Array.isArray(detallesMovimiento) ? detallesMovimiento : []) {
    const firma = firmaSicar(detalle);
    if (!firma) continue;
    const lista = porFirma.get(firma) || [];
    lista.push(detalle);
    porFirma.set(firma, lista);
  }

  return (Array.isArray(abonos) ? abonos : []).map((abono) => {
    const firma = firmaSicar(abono, { proveedor: true });
    const candidatos = firma ? porFirma.get(firma) || [] : [];
    return {
      ...abono,
      estadoCruce: candidatos.length === 1
        ? "COINCIDENCIA_UNICA"
        : candidatos.length > 1
          ? "AMBIGUA"
          : "SIN_COINCIDENCIA",
      coincidencias: candidatos,
    };
  });
}

export function resumirAbonosProveedores(abonos = []) {
  const filas = Array.isArray(abonos) ? abonos : [];
  const proveedores = new Map();
  const metodos = new Map();
  let totalCentavos = 0;
  for (const abono of filas) {
    const importe = centavos(abono?.monto ?? abono?.total);
    totalCentavos += importe;
    const proveedor = String(abono?.proveedorNombre || "Proveedor no identificado").trim();
    proveedores.set(proveedor, (proveedores.get(proveedor) || 0) + importe);
    const metodo = String(abono?.metodoPago || "Sin método").trim().toUpperCase();
    const resumenMetodo = metodos.get(metodo) || { metodo, cantidad: 0, totalCentavos: 0 };
    resumenMetodo.cantidad += 1;
    resumenMetodo.totalCentavos += importe;
    metodos.set(metodo, resumenMetodo);
  }
  return {
    cantidad: filas.length,
    total: totalCentavos / 100,
    porProveedor: [...proveedores].map(([nombre, total]) => ({ nombre, total: total / 100 })),
    porMetodo: [...metodos.values()].map(({ metodo, cantidad, totalCentavos: total }) => ({ metodo, cantidad, total: total / 100 })),
  };
}

/** Marca coincidencias económicas plausibles en Tesorería para revisión, nunca como duplicados confirmados. */
export function detectarPosiblesDuplicadosAbono(abonos = [], movimientos = []) {
  return (Array.isArray(abonos) ? abonos : []).map((abono) => {
    const fecha = normalizarFechaSicar(abono?.fecha);
    const importe = centavos(abono?.monto ?? abono?.total);
    const tokensProveedor = limpiar(abono?.proveedorNombre).split(/\s+/).filter((token) => token.length >= 4);
    const posiblesDuplicados = (Array.isArray(movimientos) ? movimientos : []).filter((movimiento) => {
      const tipo = String(movimiento?.movement_type || movimiento?.tipo || "").trim().toUpperCase();
      if (String(movimiento?.status || movimiento?.estado || "").trim().toLowerCase() === "cancelado") return false;
      if (tipo !== "SALIDA" || centavos(movimiento?.amount ?? movimiento?.monto) !== importe) return false;
      if (normalizarFechaSicar(movimiento?.occurred_at || movimiento?.fecha) !== fecha) return false;
      const texto = limpiar(`${movimiento?.concept || movimiento?.concepto || ""} ${movimiento?.counterparty || movimiento?.contraparte || ""}`);
      return tokensProveedor.some((token) => texto.includes(token.slice(0, 4)));
    });
    return { ...abono, posiblesDuplicados };
  });
}
