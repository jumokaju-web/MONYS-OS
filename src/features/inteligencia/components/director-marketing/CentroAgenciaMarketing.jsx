function convertirNumero(valor) {
  const numero = Number(valor);

  return Number.isFinite(numero)
    ? numero
    : 0;
}

function obtenerEstadoCampana(campanasActivas) {
  if (campanasActivas.length > 0) {
    return {
      texto: `${campanasActivas.length} activa${
        campanasActivas.length === 1
         ? ""
          : "s"
      }`,
      fondo: "#dcfce7",
      color: "#166534",
    };
  }

  return {
    texto: "Sin campaña activa",
    fondo: "#fef3c7",
    color: "#92400e",
  };
}

export default function CentroAgenciaMarketing({
  productoLider,
  inventarioProductoLider,
  campanasActivas = [],
  accionesPrioritarias = [],
  onPrepararPlan,
}) {
  const nombreProducto =
    productoLider?.nombre ||
    "Producto por seleccionar";

  const existencia = convertirNumero(
    inventarioProductoLider?.existencia
  );

  const cobertura = convertirNumero(
    inventarioProductoLider?.diasCobertura
  );

  const campanaSinAvance =
  campanasActivas.find((campana) => {
    const historial =
      Array.isArray(
        campana?.resultado?.historial
      )
        ? campana.resultado.historial
        : [];

    const fechaActualizacion =
      campana?.updated_at
        ? new Date(campana.updated_at)
        : null;

    if (
      historial.length > 0 ||
      !fechaActualizacion ||
      Number.isNaN(
        fechaActualizacion.getTime()
      )
    ) {
      return false;
    }

    const horasSinAvance = Math.floor(
      (Date.now() -
        fechaActualizacion.getTime()) /
        3600000
    );

    return horasSinAvance >= 24;
  }) || null;

const horasSinAvance =
  campanaSinAvance?.updated_at
    ? Math.max(
        0,
        Math.floor(
          (Date.now() -
            new Date(
              campanaSinAvance.updated_at
            ).getTime()) /
            3600000
        )
      )
    : 0;

const accionPrincipal =
  campanaSinAvance
    ? {
        titulo:
          "Registrar avance de campaña antes de continuar",
        descripcion:
          `La campaña ${
            campanaSinAvance.nombre ||
            campanaSinAvance.producto ||
            "activa"
          } lleva ${horasSinAvance} horas sin resultados registrados. Kary debe confirmar publicación, gasto, mensajes, pedidos y ventas reales antes de invertir más.`,
      }
    : cobertura > 45
      ? {
          titulo:
            `Acelerar rotación de ${nombreProducto}`,
          descripcion:
            `La cobertura es de ${cobertura.toFixed(
              1
            )} días frente al objetivo de 30. Conviene crear contenido y una oferta controlada con inventario existente, sin comprar más.`,
        }
      : accionesPrioritarias[0] ||
        null;

  const estadoCampana =
    obtenerEstadoCampana(campanasActivas);

  const herramientas = [
    {
      icono: "🎬",
      titulo: "Estudio de contenido",
      descripcion:
        "Guiones, ganchos, CTA, formatos y revisión con IA antes de publicar.",
      estado: "Siguiente etapa",
    },
    {
      icono: "📅",
      titulo: "Calendario inteligente",
      descripcion:
        "Qué publicar, en qué canal, a qué hora y con qué objetivo.",
      estado: "Plan semanal disponible",
    },
    {
      icono: "📣",
      titulo: "Campañas y anuncios",
      descripcion:
        "Orgánico, Meta, TikTok, Marketplace, Mercado Libre y ChatGPT Ads.",
      estado: estadoCampana.texto,
    },
    {
      icono: "📈",
      titulo: "Resultados y embudo",
      descripcion:
        "Alcance, mensajes, pedidos, ventas, gasto, costo por pedido y utilidad.",
      estado: "Con datos reales",
    },
    {
      icono: "🔥",
      titulo: "Tendencias y competencia",
      descripcion:
        "Detectar contenido, productos y formatos que están ganando atención.",
      estado: "Por conectar",
    },
    {
      icono: "🧠",
      titulo: "Aprendizaje MONYS",
      descripcion:
        "Recordar qué funcionó, qué falló y decidir si mantener, mejorar o detener.",
      estado: "Memoria activa",
    },
  ];

  return (
    <section
      style={{
        marginTop: "22px",
        padding: "22px",
        borderRadius: "20px",
        background:
          "linear-gradient(135deg, #5f1742 0%, #982f68 100%)",
        color: "#ffffff",
        boxShadow:
          "0 16px 38px rgba(95, 23, 66, 0.18)",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          gap: "14px",
          flexWrap: "wrap",
        }}
      >
        <div>
          <div
            style={{
              fontSize: "12px",
              fontWeight: "900",
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              color: "#ffd6e9",
            }}
          >
            MONYS OS · Agencia IA
          </div>

          <h2
            style={{
              margin: "7px 0 5px",
              fontSize: "26px",
            }}
          >
            Centro de crecimiento
          </h2>

          <p
            style={{
              margin: 0,
              maxWidth: "680px",
              lineHeight: 1.55,
              color: "#fff1f7",
            }}
          >
            MONYS convierte datos reales en
            instrucciones claras para que
            Marketing sepa qué vender, qué
            crear, dónde publicar y qué
            resultado medir.
          </p>
        </div>

        <span
          style={{
            padding: "8px 12px",
            borderRadius: "999px",
            background: estadoCampana.fondo,
            color: estadoCampana.color,
            fontSize: "12px",
            fontWeight: "900",
          }}
        >
          {estadoCampana.texto}
        </span>
      </div>

      <div
        style={{
          marginTop: "20px",
          padding: "18px",
          borderRadius: "16px",
          background: "#ffffff",
          color: "#33232c",
        }}
      >
        <div
          style={{
            fontSize: "12px",
            fontWeight: "900",
            color: "#a42662",
            textTransform: "uppercase",
          }}
        >
          ⚡ Qué merece atención ahora
        </div>

        <h3
          style={{
            margin: "8px 0 6px",
          }}
        >
          {accionPrincipal?.titulo ||
            `Preparar crecimiento para ${nombreProducto}`}
        </h3>

        <p
          style={{
            margin: 0,
            lineHeight: 1.55,
            color: "#6f5b65",
          }}
        >
          {accionPrincipal?.descripcion ||
            "Define el objetivo de la semana y convierte la estrategia en tareas claras para Marketing."}
        </p>

        <div
          style={{
            display: "flex",
            gap: "8px",
            flexWrap: "wrap",
            marginTop: "14px",
          }}
        >
          <span
            style={{
              padding: "7px 10px",
              borderRadius: "999px",
              background: "#fce7f3",
              color: "#9d174d",
              fontSize: "12px",
              fontWeight: "800",
            }}
          >
            Producto: {
  campanaSinAvance?.producto ||
  nombreProducto
}
          </span>

          <span
            style={{
              padding: "7px 10px",
              borderRadius: "999px",
              background: "#eef2ff",
              color: "#3730a3",
              fontSize: "12px",
              fontWeight: "800",
            }}
          >
            {campanaSinAvance
  ? `Canal: ${String(
      campanaSinAvance.canal_principal ||
        "Sin canal definido"
    )
      .split(",")[0]
      .trim()}`
  : `Existencia: ${existencia}`}
          </span>

          <span
            style={{
              padding: "7px 10px",
              borderRadius: "999px",
              background: "#ecfdf5",
              color: "#047857",
              fontSize: "12px",
              fontWeight: "800",
            }}
          >
          {campanaSinAvance
  ? `Sin avance: ${horasSinAvance} h`
  : `Cobertura: ${cobertura.toFixed(
      1
    )} días`}
          </span>
        </div>

        <button
  type="button"
  onClick={() => {
    if (campanaSinAvance) {
      const seccionCampanas =
        document.getElementById(
          "campanas-marketing-activas"
        );

      seccionCampanas?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });

      return;
    }

    onPrepararPlan?.();
  }}
  disabled={
    !campanaSinAvance &&
    !onPrepararPlan
  }
  style={{
    width: "100%",
    marginTop: "16px",
    padding: "13px",
    border: "none",
    borderRadius: "11px",
    background:
      campanaSinAvance ||
      onPrepararPlan
        ? "#b92769"
        : "#d8c7cf",
    color: "#ffffff",
    fontWeight: "900",
    cursor:
      campanaSinAvance ||
      onPrepararPlan
        ? "pointer"
        : "not-allowed",
  }}
>
  {campanaSinAvance
    ? "📊 Ir a registrar avance real"
    : "✨ Convertir estrategia en plan de trabajo"}
</button>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns:
            "repeat(auto-fit, minmax(220px, 1fr))",
          gap: "12px",
          marginTop: "16px",
        }}
      >
        {herramientas.map((herramienta) => (
          <article
            key={herramienta.titulo}
            style={{
              padding: "16px",
              borderRadius: "15px",
              background:
                "rgba(255, 255, 255, 0.96)",
              color: "#33232c",
              border:
                "1px solid rgba(255, 255, 255, 0.7)",
            }}
          >
            <div
              style={{
                fontSize: "24px",
              }}
            >
              {herramienta.icono}
            </div>

            <strong
              style={{
                display: "block",
                marginTop: "8px",
                color: "#7d3157",
              }}
            >
              {herramienta.titulo}
            </strong>

            <p
              style={{
                margin: "7px 0 12px",
                color: "#75616b",
                fontSize: "13px",
                lineHeight: 1.5,
              }}
            >
              {herramienta.descripcion}
            </p>

            <span
              style={{
                display: "inline-block",
                padding: "6px 9px",
                borderRadius: "999px",
                background: "#f8e7ef",
                color: "#8f2858",
                fontSize: "11px",
                fontWeight: "900",
              }}
            >
              {herramienta.estado}
            </span>
          </article>
        ))}
      </div>
    </section>
  );
}