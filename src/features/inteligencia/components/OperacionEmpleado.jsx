import {
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  obtenerTareasOperativas,
  obtenerCalendarioTareasOperativas,
  obtenerCorreccionesInventarioDisponibles,
  tomarCorreccionInventario,
  cambiarEstadoTareaOperativa,
  subirEvidenciaTarea,
  obtenerEvidenciasTarea,
  ejecutarEvaluacionTareaIA,
  guardarChecklistTarea,
  revisarContenidoMarketing,
  guardarResultadoMarketing,
} from "../services/tareasOperativasService";

import {
    analizarCampanaFinalizadaIA,
  actualizarCampanaMarketing,
  crearCampanaMarketing,
  generarEstrategiaCampanaIA,
  generarKitMarketingIA,
  guardarAprendizajeCampana,
  obtenerCampanasMarketing,
  obtenerContextoRealProductoCampana,
} from "../services/campanasMarketingService";

import {
  useUser,
} from "../../../context/UserContext";

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

function convertirFechaLocal(valor) {
  const [year, month, day] =
    String(valor || "")
      .split("-")
      .map(Number);

  if (!year || !month || !day) {
    return new Date();
  }

  return new Date(
    year,
    month - 1,
    day
  );
}

function formatearFechaLocal(fecha) {
  const year = fecha.getFullYear();

  const month = String(
    fecha.getMonth() + 1
  ).padStart(2, "0");

  const day = String(
    fecha.getDate()
  ).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function obtenerDiasSemana(
  fechaBase,
  desplazamientoSemanas = 0
) {
  const fecha =
    convertirFechaLocal(fechaBase);

  const numeroDia = fecha.getDay();

  const diferenciaLunes =
    numeroDia === 0
      ? -6
      : 1 - numeroDia;

  const lunes = new Date(fecha);

  lunes.setDate(
    fecha.getDate() +
      diferenciaLunes +
      desplazamientoSemanas * 7
  );

  return Array.from(
    {
      length: 7,
    },
    (_, indice) => {
      const dia = new Date(lunes);

      dia.setDate(
        lunes.getDate() + indice
      );

      return {
        fecha:
          formatearFechaLocal(dia),

        nombre: new Intl.DateTimeFormat(
          "es-MX",
          {
            weekday: "short",
          }
        )
          .format(dia)
          .replace(".", ""),

        numero: dia.getDate(),
      };
    }
  );
}

function etiquetaRangoSemana(
  diasSemana
) {
  const fechaInicial =
    convertirFechaLocal(
      diasSemana[0]?.fecha
    );

  const fechaFinal =
    convertirFechaLocal(
      diasSemana[
        diasSemana.length - 1
      ]?.fecha
    );

  const formato =
    new Intl.DateTimeFormat(
      "es-MX",
      {
        day: "numeric",
        month: "short",
      }
    );

  return `${formato.format(
    fechaInicial
  )} – ${formato.format(
    fechaFinal
  )}`;
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

function coincideResponsableUsuario(
  responsable,
  nombreUsuario
) {
  const responsableNormalizado =
    normalizarTexto(responsable);

  const usuarioNormalizado =
    normalizarTexto(nombreUsuario);

  if (
    !responsableNormalizado ||
    !usuarioNormalizado
  ) {
    return false;
  }

  if (
    responsableNormalizado ===
    usuarioNormalizado
  ) {
    return true;
  }

  const partesResponsable =
    responsableNormalizado.split(" ");

  const partesUsuario =
    usuarioNormalizado.split(" ");

  const apellidoResponsable =
    partesResponsable[
      partesResponsable.length - 1
    ];

  const apellidoUsuario =
    partesUsuario[
      partesUsuario.length - 1
    ];

  if (
    apellidoResponsable !==
    apellidoUsuario
  ) {
    return false;
  }

  const nombresResponsable =
    partesResponsable.slice(0, -1);

  const nombresUsuario =
    partesUsuario.slice(0, -1);

  return nombresResponsable.some(
    (nombreResponsable) =>
      nombresUsuario.some(
        (nombreCorto) =>
          nombreResponsable.length >=
            4 &&
          nombreCorto.length >= 4 &&
          (
            nombreResponsable.startsWith(
              nombreCorto
            ) ||
            nombreCorto.startsWith(
              nombreResponsable
            )
          )
      )
  );
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
    tareasCalendario,
    setTareasCalendario,
  ] = useState([]);

  const [
    desplazamientoSemana,
    setDesplazamientoSemana,
  ] = useState(0);

  const [
    tareaCalendarioAbiertaId,
    setTareaCalendarioAbiertaId,
  ] = useState(null);

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

  const diasSemana =
    useMemo(
      () =>
        obtenerDiasSemana(
          fechaHoy,
          desplazamientoSemana
        ),
      [
        fechaHoy,
        desplazamientoSemana,
      ]
    );

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
        registrosCalendario,
      ] = await Promise.all([
        obtenerTareasOperativas({
          branchId,
          fecha: fechaHoy,
        }),

        obtenerCorreccionesInventarioDisponibles({
          branchId,
          fecha: fechaHoy,
        }),

        obtenerCalendarioTareasOperativas({
          branchId,
          fechaInicio:
            diasSemana[0].fecha,
          fechaFin:
            diasSemana[
              diasSemana.length - 1
            ].fecha,
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
            tarea.estado !==
              "cancelada" &&
            coincideResponsableUsuario(
              tarea.responsable,
              usuario?.nombre
            )
        );

      const registrosCalendarioCompletos = [
        ...(registrosCalendario || []),
        ...(
          desplazamientoSemana === 0
            ? (registros || []).filter(
                (tareaHoy) =>
                  !(
                    registrosCalendario ||
                    []
                  ).some(
                    (tareaCalendario) =>
                      tareaCalendario.id ===
                      tareaHoy.id
                  )
              )
            : []
        ),
      ];

      const propiasCalendario =
        registrosCalendarioCompletos.filter(
          (tarea) =>
            tarea.estado !==
              "cancelada" &&
            coincideResponsableUsuario(
              tarea.responsable,
              usuario?.nombre
            )
        );

                  const tareasParaHoy = [
        ...propias,
        ...propiasCalendario.filter(
          (tarea) => {
           return (
  tarea.fecha === fechaHoy
);
          }
        ),
      ].filter(
        (
          tarea,
          indice,
          lista
        ) =>
          lista.findIndex(
            (elemento) =>
              elemento.id === tarea.id
          ) === indice
      );

      setTareas(
        tareasParaHoy
      );

      setTareasCalendario(
        propiasCalendario
      );

      const pares =
        await Promise.all(
          tareasParaHoy.map(

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
    diasSemana,
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
          (tarea) => {
            const estado =
              normalizarTexto(
                tarea.estado
              );

            return (
              estado ===
                "PENDIENTE" ||
              estado ===
                "EN_PROCESO" ||
              estado ===
                "ANALIZANDO"
            );
          }
        ),
      [tareas]
    );

  const terminadas =
    useMemo(
      () =>
        tareas.filter(
          (tarea) =>
            normalizarTexto(
              tarea.estado
            ) === "TERMINADA"
        ),
      [tareas]
    );

  const pendientes =
    activas.filter(
      (tarea) =>
        normalizarTexto(
          tarea.estado
        ) === "PENDIENTE"
    ).length;

  const enProceso =
    activas.filter(
      (tarea) => {
        const estado =
          normalizarTexto(
            tarea.estado
          );

        return (
          estado ===
            "EN_PROCESO" ||
          estado ===
            "ANALIZANDO"
        );
      }
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
      : 0;

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

      {/* CALENDARIO SEMANAL DE MARKETING */}

      <div
        style={{
          marginBottom: "20px",
          padding: "15px",
          borderRadius: "18px",
          border:
            "1px solid #ead7e1",
          background:
            "linear-gradient(180deg, #fffafd 0%, #ffffff 100%)",
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent:
              "space-between",
            alignItems: "center",
            gap: "10px",
            marginBottom: "12px",
          }}
        >
          <div>
            <h3
              style={{
                margin: 0,
                color: "#7d3157",
                fontSize: "18px",
              }}
            >
              📅 Tu semana de marketing
            </h3>

            <div
              style={{
                marginTop: "4px",
                color: "#806d76",
                fontSize: "12px",
              }}
            >
              Tareas reales programadas
              para esta semana
            </div>
          </div>

          <span
            style={{
              minWidth: "30px",
              height: "30px",
              padding: "0 9px",
              borderRadius: "999px",
              display: "inline-flex",
              alignItems: "center",
              justifyContent:
                "center",
              background: "#f9e6ef",
              color: "#8f2858",
              fontWeight: "900",
              fontSize: "13px",
            }}
          >
            {tareasCalendario.length}
          </span>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns:
              "auto minmax(0, 1fr) auto",
            alignItems: "center",
            gap: "8px",
            marginBottom: "12px",
          }}
        >
          <button
            type="button"
            onClick={() =>
              setDesplazamientoSemana(
                (actual) =>
                  actual - 1
              )
            }
            style={{
              border:
                "1px solid #e5cad7",
              borderRadius: "10px",
              background: "#ffffff",
              color: "#8f2858",
              padding: "9px 11px",
              fontWeight: "900",
              cursor: "pointer",
            }}
          >
            ‹
          </button>

          <button
            type="button"
            onClick={() =>
              setDesplazamientoSemana(0)
            }
            style={{
              border: "none",
              borderRadius: "10px",
              background:
                desplazamientoSemana ===
                0
                  ? "#f8e5ee"
                  : "#f8f4f6",
              color: "#6f3651",
              padding: "9px 8px",
              fontWeight: "800",
              cursor: "pointer",
              minWidth: 0,
            }}
          >
            {desplazamientoSemana === 0
              ? "Esta semana"
              : desplazamientoSemana ===
                  1
                ? "Próxima semana"
                : desplazamientoSemana ===
                    -1
                  ? "Semana anterior"
                  : "Semana seleccionada"}
            <span
              style={{
                display: "block",
                marginTop: "2px",
                fontSize: "11px",
                fontWeight: "700",
                color: "#957987",
              }}
            >
              {etiquetaRangoSemana(
                diasSemana
              )}
            </span>
          </button>

          <button
            type="button"
            onClick={() =>
              setDesplazamientoSemana(
                (actual) =>
                  actual + 1
              )
            }
            style={{
              border:
                "1px solid #e5cad7",
              borderRadius: "10px",
              background: "#ffffff",
              color: "#8f2858",
              padding: "9px 11px",
              fontWeight: "900",
              cursor: "pointer",
            }}
          >
            ›
          </button>
        </div>

        <div
          style={{
            display: "grid",
            gap: "8px",
          }}
        >
          {diasSemana.map((dia) => {
            const esHoy =
              dia.fecha === fechaHoy;

            const tareasDia =
              tareasCalendario.filter(
                (tarea) => {
                  const esPendienteAnterior =
                    Boolean(
                      tarea.fecha
                    ) &&
                    tarea.fecha <
                      diasSemana[0].fecha &&
                    [
                      "pendiente",
                      "en_proceso",
                      "analizando",
                    ].includes(
                      tarea.estado
                    );

                  return (
                    tarea.fecha ===
                      dia.fecha ||
                    (
                      esHoy &&
                      esPendienteAnterior
                    )
                  );
                }
              );

            return (
              <div
                key={dia.fecha}
                style={{
                  display: "grid",
                  gridTemplateColumns:
                    "54px minmax(0, 1fr)",
                  gap: "10px",
                  padding: "10px",
                  borderRadius: "14px",
                  border: esHoy
                    ? "2px solid #cf4f86"
                    : "1px solid #eee2e8",
                  background: esHoy
                    ? "#fff3f8"
                    : "#ffffff",
                }}
              >
                <div
                  style={{
                    textAlign: "center",
                  }}
                >
                  <div
                    style={{
                      color: esHoy
                        ? "#a91f5d"
                        : "#8b7580",
                      fontSize: "11px",
                      fontWeight: "900",
                      textTransform:
                        "uppercase",
                    }}
                  >
                    {esHoy
                      ? "Hoy"
                      : dia.nombre}
                  </div>

                  <div
                    style={{
                      color: "#2a1d24",
                      fontSize: "21px",
                      fontWeight: "900",
                    }}
                  >
                    {dia.numero}
                  </div>
                </div>

                <div
                  style={{
                    display: "grid",
                    gap: "7px",
                    minWidth: 0,
                  }}
                >
                  {tareasDia.length ===
                  0 ? (
                    <div
                      style={{
                        alignSelf:
                          "center",
                        color: "#a08e97",
                        fontSize: "12px",
                      }}
                    >
                      Sin tareas programadas
                    </div>
                  ) : (
                    tareasDia.map(
                      (tarea) => (
                        <button
                          type="button"
                          key={tarea.id}
                          onClick={() =>
                            setTareaCalendarioAbiertaId(
                              (actual) =>
                                actual ===
                                tarea.id
                                  ? null
                                  : tarea.id
                            )
                          }
                          style={{
                            width: "100%",
                            padding:
                              "8px 9px",
                            border: "none",
                            borderRadius:
                              "10px",
                            textAlign: "left",
                            fontFamily:
                              "inherit",
                            cursor:
                              "pointer",
                            background:
                              tarea.estado ===
                              "terminada"
                                ? "#eaf8ef"
                                : tarea.estado ===
                                    "en_proceso"
                                  ? "#fff5dc"
                                  : "#f8edf3",
                          }}
                        >
                          <strong
                            style={{
                              display:
                                "block",
                              color:
                                "#3a2931",
                              fontSize:
                                "13px",
                              lineHeight:
                                1.35,
                            }}
                          >
                            {tarea.titulo}
                          </strong>

                          <div
                            style={{
                              marginTop:
                                "3px",
                              color:
                                "#806d76",
                              fontSize:
                                "11px",
                            }}
                          >
                            {Boolean(
                              tarea.fecha
                            ) &&
                            tarea.fecha <
                              diasSemana[0]
                                .fecha
                              ? "⚠️ Pendiente anterior · "
                              : ""}

                            {tarea.hora_limite
                              ? `⏰ ${tarea.hora_limite} · `
                              : ""}

                            {etiquetaEstado(
                              tarea.estado
                            )}
                          </div>

                          <div
                            style={{
                              marginTop:
                                "5px",
                              color:
                                "#9b235b",
                              fontSize:
                                "11px",
                              fontWeight:
                                "800",
                            }}
                          >
                            {tareaCalendarioAbiertaId ===
                            tarea.id
                              ? "Ocultar detalle ▲"
                              : "Ver detalle ▼"}
                          </div>

                          {tareaCalendarioAbiertaId ===
                            tarea.id && (
                            <div
                              style={{
                                marginTop:
                                  "8px",
                                padding:
                                  "9px",
                                borderRadius:
                                  "9px",
                                background:
                                  "#ffffff",
                                border:
                                  "1px solid #ead6e0",
                                color:
                                  "#493740",
                                fontSize:
                                  "12px",
                                lineHeight:
                                  1.5,
                              }}
                            >
                              {tarea.descripcion && (
                                <div
                                  style={{
                                    marginBottom:
                                      "7px",
                                  }}
                                >
                                  {tarea.descripcion}
                                </div>
                              )}

                              {tarea.instrucciones && (
                                <div
                                  style={{
                                    whiteSpace:
                                      "pre-line",
                                    fontWeight:
                                      "700",
                                  }}
                                >
                                  {tarea.instrucciones}
                                </div>
                              )}

                              {tarea.criterio_exito && (
                                <div
                                  style={{
                                    marginTop:
                                      "8px",
                                    paddingTop:
                                      "7px",
                                    borderTop:
                                      "1px solid #eee2e8",
                                  }}
                                >
                                  <strong>
                                    Resultado esperado:
                                  </strong>{" "}
                                  {tarea.criterio_exito}
                                </div>
                              )}
                            </div>
                          )}
                        </button>
                      )
                    )
                  )}
                </div>
              </div>
            );
          })}
        </div>
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
  checklistInicial={tarea.checklist}
/>
)}

 {normalizarTexto(tarea.area) ===
  "MARKETING" &&
  !normalizarTexto(
    tarea.titulo
  ).includes(
    "DAR SEGUIMIENTO A CAMPANA SIN AVANCES"
  ) && (
    <RevisionMarketingTarea
      tarea={tarea}
    />
  )}

{normalizarTexto(tarea.area) ===
  "MARKETING" &&
  !normalizarTexto(
    tarea.titulo
  ).includes(
    "DAR SEGUIMIENTO A CAMPANA SIN AVANCES"
  ) && (
    <ResultadoMarketingTarea
      tarea={tarea}
    />
  )}

{normalizarTexto(tarea.area) ===
  "MARKETING" && (
 <CrearCampanaMarketingTarea
  tarea={tarea}
  branchId={branchId}
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
  checklistInicial = [],
}) {
  const pasos = String(
    instrucciones || ""
  )
    .split("\n")
    .map((paso) =>
      paso
        .replace(/^☐\s*/, "")
        .replace(/^-\s*/, "")
        .trim()
    )
    .filter(Boolean);

  const claveStorage =
    `monys-checklist-${tareaId}`;

  const obtenerIniciales = () => {
    // PRIMERO: usar Supabase
    if (
      Array.isArray(checklistInicial) &&
      checklistInicial.length > 0
    ) {
      return pasos.map(
        (_, indice) =>
          Boolean(
            checklistInicial[
              indice
            ]?.completado
          )
      );
    }

    // RESPALDO: localStorage
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
        "No fue posible recuperar checklist local:",
        error
      );
    }

    return pasos.map(
      () => false
    );
  };

  const [
    completados,
    setCompletados,
  ] = useState(
    obtenerIniciales
  );

  const [
    guardandoChecklist,
    setGuardandoChecklist,
  ] = useState(false);

  const [
    errorChecklist,
    setErrorChecklist,
  ] = useState("");

  async function cambiarPaso(
    indice
  ) {
    const nuevos =
      [...completados];

    nuevos[indice] =
      !nuevos[indice];

    // Cambio inmediato en pantalla
    setCompletados(
      nuevos
    );

    setErrorChecklist("");

    // Respaldo local
    try {
      localStorage.setItem(
        claveStorage,
        JSON.stringify(
          nuevos
        )
      );
    } catch (error) {
      console.error(
        "No fue posible guardar checklist local:",
        error
      );
    }

    // Preparar estructura para Supabase
    const checklistParaGuardar =
      pasos.map(
        (
          paso,
          indicePaso
        ) => ({
          id:
            indicePaso,

          texto:
            paso,

          completado:
            Boolean(
              nuevos[
                indicePaso
              ]
            ),
        })
      );

    try {
      setGuardandoChecklist(
        true
      );

      await guardarChecklistTarea({
        tareaId,
        checklist:
          checklistParaGuardar,
      });
    } catch (error) {
      console.error(
        "No fue posible guardar checklist en MONYS:",
        error
      );

      setErrorChecklist(
        "No se pudo sincronizar. MONYS lo intentará cuando vuelvas a marcar."
      );
    } finally {
      setGuardandoChecklist(
        false
      );
    }
  }

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
          display:
            "flex",
          justifyContent:
            "space-between",
          alignItems:
            "center",
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

      {guardandoChecklist && (
        <div
          style={{
            marginTop:
              "10px",
            textAlign:
              "center",
            fontSize:
              "12px",
            color:
              "#876875",
          }}
        >
          ☁️ Guardando progreso...
        </div>
      )}

      {errorChecklist && (
        <div
          style={{
            marginTop:
              "10px",
            padding:
              "8px",
            borderRadius:
              "9px",
            background:
              "#fff3f3",
            color:
              "#a03c3c",
            fontSize:
              "12px",
            textAlign:
              "center",
          }}
        >
          ⚠️ {errorChecklist}
        </div>
      )}

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

function RevisionMarketingTarea({
  tarea,
}) {
  const [
    contenido,
    setContenido,
  ] = useState("");

  const [
    revisando,
    setRevisando,
  ] = useState(false);

  const [
    evaluacion,
    setEvaluacion,
  ] = useState(null);

  const [
    errorRevision,
    setErrorRevision,
  ] = useState("");

  async function revisar() {
    const texto =
      String(contenido || "").trim();

    if (!texto) {
      setErrorRevision(
        "Pega el texto, guion o idea que quieres publicar."
      );

      return;
    }

    try {
      setRevisando(true);
      setErrorRevision("");
      setEvaluacion(null);

      const resultado =
        await revisarContenidoMarketing({

                texto,
    });

      setEvaluacion(resultado);
    } catch (error) {
      console.error(
        "Error revisando marketing:",
        error
      );

      setErrorRevision(
        error?.message ||
          "MONYS no pudo revisar el contenido."
      );
    } finally {
      setRevisando(false);
    }
  }

  const decision =
    evaluacion?.decision || "";

  const publicar =
    decision === "PUBLICAR";

  const cambios =
    Array.isArray(
      evaluacion?.cambios
    )
      ? evaluacion.cambios.slice(
          0,
          3
        )
      : [];

  return (
    <div
      style={{
        marginBottom: "16px",
        padding: "14px",
        borderRadius: "14px",
        border:
          "1px solid #e8d1dc",
        background: "#fffafd",
      }}
    >
      <strong
        style={{
          display: "block",
          color: "#72274e",
          marginBottom: "5px",
        }}
      >
        ✨ Revisión antes de publicar
      </strong>

      <div
        style={{
          fontSize: "12px",
          color: "#806d76",
          marginBottom: "10px",
        }}
      >
        Pega tu texto, guion o idea.
        MONYS solo te pedirá cambios
        si realmente pueden mejorar
        el resultado.
      </div>

      <textarea
        value={contenido}
        onChange={(event) =>
          setContenido(
            event.target.value
          )
        }
        placeholder="Ejemplo: Esta base cubre muchísimo... Mándanos mensaje para encontrar tu tono."
        rows={5}
        style={{
          width: "100%",
          boxSizing:
            "border-box",
          border:
            "1px solid #ddcad4",
          borderRadius:
            "11px",
          padding: "11px",
          resize: "vertical",
          fontFamily:
            "inherit",
          fontSize: "14px",
        }}
      />

      <button
        type="button"
        onClick={revisar}
        disabled={
          revisando ||
          !contenido.trim()
        }
        style={{
          width: "100%",
          marginTop: "10px",
          border: "none",
          borderRadius: "11px",
          padding: "12px",
          background:
            revisando ||
            !contenido.trim()
              ? "#dac5cf"
              : "#8f2858",
          color: "#ffffff",
          fontWeight: "900",
          cursor:
            revisando ||
            !contenido.trim()
              ? "not-allowed"
              : "pointer",
        }}
      >
        {revisando
          ? "🧠 MONYS revisando..."
          : "✨ Revisar con MONYS"}
      </button>

      {errorRevision && (
        <div
          style={{
            marginTop: "10px",
            padding: "9px",
            borderRadius: "9px",
            background: "#fff1f1",
            color: "#a03c3c",
            fontSize: "12px",
          }}
        >
          ⚠️ {errorRevision}
        </div>
      )}

      {evaluacion && (
        <div
          style={{
            marginTop: "12px",
            padding: "12px",
            borderRadius: "12px",
            background: publicar
              ? "#edf8f1"
              : "#fff7e8",
            border: publicar
              ? "1px solid #b7dfc8"
              : "1px solid #efd6a8",
          }}
        >
          <div
            style={{
              fontSize: "18px",
              fontWeight: "900",
              color: publicar
                ? "#28704a"
                : "#9a6200",
            }}
          >
            {publicar
              ? "✅ PUBLICA"
              : "⚠️ MEJORA ESTO"}
          </div>

          <div
            style={{
              marginTop: "6px",
              fontSize: "13px",
            }}
          >
            🎯{" "}
            {evaluacion.objetivoDetectado ||
              "Objetivo"}
            {" · "}
            {evaluacion.puntaje ??
              "--"}
            /100
          </div>

          {evaluacion.resumen && (
            <div
              style={{
                marginTop: "8px",
                fontSize: "13px",
              }}
            >
              {evaluacion.resumen}
            </div>
          )}

          {cambios.length > 0 && (
            <div
              style={{
                marginTop: "10px",
              }}
            >
              <strong>
                Cambia solamente esto:
              </strong>

              {cambios.map(
                (
                  cambio,
                  indice
                ) => (
                  <div
                    key={indice}
                    style={{
                      marginTop:
                        "6px",
                      fontSize:
                        "13px",
                    }}
                  >
                    {indice + 1}.{" "}
                    {cambio}
                  </div>
                )
              )}
            </div>
          )}

          {!publicar &&
            evaluacion.ganchoSugerido && (
              <div
                style={{
                  marginTop:
                    "10px",
                  padding: "9px",
                  borderRadius:
                    "9px",
                  background:
                    "#ffffff",
                  fontSize:
                    "13px",
                }}
              >
                <strong>
                  💡 Gancho sugerido:
                </strong>
                <br />
                {
                  evaluacion.ganchoSugerido
                }
              </div>
            )}

          {!publicar &&
            evaluacion.ctaSugerido && (
              <div
                style={{
                  marginTop:
                    "8px",
                  padding: "9px",
                  borderRadius:
                    "9px",
                  background:
                    "#ffffff",
                  fontSize:
                    "13px",
                }}
              >
                <strong>
                  👉 CTA sugerido:
                </strong>
                <br />
                {
                  evaluacion.ctaSugerido
                }
              </div>
            )}

          {publicar && (
            <div
              style={{
                marginTop: "10px",
                fontWeight: "900",
                color: "#28704a",
                fontSize: "13px",
              }}
            >
              No le muevas más.
              Publícalo y mide el
              resultado.
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function ResultadoMarketingTarea({
  tarea,
}) {
  const [
    canal,
    setCanal,
  ] = useState("");

  const [
    alcance,
    setAlcance,
  ] = useState("");

  const [
    leads,
    setLeads,
  ] = useState("");

  const [
    ventas,
    setVentas,
  ] = useState("");

  const [
    monto,
    setMonto,
  ] = useState("");

  const [
    observacion,
    setObservacion,
  ] = useState("");

  return (
    <div
      style={{
        marginBottom: "16px",
        padding: "14px",
        borderRadius: "14px",
        border:
          "1px solid #d9e2df",
        background: "#f8fcfa",
      }}
    >
      <strong
        style={{
          display: "block",
          color: "#2d6b54",
          marginBottom: "5px",
        }}
      >
        📊 Registrar resultado
      </strong>

      <div
        style={{
          fontSize: "12px",
          color: "#6d7c75",
          marginBottom: "10px",
        }}
      >
        Toma menos de un minuto.
        Registra solo lo importante para
        saber qué contenido sí produce
        resultados.
      </div>

      <div
        style={{
          display: "grid",
          gap: "9px",
        }}
      >
        <select
          value={canal}
          onChange={(event) =>
            setCanal(
              event.target.value
            )
          }
          style={{
            padding: "10px",
            borderRadius: "10px",
            border:
              "1px solid #cedbd5",
            fontFamily: "inherit",
          }}
        >
          <option value="">
            Selecciona canal
          </option>

          <option value="TikTok">
            TikTok
          </option>

          <option value="Instagram">
            Instagram
          </option>

          <option value="Facebook">
            Facebook
          </option>

          <option value="TikTok Shop">
            TikTok Shop
          </option>

          <option value="Mercado Libre">
            Mercado Libre
          </option>

          <option value="ChatGPT Ads">
            ChatGPT Ads
          </option>

          <option value="Otro">
            Otro
          </option>
        </select>

        <input
          type="number"
          min="0"
          value={alcance}
          onChange={(event) =>
            setAlcance(
              event.target.value
            )
          }
          placeholder="Vistas o alcance"
          style={estiloInputMarketing}
        />

        <input
          type="number"
          min="0"
          value={leads}
          onChange={(event) =>
            setLeads(
              event.target.value
            )
          }
          placeholder="Mensajes o leads"
          style={estiloInputMarketing}
        />

        <input
          type="number"
          min="0"
          value={ventas}
          onChange={(event) =>
            setVentas(
              event.target.value
            )
          }
          placeholder="Ventas generadas"
          style={estiloInputMarketing}
        />

        <input
          type="number"
          min="0"
          step="0.01"
          value={monto}
          onChange={(event) =>
            setMonto(
              event.target.value
            )
          }
          placeholder="Monto vendido $"
          style={estiloInputMarketing}
        />

        <textarea
          value={observacion}
          onChange={(event) =>
            setObservacion(
              event.target.value
            )
          }
          placeholder="Observación rápida: qué funcionó, qué preguntaron o qué mejorar."
          rows={3}
          style={{
            ...estiloInputMarketing,
            resize: "vertical",
          }}
        />
      </div>

     <button
  type="button"
  onClick={async () => {
    try {
      if (!canal) {
        alert(
          "Selecciona el canal."
        );
        return;
      }

      await guardarResultadoMarketing({
        tareaId: tarea.id,
        canal,
        alcance,
        leads,
        ventas,
        monto,
        observacion,
      });

      alert(
        "Resultado de marketing guardado."
      );
    } catch (error) {
      console.error(
        "Error guardando resultado de marketing:",
        error
      );

      alert(
        error?.message ||
          "MONYS no pudo guardar el resultado."
      );
    }
  }}
  style={{
    width: "100%",
    marginTop: "10px",
    border: "none",
    borderRadius: "11px",
    padding: "12px",
    background: "#2f8a5d",
    color: "#ffffff",
    fontWeight: "900",
    cursor: "pointer",
  }}
>
  💾 Guardar resultado
</button>


    </div>
  );
}

function CrearCampanaMarketingTarea({
  tarea,
  branchId,
}) {

    const {
    usuario,
  } = useUser();

  const [
    objetivoUsuario,
    setObjetivoUsuario,
  ] = useState("");

  const [
    producto,
    setProducto,
  ] = useState("");

  const [
    canalPreferido,
    setCanalPreferido,
  ] = useState("");

   const [
    presupuestoMaximo,
    setPresupuestoMaximo,
  ] = useState("");

  const [
    precioProducto,
    setPrecioProducto,
  ] = useState("");

    const [
    existenciaProducto,
    setExistenciaProducto,
  ] = useState("");

  const [
    audienciaProducto,
    setAudienciaProducto,
  ] = useState("");

  const [
    ofertaProducto,
    setOfertaProducto,
  ] = useState("");

  const [
    kitMarketing,
    setKitMarketing,
  ] = useState(null);

  const [
    generandoKit,
    setGenerandoKit,
  ] = useState(false);

  const [
    generando,
    setGenerando,
  ] = useState(false);

  const [
    estrategia,
    setEstrategia,
  ] = useState(null);

  const [
  campanaGuardada,
  setCampanaGuardada,
] = useState(null);

const [
  activandoCampana,
  setActivandoCampana,
] = useState(false);

const [
  gastoCampana,
  setGastoCampana,
] = useState("");

const [
  pedidosCampana,
  setPedidosCampana,
] = useState("");

const [
  ventaCampana,
  setVentaCampana,
] = useState("");

const [
  guardandoSeguimiento,
  setGuardandoSeguimiento,
] = useState(false);

const [
  cerrandoCampana,
  setCerrandoCampana,
] = useState(false);

const [
  mensajeSeguimiento,
  setMensajeSeguimiento,
] = useState("");

  const [
    errorCampana,
    setErrorCampana,
  ] = useState("");

  useEffect(() => {
  let componenteActivo =
    true;

  async function cargarUltimaCampana() {
    if (
      !usuario?.organization_id ||
      !usuario?.business_id
    ) {
      return;
    }

    try {
      const campanas =
        await obtenerCampanasMarketing({
          organizationId:
            usuario.organization_id,

          businessId:
            usuario.business_id,

          branchId:
            branchId || null,
        });

      const ultimaCampana =
        campanas?.[0] ||
        null;

    if (
  componenteActivo &&
  ultimaCampana
) {
  setCampanaGuardada(
    ultimaCampana
  );

  if (
    ultimaCampana?.estrategia_ia
  ) {
    setEstrategia(
      ultimaCampana.estrategia_ia
    );
  }
}

    } catch (error) {
      console.error(
        "Error cargando la última campaña:",
        error
      );
    }
  }

  cargarUltimaCampana();

  return () => {
    componenteActivo =
      false;
  };
}, [
  usuario?.organization_id,
  usuario?.business_id,
  branchId,
]);

async function generarKit() {
  try {
    setErrorCampana("");
    setKitMarketing(null);

    if (
      !String(producto || "").trim() ||
      !String(objetivoUsuario || "").trim() ||
      !String(precioProducto || "").trim() ||
      !String(existenciaProducto || "").trim() ||
      !String(audienciaProducto || "").trim() ||
      !String(ofertaProducto || "").trim()
    ) {
      setErrorCampana(
        "Para generar el kit captura producto, objetivo, precio, existencia, cliente ideal y oferta real."
      );
      return;
    }

    setGenerandoKit(true);

    const contextoReal =
      await obtenerContextoRealProductoCampana({
        branchId,
        producto,
      });

    const kit = await generarKitMarketingIA({
      negocio: {
        nombre: "Monys Glam",
        sucursalId: branchId || null,
      },

      producto: {
        nombre: producto.trim(),
        precio: Number(precioProducto),
        existencia: Number(existenciaProducto),
      },

      estrategia: {
        objetivo: objetivoUsuario.trim(),
        audiencia: audienciaProducto.trim(),
        oferta: ofertaProducto.trim(),
      },

      campana: {
        canalPrincipal: canalPreferido || null,
        presupuesto: Number(
          presupuestoMaximo || 0
        ),
      },

      canales: canalPreferido
        ? [canalPreferido]
        : undefined,

      datosReales: {
        fuenteCaptura: "KARY",
        productoBuscado: producto.trim(),

        contextoSupabase: {
          encontrado:
            contextoReal?.encontrado || false,

          ventas:
            contextoReal?.ventas || {},

          inventario:
            contextoReal?.inventario || {},

          periodo:
            contextoReal?.periodo || null,

          fuentes:
            contextoReal?.fuentes || {},

          confianzaCoincidencia:
            contextoReal
              ?.confianzaCoincidencia || 0,

          confianzaDatos:
            contextoReal?.confianzaDatos || 0,
        },
      },

      notas: `Tarea actual: ${
        tarea?.titulo || ""
      }. Sucursal: ${
        branchId || "no identificada"
      }. MONYS debe usar únicamente datos reales y marcar cualquier estimación o hipótesis.`,
    });

    setKitMarketing(kit);
  } catch (error) {
    console.error(
      "Error generando kit de marketing:",
      error
    );

    setErrorCampana(
      error?.message ||
        "MONYS no pudo generar el kit de publicación."
    );
  } finally {
    setGenerandoKit(false);
  }
}

  async function generar() {
    try {
      setErrorCampana("");
      setEstrategia(null);

      if (
        !String(
          objetivoUsuario || ""
        ).trim()
      ) {
        setErrorCampana(
          "Escribe qué quieres lograr."
        );
        return;
      }

      setGenerando(true);

       const contextoReal =
  await obtenerContextoRealProductoCampana({
    branchId,
    producto,
  });

const resultado =
  await generarEstrategiaCampanaIA({
    objetivoUsuario,
    producto,
    canalPreferido,
    presupuestoMaximo,

    inventarioDisponible:
      contextoReal?.inventario
        ?.existencia ?? 0,

    margenEstimado:
      contextoReal?.ventas
        ?.margenReal ?? 0,

    contextoNegocio:
      "Monys Glam vende cosméticos. La campaña debe buscar resultados reales, proteger la utilidad y evitar trabajo innecesario.",


     datosVentas:
  JSON.stringify({
    productoEncontrado:
      contextoReal?.encontrado ||
      false,

    productoBuscado:
      contextoReal
        ?.productoBuscado ||
      producto,

    piezasVendidas:
      contextoReal?.ventas
        ?.piezas ?? 0,

    importeVendido:
      contextoReal?.ventas
        ?.importe ?? 0,

    costo:
      contextoReal?.ventas
        ?.costo ?? 0,

    utilidad:
      contextoReal?.ventas
        ?.utilidad ?? 0,

    margenReal:
      contextoReal?.ventas
        ?.margenReal ?? null,

    periodo:
      contextoReal?.periodo ||
      null,

    variantes:
      contextoReal?.ventas
        ?.variantes || [],

    confianzaCoincidencia:
      contextoReal
        ?.confianzaCoincidencia ??
      0,

    confianzaDatos:
      contextoReal
        ?.confianzaDatos ?? 0,
  }),

datosInventario:
  JSON.stringify({
    existencia:
      contextoReal?.inventario
        ?.existencia ?? 0,

    valorInventario:
      contextoReal?.inventario
        ?.valorInventario ?? 0,

    ventaDiaria:
      contextoReal?.inventario
        ?.ventaDiaria ?? 0,

    diasCobertura:
      contextoReal?.inventario
        ?.diasCobertura ?? null,

    variantes:
      (
        contextoReal?.inventario
          ?.variantes || []
      ).map((item) => ({
        codigo:
          item?.codigo || null,

        nombre:
          item?.nombre ||
          item?.descripcion ||
          "",

        existencia:
          Number(
            item?.existencia || 0
          ),

        valorInventario:
          Number(
            item?.valorInventario || 0
          ),
      })),

    fuentes:
      contextoReal?.fuentes ||
      {},
  }),

      canalesNegocio:
  JSON.stringify({
    tiktok: {
      estado: "confirmado",
      usuario: "@monysglamshop",
      enlace:
        "https://www.tiktok.com/@monysglamshop",
      metricasDisponibles: false,
    },

    tiktokShop: {
      estado: "confirmado",
      enlace:
        "https://vt.tiktok.com/ZSqdFVtMk/?page=TikTokShop",
      metricasDisponibles: false,
    },

    instagram: {
      estado: "confirmado",
      usuario: "@monysglamshop",
      enlace:
        "https://www.instagram.com/monysglamshop/",
      metricasDisponibles: false,
    },

    facebook: {
      estado: "confirmado",
      enlaces: [
        "https://www.facebook.com/share/19U7TBfAM8/",
        "https://www.facebook.com/share/1Hy6eff8cV/",
      ],
      metricasDisponibles: false,
    },

    tiendaWeb: {
      estado: "confirmado",
      enlace:
        "https://monyscosmeticos.com/",
      metricasDisponibles: false,
    },

    mercadoLibre: {
      estado: "por_confirmar",
      enlace: null,
      metricasDisponibles: false,
    },
  }),


       notas:
      `Tarea actual: ${
        tarea?.titulo || ""
      }. Sucursal analizada: ${
        branchId || "no identificada"
      }.`,
  });

    const campanaCreada =
  await crearCampanaMarketing({
  organizationId:
  usuario?.organization_id ||
  null,

businessId:
  usuario?.business_id ||
  null,

  branchId:
    branchId || null,

  nombre:
    resultado?.nombre ||
    `Campaña ${producto}`,

  objetivo:
    resultado?.objetivo ||
    "VENTAS",

  canalPrincipal:
    resultado?.canalPrincipal ||
    canalPreferido ||
    "",

  producto:
    resultado?.producto ||
    producto ||
    "",

  problemaOportunidad:
    resultado?.problemaOportunidad ||
    resultado?.diagnostico ||
    "",

  hipotesis:
    resultado?.hipotesis ||
    "",

  audiencia:
    resultado?.audiencia ||
    "",

  oferta:
    resultado?.oferta ||
    "",

  gancho:
    resultado?.gancho ||
    "",

  mensaje:
    resultado?.mensaje ||
    "",

  cta:
    resultado?.cta ||
    "",

  presupuesto:
    resultado?.presupuestoInicial ||
    0,

  estrategiaIA:
    resultado,

  confianzaIA:
    resultado?.confianza ||
    0,

  decisionIA:
    resultado?.decision ||
    "",
});

 setCampanaGuardada(
  campanaCreada
);

setEstrategia(
  resultado
);

    } catch (error) {
      console.error(
        "Error creando campaña con MONYS:",
        error
      );

      setErrorCampana(
        error?.message ||
          "MONYS no pudo crear la campaña."
      );
    } finally {
      setGenerando(false);
    }
  }

   async function activarCampana() {
  if (!campanaGuardada?.id) {
    setErrorCampana(
      "No se encontró la campaña guardada."
    );
    return;
  }

  try {
    setActivandoCampana(true);
    setErrorCampana("");

    const campanaActualizada =
      await actualizarCampanaMarketing(
        campanaGuardada.id,
        {
          estado: "ACTIVA",

          fecha_inicio:
            obtenerFechaHoy(),
        }
      );

    setCampanaGuardada(
      campanaActualizada
    );
  } catch (error) {
    console.error(
      "Error activando campaña:",
      error
    );

    setErrorCampana(
      error?.message ||
        "MONYS no pudo activar la campaña."
    );
  } finally {
    setActivandoCampana(false);
  }
}

async function guardarSeguimientoCampana() {
  if (!campanaGuardada?.id) {
    setErrorCampana(
      "No se encontró la campaña activa."
    );
    return;
  }

  const gastoNuevo =
    Number(gastoCampana || 0);

  const pedidosNuevos =
    Number(pedidosCampana || 0);

  const ventaNueva =
    Number(ventaCampana || 0);

  if (
    gastoNuevo < 0 ||
    pedidosNuevos < 0 ||
    ventaNueva < 0
  ) {
    setErrorCampana(
      "Los resultados no pueden ser negativos."
    );
    return;
  }

  if (
    gastoNuevo === 0 &&
    pedidosNuevos === 0 &&
    ventaNueva === 0
  ) {
    setErrorCampana(
      "Registra al menos un resultado."
    );
    return;
  }

  const gastoAcumuladoActual =
    Number(
      campanaGuardada?.resultado
        ?.gastoAcumulado || 0
    );

  const presupuestoAutorizado =
    Number(
      campanaGuardada?.presupuesto || 0
    );

  const gastoProyectado =
    gastoAcumuladoActual +
    gastoNuevo;

  if (
    presupuestoAutorizado > 0 &&
    gastoProyectado >
      presupuestoAutorizado
  ) {
    setErrorCampana(
      `Este avance llevaría el gasto acumulado a $${gastoProyectado.toFixed(
        2
      )}, por encima del presupuesto autorizado de $${presupuestoAutorizado.toFixed(
        2
      )}. Solicita autorización del dueño antes de gastar más.`
    );
    return;
  }

  try {
    setGuardandoSeguimiento(true);
    setErrorCampana("");
    setMensajeSeguimiento("");

    const resultadoAnterior =
      campanaGuardada?.resultado ||
      {};

    const gastoAcumulado =
      Number(
        resultadoAnterior
          ?.gastoAcumulado || 0
      ) + gastoNuevo;

    const pedidosAcumulados =
      Number(
        resultadoAnterior
          ?.pedidosAcumulados || 0
      ) + pedidosNuevos;

    const ventaAcumulada =
      Number(
        resultadoAnterior
          ?.ventaAcumulada || 0
      ) + ventaNueva;

    const costoPorPedido =
      pedidosAcumulados > 0
        ? gastoAcumulado /
          pedidosAcumulados
        : null;

    let decisionActual =
      "CONTINUAR MIDIENDO";

    if (
      pedidosAcumulados === 0 &&
      gastoAcumulado >= 90
    ) {
      decisionActual =
        "PAUSAR";
    } else if (
      pedidosAcumulados >= 3 &&
      costoPorPedido !== null &&
      costoPorPedido <= 30
    ) {
      decisionActual =
        "ESCALAR";
    }

    const registroNuevo = {
      fecha:
        obtenerFechaHoy(),

      gasto:
        gastoNuevo,

      pedidos:
        pedidosNuevos,

      venta:
        ventaNueva,

      registradoEn:
        new Date().toISOString(),
    };

    const resultadoActualizado = {
      gastoAcumulado,
      pedidosAcumulados,
      ventaAcumulada,
      costoPorPedido,
      decisionActual,

      historial: [
        ...(
          resultadoAnterior
            ?.historial ||
          []
        ),

        registroNuevo,
      ],
    };

    const campanaActualizada =
      await actualizarCampanaMarketing(
        campanaGuardada.id,
        {
          resultado:
            resultadoActualizado,
        }
      );

    setCampanaGuardada(
      campanaActualizada
    );

    setGastoCampana("");
    setPedidosCampana("");
    setVentaCampana("");

    setMensajeSeguimiento(
      "Resultado guardado. MONYS actualizó la decisión."
    );
  } catch (error) {
    console.error(
      "Error guardando seguimiento:",
      error
    );

    setErrorCampana(
      error?.message ||
        "MONYS no pudo guardar el seguimiento."
    );
  } finally {
    setGuardandoSeguimiento(false);
  }
}

async function cerrarCampanaMarketing() {
  const resultadoActual =
    campanaGuardada?.resultado ||
    {};

  const historial =
    resultadoActual.historial ||
    [];

  if (!campanaGuardada?.id) {
    setErrorCampana(
      "No existe una campaña activa para cerrar."
    );
    return;
  }

  if (historial.length === 0) {
    setErrorCampana(
      "Antes de cerrar la campaña debes registrar por lo menos un avance real."
    );
    return;
  }

  const confirmarCierre =
    window.confirm(
      "¿Confirmas que la campaña terminó y que ya no se registrarán más avances?"
    );

  if (!confirmarCierre) {
    return;
  }

  try {
    setCerrandoCampana(true);
    setErrorCampana("");
    setMensajeSeguimiento("");

       const gastoFinal =
      Number(
        resultadoActual.gastoAcumulado ||
          0
      );

    const pedidosFinales =
      Number(
        resultadoActual.pedidosAcumulados ||
          0
      );

    const ventaFinal =
      Number(
        resultadoActual.ventaAcumulada ||
          0
      );

    const costoPorPedidoFinal =
      pedidosFinales > 0
        ? gastoFinal /
          pedidosFinales
        : null;

    const retornoPorPesoInvertido =
      gastoFinal > 0
        ? ventaFinal /
          gastoFinal
        : null;

    const decisionFinal =
      resultadoActual.decisionActual ||
      "CAMPAÑA_FINALIZADA";

    const aprendizajeReal = {
      tipoFuente: "DATO_REAL",

      gastoFinal,
      pedidosFinales,
      ventaFinal,
      costoPorPedidoFinal,
      retornoPorPesoInvertido,

      registrosAnalizados:
        historial.length,

      fechaCierre:
        obtenerFechaHoy(),
    };

        const analisisAprendizaje =
      await analizarCampanaFinalizadaIA({
        campana:
          campanaGuardada,

        resultado:
          resultadoActual,

        aprendizajeBase:
          aprendizajeReal,
      });

    await guardarAprendizajeCampana({
      campanaId:
        campanaGuardada.id,

      resultado:
        resultadoActual,

      aprendizaje: {
        ...aprendizajeReal,

        resumenIA:
          analisisAprendizaje
            .resumen ||
          "",

        decisionFutura:
          analisisAprendizaje
            .decisionFutura ||
          "REQUIERE_MAS_DATOS",

        recomendacionFutura:
          analisisAprendizaje
            .recomendacionFutura ||
          "",
      },

      analisisIA:
        analisisAprendizaje,

      decisionIA:
        analisisAprendizaje
          .decisionFutura ||
        decisionFinal,

      confianzaIA:
        Number(
          analisisAprendizaje
            .confianza ||
            0
        ),
    });

    const campanaFinalizada =
      await actualizarCampanaMarketing(
        campanaGuardada.id,
        {
          estado: "FINALIZADA",

          fecha_fin:
            obtenerFechaHoy(),

          resultado: {
            ...resultadoActual,

                       decisionFinal,
          },
        }
      );

    setCampanaGuardada(
      campanaFinalizada
    );

    setMensajeSeguimiento(
      "Campaña finalizada. MONYS conservará sus resultados para generar aprendizaje."
    );
  } catch (error) {
    console.error(
      "Error cerrando campaña:",
      error
    );

    setErrorCampana(
      error?.message ||
        "MONYS no pudo cerrar la campaña."
    );
  } finally {
    setCerrandoCampana(false);
  }
}

  return (
    <div
      style={{
        marginBottom: "16px",
        padding: "14px",
        borderRadius: "14px",
        border:
          "1px solid #ead4df",
        background: "#fff9fc",
      }}
    >
      {campanaGuardada?.estado !==
        "ACTIVA" && (
        <>
      <strong
        style={{
          display: "block",
          color: "#9d245b",
          marginBottom: "5px",
          fontSize: "15px",
        }}
      >
        🚀 Crear campaña con MONYS
      </strong>

      <div
        style={{
          fontSize: "12px",
          color: "#7d6470",
          marginBottom: "10px",
        }}
      >
        Dile a MONYS qué quieres lograr.
        El Director de Crecimiento te
        propondrá cómo probarlo, medirlo
        y decidir si escalar o detener.
      </div>

      <textarea
        value={objetivoUsuario}
        onChange={(event) =>
          setObjetivoUsuario(
            event.target.value
          )
        }
        placeholder="Ejemplo: Quiero vender más la Base Flawless Stay sin gastar mucho dinero."
        rows={3}
        style={{
          ...estiloInputMarketing,
          resize: "vertical",
          marginBottom: "9px",
        }}
      />

      <input
        value={producto}
        onChange={(event) =>
          setProducto(
            event.target.value
          )
        }
        placeholder="Producto (opcional)"
        style={{
          ...estiloInputMarketing,
          marginBottom: "9px",
        }}
      />

      <select
        value={canalPreferido}
        onChange={(event) =>
          setCanalPreferido(
            event.target.value
          )
        }
        style={{
          ...estiloInputMarketing,
          marginBottom: "9px",
        }}
      >
        <option value="">
          MONYS decide el canal
        </option>

        <option value="TikTok">
          TikTok
        </option>

        <option value="TikTok Shop">
          TikTok Shop
        </option>

        <option value="Instagram">
          Instagram
        </option>

        <option value="Facebook">
          Facebook / Meta
        </option>

        <option value="Mercado Libre">
          Mercado Libre
        </option>

        <option value="ChatGPT Ads">
          ChatGPT Ads
        </option>

        <option value="Multicanal">
          Multicanal
        </option>
      </select>

      <input
        type="number"
        min="0"
        value={presupuestoMaximo}
        onChange={(event) =>
          setPresupuestoMaximo(
            event.target.value
          )
        }
        placeholder="Presupuesto máximo $ (opcional)"
        style={{
          ...estiloInputMarketing,
          marginBottom: "10px",
        }}
      />

            <input
        type="number"
        min="0"
        step="0.01"
        value={precioProducto}
        onChange={(event) =>
          setPrecioProducto(
            event.target.value
          )
        }
        placeholder="Precio real del producto $"
        style={{
          ...estiloInputMarketing,
          marginBottom: "9px",
        }}
      />

            <input
        type="number"
        min="0"
        value={existenciaProducto}
        onChange={(event) =>
          setExistenciaProducto(
            event.target.value
          )
        }
        placeholder="Existencia real disponible (piezas)"
        style={{
          ...estiloInputMarketing,
          marginBottom: "9px",
        }}
      />

      <input
        value={audienciaProducto}
        onChange={(event) =>
          setAudienciaProducto(
            event.target.value
          )
        }
        placeholder="Cliente ideal (edad, necesidad o tipo de piel)"
        style={{
          ...estiloInputMarketing,
          marginBottom: "9px",
        }}
      />

      <input
        value={ofertaProducto}
        onChange={(event) =>
          setOfertaProducto(
            event.target.value
          )
        }
        placeholder="Oferta real autorizada (opcional)"
        style={{
          ...estiloInputMarketing,
          marginBottom: "10px",
        }}
      />

      <button
        type="button"
        onClick={generar}
        disabled={generando}
        style={{
          width: "100%",
          border: "none",
          borderRadius: "11px",
          padding: "12px",
          background:
            generando
              ? "#d2a9bc"
              : "#9d245b",
          color: "#ffffff",
          fontWeight: "900",
          cursor:
            generando
              ? "wait"
              : "pointer",
        }}
      >
        {generando
          ? "🧠 MONYS está analizando..."
          : "✨ Diseñar campaña"}
      </button>
            <button
        type="button"
        onClick={generarKit}
        disabled={generandoKit}
        style={{
          width: "100%",
          marginTop: "9px",
          border: "1px solid #8f2858",
          borderRadius: "11px",
          padding: "12px",
          background: generandoKit
            ? "#ead5df"
            : "#ffffff",
          color: "#8f2858",
          fontWeight: "900",
          cursor: generandoKit
            ? "wait"
            : "pointer",
        }}
      >
        {generandoKit
          ? "🧠 MONYS preparando publicaciones..."
          : "📣 Generar kit listo para publicar"}
      </button>
        </>
      )}


      {estrategia && (
        <div
          style={{
            marginTop: "12px",
            padding: "13px",
            borderRadius: "12px",
            background: "#ffffff",
            border:
              "1px solid #ead4df",
          }}
        >
          <div
            style={{
              fontWeight: "900",
              fontSize: "16px",
              color: "#80204e",
              marginBottom: "7px",
            }}
          >
            {estrategia.nombre ||
              "Campaña propuesta"}
          </div>

          <div
            style={{
              fontSize: "13px",
              marginBottom: "7px",
            }}
          >
            🎯{" "}
            <strong>
              {estrategia.objetivo}
            </strong>
            {" · "}
            {estrategia.decision}
            {" · "}
            Confianza{" "}
            {estrategia.confianza}/100
          </div>

          <details
            style={{
              marginBottom: "10px",
              border:
                "1px solid #ead4df",
              borderRadius: "10px",
              background: "#fff8fb",
              textAlign: "left",
            }}
          >
            <summary
              style={{
                padding: "11px",
                cursor: "pointer",
                color: "#80204e",
                fontSize: "13px",
                fontWeight: "900",
              }}
            >
              Ver estrategia completa
            </summary>

            <div
              style={{
                padding: "0 11px 11px",
              }}
            >

          {estrategia.diagnostico && (
            <div
              style={{
                fontSize: "12px",
                lineHeight: 1.5,
                marginBottom: "10px",
              }}
            >
              <strong>
                Diagnóstico:
              </strong>{" "}
              {estrategia.diagnostico}
            </div>
          )}

          {estrategia.hipotesis && (
            <div
              style={{
                fontSize: "12px",
                lineHeight: 1.5,
                marginBottom: "10px",
              }}
            >
              <strong>
                Hipótesis:
              </strong>{" "}
              {estrategia.hipotesis}
            </div>
          )}

          {estrategia.canalPrincipal && (
            <div
              style={{
                fontSize: "12px",
                marginBottom: "7px",
              }}
            >
              📣{" "}
              <strong>Canal:</strong>{" "}
              {estrategia.canalPrincipal}
            </div>
          )}

          <div
            style={{
              fontSize: "12px",
              marginBottom: "7px",
            }}
          >
            💰{" "}
            <strong>
              Prueba inicial:
            </strong>{" "}
            $
            {Number(
              estrategia.presupuestoInicial ||
                0
            ).toLocaleString(
              "es-MX"
            )}
          </div>

          {estrategia.gancho && (
            <div
              style={{
                fontSize: "12px",
                marginBottom: "7px",
              }}
            >
              🎬{" "}
              <strong>
                Gancho:
              </strong>{" "}
              {estrategia.gancho}
            </div>
          )}

          {estrategia.cta && (
            <div
              style={{
                fontSize: "12px",
                marginBottom: "10px",
              }}
            >
              👉{" "}
              <strong>CTA:</strong>{" "}
              {estrategia.cta}
            </div>
          )}

         {Array.isArray(
  estrategia.criteriosExito
) &&
  estrategia.criteriosExito.length >
    0 && (
    <div
      style={{
        marginTop: "12px",
        padding: "12px",
        borderRadius: "10px",
        background: "#ecfdf3",
        textAlign: "left",
        fontSize: "12px",
        lineHeight: 1.5,
      }}
    >
      <strong>
        ✅ La campaña tendrá éxito si:
      </strong>

      <ul>
        {estrategia.criteriosExito.map(
          (criterio, indice) => (
            <li key={indice}>
              {criterio}
            </li>
          )
        )}
      </ul>
    </div>
  )}

{Array.isArray(
  estrategia.criteriosDetener
) &&
  estrategia.criteriosDetener.length >
    0 && (
    <div
      style={{
        marginTop: "10px",
        padding: "12px",
        borderRadius: "10px",
        background: "#fff1f2",
        textAlign: "left",
        fontSize: "12px",
        lineHeight: 1.5,
      }}
    >
      <strong>
        🛑 Detener la campaña si:
      </strong>

      <ul>
        {estrategia.criteriosDetener.map(
          (criterio, indice) => (
            <li key={indice}>
              {criterio}
            </li>
          )
        )}
      </ul>
    </div>
  )}

{Array.isArray(
  estrategia.criteriosEscalar
) &&
  estrategia.criteriosEscalar.length >
    0 && (
    <div
      style={{
        marginTop: "10px",
        padding: "12px",
        borderRadius: "10px",
        background: "#eff6ff",
        textAlign: "left",
        fontSize: "12px",
        lineHeight: 1.5,
      }}
    >
      <strong>
        🚀 Aumentar la inversión si:
      </strong>

      <ul>
        {estrategia.criteriosEscalar.map(
          (criterio, indice) => (
            <li key={indice}>
              {criterio}
            </li>
          )
        )}
      </ul>
    </div>
  )}

            </div>
          </details>

{estrategia.siguienteAccionKary && (
  <div
    style={{
      marginTop: "12px",
      padding: "10px",
      borderRadius: "10px",
      background: "#fff3f8",
      fontSize: "12px",
      lineHeight: 1.5,
      fontWeight: "700",
    }}
  >
    ✅ Siguiente acción para Kary:
    <br />
    {
      estrategia.siguienteAccionKary
    }
  </div>
)}
  {kitMarketing && (
  <div
    style={{
      marginTop: "12px",
      marginBottom: "12px",
      padding: "14px",
      borderRadius: "12px",
      border: "1px solid #c7d9f5",
      background: "#f5f9ff",
    }}
  >
    <strong
      style={{
        display: "block",
        color: "#24558c",
        marginBottom: "8px",
      }}
    >
      📣 Kit de publicación MONYS
    </strong>

    <div
      style={{
        fontSize: "12px",
        color: "#526579",
        marginBottom: "10px",
      }}
    >
      Aquí Kary puede consultar qué publicar,
      dónde publicarlo y cómo medirlo.
    </div>

    <pre
      style={{
        margin: 0,
        padding: "10px",
        borderRadius: "9px",
        background: "#ffffff",
        whiteSpace: "pre-wrap",
        fontFamily: "inherit",
        fontSize: "12px",
        lineHeight: 1.45,
        color: "#263746",
      }}
    >
      {JSON.stringify(
        kitMarketing,
        null,
        2
      )}
    </pre>
  </div>
)}
 {campanaGuardada?.estado ===
"ACTIVA" ? (
  <div
    style={{
      marginTop: "12px",
      padding: "12px",
      borderRadius: "10px",
      background: "#dcfce7",
      color: "#166534",
      fontWeight: "800",
      textAlign: "center",
    }}
  >
    🟢 Campaña activa y en seguimiento
  </div>
) : (
  <button
    type="button"
    onClick={
      activarCampana
    }
    disabled={
      activandoCampana ||
      !campanaGuardada?.id
    }
    style={{
      width: "100%",
      marginTop: "12px",
      padding: "14px",
      border: "none",
      borderRadius: "10px",
      background:
        activandoCampana
          ? "#94a3b8"
          : "#15803d",
      color: "white",
      fontWeight: "800",
      cursor:
        activandoCampana
          ? "wait"
          : "pointer",
    }}
  >
    {activandoCampana
      ? "Activando campaña..."
      : "🚀 Activar campaña"}
  </button>
)}

        </div>
      )}

        {campanaGuardada?.estado ===
  "ACTIVA" && (
  <div
    style={{
      marginTop: "12px",
      padding: "14px",
      borderRadius: "12px",
      border:
        "1px solid #bbf7d0",
      background: "#f0fdf4",
    }}
  >
            {kitMarketing && (
          <div
            style={{
              marginTop: "12px",
              padding: "14px",
              borderRadius: "12px",
              border: "1px solid #c7d9f5",
              background: "#f5f9ff",
            }}
          >
            <strong
              style={{
                display: "block",
                color: "#24558c",
                marginBottom: "8px",
              }}
            >
              📣 Kit de publicación MONYS
            </strong>

            <div
              style={{
                fontSize: "12px",
                color: "#526579",
                marginBottom: "10px",
              }}
            >
              Aquí Kary puede consultar qué publicar,
              dónde publicarlo y cómo medirlo.
            </div>

            <pre
              style={{
                margin: 0,
                padding: "10px",
                borderRadius: "9px",
                background: "#ffffff",
                whiteSpace: "pre-wrap",
                fontFamily: "inherit",
                fontSize: "12px",
                lineHeight: 1.45,
                color: "#263746",
              }}
            >
              {JSON.stringify(
                kitMarketing,
                null,
                2
              )}
            </pre>
          </div>
        )}
    <strong>
      📊 Seguimiento de campaña
    </strong>

    <p
      style={{
        fontSize: "12px",
        margin:
          "6px 0 12px",
      }}
    >
      Registra solamente los
      resultados nuevos desde la
      última captura.
    </p>

    <div
      style={{
        display: "grid",
        gridTemplateColumns:
          "repeat(auto-fit, minmax(130px, 1fr))",
        gap: "8px",
      }}
    >
      <input
        type="number"
        min="0"
        value={gastoCampana}
        onChange={(evento) =>
          setGastoCampana(
            evento.target.value
          )
        }
        placeholder="Gasto nuevo $"
        style={{
          padding: "10px",
          borderRadius: "8px",
          border:
            "1px solid #cbd5e1",
        }}
      />

      <input
        type="number"
        min="0"
        value={pedidosCampana}
        onChange={(evento) =>
          setPedidosCampana(
            evento.target.value
          )
        }
        placeholder="Pedidos nuevos"
        style={{
          padding: "10px",
          borderRadius: "8px",
          border:
            "1px solid #cbd5e1",
        }}
      />

      <input
        type="number"
        min="0"
        value={ventaCampana}
        onChange={(evento) =>
          setVentaCampana(
            evento.target.value
          )
        }
        placeholder="Venta nueva $"
        style={{
          padding: "10px",
          borderRadius: "8px",
          border:
            "1px solid #cbd5e1",
        }}
      />
    </div>

    <button
      type="button"
      onClick={
        guardarSeguimientoCampana
      }
      disabled={
        guardandoSeguimiento
      }
      style={{
        width: "100%",
        marginTop: "10px",
        padding: "12px",
        border: "none",
        borderRadius: "8px",
        background: "#166534",
        color: "white",
        fontWeight: "800",
      }}
    >
      {guardandoSeguimiento
        ? "Guardando..."
        : "💾 Guardar avance"}
    </button>

    {mensajeSeguimiento && (
      <p
        style={{
          color: "#166534",
          fontWeight: "700",
          fontSize: "12px",
        }}
      >
        ✅ {mensajeSeguimiento}
      </p>
    )}

    {campanaGuardada
      ?.resultado && (
      <div
        style={{
          marginTop: "12px",
          padding: "12px",
          borderRadius: "10px",
          background: "white",
          fontSize: "12px",
          lineHeight: 1.6,
        }}
      >
        <strong>
          Decisión MONYS:{" "}
        {
  campanaGuardada
    .resultado
    .decisionActual ||
  "ESPERANDO RESULTADOS"
}
        </strong>

        <br />

        Gasto acumulado: $
        {Number(
          campanaGuardada
            .resultado
            .gastoAcumulado ||
            0
        ).toFixed(2)}

        <br />

        Pedidos acumulados:{" "}
        {Number(
          campanaGuardada
            .resultado
            .pedidosAcumulados ||
            0
        )}

        <br />

        Venta acumulada: $
        {Number(
          campanaGuardada
            .resultado
            .ventaAcumulada ||
            0
        ).toFixed(2)}

        <br />

        Costo por pedido:{" "}
{Number.isFinite(
  Number(
    campanaGuardada
      .resultado
      .costoPorPedido
  )
) &&
campanaGuardada
  .resultado
  .costoPorPedido !== null
  ? `$${Number(
      campanaGuardada
        .resultado
        .costoPorPedido
    ).toFixed(2)}`
  : "Sin pedidos todavía"}
      </div>
    )}
  </div>
)}

    <button
      type="button"
      onClick={
        cerrarCampanaMarketing
      }
      disabled={
        cerrandoCampana
      }
      style={{
        width: "100%",
        marginTop: "10px",
        padding: "12px",
        border:
          "1px solid #991b1b",
        borderRadius: "8px",
        background:
          cerrandoCampana
            ? "#d1d5db"
            : "#ffffff",
        color:
          cerrandoCampana
            ? "#6b7280"
            : "#991b1b",
        fontWeight: "800",
        cursor:
          cerrandoCampana
            ? "not-allowed"
            : "pointer",
      }}
    >
      {cerrandoCampana
        ? "Finalizando..."
        : "🏁 Finalizar campaña"}
    </button>

         {errorCampana && (
      <div
        style={{
          marginTop: "10px",
          padding: "10px",
          borderRadius: "10px",
          background: "#fff0f0",
          border:
            "1px solid #efb8b8",
          color: "#a22525",
          fontSize: "12px",
          fontWeight: "700",
        }}
      >
        ⚠️ {errorCampana}
      </div>
    )}

    </div>
  );
}

const estiloInputMarketing = {
  width: "100%",
  boxSizing: "border-box",
  padding: "10px",
  borderRadius: "10px",
  border: "1px solid #cedbd5",
  fontFamily: "inherit",
  fontSize: "14px",
};

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
