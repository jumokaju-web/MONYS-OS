import { useState } from "react";

import {
  crearLineaDemanda,
  MOTIVOS_DEMANDA,
} from "../../valor/demandaNoAtendida";
import { guardarCierreTurno } from "../services/cierresTurnoService";

const formularioInicial = {
  producto: "",
  unidades: "1",
  motivo: "agotado",
  compraNoRealizada: "si",
  precio: "",
};

export default function RegistroProductoSolicitado({ branchId = null, usuario = null }) {
  const [formulario, setFormulario] = useState(formularioInicial);
  const [guardando, setGuardando] = useState(false);
  const [mensaje, setMensaje] = useState("");
  const [error, setError] = useState("");
  const [ultimoRegistro, setUltimoRegistro] = useState(null);

  function actualizar(campo, valor) {
    setFormulario((actual) => ({ ...actual, [campo]: valor }));
    setMensaje("");
    setError("");
  }

  async function registrar(event) {
    event.preventDefault();
    const responsable = String(usuario?.nombre || "").trim();

    if (!branchId) {
      setError("No pudimos identificar tu sucursal. Avisa a Dirección para corregir tu acceso antes de enviar la solicitud.");
      return;
    }

    if (!responsable) {
      setError("No pudimos identificar quién está registrando la solicitud.");
      return;
    }

    try {
      setGuardando(true);
      setError("");
      setMensaje("");

      const linea = crearLineaDemanda(formulario);
      await guardarCierreTurno({
        branchId,
        responsable,
        turno: "solicitud_producto",
        productosSolicitados: linea,
        observaciones:
          "Registro inmediato de demanda no atendida desde Operación de tienda.",
      });

      setUltimoRegistro({
        producto: formulario.producto.trim(),
        unidades: Number(formulario.unidades),
      });
      setFormulario(formularioInicial);
      setMensaje(
        "Solicitud enviada a Dirección. MONYS la sumará por producto y sucursal para decidir cuándo revisar traslado o compra.",
      );
    } catch (errorRegistro) {
      setError(
        errorRegistro?.message || "No pudimos guardar el producto solicitado.",
      );
    } finally {
      setGuardando(false);
    }
  }

  return (
    <section className="employee-demand" aria-labelledby="employee-demand-title">
      <div className="employee-demand__heading">
        <span className="employee-demand__eyebrow">DEMANDA REAL DE CLIENTES</span>
        <h2 id="employee-demand-title">¿Pidieron algo que no tenemos?</h2>
        <p>
          Regístralo en el momento. No escribas datos del cliente; solo el producto,
          cuántas piezas pidió y por qué no se concretó.
        </p>
      </div>

      <form onSubmit={registrar} className="employee-demand__form">
        <label className="employee-demand__wide">
          Producto, marca, tono o variante
          <input
            value={formulario.producto}
            maxLength={180}
            required
            placeholder="Ej. Base Pink Up tono 03"
            onChange={(event) => actualizar("producto", event.target.value)}
          />
        </label>

        <label>
          Piezas que pidió
          <input
            type="number"
            inputMode="numeric"
            min="1"
            max="10000"
            step="1"
            required
            value={formulario.unidades}
            onChange={(event) => actualizar("unidades", event.target.value)}
          />
        </label>

        <label>
          ¿Qué pasó?
          <select
            value={formulario.motivo}
            onChange={(event) => actualizar("motivo", event.target.value)}
          >
            {Object.entries(MOTIVOS_DEMANDA).map(([valor, etiqueta]) => (
              <option key={valor} value={valor}>
                {etiqueta}
              </option>
            ))}
          </select>
        </label>

        <label>
          ¿Se fue sin comprarlo?
          <select
            value={formulario.compraNoRealizada}
            onChange={(event) =>
              actualizar("compraNoRealizada", event.target.value)
            }
          >
            <option value="si">Sí, no se realizó la compra</option>
            <option value="no">No, encontró otra opción</option>
            <option value="pendiente">No estoy segura</option>
          </select>
        </label>

        <label>
          Precio aproximado (opcional)
          <input
            type="number"
            inputMode="decimal"
            min="0"
            step="0.01"
            placeholder="Déjalo vacío si no lo sabes"
            value={formulario.precio}
            onChange={(event) => actualizar("precio", event.target.value)}
          />
        </label>

        <button type="submit" disabled={guardando} className="employee-demand__submit">
          {guardando ? "Guardando…" : "Guardar producto solicitado"}
        </button>
      </form>

      {error && <p className="employee-demand__error" role="alert">{error}</p>}
      {mensaje && <p className="employee-demand__success" role="status">✅ {mensaje}</p>}
      {ultimoRegistro && (
        <p className="employee-demand__last">
          Último registro: <strong>{ultimoRegistro.producto}</strong> · {ultimoRegistro.unidades}{" "}
          {ultimoRegistro.unidades === 1 ? "pieza" : "piezas"}.
        </p>
      )}

      <div className="employee-demand__route">
        <strong>¿Qué hará MONYS con esto?</strong>
        <span>1. Agrupa las solicitudes repetidas.</span>
        <span>2. Revisa traslado entre sucursales antes de comprar.</span>
        <span>3. Marca qué revisar hoy, esta semana o seguir observando.</span>
      </div>
    </section>
  );
}
