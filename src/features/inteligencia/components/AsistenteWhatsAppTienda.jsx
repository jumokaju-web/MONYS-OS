import { useMemo, useState } from "react";
import { construirRespuestaWhatsAppTienda } from "../shared/respuestaWhatsAppTienda";
import { crearOportunidadCRM, registrarInteraccionCRM } from "../services/crmService";

export default function AsistenteWhatsAppTienda({ usuario, organizationId, businessId, branchId }) {
  const [cliente, setCliente] = useState("");
  const [telefono, setTelefono] = useState("");
  const [mensajeCliente, setMensajeCliente] = useState("");
  const [producto, setProducto] = useState("");
  const [disponibilidad, setDisponibilidad] = useState("PENDIENTE");
  const [precioConfirmado, setPrecioConfirmado] = useState("");
  const [preparada, setPreparada] = useState(false);
  const [mensaje, setMensaje] = useState("");
  const [guardandoCRM, setGuardandoCRM] = useState(false);
  const [guardadaCRM, setGuardadaCRM] = useState(false);
  const resultado = useMemo(() => construirRespuestaWhatsAppTienda({
    mensajeCliente,
    producto,
    disponibilidad,
    precioConfirmado,
    sucursal: usuario?.sucursal || "General Anaya",
  }), [disponibilidad, mensajeCliente, precioConfirmado, producto, usuario?.sucursal]);

  function preparar(event) {
    event.preventDefault();
    setPreparada(true);
    setMensaje("");
    setGuardadaCRM(false);
  }

  async function copiar() {
    try {
      await navigator.clipboard.writeText(resultado.respuesta);
      setMensaje("Respuesta copiada. Revísala en WhatsApp antes de enviarla.");
    } catch {
      setMensaje("No se pudo copiar automáticamente. Mantén presionado el texto para copiarlo.");
    }
  }

  async function guardarEnCRM() {
    setMensaje("");
    setGuardandoCRM(true);
    let oportunidad = null;
    try {
      const creada = await crearOportunidadCRM({
        organizationId,
        businessId,
        branchId,
        cliente,
        telefono,
        canal: "WHATSAPP",
        etapa: "CONTACTADO",
        productoInteres: producto,
        empleado: usuario?.empleado_id && usuario?.auth_user_id ? {
          id: usuario.empleado_id,
          usuario_id: usuario.auth_user_id,
          nombre: usuario.nombre,
        } : null,
        notas: "Conversación iniciada desde el asistente de WhatsApp de tienda. La respuesta preparada requiere revisión humana.",
      });
      oportunidad = creada.oportunidad;
      await registrarInteraccionCRM({
        oportunidadId: oportunidad.id,
        organizationId,
        businessId,
        branchId,
        canal: "WHATSAPP",
        direccion: "ENTRANTE",
        mensaje: mensajeCliente,
      });
      await registrarInteraccionCRM({
        oportunidadId: oportunidad.id,
        organizationId,
        businessId,
        branchId,
        canal: "WHATSAPP",
        direccion: "NOTA",
        mensaje: `BORRADOR NO ENVIADO · ${resultado.respuesta}`,
      });
      setGuardadaCRM(true);
      setMensaje("Clienta y conversación guardadas en el CRM. El borrador sigue pendiente de envío.");
    } catch (error) {
      setMensaje(oportunidad
        ? `La clienta se guardó, pero faltó completar el historial: ${error?.message || "error de conexión"}. Dirección debe revisarlo.`
        : error?.message || "No se pudo guardar la conversación en el CRM.");
    } finally {
      setGuardandoCRM(false);
    }
  }

  return <section className="tienda-whatsapp" aria-labelledby="tienda-whatsapp-title">
    <div className="tienda-whatsapp__regla">
      <b>PRIORIDAD REAL</b>
      <p>Si llega una clienta a la tienda, pausa WhatsApp y atiéndela. MONYS prepara el texto, pero tú decides y lo envías.</p>
    </div>
    <form onSubmit={preparar}>
      <label>Nombre de la clienta
        <input required value={cliente} onChange={(event) => { setCliente(event.target.value); setGuardadaCRM(false); }} placeholder="Como aparece en WhatsApp" />
      </label>
      <label>Teléfono, si está disponible
        <input value={telefono} onChange={(event) => { setTelefono(event.target.value); setGuardadaCRM(false); }} inputMode="tel" autoComplete="tel" placeholder="No inventar si no aparece" />
      </label>
      <label>Mensaje de la clienta
        <textarea required rows={4} value={mensajeCliente} onChange={(event) => { setMensajeCliente(event.target.value); setPreparada(false); }} placeholder="Pega aquí lo que te preguntaron…" />
      </label>
      <label>Producto exacto, si ya lo identificaste
        <input value={producto} onChange={(event) => { setProducto(event.target.value); setPreparada(false); }} placeholder="Nombre, tono, código o presentación" />
      </label>
      <label>Existencia
        <select value={disponibilidad} onChange={(event) => { setDisponibilidad(event.target.value); setPreparada(false); }}>
          <option value="PENDIENTE">Pendiente de revisar físicamente</option>
          <option value="CONFIRMADA">Disponible · ya la confirmé</option>
          <option value="AGOTADA_CONFIRMADA">Agotado · ya lo confirmé</option>
        </select>
      </label>
      <label>Precio confirmado, si ya lo revisaste
        <input type="number" min="0.01" step="0.01" inputMode="decimal" value={precioConfirmado} onChange={(event) => { setPrecioConfirmado(event.target.value); setPreparada(false); }} placeholder="Déjalo vacío si falta confirmar" />
      </label>
      <button type="submit">Preparar respuesta →</button>
    </form>

    {preparada && <article className="tienda-whatsapp__respuesta">
      <span>BORRADOR · REQUIERE TU REVISIÓN</span>
      <p id="tienda-whatsapp-title">{resultado.respuesta}</p>
      {resultado.faltantes.length > 0 && <small>PENDIENTE: {resultado.faltantes.join(", ")}. MONYS no lo convirtió en cero ni lo presentó como confirmado.</small>}
      <button type="button" onClick={copiar}>Copiar respuesta</button>
      <button type="button" className="is-secondary" onClick={guardarEnCRM} disabled={guardandoCRM || guardadaCRM || !organizationId || !businessId || !cliente.trim()}>{guardandoCRM ? "Guardando…" : guardadaCRM ? "Guardado en CRM" : "Guardar clienta y conversación"}</button>
    </article>}
    {mensaje && <p className="tienda-whatsapp__mensaje" role="status">{mensaje}</p>}
    <footer>Esta herramienta todavía no lee ni envía mensajes directamente. El CRM conserva el mensaje y el borrador, pero no registra una venta sin folio SICAR.</footer>
  </section>;
}
