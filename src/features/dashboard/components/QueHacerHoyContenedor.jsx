import React, { useEffect, useState } from "react";
import { useUser } from "../../../context/UserContext";
import QueHacerHoyV2 from "./QueHacerHoyV2";

const roles = new Set(["owner","director","admin","finanzas"]);
const destinos = new Set(["finanzas/estado-resultados","finanzas/venta-necesaria","finanzas/deudas","tesoreria/obligaciones","tesoreria/movimientos","tesoreria/clasificar","tesoreria/conciliar","canales/precio-minimo","canales/rentabilidad","canales/cancelaciones","inventario/costos","inventario/traspasos","inventario/compras","ventas/sucursal","dashboard"]);

// Services injected until #163 and #171 are individually integrated.
// Context and role must come from the authenticated application context.
export default function QueHacerHoyContenedor({ meses, mesObjetivo, obtenerTableroFinanciero, obtenerAccionesDelDia, rutas = {} }) {
  const { usuario, cargandoUsuario, errorUsuario } = useUser();
  const { organization_id: organizationId, business_id: businessId, id: userId, role, active } = usuario || {};
  const permitted = !cargandoUsuario && !errorUsuario && active === true && roles.has(role) && !!organizationId && !!businessId && !!userId;
  const parts = new Intl.DateTimeFormat("en-CA",{timeZone:"America/Mexico_City",year:"numeric",month:"2-digit"}).formatToParts(new Date());
  const year = Number(parts.find(p => p.type === "year").value);
  const month = Number(parts.find(p => p.type === "month").value);
  const defaults = [2,1,0].map(offset => new Date(Date.UTC(year,month-1-offset,1)).toISOString().slice(0,7));
  const periodKey = JSON.stringify(Array.isArray(meses) && meses.length ? meses : defaults);
  const scope = JSON.stringify([organizationId,businessId,userId,role,periodKey,mesObjetivo]);
  const [revision,setRevision] = useState(0);
  const [result,setResult] = useState(null);
  useEffect(() => {
    let active = true;
    if (!permitted || typeof obtenerTableroFinanciero !== "function" || typeof obtenerAccionesDelDia !== "function") return () => { active = false; };
    setResult(null);
    const context = { organizationId,businessId };
    async function load() {
      const errors = [];
      let accionesDelDia = [];
      try {
        const a = await obtenerAccionesDelDia(context);
        if (a?.estado === "listo") accionesDelDia = a.principales || [];
        else errors.push("Acciones del día no disponibles.");
        if (a?.errores?.length) errors.push("Algunas fuentes de acciones no están disponibles.");
      } catch (error) { if (active) console.warn("Acciones del día:", error?.message || "Error desconocido"); errors.push("No fue posible consultar acciones del día."); }
      if (!active) return;
      try {
        const t = await obtenerTableroFinanciero({...context,meses:JSON.parse(periodKey),mesObjetivo,accionesDelDia});
        if (active) setResult({scope,revision,tablero:{...t,errores:[...(t?.errores || []),...errors]}});
      } catch (error) {
        if (active) console.warn("Tablero financiero:", error?.message || "Error desconocido");
        if (active) setResult({scope,revision,error:"No fue posible cargar el tablero financiero."});
      }
    }
    load();
    return () => { active = false; };
  },[scope,revision,permitted,organizationId,businessId,periodKey,mesObjetivo,obtenerTableroFinanciero,obtenerAccionesDelDia]);
  if (cargandoUsuario) return <p role="status">Validando sesión…</p>;
  if (!permitted) return <p role="status">Vista financiera no disponible para este contexto.</p>;
  if (typeof obtenerTableroFinanciero !== "function" || typeof obtenerAccionesDelDia !== "function") return <p>Disponible cuando se integre el bloque financiero.</p>;
  const current = result?.scope === scope && result?.revision === revision ? result : null;
  const review = action => {
    if (!current?.tablero || !destinos.has(action?.destino) || !Object.hasOwn(rutas,action.destino)) return;
    const navigate = rutas[action.destino];
    if (typeof navigate === "function") navigate(action.parametros || {});
  };
  return <section><button type="button" onClick={() => setRevision(n => n+1)}>Actualizar</button>{current?.error ? <p role="alert">{current.error}</p> : <QueHacerHoyV2 key={scope} tablero={current?.tablero} loading={!current} onReview={review} puedeRevisar={destino => destinos.has(destino) && Object.hasOwn(rutas,destino) && typeof rutas[destino] === "function"}/>}</section>;
}
