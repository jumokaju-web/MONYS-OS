import { useState } from "react";
import ResumenDirectorGeneral from "./components/director-general/ResumenDirectorGeneral";
import { obtenerResumenConsejo } from "./consejo-directivo/consejoDirectivo";

const directores = [
  {
    id: "financiero",
    icono: "💰",
    nombre: "Director Financiero IA",
    descripcion:
      "Analizará ingresos, gastos, liquidez y flujo de efectivo.",
    estado: "En desarrollo",
    disponible: false,
  },
  {
    id: "comercial",
    icono: "🛒",
    nombre: "Director Comercial IA",
    descripcion:
      "Analiza las ventas, las piezas vendidas y los productos líderes.",
    estado: "Disponible",
    disponible: true,
  },
 {
  id: "inventario",
  icono: "📦",
  nombre: "Director Inventario IA",
  descripcion:
    "Analiza la rotación de productos y genera recomendaciones de resurtido.",
  estado: "Disponible",
  disponible: true,
},
  {
    id: "marketing",
    icono: "📢",
    nombre: "Director Marketing IA",
    descripcion:
      "Preparará campañas y oportunidades comerciales.",
    estado: "En desarrollo",
    disponible: false,
  },
  {
    id: "rh",
    icono: "👥",
    nombre: "Director RH IA",
    descripcion:
      "Analizará personal, incidencias, horarios y desempeño.",
    estado: "En desarrollo",
    disponible: false,
  },
  {
    id: "logistico",
    icono: "🚚",
    nombre: "Director Logístico IA",
    descripcion:
      "Analizará rutas, camionetas, costos e incidencias.",
    estado: "En desarrollo",
    disponible: false,
  },
  {
    id: "estrategia",
    icono: "🧠",
    nombre: "Director de Estrategia IA",
    descripcion:
      "Buscará oportunidades de crecimiento, inversión y expansión.",
    estado: "En desarrollo",
    disponible: false,
  },
];

function CentroInteligencia({
  datosDashboard,
  cargandoDashboard,
  errorDashboard,
  volverAlDashboard,
}) {
  const [directorAbierto, setDirectorAbierto] =
    useState(null);

  let resumenConsejo;

  if (cargandoDashboard) {
    resumenConsejo = {
      resumen:
        "Estoy recibiendo y procesando la información del negocio.",
      estado: "Analizando información",
      nivel: "🟡",
    };
  } else if (errorDashboard) {
    resumenConsejo = {
      resumen:
        "No fue posible completar el análisis ejecutivo porque ocurrió un problema al consultar la información.",
      estado: "Revisión necesaria",
      nivel: "🔴",
    };
  } else {
    resumenConsejo = obtenerResumenConsejo({
      datosDashboard,
    });
  }

  const metricas = datosDashboard?.metricas;

  const abrirDirector = (director) => {
    if (!director.disponible) {
      return;
    }

    setDirectorAbierto((directorActual) =>
      directorActual === director.id
        ? null
        : director.id
    );
  };

  return (
    <main
      className="centro-inteligencia"
      style={{
        width: "min(1180px, 94%)",
        margin: "0 auto",
        padding: "24px 0 50px",
      }}
    >
      <button
        type="button"
        onClick={volverAlDashboard}
        style={{
          padding: "10px 18px",
          borderRadius: "10px",
          border: "1px solid #d8b8c8",
          backgroundColor: "#ffffff",
          cursor: "pointer",
          fontSize: "16px",
        }}
      >
        ← Volver al Dashboard
      </button>

      <h1
        style={{
          margin: "24px 0",
          textAlign: "center",
          fontSize: "clamp(30px, 5vw, 48px)",
        }}
      >
        🧠 Centro de Inteligencia Empresarial
      </h1>

      <ResumenDirectorGeneral
        resumen={resumenConsejo.resumen}
        estado={resumenConsejo.estado}
        nivel={resumenConsejo.nivel}
      />

      <section
        style={{
          marginTop: "35px",
        }}
      >
        <h2
          style={{
            marginBottom: "22px",
            textAlign: "center",
            fontSize: "30px",
          }}
        >
          Equipo Directivo IA
        </h2>

        <div
          style={{
            display: "grid",
            gridTemplateColumns:
              "repeat(auto-fit, minmax(280px, 1fr))",
            gap: "20px",
          }}
        >
          {directores.map((director) => (
            <article
              key={director.id}
              className="tarjeta-director"
              style={{
                padding: "24px",
                borderRadius: "20px",
                backgroundColor: "#ffffff",
                border: director.disponible
                  ? "1px solid #e8b9d0"
                  : "1px solid #ece7e9",
                boxShadow: director.disponible
                  ? "0 10px 28px rgba(151, 63, 107, 0.12)"
                  : "0 7px 20px rgba(0, 0, 0, 0.06)",
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "12px",
                }}
              >
                <span
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    width: "48px",
                    height: "48px",
                    borderRadius: "14px",
                    backgroundColor: "#fff0f7",
                    fontSize: "25px",
                  }}
                >
                  {director.icono}
                </span>

                <h3
                  style={{
                    margin: 0,
                    fontSize: "21px",
                  }}
                >
                  {director.nombre}
                </h3>
              </div>

              <p
                style={{
                  minHeight: "48px",
                  margin: "18px 0",
                  color: "#655c61",
                  lineHeight: "1.5",
                }}
              >
                {director.descripcion}
              </p>

              <p
                style={{
                  marginBottom: "16px",
                  fontWeight: "700",
                  color: director.disponible
                    ? "#208653"
                    : "#8a8085",
                }}
              >
                {director.disponible ? "🟢" : "🟡"}{" "}
                {director.estado}
              </p>

              <button
                type="button"
                disabled={!director.disponible}
                onClick={() => abrirDirector(director)}
                style={{
                  width: "100%",
                  padding: "11px 16px",
                  borderRadius: "10px",
                  border: "none",
                  backgroundColor: director.disponible
                    ? "#b44178"
                    : "#e5e1e3",
                  color: director.disponible
                    ? "#ffffff"
                    : "#90878b",
                  cursor: director.disponible
                    ? "pointer"
                    : "not-allowed",
                  fontWeight: "700",
                  fontSize: "15px",
                }}
              >
                {director.disponible
                  ? directorAbierto === director.id
                    ? "Cerrar análisis"
                    : "Abrir análisis"
                  : "Próximamente"}
              </button>
            </article>
          ))}
        </div>
      </section>

      {directorAbierto === "comercial" && (
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
          <h2
            style={{
              marginTop: 0,
              fontSize: "28px",
            }}
          >
            🛒 Informe del Director Comercial IA
          </h2>

          {!metricas ? (
            <p>
              No hay información comercial disponible para
              generar el análisis.
            </p>
          ) : (
            <>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns:
                    "repeat(auto-fit, minmax(210px, 1fr))",
                  gap: "16px",
                  marginTop: "22px",
                }}
              >
                <article
                  style={{
                    padding: "20px",
                    borderRadius: "16px",
                    backgroundColor: "#ffffff",
                    border: "1px solid #f1dce6",
                  }}
                >
                  <p
                    style={{
                      margin: 0,
                      color: "#766a70",
                    }}
                  >
                    Productos analizados
                  </p>

                  <strong
                    style={{
                      display: "block",
                      marginTop: "8px",
                      fontSize: "30px",
                    }}
                  >
                    {metricas.totalProductos}
                  </strong>
                </article>

                <article
                  style={{
                    padding: "20px",
                    borderRadius: "16px",
                    backgroundColor: "#ffffff",
                    border: "1px solid #f1dce6",
                  }}
                >
                  <p
                    style={{
                      margin: 0,
                      color: "#766a70",
                    }}
                  >
                    Piezas vendidas
                  </p>

                  <strong
                    style={{
                      display: "block",
                      marginTop: "8px",
                      fontSize: "30px",
                    }}
                  >
                    {metricas.totalPiezas}
                  </strong>
                </article>

                <article
                  style={{
                    padding: "20px",
                    borderRadius: "16px",
                    backgroundColor: "#ffffff",
                    border: "1px solid #f1dce6",
                  }}
                >
                  <p
                    style={{
                      margin: 0,
                      color: "#766a70",
                    }}
                  >
                    Producto líder
                  </p>

                  <strong
                    style={{
                      display: "block",
                      marginTop: "8px",
                      fontSize: "18px",
                      lineHeight: "1.4",
                    }}
                  >
                    {metricas.productoMasVendido
                      ?.descripcion ||
                      "Sin información"}
                  </strong>

                  {metricas.productoMasVendido && (
                    <p
                      style={{
                        marginBottom: 0,
                      }}
                    >
                      {
                        metricas.productoMasVendido
                          .cantidad
                      }{" "}
                      piezas vendidas
                    </p>
                  )}
                </article>
              </div>

              <div
                style={{
                  marginTop: "22px",
                  padding: "18px",
                  borderRadius: "15px",
                  backgroundColor: "#fff7fb",
                  border: "1px solid #efd7e3",
                }}
              >
                <strong>Primera conclusión comercial</strong>

                <p
                  style={{
                    marginBottom: 0,
                    lineHeight: "1.6",
                  }}
                >
                  El producto líder debe mantenerse disponible
                  y vigilarse constantemente para evitar perder
                  ventas por falta de existencia.
                </p>
              </div>
            </>
          )}
        </section>
      )}
      {directorAbierto === "inventario" && (
  <section
    style={{
      marginTop: "30px",
      padding: "28px",
      borderRadius: "22px",
      background:
        "linear-gradient(135deg, #ffffff 0%, #eef9ff 100%)",
      border: "1px solid #b8dff5",
      boxShadow:
        "0 12px 35px rgba(39, 120, 170, 0.12)",
    }}
  >
    <h2 style={{ marginTop: 0 }}>
      📦 Informe del Director Inventario IA
    </h2>

    {!metricas ? (
      <p>No hay información disponible.</p>
    ) : (
      <>
        <p>
          <strong>Producto de mayor rotación:</strong>
        </p>

        <h3>
          {metricas.productoMasVendido?.descripcion}
        </h3>

        <p>
          Se vendieron{" "}
          <strong>
            {metricas.productoMasVendido?.cantidad}
          </strong>{" "}
          piezas.
        </p>

        <hr />

        <h3>📋 Recomendación IA</h3>

        <p>
          Revisar existencias de este producto y
          considerarlo para el próximo pedido al proveedor,
          ya que actualmente es el producto con mayor
          rotación.
        </p>
      </>
    )}
  </section>
)}
    </main>
  );
}

export default CentroInteligencia;