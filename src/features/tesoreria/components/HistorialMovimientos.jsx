import { useState } from "react";
import { supabase } from "../../../supabase";

function HistorialMovimientos({
  movimientos = [],
  formatoDinero,
  onCambiarEstado,
  onEditarMovimiento,
  onEliminarMovimiento,
}) {
  const [abriendoComprobante, setAbriendoComprobante] =
    useState(null);

  const [comprobanteVisible, setComprobanteVisible] =
    useState(null);

  const [movimientoEditando, setMovimientoEditando] =
    useState(null);

  const [filtroEstado, setFiltroEstado] =
    useState("Pendiente de revisión");

  const [formularioEdicion, setFormularioEdicion] =
  useState({
    concepto: "",
    monto: "",
    tipo: "entrada",
    categoria: "",
    comportamiento: "",
  });

  const abrirComprobante = async (movimiento) => {
    if (!movimiento?.receiptUrl) return;

    try {
      setAbriendoComprobante(movimiento.id);

      const { data, error } = await supabase.storage
        .from("tesoreria-comprobantes")
        .createSignedUrl(movimiento.receiptUrl, 300);

      if (error) throw error;

      if (!data?.signedUrl) {
        throw new Error(
          "No fue posible generar el acceso al comprobante."
        );
      }

      setComprobanteVisible({
        url: data.signedUrl,
        concepto: movimiento.concepto || "Comprobante",
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

  const abrirEdicion = (movimiento) => {
    setMovimientoEditando(movimiento);

    const tipoMovimiento = String(
      movimiento.tipo || ""
    ).toLowerCase();

    const categoriaActual =
      movimiento.categoria ||
      movimiento.expense_category ||
      "";

    setFormularioEdicion({
      concepto: movimiento.concepto || "",
      monto: movimiento.monto || "",
      tipo:
        tipoMovimiento === "salida"
          ? "salida"
          : "entrada",
      categoria:
        categoriaActual === "sin_clasificar"
          ? ""
          : categoriaActual,
      comportamiento:
        movimiento.comportamiento ||
        movimiento.expense_behavior ||
        "",
    });
  };

  const cerrarEdicion = () => {
    setMovimientoEditando(null);
  };

  const guardarEdicion = async (evento) => {
    evento.preventDefault();

    if (!movimientoEditando) return;

    if (typeof onEditarMovimiento !== "function") {
      return;
    }

    await onEditarMovimiento(
      movimientoEditando.id,
      {
        concepto: formularioEdicion.concepto,
        monto: formularioEdicion.monto,
        tipo: formularioEdicion.tipo,
        categoria: formularioEdicion.categoria,
        comportamiento:
          formularioEdicion.comportamiento || null,
        estado: "Revisado",
      }
    );

    setMovimientoEditando(null);
  };

  const confirmarEliminacion = async (movimiento) => {
    if (typeof onEliminarMovimiento !== "function") {
      return;
    }

    const confirmado = window.confirm(
      "El movimiento se marcará como Cancelado y no se borrará físicamente. ¿Deseas continuar?"
    );

    if (!confirmado) return;

    await onEliminarMovimiento(movimiento.id);
  };

  const movimientosFiltrados = movimientos.filter(
    (movimiento) => {
      if (filtroEstado === "todos") {
        return true;
      }

      return movimiento.estado === filtroEstado;
    }
  );

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
            display: "flex",
            flexWrap: "wrap",
            gap: "8px",
            marginBottom: "18px",
          }}
        >
          {[
            ["Pendientes", "Pendiente de revisión"],
            ["Revisados", "Revisado"],
            ["Cancelados", "Cancelado"],
            ["Todos", "todos"],
          ].map(([texto, valor]) => (
            <button
              key={valor}
              type="button"
              onClick={() => setFiltroEstado(valor)}
              style={{
                padding: "8px 12px",
                borderRadius: "10px",
                border: "1px solid #d99ab7",
                background:
                  filtroEstado === valor
                    ? "#d81b60"
                    : "#ffffff",
                color:
                  filtroEstado === valor
                    ? "#ffffff"
                    : "#6f163f",
                fontWeight: "700",
                cursor: "pointer",
              }}
            >
              {texto}
            </button>
          ))}
        </div>

        <p
          style={{
            marginTop: 0,
            color: "#6d5962",
          }}
        >
          Mostrando {movimientosFiltrados.length} de {movimientos.length} movimientos.
        </p>

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
              {movimientosFiltrados.map((movimiento) => (
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
                    {movimiento.receiptUrl ? (
                      <button
                        type="button"
                        onClick={() =>
                          abrirComprobante(movimiento)
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
                    {movimiento.estado !== "Revisado" &&
                      movimiento.estado !== "Cancelado" && (
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

                    {movimiento.estado !== "Cancelado" && (
                      <>
                        <button
                          type="button"
                          onClick={() =>
                            abrirEdicion(movimiento)
                          }
                          style={{
                            marginLeft: "6px",
                          }}
                        >
                          {movimiento.estado ===
                          "Pendiente de revisión"
                            ? "Clasificar"
                            : "Editar"}
                        </button>

                        <button
                          type="button"
                          onClick={() =>
                            confirmarEliminacion(movimiento)
                          }
                          style={{
                            marginLeft: "6px",
                          }}
                        >
                          Cancelar
                        </button>
                      </>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {movimientoEditando && (
        <div
          role="dialog"
          aria-modal="true"
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 9998,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "18px",
            background: "rgba(20, 10, 16, 0.78)",
          }}
        >
          <form
            onSubmit={guardarEdicion}
            style={{
              width: "100%",
              maxWidth: "520px",
              background: "#ffffff",
              borderRadius: "20px",
              padding: "24px",
              boxSizing: "border-box",
            }}
          >
            <h2>
              {movimientoEditando.estado ===
              "Pendiente de revisión"
                ? "Clasificar y enseñar a MONYS"
                : "Editar movimiento"}
            </h2>

            <p
              style={{
                color: "#6d5962",
                marginBottom: "18px",
              }}
            >
              Al guardar, MONYS recordará esta clasificación para movimientos similares.
            </p>

            <label
              style={{
                display: "block",
                marginBottom: "12px",
              }}
            >
              Tipo
              <select
                value={formularioEdicion.tipo}
                onChange={(evento) =>
                  setFormularioEdicion({
                    ...formularioEdicion,
                    tipo: evento.target.value,
                  })
                }
                style={{
                  width: "100%",
                  padding: "10px",
                  marginTop: "5px",
                }}
              >
                <option value="entrada">Entrada</option>
                <option value="salida">Salida</option>
              </select>
            </label>

            <label
              style={{
                display: "block",
                marginBottom: "12px",
              }}
            >
              Categoría
              <select
                value={formularioEdicion.categoria}
                onChange={(evento) =>
                  setFormularioEdicion({
                    ...formularioEdicion,
                    categoria: evento.target.value,
                  })
                }
                required
                style={{
                  width: "100%",
                  padding: "10px",
                  marginTop: "5px",
                }}
              >
                <option value="">Selecciona una categoría</option>
                <option value="nomina">Nómina</option>
                <option value="comisiones">Comisiones</option>
                <option value="compra_mercancia">Compra de mercancía</option>
                <option value="transporte">Transporte</option>
                <option value="limpieza">Limpieza</option>
                <option value="alimentos">Alimentos</option>
                <option value="anticipo_prestamo">Anticipo o préstamo</option>
                <option value="retiro_propietaria">Retiro de propietaria</option>
                <option value="renta">Renta</option>
                <option value="servicios">Servicios</option>
                <option value="otros">Otros</option>
              </select>
            </label>

            <label
              style={{
                display: "block",
                marginBottom: "12px",
              }}
            >
              Comportamiento del gasto
              <select
                value={formularioEdicion.comportamiento}
                onChange={(evento) =>
                  setFormularioEdicion({
                    ...formularioEdicion,
                    comportamiento: evento.target.value,
                  })
                }
                style={{
                  width: "100%",
                  padding: "10px",
                  marginTop: "5px",
                }}
              >
                <option value="">Sin definir</option>
                <option value="fijo">Fijo</option>
                <option value="variable">Variable</option>
                <option value="no_aplica">No aplica</option>
              </select>
            </label>

            <label
              style={{
                display: "block",
                marginBottom: "12px",
              }}
            >
              Concepto
              <input
                type="text"
                value={formularioEdicion.concepto}
                onChange={(evento) =>
                  setFormularioEdicion({
                    ...formularioEdicion,
                    concepto: evento.target.value,
                  })
                }
                required
                style={{
                  width: "100%",
                  padding: "10px",
                  marginTop: "5px",
                  boxSizing: "border-box",
                }}
              />
            </label>

            <label
              style={{
                display: "block",
                marginBottom: "18px",
              }}
            >
              Monto
              <input
                type="number"
                min="0.01"
                step="0.01"
                value={formularioEdicion.monto}
                onChange={(evento) =>
                  setFormularioEdicion({
                    ...formularioEdicion,
                    monto: evento.target.value,
                  })
                }
                required
                style={{
                  width: "100%",
                  padding: "10px",
                  marginTop: "5px",
                  boxSizing: "border-box",
                }}
              />
            </label>

            <div
              style={{
                display: "flex",
                gap: "10px",
                justifyContent: "flex-end",
              }}
            >
              <button
                type="button"
                onClick={cerrarEdicion}
              >
                Cancelar
              </button>

              <button type="submit">
                Guardar y aprender
              </button>
            </div>
          </form>
        </div>
      )}

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
            background: "rgba(20, 10, 16, 0.78)",
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
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
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
                  {comprobanteVisible.concepto}
                </span>
              </div>

              <button
                type="button"
                onClick={cerrarComprobante}
                style={{
                  width: "42px",
                  height: "42px",
                  border: "none",
                  borderRadius: "50%",
                  background: "#f4edf0",
                  color: "#6f163f",
                  fontSize: "22px",
                }}
              >
                ×
              </button>
            </div>

            <img
              src={comprobanteVisible.url}
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
