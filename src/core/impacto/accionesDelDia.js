/*
 * "Qué hacer hoy, ordenado por dinero".
 * Junta traspasos, compras y abonos a deuda en una sola lista con el
 * mismo criterio del motor de impacto. Módulo puro.
 */
import {
  ESTADOS_IMPACTO,
  calcularImpactoPagoDeuda,
  priorizarAcciones,
  resumirImpacto,
} from "./motorImpactoDinero.js";

const ESTADOS_DEUDA_ABIERTA = new Set(["ACTIVA", "REESTRUCTURADA"]);
export const ABONO_REFERENCIA = 10000;

function numero(valor) {
  if (valor === null || valor === undefined || valor === "") return null;
  const convertido = Number(valor);
  return Number.isFinite(convertido) ? convertido : null;
}

function dinero(valor) {
  return new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency: "MXN",
    maximumFractionDigits: 0,
  }).format(Number(valor) || 0);
}

export function accionesDeTraspasos(recomendaciones = []) {
  return (recomendaciones || [])
    .filter((recomendacion) => recomendacion?.impactoDinero)
    .map((recomendacion) => ({
      id: `traspaso:${recomendacion.codigo || recomendacion.productId}:${recomendacion.branchOrigenId}:${recomendacion.branchDestinoId}`,
      tipo: "traspaso",
      area: "compraMaestra",
      titulo: `Traspasar ${recomendacion.cantidadSugerida} ${recomendacion.producto || "piezas"}`,
      detalle: `${recomendacion.sucursalOrigen || "Origen"} → ${recomendacion.sucursalDestino || "Destino"}`,
      // Misma mercancía del mismo origen hacia varios destinos: opciones
      // excluyentes, el resumen solo suma la mejor.
      grupoExclusivo: `traspaso:${recomendacion.codigo || recomendacion.productId}:${recomendacion.branchOrigenId}`,
      impacto: recomendacion.impactoDinero,
    }));
}

export function accionesDeCompras(productos = [], limite = 3) {
  return (productos || [])
    .filter((producto) => producto?.impactoDinero && producto.impactoDinero.ganancia > 0)
    .sort((a, b) => (b.impactoDinero.ganancia ?? 0) - (a.impactoDinero.ganancia ?? 0))
    .slice(0, limite)
    .map((producto) => ({
      id: `compra:${producto.llave ?? producto.codigo}`,
      tipo: "compra",
      area: "compraMaestra",
      titulo: `Comprar ${producto.impactoDinero.unidadesRecomendadas ?? producto.compraTotal} ${producto.descripcion || "piezas"}`,
      detalle: `Inviertes ${dinero(producto.impactoDinero.inversion)}`,
      impacto: producto.impactoDinero,
    }));
}

/*
 * Método avalancha: abonar primero a la deuda con la tasa más alta.
 * Como el dinero para abonar no está confirmado, la acción queda en
 * "requiere_liquidez" y se expresa por cada abono de referencia.
 */
export function accionesDeDeudas(deudas = [], abonoReferencia = ABONO_REFERENCIA) {
  const abiertas = (deudas || []).filter((deuda) =>
    ESTADOS_DEUDA_ABIERTA.has(String(deuda?.estado || "").trim().toUpperCase())
  );
  if (!abiertas.length) return [];

  const conTasa = abiertas
    .map((deuda) => ({ deuda, saldo: numero(deuda.saldo_actual), tasa: numero(deuda.tasa_anual) }))
    .filter((item) => item.saldo > 0 && item.tasa !== null && item.tasa > 0)
    .sort((a, b) => b.tasa - a.tasa);

  const acciones = [];
  const principal = conTasa[0];
  if (principal) {
    const monto = Math.min(abonoReferencia, principal.saldo);
    const impacto = calcularImpactoPagoDeuda({
      saldo: principal.saldo,
      monto,
      tasaAnual: principal.tasa / 100, // tasa_anual se guarda en porcentaje
      diasAnticipo: 30,
    });
    acciones.push({
      id: `deuda:${principal.deuda.id || principal.deuda.nombre}`,
      tipo: "pago_deuda",
      area: "finanzas",
      titulo: `Abonar primero a ${principal.deuda.nombre || principal.deuda.acreedor || "la deuda más cara"}`,
      detalle: `Tasa ${principal.tasa}% anual · cada ${dinero(monto)} abonados ahorra intereses al mes`,
      impacto: {
        ...impacto,
        estado:
          impacto.estado === ESTADOS_IMPACTO.ESTIMADO
            ? ESTADOS_IMPACTO.REQUIERE_LIQUIDEZ
            : impacto.estado,
        faltantes: [...(impacto.faltantes || []), "dinero confirmado para abonar"],
      },
    });
  }

  const sinTasa = abiertas.filter((deuda) => numero(deuda.tasa_anual) === null);
  if (sinTasa.length) {
    acciones.push({
      id: "deuda:sin-tasa",
      tipo: "pago_deuda",
      area: "finanzas",
      titulo: `Capturar la tasa de ${sinTasa.length} deuda(s)`,
      detalle: "Sin tasa no se puede saber cuál conviene pagar primero",
      impacto: {
        tipo: "pago_deuda",
        estado: ESTADOS_IMPACTO.FALTAN_DATOS,
        ganancia: null,
        ahorro: null,
        faltantes: sinTasa.map((deuda) => `tasa de ${deuda.nombre || deuda.acreedor || "deuda"}`),
        supuestos: [],
      },
    });
  }
  return acciones;
}

export function construirAccionesDelDia({
  traspasos = [],
  productosCompra = [],
  deudas = [],
  limite = 5,
} = {}) {
  const todas = priorizarAcciones([
    ...accionesDeTraspasos(traspasos),
    ...accionesDeCompras(productosCompra),
    ...accionesDeDeudas(deudas),
  ]).filter((accion) => accion.impacto.estado !== ESTADOS_IMPACTO.NO_CONVIENE);

  // Los totales "listos" excluyen lo que espera dinero o datos.
  const resumen = resumirImpacto(todas);
  // Lo que espera dinero no se ejecuta solo: se resume aparte, con el
  // mismo criterio (sin ceros falsos y sin sumar alternativas).
  const porConfirmar = resumirImpacto(
    todas
      .filter((accion) => accion.impacto.estado === ESTADOS_IMPACTO.REQUIERE_LIQUIDEZ)
      .map((accion) => ({ ...accion, impacto: { ...accion.impacto, estado: ESTADOS_IMPACTO.ESTIMADO } }))
  );

  return {
    principales: todas.slice(0, limite),
    totalAcciones: todas.length,
    resumen: {
      ...resumen,
      gananciaPorConfirmarDinero: porConfirmar.ganancia,
    },
  };
}
