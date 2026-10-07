import { useEffect, useState } from "react";
import { supabase } from "../../../supabase";
import OperacionEmpleado from "./OperacionEmpleado";
import CierreTurno from "./CierreTurno";
import { esPerfilGrowth } from "../shared/esPerfilGrowth";
import "./InicioEmpleado.css";

export default function InicioEmpleado({ usuario, datosDashboard }) {
  const branchId = datosDashboard?.branch_id || null;

  const nombre = usuario?.nombre || "Equipo MONYS";

  const puesto = usuario?.puesto || usuario?.role || "Operación";

  const esMarketing = esPerfilGrowth({ ...usuario, puesto });
  const [seccionGrowthActiva, setSeccionGrowthActiva] = useState("HOY");

  useEffect(() => {
    function reflejarSeccionGrowth(event) {
      setSeccionGrowthActiva(String(event?.detail || "HOY").toUpperCase());
    }

    window.addEventListener(
      "monys-growth-seccion-activa",
      reflejarSeccionGrowth,
    );

    return () => {
      window.removeEventListener(
        "monys-growth-seccion-activa",
        reflejarSeccionGrowth,
      );
    };
  }, []);

  async function cerrarSesion() {
    try {
      await supabase.auth.signOut();

      window.location.reload();
    } catch (error) {
      console.error("Error al cerrar sesión:", error);
    }
  }

  function navegarGrowth(seccion) {
    setSeccionGrowthActiva(seccion);

    window.dispatchEvent(
      new CustomEvent("monys-growth-navegar", {
        detail: seccion,
      }),
    );

    if (seccion === "HOY") {
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }

    window.setTimeout(() => {
      document
        .getElementById("centro-growth-operativo")
        ?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 40);
  }

  return (
    <main
      className={
        esMarketing ? "employee-home employee-home--growth" : "employee-home"
      }
      style={{
        minHeight: "100vh",
        background: "#fff7fb",
        paddingBottom: "calc(112px + env(safe-area-inset-bottom, 0px))",
      }}
    >
      {/* ======================================
          ENCABEZADO MÓVIL
          ====================================== */}

      <header
        className={
          esMarketing
            ? "employee-home__header employee-home__header--growth"
            : "employee-home__header"
        }
        style={{
          position: "sticky",
          top: 0,
          zIndex: 20,
          background: "#ffffff",
          borderBottom: "1px solid #f0dce6",
          padding: "16px 18px 14px",
          boxShadow: "0 3px 12px rgba(90, 40, 65, 0.06)",
        }}
      >
        <div
          style={{
            maxWidth: "720px",
            margin: "0 auto",
            position: "relative",
            paddingRight: "72px",
          }}
        >
          <div
            className="employee-home__brand"
            style={{
              color: "#c12c70",
              fontSize: "12px",
              fontWeight: "900",
              letterSpacing: "1.2px",
              marginBottom: "4px",
            }}
          >
            {esMarketing ? "MONYS OS · GROWTH" : "MONYS OS · OPERACIÓN"}
          </div>

          <h1
            className="employee-home__title"
            style={{
              margin: 0,
              fontSize: "25px",
              color: "#251a20",
              lineHeight: 1.15,
            }}
          >
            Hola, {esMarketing ? String(nombre).trim().split(/\s+/)[0] : nombre}{" "}
            {esMarketing ? "💗" : "👋"}
          </h1>

          <div
            className="employee-home__role"
            style={{
              marginTop: "5px",
              color: "#76666e",
              fontSize: "14px",
            }}
          >
            {esMarketing ? "Directora de Crecimiento" : puesto}
          </div>

          <button
            type="button"
            onClick={cerrarSesion}
            style={{
              position: "absolute",
              top: "2px",
              right: 0,
              border: "1px solid #ead7e1",
              background: "#ffffff",
              color: "#8b315c",
              borderRadius: "11px",
              padding: "8px 11px",
              fontWeight: "800",
              cursor: "pointer",
              fontSize: "13px",
            }}
            className="employee-home__logout"
          >
            Salir
          </button>
        </div>
      </header>

      {/* ======================================
          CONTENIDO
          ====================================== */}

      <section
        className={
          esMarketing
            ? "employee-home__content employee-home__content--growth"
            : "employee-home__content"
        }
        style={{
          maxWidth: "720px",
          margin: "0 auto",
          padding: "18px 12px",
        }}
      >
        {/* MENSAJE PRINCIPAL */}

        {!esMarketing && (
          <div
            style={{
              background: "linear-gradient(135deg, #fff 0%, #fff4f9 100%)",
              border: "1px solid #f0cddd",
              borderRadius: "18px",
              padding: "18px",
              marginBottom: "16px",
              boxShadow: "0 7px 22px rgba(93, 44, 67, 0.06)",
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
              Revisa tus tareas, inicia la actividad, registra evidencia y
              termina cada trabajo cuando esté completo.
            </div>
          </div>
        )}

        {/* ======================================
            OPERACIÓN INDIVIDUAL
            ====================================== */}

        <div
          className={
            esMarketing
              ? "employee-home__operation employee-home__operation--growth"
              : "employee-home__operation"
          }
          style={{
            background: "#ffffff",
            border: "1px solid #ecdce4",
            borderRadius: "18px",
            overflow: "hidden",
            marginBottom: "18px",
            boxShadow: "0 7px 22px rgba(93, 44, 67, 0.05)",
          }}
        >
          <OperacionEmpleado branchId={branchId} usuario={usuario} />
        </div>

        {/* ======================================
            CIERRE DE TURNO
            ====================================== */}

        <details
          style={{
            background: "#ffffff",
            border: "1px solid #ecdce4",
            borderRadius: "18px",
            overflow: "hidden",
            boxShadow: "0 7px 22px rgba(93, 44, 67, 0.05)",
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
              textAlign: "center",
            }}
          >
            📝 Cierre de turno
          </summary>

          <div
            style={{
              padding: "0 10px 16px",
            }}
          >
            <CierreTurno branchId={branchId} />
          </div>
        </details>
      </section>

      {/* ======================================
          BARRA INFERIOR MÓVIL
          ====================================== */}

      <nav
        className={
          esMarketing
            ? "employee-home__nav employee-home__nav--growth"
            : "employee-home__nav"
        }
        style={{
          position: "fixed",
          bottom: 0,
          left: 0,
          right: 0,
          background: "#ffffff",
          borderTop: "1px solid #ead7e1",
          minHeight: "64px",
          paddingBottom: "env(safe-area-inset-bottom, 0px)",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-around",
          zIndex: 30,
          boxShadow: "0 -5px 18px rgba(80, 35, 57, 0.08)",
        }}
      >
        {esMarketing ? (
          <>
            {[
              ["HOY", "⌂", "Inicio"],
              ["CAMPANAS", "▣", "Campañas"],
              ["CONTENIDO", "+", "Crear"],
              ["RESULTADOS", "▥", "Resultados"],
              ["OPORTUNIDADES", "•••", "Más"],
            ].map(([seccion, icono, etiqueta]) => (
              <button
                key={seccion}
                type="button"
                className={[
                  "employee-home__nav-button",
                  seccion === "CONTENIDO"
                    ? "employee-home__nav-button--primary"
                    : "",
                  (seccion === "OPORTUNIDADES"
                    ? ["OPORTUNIDADES", "APRENDIZAJES"].includes(
                        seccionGrowthActiva,
                      )
                    : seccionGrowthActiva === seccion)
                    ? "is-active"
                    : "",
                ]
                  .filter(Boolean)
                  .join(" ")}
                aria-label={etiqueta}
                aria-current={
                  seccionGrowthActiva === seccion ? "page" : undefined
                }
                onClick={() => navegarGrowth(seccion)}
              >
                <span>{icono}</span>
                {etiqueta}
              </button>
            ))}
          </>
        ) : (
          <>
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
              Turno
            </div>
          </>
        )}
      </nav>
    </main>
  );
}
