import ZonaCarga from "../components/ZonaCarga";
function ImportadorPage({ volverAlDashboard }) {
  return (
    <main
      style={{
        minHeight: "100vh",
        background: "#f8f5f7",
        padding: "24px",
      }}
    >
      <section
        style={{
          maxWidth: "1000px",
          margin: "0 auto",
        }}
      >
        <button
          type="button"
          onClick={volverAlDashboard}
          style={{
            border: "none",
            background: "transparent",
            color: "#7a315f",
            fontWeight: "700",
            cursor: "pointer",
            marginBottom: "18px",
          }}
        >
          ← Regresar al dashboard
        </button>

        <header style={{ marginBottom: "24px" }}>
          <p
            style={{
              margin: "0 0 6px",
              color: "#9b4f80",
              fontWeight: "700",
            }}
          >
            MONYS Intelligence
          </p>

          <h1
            style={{
              margin: "0",
              color: "#3f2436",
              fontSize: "32px",
            }}
          >
            Importador inteligente SICAR
          </h1>

          <p
            style={{
              color: "#6f626a",
              maxWidth: "700px",
            }}
          >
            Sube reportes de SICAR para que MONYS Intelligence los
            identifique, organice y prepare para su análisis.
          </p>
        </header>
        
<ZonaCarga />
       
      </section>
    </main>
  );
}

export default ImportadorPage;