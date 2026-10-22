import { useEffect, useState } from "react";
import { fechaActualMexico } from "../services/asistenciaOperativaService";
import { obtenerExcepcionesHorario, guardarExcepcionHorario } from "../services/horarioEmpleadoService";

export default function HorarioDelDiaEmpleado({ usuario, entrada }) {
  const hoy = fechaActualMexico();
  const [fecha, setFecha] = useState(hoy);
  const [estado, setEstado] = useState("");
  const [inicio, setInicio] = useState("");
  const [fin, setFin] = useState("");
  const [registro, setRegistro] = useState(null);
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState("");
  const [aviso, setAviso] = useState("");
  useEffect(() => {
    let vigente = true;
    setCargando(true); setError(""); setAviso(""); setRegistro(null); setEstado(""); setInicio(""); setFin("");
    obtenerExcepcionesHorario({ empleadoIds: [usuario?.empleado_id], fechaDesde: fecha, fechaHasta: fecha })
      .then(([dia]) => {
        if (!vigente) return;
        setRegistro(dia || null); setEstado(dia?.estado || "");
        setInicio(dia?.hora_inicio?.slice(0, 5) || ""); setFin(dia?.hora_fin?.slice(0, 5) || "");
      }).catch((e) => { if (vigente) setError(e.message); })
      .finally(() => { if (vigente) setCargando(false); });
    return () => { vigente = false; };
  }, [usuario?.empleado_id, fecha]);
  const protegido = Boolean(registro && registro.changed_by !== usuario?.auth_user_id);
  const iniciado = fecha === hoy && Boolean(entrada);
  const bloqueado = cargando || guardando || protegido || iniciado || Boolean(error) || !usuario?.empleado_id;
  async function guardar(e) {
    e.preventDefault(); setError(""); setAviso("");
    if (!["TRABAJA", "DESCANSA"].includes(estado)) { setAviso("Indica si trabajas o descansas."); return; }
    if (estado === "TRABAJA" && (!inicio || !fin || inicio >= fin)) { setAviso("Indica las horas de entrada y salida; la salida debe ser después de la entrada."); return; }
    setGuardando(true);
    try {
      const dia = await guardarExcepcionHorario({ empleado: { ...usuario, id: usuario.empleado_id }, fecha,
        branchId: usuario.branch_id, estado, horaInicio: inicio, horaFin: fin, motivo: "Horario declarado por la empleada" });
      setRegistro(dia); setAviso("Horario guardado. Dirección ya puede consultarlo.");
    } catch (e) { setAviso(e.message || "No se pudo guardar el horario."); }
    finally { setGuardando(false); }
  }
  return <form onSubmit={guardar} style={{ display: "grid", gap: 8 }}>
    <strong>Mi horario del día</strong>
    <label>Fecha <input type="date" min={hoy} value={fecha} disabled={guardando} onChange={(e) => setFecha(e.target.value || hoy)} required /></label>
    <fieldset disabled={bloqueado} style={{ display: "grid", gap: 8, border: 0, margin: 0, padding: 0 }}>
      <label>¿Trabajas o descansas? <select value={estado} onChange={(e) => setEstado(e.target.value)} required>
        <option value="">Selecciona</option><option value="TRABAJA">Trabajo</option><option value="DESCANSA">Descanso</option>
      </select></label>
      {estado === "TRABAJA" && <div style={{ display: "flex", flexWrap: "wrap", gap: 12 }}>
        <label>Entrada prevista <input type="time" value={inicio} onChange={(e) => setInicio(e.target.value)} required /></label>
        <label>Salida prevista <input type="time" value={fin} onChange={(e) => setFin(e.target.value)} required /></label>
      </div>}
      <button type="submit" style={{ minHeight: 44 }}>{guardando ? "Guardando…" : "Guardar mi horario"}</button>
    </fieldset>
    <small>{protegido ? "Dirección definió este horario. Solicita una corrección si cambió." : iniciado ? "Ya registraste entrada. Solicita a Dirección cualquier corrección del horario." : "Puedes indicar horas diferentes cada día. El horario previsto no registra tu asistencia: marca tu llegada y tu salida reales."}</small>
    {error && <small role="alert">{error} Vuelve a abrir esta sección para reintentar.</small>}
    {aviso && <small role="status">{aviso}</small>}
  </form>;
}
