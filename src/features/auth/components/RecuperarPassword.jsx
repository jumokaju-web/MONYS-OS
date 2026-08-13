import { useState } from "react";

import { supabase } from "../../../supabase";

export default function RecuperarPassword() {
  const [password, setPassword] = useState("");
  const [
    confirmarPassword,
    setConfirmarPassword,
  ] = useState("");

  const [
    guardando,
    setGuardando,
  ] = useState(false);

  const [
    mensaje,
    setMensaje,
  ] = useState("");

  const [
    error,
    setError,
  ] = useState("");

  async function guardarNuevaPassword(
    evento
  ) {
    evento.preventDefault();

    try {
      setGuardando(true);
      setMensaje("");
      setError("");

      if (password.length < 8) {
        throw new Error(
          "La contraseña debe tener al menos 8 caracteres."
        );
      }

      if (
        password !==
        confirmarPassword
      ) {
        throw new Error(
          "Las contraseñas no coinciden."
        );
      }

      const {
        error: errorActualizacion,
      } =
        await supabase.auth.updateUser({
          password,
        });

      if (errorActualizacion) {
        throw errorActualizacion;
      }

      setMensaje(
        "Contraseña actualizada correctamente."
      );

      setPassword("");
      setConfirmarPassword("");

      const {
        error: errorSalida,
      } =
        await supabase.auth.signOut();

      if (errorSalida) {
        throw errorSalida;
      }
    } catch (errorActualizacion) {
      console.error(
        "Error al actualizar contraseña:",
        errorActualizacion
      );

      setError(
        errorActualizacion.message ||
          "No fue posible actualizar la contraseña."
      );
    } finally {
      setGuardando(false);
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
            🔐
          </div>

          <h1
            style={{
              margin: 0,
              color: "#2c2030",
            }}
          >
            Nueva contraseña
          </h1>

          <p
            style={{
              margin: "8px 0 0",
              color: "#766a70",
            }}
          >
            Crea una nueva contraseña para MONYS OS.
          </p>
        </div>

        <form
          onSubmit={
            guardarNuevaPassword
          }
        >
          <label
            style={{
              display: "grid",
              gap: "7px",
              marginBottom: "18px",
              color: "#51484d",
              fontWeight: "700",
            }}
          >
            Nueva contraseña

            <input
              type="password"
              value={password}
              onChange={(evento) =>
                setPassword(
                  evento.target.value
                )
              }
              placeholder="Mínimo 8 caracteres"
              autoComplete="new-password"
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
            Confirmar contraseña

            <input
              type="password"
              value={
                confirmarPassword
              }
              onChange={(evento) =>
                setConfirmarPassword(
                  evento.target.value
                )
              }
              placeholder="Repite la contraseña"
              autoComplete="new-password"
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
                border:
                  "1px solid #efc0c0",
                color: "#9b3030",
                fontSize: "14px",
              }}
            >
              {error}
            </div>
          )}

          {mensaje && (
            <div
              style={{
                padding: "12px 14px",
                marginBottom: "18px",
                borderRadius: "10px",
                background: "#eef8f2",
                border:
                  "1px solid #b9dfc9",
                color: "#236b45",
                fontSize: "14px",
                fontWeight: "700",
              }}
            >
              {mensaje}
            </div>
          )}

          <button
            type="submit"
            disabled={guardando}
            style={{
              width: "100%",
              padding: "12px 18px",
              borderRadius: "10px",
              border: "none",
              background: guardando
                ? "#d8cbd2"
                : "#5e3048",
              color: "#ffffff",
              fontWeight: "800",
              fontSize: "15px",
              cursor: guardando
                ? "not-allowed"
                : "pointer",
            }}
          >
            {guardando
              ? "Guardando..."
              : "Guardar nueva contraseña"}
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
  border:
    "1px solid #d8cbd2",
  background: "#ffffff",
  color: "#2c2030",
  fontSize: "15px",
  outline: "none",
};