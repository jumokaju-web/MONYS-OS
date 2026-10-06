import { useEffect, useMemo, useState } from "react";
import {
  obtenerCalendarioTareasOperativas,
  obtenerEvidenciasTarea,
} from "../../inteligencia/services/tareasOperativasService";

function fechaISO(fecha) {
  return fecha.toISOString().slice(0, 10);
}

function fechaCorta(valor) {
  if (!valor) return "Sin fecha";
  return new Intl.DateTimeFormat("es-MX", {
    weekday: "short",
    day: "numeric",
    month: "short",
  }).format(new Date(`${String(valor).slice(0, 10)}T12:00:00`));
}

function estadoTerminado(estado) {
  return ["terminada", "completada", "cerrada"].includes(String(estado || "").toLowerCase());
}

function estadoEnProceso(estado) {
  return ["en_proceso", "analizando"].includes(String(estado || "").toLowerCase());
}

export default function SalaRescateJefa({ branchId, abrirDirectorFinanciero }) {
  const [tareas, setTareas] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState("");
  const [supervisionAbierta, setSupervisionAbierta] = useState(false);
  const [tareaAbierta, setTareaAbierta] = useState(null);
  const [evidencias, setEvidencias] = useState({});
  const [cargandoEvidencias, setCargandoEvidencias] = useState(null);
  const [versionConsulta, setVersionConsulta] = useState(0);

  async function revisarTarea(tarea) {
    if (tareaAbierta === tarea.id) {
      setTareaAbierta(null);
      return;
    }

    setTareaAbierta(tarea.id);
    if (evidencias[tarea.id]) return;

    try {
      setCargandoEvidencias(tarea.id);
      const registros = await obtenerEvidenciasTarea(tarea.id);
      setEvidencias((anteriores) => ({ ...anteriores, [tarea.id]: registros || [] }));
    } catch (errorEvidencia) {
      setEvidencias((anteriores) => ({
        ...anteriores,
        [tarea.id]: [{ id: "error", error: errorEvidencia?.message || "No fue posible cargar la evidencia." }],
      }));
    } finally {
      setCargandoEvidencias(null);
    }
  }

  useEffect(() => {
    let activo = true;

    async function cargarPlan() {
      if (!branchId) {
        setTareas([]);
        setCargando(false);
        return;
      }

      const inicio = new Date();
      inicio.setDate(inicio.getDate() - 35);
      const fin = new Date();
      fin.setDate(fin.getDate() + 40);

      try {
        setCargando(true);
        setError("");
        const registros = await obtenerCalendarioTareasOperativas({
          branchId,
          fechaInicio: fechaISO(inicio),
          fechaFin: fechaISO(fin),
        });

        if (activo) {
          setTareas(
            (registros || []).filter((tarea) =>
              String(tarea?.titulo || "").startsWith("Rescate 30 días ·")
            )
          );
        }
      } catch (errorCarga) {
        if (activo) setError(errorCarga?.message || "No fue posible cargar el plan de rescate.");
      } finally {
        if (activo) setCargando(false);
      }
    }

    cargarPlan();
    return () => { activo = false; };
  }, [branchId, versionConsulta]);

  const resumen = useMemo(() => {
    const hoy = fechaISO(new Date());
    const terminadas = tareas.filter((tarea) => estadoTerminado(tarea.estado));
    const enProceso = tareas.filter((tarea) => estadoEnProceso(tarea.estado));
    const vencidas = tareas.filter((tarea) => !estadoTerminado(tarea.estado) && tarea.fecha && tarea.fecha < hoy);
    const requierenRevision = tareas.filter((tarea) => tarea.requiere_revision && estadoTerminado(tarea.estado));
    const avance = tareas.length > 0 ? Math.round((terminadas.length / tareas.length) * 100) : 0;
    const ordenadas = [...tareas].filter((tarea) => !estadoTerminado(tarea.estado)).sort((a, b) => String(a.fecha || "").localeCompare(String(b.fecha || "")));

    const equipo = Object.values(
      tareas.reduce((grupos, tarea) => {
        const nombre = String(tarea.responsable || "Sin responsable").trim();
        if (!grupos[nombre]) grupos[nombre] = { nombre, total: 0, terminadas: 0, enProceso: 0, vencidas: 0 };
        grupos[nombre].total += 1;
        if (estadoTerminado(tarea.estado)) grupos[nombre].terminadas += 1;
        if (estadoEnProceso(tarea.estado)) grupos[nombre].enProceso += 1;
        if (!estadoTerminado(tarea.estado) && tarea.fecha && tarea.fecha < hoy) grupos[nombre].vencidas += 1;
        return grupos;
      }, {})
    ).sort((a, b) => b.total - a.total);

    return { terminadas, enProceso, vencidas, requierenRevision, avance, siguientes: ordenadas.slice(0, 3), equipo };
  }, [tareas]);

  const colorAvance = resumen.avance >= 75 ? "#25734a" : resumen.avance >= 40 ? "#a26612" : "#a7255e";

  return (
    <section style={{ marginBottom: 16, padding: 20, borderRadius: 22, color: "#fff", background: "radial-gradient(circle at 88% 5%, rgba(255,123,181,.34), transparent 28%), linear-gradient(145deg, #25151e 0%, #651940 58%, #9d225c 100%)", boxShadow: "0 18px 44px rgba(72, 20, 46, .22)", overflow: "hidden" }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 14, alignItems: "flex-start", flexWrap: "wrap" }}>
        <div style={{ maxWidth: 660 }}>
          <div style={{ color: "#f7b8d4", fontSize: 12, fontWeight: 900, letterSpacing: ".1em" }}>SALA DE RESCATE · 30 DÍAS</div>
          <h2 style={{ margin: "7px 0 4px", fontSize: 26 }}>Tu negocio, el equipo y el siguiente movimiento</h2>
          <p style={{ margin: 0, color: "rgba(255,255,255,.76)", fontSize: 13, lineHeight: 1.5 }}>Aquí ves ejecución comprobada. El porcentaje sube únicamente cuando un empleado termina una tarea real del plan.</p>
        </div>
        <div style={{ display: "grid", gap: 7 }}>
          <div style={{ minWidth: 105, textAlign: "center", padding: "12px 15px", borderRadius: 18, background: "rgba(255,255,255,.12)", border: "1px solid rgba(255,255,255,.18)" }}>
            <strong style={{ display: "block", fontSize: 30 }}>{cargando ? "…" : `${resumen.avance}%`}</strong>
            <small style={{ color: "rgba(255,255,255,.72)", fontWeight: 800 }}>avance real</small>
          </div>
          <button type="button" disabled={cargando} onClick={() => setVersionConsulta((valor) => valor + 1)} style={{ padding: "7px 10px", borderRadius: 10, border: "1px solid rgba(255,255,255,.22)", background: "rgba(255,255,255,.1)", color: "#fff", fontWeight: 800, cursor: cargando ? "wait" : "pointer" }}>
            {cargando ? "Actualizando…" : "↻ Actualizar"}
          </button>
        </div>
      </div>

      <div role="progressbar" aria-label="Avance del plan de rescate" aria-valuemin="0" aria-valuemax="100" aria-valuenow={resumen.avance} style={{ marginTop: 17, height: 11, borderRadius: 999, background: "rgba(255,255,255,.15)", overflow: "hidden" }}>
        <div style={{ width: `${resumen.avance}%`, height: "100%", borderRadius: 999, background: resumen.avance >= 75 ? "#74d49e" : "linear-gradient(90deg, #f25199, #ffd0e4)" }} />
      </div>

      {error && <div style={{ marginTop: 14, padding: 12, borderRadius: 12, background: "rgba(255,221,171,.15)", border: "1px solid rgba(255,221,171,.35)" }}>{error}</div>}

      {!cargando && tareas.length === 0 ? (
        <div style={{ marginTop: 16, padding: 17, borderRadius: 16, background: "rgba(255,255,255,.1)", border: "1px solid rgba(255,255,255,.18)" }}>
          <strong style={{ display: "block", fontSize: 18 }}>El plan está diseñado y espera tu autorización</strong>
          <p style={{ margin: "7px 0 13px", color: "rgba(255,255,255,.75)", fontSize: 13, lineHeight: 1.5 }}>Entra al Director Financiero, revisa las 16 acciones y envíalas a las cuentas de los empleados.</p>
          <button type="button" onClick={abrirDirectorFinanciero} style={estiloBotonPrincipal}>Revisar y activar el plan →</button>
        </div>
      ) : (
        <>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: 8, marginTop: 16 }}>
            {[
              ["Terminadas", resumen.terminadas.length, "✓"],
              ["En proceso", resumen.enProceso.length, "▶"],
              ["Vencidas", resumen.vencidas.length, "!"],
              ["Por revisar", resumen.requierenRevision.length, "◉"],
            ].map(([etiqueta, valor, icono]) => (
              <div key={etiqueta} style={{ minWidth: 0, padding: 12, borderRadius: 14, background: "rgba(255,255,255,.1)", border: "1px solid rgba(255,255,255,.14)", textAlign: "center" }}>
                <span style={{ display: "block", color: "#ffc5de", fontWeight: 900 }}>{icono} {valor}</span>
                <small style={{ display: "block", marginTop: 4, color: "rgba(255,255,255,.65)", fontSize: 10 }}>{etiqueta}</small>
              </div>
            ))}
          </div>

          {resumen.siguientes.length > 0 && (
            <div style={{ marginTop: 16 }}>
              <div style={{ color: "#f7b8d4", fontSize: 11, fontWeight: 900, letterSpacing: ".08em" }}>LO SIGUIENTE</div>
              <div style={{ display: "grid", gap: 8, marginTop: 9 }}>
                {resumen.siguientes.map((tarea, indice) => (
                  <div key={tarea.id} style={{ display: "grid", gridTemplateColumns: "32px minmax(0, 1fr)", gap: 10, padding: 12, borderRadius: 14, background: "rgba(255,255,255,.1)", border: "1px solid rgba(255,255,255,.14)" }}>
                    <div style={{ width: 30, height: 30, display: "grid", placeItems: "center", borderRadius: 10, background: indice === 0 ? "#fff" : "rgba(255,255,255,.15)", color: indice === 0 ? "#7d2452" : "#fff", fontWeight: 900 }}>{indice + 1}</div>
                    <div style={{ minWidth: 0 }}>
                      <strong style={{ display: "block", fontSize: 13 }}>{String(tarea.titulo).replace("Rescate 30 días · ", "")}</strong>
                      <small style={{ display: "block", marginTop: 4, color: "rgba(255,255,255,.67)" }}>{fechaCorta(tarea.fecha)} · {tarea.responsable || "Falta responsable"}</small>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {resumen.equipo.length > 0 && (
            <div style={{ marginTop: 16, padding: 15, borderRadius: 16, background: "rgba(255,255,255,.94)", color: "#38242e" }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
                <strong>Equipo dentro del rescate</strong>
                <small style={{ color: "#806b75" }}>{resumen.equipo.length} responsable{resumen.equipo.length === 1 ? "" : "s"}</small>
              </div>
              <div style={{ display: "grid", gap: 10, marginTop: 12 }}>
                {resumen.equipo.slice(0, 6).map((persona) => {
                  const avancePersona = persona.total ? Math.round((persona.terminadas / persona.total) * 100) : 0;
                  return (
                    <div key={persona.nombre}>
                      <div style={{ display: "flex", justifyContent: "space-between", gap: 10, fontSize: 12 }}>
                        <span style={{ fontWeight: 820 }}>{persona.nombre}</span>
                        <span style={{ color: persona.vencidas ? "#a72f45" : "#6d5b64" }}>{persona.terminadas}/{persona.total} · {persona.vencidas ? `${persona.vencidas} vencida${persona.vencidas === 1 ? "" : "s"}` : "al día"}</span>
                      </div>
                      <div style={{ height: 7, marginTop: 6, borderRadius: 999, background: "#eee1e7", overflow: "hidden" }}><div style={{ width: `${avancePersona}%`, height: "100%", background: colorAvance, borderRadius: 999 }} /></div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          <button
            type="button"
            onClick={() => setSupervisionAbierta((valor) => !valor)}
            style={{ ...estiloBotonPrincipal, marginTop: 14, background: "rgba(255,255,255,.13)", color: "#fff", border: "1px solid rgba(255,255,255,.22)" }}
          >
            {supervisionAbierta ? "Ocultar supervisión" : "Supervisar tareas y evidencias"} {supervisionAbierta ? "▲" : "▼"}
          </button>

          {supervisionAbierta && (
            <div style={{ display: "grid", gap: 9, marginTop: 11 }}>
              {[...tareas]
                .sort((a, b) => {
                  if (Boolean(b.requiere_revision) !== Boolean(a.requiere_revision)) return Number(Boolean(b.requiere_revision)) - Number(Boolean(a.requiere_revision));
                  return String(a.fecha || "").localeCompare(String(b.fecha || ""));
                })
                .map((tarea) => {
                  const abierta = tareaAbierta === tarea.id;
                  const listaEvidencias = evidencias[tarea.id] || [];
                  const terminada = estadoTerminado(tarea.estado);
                  return (
                    <article key={tarea.id} style={{ borderRadius: 15, overflow: "hidden", background: "rgba(255,255,255,.96)", color: "#3b2731", border: tarea.requiere_revision ? "2px solid #f0b64f" : "1px solid rgba(255,255,255,.25)" }}>
                      <button type="button" onClick={() => revisarTarea(tarea)} style={{ width: "100%", padding: 13, border: 0, background: "transparent", color: "inherit", textAlign: "left", cursor: "pointer" }}>
                        <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "flex-start" }}>
                          <div style={{ minWidth: 0 }}>
                            <strong style={{ display: "block", fontSize: 13 }}>{String(tarea.titulo || "").replace("Rescate 30 días · ", "")}</strong>
                            <small style={{ display: "block", marginTop: 4, color: "#7d6973" }}>{fechaCorta(tarea.fecha)} · {tarea.responsable || "Sin responsable"}</small>
                          </div>
                          <span style={{ flexShrink: 0, padding: "5px 8px", borderRadius: 999, background: tarea.requiere_revision ? "#fff0c9" : terminada ? "#dff4e6" : "#f6e8ef", color: tarea.requiere_revision ? "#765100" : terminada ? "#24683e" : "#7d3158", fontSize: 9, fontWeight: 900 }}>
                            {tarea.requiere_revision ? "REVISAR" : terminada ? "TERMINADA" : estadoEnProceso(tarea.estado) ? "EN PROCESO" : "PENDIENTE"}
                          </span>
                        </div>
                      </button>

                      {abierta && (
                        <div style={{ padding: "0 13px 14px", borderTop: "1px solid #eadde4" }}>
                          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 9, marginTop: 12 }}>
                            <div style={estiloDatoRevision}><small>TRABAJO</small><span>{tarea.descripcion || "Sin descripción"}</span></div>
                            <div style={estiloDatoRevision}><small>CRITERIO DE ÉXITO</small><span>{tarea.criterio_exito || "Falta definir"}</span></div>
                            <div style={estiloDatoRevision}><small>EVALUACIÓN MONYS</small><span>{tarea.evaluacion_resumen || (terminada ? "En espera de evaluación" : "Se evalúa al terminar")}</span>{tarea.calificacion_final !== null && tarea.calificacion_final !== undefined && <strong>{Number(tarea.calificacion_final).toFixed(0)}/100</strong>}</div>
                          </div>

                          <div style={{ marginTop: 12 }}>
                            <div style={{ color: "#8b315d", fontSize: 10, fontWeight: 900, letterSpacing: ".07em" }}>EVIDENCIA</div>
                            {cargandoEvidencias === tarea.id ? (
                              <p style={{ color: "#7d6973", fontSize: 12 }}>Cargando evidencia…</p>
                            ) : listaEvidencias.length === 0 ? (
                              <div style={{ marginTop: 7, padding: 11, borderRadius: 11, background: "#fff6e8", color: "#775613", fontSize: 12, fontWeight: 750 }}>Todavía no hay archivos o fotografías comprobatorias.</div>
                            ) : listaEvidencias[0]?.error ? (
                              <div style={{ marginTop: 7, color: "#9b3547", fontSize: 12 }}>{listaEvidencias[0].error}</div>
                            ) : (
                              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(105px, 1fr))", gap: 8, marginTop: 8 }}>
                                {listaEvidencias.map((evidencia) => (
                                  <a key={evidencia.id} href={evidencia.archivo_url || "#"} target="_blank" rel="noreferrer" style={{ minHeight: 86, padding: 9, borderRadius: 11, background: evidencia.archivo_url ? `linear-gradient(rgba(38,18,28,.34), rgba(38,18,28,.58)), url(${evidencia.archivo_url}) center/cover` : "#f4e8ee", color: evidencia.archivo_url ? "#fff" : "#5d4652", display: "flex", flexDirection: "column", justifyContent: "flex-end", textDecoration: "none", fontSize: 10, fontWeight: 850 }}>
                                    <span>{String(evidencia.tipo || "evidencia").toUpperCase()}</span>
                                    <small style={{ marginTop: 3, opacity: .85 }}>{evidencia.descripcion || "Abrir comprobante"}</small>
                                  </a>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                    </article>
                  );
                })}
            </div>
          )}

          <button type="button" onClick={abrirDirectorFinanciero} style={{ ...estiloBotonPrincipal, marginTop: 14 }}>Abrir control completo del rescate →</button>
        </>
      )}
    </section>
  );
}

const estiloBotonPrincipal = {
  width: "100%",
  minHeight: 46,
  padding: "10px 14px",
  border: 0,
  borderRadius: 13,
  background: "#fff",
  color: "#721f4d",
  fontWeight: 900,
  cursor: "pointer",
};

const estiloDatoRevision = {
  padding: 11,
  borderRadius: 11,
  background: "#fbf4f7",
  color: "#604b55",
  fontSize: 11,
  lineHeight: 1.45,
  display: "grid",
  gap: 5,
};
