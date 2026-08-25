import {
  useEffect,
  useState,
} from "react";

import {
  obtenerHistorialPlanesCompra,
} from "../services/compraPlanService";

function formatearNumero(valor) {
  return Number(
    valor || 0
  ).toLocaleString("es-MX");
}

function formatearDinero(valor) {
  return Number(
    valor || 0
  ).toLocaleString(
    "es-MX",
    {
      style: "currency",
      currency: "MXN",
      minimumFractionDigits: 2,
    }
  );
}

function formatearFecha(valor) {
  if (!valor) {
    return "Sin fecha";
  }

  const fecha =
    new Date(valor);

  if (
    Number.isNaN(
      fecha.getTime()
    )
  ) {
    return "Sin fecha";
  }

  return fecha.toLocaleString(
    "es-MX",
    {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }
  );
}

function obtenerTextoEstado(
  estado
) {
  switch (estado) {
    case "aprobado":
      return "Aprobado";

    case "en_proceso":
      return "En proceso";

    case "completado":
      return "Completado";

    case "cancelado":
      return "Cancelado";

    case "borrador":
    default:
      return "Borrador";
  }
}

export default function HistorialCompraMaestra() {
  const [
    planes,
    setPlanes,
  ] = useState([]);

  const [
    cargando,
    setCargando,
  ] = useState(true);

  const [
    error,
    setError,
  ] = useState("");

  async function cargarHistorial() {
    try {
      setCargando(true);
      setError("");

      const resultado =
        await obtenerHistorialPlanesCompra(
          20
        );

      setPlanes(
        Array.isArray(resultado)
          ? resultado
          : []
      );
    } catch (errorCarga) {
      console.error(
        "Error al cargar historial:",
        errorCarga
      );

      setError(
        errorCarga?.message ||
          "No fue posible cargar el historial."
      );
    } finally {
      setCargando(false);
    }
  }

  useEffect(() => {
    cargarHistorial();
  }, []);

  return (
    <section
      style={{
        marginTop: "32px",
        marginBottom: "32px",
        padding: "24px",
        backgroundColor:
          "#ffffff",
        border:
          "1px solid #ead5df",
        borderRadius: "20px",
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
          marginBottom: "8px",
        }}
      >
        <div>
          <h2
            style={{
              margin: 0,
              color: "#8f2858",
            }}
          >
            📚 Historial de Compras Maestras
          </h2>

          <p
            style={{
              margin:
                "8px 0 0 0",
              color: "#6f666a",
              lineHeight: 1.5,
            }}
          >
            Consulta las fotografías
            guardadas de decisiones
            anteriores de compra y
            traspasos.
          </p>
        </div>

        <button
          type="button"
          onClick={
            cargarHistorial
          }
          disabled={
            cargando
          }
          style={{
            padding:
              "10px 16px",
            borderRadius:
              "11px",
            border:
              "1px solid #d7a9be",
            backgroundColor:
              "#fff7fa",
            color:
              "#8f2858",
            fontWeight: 800,
            cursor:
              cargando
                ? "default"
                : "pointer",
          }}
        >
          {cargando
            ? "Actualizando..."
            : "↻ Actualizar"}
        </button>
      </div>

      {cargando && (
        <div
          style={{
            marginTop: "22px",
            padding: "18px",
            borderRadius:
              "14px",
            backgroundColor:
              "#faf7f8",
            color: "#6f666a",
          }}
        >
          Cargando historial...
        </div>
      )}

      {!cargando &&
        error && (
          <div
            style={{
              marginTop:
                "22px",
              padding: "18px",
              borderRadius:
                "14px",
              backgroundColor:
                "#fff2f2",
              border:
                "1px solid #efcaca",
              color: "#a52d2d",
              fontWeight: 700,
            }}
          >
            ❌ {error}
          </div>
        )}

      {!cargando &&
        !error &&
        planes.length ===
          0 && (
          <div
            style={{
              marginTop:
                "22px",
              padding: "22px",
              borderRadius:
                "14px",
              backgroundColor:
                "#faf7f8",
              textAlign:
                "center",
              color: "#6f666a",
            }}
          >
            Todavía no hay
            Compras Maestras
            guardadas.
          </div>
        )}

      {!cargando &&
        !error &&
        planes.length >
          0 && (
          <div
            style={{
              display:
                "grid",
              gap: "16px",
              marginTop:
                "22px",
            }}
          >
            {planes.map(
              (
                plan,
                indice
              ) => (
                <article
                  key={
                    plan.id
                  }
                  style={{
                    padding:
                      "20px",
                    borderRadius:
                      "16px",
                    border:
                      "1px solid #ead5df",
                    backgroundColor:
                      indice ===
                      0
                        ? "#fff9fc"
                        : "#ffffff",
                  }}
                >
                  <div
                    style={{
                      display:
                        "flex",
                      justifyContent:
                        "space-between",
                      alignItems:
                        "flex-start",
                      gap:
                        "14px",
                      flexWrap:
                        "wrap",
                    }}
                  >
                    <div>
                      <div
                        style={{
                          display:
                            "flex",
                          alignItems:
                            "center",
                          gap:
                            "9px",
                          flexWrap:
                            "wrap",
                        }}
                      >
                        <strong
                          style={{
                            fontSize:
                              "17px",
                          }}
                        >
                          🛒 Compra
                          Maestra
                        </strong>

                        {indice ===
                          0 && (
                          <span
                            style={{
                              padding:
                                "4px 9px",
                              borderRadius:
                                "999px",
                              backgroundColor:
                                "#f5dce7",
                              color:
                                "#8f2858",
                              fontSize:
                                "12px",
                              fontWeight:
                                800,
                            }}
                          >
                            MÁS
                            RECIENTE
                          </span>
                        )}
                      </div>

                      <div
                        style={{
                          marginTop:
                            "7px",
                          color:
                            "#6f666a",
                          fontSize:
                            "14px",
                        }}
                      >
                        📅{" "}
                        {formatearFecha(
                          plan.fechaPlan
                        )}
                      </div>
                    </div>

                    <span
                      style={{
                        padding:
                          "6px 11px",
                        borderRadius:
                          "999px",
                        backgroundColor:
                          "#f4f1f2",
                        color:
                          "#5f5559",
                        fontSize:
                          "13px",
                        fontWeight:
                          800,
                      }}
                    >
                      {obtenerTextoEstado(
                        plan.estado
                      )}
                    </span>
                  </div>

                  <div
                    style={{
                      display:
                        "grid",
                      gridTemplateColumns:
                        "repeat(auto-fit, minmax(150px, 1fr))",
                      gap:
                        "12px",
                      marginTop:
                        "18px",
                    }}
                  >
                    <div
                      style={{
                        padding:
                          "13px",
                        borderRadius:
                          "12px",
                        backgroundColor:
                          "#faf7f8",
                      }}
                    >
                      <div
                        style={{
                          fontSize:
                            "12px",
                          color:
                            "#766b70",
                        }}
                      >
                        Productos
                      </div>

                      <strong
                        style={{
                          display:
                            "block",
                          marginTop:
                            "4px",
                          fontSize:
                            "19px",
                        }}
                      >
                        {formatearNumero(
                          plan.totalProductosComprar
                        )}
                      </strong>
                    </div>

                    <div
                      style={{
                        padding:
                          "13px",
                        borderRadius:
                          "12px",
                        backgroundColor:
                          "#faf7f8",
                      }}
                    >
                      <div
                        style={{
                          fontSize:
                            "12px",
                          color:
                            "#766b70",
                        }}
                      >
                        Necesidad
                        inicial
                      </div>

                      <strong
                        style={{
                          display:
                            "block",
                          marginTop:
                            "4px",
                          fontSize:
                            "19px",
                        }}
                      >
                        {formatearNumero(
                          plan.totalNecesidadAntesTraspasos
                        )}{" "}
                        pzas
                      </strong>
                    </div>

                    <div
                      style={{
                        padding:
                          "13px",
                        borderRadius:
                          "12px",
                        backgroundColor:
                          "#f2f7ff",
                      }}
                    >
                      <div
                        style={{
                          fontSize:
                            "12px",
                          color:
                            "#58718f",
                        }}
                      >
                        Cubiertas por
                        traspaso
                      </div>

                      <strong
                        style={{
                          display:
                            "block",
                          marginTop:
                            "4px",
                          fontSize:
                            "19px",
                        }}
                      >
                        {formatearNumero(
                          plan.totalCubiertoPorTraspasos
                        )}{" "}
                        pzas
                      </strong>
                    </div>

                    <div
                      style={{
                        padding:
                          "13px",
                        borderRadius:
                          "12px",
                        backgroundColor:
                          "#f1faf4",
                      }}
                    >
                      <div
                        style={{
                          fontSize:
                            "12px",
                          color:
                            "#52745e",
                        }}
                      >
                        Compra final
                      </div>

                      <strong
                        style={{
                          display:
                            "block",
                          marginTop:
                            "4px",
                          fontSize:
                            "19px",
                        }}
                      >
                        {formatearNumero(
                          plan.totalPiezasComprar
                        )}{" "}
                        pzas
                      </strong>
                    </div>

                    <div
                      style={{
                        padding:
                          "13px",
                        borderRadius:
                          "12px",
                        backgroundColor:
                          "#fff9ed",
                      }}
                    >
                      <div
                        style={{
                          fontSize:
                            "12px",
                          color:
                            "#806d42",
                        }}
                      >
                        Inversión
                      </div>

                      <strong
                        style={{
                          display:
                            "block",
                          marginTop:
                            "4px",
                          fontSize:
                            "19px",
                        }}
                      >
                        {formatearDinero(
                          plan.inversionTotal
                        )}
                      </strong>
                    </div>

                    <div
                      style={{
                        padding:
                          "13px",
                        borderRadius:
                          "12px",
                        backgroundColor:
                          "#faf7f8",
                      }}
                    >
                      <div
                        style={{
                          fontSize:
                            "12px",
                          color:
                            "#766b70",
                        }}
                      >
                        Cobertura
                      </div>

                      <strong
                        style={{
                          display:
                            "block",
                          marginTop:
                            "4px",
                          fontSize:
                            "19px",
                        }}
                      >
                        {formatearNumero(
                          plan.coberturaObjetivoDias
                        )}{" "}
                        días
                      </strong>
                    </div>
                  </div>

                  <div
                    style={{
                      marginTop:
                        "15px",
                      color:
                        "#766b70",
                      fontSize:
                        "13px",
                    }}
                  >
                    Traspasos
                    registrados:{" "}
                    <strong>
                      {formatearNumero(
                        plan
                          ?.resumen
                          ?.totalTraspasos
                      )}
                    </strong>
                    {" · "}
                    Piezas por
                    traspasar:{" "}
                    <strong>
                      {formatearNumero(
                        plan
                          ?.resumen
                          ?.totalPiezasTraspaso
                      )}
                    </strong>
                  </div>
                </article>
              )
            )}
          </div>
        )}
    </section>
  );
}