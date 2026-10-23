import { useState } from "react";
import { supabase } from "../../../supabase";
import {
  CATEGORIAS_GASTO,
  CATEGORIAS_GASTO_ANTERIORES,
  permiteNoAplica,
  validarMovimientoParaRevision,
} from "../utils/validacionMovimientoTesoreria.js";
import {
  guardarDistribucionMovimientoTesoreria,
  obtenerDestinosDistribucionTesoreria,
} from "../services/tesoreriaService.js";

function HistorialMovimientos({
  movimientos = [],
  formatoDinero,
  onCambiarEstado,
  onEditarMovimiento,
  onEliminarMovimiento,
  onDistribucionGuardada,
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

  const [movimientoDistribuyendo, setMovimientoDistribuyendo] = useState(null);
  const [destinosDistribucion, setDestinosDistribucion] = useState([]);
  const [partidasDistribucion, setPartidasDistribucion] = useState([]);
  const [cargandoDestinos, setCargandoDestinos] = useState(false);
  const [guardandoDistribucion, setGuardandoDistribucion] = useState(false);
  const [errorDistribucion, setErrorDistribucion] = useState("");

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
    const comportamientoActual =
      movimiento.comportamiento ||
      movimiento.expense_behavior ||
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
        comportamientoActual === "no_aplica" &&
        !permiteNoAplica(categoriaActual)
          ? ""
          : comportamientoActual,
    });
  };

  const cerrarEdicion = () => {
    setMovimientoEditando(null);
  };

  const abrirDistribucion = async (movimiento) => {
    setMovimientoDistribuyendo(movimiento);
    setErrorDistribucion("");
    setCargandoDestinos(true);
    try {
      const destinos = await obtenerDestinosDistribucionTesoreria(
        movimiento.organization_id,
      );
      setDestinosDistribucion(destinos);
      const partidasGuardadas = movimiento.distribuciones || [];
      setPartidasDistribucion(partidasGuardadas.length
        ? partidasGuardadas.map((partida) => ({
            business_id: partida.business_id,
            branch_id: partida.branch_id,
            amount: String(partida.amount),
            expense_category: partida.expense_category || "",
            expense_behavior: partida.expense_behavior || "",
            note: partida.note || "",
          }))
        : [{
            business_id: movimiento.business_id || "",
            branch_id: movimiento.branch_id || "",
            amount: String(movimiento.monto || ""),
            expense_category: movimiento.expense_category || "",
            expense_behavior: movimiento.expense_behavior || "",
            note: "",
          }]);
    } catch (error) {
      setErrorDistribucion(error?.message || "No fue posible cargar los destinos.");
    } finally {
      setCargandoDestinos(false);
    }
  };

  const actualizarPartidaDistribucion = (indice, cambios) => {
    setPartidasDistribucion((actuales) => actuales.map((partida, posicion) =>
      posicion === indice ? { ...partida, ...cambios } : partida,
    ));
  };

  const guardarDistribucion = async (evento) => {
    evento.preventDefault();
    if (!movimientoDistribuyendo) return;
    setGuardandoDistribucion(true);
    setErrorDistribucion("");
    try {
      await guardarDistribucionMovimientoTesoreria({
        movimiento: movimientoDistribuyendo,
        partidas: partidasDistribucion,
        destinosValidos: destinosDistribucion,
      });
      await onDistribucionGuardada?.();
      setMovimientoDistribuyendo(null);
    } catch (error) {
      setErrorDistribucion(error?.message || "No fue posible guardar la distribución.");
    } finally {
      setGuardandoDistribucion(false);
    }
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
      <section className="tarjeta movimientos-bandeja">
        <header className="movimientos-bandeja__encabezado">
          <div>
            <span className="movimientos-bandeja__etiqueta">TESORERÍA · BANDEJA DE TRABAJO</span>
            <h2>Movimientos por resolver</h2>
            <p>Revisa uno a la vez. Clasificar no cambia el importe ni borra el registro original.</p>
          </div>
          <strong className="movimientos-bandeja__contador">{movimientosFiltrados.length}</strong>
        </header>

        <div className="movimientos-bandeja__filtros" aria-label="Filtrar movimientos">
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
              aria-pressed={filtroEstado === valor}
            >
              {texto}
            </button>
          ))}
        </div>

        <p className="movimientos-bandeja__resumen">
          Mostrando {movimientosFiltrados.length} de {movimientos.length}. El historial completo permanece disponible en “Todos”.
        </p>

        <div className="movimientos-bandeja__lista">
          {movimientosFiltrados.map((movimiento) => {
            const estado = movimiento.estado || movimiento.status;
            const pendiente = estado !== "Revisado" && estado !== "Cancelado";
            const requiereClasificacion = pendiente && !validarMovimientoParaRevision(movimiento).valido;
            const esSalida = String(movimiento.tipo || "").toLowerCase() === "salida";
            return (
              <article className={`movimiento-card movimiento-card--${String(estado || "pendiente").toLowerCase().replaceAll(" ", "-")}`} key={movimiento.id}>
                <div className="movimiento-card__principal">
                  <div className="movimiento-card__meta">
                    <span className={`movimiento-card__tipo ${esSalida ? "es-salida" : "es-entrada"}`}>{esSalida ? "Salida" : "Entrada"}</span>
                    <time>{movimiento.fecha}</time>
                  </div>
                  <h3>{movimiento.concepto || "Concepto pendiente"}</h3>
                  {(movimiento.distribuciones || []).length > 0 && (
                    <small>Pago distribuido en {movimiento.distribuciones.length} partidas</small>
                  )}
                  <div className="movimiento-card__estado">
                    <span>{estado || "Pendiente de revisión"}</span>
                    <span>{movimiento.receiptUrl ? "Con comprobante" : "Sin comprobante"}</span>
                  </div>
                </div>

                <div className="movimiento-card__importe">{formatoDinero(movimiento.monto)}</div>

                <div className="movimiento-card__acciones">
                  {pendiente && (
                    <button
                      type="button"
                      className="movimiento-card__resolver"
                      onClick={() => {
                        if (requiereClasificacion) abrirEdicion(movimiento);
                        else onCambiarEstado(movimiento.id, "Revisado");
                      }}
                    >
                      {requiereClasificacion ? "Resolver movimiento" : "Confirmar revisión"}
                    </button>
                  )}

                  <details className="movimiento-card__opciones">
                    <summary>Más opciones</summary>
                    <div>
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
                        {abriendoComprobante === movimiento.id ? "Abriendo..." : "Ver comprobante"}
                      </button>
                    ) : (
                      <span>Sin comprobante adjunto</span>
                    )}

                    {estado !== "Cancelado" && (
                      <>
                        {esSalida && (
                          <button
                            type="button"
                            onClick={() => abrirDistribucion(movimiento)}
                          >
                            {(movimiento.distribuciones || []).length
                              ? "Editar reparto"
                              : "Distribuir pago"}
                          </button>
                        )}
                        {(movimiento.distribuciones || []).length === 0 && (
                          <button
                            type="button"
                            onClick={() => abrirEdicion(movimiento)}
                          >
                            {estado === "Pendiente de revisión" ? "Clasificar manualmente" : "Editar"}
                          </button>
                        )}

                        <button
                          type="button"
                          onClick={() =>
                            confirmarEliminacion(movimiento)
                          }
                        >
                          Cancelar
                        </button>
                      </>
                    )}
                    </div>
                  </details>
                </div>
              </article>
            );
          })}
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
                    comportamiento:
                      formularioEdicion.comportamiento === "no_aplica" &&
                      !permiteNoAplica(evento.target.value)
                        ? ""
                        : formularioEdicion.comportamiento,
                  })
                }
                required={formularioEdicion.tipo === "salida"}
                style={{
                  width: "100%",
                  padding: "10px",
                  marginTop: "5px",
                }}
              >
                <option value="">Selecciona una categoría</option>
                {[...CATEGORIAS_GASTO, ...CATEGORIAS_GASTO_ANTERIORES].map(([valor, etiqueta]) => (
                  <option key={valor} value={valor}>{etiqueta}</option>
                ))}
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
                required={formularioEdicion.tipo === "salida"}
                style={{
                  width: "100%",
                  padding: "10px",
                  marginTop: "5px",
                }}
              >
                <option value="">Sin definir</option>
                <option value="fijo">Fijo</option>
                <option value="variable">Variable</option>
                {permiteNoAplica(formularioEdicion.categoria) && (
                  <option value="no_aplica">No aplica</option>
                )}
              </select>
              {formularioEdicion.tipo === "salida" && (
                <small style={{ display: "block", marginTop: "5px" }}>
                  Los gastos de operación deben ser fijos o variables. “No aplica” solo se usa para préstamos, retiros o movimientos que no son gasto.
                </small>
              )}
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

      {movimientoDistribuyendo && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Distribuir pago entre áreas"
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 9998,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "12px",
            background: "rgba(20, 10, 16, 0.78)",
            boxSizing: "border-box",
          }}
        >
          <form
            onSubmit={guardarDistribucion}
            style={{
              width: "100%",
              maxWidth: "760px",
              maxHeight: "92vh",
              overflow: "auto",
              background: "#ffffff",
              borderRadius: "18px",
              padding: "20px",
              boxSizing: "border-box",
            }}
          >
            <h2 style={{ marginTop: 0 }}>Distribuir pago</h2>
            <p style={{ marginTop: 0, color: "#6d5962" }}>
              {movimientoDistribuyendo.concepto} · {formatoDinero(movimientoDistribuyendo.monto)}
            </p>
            <p style={{ color: "#6d5962" }}>
              Este desglose organiza el destino del pago. El total real del movimiento y el saldo de la cuenta no cambian.
            </p>

            {cargandoDestinos ? (
              <p>Cargando negocios y sucursales…</p>
            ) : destinosDistribucion.length === 0 ? (
              <p role="alert">No hay sucursales activas disponibles para este movimiento.</p>
            ) : partidasDistribucion.map((partida, indice) => {
              const clavesDestino = destinosDistribucion.map((destino) =>
                `${destino.business_id}:${destino.branch_id}`,
              );
              const claveSeleccionada = `${partida.business_id}:${partida.branch_id}`;
              const categorias = [...CATEGORIAS_GASTO, ...CATEGORIAS_GASTO_ANTERIORES];
              const importeDistribuido = partidasDistribucion.reduce(
                (suma, actual) => suma + (Number(actual.amount) || 0),
                0,
              );
              const restante = Number(movimientoDistribuyendo.monto) - importeDistribuido;
              return (
                <fieldset
                  key={`partida-${indice}`}
                  style={{ border: "1px solid #e6d8e0", borderRadius: "12px", padding: "12px", margin: "12px 0" }}
                >
                  <legend>Partida {indice + 1}</legend>
                  <label style={{ display: "block", marginBottom: "9px" }}>
                    Negocio y sucursal
                    <select
                      value={clavesDestino.includes(claveSeleccionada) ? claveSeleccionada : ""}
                      onChange={(evento) => {
                        const destino = destinosDistribucion.find((opcion) =>
                          `${opcion.business_id}:${opcion.branch_id}` === evento.target.value,
                        );
                        actualizarPartidaDistribucion(indice, {
                          business_id: destino?.business_id || "",
                          branch_id: destino?.branch_id || "",
                        });
                      }}
                      required
                      style={{ display: "block", width: "100%", padding: "10px", marginTop: "4px" }}
                    >
                      <option value="">Selecciona destino</option>
                      {destinosDistribucion.map((destino) => (
                        <option key={`${destino.business_id}:${destino.branch_id}`} value={`${destino.business_id}:${destino.branch_id}`}>
                          {destino.business_name} · {destino.branch_name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "9px" }}>
                    <label>
                      Importe
                      <input
                        type="number"
                        min="0.01"
                        step="0.01"
                        value={partida.amount}
                        onChange={(evento) => actualizarPartidaDistribucion(indice, { amount: evento.target.value })}
                        required
                        style={{ display: "block", width: "100%", padding: "10px", boxSizing: "border-box", marginTop: "4px" }}
                      />
                    </label>
                    <label>
                      Categoría
                      <select
                        value={partida.expense_category}
                        onChange={(evento) => actualizarPartidaDistribucion(indice, {
                          expense_category: evento.target.value,
                          expense_behavior: partida.expense_behavior === "no_aplica" && !permiteNoAplica(evento.target.value)
                            ? ""
                            : partida.expense_behavior,
                        })}
                        required
                        style={{ display: "block", width: "100%", padding: "10px", boxSizing: "border-box", marginTop: "4px" }}
                      >
                        <option value="">Selecciona categoría</option>
                        {categorias.map(([valor, etiqueta]) => <option key={valor} value={valor}>{etiqueta}</option>)}
                      </select>
                    </label>
                    <label>
                      Comportamiento
                      <select
                        value={partida.expense_behavior}
                        onChange={(evento) => actualizarPartidaDistribucion(indice, { expense_behavior: evento.target.value })}
                        required
                        style={{ display: "block", width: "100%", padding: "10px", boxSizing: "border-box", marginTop: "4px" }}
                      >
                        <option value="">Selecciona tipo</option>
                        <option value="fijo">Fijo</option>
                        <option value="variable">Variable</option>
                        {permiteNoAplica(partida.expense_category) && <option value="no_aplica">No aplica</option>}
                      </select>
                    </label>
                  </div>
                  <label style={{ display: "block", marginTop: "9px" }}>
                    Detalle (opcional)
                    <input
                      type="text"
                      maxLength="500"
                      value={partida.note}
                      onChange={(evento) => actualizarPartidaDistribucion(indice, { note: evento.target.value })}
                      style={{ display: "block", width: "100%", padding: "10px", boxSizing: "border-box", marginTop: "4px" }}
                    />
                  </label>
                  {partidasDistribucion.length > 1 && (
                    <button type="button" onClick={() => setPartidasDistribucion((actuales) => actuales.filter((_, posicion) => posicion !== indice))} style={{ marginTop: "9px" }}>
                      Quitar partida
                    </button>
                  )}
                  {indice === partidasDistribucion.length - 1 && (
                    <div style={{ marginTop: "10px", padding: "10px", background: "#f8f1f5", borderRadius: "10px" }}>
                      <strong>Falta distribuir: {formatoDinero(restante)}</strong>
                    </div>
                  )}
                </fieldset>
              );
            })}

            {!cargandoDestinos && destinosDistribucion.length > 0 && (
              <button
                type="button"
                onClick={() => setPartidasDistribucion((actuales) => [...actuales, {
                  business_id: "",
                  branch_id: "",
                  amount: "",
                  expense_category: "",
                  expense_behavior: "",
                  note: "",
                }])}
                style={{ marginBottom: "12px" }}
              >
                + Agregar otra área
              </button>
            )}

            {errorDistribucion && <p role="alert" style={{ color: "#a12b42" }}>{errorDistribucion}</p>}
            <div style={{ display: "flex", gap: "8px", justifyContent: "flex-end", flexWrap: "wrap" }}>
              <button type="button" disabled={guardandoDistribucion} onClick={() => setMovimientoDistribuyendo(null)}>
                Cancelar
              </button>
              <button type="submit" disabled={cargandoDestinos || guardandoDistribucion || destinosDistribucion.length === 0}>
                {guardandoDistribucion ? "Guardando…" : "Guardar distribución"}
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
