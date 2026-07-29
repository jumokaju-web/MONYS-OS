const DashboardHeader = () => {
  return (
    <header
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        padding: "20px 30px",
        background: "#ffffff",
        borderRadius: "16px",
        boxShadow: "0 2px 10px rgba(0,0,0,0.05)",
        marginBottom: "25px",
      }}
    >
      <div>
        <h1
          style={{
            margin: 0,
            color: "#d63384",
            fontSize: "30px",
          }}
        >
          🌸 Bienvenida, Mony
        </h1>

        <p
          style={{
            marginTop: "8px",
            color: "#666",
            fontSize: "16px",
          }}
        >
          Tu empresa bajo control.
        </p>
      </div>

      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "20px",
          fontSize: "22px",
        }}
      >
        <span>🏪 Centro</span>
        <span>🔔</span>
        <span>👤</span>
      </div>
    </header>
  );
};

export default DashboardHeader;