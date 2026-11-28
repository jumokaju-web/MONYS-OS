/*
 * "Qué hacer hoy, ordenado por dinero".
 * Junta traspasos, compras y abonos a deuda en una sola lista con el
 * mismo criterio del motor de impacto. Módulo puro.
 *
 * Reglas:
 * - Nada se presenta como "listo": todo es una propuesta por revisar.
 * - Alternativas excluyentes (misma mercancía del mismo origen hacia
 *   varios destinos) se marcan: solo la mejor es principal; las demás
 *   llevan alternativaDe y no se suman.
 * - La deuda "más cara" solo es definitiva si todas las deudas abiertas
 *   tienen tasa; si no, se dice que es la más cara entre las conocidas.
 */
import {
  ESTADOS_IMPACTO,
  calcularImpactoPagoDeuda,
  priorizarAcciones,
  resumirImpacto,
} from "./motorImpactoDinero.js";

const ESTADOS_DEUDA_ABIERTA = new Set(["ACTIVA", "REESTRUCTURADA"]);
export const ABONO_REFERENCIA = 10000;
export const DIAS_ABONO_REFERENCIA = 30;

function numero(valor) {
  if (valor === null || valor === undefined || typeof valor === "boolean") return null;
  if (typeof valor === "string" && !valor.trim()) return null;
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
      grupoExclusivo: `traspaso:${recomendacion.codigo || recomendacion.productId}:${recomendacion.branchOrigenId}`,
      impacto: recomendacion.impactoDinero,
    }));
}

/*
 * La cantidad del título es la misma con la que se calcularon inversión
 * y ganancia (compraTotal). Si al ritmo actual no se vende todo, se
 * avisa en el detalle en lugar de cambiar la cantidad.
 */
export function accionesDeCompras(productos = [], limite = 3) {
  return (productos || [])
    .filter((producto) => producto?.impactoDinero && producto.impactoDinero.ganancia > 0)
    .sort((a, b) => (b.impactoDinero.ganancia ?? 0) - (a.impactoDinero.ganancia ?? 0))
    .slice(0, limite)
    .map((producto) => {
      const impacto = producto.impactoDinero;
      const vendibles = impacto.unidadesRecomendadas;
      const sobra = Number.isFinite(vendibles) && vendibles < producto.compraTotal;
      return {
        id: `compra:${producto.llave ?? producto.codigo}`,
        tipo: "compra",
        area: "compraMaestra",
        titulo: `Comprar ${producto.compraTotal} ${producto.descripcion || "piezas"}`,
        detalle: `Inviertes ${dinero(impacto.inversion)}${
          sobra ? ` · al ritmo actual se venden ${vendibles} en el periodo` : ""
        }`,
        impacto,
      };
    });
}

/*
 * Método avalancha: abonar primero a la deuda con la tasa más alta.
 * El abono es hipotético (ABONO_REFERENCIA por DIAS_ABONO_REFERENCIA
 * días), no considera comisiones por pago anticipado y queda en
 * "requiere_liquidez" porque el dinero no está confirmado.
 */
export function accionesDeDeudas(
  deudas = [],
  { abonoReferencia = ABONO_REFERENCIA, dias = DIAS_ABONO_REFERENCIA } = {}
) {
  const abiertas = (deudas || []).filter((deuda) =>
    ESTADOS_DEUDA_ABIERTA.has(String(deuda?.estado || "").trim().toUpperCase())
  );
  if (!abiertas.length) return [];

  const conTasa = abiertas
    .map((deuda) => ({ deuda, saldo: numero(deuda.saldo_actual), tasa: numero(deuda.tasa_anual) }))
    .filter((item) => item.saldo > 0 && item.tasa !== null && item.tasa >= 0)
    .sort((a, b) => b.tasa - a.tasa);
  const sinTasa = abiertas.filter((deuda) => {
    const tasa = numero(deuda.tasa_anual);
    return tasa === null || tasa < 0;
  });

  const acciones = [];
  const principal = conTasa[0];
  if (principal && principal.tasa > 0) {
    const definitiva = sinTasa.length === 0;
    const nombre = principal.deuda.nombre || principal.deuda.acreedor || "la deuda más cara";
    const monto = Math.min(abonoReferencia, principal.saldo);
    const impacto = calcularImpactoPagoDeuda({
      saldo: principal.saldo,
      monto,
      tasaAnual: principal.tasa / 100, // tasa_anual se guarda en porcentaje
      diasAnticipo: dias,
    });
    acciones.push({
      id: `deuda:${principal.deuda.id || nombre}`,
      tipo: "pago_deuda",
      area: "finanzas",
      prioridadDefinitiva: definitiva,
      titulo: definitiva
        ? `Abonar primero a ${nombre}`
        : `${nombre}: la más cara de las deudas con tasa`,
      detalle: `Tasa ${principal.tasa}% anual · abono hipotético de ${dinero(monto)} por ${dias} días`,
      impacto: {
        ...impacto,
        estado:
          impacto.estado === ESTADOS_IMPACTO.ESTIMADO
            ? ESTADOS_IMPACTO.REQUIERE_LIQUIDEZ
            : impacto.estado,
        faltantes: [
          ...(impacto.faltantes || []),
          "dinero confirmado para abonar",
          ...(definitiva ? [] : [`tasas de ${sinTasa.length} deuda(s) para confirmar cuál conviene primero`]),
        ],
        supuestos: [
          ...(impacto.supuestos || []),
          "No considera comisiones ni penalizaciones por pago anticipado.",
        ],
      },
    });
  }

  if (sinTasa.length) {
    acciones.push({
      id: "deuda:sin-tasa",
      tipo: "pago_deuda",
      area: "finanzas",
      titulo: `Capturar la tasa de ${sinTasa.length} deuda(s)`,
      detalle: "Sin todas las tasas no se puede confirmar cuál conviene pagar primero",
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

/*
 * Marca alternativas: en cada grupoExclusivo la acción con más ganancia
 * es la principal; las demás llevan alternativaDe = id de la principal.
 */
function marcarAlternativas(acciones) {
  const mejor = new Map();
  for (const accion of acciones) {
    if (!accion.grupoExclusivo) continue;
    const actual = mejor.get(accion.grupoExclusivo);
    if (!actual || (accion.impacto.ganancia ?? -Infinity) > (actual.impacto.ganancia ?? -Infinity)) {
      mejor.set(accion.grupoExclusivo, accion);
    }
  }
  return acciones.map((accion) => {
    const principal = accion.grupoExclusivo ? mejor.get(accion.grupoExclusivo) : null;
    return principal && principal !== accion
      ? { ...accion, alternativaDe: principal.id, alternativaDeTitulo: `${principal.titulo} (${principal.detalle})` }
      : accion;
  });
}

export function construirAccionesDelDia({
  traspasos = [],
  productosCompra = [],
  deudas = [],
  limite = 5,
} = {}) {
  const todas = marcarAlternativas(
    priorizarAcciones([
      ...accionesDeTraspasos(traspasos),
      ...accionesDeCompras(productosCompra),
      ...accionesDeDeudas(deudas),
    ]).filter((accion) => accion.impacto.estado !== ESTADOS_IMPACTO.NO_CONVIENE)
  );

  // Las alternativas van después de las principales.
  const principalesPrimero = [
    ...todas.filter((accion) => !accion.alternativaDe),
    ...todas.filter((accion) => accion.alternativaDe),
  ];

  const resumen = resumirImpacto(todas);
  // Lo que espera dinero se resume aparte, con el mismo criterio.
  const porConfirmar = resumirImpacto(
    todas
      .filter((accion) => accion.impacto.estado === ESTADOS_IMPACTO.REQUIERE_LIQUIDEZ)
      .map((accion) => ({ ...accion, impacto: { ...accion.impacto, estado: ESTADOS_IMPACTO.ESTIMADO } }))
  );

  return {
    principales: principalesPrimero.slice(0, limite),
    totalAcciones: todas.length,
    alternativas: todas.filter((accion) => accion.alternativaDe).length,
    resumen: {
      ...resumen,
      gananciaPorConfirmarDinero: porConfirmar.ganancia,
    },
  };
}
