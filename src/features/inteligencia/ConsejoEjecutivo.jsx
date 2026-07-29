import TarjetaDirector from "./TarjetaDirector";

function ConsejoEjecutivo() {
  const directores = [
    {
      icono: "💰",
      cargo: "DIRECCIÓN FINANCIERA",
      nombre: "Director Financiero IA",
      estado: "Próximamente",
      resumen:
        "Analizará ingresos, gastos, flujo de efectivo, utilidad y punto de equilibrio.",
    },
    {
      icono: "📦",
      cargo: "DIRECCIÓN DE COMPRAS",
      nombre: "Director de Compras IA",
      estado: "Próximamente",
      resumen:
        "Recomendará compras según ventas, inventario disponible y comportamiento de cada producto.",
    },
    {
      icono: "📈",
      cargo: "DIRECCIÓN COMERCIAL",
      nombre: "Director Comercial IA",
      estado: "Próximamente",
      resumen:
        "Evaluará ventas, productos estrella, tendencias y oportunidades de crecimiento.",
    },
    {
      icono: "📣",
      cargo: "DIRECCIÓN DE MARKETING",
      nombre: "Director de Marketing IA",
      estado: "Próximamente",
      resumen:
        "Propondrá campañas, contenido, promociones y acciones para aumentar las ventas.",
    },
    {
      icono: "👥",
      cargo: "RECURSOS HUMANOS",
      nombre: "Director de Recursos Humanos IA",
      estado: "Próximamente",
      resumen:
        "Apoyará con horarios, incidencias, desempeño, nómina y organización del personal.",
    },
    {
      icono: "⚙️",
      cargo: "DIRECCIÓN DE OPERACIONES",
      nombre: "Director de Operaciones IA",
      estado: "Próximamente",
      resumen:
        "Supervisará procesos, sucursales, incidencias y eficiencia operativa.",
    },
  ];

  return (
    <section
      style={{
        marginTop: "26px",
      }}
    >
      <div
        style={{
          marginBottom: "18px",
        }}
      >
        <p
          style={{
            margin: 0,
            color: "#b34f7e",
            fontWeight: "800",
            fontSize: "13px",
            letterSpacing: "1.4px",
          }}
        >
          EQUIPO EJECUTIVO
        </p>

        <h2
          style={{
            margin: "6px 0 4px",
            color: "#2f2430",
            fontSize: "26px",
          }}
        >
          Directores de MONYS OS
        </h2>

        <p
          style={{
            margin: 0,
            color: "#775e6b",
            lineHeight: "1.6",
          }}
        >
          Cada dirección contará con su propio análisis especializado y
          recomendaciones para la toma de decisiones.
        </p>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
          gap: "18px",
        }}
      >
        {directores.map((director) => (
          <TarjetaDirector
            key={director.nombre}
            icono={director.icono}
            cargo={director.cargo}
            nombre={director.nombre}
            estado={director.estado}
            resumen={director.resumen}
            color="#9a5f7c"
          />
        ))}
      </div>
    </section>
  );
}

export default ConsejoEjecutivo;