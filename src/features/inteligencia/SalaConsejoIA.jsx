import MensajeDirectorGeneral from "./MensajeDirectorGeneral";
import TarjetaDirector from "./TarjetaDirector";
import { calcularSaludNegocio } from "./motor/utils/calcularSaludNegocio";

function obtenerColorSalud(porcentaje) {
  if (porcentaje >= 85) {
    return {
      principal: "#208653",
      fondo: "#eaf8f0",
      borde: "#a8dfbd",
      icono: "🟢",
    };
  }

  if (porcentaje >= 70) {
    return {
      principal: "#9a7200",
      fondo: "#fff8dc",
      borde: "#ead585",
      icono: "🟡",
    };
  }

  if (porcentaje >= 50) {
    return {
      principal: "#bd6500",
      fondo: "#fff0df",
      borde: "#edc18e",
      icono: "🟠",
    };
  }

  return {
    principal: "#b02a37",
    fondo: "#fdebed",
    borde: "#e5a5ac",
    icono: "🔴",
  };
}

function IndicadorSalud({
  nombre,
  porcentaje,
  icono,
}) {
  const colores = obtenerColorSalud(porcentaje);

  return (
    <article
      style={{
        padding: "18px",
        borderRadius: "18px",
        background: colores.fondo,
        border: `1px solid ${colores.borde}`,
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "12px",
          marginBottom: "12px",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "9px",
          }}
        >
          <span
            style={{
              fontSize: "22px",
            }}
          >
            {icono}
          </span>

          <span
            style={{
              color: "#4d3d45",
              fontWeight: "800",
              fontSize: "15px",
            }}
          >
            {nombre}
          </span>
        </div>

        <strong
          style={{
            color: colores.principal,
            fontSize: "21px",
          }}
        >
          {porcentaje}%
        </strong>
      </div>

      <div
        style={{
          width: "100%",
          height: "10px",
          overflow: "hidden",
          borderRadius: "999px",
          backgroundColor: "rgba(255, 255, 255, 0.85)",
        }}
      >
        <div
          style={{
            width: `${porcentaje}%`,
            height: "100%",
            borderRadius: "999px",
            backgroundColor: colores.principal,
            transition: "width 0.4s ease",
          }}
        />
      </div>
    </article>
  );
}

function SalaConsejoIA({
  resumen,
  estado,
  nivel,
  decisionEjecutiva,
  datosDashboard,
  movimientos = [],
}) {

  const metricas = datosDashboard?.metricas;

  const saludNegocio = calcularSaludNegocio({
    datosDashboard,
    movimientos,
  });

  const coloresGenerales = obtenerColorSalud(
    saludNegocio.general
  );

  return (
    <section
      style={{
        marginBottom: "35px",
        padding: "32px",
        borderRadius: "28px",
        background:
          "linear-gradient(135deg, #fff8fb 0%, #ffffff 55%, #fdf1f6 100%)",
        border: "1px solid #ebc7d8",
        boxShadow:
          "0 18px 45px rgba(151, 63, 107, 0.14)",
      }}
    >
      <header
        style={{
          marginBottom: "28px",
          paddingBottom: "24px",
          borderBottom: "1px solid #f0d8e3",
        }}
      >
        <p
          style={{
            margin: 0,
            color: "#b34f7e",
            fontWeight: "800",
            fontSize: "13px",
            letterSpacing: "1.5px",
          }}
        >
          MONYS OS · CONSEJO DIRECTIVO DIGITAL
        </p>

        <h1
          style={{
            margin: "10px 0 8px",
            color: "#2f2430",
            fontSize: "36px",
            lineHeight: "1.15",
          }}
        >
          Hola, Jefa 👑
        </h1>

        <p
          style={{
            margin: 0,
            maxWidth: "760px",
            color: "#775e6b",
            fontSize: "17px",
            lineHeight: "1.6",
          }}
        >
          Tu equipo ejecutivo ya analizó la información
          disponible. Esta es la reunión directiva de hoy.
        </p>

        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: "10px",
            marginTop: "18px",
          }}
        >
          <span
            style={{
              padding: "8px 14px",
              borderRadius: "999px",
              background: "#f9e5ef",
              color: "#9c3f6a",
              fontSize: "14px",
              fontWeight: "700",
            }}
          >
            Estado: {estado || "En análisis"}
          </span>

          <span
            style={{
              padding: "8px 14px",
              borderRadius: "999px",
              background: "#f6edf2",
              color: "#765565",
              fontSize: "14px",
              fontWeight: "700",
            }}
          >
            Nivel: {nivel || "Ejecutivo"}
          </span>
        </div>
      </header>

      <section
        style={{
          marginBottom: "28px",
          padding: "25px",
          borderRadius: "22px",
          backgroundColor: "#ffffff",
          border: "1px solid #ead2de",
          boxShadow:
            "0 10px 28px rgba(151, 63, 107, 0.09)",
        }}
      >
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            alignItems: "center",
            justifyContent: "space-between",
            gap: "18px",
            marginBottom: "22px",
          }}
        >
          <div>
            <p
              style={{
                margin: "0 0 6px",
                color: "#a14570",
                fontSize: "13px",
                fontWeight: "800",
                letterSpacing: "1px",
              }}
            >
              INDICADOR EJECUTIVO
            </p>

            <h2
              style={{
                margin: 0,
                color: "#33272e",
                fontSize: "27px",
              }}
            >
              🏢 Salud del Negocio
            </h2>
          </div>

          <div
            style={{
              minWidth: "190px",
              padding: "16px 20px",
              borderRadius: "18px",
              backgroundColor: coloresGenerales.fondo,
              border: `1px solid ${coloresGenerales.borde}`,
              textAlign: "center",
            }}
          >
            <div
              style={{
                color: coloresGenerales.principal,
                fontSize: "35px",
                fontWeight: "900",
                lineHeight: "1",
              }}
            >
              {saludNegocio.general}%
            </div>

            <div
              style={{
                marginTop: "8px",
                color: coloresGenerales.principal,
                fontSize: "14px",
                fontWeight: "800",
                textTransform: "uppercase",
              }}
            >
              {coloresGenerales.icono}{" "}
              {saludNegocio.estado.etiqueta}
            </div>
          </div>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns:
              "repeat(auto-fit, minmax(210px, 1fr))",
            gap: "14px",
          }}
        >
          <IndicadorSalud
            nombre="Comercial"
            porcentaje={saludNegocio.comercial}
            icono="🛒"
          />

          <IndicadorSalud
            nombre="Inventario"
            porcentaje={saludNegocio.inventario}
            icono="📦"
          />

          <IndicadorSalud
            nombre="Finanzas"
            porcentaje={saludNegocio.financiera}
            icono="📊"
          />

          <IndicadorSalud
            nombre="Tesorería"
            porcentaje={saludNegocio.tesoreria}
            icono="💰"
          />
        </div>
      </section>

    

       {decisionEjecutiva && (
  <div
    style={{
      background: "#fff7ed",
      border: "2px solid #fb923c",
      borderRadius: "16px",
      padding: "20px",
      marginBottom: "24px",
      boxShadow: "0 8px 24px rgba(0,0,0,0.08)",
    }}
  >
    <div
      style={{
        fontSize: "13px",
        fontWeight: "bold",
        color: "#9a3412",
        marginBottom: "10px",
      }}
    >
      🧠 DECISIÓN EJECUTIVA DEL DÍA
    </div>

    <h2
      style={{
        margin: 0,
        marginBottom: "12px",
      }}
    >
      {decisionEjecutiva.titulo}
    </h2>

    <p
      style={{
        margin: 0,
        lineHeight: "1.7",
      }}
    >
      {decisionEjecutiva.accion}
    </p>

    <div
      style={{
        marginTop: "14px",
        fontSize: "13px",
        color: "#6b7280",
      }}
    >
      Prioridad:
      <strong> {decisionEjecutiva.prioridad}</strong>

      {" • "}

      Origen:
      <strong> {decisionEjecutiva.origen}</strong>
    </div>
  </div>
)}

      <TarjetaDirector
        icono="👔"
        cargo="PRESIDENTE DEL CONSEJO"
        nombre="Director General IA"
        estado={estado || "Operación analizada"}
        resumen=""
      >
        <MensajeDirectorGeneral
          resumen={resumen}
          totalProductos={metricas?.totalProductos}
          totalPiezas={metricas?.totalPiezas}
          productoLider={
            metricas?.productoMasVendido?.descripcion
          }
          cantidadProductoLider={
  metricas?.productoMasVendido?.cantidad
}
        />
      </TarjetaDirector>
    </section>
  );
}

export default SalaConsejoIA;