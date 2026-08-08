function Indicadores({
  disponible = 0,
  entradas = 0,
  salidas = 0,
  cantidadMovimientos = 0,

  ventasTotales = 0,
  utilidadTotal = 0,
  margenUtilidad = 0,
  totalPiezas = 0,

  formatoDinero,
}) {
  const formatearDinero = (valor) => {
    if (typeof formatoDinero === "function") {
      return formatoDinero(Number(valor) || 0);
    }

    return new Intl.NumberFormat("es-MX", {
      style: "currency",
      currency: "MXN",
      minimumFractionDigits: 2,
    }).format(Number(valor) || 0);
  };

  const formatearNumero = (valor) =>
    new Intl.NumberFormat("es-MX", {
      maximumFractionDigits: 2,
    }).format(Number(valor) || 0);

  const formatearPorcentaje = (valor) =>
    `${formatearNumero(valor)}%`;

  const tarjetas = [
    {
      icono: "💵",
      titulo: "Dinero disponible",
      valor: formatearDinero(disponible),
    },
    {
      icono: "📥",
      titulo: "Entradas registradas",
      valor: formatearDinero(entradas),
    },
    {
      icono: "📤",
      titulo: "Salidas registradas",
      valor: formatearDinero(salidas),
    },
    {
      icono: "🧾",
      titulo: "Movimientos",
      valor: formatearNumero(cantidadMovimientos),
    },
    {
      icono: "📈",
      titulo: "Ventas totales",
      valor: formatearDinero(ventasTotales),
    },
    {
      icono: "💰",
      titulo: "Utilidad total",
      valor: formatearDinero(utilidadTotal),
    },
    {
      icono: "📊",
      titulo: "Margen de utilidad",
      valor: formatearPorcentaje(margenUtilidad),
    },
    {
      icono: "📦",
      titulo: "Piezas vendidas",
      valor: formatearNumero(totalPiezas),
    },
  ];

  return (
    <section className="indicadores">
      {tarjetas.map((tarjeta) => (
        <article
          className="tarjeta"
          key={tarjeta.titulo}
        >
          <span className="icono">
            {tarjeta.icono}
          </span>

          <p>{tarjeta.titulo}</p>

          <strong>{tarjeta.valor}</strong>
        </article>
      ))}
    </section>
  );
}

export default Indicadores;