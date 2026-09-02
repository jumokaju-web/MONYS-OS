import {
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  obtenerTareasOperativas,
  obtenerCorreccionesInventarioDisponibles,
  tomarCorreccionInventario,
  cambiarEstadoTareaOperativa,
  subirEvidenciaTarea,
  obtenerEvidenciasTarea,
  ejecutarEvaluacionTareaIA,
} from "../services/tareasOperativasService";

function obtenerFechaHoy() {
  const ahora = new Date();

  const year = ahora.getFullYear();

  const month = String(
    ahora.getMonth() + 1
  ).padStart(2, "0");

  const day = String(
    ahora.getDate()
  ).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function normalizarTexto(valor) {
  return String(valor || "")
    .normalize("NFD")
    .replace(
      /[\u0300-\u036f]/g,
      ""
    )
    .trim()
    .replace(/\s+/g, " ")
    .toUpperCase();
}

function etiquetaEstado(estado) {
  if (estado === "en_proceso") {
    return "En proceso";
  }

  if (estado === "terminada") {
    return "Terminada";
  }

  return "Pendiente";
}

function etiquetaPrioridad(prioridad) {
  if (prioridad === "urgente") {
    return "Urgente";
  }

  if (prioridad === "alta") {
    return "Alta";
  }

  if (prioridad === "baja") {
    return "Baja";
  }

  return "Normal";
}

export default function OperacionEmpleado({
  branchId = null,
  usuario = null,
}) {
  const [tareas, setTareas] =
    useState([]);

  const [
    correccionesDisponibles,
    setCorreccionesDisponibles,
  ] = useState([]);

  const [
    evidenciasPorTarea,
    setEvidenciasPorTarea,
  ] = useState({});

  const [cargando, setCargando] =
    useState(true);

  const [error, setError] =
    useState("");

  const [mensaje, setMensaje] =
    useState("");

  const fechaHoy =
    obtenerFechaHoy();

  const nombreEmpleado =
    normalizarTexto(
      usuario?.nombre
    );

  async function cargarTareas() {
    try {
      setCargando(true);
      setError("");

      const [
        registros,
        correcciones,
      ] = await Promise.all([
        obtenerTareasOperativas({
          branchId,
          fecha: fechaHoy,
        }),

        obtenerCorreccionesInventarioDisponibles({
          branchId,
          fecha: fechaHoy,
        }),
      ]);

      setCorreccionesDisponibles(
        Array.isArray(correcciones)
          ? correcciones
          : []
      );

      /*
       * IMPORTANTE:
       * Esta pantalla NO muestra todas
       * las tareas de la sucursal.
       *
       * Solo muestra las tareas cuyo
       * responsable coincide con el
       * usuario autenticado.
       *
       * Más adelante esto se cambiará
       * por usuario_id / empleado_id.
       */
      const propias =
        (registros || []).filter(
          (tarea) =>
            normalizarTexto(
              tarea.responsable
            ) === nombreEmpleado
        );

      setTareas(propias);

      const pares =
        await Promise.all(
          propias.map(
            async (tarea) => {
              try {
                const evidencias =
                  await obtenerEvidenciasTarea(
                    tarea.id
                  );

                return [
                  tarea.id,
                  evidencias || [],
                ];
              } catch (
                errorEvidencia
              ) {
                console.error(
                  "Error cargando evidencias:",
                  errorEvidencia
                );

                return [
                  tarea.id,
                  [],
                ];
              }
            }
          )
        );

      setEvidenciasPorTarea(
        Object.fromEntries(pares)
      );
    } catch (errorCarga) {
      console.error(
        "Error cargando tareas del empleado:",
        errorCarga
      );

      setError(
        "No pudimos cargar tu trabajo de hoy."
      );
    } finally {
      setCargando(false);
    }
  }

  useEffect(() => {
    cargarTareas();
  }, [
    branchId,
    fechaHoy,
    nombreEmpleado,
  ]);

  async function cargarEvidencias(
    tareaId
  ) {
    try {
      const evidencias =
        await obtenerEvidenciasTarea(
          tareaId
        );

      setEvidenciasPorTarea(
        (actual) => ({
          ...actual,
          [tareaId]:
            evidencias || [],
        })
      );
    } catch (
      errorEvidencia
    ) {
      console.error(
        "Error cargando evidencias:",
        errorEvidencia
      );
    }
  }

  async function subirFoto({
    tarea,
    tipo,
    archivo,
  }) {
    if (!archivo) {
      return;
    }

    try {
      setError("");
      setMensaje("");

      await subirEvidenciaTarea({
        tareaId: tarea.id,
        tipo,
        archivo,
        responsable:
          tarea.responsable ||
          usuario?.nombre ||
          null,
      });

      await cargarEvidencias(
        tarea.id
      );

      setMensaje(
        tipo === "inicio"
          ? "Foto inicial guardada."
          : "Foto final guardada."
      );
    } catch (
      errorFoto
    ) {
      console.error(
        "Error subiendo evidencia:",
        errorFoto
      );

      setError(
        "No pudimos guardar la foto."
      );
    }
  }

  async function tomarCorreccion(
    tarea
  ) {
    try {
      setError("");
      setMensaje("");

      const responsable =
        String(
          usuario?.nombre || ""
        ).trim();

      if (!responsable) {
        setError(
          "No pudimos identificar tu nombre para asignarte la corrección."
        );

        return;
      }

      await tomarCorreccionInventario({
        tareaId: tarea.id,
        responsable,
      });

      await cargarTareas();

      setMensaje(
        "Corrección tomada. Ya aparece dentro de tus tareas."
      );
    } catch (
      errorTomar
    ) {
      console.error(
        "Error tomando corrección de inventario:",
        errorTomar
      );

      setError(
        errorTomar?.message ||
          "No pudimos asignarte esta corrección."
      );

      await cargarTareas();
    }
  }


  async function cambiarEstado(
    tarea,
    nuevoEstado
  ) {
    try {
      setError("");
      setMensaje("");

      await cambiarEstadoTareaOperativa({
        tareaId: tarea.id,
        estado: nuevoEstado,
        completadaPor:
          usuario?.nombre ||
          tarea.responsable ||
          null,
      });

      if (
        nuevoEstado ===
        "terminada"
      ) {
        try {
          await ejecutarEvaluacionTareaIA(
            tarea.id
          );
        } catch (
          errorEvaluacion
        ) {
          console.error(
            "Evaluación IA pendiente:",
            errorEvaluacion
          );
        }
      }

      await cargarTareas();

      setMensaje(
        nuevoEstado ===
          "en_proceso"
          ? "Tarea iniciada."
          : "Tarea terminada. ¡Buen trabajo!"
      );
    } catch (
      errorEstado
    ) {
      console.error(
        "Error actualizando tarea:",
        errorEstado
      );

      setError(
        "No pudimos actualizar la tarea."
      );
    }
  }

  const activas =
    useMemo(
      () =>
        tareas.filter(
          (tarea) =>
            tarea.estado ===
              "pendiente" ||
            tarea.estado ===
              "en_proceso"
        ),
      [tareas]
    );

  const terminadas =
    useMemo(
      () =>
        tareas.filter(
          (tarea) =>
            tarea.estado ===
            "terminada"
        ),
      [tareas]
    );

  const pendientes =
    activas.filter(
      (tarea) =>
        tarea.estado ===
        "pendiente"
    ).length;

  const enProceso =
    activas.filter(
      (tarea) =>
        tarea.estado ===
        "en_proceso"
    ).length;

  const urgentes =
    activas.filter(
      (tarea) =>
        tarea.prioridad ===
        "urgente"
    ).length;

  const total =
    activas.length +
    terminadas.length;

  const porcentaje =
    total > 0
      ? Math.round(
          (terminadas.length /
            total) *
            100
        )
      : 100;

  if (cargando) {
    return (
      <div
        style={{
          padding: "28px 18px",
          textAlign: "center",
          color: "#76666e",
        }}
      >
        Cargando tu día...
      </div>
    );
  }

  return (
    <section
      style={{
        padding: "16px",
      }}
    >
      {/* RESUMEN */}

      <div
        style={{
          marginBottom: "18px",
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent:
              "space-between",
            alignItems: "center",
            gap: "12px",
            marginBottom: "12px",
          }}
        >
          <div>
            <div
              style={{
                fontSize: "12px",
                color: "#9a7d8b",
                fontWeight: "800",
                textTransform:
                  "uppercase",
                letterSpacing:
                  "0.7px",
              }}
            >
              Tu día
            </div>

            <div
              style={{
                fontSize: "24px",
                fontWeight: "900",
                color: "#2a1d24",
              }}
            >
              {porcentaje}%
            </div>

            <div
              style={{
                fontSize: "13px",
                color: "#796a71",
              }}
            >
              de cumplimiento
            </div>
          </div>

          <button
            type="button"
            onClick={
              cargarTareas
            }
            style={{
              border:
                "1px solid #ead7e1",
              background: "#ffffff",
              borderRadius: "12px",
              padding:
                "9px 12px",
              cursor: "pointer",
              fontWeight: "800",
              color: "#7d3157",
            }}
          >
            ↻ Actualizar
          </button>
        </div>

        <div
          style={{
            height: "9px",
            borderRadius: "999px",
            background: "#f3e8ed",
            overflow: "hidden",
          }}
        >
          <div
            style={{
              width: `${porcentaje}%`,
              height: "100%",
              background:
                "linear-gradient(90deg, #c33170, #e272a1)",
              transition:
                "width .3s ease",
            }}
          />
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns:
              "repeat(3, 1fr)",
            gap: "8px",
            marginTop: "14px",
          }}
        >
          <MiniDato
            numero={pendientes}
            texto="Pendientes"
          />

          <MiniDato
            numero={enProceso}
            texto="En proceso"
          />

          <MiniDato
            numero={terminadas.length}
            texto="Terminadas"
          />
        </div>

        {urgentes > 0 && (
          <div
            style={{
              marginTop: "12px",
              padding:
                "10px 12px",
              borderRadius: "12px",
              background: "#fff3f1",
              color: "#a23d32",
              fontWeight: "800",
              fontSize: "14px",
            }}
          >
            🔴 Tienes {urgentes}{" "}
            {urgentes === 1
              ? "tarea urgente"
              : "tareas urgentes"}
          </div>
        )}
      </div>

      {error && (
        <div
          style={{
            marginBottom: "12px",
            padding: "12px",
            borderRadius: "12px",
            background: "#fff2f2",
            color: "#a33d3d",
          }}
        >
          {error}
        </div>
      )}

      {mensaje && (
        <div
          style={{
            marginBottom: "12px",
            padding: "12px",
            borderRadius: "12px",
            background: "#edf8f1",
            color: "#28704a",
            fontWeight: "700",
          }}
        >
          ✅ {mensaje}
        </div>
      )}

      {/* CORRECCIONES DE INVENTARIO DISPONIBLES */}

      <div
        style={{
          marginBottom: "20px",
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent:
              "space-between",
            alignItems: "center",
            gap: "10px",
            marginBottom: "10px",
          }}
        >
          <h3
            style={{
              margin: 0,
              color: "#2b2025",
              fontSize: "18px",
            }}
          >
            📦 Correcciones de inventario
          </h3>

          <span
            style={{
              minWidth: "30px",
              height: "30px",
              padding: "0 9px",
              borderRadius: "999px",
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              background: "#fff1dc",
              color: "#9a5b00",
              fontWeight: "900",
              fontSize: "13px",
            }}
          >
            {correccionesDisponibles.length}
          </span>
        </div>

        {correccionesDisponibles.length ===
        0 ? (
          <div
            style={{
              padding: "14px",
              borderRadius: "14px",
              border:
                "1px solid #e6e8e7",
              background: "#fafcfa",
              color: "#68746d",
              fontSize: "13px",
            }}
          >
            No hay correcciones de
            inventario disponibles en
            esta sucursal.
          </div>
        ) : (
          <div
            style={{
              display: "grid",
              gap: "10px",
            }}
          >
            {correccionesDisponibles.map(
              (tarea) => {
                const esAlta =
                  tarea.prioridad ===
                    "alta" ||
                  tarea.prioridad ===
                    "urgente";

                return (
                  <article
                    key={tarea.id}
                    style={{
                      padding: "14px",
                      borderRadius:
                        "15px",
                      border:
                        esAlta
                          ? "1px solid #f0c9a6"
                          : "1px solid #eadde4",
                      background:
                        esAlta
                          ? "#fffaf4"
                          : "#ffffff",
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        justifyContent:
                          "space-between",
                        alignItems:
                          "flex-start",
                        gap: "10px",
                        flexWrap: "wrap",
                      }}
                    >
                      <div
                        style={{
                          flex: "1 1 220px",
                        }}
                      >
                        <strong
                          style={{
                            display: "block",
                            color: "#2a1e24",
                            lineHeight: 1.35,
                            fontSize: "15px",
                          }}
                        >
                          {tarea.titulo}
                        </strong>

                        {tarea.descripcion && (
                          <div
                            style={{
                              marginTop:
                                "7px",
                              color:
                                "#75666d",
                              fontSize:
                                "13px",
                              lineHeight:
                                1.45,
                            }}
                          >
                            {tarea.descripcion}
                          </div>
                        )}
                      </div>

                      <span
                        style={{
                          whiteSpace:
                            "nowrap",
                          fontSize:
                            "11px",
                          fontWeight:
                            "900",
                          padding:
                            "5px 8px",
                          borderRadius:
                            "999px",
                          background:
                            esAlta
                              ? "#fff0dd"
                              : "#f7f1f4",
                          color:
                            esAlta
                              ? "#9a5b00"
                              : "#765c69",
                        }}
                      >
                        {etiquetaPrioridad(
                          tarea.prioridad
                        )}
                      </span>
                    </div>

                    <button
                      type="button"
                      onClick={() =>
                        tomarCorreccion(
                          tarea
                        )
                      }
                      disabled={
                        !String(
                          usuario?.nombre ||
                            ""
                        ).trim()
                      }
                      style={{
                        width: "100%",
                        marginTop: "12px",
                        border: "none",
                        borderRadius:
                          "12px",
                        padding: "12px",
                        background:
                          "#8f2858",
                        color:
                          "#ffffff",
                        fontWeight:
                          "900",
                        cursor:
                          String(
                            usuario?.nombre ||
                              ""
                          ).trim()
                            ? "pointer"
                            : "not-allowed",
                        opacity:
                          String(
                            usuario?.nombre ||
                              ""
                          ).trim()
                            ? 1
                            : 0.55,
                      }}
                    >
                      📦 Tomar corrección
                    </button>
                  </article>
                );
              }
            )}
          </div>
        )}
      </div>

      {/* TAREAS */}

      <h3
        style={{
          margin:
            "6px 0 12px",
          color: "#2b2025",
          fontSize: "18px",
        }}
      >
        📋 Tus tareas
      </h3>

      {activas.length === 0 ? (
        <div
          style={{
            padding:
              "28px 18px",
            borderRadius: "18px",
            background:
              "#f5fbf7",
            textAlign: "center",
            border:
              "1px solid #d5eadc",
          }}
        >
          <div
            style={{
              fontSize: "30px",
              marginBottom: "8px",
            }}
          >
            🎉
          </div>

          <strong
            style={{
              display: "block",
              color: "#276a47",
              fontSize: "18px",
            }}
          >
            Estás al día
          </strong>

          <div
            style={{
              color: "#678074",
              marginTop: "5px",
            }}
          >
            No tienes tareas
            pendientes asignadas.
          </div>
        </div>
      ) : (
        <div
          style={{
            display: "grid",
            gap: "12px",
          }}
        >
          {activas.map(
            (tarea) => {
              const evidencias =
                evidenciasPorTarea[
                  tarea.id
                ] || [];

              const tieneFinal =
                evidencias.some(
                  (evidencia) =>
                    evidencia.tipo ===
                    "final"
                );

              const esUrgente =
                tarea.prioridad ===
                  "urgente" ||
                tarea.prioridad ===
                  "alta";

              return (
                <article
                  key={tarea.id}
                  style={{
                    background:
                      "#ffffff",
                    border:
                      esUrgente
                        ? "1px solid #efc8c1"
                        : "1px solid #eadde4",
                    borderRadius:
                      "16px",
                    padding: "15px",
                    boxShadow:
                      "0 5px 16px rgba(70,30,50,0.05)",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      justifyContent:
                        "space-between",
                      alignItems:
                        "flex-start",
                      gap: "10px",
                    }}
                  >
                    <strong
                      style={{
                        color:
                          "#2a1e24",
                        lineHeight: 1.35,
                        fontSize: "16px",
                      }}
                    >
                      {tarea.titulo}
                    </strong>

                    <span
                      style={{
                        whiteSpace:
                          "nowrap",
                        fontSize:
                          "12px",
                        fontWeight:
                          "900",
                        padding:
                          "5px 8px",
                        borderRadius:
                          "999px",
                        background:
                          esUrgente
                            ? "#fff0ed"
                            : "#f7f1f4",
                        color:
                          esUrgente
                            ? "#ad4439"
                            : "#765c69",
                      }}
                    >
                      {etiquetaPrioridad(
                        tarea.prioridad
                      )}
                    </span>
                  </div>

                  <div
                    style={{
                      marginTop: "8px",
                      color: "#806d76",
                      fontSize: "13px",
                    }}
                  >
                    {etiquetaEstado(
                      tarea.estado
                    )}

                    {tarea.hora_limite
                      ? ` · ⏰ ${tarea.hora_limite}`
                      : ""}
                  </div>

                  {tarea.estado ===
                    "pendiente" && (
                    <button
                      type="button"
                      onClick={() =>
                        cambiarEstado(
                          tarea,
                          "en_proceso"
                        )
                      }
                      style={{
                        width: "100%",
                        marginTop:
                          "12px",
                        border: "none",
                        borderRadius:
                          "12px",
                        padding:
                          "12px",
                        background:
                          "#b52d68",
                        color:
                          "#ffffff",
                        fontWeight:
                          "900",
                        cursor:
                          "pointer",
                      }}
                    >
                      ▶ Iniciar tarea
                    </button>
                  )}

                  <details
                    style={{
                      marginTop:
                        "10px",
                    }}
                  >
                    <summary
                      style={{
                        cursor:
                          "pointer",
                        color:
                          "#8a526e",
                        fontSize:
                          "14px",
                        fontWeight:
                          "800",
                        padding:
                          "5px 0",
                      }}
                    >
                      Ver detalle
                    </summary>

                    <div
                      style={{
                        paddingTop:
                          "10px",
                        color:
                          "#5d5057",
                        fontSize:
                          "14px",
                        lineHeight:
                          1.45,
                      }}
                    >
                         {tarea.instrucciones && (
  <ChecklistTarea
    tareaId={tarea.id}
    instrucciones={tarea.instrucciones}
  />
)}

                      <div
                        style={{
                          display:
                            "flex",
                          gap: "8px",
                          flexWrap:
                            "wrap",
                        }}
                      >
                        <label
                          style={
                            estiloFoto
                          }
                        >
                          📷 Foto inicial

                          <input
                            type="file"
                            accept="image/*"
                            capture="environment"
                            style={{
                              display:
                                "none",
                            }}
                            onChange={(
                              event
                            ) => {
                              const archivo =
                                event
                                  .target
                                  .files?.[0];

                              subirFoto({
                                tarea,
                                tipo:
                                  "inicio",
                                archivo,
                              });

                              event.target.value =
                                "";
                            }}
                          />
                        </label>

                        <label
                          style={
                            estiloFoto
                          }
                        >
                          📸 Foto final

                          <input
                            type="file"
                            accept="image/*"
                            capture="environment"
                            style={{
                              display:
                                "none",
                            }}
                            onChange={(
                              event
                            ) => {
                              const archivo =
                                event
                                  .target
                                  .files?.[0];

                              subirFoto({
                                tarea,
                                tipo:
                                  "final",
                                archivo,
                              });

                              event.target.value =
                                "";
                            }}
                          />
                        </label>
                      </div>

                      {evidencias.length >
                        0 && (
                        <div
                          style={{
                            marginTop:
                              "10px",
                            color:
                              "#557263",
                            fontWeight:
                              "700",
                          }}
                        >
                          📎{" "}
                          {
                            evidencias.length
                          }{" "}
                          evidencia
                          {evidencias.length ===
                          1
                            ? ""
                            : "s"}{" "}
                          registrada
                          {evidencias.length ===
                          1
                            ? ""
                            : "s"}
                        </div>
                      )}

                      {tarea.estado ===
                        "en_proceso" && (
                        <button
                          type="button"
                          disabled={
                            !tieneFinal
                          }
                          onClick={() =>
                            cambiarEstado(
                              tarea,
                              "terminada"
                            )
                          }
                          style={{
                            width:
                              "100%",
                            marginTop:
                              "12px",
                            border:
                              "none",
                            borderRadius:
                              "12px",
                            padding:
                              "12px",
                            background:
                              tieneFinal
                                ? "#2f8a5d"
                                : "#d9dfdc",
                            color:
                              "#ffffff",
                            fontWeight:
                              "900",
                            cursor:
                              tieneFinal
                                ? "pointer"
                                : "not-allowed",
                          }}
                        >
                          ✅ Terminar tarea
                        </button>
                      )}

                      {tarea.estado ===
                        "en_proceso" &&
                        !tieneFinal && (
                          <div
                            style={{
                              marginTop:
                                "7px",
                              color:
                                "#8c707d",
                              fontSize:
                                "12px",
                            }}
                          >
                            Sube la foto
                            final para
                            terminar.
                          </div>
                        )}
                    </div>
                  </details>
                </article>
              );
            }
          )}
        </div>
      )}

      {terminadas.length > 0 && (
        <details
          style={{
            marginTop: "16px",
            borderTop:
              "1px solid #eee0e7",
            paddingTop: "12px",
          }}
        >
          <summary
            style={{
              cursor: "pointer",
              color: "#777",
              fontSize: "13px",
              fontWeight: "700",
            }}
          >
            ✅ Terminadas hoy (
            {terminadas.length})
          </summary>
        </details>
      )}
    </section>
  );
}

function MiniDato({
  numero,
  texto,
}) {
  return (
    <div
      style={{
        background: "#faf6f8",
        borderRadius: "12px",
        padding: "10px 6px",
        textAlign: "center",
      }}
    >
      <strong
        style={{
          display: "block",
          fontSize: "18px",
          color: "#31242b",
        }}
      >
        {numero}
      </strong>

      <span
        style={{
          fontSize: "11px",
          color: "#826f78",
        }}
      >
        {texto}
      </span>
    </div>
  );
}

function ChecklistTarea({
  tareaId,
  instrucciones,
}) {
  const pasos = String(
    instrucciones || ""
  )
    .split("\n")
    .map((paso) =>
      paso
        .replace(/^☐\s*/, "")
        .trim()
    )
    .filter(Boolean);

  const claveStorage =
    `monys-checklist-${tareaId}`;

  const obtenerIniciales = () => {
    try {
      const guardados =
        localStorage.getItem(
          claveStorage
        );

      if (guardados) {
        return JSON.parse(
          guardados
        );
      }
    } catch (error) {
      console.error(
        "No fue posible recuperar checklist:",
        error
      );
    }

    return pasos.map(() => false);
  };

  const [
    completados,
    setCompletados,
  ] = useState(
    obtenerIniciales
  );

  const cambiarPaso = (
    indice
  ) => {
    setCompletados(
      (actuales) => {
        const nuevos =
          [...actuales];

        nuevos[indice] =
          !nuevos[indice];

        try {
          localStorage.setItem(
            claveStorage,
            JSON.stringify(
              nuevos
            )
          );
        } catch (error) {
          console.error(
            "No fue posible guardar checklist:",
            error
          );
        }

        return nuevos;
      }
    );
  };

  const realizados =
    completados.filter(
      Boolean
    ).length;

  const porcentaje =
    pasos.length > 0
      ? Math.round(
          (realizados /
            pasos.length) *
            100
        )
      : 0;

  return (
    <div
      style={{
        margin:
          "0 0 16px",
        padding: "14px",
        borderRadius:
          "14px",
        background:
          "#fff8fb",
        border:
          "1px solid #edd8e3",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent:
            "space-between",
          alignItems: "center",
          gap: "10px",
          marginBottom:
            "10px",
        }}
      >
        <strong
          style={{
            color:
              "#6f294d",
            fontSize:
              "14px",
          }}
        >
          ✅ Checklist
        </strong>

        <span
          style={{
            fontSize:
              "13px",
            fontWeight:
              "900",
            color:
              porcentaje === 100
                ? "#28704a"
                : "#9b3463",
          }}
        >
          {realizados}/
          {pasos.length}
        </span>
      </div>

      <div
        style={{
          height: "7px",
          borderRadius:
            "999px",
          background:
            "#f0e1e8",
          overflow:
            "hidden",
          marginBottom:
            "12px",
        }}
      >
        <div
          style={{
            width:
              `${porcentaje}%`,
            height: "100%",
            background:
              porcentaje === 100
                ? "#35a26c"
                : "#cc3676",
            transition:
              "width .2s ease",
          }}
        />
      </div>

      <div
        style={{
          display: "grid",
          gap: "8px",
        }}
      >
        {pasos.map(
          (
            paso,
            indice
          ) => (
            <label
              key={`${tareaId}-${indice}`}
              style={{
                display:
                  "flex",
                alignItems:
                  "center",
                gap: "10px",
                padding:
                  "10px 11px",
                borderRadius:
                  "11px",
                cursor:
                  "pointer",
                background:
                  completados[
                    indice
                  ]
                    ? "#edf8f1"
                    : "#ffffff",
                border:
                  completados[
                    indice
                  ]
                    ? "1px solid #b7dfc8"
                    : "1px solid #eadde4",
              }}
            >
              <input
                type="checkbox"
                checked={
                  !!completados[
                    indice
                  ]
                }
                onChange={() =>
                  cambiarPaso(
                    indice
                  )
                }
                style={{
                  width:
                    "20px",
                  height:
                    "20px",
                  accentColor:
                    "#c72f70",
                  flexShrink: 0,
                }}
              />

              <span
                style={{
                  fontSize:
                    "14px",
                  lineHeight:
                    1.3,
                  color:
                    completados[
                      indice
                    ]
                      ? "#397153"
                      : "#43343b",
                  textDecoration:
                    completados[
                      indice
                    ]
                      ? "line-through"
                      : "none",
                }}
              >
                {paso}
              </span>
            </label>
          )
        )}
      </div>

      {porcentaje ===
        100 && (
        <div
          style={{
            marginTop:
              "11px",
            padding:
              "9px",
            borderRadius:
              "10px",
            textAlign:
              "center",
            background:
              "#eaf8ef",
            color:
              "#28704a",
            fontWeight:
              "900",
            fontSize:
              "13px",
          }}
        >
          🎉 Checklist
          completado
        </div>
      )}
    </div>
  );
}

const estiloFoto = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  padding: "9px 11px",
  borderRadius: "10px",
  border:
    "1px solid #e1d2da",
  background: "#ffffff",
  cursor: "pointer",
  fontWeight: "700",
  fontSize: "13px",
};