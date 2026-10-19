import { useCallback, useEffect, useMemo, useState } from "react";
import {
  actualizarEtapaCRM,
  crearOportunidadCRM,
  listarInteraccionesCRM,
  registrarInteraccionCRM,
  listarEmpleadosAsignablesCRM,
  listarEmpleadosCRM,
  listarSucursalesCRM,
  listarOportunidadesCRM,
  programarSeguimientoCRM,
} from "../../services/crmService";
import { ETAPAS_CRM, resumirCRM } from "../../shared/resumenCRM";
import { analizarCentroDireccionCRM } from "../../shared/centroDireccionCRM";

const CANALES = [
  ["MOSTRADOR", "Mostrador"],
  ["WHATSAPP", "WhatsApp"],
  ["FACEBOOK", "Facebook"],
  ["INSTAGRAM", "Instagram"],
  ["TIKTOK", "TikTok orgánico"],
  ["TIKTOK_SHOP", "TikTok Shop"],
  ["MERCADO_LIBRE", "Mercado Libre"],
  ["OTRO", "Otro"],
];
const ETIQUETAS = {
  NUEVO: "Nuevo",
  CONTACTADO: "Contactado",
  COTIZANDO: "Cotizando",
  GANADO: "Ganado",
  PERDIDO: "Perdido",
};
const caja = {
  background: "#fff",
  border: "1px solid #eddde5",
  borderRadius: 10,
  padding: 10,
};
const campo = {
  width: "100%",
  boxSizing: "border-box",
  border: "1px solid #e4d9e0",
  borderRadius: 8,
  padding: "8px 10px",
  font: "inherit",
  background: "#fff",
};

function dinero(valor) {
  return new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency: "MXN",
    maximumFractionDigits: 0,
  }).format(Number(valor) || 0);
}

function fechaHoyLocal() {
  const hoy = new Date();
  return [hoy.getFullYear(), String(hoy.getMonth() + 1).padStart(2, "0"), String(hoy.getDate()).padStart(2, "0")].join("-");
}

function fechaLegible(valor) {
  if (!valor) return "Sin fecha";
  const fecha = new Date(`${valor}T12:00:00`);
  return fecha.toLocaleDateString("es-MX", { day: "numeric", month: "short", year: "numeric" });
}

const inicial = {
  cliente: "",
  telefono: "",
  canal: "MOSTRADOR",
  etapa: "NUEVO",
  productoInteres: "",
  montoEstimado: "",
  proximoSeguimiento: "",
  empleadoId: "",
  folioVentaSicar: "",
  notas: "",
};

export default function CentroCRMComercial({
  organizationId,
  businessId,
  branchId,
  empleados = [],
}) {
  const [oportunidades, setOportunidades] = useState([]);
  const [interacciones, setInteracciones] = useState([]);
  const [borradoresInteraccion, setBorradoresInteraccion] = useState({});
  const [registrandoInteraccionId, setRegistrandoInteraccionId] = useState("");
  const [equipoCRM, setEquipoCRM] = useState(empleados);
  const [equipoCompletoCRM, setEquipoCompletoCRM] = useState(empleados);
  const [sucursalesCRM, setSucursalesCRM] = useState([]);
  const [filtroSucursal, setFiltroSucursal] = useState("TODAS");
  const [edicionesSeguimiento, setEdicionesSeguimiento] = useState({});
  const [programandoId, setProgramandoId] = useState("");
  const [formulario, setFormulario] = useState(inicial);
  const [mostrarFormulario, setMostrarFormulario] = useState(false);
  const [filtro, setFiltro] = useState("ABIERTAS");
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState("");
  const [aviso, setAviso] = useState("");
  const [perdidaPendiente, setPerdidaPendiente] = useState(null);
  const [motivoPerdida, setMotivoPerdida] = useState("");

  const empleadosAsignables = useMemo(
    () => {
      const lista = equipoCRM.length ? equipoCRM : (Array.isArray(empleados) ? empleados : []);
      return lista.filter((persona) => persona.active && persona.usuario_id);
    },
    [equipoCRM, empleados],
  );

  const cargar = useCallback(async () => {
    if (!businessId) {
      setOportunidades([]);
      setInteracciones([]);
      setEquipoCRM([]);
      setEquipoCompletoCRM([]);
      setSucursalesCRM([]);
      setCargando(false);
      return;
    }
    setCargando(true);
    setError("");
    try {
      const [oportunidadesCargadas, equipoCargado, equipoCompletoCargado, interaccionesCargadas, sucursalesCargadas] = await Promise.all([
        listarOportunidadesCRM({ businessId }),
        listarEmpleadosAsignablesCRM({ businessId }),
        listarEmpleadosCRM({ businessId }),
        listarInteraccionesCRM({ businessId }),
        listarSucursalesCRM({ businessId }),
      ]);
      setOportunidades(oportunidadesCargadas);
      setEquipoCRM(equipoCargado);
      setEquipoCompletoCRM(equipoCompletoCargado);
      setInteracciones(interaccionesCargadas);
      setSucursalesCRM(sucursalesCargadas);
    } catch (err) {
      setError(err?.message || "No se pudo cargar el CRM.");
    } finally {
      setCargando(false);
    }
  }, [businessId]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  const oportunidadesFiltradas = useMemo(() => filtroSucursal === "TODAS"
    ? oportunidades
    : oportunidades.filter((item) => String(item.branch_id || "SIN_SUCURSAL") === filtroSucursal), [filtroSucursal, oportunidades]);
  const resumen = useMemo(() => resumirCRM(oportunidadesFiltradas), [oportunidadesFiltradas]);
  const resumenDireccion = useMemo(() => {
    const equipo = equipoCompletoCRM.length ? equipoCompletoCRM : (empleados.length ? empleados : equipoCRM);
    const oportunidadesConResponsable = oportunidades.map((item) => {
      const persona = equipo.find((fila) => fila.id === item.empleado_id || fila.usuario_id === item.asignado_a);
      return { ...item, responsable_nombre: persona?.nombre || "" };
    });
    return analizarCentroDireccionCRM({ oportunidades: oportunidadesConResponsable, interacciones, sucursales: sucursalesCRM, hoy: fechaHoyLocal(), sucursalId: filtroSucursal });
  }, [equipoCompletoCRM, equipoCRM, empleados, filtroSucursal, interacciones, oportunidades, sucursalesCRM]);
  const visibles = useMemo(() => {
    const lista = filtro === "ABIERTAS"
      ? oportunidadesFiltradas.filter((item) => !["GANADO", "PERDIDO"].includes(item.etapa))
      : filtro === "CERRADAS"
        ? oportunidadesFiltradas.filter((item) => ["GANADO", "PERDIDO"].includes(item.etapa))
        : oportunidadesFiltradas;
    return [...lista].sort((a, b) => {
      const aa = a.proximo_seguimiento || "9999-12-31";
      const bb = b.proximo_seguimiento || "9999-12-31";
      return aa.localeCompare(bb);
    });
  }, [filtro, oportunidadesFiltradas]);

  function cambiar(campoNombre, valor) {
    setFormulario((anterior) => ({ ...anterior, [campoNombre]: valor }));
  }

  async function guardar(evento) {
    evento.preventDefault();
    setGuardando(true);
    setError("");
    setAviso("");
    const persona = empleadosAsignables.find((item) => item.id === formulario.empleadoId) || null;
    try {
      const resultado = await crearOportunidadCRM({
        organizationId,
        businessId,
        branchId,
        cliente: formulario.cliente,
        telefono: formulario.telefono,
        canal: formulario.canal,
        etapa: formulario.etapa,
        folioVentaSicar: formulario.folioVentaSicar,
        productoInteres: formulario.productoInteres,
        montoEstimado: formulario.montoEstimado,
        proximoSeguimiento: formulario.proximoSeguimiento || null,
        empleado: persona,
        notas: formulario.notas,
      });
      setFormulario(inicial);
      setMostrarFormulario(false);
      setAviso(resultado.errorTarea
        ? `Oportunidad guardada, pero la tarea de calendario falló: ${resultado.errorTarea}`
        : resultado.tarea
          ? `Oportunidad guardada y seguimiento agregado a tareas de ${persona.nombre} para el ${fechaLegible(formulario.proximoSeguimiento)}.`
          : "Oportunidad guardada. Al asignar una empleada con cuenta activa y fecha, también aparece en su agenda de tareas.");
      await cargar();
    } catch (err) {
      setError(err?.message || "No se pudo guardar la oportunidad.");
    } finally {
      setGuardando(false);
    }
  }

  async function programarSiguiente(item) {
    const edicion = edicionesSeguimiento[item.id] || {};
    const fecha = edicion.fecha || "";
    const empleadoId = edicion.empleadoId || item.empleado_id || "";
    const persona = empleadosAsignables.find((fila) => fila.id === empleadoId);
    if (!fecha || !persona) {
      setError("Selecciona una fecha y una empleada con cuenta activa.");
      return;
    }
    setError("");
    setAviso("");
    setProgramandoId(item.id);
    try {
      const resultado = await programarSeguimientoCRM({ id: item.id, fecha, empleado: persona });
      setAviso(resultado.errorTarea
        ? `Se guardó la fecha, pero falló la tarea del calendario: ${resultado.errorTarea}`
        : `Siguiente contacto programado con ${persona.nombre} para el ${fechaLegible(fecha)}.`);
      await cargar();
    } catch (err) {
      setError(err?.message || "No se pudo programar el seguimiento.");
    } finally {
      setProgramandoId("");
    }
  }

  async function cambiarEtapa(item, etapa) {
    setError("");
    setAviso("");
    const folioVentaSicar = borradoresInteraccion[item.id]?.folioVentaSicar ?? item.folio_venta_sicar ?? "";
    if (etapa === "GANADO" && !String(folioVentaSicar).trim()) {
      setError("Captura primero el folio real de SICAR para registrar la venta ganada y asignar la comisión.");
      return;
    }
    if (etapa === "PERDIDO") {
      setPerdidaPendiente(item);
      setMotivoPerdida("");
      return;
    }
    try {
      const actualizado = await actualizarEtapaCRM({ id: item.id, etapa, folioVentaSicar });
      setOportunidades((anterior) => anterior.map((fila) => fila.id === actualizado.id ? actualizado : fila));
    } catch (err) {
      setError(err?.message || "No se pudo cambiar la etapa.");
    }
  }

  async function confirmarPerdida() {
    const motivo = motivoPerdida.trim();
    if (!perdidaPendiente?.id || motivo.length < 4) {
      setError("Registra el motivo real de pérdida con al menos 4 caracteres.");
      return;
    }
    try {
      setError("");
      const actualizado = await actualizarEtapaCRM({ id: perdidaPendiente.id, etapa: "PERDIDO", motivoPerdida: motivo });
      setOportunidades((anterior) => anterior.map((fila) => fila.id === actualizado.id ? actualizado : fila));
      setAviso("Oportunidad cerrada como perdida con motivo documentado.");
      setPerdidaPendiente(null);
      setMotivoPerdida("");
    } catch (err) {
      setError(err?.message || "No se pudo registrar el motivo de pérdida.");
    }
  }

  async function guardarInteraccion(item) {
    const borrador = borradoresInteraccion[item.id] || {};
    const mensaje = String(borrador.mensaje || "").trim();
    if (!mensaje) { setError("Escribe el mensaje o nota que quieres guardar en el historial."); return; }
    setError(""); setAviso(""); setRegistrandoInteraccionId(item.id);
    try {
      await registrarInteraccionCRM({ oportunidadId: item.id, organizationId, businessId, branchId: item.branch_id || branchId, canal: borrador.canal || item.canal, direccion: borrador.direccion || "ENTRANTE", mensaje });
      setBorradoresInteraccion((prev) => ({ ...prev, [item.id]: { ...prev[item.id], mensaje: "" } }));
      setAviso("Conversación guardada en el historial del CRM.");
      setInteracciones(await listarInteraccionesCRM({ businessId }));
    } catch (err) { setError(err?.message || "No se pudo guardar la conversación."); }
    finally { setRegistrandoInteraccionId(""); }
  }

  return (
    <section style={{ marginTop: 12, padding: "clamp(11px, 3vw, 16px)", borderRadius: 13, background: "linear-gradient(145deg, #fff 0%, #fff9fc 100%)", border: "1px solid #ead5e0", boxShadow: "0 4px 14px rgba(112, 53, 84, .06)", fontFamily: "Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif", fontSize: 13, lineHeight: 1.4, color: "#352d34" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
        <div>
          <p style={{ margin: "0 0 3px", color: "#a83b70", fontWeight: 750, fontSize: 10, letterSpacing: ".07em" }}>MONYS OS · CRM Y VENTAS</p>
          <h3 style={{ margin: 0, fontSize: "clamp(18px, 4.7vw, 21px)", lineHeight: 1.2, color: "#352d34", fontWeight: 750 }}>🤝 Seguimiento de clientes</h3>
          <p style={{ margin: "4px 0 0", color: "#716a73", fontSize: 12 }}>Etapa, responsable y siguiente paso de cada oportunidad.</p>
        </div>
        <button type="button" onClick={() => { setMostrarFormulario((valor) => !valor); setError(""); }} style={{ border: 0, borderRadius: 9, padding: "9px 12px", background: "#a83b70", color: "#fff", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
          {mostrarFormulario ? "Cerrar captura" : "+ Registrar oportunidad"}
        </button>
      </div>

      <div style={{ ...caja, marginTop: 9, display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
        <strong style={{ color: "#8f315f", fontSize: 13 }}>Vista de Dirección</strong>
        <label style={{ display: "flex", alignItems: "center", gap: 8, color: "#586174", fontSize: 14 }}>
          Sucursal
          <select aria-label="Filtrar oportunidades por sucursal" value={filtroSucursal} onChange={(e) => setFiltroSucursal(e.target.value)} style={{ ...campo, width: "min(220px, 58vw)", minWidth: 0, fontSize: 14 }}>
            <option value="TODAS">Todas las sucursales</option>
            {sucursalesCRM.map((fila) => <option key={fila.id} value={fila.id}>{fila.name}</option>)}
            {oportunidades.some((fila) => !fila.branch_id) && <option value="SIN_SUCURSAL">Sucursal sin registrar</option>}
          </select>
        </label>
        <span style={{ color: "#697386", fontSize: 13 }}>Datos del CRM del negocio · {resumenDireccion.total} oportunidades en esta vista</span>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(140px, 100%), 1fr))", gap: 9, marginTop: 9 }}>
        {[
          ["Sin responsable", resumenDireccion.sinResponsable],
          ["Seguimientos vencidos", resumenDireccion.vencidas],
          ["Para hoy", resumenDireccion.hoy],
          ["Cotizaciones pendientes", resumenDireccion.cotizaciones],
          ["Sin respuesta · 3+ días", resumenDireccion.sinRespuesta],
          ["Ventas ligadas a folio SICAR", resumenDireccion.ventasSicar],
          ["Mediana primera respuesta", resumenDireccion.primeraRespuesta.medianaMinutos == null ? "Sin muestra" : `${resumenDireccion.primeraRespuesta.medianaMinutos} min`],
        ].map(([titulo, valor]) => <div key={titulo} style={{ ...caja, padding: 9 }}><div style={{ color: "#706974", fontSize: 11, lineHeight: 1.35 }}>{titulo}</div><strong style={{ display: "block", marginTop: 3, color: "#8f315f", fontSize: 16, lineHeight: 1.2 }}>{valor}</strong></div>)}
      </div>
      <p style={{ margin: "8px 0 0", color: "#697386", fontSize: 12 }}>La primera respuesta se calcula entre marcas de tiempo guardadas en MONYS OS (n={resumenDireccion.primeraRespuesta.muestra}); no representa una medición automática de WhatsApp. “Sin respuesta” usa una regla operativa de 3 días. Tasas por responsable, sucursal, canal y producto usan oportunidades cerradas y no prueban causalidad.</p>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(240px, 100%), 1fr))", gap: 10, marginTop: 10 }}>
        <div style={caja}><strong style={{ color: "#8f315f", fontSize: 13 }}>Siguiente acción sugerida</strong><div style={{ display: "grid", gap: 7, marginTop: 8 }}>
        {resumenDireccion.acciones.slice(0, 6).map((fila) => <div key={fila.id} style={{ padding: 9, background: fila.prioridad >= 85 ? "#fff5f8" : "#fffafd", borderRadius: 8 }}><strong>{fila.cliente}</strong><div style={{ color: "#625962", fontSize: 12, marginTop: 3 }}>{fila.accion}</div><small style={{ color: "#766d75" }}>{sucursalesCRM.find((s) => s.id === fila.branch_id)?.name || "Sucursal no identificada"} · {fila.responsable_nombre || "Sin responsable"}</small><div><button type="button" onClick={() => { setFiltro("TODAS"); globalThis.requestAnimationFrame?.(() => document.getElementById(`crm-oportunidad-${fila.id}`)?.scrollIntoView({ behavior: "smooth", block: "start" })); }} style={{ border: 0, background: "transparent", padding: "5px 0 0", color: "#a83b70", fontWeight: 700, fontSize: 12, cursor: "pointer" }}>Abrir oportunidad ↓</button></div></div>)}
          {!resumenDireccion.acciones.length && <span style={{ color: "#697386" }}>No hay oportunidades abiertas que requieran acción.</span>}
        </div></div>
        <div style={caja}><strong style={{ color: "#8f315f", fontSize: 13 }}>Motivos de pérdida documentados</strong><p style={{ margin: "6px 0", color: "#625962", fontSize: 11 }}>REAL · {resumenDireccion.razonesPerdida.length} con motivo · {resumenDireccion.perdidasSinMotivo} sin motivo estructurado</p>
          {resumenDireccion.razonesPerdida.slice(0, 5).map((fila) => <div key={fila.oportunidadId} style={{ padding: "7px 0", borderTop: "1px solid #edf0f5", fontSize: 13 }}>{fila.motivo}</div>)}
          <p style={{ margin: "8px 0 0", color: "#697386", fontSize: 12 }}>EVIDENCIA · {resumenDireccion.textosAsociados.length} mensajes salientes guardados en oportunidades con folio SICAR. Son ejemplos asociados a ventas registradas, no evidencia de que el mensaje causó la compra. HIPÓTESIS · todavía no hay comparación por tipo de respuesta suficiente para recomendar un texto ganador.</p>
          {resumenDireccion.textosAsociados.slice(0, 3).map((fila) => <div key={`${fila.oportunidadId}-${fila.folio}-${fila.texto}`} style={{ padding: "7px 0", borderTop: "1px solid #edf0f5", fontSize: 13 }}><span style={{ color: "#267044", fontWeight: 700 }}>Folio {fila.folio} · </span>{fila.texto}</div>)}
          {!resumenDireccion.textosAsociados.length && <span style={{ color: "#697386", fontSize: 13 }}>Sin mensajes salientes vinculados a una venta con folio.</span>}
        </div>
      </div>

      <div style={{ ...caja, marginTop: 9, overflowX: "auto" }}><strong style={{ color: "#8f315f", fontSize: 13 }}>Conversión descriptiva por segmento</strong><p style={{ margin: "4px 0 7px", color: "#716a73", fontSize: 11 }}>Ganadas / (ganadas + perdidas). Solo ventas con folio SICAR cuentan como ganadas válidas.</p>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(210px, 100%), 1fr))", gap: 9 }}>
          {[["Responsable asignado", resumenDireccion.porResponsable], ["Sucursal", resumenDireccion.porSucursal], ["Canal", resumenDireccion.porCanal], ["Producto", resumenDireccion.porProducto]].map(([titulo, filas]) => <div key={titulo}><strong style={{ fontSize: 13 }}>{titulo}</strong>{filas.slice(0, 5).map((fila) => <div key={fila.id} style={{ display: "flex", justifyContent: "space-between", gap: 8, padding: "6px 0", borderBottom: "1px solid #edf0f5", fontSize: 12 }}><span>{fila.nombre} · {fila.ganadas}/{fila.cerradas} cerradas</span><b>{fila.conversion == null ? "Sin muestra" : `${fila.conversion}%`}</b></div>)}{!filas.length && <p style={{ color: "#697386", fontSize: 12 }}>Sin datos.</p>}</div>)}
        </div>
      </div>

      {perdidaPendiente && <div role="dialog" aria-modal="true" aria-labelledby="crm-perdida-titulo" style={{ ...caja, marginTop: 12, borderColor: "#e3b9b9", background: "#fff8f8" }}>
        <strong id="crm-perdida-titulo">¿Por qué se perdió la oportunidad de {perdidaPendiente.cliente}?</strong>
        <p style={{ margin: "6px 0", color: "#697386", fontSize: 13 }}>Registra el motivo comunicado o conocido. No elijas una causa supuesta.</p>
        <textarea rows={2} value={motivoPerdida} onChange={(e) => setMotivoPerdida(e.target.value)} style={{ ...campo, marginTop: 4 }} placeholder="Ej.: encontró el producto a menor precio, no hubo existencia…" />
        <div style={{ display: "flex", gap: 8, marginTop: 8 }}><button type="button" onClick={confirmarPerdida} style={{ border: 0, borderRadius: 9, padding: "10px 13px", background: "#8c3541", color: "white", fontWeight: 700 }}>Guardar motivo y cerrar</button><button type="button" onClick={() => setPerdidaPendiente(null)} style={{ border: "1px solid #d9dce5", borderRadius: 9, padding: "10px 13px", background: "white" }}>Cancelar</button></div>
      </div>}

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(150px, 100%), 1fr))", gap: 9, marginTop: 14 }}>
        {[
          ["Embudo abierto", resumen.abiertas],
          ["Seguimientos vencidos / hoy", resumen.seguimientosPendientes],
          ["Monto estimado abierto", dinero(resumen.pipelineEstimado)],
          ["Oportunidades registradas", resumen.total],
          ["Tasa de cierre", resumen.tasaCierre == null ? "Pendiente" : `${resumen.tasaCierre}%`],
        ].map(([titulo, valor]) => (
          <div key={titulo} style={{ ...caja, background: "#fff", padding: 10 }}>
            <div style={{ color: "#716a73", fontSize: 12 }}>{titulo}</div>
          <strong style={{ display: "block", marginTop: 4, fontSize: 16, color: "#8f315f" }}>{valor}</strong>
          </div>
        ))}
      </div>
      <p style={{ margin: "8px 0 0", color: "#716a73", fontSize: 11 }}>El monto es una estimación capturada por el equipo; no se suma a ventas ni a utilidad SICAR. La tasa de cierre usa solo oportunidades marcadas como ganadas o perdidas.</p>

      <div style={{ ...caja, marginTop: 14 }}>
        <strong style={{ color: "#8f315f", fontSize: 13 }}>Embudo por etapa</strong>
        <div style={{ display: "grid", gap: 8, marginTop: 9 }}>
          {ETAPAS_CRM.map((etapa) => {
            const cantidad = resumen.porEtapa[etapa] || 0;
            const ancho = resumen.total ? Math.max((cantidad / resumen.total) * 100, cantidad ? 4 : 0) : 0;
            return (
              <div key={etapa} style={{ display: "grid", gridTemplateColumns: "92px 1fr 32px", alignItems: "center", gap: 10 }}>
                <span style={{ color: "#586174", fontSize: 13 }}>{ETIQUETAS[etapa]}</span>
                <div style={{ height: 8, borderRadius: 999, background: "#f1e9ed", overflow: "hidden" }}>
                  <div style={{ width: `${ancho}%`, height: "100%", borderRadius: 999, background: ["GANADO", "PERDIDO"].includes(etapa) ? "#bd6a96" : "#b44178" }} />
                </div>
                <strong style={{ textAlign: "right" }}>{cantidad}</strong>
              </div>
            );
          })}
        </div>
      </div>

      {aviso && <p role="status" style={{ ...caja, marginTop: 14, borderColor: "#b9e5c9", color: "#226b3d", background: "#f1fff5" }}>{aviso}</p>}
      {error && <p role="alert" style={{ ...caja, marginTop: 14, borderColor: "#efb8b8", color: "#982d2d", background: "#fff4f4" }}>{error}</p>}

      {mostrarFormulario && (
        <form onSubmit={guardar} style={{ ...caja, marginTop: 16, display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))", gap: 12 }}>
          <label style={{ display: "grid", gap: 6 }}>Cliente *
            <input required minLength={2} value={formulario.cliente} onChange={(e) => cambiar("cliente", e.target.value)} style={campo} autoComplete="name" />
          </label>
          <label style={{ display: "grid", gap: 6 }}>Teléfono / WhatsApp
            <input value={formulario.telefono} onChange={(e) => cambiar("telefono", e.target.value)} style={campo} inputMode="tel" autoComplete="tel" />
          </label>
          <label style={{ display: "grid", gap: 6 }}>Canal
            <select value={formulario.canal} onChange={(e) => cambiar("canal", e.target.value)} style={campo}>{CANALES.map(([id, etiqueta]) => <option key={id} value={id}>{etiqueta}</option>)}</select>
          </label>
          <label style={{ display: "grid", gap: 6 }}>Etapa
            <select value={formulario.etapa} onChange={(e) => cambiar("etapa", e.target.value)} style={campo}>{ETAPAS_CRM.map((etapa) => <option key={etapa} value={etapa}>{ETIQUETAS[etapa]}</option>)}</select>
          </label>
          <label style={{ display: "grid", gap: 6 }}>Producto o servicio de interés
            <input value={formulario.productoInteres} onChange={(e) => cambiar("productoInteres", e.target.value)} style={campo} />
          </label>
          <label style={{ display: "grid", gap: 6 }}>Venta potencial (MXN)
            <input type="number" min="0" step="0.01" value={formulario.montoEstimado} onChange={(e) => cambiar("montoEstimado", e.target.value)} style={campo} inputMode="decimal" />
          </label>
          {formulario.etapa === "GANADO" && <label style={{ display: "grid", gap: 6 }}>Folio de venta SICAR *
            <input required value={formulario.folioVentaSicar} onChange={(e) => cambiar("folioVentaSicar", e.target.value)} style={campo} placeholder="Folio del ticket" />
          </label>}
          <label style={{ display: "grid", gap: 6 }}>Próximo seguimiento
            <input type="date" value={formulario.proximoSeguimiento} onChange={(e) => cambiar("proximoSeguimiento", e.target.value)} style={campo} />
          </label>
          <label style={{ display: "grid", gap: 6 }}>Asignar a empleada con cuenta activa
            <select value={formulario.empleadoId} onChange={(e) => cambiar("empleadoId", e.target.value)} style={campo}>
              <option value="">Sin asignar</option>
              {empleadosAsignables.map((persona) => <option key={persona.id} value={persona.id}>{persona.nombre} · {persona.puesto || "Equipo"}</option>)}
            </select>
          </label>
          <label style={{ display: "grid", gap: 6, gridColumn: "1 / -1" }}>Notas para el equipo
            <textarea rows={3} value={formulario.notas} onChange={(e) => cambiar("notas", e.target.value)} style={{ ...campo, resize: "vertical" }} />
          </label>
          <div style={{ gridColumn: "1 / -1", display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
            <button disabled={guardando} type="submit" style={{ border: 0, borderRadius: 9, padding: "10px 14px", background: guardando ? "#d7a9be" : "#a83b70", color: "#fff", fontWeight: 700, cursor: guardando ? "wait" : "pointer" }}>{guardando ? "Guardando…" : "Guardar y programar"}</button>
            <span style={{ color: "#697386", fontSize: 13 }}>{empleadosAsignables.length ? "Con empleada y fecha, MONYS crea una tarea operativa para su agenda." : "Falta vincular una cuenta activa de empleada para crear tareas asignadas."}</span>
          </div>
        </form>
      )}

      <div style={{ display: "flex", gap: 7, flexWrap: "wrap", marginTop: 12, marginBottom: 9 }}>
        {[["ABIERTAS", "Abiertas"], ["TODAS", "Todas"], ["CERRADAS", "Ganadas / perdidas"]].map(([id, etiqueta]) => (
          <button key={id} type="button" onClick={() => setFiltro(id)} style={{ border: "1px solid #e6d4de", borderRadius: 999, padding: "7px 11px", background: filtro === id ? "#faedf3" : "#fff", color: "#8f315f", fontWeight: 700, fontSize: 12, cursor: "pointer" }}>{etiqueta}</button>
        ))}
      </div>

      {cargando ? <p>Cargando oportunidades…</p> : visibles.length === 0 ? (
        <div style={{ ...caja, textAlign: "center", color: "#697386" }}>{oportunidades.length ? "No hay oportunidades en este filtro." : "Todavía no hay clientes en el CRM. Registra el próximo seguimiento para empezar a construir el embudo."}</div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(255px, 100%), 1fr))", gap: 9 }}>
          {visibles.map((item) => {
            const vencida = item.proximo_seguimiento && item.proximo_seguimiento <= fechaHoyLocal() && !["GANADO", "PERDIDO"].includes(item.etapa);
            const persona = empleados.find((fila) => fila.id === item.empleado_id);
            return (
              <article id={`crm-oportunidad-${item.id}`} key={item.id} style={{ ...caja, borderColor: vencida ? "#efb8b8" : "#eadfe5", background: vencida ? "#fff8f8" : "#fff", scrollMarginTop: 20 }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "start" }}>
                  <strong style={{ fontSize: 15, overflowWrap: "anywhere" }}>{item.cliente}</strong>
                  <span style={{ borderRadius: 999, background: vencida ? "#fff0f0" : "#faedf3", color: vencida ? "#962c2c" : "#8f315f", padding: "4px 8px", fontSize: 11, whiteSpace: "nowrap" }}>{vencida ? "Seguimiento pendiente" : ETIQUETAS[item.etapa]}</span>
                </div>
                <div style={{ marginTop: 10, color: "#556071", lineHeight: 1.6 }}>
                  <div>{CANALES.find(([id]) => id === item.canal)?.[1] || "Otro"} · {item.producto_interes || "Interés por definir"}</div>
                  <div>Potencial: <strong>{item.monto_estimado == null ? "Sin monto" : dinero(item.monto_estimado)}</strong></div>
                  <div>Próximo paso: <strong>{fechaLegible(item.proximo_seguimiento)}</strong></div>
                  <div>Responsable: {persona?.nombre || "Sin asignar"}</div>
                  {item.telefono && <div>Contacto: {item.telefono}</div>}
                  {item.notas && <div style={{ marginTop: 5, overflowWrap: "anywhere" }}>{item.notas}</div>}
                  {item.ultimo_resultado && <div style={{ marginTop: 7, padding: 9, borderRadius: 9, background: "#f1fff5", color: "#276344", fontSize: 13 }}><strong>Último seguimiento:</strong> {item.ultimo_resultado}</div>}
                </div>
                {!["GANADO", "PERDIDO"].includes(item.etapa) && (
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr auto", gap: 7, alignItems: "end", marginTop: 12 }}>
                    <label style={{ display: "grid", gap: 5, color: "#697386", fontSize: 12 }}>Siguiente fecha
                      <input type="date" value={edicionesSeguimiento[item.id]?.fecha ?? item.proximo_seguimiento ?? ""} onChange={(e) => setEdicionesSeguimiento((prev) => ({ ...prev, [item.id]: { ...prev[item.id], fecha: e.target.value } }))} style={campo} />
                    </label>
                    <label style={{ display: "grid", gap: 5, color: "#697386", fontSize: 12 }}>Responsable
                      <select value={edicionesSeguimiento[item.id]?.empleadoId ?? item.empleado_id ?? ""} onChange={(e) => setEdicionesSeguimiento((prev) => ({ ...prev, [item.id]: { ...prev[item.id], empleadoId: e.target.value } }))} style={campo}>
                        <option value="">Elegir empleada</option>
                        {empleadosAsignables.map((persona) => <option key={persona.id} value={persona.id}>{persona.nombre}{persona.branch_id && persona.branch_id !== item.branch_id ? " · otra sucursal" : ""}</option>)}
                      </select>
                    </label>
                    <button type="button" disabled={programandoId === item.id || !empleadosAsignables.length} onClick={() => programarSiguiente(item)} style={{ border: 0, borderRadius: 8, padding: "9px 10px", background: "#a83b70", color: "#fff", fontWeight: 700, fontSize: 12, cursor: "pointer", opacity: programandoId === item.id ? .65 : 1 }}>{programandoId === item.id ? "Programando…" : "Agendar"}</button>
                  </div>
                )}
                <label style={{ display: "grid", gap: 6, marginTop: 12, color: "#556071", fontSize: 13 }}>Folio de venta SICAR
                  <input value={borradoresInteraccion[item.id]?.folioVentaSicar ?? item.folio_venta_sicar ?? ""} onChange={(e) => setBorradoresInteraccion((prev) => ({ ...prev, [item.id]: { ...prev[item.id], folioVentaSicar: e.target.value } }))} style={campo} placeholder="Vincula el ticket para comisión por atención" />
                </label>
                {item.folio_venta_sicar && <p style={{ margin: "6px 0", color: "#267044", fontSize: 13 }}>Venta vinculada al folio {item.folio_venta_sicar}; comisión se valida desde SICAR.</p>}
                <label style={{ display: "grid", gap: 6, marginTop: 12, color: "#556071", fontSize: 13 }}>Actualizar etapa
                  <select value={item.etapa} onChange={(e) => cambiarEtapa(item, e.target.value)} style={campo}>{ETAPAS_CRM.map((etapa) => <option key={etapa} value={etapa}>{ETIQUETAS[etapa]}</option>)}</select>
                </label>
                <details style={{ marginTop: 12, borderTop: "1px solid #e8ebf2", paddingTop: 10 }}>
                  <summary style={{ cursor: "pointer", color: "#8f315f", fontWeight: 700 }}>Conversaciones ({interacciones.filter((fila) => fila.oportunidad_id === item.id).length})</summary>
                  <div style={{ display: "grid", gap: 8, marginTop: 10 }}>
                    {interacciones.filter((fila) => fila.oportunidad_id === item.id).map((fila) => (
                      <div key={fila.id} style={{ padding: 9, borderRadius: 9, background: "#f6f8fc", fontSize: 13 }}>
                        <strong>{CANALES.find(([id]) => id === fila.canal)?.[1] || fila.canal} · {fila.direccion === "ENTRANTE" ? "Recibido" : fila.direccion === "SALIENTE" ? "Enviado" : "Nota"}</strong>
                        <div style={{ color: "#687386", margin: "3px 0" }}>{new Date(fila.ocurrio_at).toLocaleString("es-MX")} · {equipoCRM.find((persona) => persona.usuario_id === fila.registrado_por)?.nombre || "Equipo"}</div>
                        <div style={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>{fila.mensaje}</div>
                      </div>
                    ))}
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 7 }}>
                      <label style={{ display: "grid", gap: 4, fontSize: 12, color: "#697386" }}>Canal
                        <select value={borradoresInteraccion[item.id]?.canal || item.canal} onChange={(e) => setBorradoresInteraccion((prev) => ({ ...prev, [item.id]: { ...prev[item.id], canal: e.target.value } }))} style={campo}>{CANALES.map(([id, etiqueta]) => <option key={id} value={id}>{etiqueta}</option>)}</select>
                      </label>
                      <label style={{ display: "grid", gap: 4, fontSize: 12, color: "#697386" }}>Tipo
                        <select value={borradoresInteraccion[item.id]?.direccion || "ENTRANTE"} onChange={(e) => setBorradoresInteraccion((prev) => ({ ...prev, [item.id]: { ...prev[item.id], direccion: e.target.value } }))} style={campo}><option value="ENTRANTE">Mensaje recibido</option><option value="SALIENTE">Mensaje enviado</option><option value="NOTA">Nota interna</option></select>
                      </label>
                    </div>
                    <textarea rows={2} value={borradoresInteraccion[item.id]?.mensaje || ""} onChange={(e) => setBorradoresInteraccion((prev) => ({ ...prev, [item.id]: { ...prev[item.id], mensaje: e.target.value } }))} style={{ ...campo, resize: "vertical" }} placeholder="Resumen o contenido del mensaje" />
                    <button type="button" disabled={registrandoInteraccionId === item.id} onClick={() => guardarInteraccion(item)} style={{ border: 0, borderRadius: 8, padding: "9px 11px", background: "#a83b70", color: "#fff", fontWeight: 700, fontSize: 12, cursor: "pointer" }}>{registrandoInteraccionId === item.id ? "Guardando…" : "Guardar conversación"}</button>
                  </div>
                </details>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}
