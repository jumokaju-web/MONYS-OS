import {
  ESTADOS_IMPACTO,
  calcularImpactoCompra,
} from "../../../core/impacto/motorImpactoDinero.js";

function numeroPositivo(valor) {
  const convertido = Number(valor);
  return Number.isFinite(convertido) && convertido > 0 ? convertido : null;
}

/*
 * Impacto en dinero de comprar un producto de Compra Maestra.
 * La venta diaria que le toca a la mercancía nueva es la demanda del
 * periodo menos lo que ya cubren la existencia y los traspasos.
 */
export function calcularImpactoProductoCompra(
  producto,
  { diasCobertura = 30, capitalDisponible = null } = {}
) {
  const sucursales = (producto?.sucursales || []).filter(
    (sucursal) => sucursal && sucursal.requiereRevisionInventario !== true
  );

  let demanda = 0;
  let cubierto = 0;
  let conRitmo = false;
  for (const sucursal of sucursales) {
    const ritmo = Number(sucursal.ventaDiaria);
    if (!Number.isFinite(ritmo)) continue;
    conRitmo = true;
    demanda += Math.max(0, ritmo) * diasCobertura;
    cubierto +=
      Math.max(0, Number(sucursal.existenciaActual) || 0) +
      Math.max(0, Number(sucursal.cubiertoPorTraspaso) || 0);
  }

  const ventaDiariaNueva = conRitmo
    ? Math.max(0, demanda - cubierto) / diasCobertura
    : null;

  return calcularImpactoCompra({
    unidades: producto?.compraTotal,
    costoUnitario: numeroPositivo(producto?.precioCompra),
    precioVenta: numeroPositivo(producto?.precioVenta),
    ventaDiariaEstimada: ventaDiariaNueva,
    diasTemporada: diasCobertura,
    capitalDisponible,
  });
}

/*
 * Agrega impactoDinero a cada producto y resume la lista.
 * Con capitalDisponible, marca hasta dónde alcanza el dinero comprando
 * primero lo que más retorno deja por peso invertido.
 */
export function evaluarImpactoCompras(
  productos = [],
  { diasCobertura = 30, capitalDisponible = null } = {}
) {
  const capital = capitalDisponible === null || capitalDisponible === "" ? null : Number(capitalDisponible);
  const capitalValido = Number.isFinite(capital) && capital >= 0 ? capital : null;

  const evaluados = (productos || []).map((producto) => ({
    ...producto,
    impactoDinero: calcularImpactoProductoCompra(producto, { diasCobertura }),
  }));

  const conDatos = evaluados.filter(
    (producto) =>
      producto.impactoDinero.estado !== ESTADOS_IMPACTO.FALTAN_DATOS &&
      producto.impactoDinero.ganancia > 0
  );
  const porRetorno = [...conDatos].sort(
    (a, b) => (b.impactoDinero.retorno ?? 0) - (a.impactoDinero.retorno ?? 0)
  );

  let restante = capitalValido;
  const alcanza = new Set();
  if (restante !== null) {
    for (const producto of porRetorno) {
      if (producto.impactoDinero.inversion <= restante) {
        restante -= producto.impactoDinero.inversion;
        alcanza.add(producto.llave ?? producto.codigo);
      }
    }
  }

  const sumar = (lista, campo) =>
    Math.round(lista.reduce((total, producto) => total + (producto.impactoDinero[campo] || 0), 0) * 100) / 100;
  const dentroCapital = porRetorno.filter((producto) => alcanza.has(producto.llave ?? producto.codigo));

  return {
    productos: evaluados,
    mejores: porRetorno.slice(0, 5),
    resumen: {
      gananciaEstimada: sumar(conDatos, "ganancia"),
      inversion: sumar(conDatos, "inversion"),
      productosConDatos: conDatos.length,
      productosSinDatos: evaluados.filter(
        (producto) => producto.impactoDinero.estado === ESTADOS_IMPACTO.FALTAN_DATOS
      ).length,
      productosNoConvienen: evaluados.filter(
        (producto) => producto.impactoDinero.estado === ESTADOS_IMPACTO.NO_CONVIENE
      ).length,
      capitalDisponible: capitalValido,
      gananciaConCapital: capitalValido === null ? null : sumar(dentroCapital, "ganancia"),
      inversionConCapital: capitalValido === null ? null : sumar(dentroCapital, "inversion"),
      productosConCapital: capitalValido === null ? null : dentroCapital.length,
    },
  };
}
