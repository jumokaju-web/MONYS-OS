import TarjetaIndicador from "../shared/TarjetaIndicador";

function convertirNumero(valor) {
  const numero = Number(valor);

  return Number.isFinite(numero)
    ? numero
    : 0;
}

function formatearDinero(valor) {
  return new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency: "MXN",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(convertirNumero(valor));
}

function obtenerEstiloPrioridad(prioridad) {
  if (prioridad === "CRITICA") {
    return {
      icono: "🔴",
      fondo: "#fff0f0",
      borde: "#efb8b8",
      color: "#a52d2d",
    };
  }

  if (prioridad === "ALTA") {
    return {
      icono: "🟠",
      fondo: "#fff5ed",
      borde: "#efbd84",
      color: "#9a5416",
    };
  }

  return {
    icono: "🟡",
    fondo: "#fffbea",
    borde: "#e4d17d",
    color: "#806600",
  };
}

export default function DirectorMarketing({
  analisisMarketing,
}) {
  if (!analisisMarketing) {
    return null;
  }

  const {
    estadoGeneral,
    ventasTotales,
    margenUtilidad,
    capacidadCompra,
    vencimientos30Dias,
    productoLider,
    categoriaLider,
    inventarioProductoLider,
    sobreinventarioDetectado = [],
    oportunidades = [],
    recomendaciones = [],
    accionesPrioritarias = [],
  } = analisisMarketing;

  const capacidadCompraNumero =
    convertirNumero(capacidadCompra);

  const vencimientos30DiasNumero =
    convertirNumero(vencimientos30Dias);

  const sinPresupuesto =
    capacidadCompraNumero <= 0 &&
    vencimientos30DiasNumero > 0;

  const productosParaRotar =
    Array.isArray(sobreinventarioDetectado)
      ? sobreinventarioDetectado
      : [];

  const listaOportunidades =
    Array.isArray(oportunidades)
      ? oportunidades
      : [];

  const listaRecomendaciones =
    Array.isArray(recomendaciones)
      ? recomendaciones
      : [];

  const listaAcciones =
    Array.isArray(accionesPrioritarias)
      ? accionesPrioritarias
      : [];

  return (
    <section
      style={{
        marginTop: "30px",
        padding: "28px",
        borderRadius: "22px",
        background:
          "linear-gradient(135deg, #ffffff 0%, #fff3f8 100%)",
        border: "1px solid #efbfd3",
        boxShadow:
          "0 12px 35px rgba(180, 65, 120, 0.12)",
      }}
    >
      {/* ENCABEZADO */}

      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
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
            MONYS OS · DIRECTOR MARKETING
          </p>

          <h2
            style={{
              margin: 0,
              fontSize: "28px",
            }}
          >
            📢 Informe de Marketing IA
          </h2>
        </div>

        <div
          style={{
            padding: "11px 17px",
            borderRadius: "999px",
            backgroundColor:
              sinPresupuesto
                ? "#fff0f0"
                : "#eaf8f0",
            border: sinPresupuesto
              ? "1px solid #efb8b8"
              : "1px solid #b8e5ca",
            color: sinPresupuesto
              ? "#a52d2d"
              : "#207a4a",
            fontWeight: "800",
          }}
        >
          {sinPresupuesto ? "🔴 " : "🟢 "}
          {estadoGeneral || "Analizando"}
        </div>
      </div>

      {/* INDICADORES */}

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
          titulo="Ventas analizadas"
          valor={formatearDinero(
            ventasTotales
          )}
        />

        <TarjetaIndicador
          icono="📊"
          titulo="Margen comercial"
          valor={`${convertirNumero(
            margenUtilidad
          ).toFixed(2)}%`}
        />

        <TarjetaIndicador
          icono={
            capacidadCompraNumero > 0
              ? "✅"
              : "⛔"
          }
          titulo="Presupuesto disponible"
          valor={formatearDinero(
            capacidadCompraNumero
          )}
        />

        <TarjetaIndicador
          icono="🧾"
          titulo="Compromisos 30 días"
          valor={formatearDinero(
            vencimientos30DiasNumero
          )}
        />

        <TarjetaIndicador
          icono="⭐"
          titulo="Producto líder"
          valor={
            productoLider?.nombre ||
            "Sin datos"
          }
        />

        <TarjetaIndicador
          icono="🏷️"
          titulo="Categoría líder"
          valor={
            categoriaLider?.categoria ||
            "Sin datos"
          }
        />

        <TarjetaIndicador
          icono="📚"
          titulo="Productos para rotar"
          valor={productosParaRotar.length}
        />
      </div>

      {/* ESTRATEGIA */}

      <div
        style={{
          marginTop: "26px",
          padding: "20px",
          borderRadius: "16px",
          backgroundColor:
            sinPresupuesto
              ? "#fff4f4"
              : "#f3fff6",
          border: sinPresupuesto
            ? "1px solid #efc2c2"
            : "1px solid #ccebd5",
          textAlign: "center",
        }}
      >
        <h3
          style={{
            margin: "0 0 8px",
          }}
        >
          🎯 Estrategia de Marketing
        </h3>

        {sinPresupuesto ? (
          <p
            style={{
              margin: 0,
              lineHeight: "1.6",
            }}
          >
            Finanzas no autoriza
            presupuesto adicional en este
            momento. Marketing debe
            concentrarse en{" "}
            <strong>
              rotación, exhibición,
              contenido orgánico y acciones
              que no requieran nuevas
              compras.
            </strong>
          </p>
        ) : (
          <p
            style={{
              margin: 0,
              lineHeight: "1.6",
            }}
          >
            Existe capacidad financiera
            para evaluar acciones de
            Marketing, protegiendo siempre
            margen e inventario.
          </p>
        )}
      </div>

      {/* PRODUCTO LÍDER */}

      {productoLider &&
        inventarioProductoLider && (
          <div
            style={{
              marginTop: "24px",
              padding: "20px",
              borderRadius: "16px",
              backgroundColor: "#fffdf7",
              border:
                "1px solid #ecd9aa",
            }}
          >
            <h3
              style={{
                margin: "0 0 12px",
                textAlign: "center",
              }}
            >
              ⭐ Producto líder bajo análisis
            </h3>

            <div
              style={{
                textAlign: "center",
                lineHeight: "1.7",
              }}
            >
              <strong>
                {productoLider.nombre}
              </strong>

              <div>
                Vendidas:{" "}
                <strong>
                  {convertirNumero(
                    productoLider.piezas
                  ).toLocaleString("es-MX")}
                </strong>
              </div>

              <div>
                Existencia:{" "}
                <strong>
                  {convertirNumero(
                    inventarioProductoLider
                      .existencia
                  ).toLocaleString("es-MX")}
                </strong>
              </div>

              <div>
                Cobertura:{" "}
                <strong>
                  {convertirNumero(
                    inventarioProductoLider
                      .diasCobertura
                  ).toFixed(1)}{" "}
                  días
                </strong>
              </div>

              <div>
                Estado inventario:{" "}
                <strong>
                  {inventarioProductoLider
                    .nivelInventario ||
                    "Sin datos"}
                </strong>
              </div>
            </div>
          </div>
        )}

      {/* ACCIONES PRIORITARIAS */}

      <div
        style={{
          marginTop: "24px",
          padding: "22px",
          borderRadius: "18px",
          backgroundColor: "#ffffff",
          border:
            "1px solid #efc7d9",
        }}
      >
        <h3
          style={{
            textAlign: "center",
            marginTop: 0,
          }}
        >
          🎯 Acciones prioritarias de Marketing
        </h3>

        <div
          style={{
            display: "grid",
            gap: "12px",
            marginTop: "16px",
          }}
        >
          {listaAcciones.length > 0 ? (
            listaAcciones.map(
              (accion, index) => {
                const estilo =
                  obtenerEstiloPrioridad(
                    accion?.prioridad
                  );

                return (
                  <article
                    key={`accion-marketing-${index}`}
                    style={{
                      padding: "16px",
                      borderRadius: "14px",
                      backgroundColor:
                        estilo.fondo,
                      border: `1px solid ${estilo.borde}`,
                    }}
                  >
                    <strong
                      style={{
                        color:
                          estilo.color,
                      }}
                    >
                      {estilo.icono}{" "}
                      {accion?.titulo ||
                        "Acción recomendada"}
                    </strong>

                    <p
                      style={{
                        margin: "8px 0 0",
                        lineHeight: "1.6",
                      }}
                    >
                      {accion?.descripcion ||
                        "Sin descripción disponible."}
                    </p>
                  </article>
                );
              }
            )
          ) : (
            <p
              style={{
                margin: 0,
                textAlign: "center",
              }}
            >
              No hay acciones prioritarias
              disponibles por el momento.
            </p>
          )}
        </div>
      </div>

      {/* OPORTUNIDADES */}

      <div
        style={{
          marginTop: "24px",
          padding: "22px",
          borderRadius: "18px",
          backgroundColor: "#eef9ff",
          border:
            "1px solid #b8dff5",
        }}
      >
        <h3
          style={{
            textAlign: "center",
            marginTop: 0,
          }}
        >
          🚀 Oportunidades de Marketing
        </h3>

        {listaOportunidades.length > 0 ? (
          listaOportunidades
            .slice(0, 8)
            .map(
              (oportunidad, index) => (
                <div
                  key={`oportunidad-marketing-${index}`}
                  style={{
                    marginBottom: "16px",
                    textAlign: "center",
                  }}
                >
                  <strong>
                    {oportunidad?.titulo ||
                      "Oportunidad"}
                  </strong>

                  <div
                    style={{
                      marginTop: "5px",
                      lineHeight: "1.6",
                    }}
                  >
                    {oportunidad?.descripcion ||
                      "Sin descripción disponible."}
                  </div>
                </div>
              )
            )
        ) : (
          <p
            style={{
              margin: 0,
              textAlign: "center",
            }}
          >
            No hay oportunidades detectadas
            por el momento.
          </p>
        )}
      </div>

      {/* RECOMENDACIONES */}

      <div
        style={{
          marginTop: "24px",
          padding: "22px",
          borderRadius: "18px",
          backgroundColor: "#fff5fa",
          border:
            "1px solid #efc7da",
        }}
      >
        <h3
          style={{
            textAlign: "center",
            marginTop: 0,
            color: "#9c2f62",
          }}
        >
          🧠 Recomendaciones de Marketing
        </h3>

        {listaRecomendaciones.length > 0 ? (
          listaRecomendaciones.map(
            (recomendacion, index) => (
              <div
                key={`recomendacion-marketing-${index}`}
                style={{
                  display: "flex",
                  gap: "10px",
                  marginBottom: "12px",
                  lineHeight: "1.6",
                }}
              >
                <span>💡</span>

                <span>
                  {typeof recomendacion ===
                  "string"
                    ? recomendacion
                    : recomendacion
                        ?.descripcion ||
                      recomendacion
                        ?.titulo ||
                      "Recomendación disponible"}
                </span>
              </div>
            )
          )
        ) : (
          <p
            style={{
              margin: 0,
              textAlign: "center",
            }}
          >
            No hay recomendaciones
            disponibles por el momento.
          </p>
        )}
      </div>
    </section>
  );
}