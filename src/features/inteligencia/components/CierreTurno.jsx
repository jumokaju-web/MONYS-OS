import {
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  guardarCierreTurno,
  obtenerCierresTurno,
  analizarCierreTurnoIA,
  analizarPatronesCierresIA,
} from "../services/cierresTurnoService";

import {
  convertirPatronesEnPrioridades,
} from "../services/patronesOperativosService";

import {
  crearTareasAutomaticasDesdePatrones,
} from "../services/tareasOperativasService";

const formularioInicial = {
  responsable: "",
  turno: "cierre",
  pendientes: "",
  incidencias: "",
  productosSolicitados: "",
  objecionesClientes: "",
  aprendizajes: "",
  observaciones: "",
};


export default function CierreTurno({
  branchId = null,
}) {
  const [
    formulario,
    setFormulario,
  ] = useState(
    formularioInicial
  );

  const [
    guardando,
    setGuardando,
  ] = useState(false);

  const [
    analizando,
    setAnalizando,
  ] = useState(false);

  const [
    mensaje,
    setMensaje,
  ] = useState("");

  const [
    error,
    setError,
  ] = useState("");

  const [
    cierres,
    setCierres,
  ] = useState([]);

  const [
    cargandoCierres,
    setCargandoCierres,
  ] = useState(false);

  const [
    analisisActual,
    setAnalisisActual,
  ] = useState(null);

  const [
    patrones,
    setPatrones,
  ] = useState(null);

  const [
    analizandoPatrones,
    setAnalizandoPatrones,
  ] = useState(false);

  const [
    errorPatrones,
    setErrorPatrones,
  ] = useState("");


  const fechaHoy =
    useMemo(() => {
      return new Date()
        .toLocaleDateString(
          "es-MX",
          {
            year: "numeric",
            month: "long",
            day: "numeric",
          }
        );
    }, []);


  async function cargarCierres() {
    try {
      setCargandoCierres(true);

      const data =
        await obtenerCierresTurno({
          branchId,
          limite: 10,
        });

      setCierres(
        Array.isArray(data)
          ? data
          : []
      );
    } catch (
      errorCierres
    ) {
      console.error(
        "Error al cargar cierres:",
        errorCierres
      );
    } finally {
      setCargandoCierres(false);
    }
  }


 async function cargarPatrones() {
  try {
    setAnalizandoPatrones(true);
    setErrorPatrones("");

    const respuesta =
      await analizarPatronesCierresIA({
        branchId,
        dias: 7,
      });


    const patronesActuales =
      respuesta?.patrones ||
      null;


    setPatrones(
      patronesActuales
    );


    // ==============================================
    // MONYS OS
    // PATRONES → PRIORIDADES → TAREAS AUTOMÁTICAS
    // ==============================================

    if (patronesActuales) {
      try {
        const prioridades =
          convertirPatronesEnPrioridades(
            patronesActuales
          );


        const resultadoTareas =
          await crearTareasAutomaticasDesdePatrones({
            prioridades,
            branchId,
            creadaPor:
              "MONYS OS",
          });


        if (
          resultadoTareas
            ?.creadas > 0
        ) {
          console.log(
            "MONYS creó tareas directamente desde el análisis de patrones:",
            resultadoTareas
          );
        }


        if (
          resultadoTareas
            ?.duplicadas > 0
        ) {
          console.log(
            "MONYS evitó tareas duplicadas desde patrones:",
            resultadoTareas
          );
        }


        if (
          resultadoTareas
            ?.errores > 0
        ) {
          console.error(
            "MONYS tuvo problemas creando algunas tareas desde patrones:",
            resultadoTareas
          );
        }
      } catch (
        errorTareasPatrones
      ) {
        /*
         * El análisis de patrones ya quedó
         * correctamente guardado.
         *
         * Si falla la creación de una tarea,
         * no destruimos ni ocultamos el análisis.
         */
        console.error(
          "Error al convertir patrones en tareas:",
          errorTareasPatrones
        );
      }
    }
  } catch (
    errorAnalisisPatrones
  ) {
    console.error(
      "Error al analizar patrones:",
      errorAnalisisPatrones
    );

    setErrorPatrones(
      errorAnalisisPatrones
        ?.message ||
        "MONYS no pudo analizar los patrones de cierres."
    );
  } finally {
    setAnalizandoPatrones(false);
  }
}

  useEffect(() => {
    cargarCierres();
  }, [branchId]);


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


  async function manejarGuardar(
    event
  ) {
    event.preventDefault();

    setError("");
    setMensaje("");
    setAnalisisActual(null);

    if (
      !formulario
        .responsable
        .trim()
    ) {
      setError(
        "Escribe quién realiza el cierre."
      );

      return;
    }


    try {
      setGuardando(true);

      const cierreGuardado =
        await guardarCierreTurno({
          branchId,

          responsable:
            formulario.responsable,

          turno:
            formulario.turno,

          pendientes:
            formulario.pendientes,

          incidencias:
            formulario.incidencias,

          productosSolicitados:
            formulario
              .productosSolicitados,

          objecionesClientes:
            formulario
              .objecionesClientes,

          aprendizajes:
            formulario.aprendizajes,

          observaciones:
            formulario.observaciones,
        });


      setMensaje(
        "Cierre guardado. MONYS está analizando la información."
      );


      setFormulario(
        formularioInicial
      );


      await cargarCierres();


      try {
        setAnalizando(true);

        const respuesta =
          await analizarCierreTurnoIA(
            cierreGuardado.id
          );


        setAnalisisActual(
          respuesta?.analisis ||
            null
        );


        setMensaje(
          "Cierre de turno guardado y analizado correctamente."
        );


        /*
         * Después de analizar el cierre
         * individual, actualizamos también
         * los patrones acumulados.
         *
         * Si este segundo análisis falla,
         * NO afecta el cierre ya guardado.
         */
        try {
          await cargarPatrones();
        } catch (
          errorPatronAutomatico
        ) {
          console.error(
            "No se pudieron actualizar patrones:",
            errorPatronAutomatico
          );
        }
      } catch (
        errorAnalisis
      ) {
        console.error(
          "Error al analizar cierre:",
          errorAnalisis
        );

        /*
         * El cierre YA quedó guardado.
         * Si OpenAI falla, no perdemos
         * la información del empleado.
         */
        setError(
          errorAnalisis?.message ||
            "El cierre quedó guardado, pero MONYS no pudo analizarlo."
        );

        setMensaje(
          "El cierre de turno sí quedó guardado."
        );
      } finally {
        setAnalizando(false);
      }
    } catch (
      errorGuardar
    ) {
      console.error(
        "Error al guardar cierre:",
        errorGuardar
      );

      setError(
        errorGuardar?.message ||
          "No se pudo guardar el cierre de turno."
      );
    } finally {
      setGuardando(false);
    }
  }


  function formatearFecha(
    fecha
  ) {
    if (!fecha) {
      return "Sin fecha";
    }

    const partes =
      String(fecha)
        .split("-");

    if (
      partes.length === 3
    ) {
      return `${partes[2]}/${partes[1]}/${partes[0]}`;
    }

    return fecha;
  }


  function mostrarDato(
    valor
  ) {
    const texto =
      String(
        valor || ""
      ).trim();

    return texto ||
      "Sin información";
  }


  function etiquetaPrioridad(
    prioridad
  ) {
    switch (
      prioridad
    ) {
      case "urgente":
        return "🔴 URGENTE";

      case "alta":
        return "🟠 ALTA";

      case "baja":
        return "🟢 BAJA";

      default:
        return "🟡 NORMAL";
    }
  }


  function ListaAnalisis({
    titulo,
    datos,
  }) {
    if (
      !Array.isArray(datos) ||
      datos.length === 0
    ) {
      return null;
    }

    return (
      <div>
        <strong>
          {titulo}
        </strong>

        <ul
          style={{
            marginBottom: 0,
          }}
        >
          {datos.map(
            (
              item,
              index
            ) => (
              <li
                key={`${titulo}-${index}`}
              >
                {item}
              </li>
            )
          )}
        </ul>
      </div>
    );
  }


  return (
    <section
      style={{
        padding: "24px",
      }}
    >
      <div
        style={{
          marginBottom: "22px",
        }}
      >
        <h2
          style={{
            margin: 0,
          }}
        >
          🌙 Cierre Inteligente de Turno
        </h2>

        <p
          style={{
            marginTop: "6px",
            opacity: 0.75,
          }}
        >
          {fechaHoy}
        </p>

        <p
          style={{
            marginTop: "8px",
          }}
        >
          MONYS recopilará lo ocurrido
          durante el turno para detectar
          pendientes, problemas,
          oportunidades y aprendizajes.
        </p>
      </div>


      {error && (
        <div
          style={{
            padding: "12px",
            marginBottom: "14px",
            border:
              "1px solid #dc3545",
            borderRadius: "10px",
          }}
        >
          ❌ {error}
        </div>
      )}


      {mensaje && (
        <div
          style={{
            padding: "12px",
            marginBottom: "14px",
            border:
              "1px solid #198754",
            borderRadius: "10px",
          }}
        >
          ✅ {mensaje}
        </div>
      )}


      {analizando && (
        <div
          style={{
            padding: "16px",
            marginBottom: "18px",
            border:
              "1px solid #aaa",
            borderRadius: "12px",
          }}
        >
          🧠 MONYS está analizando
          el cierre del turno...
        </div>
      )}


      {analisisActual && (
        <section
          style={{
            padding: "20px",
            marginBottom: "24px",
            border:
              "2px solid #333",
            borderRadius: "16px",
          }}
        >
          <h3
            style={{
              marginTop: 0,
            }}
          >
            🧠 Análisis de MONYS
          </h3>


          <div
            style={{
              marginBottom: "14px",
              fontWeight: "800",
            }}
          >
            Prioridad:{" "}
            {etiquetaPrioridad(
              analisisActual.prioridad
            )}
          </div>


          <div
            style={{
              padding: "14px",
              marginBottom: "16px",
              border:
                "1px solid #ddd",
              borderRadius: "10px",
            }}
          >
            <strong>
              📋 Resumen ejecutivo
            </strong>

            <p
              style={{
                marginBottom: 0,
              }}
            >
              {
                analisisActual
                  .resumen_ejecutivo
              }
            </p>
          </div>


          <div
            style={{
              display: "grid",
              gridTemplateColumns:
                "repeat(auto-fit, minmax(250px, 1fr))",
              gap: "16px",
            }}
          >
            <ListaAnalisis
              titulo="📌 Pendientes importantes"
              datos={
                analisisActual
                  .pendientes_importantes
              }
            />

            <ListaAnalisis
              titulo="🚨 Incidencias importantes"
              datos={
                analisisActual
                  .incidencias_importantes
              }
            />

            <ListaAnalisis
              titulo="💰 Oportunidades detectadas"
              datos={
                analisisActual
                  .oportunidades_detectadas
              }
            />

            <ListaAnalisis
              titulo="🛍️ Productos a revisar"
              datos={
                analisisActual
                  .productos_a_revisar
              }
            />

            <ListaAnalisis
              titulo="⚡ Acciones sugeridas"
              datos={
                analisisActual
                  .acciones_sugeridas
              }
            />
          </div>


          <div
            style={{
              marginTop: "18px",
              fontWeight: "700",
            }}
          >
            {analisisActual
              .requiere_atencion
              ? "⚠️ Este cierre requiere atención."
              : "✅ No requiere atención inmediata."}
          </div>
        </section>
      )}


      <section
        style={{
          padding: "20px",
          marginBottom: "28px",
          border:
            "2px solid #333",
          borderRadius: "16px",
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent:
              "space-between",
            alignItems: "center",
            gap: "14px",
            flexWrap: "wrap",
            marginBottom: "16px",
          }}
        >
          <div>
            <h3
              style={{
                margin: 0,
              }}
            >
              🔎 Patrones detectados por MONYS
            </h3>

            <p
              style={{
                margin:
                  "6px 0 0 0",
                opacity: 0.75,
              }}
            >
              MONYS compara los cierres
              de los últimos 7 días para
              detectar problemas y
              oportunidades repetidas.
            </p>
          </div>


          <button
            type="button"
            onClick={
              cargarPatrones
            }
            disabled={
              analizandoPatrones
            }
          >
            {analizandoPatrones
              ? "🧠 Analizando..."
              : "🔎 Analizar últimos 7 días"}
          </button>
        </div>


        {errorPatrones && (
          <div
            style={{
              padding: "12px",
              marginBottom: "14px",
              border:
                "1px solid #dc3545",
              borderRadius: "10px",
            }}
          >
            ❌ {errorPatrones}
          </div>
        )}


        {analizandoPatrones && (
          <div
            style={{
              padding: "14px",
              border:
                "1px solid #aaa",
              borderRadius: "10px",
            }}
          >
            🧠 MONYS está comparando
            cierres, buscando repeticiones
            y calculando la importancia
            de cada señal...
          </div>
        )}


        {!analizandoPatrones &&
        !patrones && (
          <div
            style={{
              padding: "16px",
              border:
                "1px solid #ddd",
              borderRadius: "10px",
            }}
          >
            Presiona{" "}
            <strong>
              🔎 Analizar últimos 7 días
            </strong>{" "}
            para que MONYS busque patrones
            entre los cierres registrados.
          </div>
        )}


        {!analizandoPatrones &&
        patrones && (
          <div>
            <div
              style={{
                display: "grid",
                gridTemplateColumns:
                  "repeat(auto-fit, minmax(180px, 1fr))",
                gap: "12px",
                marginBottom: "18px",
              }}
            >
              <div
                style={{
                  padding: "14px",
                  border:
                    "1px solid #ddd",
                  borderRadius: "10px",
                }}
              >
                <strong>
                  📅 Periodo
                </strong>

                <div
                  style={{
                    marginTop: "6px",
                  }}
                >
                  Últimos{" "}
                  {
                    patrones.periodo_dias
                  }{" "}
                  días
                </div>
              </div>


              <div
                style={{
                  padding: "14px",
                  border:
                    "1px solid #ddd",
                  borderRadius: "10px",
                }}
              >
                <strong>
                  📚 Cierres analizados
                </strong>

                <div
                  style={{
                    marginTop: "6px",
                    fontSize: "20px",
                    fontWeight: "800",
                  }}
                >
                  {
                    patrones.total_cierres
                  }
                </div>
              </div>


              <div
                style={{
                  padding: "14px",
                  border:
                    "1px solid #ddd",
                  borderRadius: "10px",
                }}
              >
                <strong>
                  🚦 Prioridad general
                </strong>

                <div
                  style={{
                    marginTop: "6px",
                    fontWeight: "800",
                  }}
                >
                  {etiquetaPrioridad(
                    patrones
                      .prioridad_general
                  )}
                </div>
              </div>


              <div
                style={{
                  padding: "14px",
                  border:
                    "1px solid #ddd",
                  borderRadius: "10px",
                }}
              >
                <strong>
                  🎯 Confianza
                </strong>

                <div
                  style={{
                    marginTop: "6px",
                    fontSize: "20px",
                    fontWeight: "800",
                  }}
                >
                  {Number(
                    patrones.confianza ||
                      0
                  ).toFixed(0)}
                  %
                </div>
              </div>
            </div>


            <div
              style={{
                padding: "16px",
                marginBottom: "18px",
                border:
                  "1px solid #ddd",
                borderRadius: "12px",
              }}
            >
              <strong>
                📋 Resumen ejecutivo
              </strong>

              <p
                style={{
                  marginBottom: 0,
                }}
              >
                {
                  patrones
                    .resumen_ejecutivo
                }
              </p>
            </div>


            <div
              style={{
                display: "grid",
                gridTemplateColumns:
                  "repeat(auto-fit, minmax(260px, 1fr))",
                gap: "18px",
              }}
            >
              <ListaAnalisis
                titulo="🔁 Patrones repetidos"
                datos={
                  patrones
                    .patrones_repetidos
                }
              />

              <ListaAnalisis
                titulo="🛍️ Productos recurrentes"
                datos={
                  patrones
                    .productos_recurrentes
                }
              />

              <ListaAnalisis
                titulo="🚨 Incidencias recurrentes"
                datos={
                  patrones
                    .incidencias_recurrentes
                }
              />

              <ListaAnalisis
                titulo="💬 Objeciones recurrentes"
                datos={
                  patrones
                    .objeciones_recurrentes
                }
              />

              <ListaAnalisis
                titulo="💰 Oportunidades recurrentes"
                datos={
                  patrones
                    .oportunidades_recurrentes
                }
              />

              <ListaAnalisis
                titulo="⚡ Acciones prioritarias"
                datos={
                  patrones
                    .acciones_prioritarias
                }
              />

              <ListaAnalisis
                titulo="⚠️ Alertas"
                datos={
                  patrones.alertas
                }
              />
            </div>


            {Number(
              patrones.total_cierres ||
                0
            ) < 3 && (
              <div
                style={{
                  marginTop: "18px",
                  padding: "12px",
                  border:
                    "1px solid #aaa",
                  borderRadius: "10px",
                }}
              >
                ℹ️ Todavía hay pocos
                cierres registrados.
                La precisión de MONYS
                aumentará conforme el
                equipo realice cierres
                todos los días.
              </div>
            )}
          </div>
        )}
      </section>


      <form
        onSubmit={
          manejarGuardar
        }
        style={{
          display: "grid",
          gap: "16px",
          padding: "20px",
          border:
            "1px solid #333",
          borderRadius: "14px",
          marginBottom: "28px",
        }}
      >
        <div
          style={{
            display: "grid",
            gridTemplateColumns:
              "repeat(auto-fit, minmax(220px, 1fr))",
            gap: "12px",
          }}
        >
          <div>
            <label>
              👤 ¿Quién cierra?
            </label>

            <input
              type="text"
              name="responsable"
              value={
                formulario.responsable
              }
              onChange={
                manejarCambio
              }
              placeholder="Ej. Vale, Kary..."
              style={{
                width: "100%",
                marginTop: "6px",
                padding: "10px",
              }}
            />
          </div>


          <div>
            <label>
              🕐 Turno
            </label>

            <select
              name="turno"
              value={
                formulario.turno
              }
              onChange={
                manejarCambio
              }
              style={{
                width: "100%",
                marginTop: "6px",
                padding: "10px",
              }}
            >
              <option value="apertura">
                Apertura
              </option>

              <option value="medio">
                Intermedio
              </option>

              <option value="cierre">
                Cierre
              </option>
            </select>
          </div>
        </div>


        <div>
          <label>
            📌 ¿Qué quedó pendiente?
          </label>

          <textarea
            name="pendientes"
            value={
              formulario.pendientes
            }
            onChange={
              manejarCambio
            }
            placeholder="Pedidos, acomodos, clientes, tareas..."
            rows={3}
            style={{
              width: "100%",
              marginTop: "6px",
              padding: "10px",
            }}
          />
        </div>


        <div>
          <label>
            🚨 ¿Hubo alguna incidencia?
          </label>

          <textarea
            name="incidencias"
            value={
              formulario.incidencias
            }
            onChange={
              manejarCambio
            }
            placeholder="Faltantes, problemas con clientes, caja, equipo..."
            rows={3}
            style={{
              width: "100%",
              marginTop: "6px",
              padding: "10px",
            }}
          />
        </div>


        <div>
          <label>
            🛍️ Productos solicitados
          </label>

          <textarea
            name="productosSolicitados"
            value={
              formulario
                .productosSolicitados
            }
            onChange={
              manejarCambio
            }
            placeholder="Productos que pidieron los clientes y no encontraron..."
            rows={3}
            style={{
              width: "100%",
              marginTop: "6px",
              padding: "10px",
            }}
          />
        </div>


        <div>
          <label>
            💬 Objeciones de clientes
          </label>

          <textarea
            name="objecionesClientes"
            value={
              formulario
                .objecionesClientes
            }
            onChange={
              manejarCambio
            }
            placeholder="Muy caro, no había tono, buscaban otra marca..."
            rows={3}
            style={{
              width: "100%",
              marginTop: "6px",
              padding: "10px",
            }}
          />
        </div>


        <div>
          <label>
            💡 ¿Qué aprendimos hoy?
          </label>

          <textarea
            name="aprendizajes"
            value={
              formulario.aprendizajes
            }
            onChange={
              manejarCambio
            }
            placeholder="Algo que funcionó, algo que debemos cambiar..."
            rows={3}
            style={{
              width: "100%",
              marginTop: "6px",
              padding: "10px",
            }}
          />
        </div>


        <div>
          <label>
            📝 Algo más que MONYS
            deba saber
          </label>

          <textarea
            name="observaciones"
            value={
              formulario.observaciones
            }
            onChange={
              manejarCambio
            }
            placeholder="Cualquier información importante del turno..."
            rows={3}
            style={{
              width: "100%",
              marginTop: "6px",
              padding: "10px",
            }}
          />
        </div>


        <button
          type="submit"
          disabled={
            guardando ||
            analizando
          }
          style={{
            padding: "12px 18px",
            fontWeight: "700",
            cursor:
              guardando ||
              analizando
                ? "not-allowed"
                : "pointer",
          }}
        >
          {guardando
            ? "Guardando..."
            : analizando
            ? "MONYS está analizando..."
            : "✅ Finalizar cierre de turno"}
        </button>
      </form>


      <section>
        <div
          style={{
            display: "flex",
            justifyContent:
              "space-between",
            alignItems: "center",
            gap: "12px",
            flexWrap: "wrap",
            marginBottom: "14px",
          }}
        >
          <div>
            <h3
              style={{
                margin: 0,
              }}
            >
              📚 Últimos cierres de turno
            </h3>

            <p
              style={{
                margin:
                  "5px 0 0 0",
                opacity: 0.7,
              }}
            >
              Historial reciente de
              lo reportado por el equipo.
            </p>
          </div>


          <button
            type="button"
            onClick={
              cargarCierres
            }
            disabled={
              cargandoCierres
            }
          >
            {cargandoCierres
              ? "Actualizando..."
              : "🔄 Actualizar"}
          </button>
        </div>


        {cargandoCierres &&
        cierres.length === 0 ? (
          <p>
            Cargando cierres...
          </p>
        ) : cierres.length ===
          0 ? (
          <div
            style={{
              padding: "18px",
              border:
                "1px solid #ddd",
              borderRadius: "12px",
            }}
          >
            Todavía no hay cierres
            registrados.
          </div>
        ) : (
          <div
            style={{
              display: "grid",
              gap: "14px",
            }}
          >
            {cierres.map(
              (cierre) => (
                <article
                  key={
                    cierre.id
                  }
                  style={{
                    padding: "18px",
                    border:
                      "1px solid #333",
                    borderRadius:
                      "14px",
                  }}
                >
                  <div
                    style={{
                      display:
                        "flex",
                      justifyContent:
                        "space-between",
                      gap: "12px",
                      flexWrap:
                        "wrap",
                      marginBottom:
                        "14px",
                    }}
                  >
                    <div>
                      <strong>
                        👤{" "}
                        {
                          cierre.responsable
                        }
                      </strong>

                      <div
                        style={{
                          marginTop:
                            "4px",
                          opacity:
                            0.75,
                        }}
                      >
                        🕐{" "}
                        {cierre.turno ||
                          "Sin turno"}
                      </div>
                    </div>

                    <div>
                      📅{" "}
                      {formatearFecha(
                        cierre.fecha
                      )}
                    </div>
                  </div>


                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns:
                        "repeat(auto-fit, minmax(240px, 1fr))",
                      gap: "12px",
                    }}
                  >
                    <div>
                      <strong>
                        📌 Pendientes
                      </strong>

                      <p>
                        {mostrarDato(
                          cierre.pendientes
                        )}
                      </p>
                    </div>


                    <div>
                      <strong>
                        🚨 Incidencias
                      </strong>

                      <p>
                        {mostrarDato(
                          cierre.incidencias
                        )}
                      </p>
                    </div>


                    <div>
                      <strong>
                        🛍️ Productos solicitados
                      </strong>

                      <p>
                        {mostrarDato(
                          cierre
                            .productos_solicitados
                        )}
                      </p>
                    </div>


                    <div>
                      <strong>
                        💬 Objeciones
                      </strong>

                      <p>
                        {mostrarDato(
                          cierre
                            .objeciones_clientes
                        )}
                      </p>
                    </div>


                    <div>
                      <strong>
                        💡 Aprendizajes
                      </strong>

                      <p>
                        {mostrarDato(
                          cierre.aprendizajes
                        )}
                      </p>
                    </div>


                    <div>
                      <strong>
                        📝 Observaciones
                      </strong>

                      <p>
                        {mostrarDato(
                          cierre.observaciones
                        )}
                      </p>
                    </div>
                  </div>
                </article>
              )
            )}
          </div>
        )}
      </section>
    </section>
  );
}