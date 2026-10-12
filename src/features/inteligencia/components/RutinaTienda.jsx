import { useEffect, useMemo, useState } from "react";
import { supabase } from "../../../supabase";
import { analizarInventario } from "../analyzers/inventarioAnalyzer";
import { obtenerEmpleadosActivosParaAsignacion } from "../services/empleadosRHService";
import { obtenerConfiguracionesOperativasSucursal } from "../services/empleadoConfiguracionOperativaService";
import { fechaActualMexico, obtenerAsistenciaOperativa } from "../services/asistenciaOperativaService";
import { crearTareaOperativa, obtenerTareasOperativas } from "../services/tareasOperativasService";
import { construirRutinaInteligente, priorizarProductosParaConteo, tareasPendientesDeRutina } from "../shared/rutinaTienda";

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
        if (vigente) {
          setEmpleados(lista);
          setConfiguraciones(perfiles);
          setHistorial((tareas.data || []).filter((tarea) =>
            /baño|barrer|trapear|bodega|inventario crítico/i.test(tarea.titulo || ""),
          ));
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
        historial,
        productosCriticos,
        fuenteInventario: fechaFuente ? { fecha: fechaCorta(fechaFuente), nombre: inventario?.importacion?.nombre || null } : null,
        asistenciaRegistrada,
      });
    } catch (errorRutina) {
      return { tareas: [], avisos: [errorRutina.message], empleadosDisponibles: 0, personasProgramadas: [], asistencias: [], personasPresentes: null, productosUrgentes: 0, productosAsignados: 0 };
    }
  }, [fecha, empleados, configuraciones, historial, productosCriticos, fechaFuente, inventario?.importacion?.nombre, asistenciaRegistrada]);

  const edadReporte = edadEnDias(fechaFuente);

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
    <details style={{ margin: "0 0 20px", border: "1px solid #e6cad8", borderRadius: "16px", background: "#fffafd", overflow: "hidden" }}>
      <summary style={{ padding: "16px", cursor: "pointer", color: "#76254f", fontSize: "17px", fontWeight: 900 }}>
        🧹 Rutina inteligente de tienda
        <span style={{ display: "block", marginTop: "5px", color: "#77636d", fontSize: "13px", fontWeight: 500 }}>
          MONYS reparte limpieza y lotes de inventario según personal programado, descansos, turnos y SICAR.
        </span>
      </summary>
      <form onSubmit={prepararRutina} style={{ display: "grid", gap: "13px", padding: "16px", borderTop: "1px solid #efdae5" }}>
        <p style={{ margin: 0, color: "#66555e", lineHeight: 1.5 }}>
          La rutina toma personal activo con perfil completo y que no descansa ese día. Baño y orden de bodega rotan por historial; el inventario se divide en lotes de hasta 30 por persona. El conteo usa SICAR solo como referencia: MONYS registra el conteo físico y las diferencias para Dirección, sin ajustar existencias ni comprar.
        </p>
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
        {fechaFuente && <p style={{ margin: 0, color: edadReporte > 7 ? "#875d1c" : "#77636d", fontSize: "13px" }}>
          Inventario fuente: SICAR del {fechaCorta(fechaFuente)}{edadReporte > 7 ? ` · ${edadReporte} días de antigüedad; validar existencias antes de comprar.` : ""}
        </p>}
        {!inventarioDeEstaSucursal && <p style={{ margin: 0, color: "#a52d2d", fontSize: "13px" }}>La información visible de SICAR pertenece a otra sucursal; no se usará para repartir productos en esta.</p>}
        {inventarioDeEstaSucursal && !fechaFuente && <p style={{ margin: 0, color: "#875d1c", fontSize: "13px" }}>Aún no hay inventario SICAR cargado para esta sucursal; hoy no se asignará conteo de bodega.</p>}
        {configuracionRutina.personasProgramadas?.length > 0 && <p style={{ margin: 0, color: "#4a3943", fontSize: "13px" }}>
          {fecha === fechaActualMexico() ? <>
            <strong>Registraron entrada:</strong> {configuracionRutina.asistencias.map((registro) => `${registro.nombre}${registro.entrada_at ? ` · ${new Intl.DateTimeFormat("es-MX", { timeZone: "America/Mexico_City", hour: "2-digit", minute: "2-digit" }).format(new Date(registro.entrada_at))}` : ""}`).join(" · ")}.
          </> : <><strong>Personal programado para esta sucursal:</strong> {configuracionRutina.personasProgramadas.join(", ")}.</>}
        </p>}
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
