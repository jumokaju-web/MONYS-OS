import { useState } from "react";
import "./FormularioMovimiento.css";

const datosIniciales = {
  tipo: "salida",
  monto: "",
  concepto: "",
  negocio: "Monys Glam",
  sucursal: "Centro",
  metodoPago: "Efectivo",
  cuenta: "",
  expense_category: "",
  expense_behavior: "",
  entregadoPor: "",
  recibidoPor: "",
  observaciones: "",
};

const categoriasGasto = [
  ["compras_inventario", "Compra de inventario"],
  ["renta", "Renta"],
  ["nomina", "Nómina"],
  ["servicios", "Servicios"],
  ["marketing", "Marketing"],
  ["transporte", "Transporte"],
  ["impuestos", "Impuestos"],
  ["mantenimiento", "Mantenimiento"],
  ["papeleria", "Papelería"],
  ["comisiones", "Comisiones"],
  ["anticipo_prestamo", "Anticipo o préstamo"],
  ["retiro_propietaria", "Retiro de propietaria"],
  ["otro", "Otro"],
];

export default function FormularioMovimiento({
  tipoInicial = "salida",
  onGuardar,
  onCancelar,
}) {
  const [formulario, setFormulario] = useState({
    ...datosIniciales,
    tipo: tipoInicial,
  });

  const [comprobante, setComprobante] = useState(null);
  const [mensaje, setMensaje] = useState("");
  const [guardando, setGuardando] = useState(false);

  const esSalida = formulario.tipo === "salida";

  const cambiarCampo = (evento) => {
    const { name, value } = evento.target;

    setFormulario((datosAnteriores) => ({
      ...datosAnteriores,
      [name]: value,
    }));

    setMensaje("");
  };

  const cambiarTipo = (tipo) => {
    setFormulario((anterior) => ({
      ...anterior,
      tipo,
      expense_category:
        tipo === "salida"
          ? anterior.expense_category
          : "",
      expense_behavior:
        tipo === "salida"
          ? anterior.expense_behavior
          : "no_aplica",
    }));

    setMensaje("");
  };

  const cambiarComprobante = (evento) => {
    const archivo =
      evento.target.files?.[0] || null;

    setComprobante(archivo);
  };

  const limpiarFormulario = () => {
    setFormulario({
      ...datosIniciales,
      tipo: tipoInicial,
    });

    setComprobante(null);
    setMensaje("");

    const inputArchivo =
      document.getElementById(
        "comprobante-movimiento"
      );

    if (inputArchivo) {
      inputArchivo.value = "";
    }
  };

  const guardarMovimiento = async (evento) => {
    evento.preventDefault();

    const montoNumerico = Number(
      formulario.monto
    );

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
        "Escribe en qué se usó el dinero."
      );
      return;
    }

    const conceptoNormalizado =
      formulario.concepto
        .trim()
        .replace(/\s+/g, " ");

    if (
      esSalida &&
      conceptoNormalizado.split(" ").length < 2
    ) {
      setMensaje(
        "Explica mejor para qué salió el dinero. No escribas solamente un nombre o una palabra."
      );
      return;
    }

    const conceptosNoPermitidos = [
      "sin comentario",
      "movimiento sin comentario",
      "movimiento de caja sin comentario",
      "salida sin comentario",
    ];

    if (
      esSalida &&
      conceptosNoPermitidos.includes(
        conceptoNormalizado.toLowerCase()
      )
    ) {
      setMensaje(
        "La salida necesita una explicación real. Escribe para qué fue el dinero."
      );
      return;
    }

    if (
      esSalida &&
      !formulario.recibidoPor.trim()
    ) {
      setMensaje(
        "Escribe quién recibió el dinero."
      );
      return;
    }

    if (
      esSalida &&
      !formulario.expense_category
    ) {
      setMensaje(
        "Selecciona la categoría del gasto."
      );
      return;
    }

    if (
      esSalida &&
      !formulario.expense_behavior
    ) {
      setMensaje(
        "Indica si el gasto es fijo o variable."
      );
      return;
    }
 
        if (
      !formulario.cuenta
    ) {
      setMensaje(
        "Selecciona de qué cuenta salió o entró el dinero."
      );
      return;
    }

    const movimiento = {
      ...formulario,
      monto: montoNumerico,
      expense_category: esSalida
        ? formulario.expense_category
        : null,
      expense_behavior: esSalida
        ? formulario.expense_behavior
        : "no_aplica",
      comprobante,
      fechaRegistro:
        new Date().toISOString(),
    };

    try {
      setGuardando(true);
      setMensaje("");

      if (
        typeof onGuardar === "function"
      ) {
        await onGuardar(movimiento);
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
    } finally {
      setGuardando(false);
    }
  };

  const cancelarFormulario = () => {
    limpiarFormulario();

    if (
      typeof onCancelar === "function"
    ) {
      onCancelar();
    }
  };

  return (
    <form
      className="formulario-movimiento gasto-rapido"
      onSubmit={guardarMovimiento}
    >
      <div className="gasto-rapido-encabezado">
        <span className="gasto-rapido-icono">
          {esSalida ? "💸" : "💰"}
        </span>

        <div>
          <p className="gasto-rapido-etiqueta">
            TESORERÍA
          </p>

          <h2>
            {esSalida
              ? "Gasto rápido"
              : "Entrada rápida"}
          </h2>

          <p className="gasto-rapido-ayuda">
            Registra el movimiento en pocos
            segundos.
          </p>
        </div>
      </div>

      <div className="tipo-movimiento-selector">
        <button
          type="button"
          className={
            formulario.tipo === "salida"
              ? "tipo-opcion activa"
              : "tipo-opcion"
          }
          onClick={() =>
            cambiarTipo("salida")
          }
        >
          💸 Salió dinero
        </button>

        <button
          type="button"
          className={
            formulario.tipo === "entrada"
              ? "tipo-opcion activa"
              : "tipo-opcion"
          }
          onClick={() =>
            cambiarTipo("entrada")
          }
        >
          💰 Entró dinero
        </button>
      </div>

      <div className="form-grid">
        <div className="campo campo-monto campo-completo">
          <label htmlFor="monto">
            Monto
          </label>

          <div className="monto-contenedor">
            <span>$</span>

            <input
              id="monto"
              name="monto"
              type="number"
              inputMode="decimal"
              min="0.01"
              step="0.01"
              placeholder="0.00"
              value={formulario.monto}
              onChange={cambiarCampo}
              required
            />
          </div>
        </div>

        <div className="campo campo-completo">
          <label htmlFor="concepto">
            {esSalida
              ? "¿En qué se usó?"
              : "¿De dónde entró?"}
          </label>

          <input
            id="concepto"
            name="concepto"
            type="text"
            placeholder={
              esSalida
                ? "Ej. Pago proveedor, gasolina, papelería"
                : "Ej. Depósito, recuperación de préstamo"
            }
            value={formulario.concepto}
            onChange={cambiarCampo}
            required
          />
        </div>

        {esSalida && (
          <div className="campo campo-completo">
            <label htmlFor="recibidoPor">
              ¿Quién recibió el dinero?
            </label>

            <input
              id="recibidoPor"
              name="recibidoPor"
              type="text"
              placeholder="Ej. Proveedor, empleado o Mónica"
              value={formulario.recibidoPor}
              onChange={cambiarCampo}
              required
            />
          </div>
        )}

        {esSalida && (
          <>
            <div className="campo">
              <label htmlFor="expense_category">
                Categoría del gasto
              </label>

              <select
                id="expense_category"
                name="expense_category"
                value={
                  formulario.expense_category
                }
                onChange={cambiarCampo}
                required
              >
                <option value="">
                  Selecciona categoría
                </option>

                {categoriasGasto.map(
                  ([valor, etiqueta]) => (
                    <option
                      key={valor}
                      value={valor}
                    >
                      {etiqueta}
                    </option>
                  )
                )}
              </select>
            </div>

            <div className="campo">
              <label htmlFor="expense_behavior">
                Tipo de gasto
              </label>

              <select
                id="expense_behavior"
                name="expense_behavior"
                value={
                  formulario.expense_behavior
                }
                onChange={cambiarCampo}
                required
              >
                <option value="">
                  Selecciona tipo
                </option>

                <option value="fijo">
                  Fijo
                </option>

                <option value="variable">
                  Variable
                </option>

                <option value="no_aplica">
                  No aplica
                </option>
              </select>
            </div>
          </>
        )}

        <div className="campo">
          <label htmlFor="metodoPago">
            Forma de pago
          </label>

          <select
            id="metodoPago"
            name="metodoPago"
            value={formulario.metodoPago}
            onChange={cambiarCampo}
            required
          >
            <option value="Efectivo">
              Efectivo
            </option>

            <option value="Transferencia">
              Transferencia
            </option>

            <option value="Tarjeta">
              Tarjeta
            </option>

            <option value="Depósito bancario">
              Depósito bancario
            </option>

            <option value="Otro">
              Otro
            </option>
          </select>
        </div>

                 <div className="campo">
          <label htmlFor="cuenta">
            ¿De qué cuenta salió o entró?
          </label>

          <select
            id="cuenta"
            name="cuenta"
            value={formulario.cuenta}
            onChange={cambiarCampo}
            required
          >
            <option value="">
              Selecciona una cuenta
            </option>

            <option value="BBVA Mónica">
              BBVA Mónica
            </option>

            <option value="BBVA Ana Karina">
              BBVA Ana Karina
            </option>

            <option value="Efectivo caja Centro">
              Efectivo caja Centro
            </option>

            <option value="Efectivo caja General Anaya">
              Efectivo caja General Anaya
            </option>

            <option value="Efectivo acumulado Mónica">
              Efectivo acumulado Mónica
            </option>

            <option value="Dinero personal de Mónica">
              Dinero personal de Mónica
            </option>
          </select>
        </div>


        <div className="campo">
          <label htmlFor="negocio">
            Negocio
          </label>

          <select
            id="negocio"
            name="negocio"
            value={formulario.negocio}
            onChange={cambiarCampo}
            required
          >
            <option value="Monys Glam">
              Monys Glam
            </option>

            <option value="Flotilla Jiménez">
              Flotilla Jiménez
            </option>
          </select>
        </div>

        <div className="campo campo-completo">
          <label htmlFor="sucursal">
            Sucursal / área
          </label>

          <select
            id="sucursal"
            name="sucursal"
            value={formulario.sucursal}
            onChange={cambiarCampo}
            required
          >
            <option value="Centro">
              Centro
            </option>

            <option value="General Anaya">
              General Anaya
            </option>

            <option value="Corporativo">
              Corporativo
            </option>
          </select>
        </div>

        <div className="campo campo-completo">
          <label htmlFor="comprobante-movimiento">
            Foto o comprobante
            <span className="opcional">
              {" "}
              Opcional
            </span>
          </label>

          <input
            id="comprobante-movimiento"
            name="comprobante"
            type="file"
            accept="image/*,.pdf"
            onChange={cambiarComprobante}
          />
        </div>
      </div>

      {mensaje && (
        <p
          className="mensaje-formulario"
          role="alert"
          aria-live="polite"
        >
          {mensaje}
        </p>
      )}

      <div className="botones">
        <button
          className="btn-cancelar"
          type="button"
          onClick={cancelarFormulario}
          disabled={guardando}
        >
          Cancelar
        </button>

        <button
          className="btn-guardar"
          type="submit"
          disabled={guardando}
        >
          {guardando
            ? "Guardando..."
            : esSalida
              ? "Guardar gasto"
              : "Guardar entrada"}
        </button>
      </div>
    </form>
  );
}
