function SicarResumen({
  datosDashboard,
  cargandoDashboard,
  errorDashboard,
}) {
  if (cargandoDashboard) {
    return (
      <section className="sicar-resumen">
        <h2 className="titulo-seccion">
          Resumen de ventas SICAR
        </h2>

        <div className="sin-registros">
          Cargando información del último reporte...
        </div>
      </section>
    );
  }

  if (errorDashboard) {
    return (
      <section className="sicar-resumen">
        <h2 className="titulo-seccion">
          Resumen de ventas SICAR
        </h2>

        <div className="sin-registros">
          No fue posible cargar los datos:{" "}
          {errorDashboard}
        </div>
      </section>
    );
  }

  if (!datosDashboard) {
    return (
      <section className="sicar-resumen">
        <h2 className="titulo-seccion">
          Resumen de ventas SICAR
        </h2>

        <div className="sin-registros">
          Todavía no hay un reporte de ventas procesado.
        </div>
      </section>
    );
  }

  const { importacion, metricas } = datosDashboard;

  const productoMasVendido =
    metricas.productoMasVendido;

  return (
    <section className="sicar-resumen">
      <h2 className="titulo-seccion">
        Resumen de ventas SICAR
      </h2>

      <div className="indicadores">
        <article className="tarjeta">
          <span className="icono">📦</span>
          <p>Piezas vendidas</p>
          <strong>
            {metricas.totalPiezas.toLocaleString(
              "es-MX"
            )}
          </strong>
        </article>

        <article className="tarjeta">
          <span className="icono">🏷️</span>
          <p>Productos registrados</p>
          <strong>
            {metricas.totalProductos.toLocaleString(
              "es-MX"
            )}
          </strong>
        </article>

        <article className="tarjeta">
          <span className="icono">⭐</span>
          <p>Producto más vendido</p>
          <strong>
            {productoMasVendido?.descripcion ||
              "Sin información"}
          </strong>

          {productoMasVendido && (
            <small>
              {productoMasVendido.cantidad} piezas
            </small>
          )}
        </article>

        <article className="tarjeta">
          <span className="icono">📄</span>
          <p>Filas procesadas</p>
          <strong>
            {Number(
              importacion.total_filas || 0
            ).toLocaleString("es-MX")}
          </strong>
        </article>
      </div>
    </section>
  );
}

export default SicarResumen;