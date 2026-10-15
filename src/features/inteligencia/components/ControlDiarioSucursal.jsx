import { useCallback, useEffect, useMemo, useState } from "react";
import { obtenerEmpleadosRH } from "../services/empleadosRHService";
import { obtenerConfiguracionesOperativasSucursal } from "../services/empleadoConfiguracionOperativaService";
import { obtenerAsistenciaOperativa } from "../services/asistenciaOperativaService";
import { construirControlDiarioSucursal } from "../shared/controlDiarioSucursal";
import "./ControlDiarioSucursal.css";

const ESTADOS = {
  PRESENTE: ["Presente", "is-presente"],
  SIN_ENTRADA: ["Sin entrada", "is-alerta"],
  DESCANSA: ["Descansa", ""],
  SIN_PERFIL: ["Perfil pendiente", "is-alerta"],
  SIN_ACCESO: ["Sin acceso", "is-alerta"],
};

function horaMexico(fecha) {
  if (!fecha) return null;
  return new Intl.DateTimeFormat("es-MX", {
    timeZone: "America/Mexico_City",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(fecha));
}

export default function ControlDiarioSucursal({
  branchId,
  fecha,
  tareas = [],
  onActualizarTareas = null,
}) {
  const [empleados, setEmpleados] = useState([]);
  const [configuraciones, setConfiguraciones] = useState([]);
  const [asistencias, setAsistencias] = useState([]);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState("");
  const [actualizadoAt, setActualizadoAt] = useState(null);

  const cargar = useCallback(async () => {
    if (!branchId || !fecha) {
      setEmpleados([]);
      setConfiguraciones([]);
      setAsistencias([]);
      return;
    }
    setCargando(true);
    setError("");
    try {
      const [equipo, perfiles, entradas] = await Promise.all([
        obtenerEmpleadosRH(branchId),
        obtenerConfiguracionesOperativasSucursal(branchId),
        obtenerAsistenciaOperativa({ branchId, fecha }),
      ]);
      setEmpleados(equipo);
      setConfiguraciones(perfiles);
      setAsistencias(entradas);
      setActualizadoAt(new Date().toISOString());
    } catch (errorCarga) {
      setError(errorCarga?.message || "No pudimos preparar el control diario de esta sucursal.");
    } finally {
      setCargando(false);
    }
  }, [branchId, fecha]);

  useEffect(() => { cargar(); }, [cargar]);

  async function actualizarTodo() {
    await Promise.all([
      cargar(),
      typeof onActualizarTareas === "function"
        ? onActualizarTareas()
        : Promise.resolve(),
    ]);
  }

  const control = useMemo(() => construirControlDiarioSucursal({
    fecha,
    empleados,
    configuraciones,
    asistencias,
    tareas,
  }), [fecha, empleados, configuraciones, asistencias, tareas]);

  function irAlReparto() {
    document.getElementById("reparto-trabajo-dia")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  const iconoPrioridad = control.prioridad.nivel === "bien" ? "✓" : control.prioridad.nivel === "alta" ? "!" : "→";

  return (
    <section className="control-diario" aria-labelledby="control-diario-titulo">
      <header className="control-diario__encabezado">
        <div>
          <span className="control-diario__kicker">DIRECCIÓN · CONTROL DIARIO DE SUCURSAL</span>
          <h2 id="control-diario-titulo">¿La tienda está lista hoy?</h2>
          <p>{fecha} · asistencia, equipo y ejecución en un solo lugar</p>
        </div>
        <button type="button" className="control-diario__actualizar" onClick={actualizarTodo} disabled={cargando}>
          {cargando ? "Actualizando…" : "Actualizar control"}
        </button>
      </header>

      <article className={`control-diario__prioridad is-${control.prioridad.nivel}`}>
        <span className="control-diario__prioridad-icono" aria-hidden="true">{iconoPrioridad}</span>
        <div>
          <small>PRIORIDAD DE DIRECCIÓN</small>
          <strong>{control.prioridad.titulo}</strong>
          <p>{control.prioridad.detalle}</p>
        </div>
        <button type="button" onClick={irAlReparto}>Revisar reparto</button>
      </article>

      <div className="control-diario__metricas">
        <article className="control-diario__metrica"><span>Presentes</span><strong>{control.metricas.presentes}</strong></article>
        <article className="control-diario__metrica"><span>Sin entrada</span><strong>{control.metricas.sinEntrada}</strong></article>
        <article className="control-diario__metrica"><span>Tareas abiertas</span><strong>{control.metricas.tareasAbiertas}</strong></article>
        <article className="control-diario__metrica"><span>Terminadas</span><strong>{control.metricas.tareasTerminadas}</strong></article>
      </div>

      <div className="control-diario__lista" aria-label="Estado del equipo de hoy">
        {control.personas.length ? control.personas.map((persona) => {
          const [etiqueta, clase] = ESTADOS[persona.estado] || [persona.estado, ""];
          const horaEntrada = horaMexico(persona.entradaAt);
          return <article className="control-diario__persona" key={persona.empleadoId}>
            <div>
              <h3>{persona.nombre}</h3>
              <p>{persona.puesto}{horaEntrada ? ` · entrada ${horaEntrada}` : ""}</p>
            </div>
            <div className="control-diario__persona-derecha">
              <span className={`control-diario__estado ${clase}`}>{etiqueta}</span>
              <small>{persona.tareas ? `${persona.terminadas}/${persona.tareas} tareas terminadas${persona.enProceso ? ` · ${persona.enProceso} en proceso` : ""}` : "Sin tareas asignadas"}</small>
            </div>
          </article>;
        }) : <p className="control-diario__vacio">No hay personal activo visible para esta sucursal.</p>}
      </div>

      {error && <p className="control-diario__error" role="alert">{error}</p>}
      <footer className="control-diario__pie">
        <span>{control.metricas.sinPerfil} perfiles pendientes · {control.metricas.sinAcceso} sin acceso · {control.metricas.descansan} descansan</span>
        <span>{actualizadoAt ? `Actualizado ${horaMexico(actualizadoAt)}` : "Pendiente de actualizar"}</span>
      </footer>
    </section>
  );
}
