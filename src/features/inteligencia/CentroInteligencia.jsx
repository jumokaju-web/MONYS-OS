import { useState } from "react";
import ResumenDirectorGeneral from "./components/director-general/ResumenDirectorGeneral";
import PanelCEOIA from "./components/PanelCEOIA";
import { obtenerResumenConsejo } from "./consejo-directivo/consejoDirectivo";
import DirectorComercial from "./components/director-comercial/DirectorComercial";
import DirectorInventario from "./components/director-comercial/director-inventario/DirectorInventario";
import DirectorFinanciero from "./components/director-finanzas/DirectorFinanciero";
import SalaConsejoIA from "./SalaConsejoIA";

import {
  generarDecisionCEO,
} from "./ia/ceo/directorGeneralIA";

import {
  generarAnalisisFinanciero,
} from "./ia/directorFinancieroIA";

import {
  directorComercialIA,
} from "./directores/directorComercialIA";

import {
  analizarInventario,
} from "./analyzers/inventarioAnalyzer";

const directores = [

  {
    id: "financiero",
    icono: "💰",
    nombre: "Director Financiero IA",
    descripcion:
      "Analizará ingresos, gastos, liquidez y flujo de efectivo.",
    estado:  "Disponible",
    disponible: true,
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
  {
  id: "ceo",
  icono: "👑",
  nombre: "Director General IA",
  descripcion:
    "Coordina a todos los directores de IA y toma decisiones estratégicas para el negocio.",
  estado: "Disponible",
  disponible: true,
},
];

function CentroInteligencia({
  datosDashboard,
  movimientos,
  cargandoDashboard,
  errorDashboard,
  volverAlDashboard,
  importacionId,
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

  const decisionCEO = generarDecisionCEO({
  analisisFinanciero: generarAnalisisFinanciero({
    movimientos,
    ventasTotales:
      metricas?.ventasTotales ?? 0,
    costoTotal:
      metricas?.costoTotal ?? 0,
    utilidadTotal:
      metricas?.utilidadTotal ?? 0,
    margenUtilidad:
      metricas?.margenUtilidad ?? 0,
  }),

    importacionId,
  
  analisisComercial:
    directorComercialIA(
      datosDashboard || {}
    ),

 analisisInventario:
  analizarInventario(
    datosDashboard?.inventario
      ?.detalles || [],
    {
      ventas:
        datosDashboard?.inteligencia
          ?.comercial?.ventas || [],

      diasAnalizados:
        metricas?.diasAnalizados || 7,

      diasObjetivoInventario: 30,
    }
  ),
});

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

     <div
  style={{
    textAlign: "center",
    margin: "24px 0 35px",
  }}
>
  <p
    style={{
      margin: 0,
      color: "#8a6d7c",
      fontSize: "18px",
      fontWeight: "600",
    }}
  >
    Bienvenida, Mony 👋
  </p>

  <h1
    style={{
      margin: "10px 0",
      fontSize: "clamp(34px, 5vw, 52px)",
    }}
  >
    👑 Sala de Consejo IA
  </h1>

  <p
    style={{
      margin: 0,
      color: "#666",
      fontSize: "18px",
      maxWidth: "700px",
      marginInline: "auto",
      lineHeight: "1.6",
    }}
  >
    Tus Directores IA ya analizaron la información del negocio y prepararon
    las decisiones más importantes para hoy.
  </p>
</div>

 <SalaConsejoIA
  resumen={resumenConsejo.resumen}
  estado={resumenConsejo.estado}
  nivel={resumenConsejo.nivel}
  datosDashboard={datosDashboard}
/>
     

     <section
  style={{
    marginTop: "30px",
    marginBottom: "35px",
    padding: "24px",
    borderRadius: "20px",
    backgroundColor: "#fffdf7",
    border: "1px solid #f2d98a",
  }}
>
  <h2
    style={{
      marginTop: 0,
      marginBottom: "18px",
      fontSize: "28px",
    }}
  >
    📋 Decisiones Prioritarias de Hoy
  </h2>

  <ul
    style={{
      margin: 0,
      paddingLeft: "22px",
      lineHeight: "2",
      fontSize: "17px",
    }}
  >
    <li>🔴 No hay decisiones críticas pendientes.</li>
    <li>🟡 La IA irá colocando aquí las recomendaciones del día.</li>
    <li>🟢 Esta sección será completamente automática.</li>
  </ul>
</section>


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
  <DirectorComercial datosDashboard={datosDashboard} />
)}


  {directorAbierto === "inventario" && (
  <DirectorInventario datosDashboard={datosDashboard} />
)}


{directorAbierto === "financiero" && (
  <DirectorFinanciero
    datosDashboard={datosDashboard}
    movimientos={movimientos}
  />
)}

{directorAbierto === "ceo" && (
  <PanelCEOIA
    decisionCEO={decisionCEO}
  />
)}

    </main>
  );
}

export default CentroInteligencia;


