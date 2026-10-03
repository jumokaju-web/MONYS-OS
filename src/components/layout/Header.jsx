import {
  useState,
} from "react";

import { supabase } from "../../supabase";
import { systemConfig } from "../../core/config/systemConfig";

function Header() {
  const [
    menuAbierto,
    setMenuAbierto,
  ] = useState(false);

  async function cerrarSesion() {
    try {
      const {
        error,
      } = await supabase.auth.signOut();

      if (error) {
        throw error;
      }

      window.location.reload();
    } catch (error) {
      console.error(
        "Error al cerrar sesión:",
        error
      );

      alert(
        "No fue posible cerrar la sesión."
      );
    }
  }

  return (
    <header
      className="encabezado"
    >
      <div className="encabezado-marca">
        <span className="monys-logo">M</span>

        <div>
          <span className="marca">
            {systemConfig.app.name}
          </span>

          <span className="marca-subtitulo">
            Control inteligente de {systemConfig.app.company}
          </span>
        </div>
      </div>

      <div
        style={{
          position: "relative",
        }}
      >
        <button
          type="button"
          className="perfil"
          aria-label="Abrir menú de perfil"
          title="Perfil y sesión"
          onClick={() =>
            setMenuAbierto(
              (valor) => !valor
            )
          }
        >
          MJ
        </button>

        {menuAbierto && (
          <div
            style={{
              position: "absolute",
              top: "58px",
              right: 0,
              minWidth: "180px",
              background: "#ffffff",
              border:
                "1px solid #eadde4",
              borderRadius: "12px",
              boxShadow:
                "0 10px 30px rgba(80, 35, 57, 0.15)",
              padding: "8px",
              zIndex: 100,
            }}
          >
            <button
              type="button"
              onClick={
                cerrarSesion
              }
              style={{
                width: "100%",
                border: "none",
                background:
                  "transparent",
                padding:
                  "12px 14px",
                textAlign: "left",
                cursor: "pointer",
                borderRadius:
                  "8px",
                fontWeight:
                  "800",
                color:
                  "#8f2f5e",
              }}
            >
              🚪 Cerrar sesión
            </button>
          </div>
        )}
      </div>
    </header>
  );
}

export default Header;
