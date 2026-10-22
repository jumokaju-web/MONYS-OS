import { useEffect, useState } from "react";
import {
  fechaActualMexico,
  obtenerEntradaEmpleado,
  registrarEntradaOperativa,
  registrarSalidaOperativa,
} from "../services/asistenciaOperativaService";

import HorarioDelDiaEmpleado from "./HorarioDelDiaEmpleado";

export default function RegistroEntradaOperativa({ usuario }) {
  const [entrada, setEntrada] = useState(null);
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState("");
  const [fecha, setFecha] = useState(fechaActualMexico);
  useEffect(() => {
    const temporizador = setInterval(() => setFecha(fechaActualMexico()), 60_000);
    return () => clearInterval(temporizador);
  }, []);

  useEffect(() => {
    let vigente = true;
    setEntrada(null); setCargando(true); setError("");
    async function cargar() {
      if (!usuario?.auth_user_id) {
        setCargando(false);
        return;
      }
      try {
        const actual = await obtenerEntradaEmpleado({ usuarioId: usuario.auth_user_id, fecha });
        if (vigente) setEntrada(actual);
      } catch (errorCarga) {
        if (vigente) setError(errorCarga?.message || "No pudimos consultar tu entrada.");
      } finally {
        if (vigente) setCargando(false);
      }
    }
    cargar();
    return () => { vigente = false; };
  }, [usuario?.auth_user_id, fecha]);

  async function registrar() {
    setError("");
    setGuardando(true);
    try {
      const nueva = await registrarEntradaOperativa({ usuario, fecha });
      setEntrada(nueva);
    } catch (errorGuardar) {
      const mensaje = errorGuardar?.message || "No pudimos registrar tu entrada.";
      if (mensaje.includes("ya quedó registrada")) {
        try {
          setEntrada(await obtenerEntradaEmpleado({ usuarioId: usuario?.auth_user_id, fecha }));
          return;
        } catch { /* conserva el aviso de error original */ }
      }
      setError(mensaje);
    } finally {
      setGuardando(false);
    }
  }

  async function registrarSalida() {
    setGuardando(true); setError("");
    try { setEntrada(await registrarSalidaOperativa({ entradaId: entrada.id, usuarioId: usuario.auth_user_id })); }
    catch (e) { setError(e.message); }
    finally { setGuardando(false); }
  }

  const hora = entrada?.entrada_at
    ? new Intl.DateTimeFormat("es-MX", { timeZone: "America/Mexico_City", hour: "2-digit", minute: "2-digit" }).format(new Date(entrada.entrada_at))
    : null;

  return (
    <section aria-label="Registro de entrada" style={{ display: "grid", gap: "8px", margin: "0 0 14px", padding: "14px 16px", border: "1px solid #edc7d8", borderRadius: "16px", background: "linear-gradient(135deg,#fff 0%,#fff3f8 100%)" }}>
      <div style={{ color: "#76254f", fontWeight: 900 }}>🕘 Mi jornada de hoy</div>
      <HorarioDelDiaEmpleado usuario={usuario} entrada={entrada} key={fecha} />
      {entrada ? (
        <div style={{ display: "grid", gap: 8 }}>
          <p role="status" style={{ margin: 0, color: "#327653", fontWeight: 750 }}>✅ Entrada registrada a las {hora}.</p>
          {entrada.salida_at ? <p role="status">Salida registrada a las {new Intl.DateTimeFormat("es-MX", { timeZone: "America/Mexico_City", hour: "2-digit", minute: "2-digit" }).format(new Date(entrada.salida_at))}.</p>
            : <button type="button" disabled={guardando} onClick={registrarSalida} style={{ minHeight: 44 }}>{guardando ? "Registrando…" : "Registrar mi salida"}</button>}
        </div>
      ) : (
        <>
          <p style={{ margin: 0, color: "#6f5d66", fontSize: "14px", lineHeight: 1.45 }}>Confirma tu llegada real. Dirección podrá ver que estás presente y asignarte el trabajo del día. Registrar entrada no crea tareas automáticamente.</p>
          <button type="button" disabled={cargando || guardando || !usuario?.empleado_id} onClick={registrar} style={{ minHeight: "44px", border: 0, borderRadius: "11px", background: "#a82c68", color: "white", fontWeight: 850, cursor: guardando ? "wait" : "pointer" }}>
            {cargando ? "Revisando…" : guardando ? "Registrando…" : "Registrar mi entrada"}
          </button>
          {!usuario?.empleado_id && <small style={{ color: "#8a5368" }}>Pide a Dirección vincular tu usuario a tu ficha de empleada.</small>}
        </>
      )}
      {entrada && <small>Registrar salida no sustituye el cierre de caja ni las tareas pendientes.</small>}
      {error && <small role="alert" style={{ color: "#a52d2d" }}>{error}</small>}
    </section>
  );
}
