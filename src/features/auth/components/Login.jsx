import { useState } from "react";

import { supabase } from "../../../supabase";

export default function Login() {
  const [correo, setCorreo] = useState("");
  const [password, setPassword] = useState("");
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState("");

  async function iniciarSesion(evento) {
    evento.preventDefault();

    try {
      setCargando(true);
      setError("");

      const {
        error: errorLogin,
      } = await supabase.auth.signInWithPassword({
        email: correo.trim(),
        password,
      });

      if (errorLogin) {
        throw errorLogin;
      }
    } catch (errorInicio) {
      console.error(
        "Error al iniciar sesión:",
        errorInicio
      );

      setError(
        errorInicio.message ||
          "No fue posible iniciar sesión."
      );
    } finally {
      setCargando(false);
    }
  }

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "24px",
        background: "#fff7fb",
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: "420px",
          padding: "32px",
          borderRadius: "20px",
          background: "#ffffff",
          border: "1px solid #eadde4",
          boxShadow:
            "0 18px 50px rgba(94, 48, 72, 0.10)",
        }}
      >
        <div
          style={{
            textAlign: "center",
            marginBottom: "28px",
          }}
        >
          <div
            style={{
              fontSize: "38px",
              marginBottom: "8px",
            }}
          >
            ✨
          </div>

          <h1
            style={{
              margin: 0,
              color: "#2c2030",
            }}
          >
            MONYS OS
          </h1>

          <p
            style={{
              margin: "8px 0 0",
              color: "#766a70",
            }}
          >
            Acceso al sistema empresarial
          </p>
        </div>

        <form onSubmit={iniciarSesion}>
          <label
            style={{
              display: "grid",
              gap: "7px",
              marginBottom: "18px",
              color: "#51484d",
              fontWeight: "700",
            }}
          >
            Correo

            <input
              type="email"
              value={correo}
              onChange={(evento) =>
                setCorreo(evento.target.value)
              }
              placeholder="correo@ejemplo.com"
              autoComplete="email"
              required
              style={estiloCampo}
            />
          </label>

          <label
            style={{
              display: "grid",
              gap: "7px",
              marginBottom: "18px",
              color: "#51484d",
              fontWeight: "700",
            }}
          >
            Contraseña

            <input
              type="password"
              value={password}
              onChange={(evento) =>
                setPassword(evento.target.value)
              }
              placeholder="Tu contraseña"
              autoComplete="current-password"
              required
              style={estiloCampo}
            />
          </label>

          {error && (
            <div
              style={{
                padding: "12px 14px",
                marginBottom: "18px",
                borderRadius: "10px",
                background: "#fff2f2",
                border: "1px solid #efc0c0",
                color: "#9b3030",
                fontSize: "14px",
              }}
            >
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={cargando}
            style={{
              width: "100%",
              padding: "12px 18px",
              borderRadius: "10px",
              border: "none",
              background: cargando
                ? "#d8cbd2"
                : "#5e3048",
              color: "#ffffff",
              fontWeight: "800",
              fontSize: "15px",
              cursor: cargando
                ? "not-allowed"
                : "pointer",
            }}
          >
            {cargando
              ? "Ingresando..."
              : "Entrar a MONYS OS"}
          </button>
        </form>
      </div>
    </div>
  );
}

const estiloCampo = {
  width: "100%",
  boxSizing: "border-box",
  padding: "12px 13px",
  borderRadius: "10px",
  border: "1px solid #d8cbd2",
  background: "#ffffff",
  color: "#2c2030",
  fontSize: "15px",
  outline: "none",
};