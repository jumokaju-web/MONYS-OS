import { useEffect, useMemo, useState } from "react";
import { supabase } from "../../../supabase";
import { analizarInventario } from "../analyzers/inventarioAnalyzer";
import { obtenerEmpleadosActivosParaAsignacion } from "../services/empleadosRHService";
import { obtenerConfiguracionesOperativasSucursal } from "../services/empleadoConfiguracionOperativaService";
import { crearTareaOperativa, obtenerTareasOperativas } from "../services/tareasOperativasService";
import { construirRutinaInteligente, tareasPendientesDeRutina } from "../shared/rutinaTienda";

const LISTA_VACIA = [];

function fechaLocalHoy() {
  const hoy = new Date();
  return `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, "0")}-${String(hoy.getDate()).padStart(2, "0")}`;
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
  const [fecha, setFecha] = useState(fechaLocalHoy);
  const [cargando, setCargando] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState("");
  const [mensaje, setMensaje] = useState("");

  const inventario = datosDashboard?.inventario;
  const detalles = Array.isArray(inventario?.detalles) ? inventario.detalles : LISTA_VACIA;
  const metricas = datosDashboard?.metricas || {};
  const ventas = datosDashboard?.inteligencia?.comercial?.ventas || LISTA_VACIA;
  const fechaFuente = inventario?.importacion?.created_at || null;
  const productosCriticos = useMemo(() => {
    if (!fechaFuente || !detalles.length) return [];
    const resultado = analizarInventario(detalles, {
      ventas,
      diasAnalizados: metricas.diasAnalizados || 7,
      diasObjetivoInventario: 30,
    });
    return resultado.productos.filter((producto) =>
      ["CRITICO", "BAJO", "AGOTADO"].includes(String(producto.nivelInventario || "").toUpperCase()) ||
      Number(producto.existencia) < 0,
    );
  }, [detalles, fechaFuente, metricas.diasAnalizados, ventas]);

  useEffect(() => {
    let vigente = true;
    async function cargar() {
      if (!branchId) {
        setEmpleados([]);
        setConfiguraciones([]);
        setHistorial([]);
        setError("Selecciona una sucursal para preparar sus rutinas.");
        return;
      }
      setCargando(true);
      setError("");
      try {
        const [lista, perfiles, tareas] = await Promise.all([
          obtenerEmpleadosActivosParaAsignacion(branchId),
          obtenerConfiguracionesOperativasSucursal(branchId),
          supabase.from("tareas_operativas")
            .select("titulo, area, responsable, fecha, estado")
            .eq("branch_id", branchId)
            .gte("fecha", inicioPeriodo(fecha))
            .lt("fecha", fecha)
            .order("fecha", { ascending: false }),
        ]);
        if (tareas.error) throw tareas.error;
        if (vigente) {
          setEmpleados(lista);
          setConfiguraciones(perfiles);
          setHistorial((tareas.data || []).filter((tarea) =>
            /baño|barrer|trapear|bodega|inventario crítico/i.test(tarea.titulo || ""),
          ));
        }
      } catch (errorCarga) {
        if (vigente) setError(errorCarga?.message || "No pudimos cargar el equipo y sus perfiles operativos.");
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
      });
    } catch (errorRutina) {
      return { tareas: [], avisos: [errorRutina.message], empleadosDisponibles: 0 };
    }
  }, [fecha, empleados, configuraciones, historial, productosCriticos, fechaFuente, inventario?.importacion?.nombre]);

  const edadReporte = edadEnDias(fechaFuente);

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
          MONYS reparte limpieza y conteos según perfiles, descansos, turnos e inventario SICAR.
        </span>
      </summary>
      <form onSubmit={prepararRutina} style={{ display: "grid", gap: "13px", padding: "16px", borderTop: "1px solid #efdae5" }}>
        <p style={{ margin: 0, color: "#66555e", lineHeight: 1.5 }}>
          Las tareas se asignan a quienes trabajan ese día. El conteo de bodega usa la existencia del último SICAR como referencia; la empleada confirma la existencia física y las diferencias antes de que Dirección decida comprar.
        </p>
        <label style={{ display: "grid", gap: "6px", maxWidth: "260px", fontWeight: 750, fontSize: "14px" }}>
          Fecha de la rutina
          <input type="date" required value={fecha} onChange={(event) => setFecha(event.target.value)} style={{ minHeight: "42px", padding: "8px", border: "1px solid #d9bdcc", borderRadius: "10px" }} />
        </label>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "9px" }}>
          {[
            ["Disponibles", configuracionRutina.empleadosDisponibles],
            ["Tareas preparadas", configuracionRutina.tareas.length],
            ["Productos SICAR", productosCriticos.length],
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
        {!fechaFuente && <p style={{ margin: 0, color: "#875d1c", fontSize: "13px" }}>Aún no hay inventario SICAR cargado para esta sucursal; hoy no se asignará conteo de bodega.</p>}
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
        <button type="submit" disabled={guardando || cargando || !configuracionRutina.tareas.length} style={{ minHeight: "46px", padding: "10px 14px", border: 0, borderRadius: "11px", background: "#862456", color: "#fff", fontWeight: 900, cursor: guardando ? "wait" : "pointer" }}>
          {guardando ? "Preparando tareas…" : "Preparar tareas del día"}
        </button>
      </form>
    </details>
  );
}
