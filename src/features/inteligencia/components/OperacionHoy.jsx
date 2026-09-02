import {
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  obtenerTareasOperativas,
  crearTareaOperativa,
  cambiarEstadoTareaOperativa,
  eliminarTareaOperativa,
  subirEvidenciaTarea,
  obtenerEvidenciasTarea,
  marcarTareaParaEvaluacion,
  ejecutarEvaluacionTareaIA,
} from "../services/tareasOperativasService";

import {
  limpiarYBalancearOperacion,
} from "../services/limpiezaOperacionService";

const formularioInicial = {
  titulo: "",
  descripcion: "",
  area: "tienda",
  responsable: "",
  prioridad: "normal",
  horaLimite: "",
  instrucciones: "",
};


function obtenerFechaHoy() {
  const ahora = new Date();

  const year =
    ahora.getFullYear();

  const month =
    String(
      ahora.getMonth() + 1
    ).padStart(2, "0");

  const day =
    String(
      ahora.getDate()
    ).padStart(2, "0");

  return `${year}-${month}-${day}`;
}


function etiquetaEstado(
  estado
) {
  switch (estado) {
    case "en_proceso":
      return "EN PROCESO";

    case "terminada":
      return "TERMINADA";

    case "cancelada":
      return "CANCELADA";

    default:
      return "PENDIENTE";
  }
}


function etiquetaPrioridad(
  prioridad
) {
  switch (prioridad) {
    case "urgente":
      return "URGENTE";

    case "alta":
      return "ALTA";

    case "baja":
      return "BAJA";

    default:
      return "NORMAL";
  }
}


export default function OperacionHoy({
  organizationId = null,
  businessId = null,
  branchId = null,
}) {
  const [
    tareas,
    setTareas,
  ] = useState([]);

  const [
    formulario,
    setFormulario,
  ] = useState(
    formularioInicial
  );

  const [
    cargando,
    setCargando,
  ] = useState(false);

  const [
    guardando,
    setGuardando,
  ] = useState(false);

  const [
    error,
    setError,
  ] = useState("");

  const [
    mensaje,
    setMensaje,
  ] = useState("");

  const [
  evidenciasPorTarea,
  setEvidenciasPorTarea,
] = useState({});

  const fechaHoy =
    obtenerFechaHoy();


  async function cargarTareas() {
  try {
    setCargando(true);
    setError("");

 
    const data =
      await obtenerTareasOperativas({
        branchId,
        fecha: fechaHoy,
      });

 
    setTareas(data);

    const paresEvidencias =
      await Promise.all(
        data.map(
          async (tarea) => {
            try {
              const evidencias =
                await obtenerEvidenciasTarea(
                  tarea.id
                );

              return [
                tarea.id,
                evidencias,
              ];
            } catch (errorEvidencia) {
              console.error(
                "Error al cargar evidencias:",
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
      Object.fromEntries(
        paresEvidencias
      )
    );
  } catch (errorCarga) {
    console.error(
      "Error al cargar tareas:",
      errorCarga
    );

    setError(
      "No se pudieron cargar las tareas."
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
  ]);


  const tareasActivas =
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


  const tareasHistorial =
    useMemo(
      () =>
        tareas.filter(
          (tarea) =>
            tarea.estado ===
              "terminada" ||
            tarea.estado ===
              "cancelada"
        ),
      [tareas]
    );


  const resumen =
    useMemo(() => {
      const total =
        tareasActivas.length;

      const pendientes =
        tareas.filter(
          (tarea) =>
            tarea.estado ===
            "pendiente"
        ).length;

      const enProceso =
        tareas.filter(
          (tarea) =>
            tarea.estado ===
            "en_proceso"
        ).length;

      const terminadas =
        tareas.filter(
          (tarea) =>
            tarea.estado ===
            "terminada"
        ).length;

      const urgentes =
        tareas.filter(
          (tarea) =>
            tarea.prioridad ===
              "urgente" &&
            tarea.estado !==
              "terminada" &&
            tarea.estado !==
              "cancelada"
        ).length;

      return {
        total,
        pendientes,
        enProceso,
        terminadas,
        urgentes,
      };
    }, [
      tareas,
      tareasActivas,
    ]);


  function manejarCambio(
    event
  ) {
    const {
      name,
      value,
    } = event.target;

    setFormulario(
      (actual) => ({
        ...actual,
        [name]: value,
      })
    );
  }


  async function guardarTarea(
    event
  ) {
    event.preventDefault();

    setError("");
    setMensaje("");

    if (
      !formulario.titulo.trim()
    ) {
      setError(
        "Escribe la tarea."
      );

      return;
    }

    try {
      setGuardando(true);

      await crearTareaOperativa({
        organizationId,
        businessId,
        branchId,

        titulo:
          formulario.titulo,

        descripcion:
          formulario.descripcion,

        area:
          formulario.area,

        responsable:
          formulario.responsable,

        prioridad:
          formulario.prioridad,

        fecha:
          fechaHoy,

        horaLimite:
          formulario.horaLimite,

        instrucciones:
          formulario.instrucciones,

        creadaPor:
          "MONYS OS",
      });

      setFormulario(
        formularioInicial
      );

      setMensaje(
        "Tarea creada."
      );

      await cargarTareas();
    } catch (errorGuardar) {
      console.error(
        "Error al guardar tarea:",
        errorGuardar
      );

      setError(
        errorGuardar?.message ||
          "No se pudo guardar la tarea."
      );
    } finally {
      setGuardando(false);
    }
  }

  async function cargarEvidenciasDeTarea(
  tareaId
) {
  if (!tareaId) {
    return;
  }

  try {
    const evidencias =
      await obtenerEvidenciasTarea(
        tareaId
      );

    setEvidenciasPorTarea(
      (actual) => ({
        ...actual,
        [tareaId]:
          evidencias,
      })
    );
  } catch (errorEvidencias) {
    console.error(
      "Error al cargar evidencias de tarea:",
      errorEvidencias
    );
  }
}

  async function manejarSubirEvidencia({
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
        tarea.responsable || null,
    });

    await cargarEvidenciasDeTarea(
  tarea.id
);

    setMensaje(
      tipo === "inicio"
        ? "Foto inicial guardada."
        : "Foto final guardada."
    );
  } catch (errorEvidencia) {
    console.error(
      "Error al subir evidencia:",
      errorEvidencia
    );

    setError(
      errorEvidencia?.message ||
        "No se pudo subir la evidencia."
    );
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
        tareaId:
          tarea.id,

        estado:
          nuevoEstado,

        completadaPor:
          tarea.responsable ||
          null,
      });

   if (nuevoEstado === "terminada") {
  await ejecutarEvaluacionTareaIA(
    tarea.id
  );
}


      await cargarTareas();
    } catch (errorEstado) {
      console.error(
        "Error al cambiar estado:",
        errorEstado
      );

      setError(
        "No se pudo actualizar la tarea."
      );
    }
  }

  async function reintentarEvaluacion(
  tarea
) {
  if (!tarea?.id) {
    return;
  }

  try {
    setError("");
    setMensaje("");

    await marcarTareaParaEvaluacion(
      tarea.id
    );

    await cargarTareas();

    setMensaje(
      `MONYS está evaluando nuevamente "${tarea.titulo}".`
    );

    await ejecutarEvaluacionTareaIA(
      tarea.id
    );

    await cargarTareas();

    setMensaje(
      `Evaluación de "${tarea.titulo}" completada.`
    );
  } catch (errorEvaluacion) {
    console.error(
      "Error al reintentar evaluación:",
      errorEvaluacion
    );

    /*
     * La Edge Function ya tiene
     * rescate automático.
     *
     * Recargamos siempre para mostrar
     * el estado real guardado en Supabase,
     * incluso cuando OpenAI falle.
     */
    await cargarTareas();

    setError(
      errorEvaluacion?.message ||
        "MONYS no pudo completar la evaluación. La tarea fue enviada a revisión humana."
    );
  }
}


  async function organizarOperacionConMonys() {
    try {
      setError("");
      setMensaje("");

      const resultado =
        await limpiarYBalancearOperacion({
          branchId,
          fecha: fechaHoy,
        });

      await cargarTareas();

      setMensaje(
        resultado?.mensaje ||
          "MONYS organizó las tareas de hoy."
      );
    } catch (errorOrganizacion) {
      console.error(
        "Error al organizar Operación de Hoy:",
        errorOrganizacion
      );

      setError(
        errorOrganizacion?.message ||
          "MONYS no pudo organizar las tareas."
      );
    }
  }



  return (
    <section
      style={{
        padding: "24px",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent:
            "space-between",
          gap: "16px",
          alignItems:
            "flex-start",
          flexWrap: "wrap",
          marginBottom: "24px",
        }}
      >
        <div>
          <h2
            style={{
              margin: 0,
            }}
          >
            ⚡ Operación de Hoy
          </h2>

          <p
            style={{
              marginTop: "6px",
              opacity: 0.7,
            }}
          >
            {fechaHoy}
          </p>
        </div>

        <div
          style={{
            display: "flex",
            gap: "10px",
            flexWrap: "wrap",
          }}
        >
          <button
            type="button"
            onClick={
              organizarOperacionConMonys
            }
          >
            🧹 Organizar tareas con MONYS
          </button>

          <button
            type="button"
            onClick={
              cargarTareas
            }
          >
            🔄 Actualizar
          </button>
        </div>
      </div>


      <div
        style={{
          display: "grid",
          gridTemplateColumns:
            "repeat(auto-fit, minmax(140px, 1fr))",
          gap: "12px",
          marginBottom: "24px",
        }}
      >
        <div
          style={{
            padding: "16px",
            border:
              "1px solid #333",
            borderRadius: "12px",
          }}
        >
          <strong>
            {resumen.total}
          </strong>

          <div>
            Total
          </div>
        </div>

        <div
          style={{
            padding: "16px",
            border:
              "1px solid #333",
            borderRadius: "12px",
          }}
        >
          <strong>
            {resumen.pendientes}
          </strong>

          <div>
            Pendientes
          </div>
        </div>

        <div
          style={{
            padding: "16px",
            border:
              "1px solid #333",
            borderRadius: "12px",
          }}
        >
          <strong>
            {resumen.enProceso}
          </strong>

          <div>
            En proceso
          </div>
        </div>

        <div
          style={{
            padding: "16px",
            border:
              "1px solid #333",
            borderRadius: "12px",
          }}
        >
          <strong>
            {resumen.terminadas}
          </strong>

          <div>
            Terminadas
          </div>
        </div>

        <div
          style={{
            padding: "16px",
            border:
              "1px solid #333",
            borderRadius: "12px",
          }}
        >
          <strong>
            {resumen.urgentes}
          </strong>

          <div>
            Urgentes
          </div>
        </div>
      </div>


      <form
        onSubmit={
          guardarTarea
        }
        style={{
          padding: "20px",
          border:
            "1px solid #333",
          borderRadius: "14px",
          marginBottom: "28px",
        }}
      >
        <h3
          style={{
            marginTop: 0,
          }}
        >
          ➕ Nueva tarea
        </h3>


        <div
          style={{
            display: "grid",
            gridTemplateColumns:
              "repeat(auto-fit, minmax(220px, 1fr))",
            gap: "12px",
          }}
        >
          <input
            name="titulo"
            value={
              formulario.titulo
            }
            onChange={
              manejarCambio
            }
            placeholder="¿Qué tienen que hacer?"
          />

          <input
            name="responsable"
            value={
              formulario.responsable
            }
            onChange={
              manejarCambio
            }
            placeholder="Responsable: Kary, Ana..."
          />

          <select
            name="area"
            value={
              formulario.area
            }
            onChange={
              manejarCambio
            }
          >
            <option value="tienda">
              Tienda
            </option>

            <option value="marketing">
              Marketing
            </option>

            <option value="flotilla">
              Flotilla
            </option>

            <option value="administracion">
              Administración
            </option>

            <option value="rh">
              RH
            </option>

            <option value="ventas">
              Ventas
            </option>

            <option value="general">
              General
            </option>
          </select>

          <select
            name="prioridad"
            value={
              formulario.prioridad
            }
            onChange={
              manejarCambio
            }
          >
            <option value="baja">
              Baja
            </option>

            <option value="normal">
              Normal
            </option>

            <option value="alta">
              Alta
            </option>

            <option value="urgente">
              Urgente
            </option>
          </select>

          <input
            type="time"
            name="horaLimite"
            value={
              formulario.horaLimite
            }
            onChange={
              manejarCambio
            }
          />
        </div>


        <textarea
          name="instrucciones"
          value={
            formulario.instrucciones
          }
          onChange={
            manejarCambio
          }
          placeholder="Instrucciones claras..."
          rows={3}
          style={{
            width: "100%",
            marginTop: "12px",
          }}
        />


        <button
          type="submit"
          disabled={
            guardando
          }
          style={{
            marginTop: "12px",
          }}
        >
          {guardando
            ? "Guardando..."
            : "Guardar tarea"}
        </button>
      </form>


      {error && (
        <p>
          ❌ {error}
        </p>
      )}

      {mensaje && (
        <p>
          ✅ {mensaje}
        </p>
      )}


      <div>
        <h3>
          📋 Tareas de hoy
        </h3>

        {cargando ? (
          <p>
            Cargando tareas...
          </p>
        ) : tareasActivas.length ===
          0 ? (
          <p>
            No hay tareas pendientes ni en proceso para hoy.
          </p>
        ) : (
          tareasActivas.map(
            (tarea) => (
              <article
                key={
                  tarea.id
                }
                style={{
                  padding:
                    "16px",
                  border:
                    "1px solid #333",
                  borderRadius:
                    "12px",
                  marginBottom:
                    "12px",
                }}
              >
                <div
                  style={{
                    display:
                      "flex",
                    justifyContent:
                      "space-between",
                    gap:
                      "14px",
                    flexWrap:
                      "wrap",
                  }}
                >
                  <div>
                    <strong>
                      {
                        tarea.titulo
                      }
                    </strong>

                    <div>
                      👤{" "}
                      {tarea.responsable ||
                        "Sin responsable"}
                    </div>

                    <div>
                      🏢{" "}
                      {tarea.area}
                    </div>

                    <div>
                      ⚠️{" "}
                      {etiquetaPrioridad(
                        tarea.prioridad
                      )}
                    </div>

                    <div>
                      📌{" "}
                      {etiquetaEstado(
                        tarea.estado
                      )}

                        {tarea.evaluacion_estado && (
  <div>
    🤖 Evaluación:{" "}
    {tarea.evaluacion_estado ===
    "analizando"
      ? "ANALIZANDO"
      : tarea.evaluacion_estado ===
        "aprobada"
      ? "APROBADA"
      : tarea.evaluacion_estado ===
        "corregir"
      ? "CORREGIR"
      : tarea.evaluacion_estado ===
        "revision_humana"
      ? "REVISIÓN HUMANA"
      : "PENDIENTE"}
  </div>
)}

{tarea.calificacion_final != null && (
  <div>
    📊 Calificación:{" "}
    {Number(
      tarea.calificacion_final
    ).toFixed(0)}
    %
  </div>
)}

{tarea.evaluacion_resumen && (
  <div>
    🧠 {
      tarea.evaluacion_resumen
    }
  </div>
)}

                    </div>

                    {tarea.hora_limite && (
                      <div>
                        ⏰{" "}
                        {
                          tarea.hora_limite
                        }
                      </div>
                    )}

                    {tarea.instrucciones && (
                      <p>
                        {
                          tarea.instrucciones
                        }
                      </p>
                    )}

                      {(evidenciasPorTarea[
  tarea.id
] || []).length > 0 && (
  <div
    style={{
      marginTop: "12px",
      display: "flex",
      gap: "10px",
      flexWrap: "wrap",
    }}
  >
    {(evidenciasPorTarea[
      tarea.id
    ] || []).map(
      (evidencia) => (
        <div
          key={evidencia.id}
          style={{
            width: "150px",
          }}
        >
          <div
            style={{
              fontSize: "12px",
              fontWeight: "700",
              marginBottom: "4px",
            }}
          >
            {evidencia.tipo ===
            "inicio"
              ? "📷 Inicial"
              : evidencia.tipo ===
                "final"
              ? "📸 Final"
              : "🖼️ Evidencia"}
          </div>

          <img
            src={
              evidencia.archivo_url
            }
            alt={
              evidencia.tipo
            }
            style={{
              width: "150px",
              height: "110px",
              objectFit: "cover",
              borderRadius: "10px",
              border:
                "1px solid #ddd",
            }}
          />
        </div>
      )
    )}
  </div>
)}

                  </div>


                  <div
                    style={{
                      display:
                        "flex",
                      gap:
                        "8px",
                      flexWrap:
                        "wrap",
                      alignItems:
                        "flex-start",
                    }}
                  >

                     <label
  style={{
    display: "inline-flex",
    alignItems: "center",
    gap: "6px",
    padding: "8px 10px",
    border: "1px solid #ccc",
    borderRadius: "8px",
    cursor: "pointer",
  }}
>
  📷 Foto inicial

  <input
    type="file"
    accept="image/*"
    capture="environment"
    style={{
      display: "none",
    }}
    onChange={(event) => {
      const archivo =
        event.target.files?.[0];

      manejarSubirEvidencia({
        tarea,
        tipo: "inicio",
        archivo,
      });

      event.target.value = "";
    }}
  />
</label>

<label
  style={{
    display: "inline-flex",
    alignItems: "center",
    gap: "6px",
    padding: "8px 10px",
    border: "1px solid #ccc",
    borderRadius: "8px",
    cursor: "pointer",
  }}
>
  📸 Foto final

  <input
    type="file"
    accept="image/*"
    capture="environment"
    style={{
      display: "none",
    }}
    onChange={(event) => {
      const archivo =
        event.target.files?.[0];

      manejarSubirEvidencia({
        tarea,
        tipo: "final",
        archivo,
      });

      event.target.value = "";
    }}
  />
</label>

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
                      >
                        ▶ Iniciar
                      </button>
                    )}

                 {tarea.estado !==
  "terminada" &&
  tarea.estado !==
    "cancelada" && (
    <button
      type="button"
      disabled={
        !(evidenciasPorTarea[
          tarea.id
        ] || []).some(
          (evidencia) =>
            evidencia.tipo ===
            "final"
        )
      }
      onClick={() => {
        const tieneFotoFinal =
          (evidenciasPorTarea[
            tarea.id
          ] || []).some(
            (evidencia) =>
              evidencia.tipo ===
              "final"
          );

        if (!tieneFotoFinal) {
          setError(
            "Debes subir una foto final antes de terminar la tarea."
          );

          return;
        }

        cambiarEstado(
          tarea,
          "terminada"
        );
      }}
    >
      ✅ Terminar
    </button>
  )}
                    {tarea.estado ===
                      "terminada" && (
                      <button
                        type="button"
                        onClick={() =>
                          cambiarEstado(
                            tarea,
                            "pendiente"
                          )
                        }
                      >
                        ↩ Reabrir
                      </button>
                    )}

                     {tarea.estado ===
  "terminada" &&
  tarea.evaluacion_estado !==
    "analizando" && (
  <button
    type="button"
    onClick={() =>
      reintentarEvaluacion(
        tarea
      )
    }
  >
    🔄 Reintentar evaluación
  </button>
)}

                    <button
                      type="button"
                      onClick={() =>
                        eliminarTarea(
                          tarea
                        )
                      }
                    >
                      🗑️
                    </button>
                  </div>
                </div>
              </article>
            )
          )
        )}
      </div>

     {/* ======================================
    TAREAS TERMINADAS HOY
    ====================================== */}

<section
  style={{
    marginTop: "28px",
    padding: "20px",
    border: "1px solid #d8eadf",
    borderRadius: "16px",
    background: "#f7fcf9",
  }}
>
  <div
    style={{
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center",
      gap: "12px",
      flexWrap: "wrap",
      marginBottom: "16px",
    }}
  >
    <div>
      <div
        style={{
          color: "#28704a",
          fontSize: "12px",
          fontWeight: "900",
          letterSpacing: "1px",
          marginBottom: "4px",
        }}
      >
        CONTROL DE EJECUCIÓN
      </div>

      <h3
        style={{
          margin: 0,
          color: "#24352b",
          fontSize: "22px",
        }}
      >
        ✅ Terminadas hoy
      </h3>
    </div>

    <div
      style={{
        minWidth: "42px",
        height: "42px",
        padding: "0 12px",
        borderRadius: "999px",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "#dff3e6",
        color: "#28704a",
        fontWeight: "900",
        fontSize: "18px",
      }}
    >
      {
        tareasHistorial.filter(
          (tarea) =>
            tarea.estado === "terminada"
        ).length
      }
    </div>
  </div>

  {tareasHistorial.filter(
    (tarea) =>
      tarea.estado === "terminada"
  ).length === 0 ? (
    <div
      style={{
        padding: "18px",
        borderRadius: "12px",
        background: "#ffffff",
        border: "1px solid #e1eee6",
        color: "#6b7c71",
        textAlign: "center",
      }}
    >
      Todavía no hay tareas terminadas hoy.
    </div>
  ) : (
    <div
      style={{
        display: "grid",
        gap: "14px",
      }}
    >
      {tareasHistorial
        .filter(
          (tarea) =>
            tarea.estado === "terminada"
        )
        .map((tarea) => {
          const evidencias =
            evidenciasPorTarea[
              tarea.id
            ] || [];

          const fotoInicial =
            evidencias.find(
              (evidencia) =>
                evidencia.tipo ===
                "inicio"
            );

          const fotoFinal =
            evidencias.find(
              (evidencia) =>
                evidencia.tipo ===
                "final"
            );

          return (
            <article
              key={`terminada-${tarea.id}`}
              style={{
                padding: "16px",
                borderRadius: "14px",
                background: "#ffffff",
                border:
                  "1px solid #cfe6d7",
                boxShadow:
                  "0 5px 16px rgba(40,112,74,0.05)",
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent:
                    "space-between",
                  alignItems:
                    "flex-start",
                  gap: "12px",
                  flexWrap: "wrap",
                }}
              >
                <div
                  style={{
                    flex: "1 1 240px",
                  }}
                >
                  <strong
                    style={{
                      display: "block",
                      fontSize: "17px",
                      color: "#25332a",
                      marginBottom:
                        "7px",
                    }}
                  >
                    {tarea.titulo}
                  </strong>

                  <div
                    style={{
                      color: "#58675e",
                      fontSize: "14px",
                      lineHeight: 1.6,
                    }}
                  >
                    👤{" "}
                    <strong>
                      {tarea.responsable ||
                        "Sin responsable"}
                    </strong>
                  </div>

                  <div
                    style={{
                      color: "#58675e",
                      fontSize: "14px",
                      lineHeight: 1.6,
                    }}
                  >
                    🏢 {tarea.area}
                  </div>

                  <div
                    style={{
                      color: "#28704a",
                      fontSize: "14px",
                      fontWeight: "900",
                      lineHeight: 1.6,
                    }}
                  >
                    ✅ TERMINADA
                  </div>

                  {tarea.calificacion_final !=
                    null && (
                    <div
                      style={{
                        marginTop: "5px",
                        color: "#58675e",
                        fontSize: "14px",
                      }}
                    >
                      🤖 Calificación MONYS:{" "}
                      <strong>
                        {Number(
                          tarea.calificacion_final
                        ).toFixed(0)}
                        %
                      </strong>
                    </div>
                  )}

                  {tarea.evaluacion_resumen && (
                    <div
                      style={{
                        marginTop: "7px",
                        padding: "9px 11px",
                        borderRadius:
                          "10px",
                        background:
                          "#f5faf7",
                        color: "#52645a",
                        fontSize: "13px",
                        lineHeight: 1.45,
                      }}
                    >
                      🧠{" "}
                      {
                        tarea.evaluacion_resumen
                      }
                    </div>
                  )}
                </div>

                <div
                  style={{
                    padding: "7px 11px",
                    borderRadius:
                      "999px",
                    background:
                      "#e5f6eb",
                    color: "#28704a",
                    fontSize: "12px",
                    fontWeight: "900",
                  }}
                >
                  HECHO
                </div>
              </div>

              {(fotoInicial ||
                fotoFinal) && (
                <div
                  style={{
                    marginTop: "14px",
                    display: "grid",
                    gridTemplateColumns:
                      "repeat(auto-fit, minmax(140px, 1fr))",
                    gap: "10px",
                  }}
                >
                  {fotoInicial && (
                    <div>
                      <div
                        style={{
                          marginBottom:
                            "5px",
                          fontSize:
                            "12px",
                          fontWeight:
                            "800",
                          color:
                            "#6c5a63",
                        }}
                      >
                        📷 Antes
                      </div>

                      <img
                        src={
                          fotoInicial.archivo_url
                        }
                        alt="Evidencia inicial"
                        style={{
                          width: "100%",
                          maxWidth:
                            "260px",
                          height:
                            "170px",
                          objectFit:
                            "cover",
                          borderRadius:
                            "12px",
                          border:
                            "1px solid #ddd",
                        }}
                      />
                    </div>
                  )}

                  {fotoFinal && (
                    <div>
                      <div
                        style={{
                          marginBottom:
                            "5px",
                          fontSize:
                            "12px",
                          fontWeight:
                            "800",
                          color:
                            "#28704a",
                        }}
                      >
                        📸 Resultado final
                      </div>

                      <img
                        src={
                          fotoFinal.archivo_url
                        }
                        alt="Evidencia final"
                        style={{
                          width: "100%",
                          maxWidth:
                            "260px",
                          height:
                            "170px",
                          objectFit:
                            "cover",
                          borderRadius:
                            "12px",
                          border:
                            "1px solid #bddfc9",
                        }}
                      />
                    </div>
                  )}
                </div>
              )}

              <div
                style={{
                  marginTop: "14px",
                  display: "flex",
                  gap: "8px",
                  flexWrap: "wrap",
                }}
              >
                <button
                  type="button"
                  onClick={() =>
                    cambiarEstado(
                      tarea,
                      "pendiente"
                    )
                  }
                >
                  ↩ Reabrir
                </button>

                {tarea.evaluacion_estado !==
                  "analizando" && (
                  <button
                    type="button"
                    onClick={() =>
                      reintentarEvaluacion(
                        tarea
                      )
                    }
                  >
                    🤖 Reevaluar
                  </button>
                )}
              </div>
            </article>
          );
        })}
    </div>
  )}

  {tareasHistorial.some(
    (tarea) =>
      tarea.estado === "cancelada"
  ) && (
    <details
      style={{
        marginTop: "16px",
      }}
    >
      <summary
        style={{
          cursor: "pointer",
          color: "#777",
          fontWeight: "700",
        }}
      >
        Ver tareas canceladas
      </summary>

      <div
        style={{
          marginTop: "10px",
          display: "grid",
          gap: "8px",
        }}
      >
        {tareasHistorial
          .filter(
            (tarea) =>
              tarea.estado ===
              "cancelada"
          )
          .map((tarea) => (
            <div
              key={`cancelada-${tarea.id}`}
              style={{
                padding: "10px",
                background: "#fafafa",
                borderRadius:
                  "9px",
              }}
            >
              {tarea.titulo} ·{" "}
              {tarea.responsable}
            </div>
          ))}
      </div>
    </details>
  )}
</section>

    </section>
  );
}