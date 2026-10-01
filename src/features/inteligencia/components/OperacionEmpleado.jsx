Warning: truncated output (original token count: 35622)
Total output lines: 6524

import {
  useEffect,
  useMemo,
  useRef,
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
  obtenerOportunidadesGrowthOS,
} from "../services/campanasMarketingService";

import CentroTrabajoGrowth from "./director-marketing/CentroTrabajoGrowth";
import CentroPublicacionesMarketing from "./director-marketing/CentroPublicacionesMarketing";

import {
  claveEspacioGrowth,
  obtenerEspaciosGrowth,
} from "../services/growthAgencyService";

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
  const [
    espaciosGrowth,
    setEspaciosGrowth,
  ] = useState([]);

  const [
    claveEspacioGrowthActivo,
    setClaveEspacioGrowthActivo,
  ] = useState("");

  const [tareas, setTareas] =
    useState([]);

  const [campanasGrowth, setCampanasGrowth] =
    useState([]);

  const [oportunidadesCentroGrowth, setOportunidadesCentroGrowth] =
    useState([]);

  const [cargandoOportunidadesCentroGrowth, setCargandoOportunidadesCentroGrowth] =
    useState(false);

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

  useEffect(() => {
    let activo = true;

    async function cargarEspaciosGrowth() {
      if (!usuario?.organization_id) {
        return;
      }

      try {
        const espacios =
          await obtenerEspaciosGrowth({
            organizationId:
              usuario.organization_id,
          });

        if (!activo) {
          return;
        }

        setEspaciosGrowth(espacios);

        const espacioUsuario = espacios.find(
          (espacio) =>
            espacio.business_id ===
              usuario.business_id &&
            espacio.branch_id ===
              (branchId || usuario.branch_id)
        );

        setClaveEspacioGrowthActivo(
          claveEspacioGrowth(
            espacioUsuario || espacios[0]
          )
        );
      } catch (errorEspacios) {
        console.error(
          "Error cargando empresas de Growth OS:",
          errorEspacios
        );
      }
    }

    cargarEspaciosGrowth();

    return () => {
      activo = false;
    };
  }, [
    branchId,
    usuario?.branch_id,
    usuario?.business_id,
    usuario?.organization_id,
  ]);

  const espacioGrowthActivo = useMemo(
    () =>
      espaciosGrowth.find(
        (espacio) =>
          claveEspacioGrowth(espacio) ===
          claveEspacioGrowthActivo
      ) || null,
    [
      claveEspacioGrowthActivo,
      espaciosGrowth,
    ]
  );

  const branchIdActivo =
    espacioGrowthActivo?.branch_id ??
    branchId;

  const organizationIdActivo =
    espacioGrowthActivo?.organization_id ??
    usuario?.organization_id;

  const businessIdActivo =
    espacioGrowthActivo?.business_id ??
    usuario?.business_id;

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
        campanas,
      ] = await Promise.all([
        obtenerTareasOperativas({
          branchId: branchIdActivo,
          fecha: fechaHoy,
        }),

        obtenerCorreccionesInventarioDisponibles({
          branchId: branchIdActivo,
          fecha: fechaHoy,
        }),

        obtenerCalendarioTareasOperativas({
          branchId: branchIdActivo,
          fechaInicio:
            diasSemana[0].fecha,
          fechaFin:
            diasSemana[
              diasSemana.length - 1
            ].fecha,
        }),

        obtenerCampanasMarketing({
          organizationId:
            organizationIdActivo,
          businessId: businessIdActivo,
          branchId: branchIdActivo,
        }).catch((errorCampanas) => {
          console.error(
            "Error cargando resumen Growth:",
            errorCampanas
          );

          return [];
        }),
      ]);

      setCampanasGrowth(
        Array.isArray(campanas)
          ? campanas
          : []
      );

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
    organizationIdActivo,
    businessIdActivo,
    branchIdActivo,
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

  // La prioridad sale de las tareas de marketing ya asignadas.
  const tareaPrioritaria = useMemo(() => {
    const tareasMarketing = activas.filter(
      (tarea) =>
        normalizarTexto(tarea.area) === "MARKETING" &&
        normalizarTexto(tarea.estado) !== "ANALIZANDO"
    );

    const pesoEstado = (tarea) =>
      normalizarTexto(tarea.estado) === "EN_PROCESO"
        ? 0
        : 1;

    const pesoPrioridad = (tarea) => {
      const prioridad = normalizarTexto(tarea.prioridad);
      return prioridad === "URGENTE"
        ? 0
        : prioridad === "ALTA"
          ? 1
          : prioridad === "NORMAL"
            ? 2
            : 3;
    };

    return [...tareasMarketing].sort((a, b) =>
      pesoEstado(a) - pesoEstado(b) ||
      pesoPrioridad(a) - pesoPrioridad(b) ||
      String(a.hora_limite || "99:99").localeCompare(
        String(b.hora_limite || "99:99")
      )
    )[0] || null;
  }, [activas]);

  const esCentroGrowth = useMemo(
    () =>
      normalizarTexto(
        usuario?.role
      ) === "MARKETING" ||
      [...activas, ...tareasCalendario].some(
        (tarea) =>
          normalizarTexto(
            tarea.area
          ) === "MARKETING"
      ),
    [
      activas,
      tareasCalendario,
      usuario?.role,
    ]
  );

  useEffect(() => {
    let vigente = true;

    async function cargarOportunidadesCentro() {
      if (!esCentroGrowth || !branchIdActivo) {
        setOportunidadesCentroGrowth([]);
        return;
      }

      setCargandoOportunidadesCentroGrowth(true);

      try {
        const resultado =
          await obtenerOportunidadesGrowthOS({
            branchId: branchIdActivo,
          });

        if (vigente) {
          setOportunidadesCentroGrowth(
            Array.isArray(resultado?.oportunidades)
              ? resultado.oportunidades
              : []
          );
        }
      } catch (errorOportunidades) {
        console.error(
          "Error cargando prioridad real de Growth OS:",
          errorOportunidades
        );

        if (vigente) {
          setOportunidadesCentroGrowth([]);
        }
      } finally {
        if (vigente) {
          setCargandoOportunidadesCentroGrowth(false);
        }
      }
    }

    cargarOportunidadesCentro();

    return () => {
      vigente = false;
    };
  }, [branchIdActivo, esCentroGrowth]);

  function abrirTareaPrioritaria() {
    if (!tareaPrioritaria) {
      return;
    }

    if (
      normalizarTexto(
        tareaPrioritaria.estado
      ) === "PENDIENTE"
    ) {
      cambiarEstado(
        tareaPrioritaria,
        "en_proceso"
      );

      return;
    }

    const tarjeta =
      document.getElementById(
        `tarea-${tareaPrioritaria.id}`
      );

    tarjeta
      ?.querySelector("details")
      ?.setAttribute("open", "");

    tarjeta?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
  }

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
      {esCentroGrowth && (
        <CentroTrabajoGrowth
          usuario={usuario}
          porcentaje={porcentaje}
          pendientes={pendientes}
          enProceso={enProceso}
          terminadas={
            terminadas.length
          }
          tareasSemana={
            tareasCalendario.length
          }
          tareaPrioritaria={
            tareaPrioritaria
          }
          campanas={campanasGrowth}
          oportunidadPrioritaria={
            oportunidadesCentroGrowth[0] || null
          }
          cargandoOportunidades={
            cargandoOportunidadesCentroGrowth
          }
          onActualizar={cargarTareas}
          onEmpezarPrioridad={
            abrirTareaPrioritaria
          }
          onVerSemana={() =>
            document
              .getElementById(
                "calendario-growth"
              )
              ?.scrollIntoView({
                behavior: "smooth",
                block: "start",
              })
          }
          onAbrirModulo={(seccion) => {
            window.dispatchEvent(
              new CustomEvent(
                "monys-growth-navegar",
                {
                  detail: seccion,
                }
              )
            );

            document
              .getElementById(
                "centro-growth-operativo"
              )
              ?.scrollIntoView({
                behavior: "smooth",
                block: "start",
              });
          }}
          espaciosGrowth={espaciosGrowth}
          espacioGrowthActivo={
            espacioGrowthActivo
          }
          onCambiarEspacio={
            setClaveEspacioGrowthActivo
          }
        />
      )}

      {!esCentroGrowth && tareaPrioritaria && (
        <article
          style={{
            marginBottom: "18px",
            padding: "18px",
            borderRadius: "20px",
            border: "1px solid #efc7da",
            background:
              "linear-gradient(145deg, #fff0f7, #ffffff)",
            boxShadow: "0 8px 24px rgba(157,36,91,0.08)",
          }}
        >
          <div style={{ color: "#9d245b", fontWeight: 900 }}>
            Hola, {String(usuario?.nombre || "equipo").trim().split(/\s+/)[0]} 💗
          </div>
          <div style={{ marginTop: "4px", color: "#745364", fontSize: "13px" }}>
            Tu centro de crecimiento · Hoy
          </div>

          <h2 style={{ margin: "16px 0 10px", color: "#7d194b", fontSize: "20px" }}>
            🎯 Tu prioridad de hoy
          </h2>
          <strong style={{ display: "block", color: "#30232a", fontSize: "17px" }}>
            {tareaPrioritaria.titulo}
          </strong>
          <p style={{ margin: "9px 0", color: "#64535c", lineHeight: 1.45 }}>
            {normalizarTexto(tareaPrioritaria.estado) === "EN_PROCESO"
              ? "Ya la comenzaste: termina esta acción antes de abrir otra."
              : normalizarTexto(tareaPrioritaria.prioridad) === "URGENTE"
                ? "Es urgente dentro de tus tareas asignadas."
                : normalizarTexto(tareaPrioritaria.prioridad) === "ALTA"
                  ? "Tiene prioridad alta dentro de tus tareas asignadas."
                  : "Es una tarea real asignada a ti para hoy."}
            {tareaPrioritaria.hora_limite
              ? ` Límite: ${tareaPrioritaria.hora_limite}.`
              : ""}
          </p>

          {tareaPrioritaria.criterio_exito && (
            <div style={{ margin: "10px 0", color: "#634554", fontSize: "13px" }}>
              <strong>Resultado esperado:</strong> {tareaPrioritaria.criterio_exito}
            </div>
          )}
          <div style={{ color: "#866f7b", fontSize: "12px" }}>
            Valor económico: pendiente de medir con el resultado real.
          </div>

          <button
            type="button"
            onClick={
              abrirTareaPrioritaria
            }
            style={{
              width: "100%",
              marginTop: "14px",
              padding: "12px",
              border: "none",
              borderRadius: "12px",
              background: "#c33170",
              color: "#ffffff",
              fontWeight: 900,
              cursor: "pointer",
            }}
          >
            {normalizarTexto(tareaPrioritaria.estado) === "PENDIENTE"
              ? "▶ Empezar tarea"
              : "Ver tarea e instrucciones"}
          </button>
        </article>
      )}

      {/* RESUMEN */}

      <div
        id="calendario-growth"
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
                   "1fr",
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
                                  …15622 tokens truncated… resultadoAnterior
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
      id="centro-growth-operativo"
      style={{
        marginBottom: "16px",
        padding: "14px",
        borderRadius: "14px",
        border:
          "1px solid #ead4df",
        background: "#fff9fc",
      }}
    >
      {(
        <>
      <strong
        style={{
          display: "block",
          color: "#9d245b",
          marginBottom: "5px",
          fontSize: "15px",
        }}
      >
        🚀 MONYS Growth OS
      </strong>

      <div
        style={{
          fontSize: "12px",
          color: "#7d6470",
          marginBottom: "10px",
        }}
      >
      Tu centro de crecimiento inteligente.

MONYS analiza ventas, inventario, margen, rotación y resultados reales para decirte qué producto impulsar, qué acción hacer hoy, qué probar y cuándo escalar, mejorar, pausar o detener.
      </div>

       <div
  style={{
    display: "grid",
    gridTemplateColumns:
      "repeat(auto-fit, minmax(150px, 1fr))",
    gap: "8px",
    marginBottom: "12px",
  }}
>
   <div
  onClick={() =>
    setSeccionGrowthActiva("HOY")
  }
  style={{
    ...estiloMiniTarjetaMarketing,
    cursor: "pointer",
    border:
      seccionGrowthActiva === "HOY"
        ? "2px solid #9d245b"
        : estiloMiniTarjetaMarketing.border,
    backgroundColor:
      seccionGrowthActiva === "HOY"
        ? "#fff0f6"
        : estiloMiniTarjetaMarketing.backgroundColor,
  }}
>
  🎯 Qué hacer hoy
</div>

 <div
  onClick={() => {
  setSeccionGrowthActiva("OPORTUNIDADES");
  cargarOportunidadesGrowth();
}}
  style={{
    ...estiloMiniTarjetaMarketing,
    cursor: "pointer",
    border:
      seccionGrowthActiva === "OPORTUNIDADES"
        ? "2px solid #9d245b"
        : estiloMiniTarjetaMarketing.border,
    backgroundColor:
      seccionGrowthActiva === "OPORTUNIDADES"
        ? "#fff0f6"
        : estiloMiniTarjetaMarketing.backgroundColor,
  }}
>
  💡 Oportunidades
</div>

 <div
  onClick={() =>
    setSeccionGrowthActiva("CONTENIDO")
  }
  style={{
    ...estiloMiniTarjetaMarketing,
    cursor: "pointer",
    border:
      seccionGrowthActiva === "CONTENIDO"
        ? "2px solid #9d245b"
        : estiloMiniTarjetaMarketing.border,
    backgroundColor:
      seccionGrowthActiva === "CONTENIDO"
        ? "#fff0f6"
        : estiloMiniTarjetaMarketing.backgroundColor,
  }}
>
  🎬 Contenido
</div>

   <div
  onClick={() =>
    setSeccionGrowthActiva("CAMPANAS")
  }
  style={{
    ...estiloMiniTarjetaMarketing,
    cursor: "pointer",
    border:
      seccionGrowthActiva === "CAMPANAS"
        ? "2px solid #9d245b"
        : estiloMiniTarjetaMarketing.border,
    backgroundColor:
      seccionGrowthActiva === "CAMPANAS"
        ? "#fff0f6"
        : estiloMiniTarjetaMarketing.backgroundColor,
  }}
>
  📣 Campañas
</div>

  <div
  onClick={() =>
    setSeccionGrowthActiva("RESULTADOS")
  }
  style={{
    ...estiloMiniTarjetaMarketing,
    cursor: "pointer",
    border:
      seccionGrowthActiva === "RESULTADOS"
        ? "2px solid #9d245b"
        : estiloMiniTarjetaMarketing.border,
    backgroundColor:
      seccionGrowthActiva === "RESULTADOS"
        ? "#fff0f6"
        : estiloMiniTarjetaMarketing.backgroundColor,
  }}
>
  📈 Resultados
</div>

   <div
  onClick={() =>
    setSeccionGrowthActiva("APRENDIZAJES")
  }
  style={{
    ...estiloMiniTarjetaMarketing,
    cursor: "pointer",
    border:
      seccionGrowthActiva === "APRENDIZAJES"
        ? "2px solid #9d245b"
        : estiloMiniTarjetaMarketing.border,
    backgroundColor:
      seccionGrowthActiva === "APRENDIZAJES"
        ? "#fff0f6"
        : estiloMiniTarjetaMarketing.backgroundColor,
  }}
>
  🧠 Aprendizajes
</div>

</div>
    {seccionGrowthActiva === "HOY" && (
  <div
    style={{
      marginBottom: "12px",
      padding: "12px",
      borderRadius: "12px",
      border: "1px solid #ead7e2",
      backgroundColor: "#fffdfd",
    }}
  >
    <strong
      style={{
        display: "block",
        marginBottom: "6px",
        color: "#7a234f",
      }}
    >
      🎯 Prioridad de hoy
    </strong>

    <div
      style={{
        fontSize: "13px",
        color: "#6f6470",
        lineHeight: "1.5",
      }}
    >
    {estrategia?.siguienteAccionKary
  ? estrategia.siguienteAccionKary
  : "MONYS analizará qué producto, contenido o acción merece atención primero según impacto, inventario, margen, rotación y resultados."}
    </div>
  </div>
)}

    {seccionGrowthActiva === "OPORTUNIDADES" && (
  <div
    style={{
      marginBottom: "12px",
      padding: "12px",
      borderRadius: "12px",
      border: "1px solid #ead7e2",
      backgroundColor: "#fffdfd",
    }}
  >
    <strong
      style={{
        display: "block",
        marginBottom: "6px",
        color: "#7a234f",
      }}
    >
      💡 Oportunidades detectadas
    </strong>

    <div
      style={{
        fontSize: "13px",
        color: "#6f6470",
        lineHeight: "1.5",
      }}
    >
     {cargandoOportunidadesGrowth ? (
  <div>
    Analizando ventas, inventario, margen y cobertura...
  </div>
) : errorOportunidadesGrowth ? (
  <div>
    {errorOportunidadesGrowth}
  </div>
) : oportunidadesGrowth.length === 0 ? (
  <div>
    No se detectaron oportunidades con los datos disponibles.
  </div>
) : (
  <div
    style={{
      display: "grid",
      gap: "8px",
    }}
  >
    {oportunidadesGrowth.map(
      (oportunidad, index) => (
        <div
          key={
            oportunidad.codigo ||
            oportunidad.nombre ||
            index
          }
          style={{
            padding: "10px",
            borderRadius: "10px",
            border: "1px solid #eee0e7",
            backgroundColor: "#ffffff",
          }}
        >
          <div
            style={{
              fontWeight: "800",
              color: "#642347",
              marginBottom: "4px",
            }}
          >
            {index + 1}.{" "}
            {oportunidad.nombre ||
              oportunidad.codigo ||
              "Producto"}
          </div>

          <div>
            Existencia:{" "}
            {oportunidad.existencia || 0} pzas
          </div>

          <div>
            Cobertura:{" "}
            {Number(
              oportunidad.diasCobertura || 0
            ).toFixed(0)} días
          </div>

          <div>
            Margen:{" "}
            {oportunidad.margenReal !== null &&
            oportunidad.margenReal !== undefined
              ? `${Number(
                  oportunidad.margenReal
                ).toFixed(1)}%`
              : "Sin dato"}
          </div>

          <div>
            Valor inventario: $
            {Number(
              oportunidad.valorInventario || 0
            ).toLocaleString("es-MX", {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })}

            <div
  style={{
    marginTop: "4px",
    fontWeight: "800",
    color: "#9d245b",
  }}
>
  Prioridad Growth:{" "}
  {Number(
    oportunidad.prioridad || 0
  ).toFixed(1)}
</div>

          </div>

          {Array.isArray(
            oportunidad.razones
          ) &&
            oportunidad.razones.length > 0 && (
              <div
                style={{
                  marginTop: "5px",
                  fontSize: "12px",
                  color: "#7b6872",
                }}
              >
                {oportunidad.razones.join(
                  " · "
                )}
              </div>
            )}
            <button
  type="button"
  onClick={() => {
    const nombreOportunidad =
      oportunidad.nombre ||
      oportunidad.codigo ||
      "";

     setEstrategia(null);

    setProducto(
      nombreOportunidad
    );

    setObjetivoUsuario(
      `Quiero mover inventario y aumentar ventas de ${nombreOportunidad} cuidando la utilidad.`
    );

    setSeccionGrowthActiva(
      "HOY"
    );
  }}
  style={{
    width: "100%",
    marginTop: "10px",
    padding: "10px",
    borderRadius: "9px",
    border: "1px solid #9d245b",
    backgroundColor: "#fff0f6",
    color: "#9d245b",
    fontWeight: "800",
    cursor: "pointer",
  }}
>
  🚀 Trabajar esta oportunidad
</button>
        </div>
      )
    )}
  </div>
)}
    </div>
  </div>
)}

     {seccionGrowthActiva === "CONTENIDO" && (
  <div
    style={{
      marginBottom: "12px",
      padding: "12px",
      borderRadius: "12px",
      border: "1px solid #ead7e2",
      backgroundColor: "#fffdfd",
    }}
  >
    <strong
      style={{
        display: "block",
        marginBottom: "6px",
        color: "#7a234f",
      }}
    >
      🎬 Contenido para crear
    </strong>

    <div
      style={{
        fontSize: "13px",
        color: "#6f6470",
        lineHeight: "1.5",
      }}
    >
      Aquí MONYS convertirá oportunidades y campañas en piezas concretas:
      video, gancho, guion, CTA, canal, formato y objetivo de venta.
    </div>
  </div>
)}

   {seccionGrowthActiva === "CAMPANAS" && (
  <div
    style={{
      marginBottom: "12px",
      padding: "12px",
      borderRadius: "12px",
      border: "1px solid #ead7e2",
      backgroundColor: "#fffdfd",
    }}
  >
    <strong
      style={{
        display: "block",
        marginBottom: "6px",
        color: "#7a234f",
      }}
    >
      📣 Campañas y experimentos
    </strong>

    <div
      style={{
        fontSize: "13px",
        color: "#6f6470",
        lineHeight: "1.5",
      }}
    >
      Aquí MONYS concentrará las campañas activas, pruebas pequeñas,
      presupuesto, decisión actual y siguiente acción antes de escalar.
    </div>
  </div>
)}

 {seccionGrowthActiva === "RESULTADOS" && (
  <div
    style={{
      marginBottom: "12px",
      padding: "12px",
      borderRadius: "12px",
      border: "1px solid #ead7e2",
      backgroundColor: "#fffdfd",
    }}
  >
    <strong
      style={{
        display: "block",
        marginBottom: "6px",
        color: "#7a234f",
      }}
    >
      📈 Resultados reales
    </strong>

    <div
      style={{
        fontSize: "13px",
        color: "#6f6470",
        lineHeight: "1.5",
      }}
    >
      Aquí MONYS comparará alcance, leads, pedidos, ventas, gasto y utilidad
      para saber qué acciones realmente producen crecimiento.
    </div>
  </div>
)}

      {seccionGrowthActiva === "APRENDIZAJES" && (
  <div
    style={{
      marginBottom: "12px",
      padding: "12px",
      borderRadius: "12px",
      border: "1px solid #ead7e2",
      backgroundColor: "#fffdfd",
    }}
  >
    <strong
      style={{
        display: "block",
        marginBottom: "6px",
        color: "#7a234f",
      }}
    >
      🧠 Aprendizajes de crecimiento
    </strong>

    <div
      style={{
        fontSize: "13px",
        color: "#6f6470",
        lineHeight: "1.5",
      }}
    >
      Aquí MONYS guardará qué funcionó, qué no funcionó, cuánto costó,
      qué produjo ventas y qué debe repetir, mejorar o detener la próxima vez.
    </div>
  </div>
)}

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

    <div
  style={{
    display: "grid",
    gap: "10px",
  }}
>
  <div
  style={{
    padding: "12px",
    borderRadius: "10px",
    background:
      kitMarketing?.estado === "LISTO"
        ? "#ecfdf5"
        : kitMarketing?.estado === "REQUIERE_DATOS"
        ? "#fff7ed"
        : "#fef2f2",
    border:
      kitMarketing?.estado === "LISTO"
        ? "1px solid #86efac"
        : kitMarketing?.estado === "REQUIERE_DATOS"
        ? "1px solid #fdba74"
        : "1px solid #fca5a5",
  }}
>
  <strong>
    {kitMarketing?.estado === "LISTO"
      ? "✅ Listo para publicar"
      : kitMarketing?.estado === "REQUIERE_DATOS"
      ? "⚠️ Listo con pendientes"
      : "⛔ No publicar todavía"}
  </strong>

  {Array.isArray(kitMarketing?.datosFaltantes) &&
    kitMarketing.datosFaltantes.length > 0 && (
      <div
        style={{
          marginTop: "6px",
          fontSize: "12px",
          lineHeight: 1.5,
        }}
      >
        MONYS todavía necesita confirmar algunos datos antes de usar todo el contenido sin restricciones.
      </div>
    )}
</div>
  {kitMarketing?.resumen && (
      <div
      style={{
        padding: "12px",
        borderRadius: "10px",
        background: "#ffffff",
      }}
    >
      <strong>🎯 Qué vamos a hacer</strong>
      <div
        style={{
          marginTop: "6px",
          fontSize: "13px",
          lineHeight: 1.5,
        }}
      >
        {kitMarketing.resumen}
      </div>
    </div>
  )}

  {kitMarketing?.mensajeCentral && (
    <div
      style={{
        padding: "12px",
        borderRadius: "10px",
        background: "#ffffff",
      }}
    >
      <strong>💬 Mensaje de venta</strong>

      {kitMarketing.mensajeCentral.gancho && (
        <p>
          <b>Gancho:</b>{" "}
          {kitMarketing.mensajeCentral.gancho}
        </p>
      )}

      {kitMarketing.mensajeCentral.beneficio && (
        <p>
          <b>Beneficio:</b>{" "}
          {kitMarketing.mensajeCentral.beneficio}
        </p>
      )}

      {kitMarketing.mensajeCentral.oferta && (
        <p>
          <b>Oferta:</b>{" "}
          {kitMarketing.mensajeCentral.oferta}
        </p>
      )}

      {kitMarketing.mensajeCentral
        .llamadoAComprar && (
        <p>
          <b>CTA:</b>{" "}
          {
            kitMarketing.mensajeCentral
              .llamadoAComprar
          }
        </p>
      )}
    </div>
  )}

  {kitMarketing?.tiktok && (
    <div
      style={{
        padding: "12px",
        borderRadius: "10px",
        background: "#ffffff",
      }}
    >
      <strong>🎬 Video para TikTok</strong>

      {kitMarketing.tiktok.objetivo && (
        <p>
          <b>Objetivo:</b>{" "}
          {kitMarketing.tiktok.objetivo}
        </p>
      )}

      {Array.isArray(
        kitMarketing.tiktok.guion
      ) &&
        kitMarketing.tiktok.guion.map(
          (paso, indice) => (
            <div
              key={indice}
              style={{
                marginTop: "8px",
                padding: "8px",
                borderRadius: "8px",
                background: "#f8fafc",
              }}
            >
              <b>
                {paso?.momento ||
                  `Paso ${indice + 1}`}
              </b>

              {paso?.visual && (
                <div>
                  🎥 {paso.visual}
                </div>
              )}

              {paso?.vozOAccion && (
                <div>
                  🗣️ {paso.vozOAccion}
                </div>
              )}

              {paso?.textoEnPantalla && (
                <div>
                  📱 {paso.textoEnPantalla}
                </div>
              )}
            </div>
          )
        )}

      {kitMarketing.tiktok
        .textoPublicacion && (
        <div style={{ marginTop: "10px" }}>
          <b>📝 Texto para publicar:</b>
          <div>
            {
              kitMarketing.tiktok
                .textoPublicacion
            }
          </div>
        </div>
      )}

      {Array.isArray(
        kitMarketing.tiktok.hashtags
      ) && (
        <div style={{ marginTop: "8px" }}>
          <b># Hashtags:</b>{" "}
          {kitMarketing.tiktok.hashtags.join(
            " "
          )}
        </div>
      )}
    </div>
  )}

  {kitMarketing?.whatsapp
    ?.mensajeDirecto && (
    <div
      style={{
        padding: "12px",
        borderRadius: "10px",
        background: "#ffffff",
      }}
    >
      <strong>💬 Respuesta por WhatsApp</strong>
      <div
        style={{
          marginTop: "6px",
          lineHeight: 1.5,
        }}
      >
        {kitMarketing.whatsapp.mensajeDirecto}
      </div>
    </div>
  )}

  {Array.isArray(
    kitMarketing?.datosFaltantes
  ) &&
    kitMarketing.datosFaltantes.length >
      0 && (
      <div
        style={{
          padding: "12px",
          borderRadius: "10px",
          background: "#fff7ed",
        }}
      >
        <strong>
          ⚠️ Datos que todavía falta confirmar
        </strong>

        <ul>
          {kitMarketing.datosFaltantes.map(
            (dato, indice) => (
              <li key={indice}>{dato}</li>
            )
          )}
        </ul>
      </div>
    )}
</div>
  </div>
)}

{kitMarketing && campanaGuardada?.id && (
  <CentroPublicacionesMarketing
    usuario={usuario}
    organizationId={organizationId}
    businessId={businessId}
    branchId={branchId}
    campana={campanaGuardada}
    kit={kitMarketing}
    productoPrincipal={producto}
  />
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
  <>
  <div
  style={{
    marginTop: "10px",
    marginBottom: "8px",
    padding: "10px",
    borderRadius: "10px",
    background: "#f8fafc",
    border: "1px solid #e2e8f0",
    fontSize: "12px",
    lineHeight: 1.5,
    color: "#475569",
    textAlign: "center",
  }}
>
  ℹ️ Iniciar seguimiento solo empieza a medir resultados.
  No publica anuncios, no activa pauta y no genera gasto automático.
</div>
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
     : "▶️ Iniciar seguimiento de campaña"}
  </button>
  </>
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
         Utilidad estimada de campaña:{" "}
{campanaGuardada
  .resultado
  .utilidadEstimadaCampana !== null &&
Number.isFinite(
  Number(
    campanaGuardada
      .resultado
      .utilidadEstimadaCampana
  )
)
  ? `$${Number(
      campanaGuardada
        .resultado
        .utilidadEstimadaCampana
    ).toFixed(2)}`
    : Number(
      campanaGuardada
        ?.estrategia_ia
        ?.datosRentabilidadBase
        ?.margenReal ?? 0
    ) > 0
  ? `Lista para calcular · margen base ${Number(
      campanaGuardada
        ?.estrategia_ia
        ?.datosRentabilidadBase
        ?.margenReal ?? 0
    ).toFixed(1)}%`
  : "Pendiente de margen real"}

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

     {campanaGuardada?.estado === "ACTIVA" && (
  <button
    type="button"
    onClick={pausarCampanaActiva}
    style={{
      width: "100%",
      marginTop: "10px",
      padding: "12px",
      borderRadius: "11px",
      border: "1px solid #d59b00",
      background: "#fff8df",
      color: "#8a6300",
      fontWeight: "900",
      cursor: "pointer",
    }}
  >
    ⏸ Pausar campaña
  </button>
)}


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

 const estiloMiniTarjetaMarketing = {
  padding: "10px",
  borderRadius: "10px",
  border: "1px solid #e5d7ee",
  backgroundColor: "#fff9fc",
  fontSize: "13px",
  fontWeight: "700",
  color: "#6f2d5f",
  textAlign: "center",
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
