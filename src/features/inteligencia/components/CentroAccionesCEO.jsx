import {
  useCallback,
  useEffect,
  useState,
} from "react";

import {
  obtenerHistorialDecisiones,
  guardarDecisionAprobada,
  guardarDecisionRechazada,
} from "../services/decisionesService";

import {
  ejecutarDecision,
} from "../engine/motorEjecutivoIA";


function CentroAccionesCEO({
  decisiones = [],
}) {
  const [decisionesPendientes, setDecisionesPendientes] =
    useState(decisiones);

  const [historial, setHistorial] =
    useState([]);

  const [errorHistorial, setErrorHistorial] =
    useState("");

  const [mensaje, setMensaje] =
    useState("");

  const [procesando, setProcesando] =
    useState(null);

  const [decisionesResueltas, setDecisionesResueltas] =
    useState(() => new Set());

 const obtenerClaveDecision = (decision) =>
  decision?.id ||
  [
    decision?.titulo || "decision",
    decision?.area || "general",
    decision?.descripcion || decision?.motivo || "",
  ].join("-");

  useEffect(() => {
    setDecisionesPendientes(
      decisiones.filter(
        (decision, index) =>
          !decisionesResueltas.has(
            obtenerClaveDecision(
              decision,
              index
            )
          )
      )
    );
  }, [
    decisiones,
    decisionesResueltas,
  ]);

  const cargarHistorial = useCallback(
    async () => {
      setErrorHistorial("");

      try {
        const registros =
          await obtenerHistorialDecisiones();

        setHistorial(registros);
      } catch (error) {
        console.error(
          "Error al cargar historial:",
          error
        );

        setErrorHistorial(
          error.message
        );
      }
    },
    []
  );

  useEffect(() => {
    cargarHistorial();
  }, [cargarHistorial]);

  const marcarDecisionResuelta = (
    decision,
    index
  ) => {
    const clave =
      obtenerClaveDecision(
        decision,
        index
      );

    setDecisionesResueltas(
      (anteriores) => {
        const nuevas =
          new Set(anteriores);

        nuevas.add(clave);

        return nuevas;
      }
    );

    setDecisionesPendientes(
      (anteriores) =>
        anteriores.filter(
          (item) =>
            item !== decision
        )
    );
  };

  const aprobar = async (
    decision,
    index
  ) => {
    const clave =
      obtenerClaveDecision(
        decision,
        index
      );

    try {
      setProcesando(clave);
      setMensaje("");

    const decisionGuardada =
  await guardarDecisionAprobada(
    decision
  );

const resultadoEjecucion =
  await ejecutarDecision({
    ...decision,
    id: decisionGuardada.id,
  });

 console.log("Motor ejecutó:", resultadoEjecucion);


      marcarDecisionResuelta(
        decision,
        index
      );

      setMensaje(
        `✅ Decisión aprobada: ${
          decision.titulo ||
          "Decisión ejecutiva"
        }`
      );

      await cargarHistorial();
    } catch (error) {
      console.error(
        "Error al aprobar decisión:",
        error
      );

      alert(
        error.message ||
          "No se pudo aprobar la decisión."
      );
    } finally {
      setProcesando(null);
    }
  };

  const rechazar = async (
    decision,
    index
  ) => {
    const clave =
      obtenerClaveDecision(
        decision,
        index
      );

    try {
      setProcesando(clave);
      setMensaje("");

      await guardarDecisionRechazada(
        decision
      );

      marcarDecisionResuelta(
        decision,
        index
      );

      setMensaje(
        `❌ Decisión rechazada: ${
          decision.titulo ||
          "Decisión ejecutiva"
        }`
      );

      await cargarHistorial();
    } catch (error) {
      console.error(
        "Error al rechazar decisión:",
        error
      );

      alert(
        error.message ||
          "No se pudo rechazar la decisión."
      );
    } finally {
      setProcesando(null);
    }
  };

  return (
    <section
      style={{
        marginTop: "28px",
        padding: "24px",
        borderRadius: "20px",
        background: "#ffffff",
        boxShadow:
          "0 10px 30px rgba(0,0,0,0.08)",
        textAlign: "center",
      }}
    >
      <h2
        style={{
          marginTop: 0,
          marginBottom: "10px",
          color: "#20191d",
        }}
      >
        🚀 Centro de Acciones del CEO
      </h2>

      <p
        style={{
          color: "#666666",
          marginBottom: "24px",
          fontSize: "16px",
        }}
      >
        El Director General puede ejecutar
        decisiones estratégicas desde aquí.
      </p>

      <div
        style={{
          marginBottom: "26px",
          textAlign: "left",
        }}
      >
        <h3
          style={{
            textAlign: "center",
            color: "#2c2030",
            marginBottom: "16px",
          }}
        >
          🎯 Decisiones prioritarias de hoy
        </h3>

        {decisionesPendientes.length === 0 ? (
          <div
            style={{
              padding: "18px",
              borderRadius: "14px",
              background: "#f8faf9",
              border:
                "1px solid #e0e8e3",
              color: "#66736b",
              textAlign: "center",
            }}
          >
            No hay decisiones pendientes
            por resolver.
          </div>
        ) : (
          decisionesPendientes.map(
            (decision, index) => {
              const clave =
                obtenerClaveDecision(
                  decision,
                  index
                );

              const estaProcesando =
                procesando === clave;

              const descripcion =
                decision.descripcion ||
                decision.motivo ||
                "";

              const tieneCosto =
                Number.isFinite(
                  Number(
                    decision.costo
                  )
                ) &&
                Number(
                  decision.costo
                ) > 0;

              return (
                <div
                  key={clave}
                  style={{
                    padding: "16px",
                    marginBottom:
                      "12px",
                    borderRadius:
                      "14px",
                    background:
                      "#faf7f9",
                    border:
                      "1px solid #eadde4",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      justifyContent:
                        "space-between",
                      gap: "12px",
                      flexWrap:
                        "wrap",
                    }}
                  >
                    <strong
                      style={{
                        color:
                          "#5e3048",
                        fontSize:
                          "17px",
                      }}
                    >
                      {decision.titulo ||
                        "Decisión ejecutiva"}
                    </strong>

                    <span
                      style={{
                        fontWeight:
                          "700",
                        color:
                          decision.prioridad ===
                          "CRITICA"
                            ? "#8b0000"
                            : decision.prioridad ===
                              "ALTA"
                            ? "#b42318"
                            : decision.prioridad ===
                              "MEDIA"
                            ? "#9a6700"
                            : "#41764b",
                      }}
                    >
                      {decision.prioridad ||
                        "MEDIA"}
                    </span>
                  </div>

                  {decision.area && (
                    <div
                      style={{
                        marginTop:
                          "8px",
                        fontSize:
                          "13px",
                        fontWeight:
                          "700",
                        color:
                          "#795c6c",
                      }}
                    >
                      Área:{" "}
                      {decision.area}
                    </div>
                  )}

                  {descripcion && (
                    <p
                      style={{
                        margin:
                          "10px 0 8px",
                        color:
                          "#555555",
                        lineHeight:
                          "1.5",
                      }}
                    >
                      {descripcion}
                    </p>
                  )}

                  {tieneCosto && (
                    <strong
                      style={{
                        display:
                          "block",
                        marginTop:
                          "8px",
                        color:
                          "#20191d",
                      }}
                    >
                      Inversión estimada: $
                      {Number(
                        decision.costo
                      ).toLocaleString(
                        "es-MX",
                        {
                          minimumFractionDigits:
                            2,
                          maximumFractionDigits:
                            2,
                        }
                      )}
                    </strong>
                  )}

                  <div
                    style={{
                      display: "flex",
                      gap: "10px",
                      marginTop:
                        "14px",
                      flexWrap:
                        "wrap",
                    }}
                  >
                    <button
                      type="button"
                      disabled={
                        estaProcesando
                      }
                      onClick={() =>
                        aprobar(
                          decision,
                          index
                        )
                      }
                      style={{
                        padding:
                          "10px 16px",
                        borderRadius:
                          "10px",
                        border:
                          "none",
                        background:
                          estaProcesando
                            ? "#b7cfc2"
                            : "#1d9b5f",
                        color:
                          "#ffffff",
                        fontWeight:
                          "700",
                        cursor:
                          estaProcesando
                            ? "not-allowed"
                            : "pointer",
                      }}
                    >
                      {estaProcesando
                        ? "Procesando..."
                        : "✅ Aprobar"}
                    </button>

                    <button
                      type="button"
                      disabled={
                        estaProcesando
                      }
                      onClick={() =>
                        rechazar(
                          decision,
                          index
                        )
                      }
                      style={{
                        padding:
                          "10px 16px",
                        borderRadius:
                          "10px",
                        border:
                          "1px solid #d8b6c7",
                        background:
                          "#ffffff",
                        color:
                          "#7a3f5d",
                        fontWeight:
                          "700",
                        cursor:
                          estaProcesando
                            ? "not-allowed"
                            : "pointer",
                      }}
                    >
                      ❌ Rechazar
                    </button>
                  </div>
                </div>
              );
            }
          )
        )}
      </div>

      {mensaje && (
        <div
          style={{
            marginTop: "18px",
            marginBottom: "18px",
            padding: "14px 16px",
            borderRadius: "12px",
            background:
              mensaje.startsWith("❌")
                ? "#fff4f4"
                : "#eef8f2",
            border:
              mensaje.startsWith("❌")
                ? "1px solid #efc0c0"
                : "1px solid #b9ddc7",
            color:
              mensaje.startsWith("❌")
                ? "#9b3030"
                : "#236b45",
            fontWeight: "700",
          }}
        >
          {mensaje}
        </div>
      )}

      <div
        style={{
          marginTop: "28px",
          paddingTop: "22px",
          borderTop:
            "1px solid #eeeeee",
          textAlign: "left",
        }}
      >
        <h3
          style={{
            margin: "0 0 16px",
            color: "#2c2030",
            textAlign: "center",
          }}
        >
          📜 Historial de decisiones
        </h3>

        {errorHistorial && (
          <div
            style={{
              marginBottom:
                "14px",
              padding: "12px",
              borderRadius:
                "10px",
              background:
                "#fff3f3",
              border:
                "1px solid #efb9b9",
              color: "#9b3030",
              fontSize:
                "14px",
              textAlign:
                "center",
            }}
          >
            No fue posible cargar el
            historial:
            <br />
            {errorHistorial}
          </div>
        )}

        {!errorHistorial &&
          historial.length === 0 && (
            <p
              style={{
                textAlign:
                  "center",
                color:
                  "#777777",
              }}
            >
              Todavía no hay decisiones
              registradas.
            </p>
          )}

        {!errorHistorial &&
          historial
            .slice(0, 10)
            .map((decision) => {
              const rechazada =
                String(
                  decision.estado
                ).toUpperCase() ===
                "RECHAZADA";

              const aprobada =
                String(
                  decision.estado
                ).toUpperCase() ===
                "APROBADA";

              return (
                <div
                  key={decision.id}
                  style={{
                    padding:
                      "14px 16px",
                    marginBottom:
                      "10px",
                    borderRadius:
                      "12px",
                    background:
                      rechazada
                        ? "#fff6f6"
                        : "#faf7f9",
                    border:
                      rechazada
                        ? "1px solid #efcccc"
                        : "1px solid #eadde4",
                  }}
                >
                  <strong
                    style={{
                      color:
                        rechazada
                          ? "#a63a3a"
                          : "#5e3048",
                    }}
                  >
                    {rechazada
                      ? "❌"
                      : "✅"}{" "}
                    {
                      decision.tipo_decision
                    }
                  </strong>

                  {(aprobada ||
                    rechazada) && (
                    <div
                      style={{
                        marginTop:
                          "6px",
                        fontSize:
                          "13px",
                        fontWeight:
                          "800",
                        color:
                          rechazada
                            ? "#b42318"
                            : "#1d7a4d",
                      }}
                    >
                      {decision.estado}
                    </div>
                  )}

                  <div
                    style={{
                      marginTop:
                        "6px",
                      color:
                        "#333333",
                    }}
                  >
                    {
                      decision.descripcion
                    }
                  </div>

                  <div
                    style={{
                      marginTop:
                        "7px",
                      fontSize:
                        "13px",
                      color:
                        "#777777",
                    }}
                  >
                    {decision.autorizado_por ||
                      "Director General IA"}

                    {decision.creado_en && (
                      <>
                        {" · "}
                        {new Date(
                          decision.creado_en
                        ).toLocaleString(
                          "es-MX"
                        )}
                      </>
                    )}
                  </div>
                </div>
              );
            })}
      </div>
    </section>
  );
}

export default CentroAccionesCEO;