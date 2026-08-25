import {
  useEffect,
  useState,
} from "react";

import {
  generarRecomendacionesRebalanceo,
} from "../services/rebalanceoInventarioService";

import {
  crearTareasPrioritariasRebalanceo,
} from "../../inteligencia/services/tareasRebalanceoService";

function obtenerEstiloPrioridad(
  prioridad
) {
  if (prioridad === "ALTA") {
    return {
      icono: "🔴",
      fondo: "#fff0f0",
      borde: "#efb8b8",
      color: "#a52d2d",
    };
  }

  if (prioridad === "MEDIA") {
    return {
      icono: "🟡",
      fondo: "#fff8df",
      borde: "#f2dc8b",
      color: "#8a6800",
    };
  }

  return {
    icono: "🟢",
    fondo: "#eefbf3",
    borde: "#b8e5ca",
    color: "#207a4a",
  };
}

function RecomendacionesRebalanceo() {
  const [
    recomendaciones,
    setRecomendaciones,
  ] = useState([]);

  const [
    cargando,
    setCargando,
  ] = useState(true);

  const [
    error,
    setError,
  ] = useState("");

  const [
  creandoTareas,
  setCreandoTareas,
] = useState(false);

const [
  mensajeTareas,
  setMensajeTareas,
] = useState("");

  useEffect(() => {
    cargarRecomendaciones();
  }, []);

  async function cargarRecomendaciones() {
    try {
      setCargando(true);
      setError("");

      const resultado =
        await generarRecomendacionesRebalanceo();

      setRecomendaciones(
        resultado ?? []
      );
    } catch (error) {
      console.error(
        "Error al generar recomendaciones de rebalanceo:",
        error
      );

      setError(
        error?.message ||
          "No fue posible generar recomendaciones."
      );
    } finally {
      setCargando(false);
    }
  }
 
  function imprimirTraspasos(
  sucursalOrigen,
  sucursalDestino
) {
  const lista =
    recomendaciones.filter(
      (item) =>
        item.sucursalOrigen ===
          sucursalOrigen &&
        item.sucursalDestino ===
          sucursalDestino &&
        Number(
          item.cantidadSugerida || 0
        ) > 0
    );

  if (lista.length === 0) {
    window.alert(
      `MONYS no encontró traspasos de ${sucursalOrigen} a ${sucursalDestino}.`
    );

    return;
  }

  function escapar(valor) {
    return String(valor ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;");
  }

  const filas =
    lista
      .map(
        (
          item,
          index
        ) => `
          <tr>
            <td>${index + 1}</td>

            <td>
              <strong>
                ${escapar(
                  item.producto
                )}
              </strong>

              ${
                item.codigo
                  ? `<div class="codigo">
                      ${escapar(
                        item.codigo
                      )}
                    </div>`
                  : ""
              }
            </td>

            <td>
              ${escapar(
                item.existenciaOrigen
              )}
            </td>

            <td>
              ${escapar(
                item.existenciaDestino
              )}
            </td>

            <td>
              <strong>
                ${escapar(
                  item.cantidadSugerida
                )}
              </strong>
            </td>

            <td></td>

            <td></td>

            <td></td>
          </tr>
        `
      )
      .join("");

  const totalPiezas =
    lista.reduce(
      (total, item) =>
        total +
        Number(
          item.cantidadSugerida || 0
        ),
      0
    );

  const ventana =
    window.open(
      "",
      "_blank",
      "width=1200,height=800"
    );

  if (!ventana) {
    window.alert(
      "El navegador bloqueó la ventana de impresión."
    );

    return;
  }

  ventana.document.write(`
    <!DOCTYPE html>

    <html>
      <head>
        <meta charset="UTF-8" />

        <title>
          Traspaso ${escapar(
            sucursalOrigen
          )} a ${escapar(
            sucursalDestino
          )}
        </title>

        <style>
          body {
            font-family: Arial, sans-serif;
            margin: 24px;
            color: #222;
          }

          h1 {
            margin-bottom: 5px;
          }

          .ruta {
            font-size: 20px;
            font-weight: 800;
            margin-bottom: 15px;
          }

          .resumen {
            display: flex;
            justify-content: space-between;
            gap: 20px;
            margin-bottom: 18px;
          }

          table {
            width: 100%;
            border-collapse: collapse;
            font-size: 12px;
          }

          th,
          td {
            border: 1px solid #888;
            padding: 7px;
            vertical-align: top;
          }

          th {
            background: #f4f4f4;
          }

          .codigo {
            margin-top: 3px;
            font-size: 10px;
            color: #666;
          }

          .firmas {
            margin-top: 40px;
            display: grid;
            grid-template-columns:
              1fr 1fr;
            gap: 70px;
          }

          .firma {
            border-top:
              1px solid #333;
            text-align: center;
            padding-top: 7px;
          }

          @media print {
            body {
              margin: 10mm;
            }
          }
        </style>
      </head>

      <body>
        <h1>
          MONYS OS · Hoja de Traspaso
        </h1>

        <div class="ruta">
          ${escapar(
            sucursalOrigen
          )}
          →
          ${escapar(
            sucursalDestino
          )}
        </div>

        <div class="resumen">
          <div>
            <strong>Fecha:</strong>
            ${new Date().toLocaleDateString(
              "es-MX"
            )}
          </div>

          <div>
            <strong>Productos:</strong>
            ${lista.length}
          </div>

          <div>
            <strong>Piezas sugeridas:</strong>
            ${totalPiezas}
          </div>
        </div>

        <table>
          <thead>
            <tr>
              <th>#</th>
              <th>Producto / código</th>
              <th>Existencia origen</th>
              <th>Existencia destino</th>
              <th>MONYS sugiere enviar</th>
              <th>Preparado físico</th>
              <th>Recibido físico</th>
              <th>Observaciones</th>
            </tr>
          </thead>

          <tbody>
            ${filas}
          </tbody>
        </table>

        <div class="firmas">
          <div class="firma">
            Preparó en
            ${escapar(
              sucursalOrigen
            )}
          </div>

          <div class="firma">
            Recibió en
            ${escapar(
              sucursalDestino
            )}
          </div>
        </div>

        <script>
          window.onload =
            function () {
              window.print();
            };
        </script>
      </body>
    </html>
  `);

  ventana.document.close();
}


async function crearTareasDesdeRebalanceo() {
  try {
    setCreandoTareas(true);
    setMensajeTareas("");

    const resultado =
      await crearTareasPrioritariasRebalanceo({
        maximo: 3,
      });

    setMensajeTareas(
      `MONYS revisó ${resultado.revisadas} recomendaciones prioritarias. ` +
      `Creó ${resultado.creadas} tareas, evitó ${resultado.duplicadas} duplicadas y tuvo ${resultado.errores} errores.`
    );
  } catch (errorTareas) {
    console.error(
      "Error al crear tareas desde rebalanceo:",
      errorTareas
    );

    setMensajeTareas(
      errorTareas?.message ||
        "MONYS no pudo crear las tareas de rebalanceo."
    );
  } finally {
    setCreandoTareas(false);
  }
}

  if (cargando) {
    return (
      <section
        style={{
          marginTop: "24px",
          padding: "24px",
          borderRadius: "20px",
          backgroundColor: "#ffffff",
          border:
            "1px solid #d9e7ef",
        }}
      >
        <strong>
          Analizando oportunidades
          de traspaso...
        </strong>
      </section>
    );
  }

  return (
    <section
      style={{
        marginTop: "24px",
        padding: "24px",
        borderRadius: "20px",
        background:
          "linear-gradient(135deg, #ffffff 0%, #f4fbff 100%)",
        border:
          "1px solid #b8dff5",
        boxShadow:
          "0 10px 28px rgba(39, 120, 170, 0.10)",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent:
            "space-between",
          alignItems: "center",
          gap: "15px",
          flexWrap: "wrap",
        }}
      >
        <div>
          <p
            style={{
              margin: "0 0 5px",
              color: "#287da9",
              fontWeight: "800",
              letterSpacing:
                "0.8px",
            }}
          >
            MONYS OS · INVENTARIO IA
          </p>

          <h2
            style={{
              margin: 0,
              fontSize: "26px",
            }}
          >
            🧠 Rebalanceo inteligente
          </h2>
        </div>
<div
  style={{
    display: "flex",
    gap: "10px",
    flexWrap: "wrap",
    marginTop: "16px",
  }}
>
  <button
    type="button"
    onClick={() =>
      imprimirTraspasos(
        "General Anaya",
        "Centro"
      )
    }
    style={{
      padding: "11px 16px",
      borderRadius: "10px",
      border: "1px solid #d6a9bf",
      backgroundColor: "#fff7fb",
      color: "#a62d67",
      fontWeight: "800",
      cursor: "pointer",
    }}
  >
    🖨️ General Anaya → Centro
  </button>

  <button
    type="button"
    onClick={() =>
      imprimirTraspasos(
        "Centro",
        "General Anaya"
      )
    }
    style={{
      padding: "11px 16px",
      borderRadius: "10px",
      border: "1px solid #b8dff5",
      backgroundColor: "#f4fbff",
      color: "#287da9",
      fontWeight: "800",
      cursor: "pointer",
    }}
  >
    🖨️ Centro → General Anaya
  </button>
</div>
        <div
          style={{
            padding:
              "9px 14px",
            borderRadius:
              "999px",
            backgroundColor:
              recomendaciones.length >
              0
                ? "#fff8df"
                : "#eefbf3",
            color:
              recomendaciones.length >
              0
                ? "#8a6800"
                : "#207a4a",
            border:
              recomendaciones.length >
              0
                ? "1px solid #f2dc8b"
                : "1px solid #b8e5ca",
            fontWeight: "800",
          }}
        >
          {
            recomendaciones.length
          }{" "}
          recomendaciones
        </div>
      </div>

      <p
        style={{
          color: "#675a60",
          lineHeight: "1.6",
        }}
      >
        MONYS OS compara las
        existencias entre sucursales
        y detecta dónde hay exceso y
        dónde hace falta mercancía.
      </p>

      {error && (
        <div
          style={{
            marginTop: "16px",
            padding: "13px",
            borderRadius:
              "12px",
            backgroundColor:
              "#fff0f0",
            border:
              "1px solid #efb8b8",
            color: "#a52d2d",
            fontWeight: "700",
          }}
        >
          ⚠️ {error}
        </div>
      )}

      {!error &&
        recomendaciones.length ===
          0 && (
          <div
            style={{
              marginTop: "18px",
              padding: "18px",
              borderRadius:
                "14px",
              backgroundColor:
                "#eefbf3",
              border:
                "1px solid #b8e5ca",
              color: "#207a4a",
              lineHeight: "1.6",
            }}
          >
            <strong>
              ✅ No hay traspasos
              urgentes detectados.
            </strong>

            <div
              style={{
                marginTop:
                  "6px",
              }}
            >
              Las existencias actuales
              no muestran un
              desequilibrio que
              justifique mover producto
              bajo las reglas actuales.
            </div>
          </div>
        )}

      {recomendaciones.length >
        0 && (
        <div
          style={{
            display: "grid",
            gap: "14px",
            marginTop: "20px",
          }}
        >
          {recomendaciones.map(
            (
              recomendacion,
              index
            ) => {
              const estilo =
                obtenerEstiloPrioridad(
                  recomendacion.prioridad
                );

              return (
                <article
                  key={`${recomendacion.productId}-${recomendacion.branchOrigenId}-${recomendacion.branchDestinoId}-${index}`}
                  style={{
                    padding:
                      "18px",
                    borderRadius:
                      "16px",
                    backgroundColor:
                      estilo.fondo,
                    border: `1px solid ${estilo.borde}`,
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      justifyContent:
                        "space-between",
                      gap: "15px",
                      flexWrap:
                        "wrap",
                    }}
                  >
                    <div>
                      <strong
                        style={{
                          fontSize:
                            "17px",
                          color:
                            "#2c2030",
                        }}
                      >
                        {
                          estilo.icono
                        }{" "}
                        {
                          recomendacion.producto
                        }
                      </strong>

                      <div
                        style={{
                          marginTop:
                            "7px",
                          color:
                            "#675a60",
                        }}
                      >
                        {
                          recomendacion.motivo
                        }
                      </div>
                    </div>

                    <div
                      style={{
                        padding:
                          "7px 11px",
                        borderRadius:
                          "999px",
                        backgroundColor:
                          "#ffffff",
                        border: `1px solid ${estilo.borde}`,
                        color:
                          estilo.color,
                        fontWeight:
                          "800",
                        height:
                          "fit-content",
                      }}
                    >
                      Prioridad{" "}
                      {
                        recomendacion.prioridad
                      }
                    </div>
                  </div>

                  <div
                    style={{
                      marginTop:
                        "14px",
                      padding:
                        "13px",
                      borderRadius:
                        "12px",
                      backgroundColor:
                        "#ffffff",
                      fontWeight:
                        "800",
                    }}
                  >
                    🔄{" "}
                    {
                      recomendacion.recomendacion
                    }
                  </div>

                  <div
                    style={{
                      display:
                        "grid",
                      gridTemplateColumns:
                        "repeat(auto-fit, minmax(170px, 1fr))",
                      gap: "10px",
                      marginTop:
                        "14px",
                      fontSize:
                        "14px",
                    }}
                  >
                    <div>
                      <strong>
                        {
                          recomendacion.sucursalOrigen
                        }
                      </strong>
                      <br />
                      {
                        recomendacion.existenciaOrigen
                      }{" "}
                      piezas
                    </div>

                    <div>
                      <strong>
                        {
                          recomendacion.sucursalDestino
                        }
                      </strong>
                      <br />
                      {
                        recomendacion.existenciaDestino
                      }{" "}
                      piezas
                    </div>

                    <div>
                      <strong>
                        Traspaso sugerido
                      </strong>
                      <br />
                      {
                        recomendacion.cantidadSugerida
                      }{" "}
                      piezas
                    </div>
                  </div>
                </article>
              );
            }
          )}
        </div>
      )}

      <button
        type="button"
        onClick={
          cargarRecomendaciones
        }
        style={{
          marginTop: "20px",
          padding:
            "11px 16px",
          borderRadius: "10px",
          border:
            "1px solid #b8dff5",
          backgroundColor:
            "#ffffff",
          color: "#287da9",
          fontWeight: "800",
          cursor: "pointer",
        }}
      >

        <button
  type="button"
  onClick={
    crearTareasDesdeRebalanceo
  }
  disabled={
    creandoTareas
  }
  style={{
    marginTop: "20px",
    marginRight: "10px",
    padding: "11px 16px",
    borderRadius: "10px",
    border:
      "1px solid #d8b66a",
    backgroundColor:
      "#fff8df",
    color:
      "#7a5b00",
    fontWeight: "800",
    cursor:
      creandoTareas
        ? "not-allowed"
        : "pointer",
  }}
>
  {creandoTareas
    ? "Creando tareas..."
    : "⚡ Crear tareas prioritarias"}
</button>

{mensajeTareas && (
  <div
    style={{
      marginTop: "12px",
      padding: "12px",
      borderRadius: "10px",
      backgroundColor:
        "#f6f6f6",
      border:
        "1px solid #ddd",
    }}
  >
    {mensajeTareas}
  </div>
)}

        🔄 Volver a analizar
      </button>
    </section>
  );
}

export default RecomendacionesRebalanceo;