import Header from "../../components/layout/Header";

export default function InicioJefa({
  ventasTotales = 0,
  utilidadTotal = 0,
  disponible = 0,
  movimientos = [],
  formatoDinero,
  abrirJuntaDirectiva,
  abrirTesoreria,
  abrirInventario,
  abrirCompraMaestra,
  abrirUsuarios,
  contenidoOperacion = null,
  contenidoAcciones = null,
  contenidoSicar = null,
  contenidoCierre = null,
}) {
  const movimientosPendientes =
    movimientos.filter((movimiento) => {
      const estado = String(
        movimiento?.estado || ""
      ).toLowerCase();

      return (
        estado.includes("pendiente") ||
        estado.includes("revision")
      );
    }).length;

  const hayPendientes =
    movimientosPendientes > 0;

  return (
    <main
      style={{
        minHeight: "100vh",
        background: "#fff8fb",
        paddingBottom: "40px",
      }}
    >
      <Header />

      <section
        style={{
          width: "min(100% - 24px, 1100px)",
          margin: "0 auto",
          paddingTop: "18px",
        }}
      >
        {/* =====================================
            SALUDO
            ===================================== */}

        <div
          style={{
            marginBottom: "16px",
          }}
        >
          <div
            style={{
              color: "#a92e67",
              fontSize: "12px",
              fontWeight: "900",
              letterSpacing: "1px",
            }}
          >
            MONYS OS · DIRECCIÓN
          </div>

          <h1
            style={{
              margin: "4px 0 3px",
              fontSize: "28px",
              color: "#291d23",
            }}
          >
            Hola, Jefa 👑
          </h1>

          <div
            style={{
              color: "#7d6e75",
              fontSize: "14px",
            }}
          >
            Esto es lo importante de tu
            negocio ahora.
          </div>
        </div>

        {/* =====================================
            3 NÚMEROS IMPORTANTES
            ===================================== */}

        <div
          style={{
            display: "grid",
            gridTemplateColumns:
              "repeat(3, minmax(0, 1fr))",
            gap: "8px",
            marginBottom: "16px",
          }}
        >
          <MetricaJefa
            titulo="Ventas"
            valor={formatoDinero(
              ventasTotales
            )}
          />

          <MetricaJefa
            titulo="Utilidad"
            valor={formatoDinero(
              utilidadTotal
            )}
          />

          <MetricaJefa
            titulo="Disponible"
            valor={formatoDinero(
              disponible
            )}
          />
        </div>

        {/* =====================================
            NECESITA TU ATENCIÓN
            ===================================== */}

        <section
          style={{
            background: hayPendientes
              ? "#fff7f3"
              : "#f3faf6",
            border: hayPendientes
              ? "1px solid #f0d1c5"
              : "1px solid #cae6d5",
            borderRadius: "18px",
            padding: "17px",
            marginBottom: "14px",
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent:
                "space-between",
              gap: "12px",
              alignItems: "flex-start",
            }}
          >
            <div>
              <div
                style={{
                  fontSize: "12px",
                  fontWeight: "900",
                  color: hayPendientes
                    ? "#a65435"
                    : "#377357",
                  marginBottom: "5px",
                  letterSpacing: "0.5px",
                }}
              >
                {hayPendientes
                  ? "REQUIERE TU ATENCIÓN"
                  : "OPERACIÓN BAJO CONTROL"}
              </div>

              <strong
                style={{
                  display: "block",
                  fontSize: "18px",
                  color: "#30232a",
                }}
              >
                {hayPendientes
                  ? `${movimientosPendientes} movimientos pendientes`
                  : "No hay alertas críticas aquí"}
              </strong>

              <div
                style={{
                  marginTop: "5px",
                  color: "#77686f",
                  fontSize: "14px",
                  lineHeight: 1.4,
                }}
              >
                {hayPendientes
                  ? "MONYS concentrará aquí solamente los asuntos que realmente necesiten tu decisión."
                  : "No necesitas revisar listas completas si todo marcha correctamente."}
              </div>
            </div>

            <div
              style={{
                fontSize: "26px",
              }}
            >
              {hayPendientes
                ? "🚨"
                : "✅"}
            </div>
          </div>

          {hayPendientes && (
            <button
              type="button"
              onClick={abrirTesoreria}
              style={estiloBotonSecundario}
            >
              Revisar pendientes
            </button>
          )}
        </section>

        {/* =====================================
            MONYS RECOMIENDA
            ===================================== */}

        <section
          style={{
            background:
              "linear-gradient(135deg, #6f2750 0%, #a93670 100%)",
            borderRadius: "20px",
            padding: "19px",
            color: "#ffffff",
            marginBottom: "14px",
            boxShadow:
              "0 10px 28px rgba(112,39,80,0.17)",
          }}
        >
          <div
            style={{
              fontSize: "12px",
              fontWeight: "900",
              opacity: 0.8,
              letterSpacing: "0.7px",
            }}
          >
            🧠 MONYS TE RECOMIENDA
          </div>

          <div
            style={{
              fontSize: "20px",
              fontWeight: "900",
              marginTop: "7px",
              lineHeight: 1.25,
            }}
          >
            Revisa solamente lo que puede
            cambiar el resultado del día.
          </div>

          <div
            style={{
              marginTop: "8px",
              fontSize: "14px",
              opacity: 0.88,
              lineHeight: 1.5,
            }}
          >
            Aquí vamos a colocar la decisión
            prioritaria calculada por tus
            Directores IA.
          </div>

          <button
            type="button"
            onClick={abrirJuntaDirectiva}
            style={{
              marginTop: "14px",
              width: "100%",
              border: "none",
              background: "#ffffff",
              color: "#762a53",
              borderRadius: "13px",
              padding: "12px",
              fontWeight: "900",
              cursor: "pointer",
            }}
          >
            👑 Entrar a Junta Directiva
          </button>
        </section>

        {/* =====================================
            VALOR MONYS
            ===================================== */}

        <section
          style={{
            background: "#ffffff",
            border:
              "1px solid #eadde4",
            borderRadius: "18px",
            padding: "17px",
            marginBottom: "14px",
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent:
                "space-between",
              alignItems: "center",
              gap: "12px",
            }}
          >
            <div>
              <div
                style={{
                  color: "#8b315d",
                  fontSize: "12px",
                  fontWeight: "900",
                }}
              >
                💰 VALOR GENERADO POR MONYS
              </div>

              <strong
                style={{
                  display: "block",
                  marginTop: "5px",
                  fontSize: "19px",
                  color: "#2d2127",
                }}
              >
                Empezaremos a medirlo
              </strong>

              <div
                style={{
                  color: "#786970",
                  marginTop: "5px",
                  fontSize: "13px",
                }}
              >
                Ahorros + ventas recuperadas +
                compras evitadas + horas
                liberadas.
              </div>
            </div>

            <div
              style={{
                fontSize: "28px",
              }}
            >
              📈
            </div>
          </div>
        </section>

        {/* =====================================
            ACCIONES DE DUEÑA
            ===================================== */}

        <div
          style={{
            display: "grid",
            gridTemplateColumns:
              "repeat(2, minmax(0, 1fr))",
            gap: "9px",
            marginBottom: "18px",
          }}
        >
          <Acceso
            icono="📦"
            texto="Inventario"
            onClick={
              abrirInventario
            }
          />

          <Acceso
            icono="🛒"
            texto="Compra Maestra"
            onClick={
              abrirCompraMaestra
            }
          />

          <Acceso
            icono="💰"
            texto="Tesorería"
            onClick={
              abrirTesoreria
            }
          />

          <Acceso
            icono="👥"
            texto="Usuarios"
            onClick={
              abrirUsuarios
            }
          />
        </div>

        {/* =====================================
            INFORMACIÓN DETALLADA
            ===================================== */}

        <div
          style={{
            marginBottom: "8px",
            fontSize: "13px",
            fontWeight: "900",
            color: "#846e79",
          }}
        >
          MÁS INFORMACIÓN
        </div>

        {contenidoAcciones && (
          <BloquePlegable
            titulo="🎯 Acciones prioritarias"
          >
            {contenidoAcciones}
          </BloquePlegable>
        )}

        {contenidoOperacion && (
          <BloquePlegable
            titulo="⚡ Operación completa"
          >
            {contenidoOperacion}
          </BloquePlegable>
        )}

        {contenidoSicar && (
          <BloquePlegable
            titulo="📊 Resumen SICAR"
          >
            {contenidoSicar}
          </BloquePlegable>
        )}

        {contenidoCierre && (
          <BloquePlegable
            titulo="📝 Cierre de turno"
          >
            {contenidoCierre}
          </BloquePlegable>
        )}
      </section>
    </main>
  );
}

function MetricaJefa({
  titulo,
  valor,
}) {
  return (
    <div
      style={{
        background: "#ffffff",
        border:
          "1px solid #eadde4",
        borderRadius: "14px",
        padding: "12px 8px",
        textAlign: "center",
        minWidth: 0,
      }}
    >
      <div
        style={{
          color: "#8a7680",
          fontSize: "11px",
          fontWeight: "800",
          marginBottom: "5px",
        }}
      >
        {titulo}
      </div>

      <strong
        style={{
          color: "#2d2027",
          fontSize: "14px",
          wordBreak: "break-word",
        }}
      >
        {valor}
      </strong>
    </div>
  );
}

function Acceso({
  icono,
  texto,
  onClick,
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        border:
          "1px solid #eadde4",
        background: "#ffffff",
        borderRadius: "14px",
        padding: "13px 10px",
        color: "#4d3642",
        fontWeight: "800",
        cursor: "pointer",
        textAlign: "left",
      }}
    >
      <span
        style={{
          marginRight: "7px",
        }}
      >
        {icono}
      </span>

      {texto}
    </button>
  );
}

function BloquePlegable({
  titulo,
  children,
}) {
  return (
    <details
      style={{
        background: "#ffffff",
        border:
          "1px solid #eadde4",
        borderRadius: "15px",
        marginBottom: "10px",
        overflow: "hidden",
      }}
    >
      <summary
        style={{
          padding: "15px",
          cursor: "pointer",
          fontWeight: "800",
          color: "#6e4058",
        }}
      >
        {titulo}
      </summary>

      <div
        style={{
          padding:
            "0 8px 14px",
        }}
      >
        {children}
      </div>
    </details>
  );
}

const estiloBotonSecundario = {
  marginTop: "12px",
  border:
    "1px solid #e3c4b8",
  background: "#ffffff",
  color: "#8d4b35",
  borderRadius: "11px",
  padding: "9px 12px",
  fontWeight: "800",
  cursor: "pointer",
};