export default function AnalisisEjecutivo({ analisis }) {
  if (!analisis) return null;

  return (
    <section
      style={{
        marginTop: "24px",
        padding: "24px",
        borderRadius: "18px",
        background: "linear-gradient(135deg, #6d3d5f, #8f5b86)",
        color: "#ffffff",
        boxShadow: "0 10px 25px rgba(0,0,0,0.15)",
      }}
    >
      <h2
        style={{
          marginTop: 0,
          marginBottom: "12px",
          fontSize: "26px",
        }}
      >
        🤖 Director General IA
      </h2>

      <h3
        style={{
          marginTop: 0,
          marginBottom: "12px",
          fontSize: "20px",
        }}
      >
        {analisis.titulo}
      </h3>

      <p
        style={{
          margin: 0,
          fontSize: "16px",
          lineHeight: "1.7",
        }}
      >
        {analisis.mensaje}
      </p>
    </section>
  );
}