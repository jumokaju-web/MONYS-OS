import { useEffect, useMemo, useState } from "react";
import {
  guardarUsuarioSicarEmpleado,
  leerDetalleImportacionVentas,
  listarEmpleadosComision,
  listarImportacionesUtilidadVentas,
  listarOportunidadesGanadasComision,
} from "../../services/comisionesSicarService";
import { esUsuarioSicarCompartido, normalizarUsuarioSicar, resumirComisionesSicar } from "../../shared/resumenComisionesSicar";

function fechaLocal(valor) {
  return [valor.getFullYear(), String(valor.getMonth() + 1).padStart(2, "0"), String(valor.getDate()).padStart(2, "0")].join("-");
}

function semanaActual() {
  const hoy = new Date();
  const lunes = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate());
  lunes.setDate(lunes.getDate() - ((lunes.getDay() + 6) % 7));
  const domingo = new Date(lunes);
  domingo.setDate(domingo.getDate() + 6);
  return { desde: fechaLocal(lunes), hasta: fechaLocal(domingo) };
}

function moneda(valor) {
  return new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN", maximumFractionDigits: 2 }).format(Number(valor) || 0);
}

function fechaCarga(valor) {
  if (!valor) return "Fecha no disponible";
  return new Date(valor).toLocaleString("es-MX", { dateStyle: "medium", timeStyle: "short" });
}

const campo = {
  width: "100%",
  boxSizing: "border-box",
  border: "1px solid #d9dce5",
  borderRadius: 10,
  padding: "10px 11px",
  font: "inherit",
  background: "#fff",
};

export default function CentroComisionesRH({ organizationId, businessId, branchId, empleados = [] }) {
  const semana = useMemo(semanaActual, []);
  const [desde, setDesde] = useState(semana.desde);
  const [hasta, setHasta] = useState(semana.hasta);
  const [importaciones, setImportaciones] = useState([]);
  const [importacionId, setImportacionId] = useState("");
  const [detalle, setDetalle] = useState([]);
  const [personal, setPersonal] = useState([]);
  const [oportunidadesCRM, setOportunidadesCRM] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [cargandoDetalle, setCargandoDetalle] = useState(false);
  const [guardandoUsuario, setGuardandoUsuario] = useState("");
  const [error, setError] = useState("");
  const [aviso, setAviso] = useState("");
  const [selecciones, setSelecciones] = useState({});
  const [filtroConciliacion, setFiltroConciliacion] = useState("PENDIENTES");
  const importacionSeleccionada = importaciones.find((item) => item.id === importacionId) || null;

  async function cargarCatalogos() {
    if (!branchId) {
      setImportaciones([]);
      setPersonal([]);
      setOportunidadesCRM([]);
      setCargando(false);
      return;
    }
    setCargando(true);
    setError("");
    const [cargas, equipo, crm] = await Promise.allSettled([
      listarImportacionesUtilidadVentas(branchId),
      listarEmpleadosComision(branchId),
      listarOportunidadesGanadasComision({ branchId, businessId }),
    ]);
    if (cargas.status === "fulfilled") {
      const lista = cargas.value;
      setImportaciones(lista);
      setImportacionId((actual) => lista.some((item) => item.id === actual) ? actual : lista[0]?.id || "");
    } else {
      setImportaciones([]);
      setError(cargas.reason?.message || "No se pudieron consultar las importaciones de SICAR.");
    }
    if (equipo.status === "fulfilled") {
      setPersonal(equipo.value);
    } else {
      setPersonal([]);
      setError((anterior) => [anterior, "No se pudo cargar el mapeo de SICAR. Aplica la migración del campo usuario_sicar."].filter(Boolean).join(" "));
    }
    if (crm.status === "fulfilled") setOportunidadesCRM(crm.value);
    else {
      setOportunidadesCRM([]);
      setError((anterior) => [anterior, "No se pudo cruzar el CRM con folios SICAR."].filter(Boolean).join(" "));
    }
    setCargando(false);
  }

  useEffect(() => {
    cargarCatalogos();
  }, [branchId]);

  useEffect(() => {
    let activo = true;
    async function cargarDetalle() {
      if (!importacionId) {
        setDetalle([]);
        return;
      }
      setCargandoDetalle(true);
      try {
        const filas = await leerDetalleImportacionVentas(importacionId, importacionSeleccionada?.total_filas);
        if (activo) setDetalle(filas);
      } catch (err) {
        if (activo) {
          setDetalle([]);
          setError(err?.message || "No se pudo leer el detalle del reporte SICAR.");
        }
      } finally {
        if (activo) setCargandoDetalle(false);
      }
    }
    cargarDetalle();
    return () => { activo = false; };
  }, [importacionId, importacionSeleccionada?.total_filas]);

  const resumen = useMemo(
    () => resumirComisionesSicar({ filas: detalle, empleados: personal, desde, hasta, oportunidadesCRM }),
    [detalle, personal, desde, hasta, oportunidadesCRM],
  );

  const filasConciliacion = useMemo(() => {
    const filas = resumen.conciliacion || [];
    return filtroConciliacion === "TODAS"
      ? filas
      : filas.filter((fila) => !["CRM_ATRIBUIDO", "SICAR_ASIGNADO"].includes(fila.estado));
  }, [resumen.conciliacion, filtroConciliacion]);

  const usuariosSicar = useMemo(() => {
    const unicos = new Map();
    for (const fila of detalle) {
      const raw = fila?.datos_originales || {};
      const usuario = String(raw.usuario || raw.vendedor || "").trim();
      const clave = normalizarUsuarioSicar(usuario);
      if (clave && !unicos.has(clave)) unicos.set(clave, usuario);
    }
    return [...unicos.entries()].map(([clave, usuarioSicar]) => ({ clave, usuarioSicar }));
  }, [detalle]);

  const empleadosDisponibles = personal.length
    ? personal
    : empleados.filter((item) => item.active);

  async function guardarMapeo(usuarioSicar) {
    if (esUsuarioSicarCompartido(usuarioSicar)) {
      setError("La cuenta compartida de una sucursal no se puede asignar a una sola empleada.");
      return;
    }
    const empleadoId = selecciones[normalizarUsuarioSicar(usuarioSicar)];
    if (!empleadoId) {
      setError("Selecciona a qué empleada corresponde ese usuario de SICAR.");
      return;
    }
    setGuardandoUsuario(usuarioSicar);
    setError("");
    setAviso("");
    try {
      const empleado = await guardarUsuarioSicarEmpleado({ empleadoId, usuarioSicar });
      setAviso(`SICAR “${usuarioSicar}” quedó asignado a ${empleado.nombre}.`);
      setSelecciones((prev) => ({ ...prev, [normalizarUsuarioSicar(usuarioSicar)]: empleadoId }));
      await cargarCatalogos();
    } catch (err) {
      setError(err?.message || "No se pudo guardar la asignación.");
    } finally {
      setGuardandoUsuario("");
    }
  }

  const importacionActual = importaciones.find((item) => item.id === importacionId);

  return (
    <section style={{ marginTop: 28, padding: 22, borderRadius: 18, background: "linear-gradient(135deg, #fff 0%, #f4fff8 100%)", border: "1px solid #bde4cc", boxShadow: "0 12px 30px rgba(34, 107, 61, .08)" }}>
      <div style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", alignItems: "start", gap: 12 }}>
        <div>
          <p style={{ margin: "0 0 6px", color: "#227a48", fontWeight: 800, letterSpacing: ".08em" }}>MONYS OS · RH + FINANZAS</p>
          <h3 style={{ margin: 0, fontSize: 23 }}>💵 Comisión semanal SICAR</h3>
          <p style={{ margin: "8px 0 0", color: "#586174", maxWidth: 700 }}>Cruza tickets SICAR con sus responsables: si el folio está vinculado a una venta ganada del CRM, la comisión se atribuye a la empleada que atendió a la clienta. Es una estimación para revisión; no registra pagos ni modifica nómina.</p>
        </div>
        <div style={{ padding: "9px 13px", borderRadius: 999, background: "#e9f8ef", color: "#226b3d", fontWeight: 800 }}>Tasa configurada: 1%</div>
      </div>

      {error && <p role="alert" style={{ marginTop: 14, padding: 12, borderRadius: 10, background: "#fff3f3", color: "#9a3030", border: "1px solid #efb8b8" }}>{error}</p>}
      {aviso && <p role="status" style={{ marginTop: 14, padding: 12, borderRadius: 10, background: "#f0fff5", color: "#23683d", border: "1px solid #b9e5c9" }}>{aviso}</p>}

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))", gap: 10, marginTop: 18 }}>
        <label style={{ display: "grid", gap: 5, color: "#626c7a" }}>Importación SICAR
          <select value={importacionId} onChange={(e) => setImportacionId(e.target.value)} style={campo}>
            {importaciones.length ? importaciones.map((item) => <option key={item.id} value={item.id}>{item.archivo_original || "Reporte sin nombre"} · {fechaCarga(item.created_at)}</option>) : <option value="">Sin reportes importados</option>}
          </select>
        </label>
        <label style={{ display: "grid", gap: 5, color: "#626c7a" }}>Desde
          <input type="date" value={desde} onChange={(e) => setDesde(e.target.value)} style={campo} />
        </label>
        <label style={{ display: "grid", gap: 5, color: "#626c7a" }}>Hasta
          <input type="date" value={hasta} onChange={(e) => setHasta(e.target.value)} style={campo} />
        </label>
      </div>
      {importacionActual && <p style={{ margin: "8px 0 0", color: "#697386", fontSize: 13 }}>Fuente: {importacionActual.archivo_original || "Reporte SICAR"} · importado {fechaCarga(importacionActual.created_at)} · {detalle.length.toLocaleString("es-MX")} filas leídas.</p>}

      {resumen.ajustesNegativosPendientes?.tickets > 0 && <div role="status" style={{ marginTop: 12, padding: 13, borderRadius: 12, background: "#fff8e9", border: "1px solid #ead39c", color: "#805700" }}>
        <strong>{resumen.ajustesNegativosPendientes.tickets} folios con importe negativo en SICAR · {moneda(resumen.ajustesNegativosPendientes.importe)} por revisar</strong>
        <div style={{ marginTop: 4, fontSize: 13 }}>Se muestran aparte y no cambian la comisión hasta confirmar si son devolución, cancelación u otro ajuste. El reporte actual no identifica el motivo.</div>
      </div>}

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(155px, 1fr))", gap: 10, marginTop: 14 }}>
        {[
          ["Ventas con folio", moneda(resumen.ventasPeriodo)],
          ["Ventas asignadas", moneda(resumen.ventasAsignadas)],
          ["Comisión estimada", moneda(resumen.comisionTotal)],
          ["Tickets identificados", resumen.tickets],
          ["Venta pendiente de resolver", moneda(resumen.ventasSinAsignar)],
          ["Folios por revisar", resumen.ticketsPorRevisar],
        ].map(([titulo, valor]) => <div key={titulo} style={{ background: "#fff", border: "1px solid #dcece2", borderRadius: 12, padding: 12 }}><div style={{ color: "#697386", fontSize: 12 }}>{titulo}</div><strong style={{ display: "block", marginTop: 5, color: "#245d3b", fontSize: 18 }}>{valor}</strong></div>)}
      </div>

      {cargando || cargandoDetalle ? <p style={{ marginTop: 14 }}>Leyendo datos de SICAR…</p> : !importaciones.length ? (
        <div style={{ marginTop: 14, padding: 14, borderRadius: 12, background: "#fff", border: "1px dashed #a9cbb5", color: "#526458" }}>Importa primero en MONYS el reporte SICAR “Utilidad de ventas”. Debe incluir fecha, folio, usuario/vendedor y total de venta para calcular comisiones verificables.</div>
      ) : (
        <>
          {resumen.filasSinIdentidad > 0 && <p style={{ color: "#916218", fontSize: 13 }}>{resumen.filasSinIdentidad} filas se omitieron porque les falta fecha, folio, usuario o venta válida.</p>}
          <div style={{ marginTop: 14, overflowX: "auto" }}>
            <table style={{ width: "100%", minWidth: 520, borderCollapse: "collapse", background: "#fff", borderRadius: 12 }}>
              <thead><tr>{["Empleada", "Tickets", "Tickets CRM", "Venta base", "1% estimado"].map((label) => <th key={label} style={{ textAlign: "left", padding: 11, borderBottom: "1px solid #e4e8ef", color: "#536073" }}>{label}</th>)}</tr></thead>
              <tbody>
                {resumen.comisiones.map((fila) => <tr key={fila.empleadoId}><td style={{ padding: 11, borderBottom: "1px solid #eef0f4", fontWeight: 700 }}>{fila.empleado}</td><td style={{ padding: 11, borderBottom: "1px solid #eef0f4" }}>{fila.tickets}</td><td style={{ padding: 11, borderBottom: "1px solid #eef0f4" }}>{fila.ticketsCRM || 0}</td><td style={{ padding: 11, borderBottom: "1px solid #eef0f4" }}>{moneda(fila.ventas)}</td><td style={{ padding: 11, borderBottom: "1px solid #eef0f4", color: "#237847", fontWeight: 800 }}>{moneda(fila.comision)}</td></tr>)}
                {!resumen.comisiones.length && <tr><td colSpan={5} style={{ padding: 15, color: "#697386", textAlign: "center" }}>Aún no hay ventas asignadas a empleadas para este rango.</td></tr>}
              </tbody>
            </table>
          </div>

          <details open style={{ marginTop: 18, padding: 14, borderRadius: 12, background: "#fff", border: "1px solid #dcece2" }}>
            <summary style={{ color: "#245d3b", fontWeight: 800, cursor: "pointer" }}>Conciliación por folio · {(resumen.conciliacion || []).filter((fila) => !["CRM_ATRIBUIDO", "SICAR_ASIGNADO"].includes(fila.estado)).length} por revisar</summary>
            <p style={{ margin: "6px 0 10px", color: "#697386", fontSize: 13 }}>CRM identifica quién atendió; SICAR aporta el importe real. Los folios con dudas quedan fuera del cálculo automático.</p>
            <label style={{ display: "grid", gridTemplateColumns: "minmax(180px, 260px) 1fr", alignItems: "center", gap: 8, marginBottom: 10, color: "#697386", fontSize: 13 }}>Mostrar
              <select value={filtroConciliacion} onChange={(e) => setFiltroConciliacion(e.target.value)} style={campo}>
                <option value="PENDIENTES">Solo folios por revisar</option>
                <option value="TODAS">Todos los folios</option>
              </select>
            </label>
            <div style={{ overflow: "auto", maxHeight: 390 }}>
              <table style={{ width: "100%", minWidth: 820, borderCollapse: "collapse" }}>
                <thead><tr>{["Folio", "Fecha", "Usuario SICAR", "Responsable", "Empleadas CRM", "Venta SICAR", "Resultado"].map((label) => <th key={label} style={{ position: "sticky", top: 0, textAlign: "left", padding: 9, background: "#f7f9fc", borderBottom: "1px solid #e4e8ef", color: "#536073" }}>{label}</th>)}</tr></thead>
                <tbody>
                  {filasConciliacion.map((fila, index) => {
                    const etiquetas = {
                      CRM_ATRIBUIDO: "Atribuida desde CRM",
                      SICAR_ASIGNADO: "Asignada por usuario SICAR",
                      CRM_FOLIO_DUPLICADO: "Revisar: folio repetido en CRM",
                      CRM_MULTIPLES_EMPLEADAS: "Revisar: varias empleadas atendieron",
                      CRM_PARTICIPACION_NO_VERIFICADA: "Revisar: no se pudo validar participación",
                      CRM_SIN_RESPONSABLE: "Revisar: CRM sin responsable",
                      CRM_EMPLEADA_NO_ENCONTRADA: "Revisar: responsable no encontrado",
                      SICAR_AMBIGUO: "Revisar: usuario SICAR duplicado",
                      SICAR_SIN_USUARIO: "Revisar: ticket sin usuario SICAR",
                      SIN_ASIGNAR: "Revisar: sin asignación",
                      USUARIO_SICAR_COMPARTIDO: "Revisar: cuenta compartida de sucursal",
                      AJUSTE_NEGATIVO_PENDIENTE: "Ajuste negativo por revisar",
                      CRM_SIN_TICKET_EN_REPORTE: "Revisar: folio CRM no está en el reporte",
                      CRM_DUPLICADO_SIN_TICKET: "Revisar: folio CRM duplicado y sin ticket",
                    };
                    return <tr key={`${fila.folio}-${fila.fecha}-${fila.estado}-${index}`}>
                      <td style={{ padding: 9, borderBottom: "1px solid #eef0f4", fontWeight: 700 }}>{fila.folio || "—"}</td>
                      <td style={{ padding: 9, borderBottom: "1px solid #eef0f4" }}>{fila.fecha || "—"}</td>
                      <td style={{ padding: 9, borderBottom: "1px solid #eef0f4" }}>{fila.usuarioSicar || "—"}</td>
                      <td style={{ padding: 9, borderBottom: "1px solid #eef0f4" }}>{fila.empleado || "—"}</td>
                      <td style={{ padding: 9, borderBottom: "1px solid #eef0f4" }}>{fila.participantes?.length ? fila.participantes.join(" · ") : "—"}</td>
                      <td style={{ padding: 9, borderBottom: "1px solid #eef0f4" }}>{fila.importe == null ? "—" : moneda(fila.importe)}</td>
                      <td style={{ padding: 9, borderBottom: "1px solid #eef0f4", color: ["CRM_ATRIBUIDO", "SICAR_ASIGNADO"].includes(fila.estado) ? "#237847" : "#805700", fontWeight: 700 }}>{etiquetas[fila.estado] || fila.estado}</td>
                    </tr>;
                  })}
                  {!filasConciliacion.length && <tr><td colSpan={7} style={{ padding: 14, color: "#697386", textAlign: "center" }}>No hay folios pendientes de revisión para este reporte y periodo.</td></tr>}
                </tbody>
              </table>
            </div>
          </details>

          {usuariosSicar.length > 0 && <div style={{ marginTop: 18, padding: 14, borderRadius: 12, background: "#fff", border: "1px solid #dcece2" }}>
            <strong style={{ color: "#245d3b" }}>Asignar usuarios de SICAR</strong>
            <p style={{ margin: "5px 0 12px", color: "#697386", fontSize: 13 }}>Confirma manualmente quién usa cada nombre de SICAR. MONYS no adivina equivalencias; cada empleada tiene un usuario SICAR asignado.</p>
            <div style={{ display: "grid", gap: 9 }}>
              {usuariosSicar.map(({ clave, usuarioSicar }) => {
                const actual = personal.find((persona) => normalizarUsuarioSicar(persona.usuario_sicar) === clave);
                const seleccionado = selecciones[clave] ?? actual?.id ?? "";
                const compartido = esUsuarioSicarCompartido(usuarioSicar);
                return <div key={clave} style={{ display: "grid", gridTemplateColumns: "minmax(140px, 1fr) minmax(180px, 1fr) auto", alignItems: "center", gap: 8, padding: 9, borderRadius: 10, background: "#f8fbf9" }}>
                  <div><strong>{usuarioSicar}</strong>{compartido && <small style={{ display: "block", color: "#805700", marginTop: 4 }}>Cuenta compartida de sucursal; no se asigna a una empleada.</small>}</div>
                  <select disabled={compartido} value={seleccionado} onChange={(e) => setSelecciones((prev) => ({ ...prev, [clave]: e.target.value }))} style={{ ...campo, background: compartido ? "#f1f2f4" : "#fff" }}>
                    <option value="">Elegir empleada</option>
                    {empleadosDisponibles.map((persona) => <option key={persona.id} value={persona.id}>{persona.nombre}{persona.active ? "" : " · baja"}</option>)}
                  </select>
                  <button type="button" disabled={compartido || !seleccionado || guardandoUsuario === usuarioSicar} onClick={() => guardarMapeo(usuarioSicar)} style={{ border: 0, borderRadius: 9, background: "#277648", color: "#fff", padding: "10px 12px", fontWeight: 800, cursor: "pointer" }}>{guardandoUsuario === usuarioSicar ? "Guardando…" : "Guardar"}</button>
                </div>;
              })}
            </div>
          </div>}

          {resumen.sinAsignar.length > 0 && <div style={{ marginTop: 14, padding: 13, borderRadius: 12, background: "#fff8e9", border: "1px solid #ead39c" }}>
            <strong style={{ color: "#805700" }}>Ventas pendientes de asignación</strong>
            {resumen.sinAsignar.map((fila) => <div key={normalizarUsuarioSicar(fila.usuarioSicar)} style={{ display: "flex", justifyContent: "space-between", gap: 10, padding: "8px 0", borderTop: "1px solid #efdfba" }}><span>{fila.usuarioSicar} · {fila.motivo === "ASIGNACION_AMBIGUA" ? "asignación SICAR duplicada" : "sin asignar"} · {fila.tickets} tickets</span><strong>{moneda(fila.ventas)}</strong></div>)}
          </div>}
        </>
      )}
    </section>
  );
}
