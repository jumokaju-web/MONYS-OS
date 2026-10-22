import { useState } from "react";
import { useUser } from "../../../../context/UserContext";
import { CAMPOS_PAGOS_FLUJO, calcularFlujo13Semanas, construirCalendarioTanda } from "../../utils/flujoCaja13Semanas";
import "../JuntaDirectiva.css";

const ETIQUETAS = { nomina: "Nómina", proveedores: "Proveedores", rentaServicios: "Renta y servicios", impuestos: "Impuestos", creditos: "Créditos", tandaPago: "Aportación de tanda", otrosPagos: "Otros pagos" };
const semanaVacia = () => ({ cobros: "", ...Object.fromEntries(CAMPOS_PAGOS_FLUJO.map((campo) => [campo, ""])), tandaCobro: 0 });
const vacio = () => ({ saldoInicial: "", inicio: "", semanas: Array.from({ length: 13 }, semanaVacia), tanda: { inicio: "", semanas: "26", aportacion: "", numeros: "", montoCobro: "", fechasCobro: "" } });
const moneda = (valor) => valor === null ? "Por completar" : new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" }).format(valor);

function normalizarPlan(valor) {
  const base = vacio();
  if (!valor || !Array.isArray(valor.semanas) || valor.semanas.length !== 13) return base;
  return { ...base, ...valor, tanda: { ...base.tanda, ...(valor.tanda || {}) }, semanas: valor.semanas.map((semana) => ({ ...semanaVacia(), ...semana })) };
}

export default function FlujoCaja13Semanas({ metricas = {} }) {
  const { usuario } = useUser();
  const clave = usuario?.auth_user_id && usuario?.organization_id && usuario?.business_id ? JSON.stringify(["monys-caja13-v2", usuario.auth_user_id, usuario.organization_id, usuario.business_id, metricas.fechaInicial, metricas.fechaFinal]) : null;
  const [borradores, setBorradores] = useState({});
  const [vista, setVista] = useState("resumen");
  const [semanaActiva, setSemanaActiva] = useState(0);
  const [mensaje, setMensaje] = useState("");
  let almacenado = vacio();
  try { almacenado = normalizarPlan(clave && JSON.parse(window.localStorage.getItem(clave))); } catch { /* Ignora un borrador inválido. */ }
  const plan = normalizarPlan(borradores[clave || "sesion"] || almacenado);
  const filas = calcularFlujo13Semanas(plan);
  const deficit = filas.find((fila) => fila.deficit);
  const completas = filas.filter((fila) => fila.completa).length;

  function actualizar(cambio) {
    const nuevo = normalizarPlan({ ...plan, ...cambio });
    setBorradores((anteriores) => ({ ...anteriores, [clave || "sesion"]: nuevo }));
    try { if (!clave) throw new Error(); window.localStorage.setItem(clave, JSON.stringify(nuevo)); setMensaje("Borrador privado guardado en este dispositivo."); }
    catch { setMensaje("El plan queda en esta sesión; no se pudo guardar en el dispositivo."); }
  }
  function actualizarSemana(indice, campo, valor) { actualizar({ semanas: plan.semanas.map((semana, posicion) => posicion === indice ? { ...semana, [campo]: valor } : semana) }); }
  function fechaSemana(numero) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(plan.inicio || "")) return "Fecha pendiente";
    const fecha = new Date(`${plan.inicio}T12:00:00Z`); fecha.setUTCDate(fecha.getUTCDate() + (numero - 1) * 7);
    return fecha.toLocaleDateString("es-MX", { day: "numeric", month: "short", timeZone: "UTC" });
  }
  function prepararTanda() {
    const resultado = construirCalendarioTanda({ inicioFlujo: plan.inicio, inicioTanda: plan.tanda.inicio, semanasTanda: plan.tanda.semanas, aportacionSemanal: plan.tanda.aportacion, numerosPropios: plan.tanda.numeros, montoPorCobro: plan.tanda.montoCobro, cobros: plan.tanda.fechasCobro.split(/[\n,]/).map((fecha) => fecha.trim()).filter(Boolean) });
    if (!resultado.valido) { setMensaje(resultado.error); return; }
    actualizar({ semanas: plan.semanas.map((semana, indice) => ({ ...semana, ...resultado.semanas[indice] })), tanda: plan.tanda });
    setMensaje(`Calendario preparado: ${moneda(resultado.pagoSemanal)} por semana. Los cobros quedan separados de ventas y utilidad.`); setVista("resumen");
  }
  function exportar() {
    const encabezados = ["Semana", "Fecha", "Caja inicial", "Cobros operativos", "Cobros de tanda", ...CAMPOS_PAGOS_FLUJO.map((campo) => ETIQUETAS[campo]), "Pagos totales", "Caja final", "Estado"];
    const contenido = "\uFEFF" + [encabezados, ...filas.map((fila, indice) => [fila.semana, fechaSemana(fila.semana), fila.inicio ?? "", fila.cobrosOperativos ?? "", fila.tandaCobro ?? "", ...CAMPOS_PAGOS_FLUJO.map((campo) => plan.semanas[indice][campo] ?? ""), fila.pagos ?? "", fila.saldo ?? "", fila.completa ? (fila.deficit ? "Déficit previsto" : "Completa") : "Pendiente"])].map((registro) => registro.map((valor) => `"${String(valor).replaceAll('"', '""')}"`).join(",")).join("\r\n");
    const url = URL.createObjectURL(new Blob([contenido], { type: "text/csv;charset=utf-8" })); const enlace = document.createElement("a"); enlace.href = url; enlace.download = "MONYS-flujo-caja-13-semanas.csv"; enlace.click(); URL.revokeObjectURL(url);
  }

  const semana = plan.semanas[semanaActiva];
  return <section className="junta flujo-caja" aria-label="Flujo de caja de trece semanas">
    <header><div><span className="junta-label">PLANEACIÓN FINANCIERA</span><h2>Caja · próximas 13 semanas</h2><p>Dinero esperado, compromisos y riesgo semanal. No mezcla financiamiento con ventas.</p></div><span className="junta-pill">{completas}/13 completas</span></header>
    <div className="flujo-navegacion" role="tablist">{[["resumen","Resumen"],["captura","Capturar semana"],["tanda","Configurar tanda"]].map(([id, texto]) => <button type="button" role="tab" aria-selected={vista === id} key={id} onClick={() => setVista(id)}>{texto}</button>)}</div>
    <div className="junta-columns"><label>Inicio de la primera semana<input type="date" value={plan.inicio} onChange={(evento) => actualizar({ inicio: evento.target.value })}/></label><label>Saldo conciliado inicial (MXN)<input type="number" min="0" step="0.01" placeholder="Pendiente" value={plan.saldoInicial} onChange={(evento) => actualizar({ saldoInicial: evento.target.value })}/></label></div>
    <p className="flujo-aviso" role="status">{deficit ? `Atención: déficit previsto en semana ${deficit.semana}, ${moneda(deficit.saldo)}.` : completas === 13 ? "El escenario no presenta déficit si los cobros se cumplen." : "PENDIENTE: completa los importes. Un dato ausente no se convierte en cero."}</p>
    {vista === "resumen" && <><div className="flujo-semanas">{filas.map((fila, indice) => <button type="button" key={fila.semana} className={fila.deficit ? "flujo-semana deficit" : "flujo-semana"} onClick={() => { setSemanaActiva(indice); setVista("captura"); }}><span>Semana {fila.semana} · {fechaSemana(fila.semana)}</span><strong>{moneda(fila.saldo)}</strong><small>{fila.completa ? `${moneda(fila.cobros)} entra · ${moneda(fila.pagos)} sale` : "Toca para completar"}</small></button>)}</div><button type="button" onClick={exportar}>Descargar escenario detallado</button></>}
    {vista === "captura" && <><label className="flujo-selector">Semana a completar<select value={semanaActiva} onChange={(evento) => setSemanaActiva(Number(evento.target.value))}>{filas.map((fila, indice) => <option value={indice} key={fila.semana}>Semana {fila.semana} · {fechaSemana(fila.semana)}</option>)}</select></label><div className="flujo-captura"><label>Cobros operativos esperados<input type="number" min="0" step="0.01" placeholder="Pendiente" value={semana.cobros} onChange={(evento) => actualizarSemana(semanaActiva, "cobros", evento.target.value)}/><small>No incluyas préstamos ni tanda.</small></label>{CAMPOS_PAGOS_FLUJO.map((campo) => <label key={campo}>{ETIQUETAS[campo]}<input type="number" min="0" step="0.01" placeholder="Pendiente" value={semana[campo]} onChange={(evento) => actualizarSemana(semanaActiva, campo, evento.target.value)}/></label>)}</div><p><b>Caja final calculable:</b> {moneda(filas[semanaActiva].saldo)}. Captura 0 solo si confirmas que no habrá importe.</p><button type="button" onClick={() => setVista("resumen")}>Guardar y volver al resumen</button></>}
    {vista === "tanda" && <div className="flujo-tanda"><p><b>HIPÓTESIS hasta confirmarla:</b> la tanda se registra como financiamiento sin intereses, nunca como venta ni utilidad.</p><div className="flujo-captura"><label>Inicio de la tanda<input type="date" value={plan.tanda.inicio} onChange={(evento) => actualizar({ tanda: { ...plan.tanda, inicio: evento.target.value } })}/></label><label>Total de semanas<input type="number" min="1" step="1" value={plan.tanda.semanas} onChange={(evento) => actualizar({ tanda: { ...plan.tanda, semanas: evento.target.value } })}/></label><label>Aportación por número/semana<input type="number" min="0" step="0.01" placeholder="Ej. 500" value={plan.tanda.aportacion} onChange={(evento) => actualizar({ tanda: { ...plan.tanda, aportacion: evento.target.value } })}/></label><label>Números propios<input type="number" min="1" step="1" placeholder="Ej. 6" value={plan.tanda.numeros} onChange={(evento) => actualizar({ tanda: { ...plan.tanda, numeros: evento.target.value } })}/></label><label>Monto de cada cobro<input type="number" min="0" step="0.01" placeholder="Ej. 13000" value={plan.tanda.montoCobro} onChange={(evento) => actualizar({ tanda: { ...plan.tanda, montoCobro: evento.target.value } })}/></label><label>Fechas de cobro<textarea rows="5" placeholder={"Una fecha por línea\nAAAA-MM-DD"} value={plan.tanda.fechasCobro} onChange={(evento) => actualizar({ tanda: { ...plan.tanda, fechasCobro: evento.target.value } })}/></label></div><button type="button" onClick={prepararTanda}>Preparar calendario sin registrar pagos</button></div>}
    {mensaje && <p role="status">{mensaje}</p>}<p className="flujo-nota">ESTIMACIÓN guardada solo en este dispositivo. MONYS no realiza pagos ni transferencias. Mónica conserva la autorización final.</p>
  </section>;
}
