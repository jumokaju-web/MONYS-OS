import {
  StrictMode,
  useEffect,
  useState,
} from "react";

import { createRoot } from "react-dom/client";

import "./index.css";

import App from "./App.jsx";

import { supabase } from "./supabase.js";

import { UserProvider } from "./context/UserContext.jsx";

import Login from "./features/auth/components/Login.jsx";

import RecuperarPassword from "./features/auth/components/RecuperarPassword.jsx";

/*
  IMPORTANTE:
  Mientras recuperamos la contraseña,
  dejamos el login obligatorio apagado.

  Cuando confirmemos que tu contraseña
  nueva funciona, cambiaremos esto a true.
*/
const LOGIN_OBLIGATORIO = true;

function Root() {
  const [
    session,
    setSession,
  ] = useState(null);

  const [
    cargandoSesion,
    setCargandoSesion,
  ] = useState(true);

  const [
    recuperandoPassword,
    setRecuperandoPassword,
  ] = useState(false);

  useEffect(() => {
    let activo = true;

    async function revisarSesionInicial() {
      try {
        const {
          data,
          error,
        } =
          await supabase.auth.getSession();

        if (error) {
          throw error;
        }

        if (!activo) {
          return;
        }

        setSession(
          data?.session || null
        );
      } catch (error) {
        console.error(
          "Error al revisar sesión inicial:",
          error
        );

        if (activo) {
          setSession(null);
        }
      } finally {
        if (activo) {
          setCargandoSesion(false);
        }
      }
    }

    revisarSesionInicial();

    const {
      data: {
        subscription,
      },
    } =
      supabase.auth.onAuthStateChange(
        (
          evento,
          nuevaSession
        ) => {
          console.log(
            "EVENTO AUTH MONYS OS:",
            evento
          );

          if (!activo) {
            return;
          }

          setSession(
            nuevaSession || null
          );

          if (
            evento ===
            "PASSWORD_RECOVERY"
          ) {
            setRecuperandoPassword(
              true
            );
          }

          if (
            evento ===
            "SIGNED_OUT"
          ) {
            setRecuperandoPassword(
              false
            );
          }

          setCargandoSesion(false);
        }
      );

    return () => {
      activo = false;

      subscription.unsubscribe();
    };
  }, []);

  /*
    Si llegamos desde un correo válido
    de recuperación, mostramos primero
    la pantalla para crear contraseña.
  */
  if (recuperandoPassword) {
    return (
      <RecuperarPassword />
    );
  }

  /*
    Mientras comprobamos la sesión,
    evitamos mostrar una pantalla
    incorrecta por unos milisegundos.
  */
  if (
    LOGIN_OBLIGATORIO &&
    cargandoSesion
  ) {
    return (
      <div
        style={{
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "#5e3048",
          fontWeight: "700",
        }}
      >
        Verificando acceso a MONYS OS...
      </div>
    );
  }

  /*
    Esta condición quedará activa
    cuando cambiemos LOGIN_OBLIGATORIO
    a true.
  */
  if (
    LOGIN_OBLIGATORIO &&
    !session
  ) {
    return <Login />;
  }

  /*
    Por ahora seguimos permitiendo
    entrar normalmente mientras
    recuperamos tu contraseña.
  */
  return (
    <UserProvider>
      <App />
    </UserProvider>
  );
}

createRoot(
  document.getElementById("root")
).render(
  <StrictMode>
    <Root />
  </StrictMode>
);