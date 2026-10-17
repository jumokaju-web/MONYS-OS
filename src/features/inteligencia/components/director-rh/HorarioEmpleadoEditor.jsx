import { useMemo, useState } from "react";
import { DIAS_SEMANA } from "../../services/empleadoConfiguracionOperativaService";
import { guardarExcepcionHorario, guardarHorarioSemanal } from "../../services/horarioEmpleadoService";
import { describirHorario } from "../../shared/horarioEmpleado";
import { fechaActualMexico } from "../../services/asistenciaOperativaService";

const ESTADOS = [
  ["TRABAJA", "Trabaja"],
  ["DESCANSA", "Descansa"],
  ["FLEXIBLE", "Flexible · confirmar entrada"],
];

function construirFilas({ empleado, perfil, horarios }) {
  const porDia = new Map((Array.isArray(horarios) ? horarios : [])
    .filter((item) => String(item.empleado_id) === String(empleado.id))
    .map((item) => [Number(item.dia_semana), item]));
  return DIAS_SEMANA.map((_, diaSemana) => {
    const actual = porDia.get(diaSemana);
    const descansoBase = perfil && Number(perfil.dia_descanso) === diaSemana;
    return {
      diaSemana,
      estado: actual?.estado || (descansoBase ? "DESCANSA" : "FLEXIBLE"),
      branchId: actual?.branch_id || empleado.branch_id || "",
      horaInicio: actual?.hora_inicio ? String(actual.hora_inicio).slice(0, 5) : "",
      horaFin: actual?.hora_fin ? String(actual.hora_fin).slice(0, 5) : "",
      nota: actual?.nota || "",
    };
  });
}

export default function HorarioEmpleadoEditor({
  empleado,
  perfil = null,
  horarios = [],
  excepciones = [],
  sucursales = [],
  onGuardado,
  onCerrar,
}) {
  const [filas, setFilas] = useState(() => construirFilas({ empleado, perfil, horarios }));
  const [excepcion, setExcepcion] = useState({
    fecha: "",
    estado: "TRABAJA",
    branchId: empleado.branch_id || "",
    horaInicio: "",
    horaFin: "",
    motivo: "",
  });
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState("");
  const [mensaje, setMensaje] = useState("");
  const cambiosEmpleado = useMemo(() => (Array.isArray(excepciones) ? excepciones : [])
    .filter((item) => String(item.empleado_id) === String(empleado.id))
    .slice(0, 6), [empleado.id, excepciones]);
  const sucursalNombre = (id) => sucursales.find((item) => String(item.id) === String(id))?.name || "Sucursal";

  function cambiarFila(indice, cambio) {
    setFilas((actual) => actual.map((fila, posicion) => {
      if (posicion !== indice) return fila;
      const siguiente = { ...fila, ...cambio };
      if (cambio.estado && cambio.estado !== "TRABAJA") {
        siguiente.horaInicio = "";
        siguiente.horaFin = "";
      }
      return siguiente;
    }));
    setMensaje("");
  }

  function validarTrabajo({ estado, horaInicio, horaFin }) {
    if (estado !== "TRABAJA") return true;
    return Boolean(horaInicio && horaFin && horaInicio < horaFin);
  }

  async function guardarSemana() {
    setError("");
    setMensaje("");
    if (filas.some((fila) => !fila.branchId || !validarTrabajo(fila))) {
      setError("En cada día trabajado selecciona sucursal y una hora de salida posterior a la entrada.");
      return;
    }
    try {
      setGuardando(true);
      await guardarHorarioSemanal({ empleado, filas });
      setMensaje("Calendario semanal guardado. Las entradas reales seguirán teniendo prioridad.");
      await onGuardado?.();
    } catch (errorGuardar) {
      setError(errorGuardar?.message || "No pudimos guardar el calendario.");
    } finally {
      setGuardando(false);
    }
  }

  async function guardarCambio(event) {
    event.preventDefault();
    setError("");
    setMensaje("");
    if (!validarTrabajo(excepcion)) {
      setError("Para un día trabajado captura entrada y salida válidas.");
      return;
    }
    try {
      setGuardando(true);
      await guardarExcepcionHorario({ empleado, ...excepcion });
      setExcepcion({ fecha: "", estado: "TRABAJA", branchId: empleado.branch_id || "", horaInicio: "", horaFin: "", motivo: "" });
      setMensaje("Cambio guardado únicamente para esa fecha.");
      await onGuardado?.();
    } catch (errorGuardar) {
      setError(errorGuardar?.message || "No pudimos guardar el cambio.");
    } finally {
      setGuardando(false);
    }
  }

  return <section className="horario-editor" aria-label={`Horario de ${empleado.nombre}`}>
    <header>
      <div><span>CALENDARIO REAL</span><h5>{empleado.nombre}</h5><p>La semana base organiza el trabajo. Un cambio por fecha la reemplaza; registrar entrada confirma la presencia real.</p></div>
      <button type="button" onClick={onCerrar}>Cerrar</button>
    </header>

    <div className="horario-editor__semana">
      {filas.map((fila, indice) => <article key={fila.diaSemana}>
        <strong>{DIAS_SEMANA[fila.diaSemana]}</strong>
        <select aria-label={`Estado del ${DIAS_SEMANA[fila.diaSemana]}`} value={fila.estado} onChange={(event) => cambiarFila(indice, { estado: event.target.value })}>
          {ESTADOS.map(([id, nombre]) => <option key={id} value={id}>{nombre}</option>)}
        </select>
        <select aria-label={`Sucursal del ${DIAS_SEMANA[fila.diaSemana]}`} value={fila.branchId} onChange={(event) => cambiarFila(indice, { branchId: event.target.value })}>
          <option value="">Sucursal…</option>
          {sucursales.map((sucursal) => <option key={sucursal.id} value={sucursal.id}>{sucursal.name}</option>)}
        </select>
        {fila.estado === "TRABAJA" && <div className="horario-editor__horas">
          <label>Entrada<input type="time" value={fila.horaInicio} onChange={(event) => cambiarFila(indice, { horaInicio: event.target.value })} /></label>
          <label>Salida<input type="time" value={fila.horaFin} onChange={(event) => cambiarFila(indice, { horaFin: event.target.value })} /></label>
        </div>}
        <input type="text" maxLength="300" value={fila.nota} onChange={(event) => cambiarFila(indice, { nota: event.target.value })} placeholder="Nota opcional" />
      </article>)}
    </div>
    <button className="equipo-operativo__boton is-primary" type="button" disabled={guardando} onClick={guardarSemana}>{guardando ? "Guardando…" : "Guardar semana base"}</button>

    <form className="horario-editor__excepcion" onSubmit={guardarCambio}>
      <div><span>CAMBIO SOLO PARA UNA FECHA</span><h5>Descanso, horario o sucursal diferente</h5></div>
      <label>Fecha<input required type="date" min={fechaActualMexico()} value={excepcion.fecha} onChange={(event) => setExcepcion({ ...excepcion, fecha: event.target.value })} /></label>
      <label>Situación<select value={excepcion.estado} onChange={(event) => setExcepcion({ ...excepcion, estado: event.target.value, horaInicio: event.target.value === "TRABAJA" ? excepcion.horaInicio : "", horaFin: event.target.value === "TRABAJA" ? excepcion.horaFin : "" })}>{ESTADOS.map(([id, nombre]) => <option key={id} value={id}>{nombre}</option>)}</select></label>
      <label>Sucursal<select required value={excepcion.branchId} onChange={(event) => setExcepcion({ ...excepcion, branchId: event.target.value })}>{sucursales.map((sucursal) => <option key={sucursal.id} value={sucursal.id}>{sucursal.name}</option>)}</select></label>
      {excepcion.estado === "TRABAJA" && <div className="horario-editor__horas"><label>Entrada<input required type="time" value={excepcion.horaInicio} onChange={(event) => setExcepcion({ ...excepcion, horaInicio: event.target.value })} /></label><label>Salida<input required type="time" value={excepcion.horaFin} onChange={(event) => setExcepcion({ ...excepcion, horaFin: event.target.value })} /></label></div>}
      <label>Motivo<input required minLength="3" maxLength="300" type="text" value={excepcion.motivo} onChange={(event) => setExcepcion({ ...excepcion, motivo: event.target.value })} placeholder="Ej. cambió descanso con Karla" /></label>
      <button className="equipo-operativo__boton" type="submit" disabled={guardando}>Guardar cambio de fecha</button>
    </form>

    {cambiosEmpleado.length > 0 && <div className="horario-editor__cambios"><strong>Próximos cambios registrados</strong>{cambiosEmpleado.map((item) => <p key={item.id || item.fecha}><b>{item.fecha}</b> · {describirHorario(item)} · {sucursalNombre(item.branch_id)} · {item.motivo}</p>)}</div>}
    {mensaje && <p className="equipo-operativo__mensaje" role="status">{mensaje}</p>}
    {error && <p className="equipo-operativo__error" role="alert">{error}</p>}
  </section>;
}
