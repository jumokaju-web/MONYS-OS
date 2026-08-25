// ======================================================
// MONYS OS
// Acciones Prioritarias del Día
// Finanzas + Patrones Operativos
// + Creación Automática de Tareas
// ======================================================

import {
  useEffect,
  useState,
} from "react";

import {
  generarAnalisisFinanciero,
} from "../ia/directorFinancieroIA";

import {
  obtenerPrioridadesDesdePatrones,
} from "../services/patronesOperativosService";

import {
  crearTareasAutomaticasDesdePatrones,
} from "../services/tareasOperativasService";


function AccionesPrioritarias({
  datosDashboard,
  movimientos = [],
  branchId = null,
}) {
  const [
    prioridadesPatrones,
    setPrioridadesPatrones,
  ] = useState([]);

  const [
    cargandoPatrones,
    setCargandoPatrones,
  ] = useState(false);

  const [
    automatizacionTareas,
    setAutomatizacionTareas,
  ] = useState({
    procesando: false,
    creadas: 0,
    duplicadas: 0,
    errores: 0,
  });


  const metricas =
    datosDashboard?.metricas || {};


  const analisisFinanciero =
    generarAnalisisFinanciero({
      movimientos,

      ventasTotales:
        metricas.ventasTotales ?? 0,

      costoTotal:
        metricas.costoTotal ?? 0,

      utilidadTotal:
        metricas.utilidadTotal ?? 0,

      margenUtilidad:
        metricas.margenUtilidad ?? 0,

      fechaInicial:
        metricas.fechaInicial ?? null,

      fechaFinal:
        metricas.fechaFinal ?? null,

      diasAnalizados:
        metricas.diasAnalizados ?? 0,

      ventaPromedioDiaria:
        metricas.ventaPromedioDiaria ?? 0,

      utilidadPromedioDiaria:
        metricas.utilidadPromedioDiaria ?? 0,
    });


  const accionesFinancieras =
    analisisFinanciero
      ?.accionesPrioritarias ||
    [];


  useEffect(() => {
    let activo = true;


    async function cargarPrioridadesPatrones() {
      try {
        setCargandoPatrones(true);

        const data =
          await obtenerPrioridadesDesdePatrones({
            branchId,
          });


        if (!activo) {
          return;
        }


        const prioridades =
          Array.isArray(data)
            ? data
            : [];


        setPrioridadesPatrones(
          prioridades
        );


        // ==============================================
        // MONYS OS
        // CREACIÓN AUTOMÁTICA DE TAREAS
        //
        // Solo prioridades:
        // ALTA / CRÍTICA / URGENTE
        //
        // El servicio evita duplicarlas
        // dentro del mismo día.
        // ==============================================

        try {
          setAutomatizacionTareas(
            (estadoAnterior) => ({
              ...estadoAnterior,
              procesando: true,
            })
          );


          const resultadoAutomatizacion =
            await crearTareasAutomaticasDesdePatrones({
              prioridades,

              organizationId:
                datosDashboard
                  ?.organization_id ||
                null,

              businessId:
                datosDashboard
                  ?.business_id ||
                null,

              branchId:
                branchId ||
                datosDashboard
                  ?.branch_id ||
                null,

              creadaPor:
                "MONYS OS",
            });


          if (!activo) {
            return;
          }


          setAutomatizacionTareas({
            procesando: false,

            creadas:
              resultadoAutomatizacion
                ?.creadas || 0,

            duplicadas:
              resultadoAutomatizacion
                ?.duplicadas || 0,

            errores:
              resultadoAutomatizacion
                ?.errores || 0,
          });


          if (
            resultadoAutomatizacion
              ?.creadas > 0
          ) {
            console.log(
              "MONYS creó tareas automáticamente:",
              resultadoAutomatizacion
            );
          }


          if (
            resultadoAutomatizacion
              ?.duplicadas > 0
          ) {
            console.log(
              "MONYS evitó tareas duplicadas:",
              resultadoAutomatizacion
            );
          }


          if (
            resultadoAutomatizacion
              ?.errores > 0
          ) {
            console.error(
              "Algunas tareas automáticas no pudieron crearse:",
              resultadoAutomatizacion
            );
          }
        } catch (
          errorAutomatizacion
        ) {
          console.error(
            "Error en automatización de tareas desde patrones:",
            errorAutomatizacion
          );


          if (activo) {
            setAutomatizacionTareas({
              procesando: false,
              creadas: 0,
              duplicadas: 0,
              errores: 1,
            });
          }
        }
      } catch (
        errorPatrones
      ) {
        console.error(
          "Error al cargar prioridades desde patrones:",
          errorPatrones
        );

        if (activo) {
          setPrioridadesPatrones([]);
        }
      } finally {
        if (activo) {
          setCargandoPatrones(false);
        }
      }
    }


    cargarPrioridadesPatrones();


    return () => {
      activo = false;
    };
  }, [
    branchId,
    datosDashboard?.organization_id,
    datosDashboard?.business_id,
    datosDashboard?.branch_id,
  ]);


  function normalizarPrioridad(
    prioridad
  ) {
    const valor =
      String(
        prioridad || ""
      ).toUpperCase();


    if (
      valor === "URGENTE" ||
      valor === "CRITICA" ||
      valor === "CRÍTICA"
    ) {
      return "CRITICA";
    }


    if (valor === "ALTA") {
      return "ALTA";
    }


    if (
      valor === "NORMAL" ||
      valor === "MEDIA"
    ) {
      return "MEDIA";
    }


    return "BAJA";
  }


  function pesoPrioridad(
    prioridad
  ) {
    const prioridadNormalizada =
      normalizarPrioridad(
        prioridad
      );


    switch (
      prioridadNormalizada
    ) {
      case "CRITICA":
        return 4;

      case "ALTA":
        return 3;

      case "MEDIA":
        return 2;

      default:
        return 1;
    }
  }


  const accionesFinancierasPreparadas =
    accionesFinancieras.map(
      (
        accion,
        indice
      ) => ({
        ...accion,

        id:
          accion.id ||
          `financiera-${indice}`,

        prioridad:
          normalizarPrioridad(
            accion.prioridad
          ),

        origen:
          "DIRECTOR_FINANCIERO",

        origenTexto:
          "Director Financiero",

        responsable:
          accion.responsable ||
          "Director Financiero",

        impacto:
          accion.impacto ||
          accion.prioridad ||
          "NORMAL",

        confianza:
          null,
      })
    );


  const accionesPatronesPreparadas =
    prioridadesPatrones.map(
      (
        accion,
        indice
      ) => ({
        ...accion,

        id:
          accion.id ||
          `patron-${indice}`,

        prioridad:
          normalizarPrioridad(
            accion.prioridad
          ),

        origenTexto:
          "Patrones de cierres",

        responsable:
          "Operación",

        impacto:
          accion.requiereAtencion
            ? "ALTO"
            : accion.prioridad ===
              "ALTA"
            ? "ALTO"
            : "MEDIO",

        confianza:
          Number(
            accion.confianza || 0
          ),
      })
    );


  const acciones =
    [
      ...accionesFinancierasPreparadas,
      ...accionesPatronesPreparadas,
    ]
      .sort(
        (a, b) =>
          pesoPrioridad(
            b.prioridad
          ) -
          pesoPrioridad(
            a.prioridad
          )
      )
      .slice(0, 10);


  const obtenerEstiloPrioridad = (
    prioridad
  ) => {
    switch (
      normalizarPrioridad(
        prioridad
      )
    ) {
      case "CRITICA":
        return {
          icono: "🔴",
          fondo: "#fff0f0",
          borde: "#e7a3a3",
          texto: "#8b2020",
        };

      case "ALTA":
        return {
          icono: "🟠",
          fondo: "#fff6ed",
          borde: "#efbd84",
          texto: "#8a4b16",
        };

      case "MEDIA":
        return {
          icono: "🟡",
          fondo: "#fffceb",
          borde: "#dfcc72",
          texto: "#746010",
        };

      default:
        return {
          icono: "🟢",
          fondo: "#effbf3",
          borde: "#a9d8b7",
          texto: "#24633a",
        };
    }
  };


  if (
    acciones.length === 0 &&
    !cargandoPatrones
  ) {
    return null;
  }


  return (
    <section
      style={{
        marginTop: "28px",
        marginBottom: "30px",
        padding: "26px",
        borderRadius: "22px",

        background:
          "linear-gradient(135deg, #ffffff 0%, #fff4f8 100%)",

        border:
          "1px solid #ebc2d1",

        boxShadow:
          "0 10px 30px rgba(112, 45, 75, 0.08)",
      }}
    >
      <div
        style={{
          textAlign: "center",
          marginBottom: "22px",
        }}
      >
        <h2
          style={{
            margin: 0,
            fontSize: "26px",
            fontWeight: "800",
          }}
        >
          🎯 Decisiones prioritarias de hoy
        </h2>


        <p
          style={{
            marginTop: "8px",
            marginBottom: 0,
            color: "#75656d",
            lineHeight: "1.6",
          }}
        >
          MONYS OS ordenó automáticamente
          las acciones que requieren tu
          atención combinando información
          financiera y señales de la
          operación.
        </p>
      </div>


      {cargandoPatrones && (
        <div
          style={{
            padding: "12px",
            marginBottom: "14px",
            textAlign: "center",
            border:
              "1px solid #ddd",
            borderRadius: "12px",
          }}
        >
          🧠 MONYS está incorporando
          los patrones operativos...
        </div>
      )}


      {automatizacionTareas.procesando && (
        <div
          style={{
            padding: "12px",
            marginBottom: "14px",
            textAlign: "center",

            border:
              "1px solid #c9b6dc",

            background:
              "#faf6ff",

            borderRadius: "12px",

            color:
              "#5b4175",

            fontWeight:
              "700",
          }}
        >
          ⚙️ MONYS está revisando si
          debe crear tareas automáticas...
        </div>
      )}


      {automatizacionTareas.creadas > 0 && (
        <div
          style={{
            padding: "12px",
            marginBottom: "14px",

            border:
              "1px solid #9bcfa9",

            background:
              "#effbf3",

            borderRadius: "12px",

            color:
              "#24633a",

            fontWeight:
              "700",

            textAlign:
              "center",
          }}
        >
          ✅ MONYS creó{" "}
          {automatizacionTareas.creadas}{" "}
          {automatizacionTareas.creadas === 1
            ? "tarea automática"
            : "tareas automáticas"}{" "}
          a partir de prioridades
          operativas.
        </div>
      )}


      {automatizacionTareas.errores > 0 && (
        <div
          style={{
            padding: "12px",
            marginBottom: "14px",

            border:
              "1px solid #e7a3a3",

            background:
              "#fff0f0",

            borderRadius: "12px",

            color:
              "#8b2020",

            fontWeight:
              "700",

            textAlign:
              "center",
          }}
        >
          ⚠️ MONYS detectó un problema
          al crear alguna tarea
          automática.
        </div>
      )}


      <div
        style={{
          display: "grid",
          gap: "14px",
        }}
      >
        {acciones.map(
          (
            accion,
            indice
          ) => {
            const estilo =
              obtenerEstiloPrioridad(
                accion.prioridad
              );


            return (
              <article
                key={
                  accion.id ||
                  `${accion.titulo}-${indice}`
                }

                style={{
                  padding: "18px",

                  borderRadius:
                    "16px",

                  backgroundColor:
                    estilo.fondo,

                  border:
                    `1px solid ${estilo.borde}`,
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

                    flexWrap:
                      "wrap",
                  }}
                >
                  <strong
                    style={{
                      fontSize:
                        "17px",

                      color:
                        estilo.texto,
                    }}
                  >
                    {estilo.icono}{" "}
                    PRIORIDAD{" "}
                    {indice + 1}:{" "}
                    {accion.titulo}
                  </strong>


                  <span
                    style={{
                      fontSize:
                        "13px",

                      fontWeight:
                        "800",

                      color:
                        estilo.texto,
                    }}
                  >
                    Impacto:{" "}
                    {accion.impacto ||
                      "NORMAL"}
                  </span>
                </div>


                <p
                  style={{
                    marginTop:
                      "10px",

                    marginBottom:
                      "10px",

                    lineHeight:
                      "1.6",

                    color:
                      "#493e43",
                  }}
                >
                  {accion.descripcion}
                </p>


                <div
                  style={{
                    display: "flex",

                    gap: "10px",

                    flexWrap:
                      "wrap",

                    alignItems:
                      "center",
                  }}
                >
                  <small
                    style={{
                      color:
                        "#75656d",

                      fontWeight:
                        "600",
                    }}
                  >
                    Responsable:{" "}
                    {accion.responsable ||
                      "MONYS OS"}
                  </small>


                  <small
                    style={{
                      color:
                        "#75656d",

                      fontWeight:
                        "600",
                    }}
                  >
                    • Fuente:{" "}
                    {accion.origenTexto ||
                      "MONYS OS"}
                  </small>


                  {accion.confianza !==
                    null &&
                    accion.confianza !==
                      undefined && (
                      <small
                        style={{
                          color:
                            "#75656d",

                          fontWeight:
                            "600",
                        }}
                      >
                        • Confianza:{" "}
                        {Math.round(
                          Number(
                            accion.confianza ||
                              0
                          )
                        )}
                        %
                      </small>
                    )}


                  {accion.origen ===
                    "PATRONES_CIERRES" &&
                    (
                      accion.prioridad ===
                        "ALTA" ||
                      accion.prioridad ===
                        "CRITICA"
                    ) && (
                      <small
                        style={{
                          padding:
                            "4px 8px",

                          borderRadius:
                            "8px",

                          background:
                            "#ffffff",

                          color:
                            estilo.texto,

                          fontWeight:
                            "800",
                        }}
                      >
                        ⚙️ Tarea automática
                      </small>
                    )}
                </div>
              </article>
            );
          }
        )}
      </div>
    </section>
  );
}


export default AccionesPrioritarias;