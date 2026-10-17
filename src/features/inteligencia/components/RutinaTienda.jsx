import { useEffect, useMemo, useState } from "react";
import { supabase } from "../../../supabase";
import { analizarInventario } from "../analyzers/inventarioAnalyzer";
import { obtenerEmpleadosActivosParaAsignacion } from "../services/empleadosRHService";
import { AREAS_OPERATIVAS, obtenerConfiguracionesOperativasSucursal } from "../services/empleadoConfiguracionOperativaService";
import { fechaActualMexico, obtenerAsistenciaOperativa } from "../services/asistenciaOperativaService";
import { crearTareaOperativa, obtenerTareasOperativas } from "../services/tareasOperativasService";
import { obtenerExcepcionesHorario, obtenerHorariosEmpleados } from "../services/horarioEmpleadoService";
import { construirRutinaInteligente, priorizarProductosParaConteo, tareasPendientesDeRutina } from "../shared/rutinaTienda";
import { RESPONSABILIDADES_EMPLEADO } from "../shared/responsabilidadesEmpleado";

const LISTA_VACIA = [];

function fechaLocalHoy() {
  return fechaActualMexico();
}

function inicioPeriodo(fecha, dias = 30) {
  const d = new Date(`${fecha}T12:00:00`);
  d.setDate(d.getDate() - dias);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function edadEnDias(fecha) {
  if (!fecha) return null;
  const dia = new Date(fecha);
  if (Number.isNaN(dia.getTime())) return null;
  return Math.max(0, Math.floor((Date.now() - dia.getTime()) / 86400000));
}

function fechaCorta(fecha) {
  if (!fecha) return "sin fecha";
  const valor = new Date(fecha);
  if (Number.isNaN(valor.getTime())) return "sin fecha";
  return new Intl.DateTimeFormat("es-MX", { dateStyle: "medium" }).format(valor);
}

export default function RutinaTienda({
  organizationId = null,
  businessId = null,
  branchId = null,
  datosDashboard = null,
  onGuardada = null,
}) {
  const [empleados, setEmpleados] = useState([]);
  const [configuraciones, setConfiguraciones] = useState([]);
  const [historial, setHistorial] = useState([]);
  const [horarios, setHorarios] = useState([]);
  const [excepcionesHorario, setExcepcionesHorario] = useState([]);
  const [asistenciaRegistrada, setAsistenciaRegistrada] = useState(null);
  const [fecha, setFecha] = useState(fechaLocalHoy);
  const [cargando, setCargando] = useState(false);
  const [actualizandoEntradas, setActualizandoEntradas] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState("");
  const [mensaje, setMensaje] = useState("");

  const inventario = datosDashboard?.inventario;
  const inventarioDeEstaSucursal = !datosDashboard?.branch_id || !branchId || String(datosDashboard.branch_id) === String(branchId);
  const detalles = inventarioDeEstaSucursal && Array.isArray(inventario?.detalles) ? inventario.detalles : LISTA_VACIA;
  const metricas = datosDashboard?.metricas || {};
  const ventas = datosDashboard?.inteligencia?.comercial?.ventas || LISTA_VACIA;
  const fechaFuente = inventarioDeEstaSucursal ? inventario?.importacion?.created_at || null : null;
  const productosCriticos = useMemo(() => {
    if (!fechaFuente || !detalles.length) return [];
    const resultado = analizarInventario(detalles, {
      ventas,
      diasAnalizados: metricas.diasAnalizados || 7,
      diasObjetivoInventario: 30,
    });
    const urgentes = resultado.productos.filter((producto) =>
      ["CRITICO", "BAJO", "AGOTADO"].includes(String(producto.nivelInventario || "").toUpperCase()) ||
      Number(producto.existencia) < 0,
    );
    return priorizarProductosParaConteo(urgentes);
  }, [detalles, fechaFuente, metricas.diasAnalizados, ventas]);

  useEffect(() => {
    let vigente = true;
    async function cargar() {
      if (!branchId) {
        setEmpleados([]);
        setConfiguraciones([]);
        setHistorial([]);
        setHorarios([]);
        setExcepcionesHorario([]);
        setAsistenciaRegistrada(null);
        setError("Selecciona una sucursal para preparar sus rutinas.");
        return;
      }
      setCargando(true);
      setError("");
      try {
        const requiereChecada = fecha === fechaActualMexico();
        const [lista, perfiles, tareas, asistencia] = await Promise.all([
          obtenerEmpleadosActivosParaAsignacion(branchId),
          obtenerConfiguracionesOperativasSucursal(branchId),
          supabase.from("tareas_operativas")
            .select("titulo, area, responsable, fecha, estado")
            .eq("branch_id", branchId)
            .gte("fecha", inicioPeriodo(fecha))
            .lt("fecha", fecha)
            .order("fecha", { ascending: false }),
          requiereChecada ? obtenerAsistenciaOperativa({ branchId, fecha }) : Promise.resolve(null),
        ]);
        if (tareas.error) throw tareas.error;
        const idsEmpleados = lista.map((empleado) => empleado.id).filter(Boolean);
        const [calendarioSemanal, cambiosFecha] = await Promise.all([
          obtenerHorariosEmpleados(idsEmpleados),
          obtenerExcepcionesHorario({ empleadoIds: idsEmpleados, fechaDesde: fecha, fechaHasta: fecha }),
        ]);
        if (vigente) {
          setEmpleados(lista);
          setConfiguraciones(perfiles);
          setHistorial((tareas.data || []).filter((tarea) =>
            /baño|barrer|trapear|bodega|inventario crítico/i.test(tarea.titulo || ""),
          ));
          setHorarios(calendarioSemanal);
          setExcepcionesHorario(cambiosFecha);
          setAsistenciaRegistrada(asistencia);
        }
      } catch (errorCarga) {
        if (vigente) {
          setError(errorCarga?.message || "No pudimos cargar el equipo y sus perfiles operativos.");
          setAsistenciaRegistrada(fecha === fechaActualMexico() ? [] : null);
        }
      } finally {
        if (vigente) setCargando(false);
      }
    }
    cargar();
    return () => { vigente = false; };
  }, [branchId, fecha]);

  const configuracionRutina = useMemo(() => {
    try {
      return construirRutinaInteligente({
        fecha,
        empleados,
        configuraciones,
        horarios,
        excepcionesHorario,
        historial,
        productosCriticos,
        fuenteInventario: fechaFuente ? { fecha: fechaCorta(fechaFuente), nombre: inventario?.importacion?.nombre || null } : null,
        asistenciaRegistrada,
      });
    } catch (errorRutina) {
      return { tareas: [], avisos: [errorRutina.message], equipo: [], empleadosDisponibles: 0, personasProgramadas: [], asistencias: [], personasPresentes: null, productosUrgentes: 0, productosAsignados: 0 };
    }
  }, [fecha, empleados, configuraciones, horarios, excepcionesHorario, historial, productosCriticos, fechaFuente, inventario?.importacion?.nombre, asistenciaRegistrada]);

  const edadReporte = edadEnDias(fechaFuente);
  const etiquetasArea = new Map(AREAS_OPERATIVAS.map((area) => [area.id, area.nombre]));
  const etiquetasResponsabilidad = new Map(RESPONSABILIDADES_EMPLEADO.map((item) => [item.id, item.nombre]));
  const estadosEquipo = {
    PRESENTE: { texto: "Entrada registrada", fondo: "#e9f7ef", color: "#246b45" },
    SIN_ENTRADA: { texto: "Sin entrada", fondo: "#fff4df", color: "#815d14" },
    DESCANSA: { texto: "Descansa hoy", fondo: "#f1edf2", color: "#665866" },
    HORARIO_FLEXIBLE: { texto: "Horario flexible · confirmar", fondo: "#fff4df", color: "#815d14" },
    PROGRAMADA: { texto: "Programada", fondo: "#edf3ff", color: "#3c5e91" },
    PERFIL_PENDIENTE: { texto: "Perfil pendiente", fondo: "#fff0ef", color: "#a0443c" },
  };

  async function actualizarEntradas() {
    if (!branchId || fecha !== fechaActualMexico()) return;
    setActualizandoEntradas(true);
    setError("");
    try {
      setAsistenciaRegistrada(await obtenerAsistenciaOperativa({ branchId, fecha }));
    } catch (errorCarga) {
      setError(errorCarga?.message || "No pudimos actualizar las entradas de la sucursal.");
    } finally {
      setActualizandoEntradas(false);
    }
  }

  async function prepararRutina(event) {
    event.preventDefault();
    setError("");
    setMensaje("");
    if (!branchId) {
      setError("Falta la sucursal. No se guardó ninguna tarea.");
      return;
    }
    if (!configuracionRutina.tareas.length) {
      setError("Todavía no hay tareas que puedan asignarse. Revisa los perfiles, turnos y responsabilidades del equipo.");
      return;
    }
    try {
      setGuardando(true);
      const existentes = await obtenerTareasOperativas({ branchId, fecha });
      const pendientes = tareasPendientesDeRutina(configuracionRutina.tareas, existentes);
      let creadas = 0;
      const fallidas = [];
      for (const tarea of pendientes) {
        try {
          await crearTareaOperativa({
            organizationId,
            businessId,
            branchId,
            ...tarea,
            creadaPor: "MONYS OS · Rutina inteligente de tienda",
          });
          creadas += 1;
        } catch (errorTarea) {
          fallidas.push(`${tarea.titulo} (${tarea.responsable}): ${errorTarea?.message || "error al guardar"}`);
        }
      }
      if (creadas > 0) await onGuardada?.();
      if (fallidas.length) {
        setError(`Se guardaron ${creadas}; ${fallidas.length} tareas no se pudieron guardar: ${fallidas.join("; ")}`);
      } else if (creadas) {
        setMensaje(`Rutina preparada: ${creadas} tareas asignadas. ${configuracionRutina.empleadosDisponibles} personas disponibles; se respetaron descansos y turnos.`);
      } else {
        setMensaje("La rutina ya estaba preparada para esta fecha; no se duplicaron tareas.");
      }
    } catch (errorGuardar) {
      setError(errorGuardar?.message || "No se pudo preparar la rutina de tienda.");
    } finally {
      setGuardando(false);
    }
  }

  return (
    <details id="reparto-trabajo-dia" style={{ margin: "0 0 20px", border: "1px solid #e6cad8", borderRadius: "16px", background: "#fffafd", overflow: "hidden", scrollMarginTop: "18px" }}>
      <summary style={{ padding: "16px", cursor: "pointer", color: "#76254f", fontSize: "17px", fontWeight: 900 }}>
        🧹 Reparto de trabajo del día
        <span style={{ display: "block", marginTop: "5px", color: "#77636d", fontSize: "13px", fontWeight: 500 }}>
          Revisa quién está, su turno y las tareas antes de asignarlas.
        </span>
      </summary>
      <form onSubmit={prepararRutina} style={{ display: "grid", gap: "13px", padding: "16px", borderTop: "1px solid #efdae5" }}>
        <div style={{ padding: "14px 15px", borderRadius: "13px", color: "#fff", background: "linear-gradient(120deg,#74234d,#a92c68)" }}>
          <small style={{ display: "block", opacity: 0.82, fontWeight: 750, letterSpacing: ".08em" }}>DECISIÓN DE DIRECCIÓN · {fecha}</small>
          <strong style={{ display: "block", marginTop: "5px", fontSize: "18px" }}>{configuracionRutina.empleadosDisponibles} {configuracionRutina.empleadosDisponibles === 1 ? "persona disponible" : "personas disponibles"} · {configuracionRutina.tareas.length} tareas sugeridas</strong>
          <span style={{ display: "block", marginTop: "5px", fontSize: "13px", lineHeight: 1.45, opacity: 0.9 }}>MONYS respeta descansos y turnos; el reparto se revisa aquí antes de guardarse para el equipo.</span>
        </div>
        <p style={{ margin: 0, padding: "10px 12px", borderRadius: "10px", background: "#fff7e8", color: "#765c27", fontSize: "13px", lineHeight: 1.45 }}>
          {fecha === fechaActualMexico()
            ? "Para hoy, las tareas solo se asignan a empleadas que registraron entrada en esta sucursal; se excluyen descansos y perfiles incompletos."
            : "Para otra fecha, MONYS toma el personal programado según perfil, turno y descanso. Al preparar la rutina de hoy, usará las entradas registradas."}
        </p>
        <label style={{ display: "grid", gap: "6px", maxWidth: "260px", fontWeight: 750, fontSize: "14px" }}>
          Fecha de la rutina
          <input type="date" required value={fecha} onChange={(event) => setFecha(event.target.value)} style={{ minHeight: "42px", padding: "8px", border: "1px solid #d9bdcc", borderRadius: "10px" }} />
        </label>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "9px" }}>
          {[
            [fecha === fechaActualMexico() ? "Registraron entrada" : "Programadas", configuracionRutina.empleadosDisponibles],
            ["Tareas preparadas", configuracionRutina.tareas.length],
            ["Productos urgentes", configuracionRutina.productosUrgentes],
            ["Asignados en lotes", configuracionRutina.productosAsignados],
          ].map(([label, value]) => (
            <div key={label} style={{ padding: "12px", borderRadius: "12px", border: "1px solid #eddae4", background: "#fff" }}>
              <small style={{ display: "block", color: "#77636d" }}>{label}</small>
              <strong style={{ display: "block", marginTop: "3px", color: "#362631", fontSize: "20px" }}>{value}</strong>
            </div>
          ))}
        </div>
        <section aria-label="Equipo considerado para el reparto" style={{ display: "grid", gap: "9px", padding: "13px", borderRadius: "14px", border: "1px solid #eadbe3", background: "#fff" }}>
          <header style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
            <strong style={{ color: "#3b2c35", fontSize: "15px" }}>Equipo y asistencia</strong>
            <span style={{ color: "#77636d", fontSize: "12px" }}>{configuracionRutina.equipo.filter((persona) => persona.estado === "PRESENTE").length} presentes · {configuracionRutina.equipo.filter((persona) => persona.estado === "DESCANSA").length} descansan</span>
          </header>
          {configuracionRutina.equipo.length ? configuracionRutina.equipo.map((persona) => {
            const estado = estadosEquipo[persona.estado] || estadosEquipo.PROGRAMADA;
            const areas = persona.areas.map((id) => etiquetasArea.get(id) || id).join(" · ");
            const roles = persona.responsabilidades.map((id) => etiquetasResponsabilidad.get(id) || id).join(" · ");
            const horaEntrada = persona.entradaAt
              ? new Intl.DateTimeFormat("es-MX", { timeZone: "America/Mexico_City", hour: "2-digit", minute: "2-digit" }).format(new Date(persona.entradaAt))
              : null;
            return <article key={persona.empleadoId} style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) auto", alignItems: "center", gap: "8px 12px", padding: "10px 11px", borderRadius: "11px", border: "1px solid #f0e7ec", background: "#fffafd" }}>
              <div style={{ minWidth: 0 }}>
                <strong style={{ display: "block", color: "#392c34", fontSize: "14px" }}>{persona.nombre}</strong>
                <span style={{ display: "block", marginTop: "3px", color: "#71636b", fontSize: "12px", lineHeight: 1.4 }}>{[persona.puesto, persona.horaInicio && persona.horaFin ? `${String(persona.horaInicio).slice(0, 5)} a ${String(persona.horaFin).slice(0, 5)}` : persona.turno === "PRIMERO" ? "Primer turno" : persona.turno === "SEGUNDO" ? "Segundo turno" : persona.turno === "AMBOS" ? "Ambos turnos" : null, areas, roles].filter(Boolean).join(" · ") || "Completa su perfil operativo"}</span>
              </div>
              <span style={{ padding: "6px 9px", borderRadius: "999px", whiteSpace: "nowrap", background: estado.fondo, color: estado.color, fontSize: "11px", fontWeight: 800 }}>{estado.texto}{horaEntrada ? ` · ${horaEntrada}` : ""}</span>
            </article>;
          }) : <p style={{ margin: 0, color: "#77636d", fontSize: "13px" }}>No hay fichas de empleadas activas en esta sucursal.</p>}
          {fecha === fechaActualMexico() && configuracionRutina.equipo.some((persona) => persona.estado === "SIN_ENTRADA") && <small style={{ color: "#815d14", lineHeight: 1.45 }}>Las personas sin entrada no reciben tareas hoy. Pídeles registrar su llegada desde su usuario y actualiza las entradas.</small>}
        </section>
        {fechaFuente && <p style={{ margin: 0, color: edadReporte > 7 ? "#875d1c" : "#77636d", fontSize: "13px" }}>
          Inventario fuente: SICAR del {fechaCorta(fechaFuente)}{edadReporte > 7 ? ` · ${edadReporte} días de antigüedad; validar existencias antes de comprar.` : ""}
        </p>}
        {!inventarioDeEstaSucursal && <p style={{ margin: 0, color: "#a52d2d", fontSize: "13px" }}>La información visible de SICAR pertenece a otra sucursal; no se usará para repartir productos en esta.</p>}
        {inventarioDeEstaSucursal && !fechaFuente && <p style={{ margin: 0, color: "#875d1c", fontSize: "13px" }}>Aún no hay inventario SICAR cargado para esta sucursal; hoy no se asignará conteo de bodega.</p>}
        {fecha === fechaActualMexico() && <button type="button" onClick={actualizarEntradas} disabled={actualizandoEntradas || cargando} style={{ justifySelf: "start", minHeight: "38px", padding: "7px 12px", border: "1px solid #d9bdcc", borderRadius: "9px", background: "#fff", color: "#76254f", fontWeight: 750, cursor: "pointer" }}>
          {actualizandoEntradas ? "Actualizando entradas…" : "Actualizar entradas"}
        </button>}
        {cargando && <p role="status" style={{ margin: 0 }}>Revisando equipo, descansos e historial de tareas…</p>}
        {configuracionRutina.tareas.length > 0 && (
          <div style={{ display: "grid", gap: "7px" }}>
            {configuracionRutina.tareas.map((tarea) => (
              <div key={`${tarea.titulo}-${tarea.responsable}`} style={{ display: "flex", justifyContent: "space-between", gap: "10px", padding: "10px 12px", borderRadius: "10px", background: "#fff", border: "1px solid #efdae5" }}>
                <span style={{ color: "#4a3943", fontWeight: 700 }}>{tarea.titulo}</span>
                <span style={{ color: "#862456", textAlign: "right" }}>{tarea.responsable}</span>
              </div>
            ))}
          </div>
        )}
        {configuracionRutina.avisos.map((aviso) => <p key={aviso} style={{ margin: 0, color: "#765c27", fontSize: "13px", lineHeight: 1.45 }}>ℹ️ {aviso}</p>)}
        {error && <p role="alert" style={{ margin: 0, color: "#a52d2d", lineHeight: 1.5 }}>{error}</p>}
        {mensaje && <p role="status" style={{ margin: 0, color: "#2b7550", lineHeight: 1.5 }}>{mensaje}</p>}
        <button type="submit" disabled={guardando || cargando || Boolean(error) || !configuracionRutina.tareas.length} style={{ minHeight: "46px", padding: "10px 14px", border: 0, borderRadius: "11px", background: "#862456", color: "#fff", fontWeight: 900, cursor: guardando ? "wait" : "pointer" }}>
          {guardando ? "Preparando tareas…" : "Preparar tareas del día"}
        </button>
      </form>
    </details>
  );
}
