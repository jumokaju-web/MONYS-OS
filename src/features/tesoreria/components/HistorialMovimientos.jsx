import { useState } from "react";
import { supabase } from "../../../supabase";

function HistorialMovimientos({
  movimientos,
  formatoDinero,
  onCambiarEstado,
}) {
  const [abriendoComprobante, setAbriendoComprobante] =
    useState(null);

  const [comprobanteVisible, setComprobanteVisible] =
    useState(null);

  const abrirComprobante = async (movimiento) => {
    if (!movimiento?.receiptUrl) {
      return;
    }

    try {
      setAbriendoComprobante(movimiento.id);

      const {
        data,
        error,
      } = await supabase.storage
        .from("tesoreria-comprobantes")
        .createSignedUrl(
          movimiento.receiptUrl,
          300
        );

      if (error) {
        throw error;
      }

      if (!data?.signedUrl) {
        throw new Error(
          "No fue posible generar el acceso al comprobante."
        );
      }

      setComprobanteVisible({
        url: data.signedUrl,
        concepto:
          movimiento.concepto ||
          "Comprobante",
      });
    } catch (error) {
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

  const cerrarComprobante = () => {
    setComprobanteVisible(null);
  };

  if (movimientos.length === 0) {
    return (
      <section className="tarjeta">
        <h2>Últimos movimientos</h2>

        <p>
          Todavía no hay movimientos registrados.
        </p>
      </section>
    );
  }

  return (
    <>
      <section className="tarjeta">
        <h2>Últimos movimientos</h2>

        <div
          style={{
            width: "100%",
            overflowX: "auto",
          }}
        >
          <table
            style={{
              width: "100%",
              borderCollapse: "collapse",
              minWidth: "760px",
            }}
          >
            <thead>
              <tr>
                <th align="left">
                  Fecha
                </th>

                <th align="left">
                  Tipo
                </th>

                <th align="left">
                  Concepto
                </th>

                <th align="right">
                  Monto
                </th>

                <th align="center">
                  Estado
                </th>

                <th align="center">
                  Comprobante
                </th>

                <th align="center">
                  Acciones
                </th>
              </tr>
            </thead>

            <tbody>
              {movimientos.map(
                (movimiento) => (
                  <tr
                    key={movimiento.id}
                  >
                    <td>
                      {movimiento.fecha}
                    </td>

                    <td>
                      {movimiento.tipo}
                    </td>

                    <td>
                      {movimiento.concepto}
                    </td>

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

                      <button
                        type="button"
                      >
                        Editar
                      </button>

                      <button
                        type="button"
                      >
                        Eliminar
                      </button>
                    </td>
                  </tr>
                )
              )}
            </tbody>
          </table>
        </div>
      </section>

      {comprobanteVisible && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Comprobante"
          onClick={cerrarComprobante}
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 9999,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "18px",
            background:
              "rgba(20, 10, 16, 0.78)",
            boxSizing: "border-box",
          }}
        >
          <div
            onClick={(evento) =>
              evento.stopPropagation()
            }
            style={{
              width: "100%",
              maxWidth: "720px",
              maxHeight: "92vh",
              overflow: "auto",
              background: "#ffffff",
              borderRadius: "24px",
              padding: "16px",
              boxSizing: "border-box",
              boxShadow:
                "0 24px 70px rgba(0,0,0,.35)",
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent:
                  "space-between",
                alignItems: "center",
                gap: "12px",
                marginBottom: "14px",
              }}
            >
              <div>
                <strong
                  style={{
                    display: "block",
                    color: "#6f163f",
                    fontSize: "13px",
                    letterSpacing: "1px",
                  }}
                >
                  COMPROBANTE
                </strong>

                <span
                  style={{
                    color: "#302029",
                    fontWeight: "700",
                  }}
                >
                  {
                    comprobanteVisible.concepto
                  }
                </span>
              </div>

              <button
                type="button"
                onClick={
                  cerrarComprobante
                }
                style={{
                  width: "42px",
                  height: "42px",
                  border: "none",
                  borderRadius: "50%",
                  background: "#f4edf0",
                  color: "#6f163f",
                  fontSize: "22px",
                  cursor: "pointer",
                }}
              >
                ×
              </button>
            </div>

            <img
              src={
                comprobanteVisible.url
              }
              alt="Comprobante del movimiento"
              style={{
                display: "block",
                width: "100%",
                height: "auto",
                maxHeight: "72vh",
                objectFit: "contain",
                borderRadius: "16px",
                background: "#f7f4f5",
              }}
            />
          </div>
        </div>
      )}
    </>
  );
}

export default HistorialMovimientos;