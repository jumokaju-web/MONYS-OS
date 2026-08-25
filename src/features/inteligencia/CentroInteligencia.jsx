import {
  useEffect,
  useState,
} from "react";

import ResumenDirectorGeneral from "./components/director-general/ResumenDirectorGeneral";
import PanelCEOIA from "./components/PanelCEOIA";

import {
  obtenerResumenConsejo,
} from "./consejo-directivo/consejoDirectivo";

import DirectorComercial from "./components/director-comercial/DirectorComercial";

import DirectorInventario from "./components/director-comercial/director-inventario/DirectorInventario";

import DirectorFinanciero from "./components/director-finanzas/DirectorFinanciero";

import SalaConsejoIA from "./SalaConsejoIA";

import DirectorMarketing from "./components/director-marketing/DirectorMarketing";

import DirectorRH from "./components/director-rh/DirectorRH";

import OperacionHoy from "./components/OperacionHoy";

import DirectorInventarioPanel from "./components/DirectorInventarioPanel";

import {
  generarDecisionCEO,
} from "./ia/ceo/directorGeneralIA";

import {
  obtenerCreditosProveedoresActuales,
} from "./services/creditosProveedoresService";

import {
  generarAnalisisFinanciero,
} from "./ia/directorFinancieroIA";

import {
  directorComercialIA,
} from "./directores/directorComercialIA";

import {
  directorMarketingIA,
} from "./directores/directorMarketingIA";

import {
  directorRHIA,
} from "./directores/directorRHIA";

import {
  analizarInventario,
} from "./analyzers/inventarioAnalyzer";

import {
  obtenerEmpleadosRH,
} from "./services/empleadosRHService";

const directores = [
  {
    id: "financiero",
    icono: "💰",
    nombre: "Director Financiero IA",
    descripcion:
      "Analizará ingresos, gastos, liquidez y flujo de efectivo.",
    estado: "Disponible",
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
      "Prepara campañas y oportunidades comerciales usando ventas, inventario y finanzas.",
    estado: "Disponible",
    disponible: true,
  },
  {
    id: "rh",
    icono: "👥",
    nombre: "Director RH IA",
    descripcion:
      "Analiza personal, incidencias, capacitación, contratación y costo laboral.",
    estado: "Disponible",
    disponible: true,
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
  const [
    directorAbierto,
    setDirectorAbierto,
  ] = useState(null);

  const [
    creditosProveedores,
    setCreditosProveedores,
  ] = useState({
    importacion: null,
    creditos: [],
    saldoTotal: 0,
  });

  const [
    usuariosRH,
    setUsuariosRH,
  ] = useState([]);

   const organizationId =
  datosDashboard?.organization_id || null;

const businessId =
  datosDashboard?.business_id || null;

  const branchId =
    datosDashboard?.branch_id || null;

console.log(
  "DATOS DASHBOARD PARA RH:",
  datosDashboard
);

    /*
  ==========================================
  CRÉDITOS DE PROVEEDORES
  ==========================================
*/

useEffect(() => {
  async function cargarCreditosProveedores() {
    if (!branchId) {
      setCreditosProveedores({
        importacion: null,
        creditos: [],
        saldoTotal: 0,
      });

      return;
    }

    try {
      const datos =
        await obtenerCreditosProveedoresActuales(
          branchId
        );

      setCreditosProveedores(
        datos
      );
    } catch (error) {
      console.error(
        "Error al cargar créditos para el Consejo IA:",
        error
      );

      setCreditosProveedores({
        importacion: null,
        creditos: [],
        saldoTotal: 0,
      });
    }
  }

  cargarCreditosProveedores();
}, [branchId]);

/*
  ==========================================
  PERSONAL REAL PARA DIRECTOR RH
  ==========================================
*/


async function cargarEmpleadosRH() {
  if (!branchId) {
    setUsuariosRH([]);
    return;
  }

  try {
    const empleados =
      await obtenerEmpleadosRH(
        branchId
      );

    setUsuariosRH(
      empleados
    );
  } catch (error) {
    console.error(
      "Error al cargar empleados reales para Director RH IA:",
      error
    );

    setUsuariosRH([]);
  }
}

useEffect(() => {
  cargarEmpleadosRH();
}, [branchId]);

  /*
    ==========================================
    RESUMEN DEL CONSEJO
    ==========================================
  */

  let resumenConsejo;

  if (cargandoDashboard) {
    resumenConsejo = {
      resumen:
        "Estoy recibiendo y procesando la información del negocio.",
      estado:
        "Analizando información",
      nivel: "🟡",
    };
  } else if (errorDashboard) {
    resumenConsejo = {
      resumen:
        "No fue posible completar el análisis ejecutivo porque ocurrió un problema al consultar la información.",
      estado:
        "Revisión necesaria",
      nivel: "🔴",
    };
  } else {
    resumenConsejo =
      obtenerResumenConsejo({
        datosDashboard,
      });
  }

  const metricas =
    datosDashboard?.metricas || {};

  /*
    ==========================================
    DIRECTOR FINANCIERO
    ==========================================
  */

  const analisisFinancieroCEO =
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
        metricas.ventaPromedioDiaria ??
        0,

      utilidadPromedioDiaria:
        metricas
          .utilidadPromedioDiaria ??
        0,

      saldoProveedores:
        creditosProveedores
          ?.saldoTotal ?? 0,

      creditosProveedores:
        creditosProveedores
          ?.creditos ?? [],
    });

  /*
    ==========================================
    DIRECTOR COMERCIAL
    ==========================================
  */

  const analisisComercialCEO =
    directorComercialIA(
      datosDashboard || {}
    );

  /*
    ==========================================
    DIRECTOR INVENTARIO
    ==========================================
  */

  const analisisInventarioCEO =
    analizarInventario(
      datosDashboard?.inventario
        ?.detalles || [],
      {
        ventas:
          datosDashboard
            ?.inteligencia
            ?.comercial
            ?.ventas || [],

        diasAnalizados:
          metricas.diasAnalizados ||
          7,

        diasObjetivoInventario: 30,
      }
    );

  /*
    ==========================================
    DIRECTOR MARKETING
    ==========================================
  */

  const analisisMarketing =
    directorMarketingIA({
      analisisComercial:
        analisisComercialCEO,

      analisisInventario:
        analisisInventarioCEO,

      analisisFinanciero:
        analisisFinancieroCEO,
    });

  /*
    ==========================================
    DIRECTOR RH
    ==========================================

    Ya recibe usuarios reales
    de la sucursal actual.

    Nómina, incidencias,
    capacitaciones y vacantes
    se conectarán después.
  */

const analisisRH =
  directorRHIA({
    empleados:
      usuariosRH,

    nomina: [],

    incidencias: [],

    capacitaciones: [],

    vacantes: [],

    analisisFinanciero:
      analisisFinancieroCEO,

    fuentesConectadas: {
      empleados: true,
      nomina: false,
      incidencias: false,
      capacitaciones: false,
      vacantes: false,
    },
  });

  /*
    ==========================================
    DIRECTOR GENERAL / CEO
    ==========================================
  */

  const decisionCEO =
    generarDecisionCEO({
      analisisFinanciero:
        analisisFinancieroCEO,

      analisisComercial:
        analisisComercialCEO,

      analisisInventario:
        analisisInventarioCEO,
    });

  /*
    ==========================================
    ABRIR / CERRAR DIRECTORES
    ==========================================
  */

  const abrirDirector = (
    director
  ) => {
    if (!director.disponible) {
      return;
    }

    setDirectorAbierto(
      (directorActual) =>
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

      <OperacionHoy
  organizationId={organizationId}
  businessId={businessId}
  branchId={branchId}
/>

<DirectorInventarioPanel
  branchId={branchId}
/>

      <button
        type="button"
        onClick={volverAlDashboard}
        style={{
          padding: "10px 18px",
          borderRadius: "10px",
          border:
            "1px solid #d8b8c8",
          backgroundColor:
            "#ffffff",
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
            fontSize:
              "clamp(34px, 5vw, 52px)",
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
          Tus Directores IA ya
          analizaron la información del
          negocio y prepararon las
          decisiones más importantes para
          hoy.
        </p>
      </div>

      <SalaConsejoIA
        resumen={
          resumenConsejo.resumen
        }
        estado={
          resumenConsejo.estado
        }
        nivel={
          resumenConsejo.nivel
        }
        datosDashboard={
          datosDashboard
        }
      />

      <section
        style={{
          marginTop: "30px",
          marginBottom: "35px",
          padding: "24px",
          borderRadius: "20px",
          backgroundColor:
            "#fffdf7",
          border:
            "1px solid #f2d98a",
        }}
      >
        <h2
          style={{
            marginTop: 0,
            marginBottom: "18px",
            fontSize: "28px",
          }}
        >
          📋 Decisiones Prioritarias de
          Hoy
        </h2>

        <ul
          style={{
            margin: 0,
            paddingLeft: "22px",
            lineHeight: "2",
            fontSize: "17px",
          }}
        >
          <li>
            🔴 No hay decisiones críticas
            pendientes.
          </li>

          <li>
            🟡 La IA irá colocando aquí
            las recomendaciones del día.
          </li>

          <li>
            🟢 Esta sección será
            completamente automática.
          </li>
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
          {directores.map(
            (director) => (
              <article
                key={director.id}
                className="tarjeta-director"
                style={{
                  padding: "24px",
                  borderRadius: "20px",
                  backgroundColor:
                    "#ffffff",

                  border:
                    director.disponible
                      ? "1px solid #e8b9d0"
                      : "1px solid #ece7e9",

                  boxShadow:
                    director.disponible
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
                      alignItems:
                        "center",
                      justifyContent:
                        "center",
                      width: "48px",
                      height: "48px",
                      borderRadius:
                        "14px",
                      backgroundColor:
                        "#fff0f7",
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
                    marginBottom:
                      "16px",
                    fontWeight: "700",

                    color:
                      director.disponible
                        ? "#208653"
                        : "#8a8085",
                  }}
                >
                  {director.disponible
                    ? "🟢"
                    : "🟡"}{" "}
                  {director.estado}
                </p>

                <button
                  type="button"
                  disabled={
                    !director.disponible
                  }
                  onClick={() =>
                    abrirDirector(
                      director
                    )
                  }
                  style={{
                    width: "100%",
                    padding:
                      "11px 16px",
                    borderRadius:
                      "10px",
                    border: "none",

                    backgroundColor:
                      director.disponible
                        ? "#b44178"
                        : "#e5e1e3",

                    color:
                      director.disponible
                        ? "#ffffff"
                        : "#90878b",

                    cursor:
                      director.disponible
                        ? "pointer"
                        : "not-allowed",

                    fontWeight: "700",
                    fontSize: "15px",
                  }}
                >
                  {director.disponible
                    ? directorAbierto ===
                      director.id
                      ? "Cerrar análisis"
                      : "Abrir análisis"
                    : "Próximamente"}
                </button>
              </article>
            )
          )}
        </div>
      </section>

      {directorAbierto ===
        "comercial" && (
        <DirectorComercial
          datosDashboard={
            datosDashboard
          }
        />
      )}

      {directorAbierto ===
        "inventario" && (
        <DirectorInventario
          datosDashboard={
            datosDashboard
          }
          analisisFinanciero={
            analisisFinancieroCEO
          }
        />
      )}

      {directorAbierto ===
        "financiero" && (
        <DirectorFinanciero
          datosDashboard={
            datosDashboard
          }
          movimientos={
            movimientos
          }
        />
      )}

      {directorAbierto ===
        "marketing" && (
        <DirectorMarketing
          analisisMarketing={
            analisisMarketing
          }
        />
      )}

      {directorAbierto ===
        "rh" && (
        <DirectorRH
  analisisRH={
    analisisRH
  }
  organizationId={
    organizationId
  }
  businessId={
    businessId
  }
  branchId={
    branchId
  }
 
  empleados={
  usuariosRH
}

  onEmpleadoCreado={
    cargarEmpleadosRH
  }

/>
      )}

      {directorAbierto ===
        "ceo" && (
        <PanelCEOIA
          decisionCEO={
            decisionCEO
          }
        />
      )}
    </main>
  );
}

export default CentroInteligencia;