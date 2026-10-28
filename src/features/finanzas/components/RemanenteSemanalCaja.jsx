import { useCallback, useEffect, useMemo, useState } from "react";
import {
  abrirEvidenciaRemanente,
  eliminarEvidenciaRemanente,
  guardarRemanenteSemanal,
  obtenerRemanentesSemanales,
  revisarRemanenteSemanal,
  subirEvidenciaRemanente,
} from "../services/remanentesSemanalesService.js";
import { resumirCapturaRemanente, validarCapturaRemanente } from "../utils/remanenteSemanalCaptura.js";
import "./RemanenteSemanalCaja.css";

const dinero = new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN", maximumFractionDigits: 2 });
const claveCaja = (caja) => `${caja.branchId}|${caja.cajaId}`;
const rolesDireccion = new Set(["owner", "director", "admin", "finanzas"]);

function formularioInicial(caja, registro, semana) {
  return {
    efectivoSicar: registro?.efectivo_sicar ?? caja.efectivoEnCaja ?? "",
    efectivoContado: registro?.efectivo_contado ?? "",
    fondoFijo: registro?.fondo_fijo ?? "",
    montoResguardado: registro?.monto_resguardado ?? "",
    destino: registro?.destino || "",
    referencia: registro?.referencia || "",
    nota: registro?.observaciones || "",
    evidencia: null,
    branchId: caja.branchId,
    cajaId: caja.cajaId,
    importacionId: registro?.importacion_id || caja.corte?.importacionId,
    importacionDetalleId: registro?.importacion_detalle_id || caja.corte?.importacionDetalleId,
    semanaInicio: semana.inicio,
    semanaFin: semana.fin,
  };
}

function formatearFecha(fecha) {
  if (!fecha) return "Sin fecha";
  return new Intl.DateTimeFormat("es-MX", { timeZone: "UTC", day: "2-digit", month: "short", year: "numeric" })
    .format(new Date(`${fecha}T12:00:00Z`));
}

export default function RemanenteSemanalCaja({ usuario, resumen }) {
  const [registros, setRegistros] = useState([]);
  const [formularios, setFormularios] = useState({});
  const [notasRevision, setNotasRevision] = useState({});
  const [cargando, setCargando] = useState(false);
  const [guardando, setGuardando] = useState("");
  const [mensaje, setMensaje] = useState("");
  const [error, setError] = useState("");

  const role = String(usuario?.role || "").toLowerCase();
  const puedeGestionar = rolesDireccion.has(role);
  const semana = resumen?.semana;
  const cajas = Array.isArray(resumen?.cajas) ? resumen.cajas : [];
  const registroPorCaja = useMemo(() => new Map(registros.map((registro) => [`${registro.branch_id}|${registro.caja_id}`, registro])), [registros]);

  const cargar = useCallback(async () => {
    if (!usuario?.business_id || !semana?.inicio || !puedeGestionar) return;
    setCargando(true);
    setError("");
    try {
      setRegistros(await obtenerRemanentesSemanales({ businessId: usuario.business_id, semanaInicio: semana.inicio }));
    } catch (fallo) {
      setError(fallo?.message || "No fue posible consultar el cierre semanal guardado.");
    } finally {
      setCargando(false);
    }
  }, [puedeGestionar, semana?.inicio, usuario?.business_id]);

  useEffect(() => { cargar(); }, [cargar]);

  function cambiar(caja, campo, valor) {
    const key = claveCaja(caja);
    const registro = registroPorCaja.get(key);
    setFormularios((actual) => ({
      ...actual,
      [key]: { ...(actual[key] || formularioInicial(caja, registro, semana)), [campo]: valor },
    }));
  }

  function obtenerFormulario(caja) {
    const key = claveCaja(caja);
    return formularios[key] || formularioInicial(caja, registroPorCaja.get(key), semana);
  }

  async function guardar(caja) {
    const key = claveCaja(caja);
    const registro = registroPorCaja.get(key);
    const form = obtenerFormulario(caja);
    const evidenciaExistente = Number(form.montoResguardado) > 0 ? registro?.evidencia_path : null;
    const validacion = validarCapturaRemanente({ ...form, evidencia: form.evidencia || evidenciaExistente });
    if (validacion) { setError(validacion); return; }
    setGuardando(key);
    setError("");
    setMensaje("");
    let evidenciaNueva = null;
    let registroGuardado = false;
    try {
      if (form.evidencia) {
        evidenciaNueva = await subirEvidenciaRemanente({ archivo: form.evidencia, branchId: caja.branchId, cajaId: caja.cajaId, semanaInicio: semana.inicio });
      }
      await guardarRemanenteSemanal({
        form: {
          ...form,
          organizationId: usuario.organization_id,
          businessId: usuario.business_id,
          branchId: caja.branchId,
          semanaInicio: semana.inicio,
          semanaFin: semana.fin,
          cajaId: caja.cajaId,
        },
        evidenciaPath: evidenciaNueva || evidenciaExistente || null,
        registro,
      });
      registroGuardado = true;
      setFormularios((actual) => { const siguiente = { ...actual }; delete siguiente[key]; return siguiente; });
      setMensaje(`${caja.sucursal} · ${caja.nombre}: conteo semanal guardado para revisión.`);
      await cargar();
    } catch (fallo) {
      if (evidenciaNueva && !registroGuardado) {
        try { await eliminarEvidenciaRemanente(evidenciaNueva); } catch { /* El error original es el que debe ver Dirección. */ }
      }
      setError(fallo?.message || "No fue posible guardar este conteo semanal.");
    } finally {
      setGuardando("");
    }
  }

  async function revisar(registro) {
    const nota = String(notasRevision[registro.id] || "").trim();
    if (nota.length < 5) { setError("Escribe al menos cinco caracteres para documentar la revisión."); return; }
    const estado = Math.abs(Number(registro.diferencia_sicar) || 0) <= 0.009 ? "COMPROBADO" : "DIFERENCIA";
    setGuardando(registro.id);
    setError("");
    setMensaje("");
    try {
      await revisarRemanenteSemanal({ registro, estado, nota });
      setMensaje(estado === "COMPROBADO" ? "Conteo semanal comprobado." : "Diferencia registrada y enviada a seguimiento.");
      await cargar();
    } catch (fallo) {
      setError(fallo?.message || "No fue posible revisar el conteo semanal.");
    } finally {
      setGuardando("");
    }
  }

  async function abrirEvidencia(registro) {
    setError("");
    try {
      const url = await abrirEvidenciaRemanente(registro.evidencia_path);
      window.open(url, "_blank", "noopener,noreferrer");
    } catch (fallo) {
      setError(fallo?.message || "No fue posible abrir la evidencia.");
    }
  }

  if (!semana) return null;

  return <section className="remanente-captura" aria-labelledby="remanente-captura-titulo">
    <header>
      <div><span>CONTEO FÍSICO DEL LUNES</span><h3 id="remanente-captura-titulo">Registrar el remanente por caja</h3><small>Semana del {formatearFecha(semana.inicio)} al {formatearFecha(semana.fin)}</small></div>
      {puedeGestionar && <button type="button" onClick={cargar} disabled={cargando || Boolean(guardando)}>{cargando ? "Consultando…" : "Actualizar"}</button>}
    </header>
    <p>Captura cuánto había realmente, conserva el fondo fijo e indica cuánto resguardaste. El resguardo queda como control auditado; no genera un gasto ni un movimiento de banco automáticamente.</p>
    {!resumen.completo && <p className="remanente-captura__bloqueo" role="alert">Completa los cortes del domingo y aclara sus diferencias en SICAR antes de cerrar el conteo semanal.</p>}
    {cajas.map((caja) => {
      const key = claveCaja(caja);
      const registro = registroPorCaja.get(key);
      const form = obtenerFormulario(caja);
      const calculo = resumirCapturaRemanente(form);
      const editable = puedeGestionar && resumen.completo && caja.efectivoEnCaja !== null && registro?.estado !== "REPORTADO";
      return <article className="remanente-captura__caja" key={key}>
        <div className="remanente-captura__caja-titulo"><div><strong>{caja.sucursal} · {caja.nombre}</strong><small>SICAR al domingo: {caja.efectivoEnCaja === null ? "corte pendiente" : dinero.format(caja.efectivoEnCaja)}</small></div><span className={`remanente-captura__estado estado-${String(registro?.estado || (caja.estado === "completo" ? "PENDIENTE" : "BLOQUEADO")).toLowerCase()}`}>{registro?.estado || (caja.estado === "completo" ? "Pendiente de conteo" : "Corte pendiente")}</span></div>
        {registro && <div className="remanente-captura__guardado">
          <span>Conteo {dinero.format(registro.efectivo_contado)} · Fondo {dinero.format(registro.fondo_fijo)} · Resguardado {dinero.format(registro.monto_resguardado)}</span>
          <small>Diferencia frente a SICAR: {dinero.format(registro.diferencia_sicar)} · Registró {registro.registrado_nombre} · {new Date(registro.created_at).toLocaleString("es-MX", { timeZone: "America/Mexico_City" })}</small>
          {registro.evidencia_path && <button type="button" className="remanente-captura__evidencia" onClick={() => abrirEvidencia(registro)}>Abrir evidencia</button>}
          {registro.nota_revision && <small>Revisión: {registro.nota_revision} · {registro.verificado_nombre}</small>}
        </div>}
        {editable && <details className="remanente-captura__form" open={!registro}>
          <summary>{registro ? "Registrar una nueva versión del conteo" : "Capturar conteo y resguardo"}</summary>
          <div className="remanente-captura__campos">
            <label>Efectivo contado físicamente<input type="number" min="0" step="0.01" inputMode="decimal" value={form.efectivoContado} onChange={(event) => cambiar(caja, "efectivoContado", event.target.value)} /></label>
            <label>Fondo fijo que se queda<input type="number" min="0" step="0.01" inputMode="decimal" value={form.fondoFijo} onChange={(event) => cambiar(caja, "fondoFijo", event.target.value)} /></label>
            <label>Importe realmente resguardado<input type="number" min="0" step="0.01" inputMode="decimal" value={form.montoResguardado} onChange={(event) => cambiar(caja, "montoResguardado", event.target.value)} /></label>
            <div className="remanente-captura__calculado"><small>Máximo después del fondo fijo</small><strong>{calculo.montoResguardable === null ? "Completa el conteo" : dinero.format(calculo.montoResguardable)}</strong></div>
          </div>
          {Number(form.montoResguardado) > 0 && <div className="remanente-captura__campos">
            <label>Destino real del efectivo<input type="text" maxLength="200" value={form.destino} onChange={(event) => cambiar(caja, "destino", event.target.value)} placeholder="Ej. efectivo resguardado, depósito BBVA" /></label>
            <label>Referencia<input type="text" maxLength="200" value={form.referencia} onChange={(event) => cambiar(caja, "referencia", event.target.value)} placeholder="Folio, bolsa, ficha o nota del depósito" /></label>
            <label className="remanente-captura__archivo">Foto o comprobante<input type="file" accept="image/*,application/pdf" onChange={(event) => cambiar(caja, "evidencia", event.target.files?.[0] || null)} /><small>{form.evidencia?.name || (registro?.evidencia_path ? "Se conservará la evidencia anterior si no eliges otra." : "Obligatorio si se resguardó efectivo.")}</small></label>
          </div>}
          {Math.abs(Number(form.efectivoContado) - Number(form.efectivoSicar)) >= 0.01 && <label className="remanente-captura__nota">Explica la diferencia contra SICAR<textarea maxLength="1000" value={form.nota} onChange={(event) => cambiar(caja, "nota", event.target.value)} placeholder="Ej. movimiento posterior al cierre que ya fue identificado" /></label>}
          <small className="remanente-captura__comparacion">{calculo.diferenciaSicar === null ? "Captura el conteo físico para comparar con SICAR." : calculo.coincideSicar ? "El conteo coincide con SICAR." : `Diferencia contra SICAR: ${dinero.format(calculo.diferenciaSicar)}. Quedará pendiente de revisión.`}</small>
          <button className="remanente-captura__guardar" type="button" disabled={Boolean(guardando)} onClick={() => guardar(caja)}>{guardando === key ? "Guardando…" : "Guardar conteo semanal"}</button>
        </details>}
        {registro?.estado === "REPORTADO" && puedeGestionar && <div className="remanente-captura__revision">
          <label>Nota de revisión<textarea maxLength="1000" value={notasRevision[registro.id] || ""} onChange={(event) => setNotasRevision((actual) => ({ ...actual, [registro.id]: event.target.value }))} placeholder="Deja constancia de lo comprobado" /></label>
          <button type="button" disabled={Boolean(guardando)} onClick={() => revisar(registro)}>{guardando === registro.id ? "Revisando…" : Math.abs(Number(registro.diferencia_sicar) || 0) <= 0.009 ? "Comprobar conteo" : "Registrar diferencia"}</button>
        </div>}
      </article>;
    })}
    {!cajas.length && <p>No hay cajas configuradas para revisar el cierre semanal.</p>}
    {!puedeGestionar && <p>Dirección o Finanzas deben registrar y revisar el conteo semanal.</p>}
    {mensaje && <p className="remanente-captura__mensaje" role="status">✓ {mensaje}</p>}
    {error && <p className="remanente-captura__error" role="alert">{error}</p>}
    <small className="remanente-captura__nota-final">Un conteo con diferencia queda pendiente. Comprobarlo no autoriza un retiro personal ni lo contabiliza como gasto.</small>
  </section>;
}
