import MensajeDirectorGeneral from "./MensajeDirectorGeneral";
import TarjetaDirector from "./TarjetaDirector";
import ConsejoEjecutivo from "./ConsejoEjecutivo";

function SalaConsejoIA({
  resumen,
  estado,
  nivel,
  datosDashboard,
}) {
  const metricas = datosDashboard?.metricas;

  return (
    <section
      style={{
        marginBottom: "35px",
        padding: "32px",
        borderRadius: "28px",
        background:
          "linear-gradient(135deg, #fff8fb 0%, #ffffff 55%, #fdf1f6 100%)",
        border: "1px solid #ebc7d8",
        boxShadow: "0 18px 45px rgba(151, 63, 107, 0.14)",
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
          Tu equipo ejecutivo ya analizó la información disponible.
          Esta es la reunión directiva de hoy.
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

      <TarjetaDirector
        icono="👔"
        cargo="PRESIDENTE DEL CONSEJO"
        nombre="Director General IA"
        estado={estado || "Operación analizada"}
        resumen="Supervisa la operación general y presenta los principales hallazgos y recomendaciones del negocio."
      >
        <MensajeDirectorGeneral
          resumen={resumen}
          totalProductos={metricas?.totalProductos}
          totalPiezas={metricas?.totalPiezas}
          productoLider={metricas?.productoMasVendido?.descripcion}
        />
      </TarjetaDirector>
    </section>
  );
}

export default SalaConsejoIA;