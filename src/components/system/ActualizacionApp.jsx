import { useEffect, useState } from "react";
import { useRegisterSW } from "virtual:pwa-register/react";

export default function ActualizacionApp() {
  const [actualizando, setActualizando] = useState(false);
  const [error, setError] = useState("");
  const {
    needRefresh: [hayActualizacion, setHayActualizacion],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW(_url, registro) {
      registro?.update().catch(() => {});
    },
  });

  useEffect(() => {
    const revisar = () => {
      if (document.visibilityState === "visible") {
        navigator.serviceWorker
          ?.getRegistration()
          .then((registro) => registro?.update())
          .catch(() => {});
      }
    };
    document.addEventListener("visibilitychange", revisar);
    return () => document.removeEventListener("visibilitychange", revisar);
  }, []);

  async function actualizarAplicacion() {
    if (actualizando) return;
    setActualizando(true);
    setError("");

    try {
      // Algunos navegadores no resuelven la promesa del Service Worker.
      // La recarga forzada evita que el botón permanezca bloqueado.
      await Promise.race([
        updateServiceWorker(true),
        new Promise((resolve) => window.setTimeout(resolve, 4000)),
      ]);
      window.location.reload();
    } catch {
      setError("No se pudo instalar automáticamente. Recarga la página para intentarlo de nuevo.");
      setActualizando(false);
    }
  }

  if (!hayActualizacion) return null;

  return (
    <aside
      role="status"
      style={{ position: "fixed", bottom: "max(16px, env(safe-area-inset-bottom))", left: 12, right: 12, maxWidth: 550, margin: "0 auto", zIndex: 10000, padding: 16, borderRadius: 16, background: "#49293e", color: "#fff", boxShadow: "0 8px 32px #49293e40" }}
    >
      <strong>Hay una nueva versión de MONYS</strong>
      <p style={{ fontSize: 12, lineHeight: 1.5, color: "#f7e5ef", margin: "6px 0 10px" }}>
        Guarda lo que estés capturando antes de actualizar. La pantalla se recargará.
      </p>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <button
          type="button"
          onClick={actualizarAplicacion}
          disabled={actualizando}
          style={{ padding: "10px 16px", border: 0, borderRadius: 10, background: "#f3c9dd", color: "#49293e", fontWeight: 800, cursor: actualizando ? "wait" : "pointer" }}
        >
          {actualizando ? "Actualizando…" : "Actualizar aplicación"}
        </button>
        {!actualizando && (
          <button
            type="button"
            onClick={() => setHayActualizacion(false)}
            style={{ padding: "10px 12px", border: "1px solid #c99db4", borderRadius: 10, background: "transparent", color: "#fff", fontWeight: 750 }}
          >
            Después
          </button>
        )}
      </div>
      {error && <small role="alert" style={{ display: "block", marginTop: 9, color: "#ffd7d7" }}>{error}</small>}
    </aside>
  );
}
