import OperacionHoy from "./OperacionHoy";
import CierreTurno from "./CierreTurno";

export default function InicioEmpleado({
  usuario,
  datosDashboard,
}) {
  const organizationId =
    datosDashboard?.organization_id || null;

  const businessId =
    datosDashboard?.business_id || null;

  const branchId =
    datosDashboard?.branch_id || null;

  const nombre =
    usuario?.nombre ||
    "Equipo MONYS";

  const puesto =
    usuario?.puesto ||
    usuario?.role ||
    "Operación";

  return (
    <main
      style={{
        minHeight: "100vh",
        background: "#fff7fb",
        paddingBottom: "90px",
      }}
    >
      {/* ======================================
          ENCABEZADO MÓVIL
          ====================================== */}

      <header
        style={{
          position: "sticky",
          top: 0,
          zIndex: 20,
          background: "#ffffff",
          borderBottom:
            "1px solid #f0dce6",
          padding:
            "16px 18px 14px",
          boxShadow:
            "0 3px 12px rgba(90, 40, 65, 0.06)",
        }}
      >
        <div
          style={{
            maxWidth: "720px",
            margin: "0 auto",
          }}
        >
          <div
            style={{
              color: "#c12c70",
              fontSize: "12px",
              fontWeight: "900",
              letterSpacing: "1.2px",
              marginBottom: "4px",
            }}
          >
            MONYS OS · OPERACIÓN
          </div>

          <h1
            style={{
              margin: 0,
              fontSize: "25px",
              color: "#251a20",
            }}
          >
            Hola, {nombre} 👋
          </h1>

          <div
            style={{
              marginTop: "5px",
              color: "#76666e",
              fontSize: "14px",
            }}
          >
            {puesto}
          </div>
        </div>
      </header>

      {/* ======================================
          CONTENIDO
          ====================================== */}

      <section
        style={{
          maxWidth: "720px",
          margin: "0 auto",
          padding: "18px 12px",
        }}
      >
        {/* MENSAJE PRINCIPAL */}

        <div
          style={{
            background:
              "linear-gradient(135deg, #fff 0%, #fff4f9 100%)",
            border:
              "1px solid #f0cddd",
            borderRadius: "18px",
            padding: "18px",
            marginBottom: "16px",
            boxShadow:
              "0 7px 22px rgba(93, 44, 67, 0.06)",
          }}
        >
          <div
            style={{
              fontSize: "21px",
              fontWeight: "900",
              color: "#2c2026",
              marginBottom: "7px",
            }}
          >
            📋 Tu trabajo de hoy
          </div>

          <div
            style={{
              color: "#75656d",
              lineHeight: 1.5,
              fontSize: "15px",
            }}
          >
            Revisa tus tareas, inicia la
            actividad, registra evidencia y
            termina cada trabajo cuando esté
            completo.
          </div>
        </div>

        {/* ======================================
            OPERACIÓN DE HOY
            ====================================== */}

        <div
          style={{
            background: "#ffffff",
            border:
              "1px solid #ecdce4",
            borderRadius: "18px",
            overflow: "hidden",
            marginBottom: "18px",
            boxShadow:
              "0 7px 22px rgba(93, 44, 67, 0.05)",
          }}
        >
          <OperacionHoy
            organizationId={
              organizationId
            }
            businessId={businessId}
            branchId={branchId}
          />
        </div>

        {/* ======================================
            CIERRE DE TURNO PLEGABLE
            ====================================== */}

        <details
          style={{
            background: "#ffffff",
            border:
              "1px solid #ecdce4",
            borderRadius: "18px",
            overflow: "hidden",
            boxShadow:
              "0 7px 22px rgba(93, 44, 67, 0.05)",
          }}
        >
          <summary
            style={{
              cursor: "pointer",
              padding: "18px",
              fontWeight: "900",
              fontSize: "18px",
              color: "#7c3158",
              listStyle: "none",
            }}
          >
            📝 Cierre de turno
          </summary>

          <div
            style={{
              padding:
                "0 10px 16px",
            }}
          >
            <CierreTurno
              branchId={branchId}
            />
          </div>
        </details>
      </section>

      {/* ======================================
          BARRA INFERIOR MÓVIL
          ====================================== */}

      <nav
        style={{
          position: "fixed",
          bottom: 0,
          left: 0,
          right: 0,
          background: "#ffffff",
          borderTop:
            "1px solid #ead7e1",
          minHeight: "64px",
          display: "flex",
          alignItems: "center",
          justifyContent:
            "space-around",
          zIndex: 30,
          boxShadow:
            "0 -5px 18px rgba(80, 35, 57, 0.08)",
        }}
      >
        <div
          style={{
            textAlign: "center",
            color: "#ae2d68",
            fontWeight: "900",
            fontSize: "13px",
          }}
        >
          <div
            style={{
              fontSize: "22px",
            }}
          >
            📋
          </div>

          Hoy
        </div>

        <div
          style={{
            textAlign: "center",
            color: "#94858c",
            fontWeight: "700",
            fontSize: "13px",
          }}
        >
          <div
            style={{
              fontSize: "22px",
            }}
          >
            ⚠️
          </div>

          Incidencias
        </div>

        <div
          style={{
            textAlign: "center",
            color: "#94858c",
            fontWeight: "700",
            fontSize: "13px",
          }}
        >
          <div
            style={{
              fontSize: "22px",
            }}
          >
            📝
          </div>

          Cierre
        </div>
      </nav>
    </main>
  );
}