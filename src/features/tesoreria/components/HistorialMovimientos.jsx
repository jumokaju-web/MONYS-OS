function HistorialMovimientos({
  movimientos,
  formatoDinero,
  onCambiarEstado,
}) {
  if (movimientos.length === 0) {
    return (
      <section className="tarjeta">
        <h2>Últimos movimientos</h2>
        <p>Todavía no hay movimientos registrados.</p>
      </section>
    );
  }

  return (
    <section className="tarjeta">
      <h2>Últimos movimientos</h2>

      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead>
          <tr>
            <th align="left">Fecha</th>
            <th align="left">Tipo</th>
            <th align="left">Concepto</th>
            <th align="right">Monto</th>
            <th align="center">Estado</th>
            <th align="center">Acciones</th>
          </tr>
        </thead>

        <tbody>
          {movimientos.map((movimiento) => (
            <tr key={movimiento.id}>
              <td>{movimiento.fecha}</td>
              <td>{movimiento.tipo}</td>
              <td>{movimiento.concepto}</td>

              <td align="right">
                {formatoDinero(movimiento.monto)}
              </td>

              <td align="center">
                {movimiento.estado}
              </td>

              <td align="center">
                {movimiento.estado !== "Revisado" && (
                  <button
                    type="button"
                    onClick={() =>
                      onCambiarEstado(
                        movimiento.id,
                        "Revisado"
                      )
                    }
                  >
                    Marcar revisado
                  </button>
                )}

                <button type="button">
                  Editar
                </button>

                <button type="button">
                  Eliminar
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

export default HistorialMovimientos;