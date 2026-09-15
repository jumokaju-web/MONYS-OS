import {
  useEffect,
  useState,
} from "react";
import FormularioMovimiento from "../components/FormularioMovimiento";
import "./TesoreriaPage.css";
import HistorialMovimientos from "../components/HistorialMovimientos";
import ResumenBancario from "../components/ResumenBancario";
import {
  guardarMovimientoTesoreria,
  actualizarMovimientoTesoreria,
  eliminarMovimientoTesoreria,
} from "../services/tesoreriaService";

import {
  obtenerSaldosBancariosActuales,
} from "../services/cuentasFinancierasService";

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

    const [
    resumenBancario,
    setResumenBancario,
  ] = useState({
    cuentas: [],
    saldoTotal: 0,
  });

  const [
    cargandoSaldos,
    setCargandoSaldos,
  ] = useState(true);

  const [
    errorSaldos,
    setErrorSaldos,
  ] = useState("");

  useEffect(() => {
    let componenteActivo = true;

    const cargarSaldosBancarios =
      async () => {
        try {
          setCargandoSaldos(true);
          setErrorSaldos("");

          const resumen =
            await obtenerSaldosBancariosActuales();

          if (componenteActivo) {
            setResumenBancario(
              resumen
            );
          }
        } catch (error) {
          console.error(
            "Error al cargar saldos:",
            error
          );

          if (componenteActivo) {
            setErrorSaldos(
              error?.message ||
                "No fue posible consultar los saldos bancarios."
            );
          }
        } finally {
          if (componenteActivo) {
            setCargandoSaldos(
              false
            );
          }
        }
      };

    cargarSaldosBancarios();

    return () => {
      componenteActivo = false;
    };
  }, []);

  const formularioVisible = tipoMovimiento !== null;

    const movimientosPorAclarar =
    movimientos.filter((movimiento) => {
      const estado =
        movimiento.estado ||
        movimiento.status ||
        "";

      const concepto = String(
        movimiento.concepto ||
        movimiento.concept ||
        ""
      )
        .trim()
        .toLowerCase();

      const cantidadPalabras =
        concepto.split(/\s+/).filter(Boolean)
          .length;

      const conceptoGenerico =
        concepto.includes("sin comentario") ||
        concepto.includes(
          "movimiento importado desde sicar"
        ) ||
        concepto.includes("por aclarar") ||
        cantidadPalabras < 2;

      return (
        estado === "Pendiente de revisión" &&
        conceptoGenerico
      );
    });

  const abrirFormularioMovimiento = (tipo) => {
    setMensaje("");
    setTipoMensaje("");
    setTipoMovimiento(tipo);
  };

  const cerrarFormulario = () => {
    if (guardando) return;

    setTipoMovimiento(null);
    setMensaje("");
    setTipoMensaje("");
  };

  const guardarMovimiento = async (movimiento) => {
    try {
      setGuardando(true);
      setMensaje("");
      setTipoMensaje("");

      await guardarMovimientoTesoreria(movimiento);

      if (onMovimientoGuardado) {
        await onMovimientoGuardado();
      }

      setMensaje(
        movimiento.tipo === "salida"
          ? "Gasto guardado correctamente en MONYS OS."
          : "Entrada guardada correctamente en MONYS OS."
      );

      setTipoMensaje("exito");
    } catch (error) {
      console.error("Error al guardar:", error);
      setMensaje(
        error?.message ||
          "No fue posible guardar el movimiento."
      );
      setTipoMensaje("error");
    } finally {
      setGuardando(false);
    }
  };

  const editarMovimiento = async (
    movimientoId,
    cambios
  ) => {
    try {
      setGuardando(true);
      setMensaje("");
      setTipoMensaje("");

      await actualizarMovimientoTesoreria(
        movimientoId,
        cambios
      );

      if (onMovimientoGuardado) {
        await onMovimientoGuardado();
      }

      setMensaje(
        "Movimiento actualizado correctamente."
      );
      setTipoMensaje("exito");
    } catch (error) {
      console.error("Error al actualizar:", error);
      setMensaje(
        error?.message ||
          "No fue posible actualizar el movimiento."
      );
      setTipoMensaje("error");
    } finally {
      setGuardando(false);
    }
  };

  const eliminarMovimiento = async (
    movimientoId
  ) => {
    try {
      setGuardando(true);
      setMensaje("");
      setTipoMensaje("");

      await eliminarMovimientoTesoreria(
        movimientoId
      );

      if (onMovimientoGuardado) {
        await onMovimientoGuardado();
      }

      setMensaje(
        "Movimiento cancelado correctamente."
      );
      setTipoMensaje("exito");
    } catch (error) {
      console.error("Error al cancelar:", error);
      setMensaje(
        error?.message ||
          "No fue posible cancelar el movimiento."
      );
      setTipoMensaje("error");
    } finally {
      setGuardando(false);
    }
  };

  const regresarAlDashboard = () => {
    if (guardando) return;

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
          Registra y consulta las entradas y salidas
          de dinero de Corporativo Monys.
        </p>
      </section>

             <ResumenBancario
        resumen={resumenBancario}
        cargando={cargandoSaldos}
        error={errorSaldos}
        formatoDinero={formatoDinero}
      />

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
            {tipoMensaje === "exito"
              ? "✅ "
              : "⚠️ "}
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
          <>
            {movimientosPorAclarar.length > 0 && (
              <section
                role="alert"
                style={{
                  maxWidth: "900px",
                  margin: "20px auto",
                  padding: "18px 20px",
                  border: "1px solid #e6a23c",
                  borderRadius: "14px",
                  background: "#fff8e8",
                  color: "#7a4b00",
                  boxSizing: "border-box",
                }}
              >
                <strong
                  style={{
                    display: "block",
                    fontSize: "18px",
                    marginBottom: "6px",
                  }}
                >
                  ⚠️ {movimientosPorAclarar.length}{" "}
                  {movimientosPorAclarar.length === 1
                    ? "salida necesita"
                    : "salidas necesitan"}{" "}
                  aclaración
                </strong>

                <span>
                  Falta explicar para qué salió el dinero
                  o quién lo recibió. MONYS mantendrá estos
                  movimientos pendientes hasta confirmar
                  la información.
                </span>
              </section>
            )}

            <HistorialMovimientos
              movimientos={movimientos}
              formatoDinero={formatoDinero}
              onCambiarEstado={onCambiarEstado}
              onEditarMovimiento={
                editarMovimiento
              }
              onEliminarMovimiento={
                eliminarMovimiento
              }
            />
          </>
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