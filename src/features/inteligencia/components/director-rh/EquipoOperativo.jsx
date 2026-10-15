import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AREAS_OPERATIVAS,
  DIAS_SEMANA,
  guardarConfiguracionOperativa,
  obtenerConfiguracionesOperativasSucursal,
} from "../../services/empleadoConfiguracionOperativaService";
import {
  areasSugeridasParaEmpleado,
  resumirEquipoOperativo,
} from "../../shared/equipoOperativo";
import "./EquipoOperativo.css";

const FORMULARIO_VACIO = {
  nombrePreferido: "",
  diaDescanso: "",
  areasAsignadas: [],
  turnoAsignado: "",
};

export default function EquipoOperativo({ branchId, empleados = [] }) {
  const [configuraciones, setConfiguraciones] = useState([]);
  const [editandoId, setEditandoId] = useState(null);
  const [formulario, setFormulario] = useState(FORMULARIO_VACIO);
  const [cargando, setCargando] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState("");
  const [mensaje, setMensaje] = useState("");

  const empleadosActivos = useMemo(
    () => empleados.filter((empleado) => empleado?.active !== false),
    [empleados],
  );
  const resumen = useMemo(
    () => resumirEquipoOperativo(empleadosActivos, configuraciones),
    [empleadosActivos, configuraciones],
  );
  const configuracionPorEmpleado = useMemo(
    () => new Map(configuraciones.map((configuracion) => [String(configuracion.empleado_id), configuracion])),
    [configuraciones],
  );

  const cargar = useCallback(async () => {
    if (!branchId) {
      setConfiguraciones([]);
      return;
    }
    setCargando(true);
    setError("");
    try {
      setConfiguraciones(await obtenerConfiguracionesOperativasSucursal(branchId));
    } catch (errorCarga) {
      setError(errorCarga?.message || "No pudimos cargar los perfiles operativos.");
    } finally {
      setCargando(false);
    }
  }, [branchId]);

  useEffect(() => { cargar(); }, [cargar]);

  function comenzar(empleado) {
    const actual = configuracionPorEmpleado.get(String(empleado.id));
    setEditandoId(empleado.id);
    setFormulario({
      nombrePreferido: actual?.nombre_preferido || empleado.nombre || "",
      diaDescanso: actual?.dia_descanso ?? "",
      areasAsignadas: actual?.areas_asignadas?.length
        ? actual.areas_asignadas
        : actual?.area_asignada
          ? [actual.area_asignada]
          : areasSugeridasParaEmpleado(empleado),
      turnoAsignado: actual?.turno_asignado || "",
    });
    setError("");
    setMensaje("");
  }

  function alternarArea(areaId) {
    setFormulario((actual) => {
      const contiene = actual.areasAsignadas.includes(areaId);
      if (!contiene && actual.areasAsignadas.length >= 3) return actual;
      return {
        ...actual,
        areasAsignadas: contiene
          ? actual.areasAsignadas.filter((id) => id !== areaId)
          : [...actual.areasAsignadas, areaId],
      };
    });
  }

  async function guardar(event, empleado) {
    event.preventDefault();
    setError("");
    setMensaje("");
    if (!empleado.auth_user_id) {
      setError("Esta ficha todavía no tiene un acceso MONYS vinculado.");
      return;
    }
    try {
      setGuardando(true);
      await guardarConfiguracionOperativa({
        empleadoId: empleado.id,
        usuarioId: empleado.auth_user_id,
        branchId,
        ...formulario,
      });
      await cargar();
      setEditandoId(null);
      setFormulario(FORMULARIO_VACIO);
      setMensaje(`Perfil operativo de ${empleado.nombre} guardado.`);
    } catch (errorGuardar) {
      setError(errorGuardar?.message || "No pudimos guardar el perfil operativo.");
    } finally {
      setGuardando(false);
    }
  }

  return (
    <section className="equipo-operativo" aria-labelledby="equipo-operativo-titulo">
      <header className="equipo-operativo__encabezado">
        <div>
          <span>OPERACIÓN REAL · CONFIGURACIÓN DEL EQUIPO</span>
          <h3 id="equipo-operativo-titulo">Equipo listo para trabajar</h3>
          <p>Define descanso, turno y áreas. MONYS usará esto junto con la entrada del día para repartir tareas sin cargar a quien no está.</p>
        </div>
        <b className={`equipo-operativo__estado ${resumen.completo ? "is-ready" : ""}`}>
          {resumen.completo ? "Equipo configurado" : `${resumen.pendientes} por configurar`}
        </b>
      </header>

      <div className="equipo-operativo__metricas">
        <article className="equipo-operativo__metrica"><small>Personal activo</small><strong>{resumen.activos}</strong></article>
        <article className="equipo-operativo__metrica"><small>Perfiles listos</small><strong>{resumen.listos}</strong></article>
        <article className="equipo-operativo__metrica"><small>Sin acceso vinculado</small><strong>{resumen.sinAcceso}</strong></article>
      </div>

      {cargando && <p role="status">Revisando la configuración del equipo…</p>}
      {!cargando && empleadosActivos.length === 0 && <p className="equipo-operativo__aviso">Primero registra personal activo en esta sucursal.</p>}

      <div className="equipo-operativo__lista">
        {empleadosActivos.map((empleado) => {
          const configuracion = configuracionPorEmpleado.get(String(empleado.id));
          const editando = editandoId === empleado.id;
          const areas = configuracion?.areas_asignadas?.length
            ? configuracion.areas_asignadas
            : [configuracion?.area_asignada].filter(Boolean);
          return (
            <article className="equipo-operativo__persona" key={empleado.id}>
              <div className="equipo-operativo__fila">
                <div>
                  <h4>{empleado.nombre || "Sin nombre"}</h4>
                  <p>{empleado.puesto || "Puesto pendiente"} · {empleado.auth_user_id ? "Acceso vinculado" : "Sin acceso MONYS vinculado"}</p>
                  {configuracion && <div>
                    <span className="equipo-operativo__chip">{DIAS_SEMANA[configuracion.dia_descanso]} descansa</span>
                    <span className="equipo-operativo__chip">{configuracion.turno_asignado === "PRIMERO" ? "Primer turno" : configuracion.turno_asignado === "SEGUNDO" ? "Segundo turno" : "Ambos turnos"}</span>
                    {areas.map((areaId) => <span className="equipo-operativo__chip" key={areaId}>{AREAS_OPERATIVAS.find((area) => area.id === areaId)?.nombre || areaId}</span>)}
                  </div>}
                </div>
                <button
                  type="button"
                  className="equipo-operativo__boton"
                  onClick={() => editando ? setEditandoId(null) : comenzar(empleado)}
                  disabled={!empleado.auth_user_id}
                >
                  {editando ? "Cerrar" : configuracion ? "Editar perfil" : "Configurar"}
                </button>
              </div>

              {!empleado.auth_user_id && <p className="equipo-operativo__aviso">Primero crea o vincula su usuario. Sin acceso no podrá registrar entrada ni recibir tareas propias.</p>}

              {editando && <form className="equipo-operativo__form" onSubmit={(event) => guardar(event, empleado)}>
                <label>Nombre que verá en su jornada
                  <input type="text" maxLength="60" required value={formulario.nombrePreferido} onChange={(event) => setFormulario({ ...formulario, nombrePreferido: event.target.value })} />
                </label>
                <label>Día de descanso semanal
                  <select required value={formulario.diaDescanso} onChange={(event) => setFormulario({ ...formulario, diaDescanso: event.target.value })}>
                    <option value="">Seleccionar…</option>
                    {DIAS_SEMANA.map((dia, indice) => <option value={indice} key={dia}>{dia}</option>)}
                  </select>
                </label>
                <label>Turno asignado
                  <select required value={formulario.turnoAsignado} onChange={(event) => setFormulario({ ...formulario, turnoAsignado: event.target.value })}>
                    <option value="">Seleccionar…</option>
                    <option value="PRIMERO">Primer turno</option>
                    <option value="SEGUNDO">Segundo turno</option>
                    <option value="AMBOS">Ambos turnos</option>
                  </select>
                </label>
                <fieldset>
                  <legend>Áreas de trabajo · elige de 1 a 3</legend>
                  <div className="equipo-operativo__areas">
                    {AREAS_OPERATIVAS.map((area) => <label className="equipo-operativo__area" key={area.id}>
                      <input type="checkbox" checked={formulario.areasAsignadas.includes(area.id)} onChange={() => alternarArea(area.id)} />
                      {area.nombre}
                    </label>)}
                  </div>
                </fieldset>
                <div className="equipo-operativo__acciones">
                  <button className="equipo-operativo__boton is-primary" type="submit" disabled={guardando || formulario.areasAsignadas.length === 0}>{guardando ? "Guardando…" : "Guardar perfil operativo"}</button>
                  <button className="equipo-operativo__boton" type="button" onClick={() => setEditandoId(null)}>Cancelar</button>
                </div>
              </form>}
            </article>
          );
        })}
      </div>

      {mensaje && <p className="equipo-operativo__mensaje" role="status">{mensaje}</p>}
      {error && <p className="equipo-operativo__error" role="alert">{error}</p>}
    </section>
  );
}
