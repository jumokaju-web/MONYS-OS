import {
  useEffect,
  useState,
} from "react";

import {
  generarDirectorInventarioIA,
} from "../directores/directorInventarioIA";


function formatearDinero(
  valor
) {
  const numero =
    Number(valor || 0);

  return numero.toLocaleString(
    "es-MX",
    {
      style: "currency",
      currency: "MXN",
      minimumFractionDigits: 2,
    }
  );
}


function obtenerColorNivel(
  nivel
) {
  switch (
    String(
      nivel || ""
    ).toUpperCase()
  ) {
    case "CRITICO":
      return {
        fondo:
          "#fff0f0",
        borde:
          "#e8a6a6",
        texto:
          "#8b2020",
        icono:
          "🔴",
      };

    case "ALTO":
      return {
        fondo:
          "#fff4e8",
        borde:
          "#efbd84",
        texto:
          "#8a4b16",
        icono:
          "🟠",
      };

    case "MEDIO":
      return {
        fondo:
          "#fffbea",
        borde:
          "#dfcc72",
        texto:
          "#746010",
        icono:
          "🟡",
      };

    default:
      return {
        fondo:
          "#effbf3",
        borde:
          "#a9d8b7",
        texto:
          "#24633a",
        icono:
          "🟢",
      };
  }
}


export default function DirectorInventarioPanel({
  branchId = null,
}) {
  const [
    analisis,
    setAnalisis,
  ] = useState(null);

  const [
    cargando,
    setCargando,
  ] = useState(false);

  const [
    error,
    setError,
  ] = useState("");


  async function cargarDirectorInventario() {
    if (!branchId) {
      setAnalisis(null);
      return;
    }

    try {
      setCargando(true);
      setError("");

      const resultado =
        await generarDirectorInventarioIA({
          branchId,
        });

      setAnalisis(
        resultado
      );
    } catch (
      errorInventario
    ) {
      console.error(
        "Error al cargar Director de Inventario:",
        errorInventario
      );

      setError(
        errorInventario
          ?.message ||
          "MONYS no pudo analizar el inventario."
      );

      setAnalisis(null);
    } finally {
      setCargando(false);
    }
  }


  useEffect(() => {
    cargarDirectorInventario();
  }, [branchId]);


  if (!branchId) {
    return null;
  }


  const indicadores =
    analisis?.indicadores ||
    {};

  const riesgos =
    Array.isArray(
      analisis?.riesgos
    )
      ? analisis.riesgos
      : [];

  const acciones =
    Array.isArray(
      analisis?.accionesRecomendadas
    )
      ? analisis.accionesRecomendadas
      : [];

  const prioridades =
    Array.isArray(
      analisis?.prioridades
    )
      ? analisis.prioridades
      : [];

  const estiloNivel =
    obtenerColorNivel(
      analisis?.nivel
    );


  return (
    <section
      style={{
        marginTop: "28px",
        marginBottom: "30px",
        padding: "26px",
        borderRadius: "22px",
        background:
          "linear-gradient(135deg, #ffffff 0%, #f8fbff 100%)",
        border:
          "1px solid #c9d7e8",
        boxShadow:
          "0 10px 30px rgba(50, 80, 120, 0.08)",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent:
            "space-between",
          alignItems:
            "flex-start",
          gap: "14px",
          flexWrap: "wrap",
          marginBottom: "20px",
        }}
      >
        <div>
          <h2
            style={{
              margin: 0,
              fontSize: "26px",
              fontWeight: "800",
            }}
          >
            📦 Director de Inventario IA
          </h2>

          <p
            style={{
              marginTop: "8px",
              marginBottom: 0,
              color: "#6b7280",
              lineHeight: "1.5",
            }}
          >
            MONYS revisa existencias,
            faltantes, negativos,
            inconsistencias y capital
            inmovilizado.
          </p>
        </div>

        <button
          type="button"
          onClick={
            cargarDirectorInventario
          }
          disabled={
            cargando
          }
        >
          {cargando
            ? "Analizando..."
            : "🔄 Actualizar"}
        </button>
      </div>


      {error && (
        <div
          style={{
            padding: "14px",
            marginBottom: "18px",
            border:
              "1px solid #dc3545",
            borderRadius: "12px",
            background:
              "#fff5f5",
          }}
        >
          ❌ {error}
        </div>
      )}


      {cargando &&
      !analisis && (
        <div
          style={{
            padding: "18px",
            border:
              "1px solid #ddd",
            borderRadius: "12px",
          }}
        >
          🧠 MONYS está analizando
          el inventario...
        </div>
      )}


      {!cargando &&
      analisis && (
        <>
          <div
            style={{
              padding: "16px",
              marginBottom: "18px",
              borderRadius: "14px",
              background:
                estiloNivel.fondo,
              border:
                `1px solid ${estiloNivel.borde}`,
              color:
                estiloNivel.texto,
              fontWeight: "800",
            }}
          >
            {estiloNivel.icono} Estado
            del inventario:{" "}
            {analisis.nivel}
          </div>


          <div
            style={{
              display: "grid",
              gridTemplateColumns:
                "repeat(auto-fit, minmax(150px, 1fr))",
              gap: "12px",
              marginBottom: "20px",
            }}
          >
            <TarjetaIndicador
              titulo="Productos"
              valor={
                indicadores.totalProductos ||
                0
              }
              icono="📦"
            />

            <TarjetaIndicador
              titulo="Negativos"
              valor={
                indicadores.negativos ||
                0
              }
              icono="🔴"
            />

            <TarjetaIndicador
              titulo="Faltantes"
              valor={
                indicadores.faltantes ||
                0
              }
              icono="⚠️"
            />

            <TarjetaIndicador
              titulo="Sospechosos"
              valor={
                indicadores.sospechosos ||
                0
              }
              icono="🔎"
            />

            <TarjetaIndicador
              titulo="Sin movimiento"
              valor={
                indicadores.sobreinventario ||
                0
              }
              icono="📚"
            />

            <TarjetaIndicador
              titulo="Valor inventario"
              valor={
                formatearDinero(
                  indicadores.valorInventario ||
                  0
                )
              }
              icono="💰"
            />
          </div>


          <div
            style={{
              padding: "16px",
              marginBottom: "20px",
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
                lineHeight: "1.6",
              }}
            >
              {
                analisis.resumenEjecutivo
              }
            </p>
          </div>


          {riesgos.length > 0 && (
            <div
              style={{
                marginBottom: "22px",
              }}
            >
              <h3>
                ⚠️ Riesgos detectados
              </h3>

              <div
                style={{
                  display: "grid",
                  gap: "12px",
                }}
              >
                {riesgos.map(
                  (
                    riesgo,
                    index
                  ) => (
                    <article
                      key={
                        `${riesgo.tipo}-${index}`
                      }
                      style={{
                        padding:
                          "14px",
                        border:
                          "1px solid #e1c27a",
                        borderRadius:
                          "12px",
                        background:
                          "#fffbea",
                      }}
                    >
                      <strong>
                        {riesgo.titulo}
                      </strong>

                      <p
                        style={{
                          marginBottom:
                            0,
                        }}
                      >
                        {
                          riesgo.descripcion
                        }
                      </p>
                    </article>
                  )
                )}
              </div>
            </div>
          )}


          {acciones.length > 0 && (
            <div
              style={{
                marginBottom: "22px",
              }}
            >
              <h3>
                🎯 Acciones recomendadas
              </h3>

              <div
                style={{
                  display: "grid",
                  gap: "10px",
                }}
              >
                {acciones.map(
                  (
                    accion,
                    index
                  ) => (
                    <div
                      key={
                        `${accion.titulo}-${index}`
                      }
                      style={{
                        padding:
                          "12px",
                        border:
                          "1px solid #ddd",
                        borderRadius:
                          "10px",
                      }}
                    >
                      <strong>
                        {
                          accion.titulo
                        }
                      </strong>

                      <div
                        style={{
                          marginTop:
                            "5px",
                          fontSize:
                            "13px",
                          opacity:
                            0.75,
                        }}
                      >
                        Responsable:{" "}
                        {
                          accion.responsable
                        }{" "}
                        · Prioridad:{" "}
                        {
                          accion.prioridad
                        }
                      </div>
                    </div>
                  )
                )}
              </div>
            </div>
          )}


          {prioridades.length > 0 && (
            <details>
              <summary
                style={{
                  cursor: "pointer",
                  fontWeight: "800",
                }}
              >
                🔍 Ver hallazgos por producto
                ({prioridades.length})
              </summary>

              <div
                style={{
                  display: "grid",
                  gap: "10px",
                  marginTop: "14px",
                }}
              >
                {prioridades
                  .slice(
                    0,
                    30
                  )
                  .map(
                    (
                      prioridad,
                      index
                    ) => (
                      <div
                        key={
                          `${prioridad.id}-${index}`
                        }
                        style={{
                          padding:
                            "12px",
                          border:
                            "1px solid #ddd",
                          borderRadius:
                            "10px",
                        }}
                      >
                        <strong>
                          {
                            prioridad.titulo
                          }
                        </strong>

                        <p
                          style={{
                            margin:
                              "6px 0 0 0",
                          }}
                        >
                          {
                            prioridad.descripcion
                          }
                        </p>

                        <small>
                          Prioridad:{" "}
                          {
                            prioridad.prioridad
                          }{" "}
                          · Confianza:{" "}
                          {
                            prioridad.confianza
                          }
                          %
                        </small>
                      </div>
                    )
                  )}
              </div>
            </details>
          )}
        </>
      )}
    </section>
  );
}


function TarjetaIndicador({
  titulo,
  valor,
  icono,
}) {
  return (
    <div
      style={{
        padding: "16px",
        border:
          "1px solid #d8dee8",
        borderRadius: "14px",
        textAlign: "center",
        background:
          "#ffffff",
      }}
    >
      <div
        style={{
          fontSize: "24px",
        }}
      >
        {icono}
      </div>

      <div
        style={{
          marginTop: "6px",
          fontSize: "13px",
          color: "#6b7280",
        }}
      >
        {titulo}
      </div>

      <strong
        style={{
          display: "block",
          marginTop: "5px",
          fontSize: "20px",
        }}
      >
        {valor}
      </strong>
    </div>
  );
}