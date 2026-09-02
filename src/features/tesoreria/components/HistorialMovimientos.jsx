import { useState } from "react";
import { supabase } from "../../../supabase";

function HistorialMovimientos({
  movimientos,
  formatoDinero,
  onCambiarEstado,
}) {
  const [abriendoComprobante, setAbriendoComprobante] =
    useState(null);

   const abrirComprobante = async (movimiento) => {
  if (!movimiento?.receiptUrl) {
    return;
  }

  /*
    Abrimos la ventana inmediatamente al tocar el botón.
    Esto evita que Safari/iPhone bloquee la apertura
    después del await.
  */
  const ventanaComprobante =
    window.open("", "_blank");

  try {
    setAbriendoComprobante(movimiento.id);

    const {
      data,
      error,
    } = await supabase.storage
      .from("tesoreria-comprobantes")
      .createSignedUrl(
        movimiento.receiptUrl,
        60
      );

    if (error) {
      throw error;
    }

    if (!data?.signedUrl) {
      throw new Error(
        "No fue posible generar el acceso al comprobante."
      );
    }

    if (ventanaComprobante) {
      ventanaComprobante.location.href =
        data.signedUrl;
    } else {
      /*
        Respaldo para iPhone si no permite
        crear otra ventana.
      */
      window.location.href =
        data.signedUrl;
    }
  } catch (error) {
    if (ventanaComprobante) {
      ventanaComprobante.close();
    }

    console.error(
      "No fue posible abrir el comprobante:",
      error
    );

    alert(
      error?.message ||
        "No fue posible abrir el comprobante."
    );
  } finally {
    setAbriendoComprobante(null);
  }
};

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

      <table
        style={{
          width: "100%",
          borderCollapse: "collapse",
        }}
      >
        <thead>
          <tr>
            <th align="left">Fecha</th>
            <th align="left">Tipo</th>
            <th align="left">Concepto</th>
            <th align="right">Monto</th>
            <th align="center">Estado</th>
            <th align="center">Comprobante</th>
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
                {formatoDinero(
                  movimiento.monto
                )}
              </td>

              <td align="center">
                {movimiento.estado}
              </td>

              <td align="center">
                {movimiento.receiptUrl ? (
                  <button
                    type="button"
                    onClick={() =>
                      abrirComprobante(
                        movimiento
                      )
                    }
                    disabled={
                      abriendoComprobante ===
                      movimiento.id
                    }
                  >
                    {abriendoComprobante ===
                    movimiento.id
                      ? "Abriendo..."
                      : "📎 Ver comprobante"}
                  </button>
                ) : (
                  <span
                    style={{
                      color: "#999",
                      fontSize: "13px",
                    }}
                  >
                    Sin comprobante
                  </span>
                )}
              </td>

              <td align="center">
                {movimiento.estado !==
                  "Revisado" && (
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