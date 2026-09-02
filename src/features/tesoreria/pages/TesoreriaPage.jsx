import { useState } from "react";
import FormularioMovimiento from "../components/FormularioMovimiento";
import "./TesoreriaPage.css";
import HistorialMovimientos from "../components/HistorialMovimientos";
import {
  guardarMovimientoTesoreria,
} from "../services/tesoreriaService";

function TesoreriaPage({
  volverAlDashboard,
  onMovimientoGuardado,
  movimientos = [],
  formatoDinero,
  onCambiarEstado,
}) {

  const [tipoMovimiento, setTipoMovimiento] = useState(null);
  const [mensaje, setMensaje] = useState("");
  const [tipoMensaje, setTipoMensaje] = useState("");
  const [guardando, setGuardando] = useState(false);

  const formularioVisible = tipoMovimiento !== null;

  const abrirFormularioMovimiento = (tipo) => {
    setMensaje("");
    setTipoMensaje("");
    setTipoMovimiento(tipo);
  };

  const cerrarFormulario = () => {
    if (guardando) {
      return;
    }

    setTipoMovimiento(null);
    setMensaje("");
    setTipoMensaje("");
  };

  const guardarMovimiento = async (movimiento) => {
    try {
      setGuardando(true);
      setMensaje("");
      setTipoMensaje("");

      const movimientoGuardado =
        await guardarMovimientoTesoreria(movimiento);

      if (onMovimientoGuardado) {
        await onMovimientoGuardado();
      }

      console.log(
        "Movimiento guardado correctamente:",
        movimientoGuardado
      );

      setMensaje(
        movimiento.tipo === "salida"
          ? "Gasto guardado correctamente en MONYS OS."
          : "Entrada guardada correctamente en MONYS OS."
      );

      setTipoMensaje("exito");
    } catch (error) {
      console.error("Error al guardar:", error);

      setMensaje(
        error.message ||
          "No fue posible guardar el movimiento."
      );

      setTipoMensaje("error");
    } finally {
      setGuardando(false);
    }
  };

  const regresarAlDashboard = () => {
    if (guardando) {
      return;
    }

    setTipoMovimiento(null);
    setMensaje("");
    setTipoMensaje("");

    if (typeof volverAlDashboard === "function") {
      volverAlDashboard();
    }
  };

  const estiloMensaje =
    tipoMensaje === "exito"
      ? {
          background: "#f0fff5",
          border: "1px solid #86d7a2",
          color: "#176b38",
        }
      : {
          background: "#fff3f5",
          border: "1px solid #f0a3b4",
          color: "#9e1b3f",
        };

  return (
    <main className="tesoreria-page">
      <section className="tesoreria-encabezado">
        <span className="etiqueta">
          TESORERÍA
        </span>

        <h1>Control financiero</h1>

        <p>
          Registra y consulta las entradas y salidas de dinero de
          Corporativo Monys.
        </p>
      </section>

      <section className="acciones">
        {!formularioVisible && (
          <div className="acciones-principales">
            <button
              type="button"
              className="boton-entrada"
              onClick={() =>
                abrirFormularioMovimiento("entrada")
              }
            >
              <span aria-hidden="true">＋</span>
              Registrar entrada
            </button>

            <button
              type="button"
              className="boton-salida"
              onClick={() =>
                abrirFormularioMovimiento("salida")
              }
            >
              <span aria-hidden="true">−</span>
              Registrar salida
            </button>
          </div>
        )}

        {mensaje && (
          <div
            role="status"
            aria-live="polite"
            style={{
              ...estiloMensaje,
              maxWidth: "900px",
              margin: "20px auto",
              padding: "16px 20px",
              borderRadius: "14px",
              fontWeight: "700",
              textAlign: "center",
              boxSizing: "border-box",
            }}
          >
            {tipoMensaje === "exito" ? "✅ " : "⚠️ "}
            {mensaje}
          </div>
        )}

        {formularioVisible && (
          <FormularioMovimiento
            key={tipoMovimiento}
            tipoInicial={tipoMovimiento}
            onGuardar={guardarMovimiento}
            onCancelar={cerrarFormulario}
          />
        )}

         {!formularioVisible && (
  <HistorialMovimientos
    movimientos={movimientos}
    formatoDinero={formatoDinero}
    onCambiarEstado={onCambiarEstado}
  />
)}

        <button
          type="button"
          className="boton-volver"
          onClick={regresarAlDashboard}
          disabled={guardando}
        >
          ← Volver al Dashboard
        </button>
      </section>
    </main>
  );
}

export default TesoreriaPage;