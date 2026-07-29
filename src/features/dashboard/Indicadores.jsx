function Indicadores({
  disponible,
  entradas,
  salidas,
  cantidadMovimientos,
  formatoDinero,
}) {
  return (
    <section className="indicadores">
      <article className="tarjeta">
        <span className="icono">💵</span>
        <p>Dinero disponible</p>
        <strong>{formatoDinero(disponible)}</strong>
      </article>

      <article className="tarjeta">
        <span className="icono">📥</span>
        <p>Entradas registradas</p>
        <strong>{formatoDinero(entradas)}</strong>
      </article>

      <article className="tarjeta">
        <span className="icono">📤</span>
        <p>Salidas registradas</p>
        <strong>{formatoDinero(salidas)}</strong>
      </article>

      <article className="tarjeta">
        <span className="icono">🧾</span>
        <p>Movimientos</p>
        <strong>{cantidadMovimientos}</strong>
      </article>
    </section>
  );
}

export default Indicadores;