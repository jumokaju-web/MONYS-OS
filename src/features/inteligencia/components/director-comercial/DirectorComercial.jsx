// ======================================================
// MONYS OS
// Director Comercial IA 3.0
// ======================================================

import TarjetaIndicador from "../shared/TarjetaIndicador";
import { directorComercialIA } from "../../directores/directorComercialIA";

function DirectorComercial({ datosDashboard }) {
  const analisis = directorComercialIA(
    datosDashboard
  );

  const {
    indicadores,
    nivelComercial,
    topProductos = [],
    categorias = [],
    concentracion,
    oportunidades = [],
    recomendaciones = [],
    planAccion = [],
    accionesPrioritarias = [],
  } = analisis;

  const obtenerColorNivel = () => {
    const estilos = {
      fuerte: {
        fondo: "#eaf8f0",
        borde: "#b8e5ca",
        color: "#207a4a",
        icono: "🟢",
      },

      estable: {
        fondo: "#eef6ff",
        borde: "#bfdcff",
        color: "#245f9e",
        icono: "🔵",
      },

      atencion: {
        fondo: "#fff8df",
        borde: "#f2dc8b",
        color: "#8a6800",
        icono: "🟡",
      },

      critico: {
        fondo: "#fff0f0",
        borde: "#efb8b8",
        color: "#a52d2d",
        icono: "🔴",
      },

      "sin-datos": {
        fondo: "#f5f3f4",
        borde: "#ddd7da",
        color: "#6f666a",
        icono: "⚪",
      },
    };

    return (
      estilos[nivelComercial?.nivel] ||
      estilos["sin-datos"]
    );
  };

  const obtenerEstiloPrioridad = (
    prioridad
  ) => {
    if (prioridad === "ALTA") {
      return {
        icono: "🔴",
        fondo: "#fff0f0",
        borde: "#efb8b8",
      };
    }

    if (prioridad === "MEDIA") {
      return {
        icono: "🟡",
        fondo: "#fffbea",
        borde: "#e6d27c",
      };
    }

    return {
      icono: "🟢",
      fondo: "#effbf3",
      borde: "#b8e5ca",
    };
  };

  const estiloNivel =
    obtenerColorNivel();

  const formatearDinero = (
    cantidad
  ) =>
    new Intl.NumberFormat("es-MX", {
      style: "currency",
      currency: "MXN",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(
      Number(cantidad) || 0
    );

  return (
    <section
      style={{
        marginTop: "30px",
        padding: "28px",
        borderRadius: "22px",
        background:
          "linear-gradient(135deg, #ffffff 0%, #fff4fa 100%)",
        border: "1px solid #e8b9d0",
        boxShadow:
          "0 12px 35px rgba(112, 53, 84, 0.12)",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent:
            "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: "15px",
        }}
      >
        <div>
          <p
            style={{
              margin: "0 0 7px",
              color: "#b44178",
              fontWeight: "800",
              letterSpacing: "1px",
            }}
          >
            MONYS OS · DIRECTOR COMERCIAL
          </p>

          <h2
            style={{
              margin: 0,
              fontSize: "28px",
            }}
          >
            🛒 Informe Comercial IA
          </h2>
        </div>

        <div
          style={{
            padding: "11px 17px",
            borderRadius: "999px",
            backgroundColor:
              estiloNivel.fondo,
            border:
              `1px solid ${estiloNivel.borde}`,
            color:
              estiloNivel.color,
            fontWeight: "800",
          }}
        >
          {estiloNivel.icono}{" "}
          {nivelComercial.etiqueta}
        </div>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns:
            "repeat(auto-fit, minmax(210px, 1fr))",
          gap: "16px",
          marginTop: "24px",
        }}
      >
        <TarjetaIndicador
          icono="💰"
          titulo="Ventas totales"
          valor={formatearDinero(
            indicadores.ventasTotales
          )}
        />

        <TarjetaIndicador
          icono="📈"
          titulo="Utilidad total"
          valor={formatearDinero(
            indicadores.utilidadTotal
          )}
        />

        <TarjetaIndicador
          icono="📊"
          titulo="Margen de utilidad"
          valor={`${indicadores.margenUtilidad.toFixed(
            2
          )}%`}
        />

        <TarjetaIndicador
          icono="📦"
          titulo="Productos analizados"
          valor={
            indicadores.totalProductos
          }
        />

        <TarjetaIndicador
          icono="🛒"
          titulo="Piezas vendidas"
          valor={
            indicadores.totalPiezas
          }
        />

        <TarjetaIndicador
          icono="⭐"
          titulo="Producto líder"
          valor={
            indicadores.productoLider
              .nombre ||
            "Sin información"
          }
          subtitulo={
            indicadores.productoLider
              .piezas > 0
              ? `${indicadores.productoLider.piezas.toLocaleString(
                  "es-MX"
                )} piezas vendidas`
              : ""
          }
        />
      </div>

      <div
        style={{
          marginTop: "28px",
          padding: "22px",
          borderRadius: "18px",
          backgroundColor: "#ffffff",
          border: "1px solid #efd7e3",
        }}
      >
        <h3
          style={{
            margin: "0 0 16px",
            color: "#7f2856",
          }}
        >
          🏆 Top 10 productos
        </h3>

        <div
          style={{
            display: "grid",
            gap: "10px",
          }}
        >
          {topProductos.map(
            (producto) => (
              <div
                key={`${producto.codigo}-${producto.posicion}`}
                style={{
                  display: "grid",
                  gridTemplateColumns:
                    "50px 1fr auto",
                  gap: "12px",
                  alignItems: "center",
                  padding: "12px",
                  borderRadius: "12px",
                  background:
                    "#fff8fb",
                  border:
                    "1px solid #f0dce6",
                }}
              >
                <strong>
                  #{producto.posicion}
                </strong>

                <div>
                  <strong>
                    {producto.nombre}
                  </strong>

                  <div
                    style={{
                      marginTop: "4px",
                      fontSize: "13px",
                      color: "#75656d",
                    }}
                  >
                    {producto.categoria}
                  </div>
                </div>

                <strong>
                  {producto.piezas.toLocaleString(
                    "es-MX"
                  )}{" "}
                  pzas
                </strong>
              </div>
            )
          )}
        </div>
      </div>

      <div
        style={{
          marginTop: "22px",
          display: "grid",
          gridTemplateColumns:
            "repeat(auto-fit, minmax(280px, 1fr))",
          gap: "16px",
        }}
      >
        <div
          style={{
            padding: "20px",
            borderRadius: "16px",
            backgroundColor:
              "#f8f4ff",
            border:
              "1px solid #ded1f0",
          }}
        >
          <h3
            style={{
              marginTop: 0,
            }}
          >
            🏷️ Categorías líderes
          </h3>

          {categorias
            .slice(0, 5)
            .map(
              (categoria, index) => (
                <div
                  key={`${categoria.categoria}-${index}`}
                  style={{
                    display: "flex",
                    justifyContent:
                      "space-between",
                    gap: "10px",
                    padding:
                      "10px 0",
                    borderBottom:
                      "1px solid #e7def0",
                  }}
                >
                  <span>
                    {index + 1}.{" "}
                    {
                      categoria.categoria
                    }
                  </span>

                  <strong>
                    {categoria.piezas.toLocaleString(
                      "es-MX"
                    )}{" "}
                    pzas
                  </strong>
                </div>
              )
            )}
        </div>

        <div
          style={{
            padding: "20px",
            borderRadius: "16px",
            backgroundColor:
              "#fff9ef",
            border:
              "1px solid #ecd9aa",
          }}
        >
          <h3
            style={{
              marginTop: 0,
            }}
          >
            📊 Concentración comercial
          </h3>

          <p
            style={{
              lineHeight: "1.7",
            }}
          >
            Los tres productos líderes
            representan{" "}
            <strong>
              {Number(
                concentracion
                  ?.porcentajeTop3
              ).toFixed(2)}
              %
            </strong>{" "}
            del volumen vendido.
          </p>

          <strong>
            {concentracion?.nivel}
          </strong>
        </div>
      </div>

      {accionesPrioritarias.length >
        0 && (
        <div
          style={{
            marginTop: "24px",
            padding: "22px",
            borderRadius: "18px",
            background:
              "linear-gradient(135deg, #fff 0%, #fff6f9 100%)",
            border:
              "1px solid #e7b8ca",
          }}
        >
          <h3
            style={{
              margin: "0 0 16px",
              color: "#7f2856",
            }}
          >
            🎯 Acciones prioritarias comerciales
          </h3>

          <div
            style={{
              display: "grid",
              gap: "12px",
            }}
          >
            {accionesPrioritarias.map(
              (accion, index) => {
                const estilo =
                  obtenerEstiloPrioridad(
                    accion.prioridad
                  );

                return (
                  <article
                    key={`${accion.titulo}-${index}`}
                    style={{
                      padding: "16px",
                      borderRadius:
                        "14px",
                      backgroundColor:
                        estilo.fondo,
                      border:
                        `1px solid ${estilo.borde}`,
                    }}
                  >
                    <strong>
                      {estilo.icono}{" "}
                      {accion.titulo}
                    </strong>

                    <p
                      style={{
                        marginBottom:
                          "6px",
                        lineHeight:
                          "1.6",
                      }}
                    >
                      {
                        accion.descripcion
                      }
                    </p>

                    <small>
                      Impacto:{" "}
                      {accion.impacto}
                    </small>
                  </article>
                );
              }
            )}
          </div>
        </div>
      )}

      {oportunidades.length > 0 && (
        <div
          style={{
            marginTop: "22px",
            padding: "20px",
            borderRadius: "16px",
            backgroundColor:
              "#eef9ff",
            border:
              "1px solid #bfddec",
          }}
        >
          <h3
            style={{
              margin:
                "0 0 15px",
              color: "#246785",
            }}
          >
            🚀 Oportunidades comerciales
          </h3>

          {oportunidades.map(
            (oportunidad, index) => (
              <div
                key={`${oportunidad.titulo}-${index}`}
                style={{
                  marginBottom:
                    "14px",
                  lineHeight: "1.6",
                }}
              >
                <strong>
                  {oportunidad.titulo}
                </strong>

                <div>
                  {
                    oportunidad.descripcion
                  }
                </div>
              </div>
            )
          )}
        </div>
      )}

      <div
        style={{
          marginTop: "24px",
          padding: "20px",
          borderRadius: "16px",
          backgroundColor: "#fff7fb",
          border: "1px solid #efd7e3",
        }}
      >
        <h3
          style={{
            margin: "0 0 15px",
            color: "#7f2856",
          }}
        >
          🧠 Recomendaciones comerciales
        </h3>

        {recomendaciones.map(
          (recomendacion, index) => (
            <div
              key={`${recomendacion}-${index}`}
              style={{
                display: "flex",
                gap: "10px",
                marginBottom:
                  "12px",
                lineHeight: "1.6",
              }}
            >
              <span>💡</span>
              <span>
                {recomendacion}
              </span>
            </div>
          )
        )}
      </div>

      {planAccion.length > 0 && (
        <div
          style={{
            marginTop: "20px",
            padding: "20px",
            borderRadius: "16px",
            backgroundColor:
              "#f3fff6",
            border:
              "1px solid #ccebd5",
          }}
        >
          <h3
            style={{
              margin: "0 0 15px",
              color: "#207a4a",
            }}
          >
            📋 Plan de acción comercial
          </h3>

          {planAccion.map(
            (accion, index) => (
              <div
                key={`${accion}-${index}`}
                style={{
                  display: "flex",
                  gap: "10px",
                  marginBottom:
                    "12px",
                  lineHeight: "1.6",
                }}
              >
                <span>✅</span>
                <span>
                  {accion}
                </span>
              </div>
            )
          )}
        </div>
      )}
    </section>
  );
}

export default DirectorComercial;