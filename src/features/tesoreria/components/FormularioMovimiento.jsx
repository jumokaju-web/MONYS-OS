import { useState } from "react";
import "./FormularioMovimiento.css";

const datosIniciales = {
  tipo: "entrada",
  monto: "",
  concepto: "",
  negocio: "Monys Glam",
  sucursal: "Centro",
  metodoPago: "Efectivo",
  entregadoPor: "",
  recibidoPor: "",
  observaciones: "",
};

export default function FormularioMovimiento({
  tipoInicial = "entrada",
  onGuardar,
  onCancelar,
}) {
  const [formulario, setFormulario] = useState({
    ...datosIniciales,
    tipo: tipoInicial,
  });

  const [comprobante, setComprobante] = useState(null);
  const [mensaje, setMensaje] = useState("");

  const cambiarCampo = (evento) => {
    const { name, value } = evento.target;

    setFormulario((datosAnteriores) => ({
      ...datosAnteriores,
      [name]: value,
    }));

    setMensaje("");
  };

  const cambiarComprobante = (evento) => {
    const archivo = evento.target.files?.[0] || null;
    setComprobante(archivo);
  };

  const limpiarFormulario = () => {
    setFormulario({
      ...datosIniciales,
      tipo: tipoInicial,
    });

    setComprobante(null);
    setMensaje("");

    const inputArchivo = document.getElementById(
      "comprobante-movimiento"
    );

    if (inputArchivo) {
      inputArchivo.value = "";
    }
  };

       const guardarMovimiento = async (evento) => {
    evento.preventDefault();

    const montoNumerico =
      Number(formulario.monto);

    if (
      !formulario.monto ||
      montoNumerico <= 0
    ) {
      setMensaje(
        "Escribe un monto mayor a cero."
      );

      return;
    }

    if (
      !formulario.concepto.trim()
    ) {
      setMensaje(
        "Escribe el concepto del movimiento."
      );

      return;
    }

    const movimiento = {
      ...formulario,

      monto:
        montoNumerico,

      comprobante,

      fechaRegistro:
        new Date().toISOString(),
    };

    try {
      setMensaje("");

      if (
        typeof onGuardar ===
        "function"
      ) {
        await onGuardar(
          movimiento
        );
      } else {
        console.log(
          "Movimiento preparado:",
          movimiento
        );
      }

      limpiarFormulario();
    } catch (error) {
      console.error(
        "No fue posible guardar el movimiento:",
        error
      );

      setMensaje(
        error?.message ||
          "No fue posible guardar el movimiento."
      );
    }
  };

  const cancelarFormulario = () => {
    limpiarFormulario();

    if (typeof onCancelar === "function") {
      onCancelar();
    }
  };

  return (
    <form
      className="formulario-movimiento"
      onSubmit={guardarMovimiento}
    >
      <h2>Formulario de Movimiento</h2>

      <div className="form-grid">
        <div className="campo">
          <label htmlFor="tipo">Tipo de movimiento</label>

          <select
            id="tipo"
            name="tipo"
            value={formulario.tipo}
            onChange={cambiarCampo}
            required
          >
            <option value="entrada">Entrada de dinero</option>
            <option value="salida">Salida de dinero</option>
          </select>
        </div>

        <div className="campo">
          <label htmlFor="monto">Monto</label>

          <input
            id="monto"
            name="monto"
            type="number"
            min="0.01"
            step="0.01"
            placeholder="Ejemplo: 1,500.00"
            value={formulario.monto}
            onChange={cambiarCampo}
            required
          />
        </div>

        <div className="campo campo-completo">
          <label htmlFor="concepto">Concepto</label>

          <input
            id="concepto"
            name="concepto"
            type="text"
            placeholder="Ejemplo: Venta del día o pago a proveedor"
            value={formulario.concepto}
            onChange={cambiarCampo}
            required
          />
        </div>

        <div className="campo">
          <label htmlFor="negocio">Negocio</label>

          <select
            id="negocio"
            name="negocio"
            value={formulario.negocio}
            onChange={cambiarCampo}
            required
          >
            <option value="Monys Glam">Monys Glam</option>
            <option value="Flotilla Jiménez">
              Flotilla Jiménez
            </option>
          </select>
        </div>

        <div className="campo">
          <label htmlFor="sucursal">Sucursal</label>

          <select
            id="sucursal"
            name="sucursal"
            value={formulario.sucursal}
            onChange={cambiarCampo}
            required
          >
            <option value="Centro">Centro</option>
            <option value="General Anaya">General Anaya</option>
            <option value="Corporativo">Corporativo</option>
          </select>
        </div>

        <div className="campo">
          <label htmlFor="metodoPago">Método de pago</label>

          <select
            id="metodoPago"
            name="metodoPago"
            value={formulario.metodoPago}
            onChange={cambiarCampo}
            required
          >
            <option value="Efectivo">Efectivo</option>
            <option value="Transferencia">Transferencia</option>
            <option value="Tarjeta">Tarjeta</option>
            <option value="Depósito bancario">
              Depósito bancario
            </option>
            <option value="Otro">Otro</option>
          </select>
        </div>

        <div className="campo">
          <label htmlFor="entregadoPor">Entregado por</label>

          <input
            id="entregadoPor"
            name="entregadoPor"
            type="text"
            placeholder="Nombre de quien entrega"
            value={formulario.entregadoPor}
            onChange={cambiarCampo}
          />
        </div>

        <div className="campo">
          <label htmlFor="recibidoPor">Recibido por</label>

          <input
            id="recibidoPor"
            name="recibidoPor"
            type="text"
            placeholder="Nombre de quien recibe"
            value={formulario.recibidoPor}
            onChange={cambiarCampo}
          />
        </div>

        <div className="campo">
          <label htmlFor="comprobante-movimiento">
            Comprobante
          </label>

          <input
            id="comprobante-movimiento"
            name="comprobante"
            type="file"
            accept="image/*,.pdf"
            onChange={cambiarComprobante}
          />
        </div>

        <div className="campo campo-completo">
          <label htmlFor="observaciones">Observaciones</label>

          <textarea
            id="observaciones"
            name="observaciones"
            placeholder="Escribe cualquier detalle importante del movimiento"
            value={formulario.observaciones}
            onChange={cambiarCampo}
          />
        </div>
      </div>

      {mensaje && (
        <p role="alert" aria-live="polite">
          {mensaje}
        </p>
      )}

      <div className="botones">
        <button
          className="btn-cancelar"
          type="button"
          onClick={cancelarFormulario}
        >
          Cancelar
        </button>

        <button className="btn-guardar" type="submit">
          Guardar movimiento
        </button>
      </div>
    </form>
  );
}