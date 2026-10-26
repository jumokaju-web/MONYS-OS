import { useState } from "react";
import {
  abrirComprobanteRetiro,
  guardarReporteRetiro,
  revisarReporteRetiro,
} from "../services/comprobacionesRetirosService.js";

const dinero = new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" });
const ETIQUETA = {
  PENDIENTE: "Falta comprobante",
  REPORTADO: "Reportado · falta revisar",
  COMPROBADO: "Comprobado",
  DIFERENCIA: "Diferencia por aclarar",
};

export default function ComprobacionRetiroCard({ retiro, puedeRevisar, onActualizado }) {
  const [formulario, setFormulario] = useState({ destinoReal: "", referencia: "", evidencia: null, nota: "" });
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState("");
  const comprobacion = retiro.comprobacion;

  function cambiar(campo, valor) {
    setFormulario((actual) => ({ ...actual, [campo]: valor }));
  }

  async function reportar(evento) {
    evento.preventDefault();
    setError(""); setGuardando(true);
    try {
      await guardarReporteRetiro({ retiro, ...formulario });
      setFormulario({ destinoReal: "", referencia: "", evidencia: null, nota: "" });
      await onActualizado?.("Comprobante reportado. Todavía requiere revisión de Dirección.");
    } catch (e) { setError(e?.message || "No fue posible reportar el comprobante."); }
    finally { setGuardando(false); }
  }

  async function revisar(estado) {
    setError(""); setGuardando(true);
    try {
      await revisarReporteRetiro({ comprobacion, estado, nota: formulario.nota });
      await onActualizado?.(estado === "COMPROBADO" ? "Retiro comprobado." : "Diferencia registrada para aclaración.");
    } catch (e) { setError(e?.message || "No fue posible revisar el comprobante."); }
    finally { setGuardando(false); }
  }

  async function abrir() {
    try { window.open(await abrirComprobanteRetiro(comprobacion.evidencia_path), "_blank", "noopener,noreferrer"); }
    catch (e) { setError(e?.message || "No fue posible abrir el comprobante."); }
  }

  return <article className={`comprobacion-retiro es-${retiro.estadoComprobacion.toLowerCase()}`}>
    <header>
      <div><b>{retiro.cajaId.replaceAll("_", " ")} · {dinero.format(retiro.monto)}</b><small>{retiro.etiquetaDestino || "Destino declarado pendiente"}</small></div>
      <span>{ETIQUETA[retiro.estadoComprobacion]}</span>
    </header>
    {comprobacion ? <div className="comprobacion-retiro__detalle">
      <p><strong>Destino real:</strong> {comprobacion.destino_real}</p>
      <p><strong>Referencia:</strong> {comprobacion.referencia}</p>
      <small>Reportó {comprobacion.registrado_nombre}{comprobacion.verificado_nombre ? ` · Revisó ${comprobacion.verificado_nombre}` : ""}</small>
      <button type="button" onClick={abrir}>Ver comprobante</button>
    </div> : null}

    {retiro.estadoComprobacion !== "COMPROBADO" && retiro.cierreId ? <details open={!comprobacion}>
      <summary>{comprobacion ? "Reemplazar evidencia" : "Agregar comprobante"}</summary>
      <form onSubmit={reportar}>
        <label>¿Dónde quedó realmente?<input required maxLength="200" value={formulario.destinoReal} onChange={(e) => cambiar("destinoReal", e.target.value)} placeholder="Ej. Depósito BBVA o pago a proveedor" /></label>
        <label>Folio o referencia<input required maxLength="200" value={formulario.referencia} onChange={(e) => cambiar("referencia", e.target.value)} placeholder="Folio, proveedor o lugar de resguardo" /></label>
        <label>Foto o archivo<input required type="file" accept="image/*,.pdf" onChange={(e) => cambiar("evidencia", e.target.files?.[0] || null)} /></label>
        <button type="submit" disabled={guardando}>{guardando ? "Guardando…" : "Reportar evidencia"}</button>
      </form>
    </details> : null}

    {puedeRevisar && retiro.estadoComprobacion === "REPORTADO" ? <div className="comprobacion-retiro__revision">
      <label>Resultado de la revisión<textarea required minLength="5" maxLength="1000" value={formulario.nota} onChange={(e) => cambiar("nota", e.target.value)} placeholder="Qué comparaste y qué encontraste" /></label>
      <div><button type="button" disabled={guardando || formulario.nota.trim().length < 5} onClick={() => revisar("COMPROBADO")}>✓ Comprobar</button><button type="button" disabled={guardando || formulario.nota.trim().length < 5} onClick={() => revisar("DIFERENCIA")}>Marcar diferencia</button></div>
    </div> : null}
    {!retiro.cierreId && <p className="comprobacion-retiro__aviso">Este total histórico no tiene desglose por cierre. Debe aclararse desde la revisión del corte.</p>}
    {error && <p className="comprobacion-retiro__error" role="alert">{error}</p>}
  </article>;
}
