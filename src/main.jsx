import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App.jsx";
import { supabase } from "./supabase.js";

supabase.auth.getSession().then(({ error }) => {
  if (error) {
    alert("Error al conectar con Supabase: " + error.message);
  } else {
    alert("Monys OS conectado correctamente con Supabase");
  }
});

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <App />
  </StrictMode>
);