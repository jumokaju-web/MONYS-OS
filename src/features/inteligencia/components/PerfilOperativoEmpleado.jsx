import { useEffect, useState } from "react";
import {
  AREAS_OPERATIVAS,
  DIAS_SEMANA,
  guardarConfiguracionOperativa,
  obtenerConfiguracionOperativa,
} from "../services/empleadoConfiguracionOperativaService";

const TURNOS = [
  { id: "PRIMERO", nombre: "Primer turno" },
  { id: "SEGUNDO", nombre: "Segundo turno" },
  { id: "AMBOS", nombre: "Los dos turnos" },
];

export default function PerfilOperativoEmpleado({ usuario, onActualizado }) {
  const usuarioId = usuario?.auth_user_id || usuario?.id || null;
  const [formulario, setFormulario] = useState({
    nombrePreferido: usuario?.nombre || "",
    diaDescanso: "",
    areasAsignadas: [],
    turnoAsignado: "",
  });
  const [guardado, setGuardado] = useState(false);
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState("");
  const [mensaje, setMensaje] = useState("");

  useEffect(() => {
    let vigente = true;
    async function cargar() {
      if (!usuarioId) {
        setCargando(false);
        setError("Esta cuenta aún no está vinculada a una ficha de empleada.");
        return;
      }
      try {
        const configuracion = await obtenerConfiguracionOperativa(usuarioId);
        if (!vigente) return;
        if (configuracion) {
          setFormulario({
            nombrePreferido: configuracion.nombre_preferido || usuario?.nombre || "",
            diaDescanso: String(configuracion.dia_descanso),
            areasAsignadas: Array.isArray(configuracion.areas_asignadas) && configuracion.areas_asignadas.length
              ? configuracion.areas_asignadas
              : [configuracion.area_asignada].filter(Boolean),
            turnoAsignado: configuracion.turno_asignado || "",
          });
          setGuardado(true);
          onActualizado?.(configuracion);
        }
      } catch (errorCarga) {
        if (vigente) setError(errorCarga?.message || "No pudimos abrir tu perfil operativo.");
      } finally {
        if (vigente) setCargando(false);
      }
    }
    cargar();
    return () => { vigente = false; };
  }, [usuarioId, usuario?.nombre, onActualizado]);

  function cambiar(campo, valor) {
    setFormulario((actual) => ({ ...actual, [campo]: valor }));
    setGuardado(false);
    setMensaje("");
  }

  function alternarArea(areaId) {
    const seleccionadas = formulario.areasAsignadas || [];
    if (!seleccionadas.includes(areaId) && seleccionadas.length >= 3) {
      setError("Puedes elegir hasta tres áreas.");
      return;
    }
    setError("");
    cambiar("areasAsignadas", seleccionadas.includes(areaId)
      ? seleccionadas.filter((id) => id !== areaId)
      : [...seleccionadas, areaId]);
  }

  async function guardar(event) {
    event.preventDefault();
    setError("");
    setMensaje("");
    try {
      setGuardando(true);
      const configuracion = await guardarConfiguracionOperativa({
        empleadoId: usuario?.empleado_id,
        usuarioId,
        branchId: usuario?.branch_id,
        nombrePreferido: formulario.nombrePreferido,
        diaDescanso: formulario.diaDescanso,
        areasAsignadas: formulario.areasAsignadas,
        turnoAsignado: formulario.turnoAsignado,
      });
      setGuardado(true);
      setMensaje("¡Listo! MONYS usará tu descanso, área y turno al armar la rutina.");
      onActualizado?.(configuracion);
    } catch (errorGuardar) {
      setError(errorGuardar?.message || "No se pudo guardar tu perfil.");
    } finally {
      setGuardando(false);
    }
  }

  const areaNombre = (formulario.areasAsignadas || [])
    .map((id) => AREAS_OPERATIVAS.find((item) => item.id === id)?.nombre)
    .filter(Boolean)
    .join(" · ");
  const turnoNombre = TURNOS.find((item) => item.id === formulario.turnoAsignado)?.nombre;

  return (
    <details open={!guardado} style={{ marginBottom: "16px", background: "#fff", border: "1px solid #ecdce4", borderRadius: "17px", overflow: "hidden", boxShadow: "0 5px 16px rgba(93, 44, 67, 0.04)" }}>
      <summary style={{ padding: "15px 17px", cursor: "pointer", color: "#76254f", fontWeight: 850 }}>
        👋 Mi perfil de trabajo
        {guardado && <span style={{ display: "block", marginTop: "4px", color: "#71636b", fontSize: "13px", fontWeight: 500 }}>
          {formulario.nombrePreferido} · {areaNombre || "Área por completar"} · {turnoNombre || "Turno por completar"} · Descanso: {DIAS_SEMANA[Number(formulario.diaDescanso)] || "por completar"}
        </span>}
      </summary>
      <form onSubmit={guardar} style={{ display: "grid", gap: "12px", padding: "0 16px 16px" }}>
        <p style={{ margin: 0, color: "#71636b", lineHeight: 1.45, fontSize: "14px" }}>
          Completa esto una vez para que MONYS respete tu descanso, turno y área al repartir el trabajo. El área organiza tus tareas; tus permisos siguen dependiendo de tu puesto.
        </p>
        <label style={labelStyle}>¿Cómo te gusta que te llamemos?
          <input required maxLength={60} value={formulario.nombrePreferido} onChange={(event) => cambiar("nombrePreferido", event.target.value)} placeholder="Tu nombre o apodo" style={inputStyle} />
        </label>
        <label style={labelStyle}>¿Qué día descansas cada semana?
          <select required value={formulario.diaDescanso} onChange={(event) => cambiar("diaDescanso", event.target.value)} style={inputStyle}>
            <option value="">Elegir día</option>
            {DIAS_SEMANA.map((dia, index) => <option key={dia} value={index}>{dia}</option>)}
          </select>
        </label>
        <fieldset style={{ display: "grid", gap: "8px", padding: 0, border: 0, margin: 0 }}>
          <legend style={labelStyle}>¿Qué áreas te asignaron? Elige hasta tres.</legend>
          {AREAS_OPERATIVAS.map((area) => {
            const seleccionada = (formulario.areasAsignadas || []).includes(area.id);
            const maximoAlcanzado = (formulario.areasAsignadas || []).length >= 3;
            return <label key={area.id} style={{ display: "flex", alignItems: "center", gap: "10px", minHeight: "42px", padding: "8px 10px", border: `1px solid ${seleccionada ? "#c12c70" : "#e2ccd7"}`, borderRadius: "10px", background: seleccionada ? "#fff5fa" : "#fff", color: "#4c3944", fontSize: "14px", fontWeight: 650, opacity: !seleccionada && maximoAlcanzado ? 0.58 : 1 }}>
              <input type="checkbox" checked={seleccionada} disabled={guardando || (!seleccionada && maximoAlcanzado)} onChange={() => alternarArea(area.id)} style={{ width: "18px", height: "18px", accentColor: "#c12c70" }} />
              {area.nombre}
            </label>;
          })}
          <span style={{ color: "#71636b", fontSize: "12px" }}>{(formulario.areasAsignadas || []).length} de 3 áreas seleccionadas</span>
        </fieldset>
        <label style={labelStyle}>¿En qué turno trabajas?
          <select required value={formulario.turnoAsignado} onChange={(event) => cambiar("turnoAsignado", event.target.value)} style={inputStyle}>
            <option value="">Elegir turno</option>
            {TURNOS.map((turno) => <option key={turno.id} value={turno.id}>{turno.nombre}</option>)}
          </select>
        </label>
        {error && <p role="alert" style={{ margin: 0, color: "#a52d2d", fontSize: "13px" }}>{error}</p>}
        {mensaje && <p role="status" style={{ margin: 0, color: "#2b7550", fontSize: "13px" }}>{mensaje}</p>}
        {cargando && <p role="status" style={{ margin: 0, color: "#71636b", fontSize: "13px" }}>Cargando tu perfil…</p>}
        <button type="submit" disabled={guardando || cargando} style={{ minHeight: "44px", border: 0, borderRadius: "11px", background: "#c12c70", color: "#fff", fontWeight: 850 }}>
          {guardando ? "Guardando…" : guardado ? "Guardar cambios" : "Guardar mi perfil"}
        </button>
      </form>
    </details>
  );
}

const labelStyle = { display: "grid", gap: "6px", color: "#4c3944", fontSize: "13px", fontWeight: 750 };
const inputStyle = { width: "100%", minHeight: "42px", padding: "9px 10px", border: "1px solid #e2ccd7", borderRadius: "10px", background: "#fff", color: "#30242b", boxSizing: "border-box" };
