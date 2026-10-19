import { useCallback, useEffect, useMemo, useState } from "react";
import {
  analizarConversacionWhatsApp,
  construirSeguimientoWhatsApp,
  prepararBandejaWhatsApp,
} from "../shared/vendedorExpertoWhatsApp";
import {
  buscarOportunidadWhatsAppAbierta,
  confirmarRespuestaEnviadaCRM,
  crearOportunidadCRM,
  listarInteraccionesCRM,
  listarOportunidadesCRM,
  programarSeguimientoCRM,
  registrarInteraccionCRM,
} from "../services/crmService";

const ETIQUETAS_ESTADO = {
  RESPONDER_AHORA: "Responder ahora",
  SEGUIMIENTO_HOY: "Seguimiento pendiente",
  PROGRAMADA: "Programada",
  ESPERANDO_CLIENTA: "Esperando clienta",
  SIN_SIGUIENTE_PASO: "Falta siguiente paso",
};

function fechaMexico() {
  const partes = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Mexico_City",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const valor = Object.fromEntries(partes.map((parte) => [parte.type, parte.value]));
  return `${valor.year}-${valor.month}-${valor.day}`;
}

function sumarDias(fechaIso, dias) {
  const fecha = new Date(`${fechaIso}T12:00:00`);
  fecha.setDate(fecha.getDate() + dias);
  return [fecha.getFullYear(), String(fecha.getMonth() + 1).padStart(2, "0"), String(fecha.getDate()).padStart(2, "0")].join("-");
}

function empleadoActual(usuario) {
  const id = usuario?.empleado_id || null;
  const usuarioId = usuario?.auth_user_id || usuario?.usuario_id || null;
  return id && usuarioId ? { id, usuario_id: usuarioId, nombre: usuario?.nombre || "Equipo" } : null;
}

export default function AsistenteWhatsAppTienda({ usuario, organizationId, businessId, branchId }) {
  const [cliente, setCliente] = useState("");
  const [telefono, setTelefono] = useState("");
  const [mensajeCliente, setMensajeCliente] = useState("");
  const [producto, setProducto] = useState("");
  const [disponibilidad, setDisponibilidad] = useState("PENDIENTE");
  const [precioConfirmado, setPrecioConfirmado] = useState("");
  const [proximoSeguimiento, setProximoSeguimiento] = useState(() => sumarDias(fechaMexico(), 1));
  const [respuestaDirecta, setRespuestaDirecta] = useState("");
  const [textoFinal, setTextoFinal] = useState("");
  const [preparada, setPreparada] = useState(false);
  const [mensaje, setMensaje] = useState("");
  const [guardandoCRM, setGuardandoCRM] = useState(false);
  const [guardadaCRM, setGuardadaCRM] = useState(false);
  const [envioConfirmado, setEnvioConfirmado] = useState(false);
  const [oportunidadCRM, setOportunidadCRM] = useState(null);
  const [entradaRegistrada, setEntradaRegistrada] = useState(false);
  const [oportunidades, setOportunidades] = useState([]);
  const [interacciones, setInteracciones] = useState([]);
  const [cargandoBandeja, setCargandoBandeja] = useState(true);
  const [indice, setIndice] = useState(0);
  const [modo, setModo] = useState("BANDEJA");

  const analisis = useMemo(() => analizarConversacionWhatsApp({
    mensajeCliente,
    producto,
    disponibilidad,
    precioConfirmado,
    sucursal: usuario?.sucursal || "General Anaya",
  }), [disponibilidad, mensajeCliente, precioConfirmado, producto, usuario?.sucursal]);
  const resultado = useMemo(() => respuestaDirecta ? {
    ...analisis,
    tipo: "SEGUIMIENTO",
    prioridad: "ALTA",
    autorizacion: "EMPLEADA",
    respuesta: respuestaDirecta,
    faltantes: [],
    siguienteEtapa: oportunidadCRM?.etapa === "COTIZANDO" ? "COTIZANDO" : "CONTACTADO",
    siguientePaso: "Enviar el seguimiento y registrar la respuesta real de la clienta.",
  } : analisis, [analisis, oportunidadCRM?.etapa, respuestaDirecta]);
  const bandeja = useMemo(
    () => prepararBandejaWhatsApp(oportunidades, interacciones, fechaMexico()),
    [interacciones, oportunidades],
  );
  const indiceSeguro = Math.min(indice, Math.max(0, bandeja.length - 1));
  const activa = bandeja[indiceSeguro] || null;
  const porResponder = bandeja.filter((item) => item.estadoBandeja === "RESPONDER_AHORA").length;
  const seguimientos = bandeja.filter((item) => item.estadoBandeja === "SEGUIMIENTO_HOY").length;

  const cargarBandeja = useCallback(async (mostrarCarga = true) => {
    if (!businessId) {
      setCargandoBandeja(false);
      return;
    }
    if (mostrarCarga) setCargandoBandeja(true);
    try {
      const [lista, historial] = await Promise.all([
        listarOportunidadesCRM({ businessId }),
        listarInteraccionesCRM({ businessId }),
      ]);
      setOportunidades(lista);
      setInteracciones(historial);
    } catch (error) {
      setMensaje(error?.message || "No se pudo cargar la bandeja del CRM.");
    } finally {
      if (mostrarCarga) setCargandoBandeja(false);
    }
  }, [businessId]);

  useEffect(() => {
    cargarBandeja();
  }, [cargarBandeja]);

  function limpiarCaptura() {
    setCliente("");
    setTelefono("");
    setMensajeCliente("");
    setProducto("");
    setDisponibilidad("PENDIENTE");
    setPrecioConfirmado("");
    setProximoSeguimiento(sumarDias(fechaMexico(), 1));
    setRespuestaDirecta("");
    setTextoFinal("");
    setPreparada(false);
    setGuardadaCRM(false);
    setEnvioConfirmado(false);
    setOportunidadCRM(null);
    setEntradaRegistrada(false);
    setMensaje("");
  }

  function nuevaConversacion() {
    limpiarCaptura();
    setModo("NUEVA");
  }

  function trabajar(item) {
    setCliente(item.cliente || "");
    setTelefono(item.telefono || "");
    setProducto(item.producto_interes || "");
    setDisponibilidad("PENDIENTE");
    setPrecioConfirmado("");
    setProximoSeguimiento(item.proximo_seguimiento || sumarDias(fechaMexico(), 1));
    setOportunidadCRM(item);
    setEntradaRegistrada(true);
    setGuardadaCRM(false);
    setEnvioConfirmado(false);
    setMensaje("");
    if (item.estadoBandeja === "SEGUIMIENTO_HOY" || !item.mensajePendiente) {
      const seguimiento = construirSeguimientoWhatsApp({ cliente: item.cliente, producto: item.producto_interes, etapa: item.etapa });
      setMensajeCliente(item.mensajePendiente || "Seguimiento programado");
      setRespuestaDirecta(seguimiento);
      setTextoFinal(seguimiento);
      setPreparada(true);
    } else {
      setMensajeCliente(item.mensajePendiente);
      setRespuestaDirecta("");
      setTextoFinal("");
      setPreparada(false);
    }
    setModo("NUEVA");
  }

  function preparar(event) {
    event.preventDefault();
    setRespuestaDirecta("");
    setTextoFinal(analisis.respuesta);
    setPreparada(true);
    setMensaje("");
    setGuardadaCRM(false);
    setEnvioConfirmado(false);
  }

  async function copiar() {
    try {
      await navigator.clipboard.writeText(textoFinal);
      setMensaje("Respuesta copiada. Revísala en WhatsApp antes de enviarla.");
    } catch {
      setMensaje("No se pudo copiar automáticamente. Mantén presionado el texto para copiarlo.");
    }
  }

  async function asegurarOportunidad() {
    if (oportunidadCRM?.id) return oportunidadCRM;
    let oportunidad = await buscarOportunidadWhatsAppAbierta({ businessId, telefono });
    if (!oportunidad) {
      const creada = await crearOportunidadCRM({
        organizationId,
        businessId,
        branchId,
        cliente,
        telefono,
        canal: "WHATSAPP",
        etapa: "CONTACTADO",
        productoInteres: producto,
        empleado: empleadoActual(usuario),
        notas: "Conversación atendida desde el Vendedor Experto de MONYS. Toda respuesta requiere revisión humana.",
      });
      oportunidad = creada.oportunidad;
    }
    setOportunidadCRM(oportunidad);
    return oportunidad;
  }

  async function registrarEntradaSiHaceFalta(oportunidad) {
    if (entradaRegistrada) return;
    await registrarInteraccionCRM({
      oportunidadId: oportunidad.id,
      organizationId,
      businessId,
      branchId: oportunidad.branch_id || branchId,
      canal: "WHATSAPP",
      direccion: "ENTRANTE",
      mensaje: mensajeCliente,
    });
    setEntradaRegistrada(true);
  }

  async function guardarEnCRM() {
    setMensaje("");
    setGuardandoCRM(true);
    let oportunidad = null;
    try {
      oportunidad = await asegurarOportunidad();
      await registrarEntradaSiHaceFalta(oportunidad);
      await registrarInteraccionCRM({
        oportunidadId: oportunidad.id,
        organizationId,
        businessId,
        branchId: oportunidad.branch_id || branchId,
        canal: "WHATSAPP",
        direccion: "NOTA",
        mensaje: `BORRADOR NO ENVIADO · ${resultado.tipo} · ${textoFinal}`,
      });
      setGuardadaCRM(true);
      setMensaje("Conversación guardada. El texto sigue marcado como borrador y todavía no cuenta como enviado.");
      await cargarBandeja(false);
      return oportunidad;
    } catch (error) {
      setMensaje(oportunidad
        ? `La clienta se guardó, pero faltó completar el historial: ${error?.message || "error de conexión"}. Dirección debe revisarlo.`
        : error?.message || "No se pudo guardar la conversación en el CRM.");
      return null;
    } finally {
      setGuardandoCRM(false);
    }
  }

  async function confirmarEnviado() {
    setMensaje("");
    setGuardandoCRM(true);
    try {
      const oportunidad = oportunidadCRM?.id ? oportunidadCRM : await asegurarOportunidad();
      await registrarEntradaSiHaceFalta(oportunidad);
      if (!guardadaCRM) {
        await registrarInteraccionCRM({
          oportunidadId: oportunidad.id,
          organizationId,
          businessId,
          branchId: oportunidad.branch_id || branchId,
          canal: "WHATSAPP",
          direccion: "NOTA",
          mensaje: `BORRADOR REVISADO · ${resultado.tipo} · ${textoFinal}`,
        });
      }
      await registrarInteraccionCRM({
        oportunidadId: oportunidad.id,
        organizationId,
        businessId,
        branchId: oportunidad.branch_id || branchId,
        canal: "WHATSAPP",
        direccion: "SALIENTE",
        mensaje: textoFinal,
      });
      await confirmarRespuestaEnviadaCRM({
        id: oportunidad.id,
        etapa: resultado.siguienteEtapa === "COTIZANDO" ? "COTIZANDO" : "CONTACTADO",
        resultado: `Respuesta enviada y registrada desde Vendedor Experto: ${resultado.tipo}.`,
        proximoSeguimiento: proximoSeguimiento || null,
      });
      let avisoTarea = "";
      const responsable = empleadoActual(usuario);
      if (proximoSeguimiento && responsable) {
        const programado = await programarSeguimientoCRM({ id: oportunidad.id, fecha: proximoSeguimiento, empleado: responsable });
        avisoTarea = programado.errorTarea ? ` El seguimiento quedó en CRM, pero su tarea requiere revisión: ${programado.errorTarea}` : " Seguimiento agregado a tu agenda.";
      }
      setGuardadaCRM(true);
      setEnvioConfirmado(true);
      setMensaje(`ENVÍO CONFIRMADO: el CRM conserva el texto real y el siguiente paso.${avisoTarea}`);
      await cargarBandeja(false);
    } catch (error) {
      setMensaje(error?.message || "No se pudo confirmar el envío. El borrador no se presentó como enviado.");
    } finally {
      setGuardandoCRM(false);
    }
  }

  return <section className="tienda-whatsapp" aria-label="Vendedor experto de WhatsApp">
    <div className="tienda-whatsapp__regla">
      <b>VENDEDOR EXPERTO · CONTROL HUMANO</b>
      <p>MONYS ordena, propone y da seguimiento. Tú confirmas producto, precio, existencia y el texto que realmente se envió.</p>
    </div>

    <div className="tienda-whatsapp__tabs" role="tablist" aria-label="Vendedor experto">
      <button type="button" role="tab" aria-selected={modo === "BANDEJA"} onClick={() => setModo("BANDEJA")}>Bandeja <span>{bandeja.length}</span></button>
      <button type="button" role="tab" aria-selected={modo === "NUEVA"} onClick={nuevaConversacion}>Nueva conversación</button>
    </div>

    {modo === "BANDEJA" && <section className="tienda-whatsapp__bandeja" aria-label="Bandeja priorizada">
      <div className="tienda-whatsapp__metricas">
        <article><span>RESPONDER</span><strong>{porResponder}</strong><small>Mensaje entrante sin respuesta registrada</small></article>
        <article><span>SEGUIMIENTO</span><strong>{seguimientos}</strong><small>Vence hoy o ya está atrasado</small></article>
      </div>
      {cargandoBandeja ? <p>Cargando conversaciones…</p> : !activa ? <div className="tienda-whatsapp__vacia"><strong>No hay conversaciones asignadas.</strong><p>Esto no significa cero mensajes: todavía falta conectar el número empresarial de WhatsApp o registrar una conversación.</p><button type="button" onClick={nuevaConversacion}>Registrar la primera</button></div> : <article className="tienda-whatsapp__prioridad">
        <div><span>{ETIQUETAS_ESTADO[activa.estadoBandeja]}</span><small>{indiceSeguro + 1} de {bandeja.length}</small></div>
        <h3>{activa.cliente}</h3>
        <p>{activa.producto_interes || "Producto pendiente de identificar"}</p>
        {activa.mensajePendiente && <blockquote>“{activa.mensajePendiente}”</blockquote>}
        <strong>{activa.siguientePaso}</strong>
        <button type="button" onClick={() => trabajar(activa)}>Trabajar esta conversación →</button>
        {bandeja.length > 1 && <nav aria-label="Cambiar conversación"><button type="button" disabled={indiceSeguro === 0} onClick={() => setIndice(Math.max(0, indiceSeguro - 1))}>← Anterior</button><button type="button" disabled={indiceSeguro >= bandeja.length - 1} onClick={() => setIndice(Math.min(bandeja.length - 1, indiceSeguro + 1))}>Siguiente →</button></nav>}
      </article>}
    </section>}

    {modo === "NUEVA" && <>
      <form onSubmit={preparar}>
        <label>Nombre de la clienta
          <input required value={cliente} onChange={(event) => { setCliente(event.target.value); setGuardadaCRM(false); setEnvioConfirmado(false); }} placeholder="Como aparece en WhatsApp" />
        </label>
        <label>Teléfono, si está disponible
          <input value={telefono} onChange={(event) => { setTelefono(event.target.value); setGuardadaCRM(false); setEnvioConfirmado(false); }} inputMode="tel" autoComplete="tel" placeholder="Ayuda a evitar clientas duplicadas" />
        </label>
        <label>Mensaje de la clienta
          <textarea required rows={4} value={mensajeCliente} onChange={(event) => { setMensajeCliente(event.target.value); setRespuestaDirecta(""); setTextoFinal(""); setPreparada(false); setEnvioConfirmado(false); }} placeholder="Pega aquí lo que te preguntaron…" />
        </label>
        <label>Producto exacto, si ya lo identificaste
          <input value={producto} onChange={(event) => { setProducto(event.target.value); setPreparada(false); setEnvioConfirmado(false); }} placeholder="Nombre, tono, código o presentación" />
        </label>
        <label>Existencia
          <select value={disponibilidad} onChange={(event) => { setDisponibilidad(event.target.value); setPreparada(false); setEnvioConfirmado(false); }}>
            <option value="PENDIENTE">Pendiente de revisar físicamente</option>
            <option value="CONFIRMADA">Disponible · ya la confirmé</option>
            <option value="AGOTADA_CONFIRMADA">Agotado · ya lo confirmé</option>
          </select>
        </label>
        <label>Precio confirmado, si ya lo revisaste
          <input type="number" min="0.01" step="0.01" inputMode="decimal" value={precioConfirmado} onChange={(event) => { setPrecioConfirmado(event.target.value); setPreparada(false); setEnvioConfirmado(false); }} placeholder="Vacío si falta confirmar" />
        </label>
        <button type="submit">Analizar y preparar respuesta →</button>
      </form>

      {preparada && <article className="tienda-whatsapp__respuesta">
        <div className="tienda-whatsapp__diagnostico"><span>{resultado.prioridad} · {resultado.tipo.replaceAll("_", " ")}</span><b>{resultado.autorizacion === "DIRECCION" ? "REVISAR CON DIRECCIÓN" : "REVISIÓN DE EMPLEADA"}</b></div>
        <label>Texto final que revisarás y enviarás
          <textarea rows={6} value={textoFinal} onChange={(event) => { setTextoFinal(event.target.value); setGuardadaCRM(false); setEnvioConfirmado(false); }} />
        </label>
        <div className="tienda-whatsapp__siguiente"><strong>Siguiente paso</strong><p>{resultado.siguientePaso}</p></div>
        {resultado.faltantes.length > 0 && <small>PENDIENTE: {resultado.faltantes.join(", ")}. MONYS no lo presentó como confirmado.</small>}
        <label>Próximo seguimiento
          <input type="date" min={fechaMexico()} value={proximoSeguimiento} onChange={(event) => { setProximoSeguimiento(event.target.value); setEnvioConfirmado(false); }} />
        </label>
        <button type="button" onClick={copiar} disabled={!textoFinal.trim()}>Copiar respuesta</button>
        <button type="button" className="is-secondary" onClick={guardarEnCRM} disabled={guardandoCRM || guardadaCRM || !organizationId || !businessId || !cliente.trim() || !textoFinal.trim()}>{guardandoCRM ? "Guardando…" : guardadaCRM ? "Borrador guardado" : "Guardar como borrador en CRM"}</button>
        <button type="button" className="is-confirm" onClick={confirmarEnviado} disabled={guardandoCRM || envioConfirmado || !textoFinal.trim()}>{envioConfirmado ? "Envío ya registrado" : "Confirmar que ya envié este texto"}</button>
      </article>}
    </>}
    {mensaje && <p className="tienda-whatsapp__mensaje" role="status">{mensaje}</p>}
    <footer><strong>REAL:</strong> el CRM registra únicamente lo que la empleada confirma. <strong>PENDIENTE:</strong> la conexión con WhatsApp empresarial para recibir y enviar mensajes automáticamente.</footer>
  </section>;
}
