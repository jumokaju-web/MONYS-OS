import { useEffect, useState } from "react";
import {
  configurarAccesoFlotilla,
  desactivarAccesoFlotilla,
  obtenerAccesosFlotilla,
  obtenerUnidadesParaAcceso,
} from "./services/operacionFlotilla";

export default function FlotillaAccesosSocios() {
  const [unidades, setUnidades] = useState([]);
  const [accesos, setAccesos] = useState([]);
  const [formulario, setFormulario] = useState({ correo: "", tipoAcceso: "ADMIN_FLOTILLA", socioNombre: "Chory", unidadIds: [] });
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState("");
  const [mensaje, setMensaje] = useState("");

  async function cargar() {
    const [listaUnidades, listaAccesos] = await Promise.all([obtenerUnidadesParaAcceso(), obtenerAccesosFlotilla()]);
    setUnidades(listaUnidades);
    setAccesos(listaAccesos);
  }

  useEffect(() => {
    cargar().catch((errorCarga) => setError(errorCarga?.message || "No fue posible cargar los accesos."));
  }, []);

  function alternarUnidad(unidadId) {
    setFormulario((actual) => ({
      ...actual,
      unidadIds: actual.unidadIds.includes(unidadId)
        ? actual.unidadIds.filter((id) => id !== unidadId)
        : [...actual.unidadIds, unidadId],
    }));
  }

  async function guardar(evento) {
    evento.preventDefault();
    try {
      setGuardando(true);
      setError("");
      setMensaje("");
      await configurarAccesoFlotilla(formulario);
      setMensaje(formulario.tipoAcceso === "ADMIN_FLOTILLA" ? "Acceso de Administrador de Flotilla guardado." : "Acceso de socio guardado solo para las unidades seleccionadas.");
      await cargar();
    } catch (errorGuardado) {
      setError(errorGuardado?.message || "No fue posible guardar el acceso.");
    } finally {
      setGuardando(false);
    }
  }

  async function quitar(acceso) {
    try {
      setGuardando(acceso.id);
      setError("");
      setMensaje("");
      await desactivarAccesoFlotilla(acceso.correo);
      setMensaje(`Acceso retirado a ${acceso.nombre}.`);
      await cargar();
    } catch (errorGuardado) {
      setError(errorGuardado?.message || "No fue posible quitar el acceso.");
    } finally {
      setGuardando(false);
    }
  }

  return <section style={{ marginTop: 16, padding: 13, borderRadius: 14, background: "#f8f4ff", border: "1px solid #d6c7e8" }}>
    <small style={{ color: "#65428a", fontWeight: 900 }}>ACCESOS DE FLOTILLA</small>
    <h3 style={{ margin: "4px 0" }}>Chory, Kary y Abraham</h3>
    <p style={{ fontSize: 12, color: "#655875" }}>Chory puede entrar como Administrador de Flotilla para revisar todas las rutas, evidencias, préstamos y prefacturas. Kary y Abraham pueden quedar como socios de consulta y ver únicamente las unidades que marques. Esto no les da acceso al resto de MONYS.</p>
    <form onSubmit={guardar}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(190px,1fr))", gap: 8 }}>
        <label style={{ fontSize: 11, fontWeight: 800 }}>Correo de su cuenta MONYS<input type="email" value={formulario.correo} onChange={(e) => setFormulario((actual) => ({ ...actual, correo: e.target.value }))} placeholder="correo@gmail.com" style={{ display: "block", width: "100%", boxSizing: "border-box", marginTop: 4, padding: 8 }} /></label>
        <label style={{ fontSize: 11, fontWeight: 800 }}>Acceso<select value={formulario.tipoAcceso} onChange={(e) => setFormulario((actual) => ({ ...actual, tipoAcceso: e.target.value }))} style={{ display: "block", width: "100%", marginTop: 4, padding: 8 }}><option value="ADMIN_FLOTILLA">Administrador de Flotilla</option><option value="SOCIO_CONSULTA">Socio: solo consultar</option></select></label>
        {formulario.tipoAcceso === "SOCIO_CONSULTA" && <label style={{ fontSize: 11, fontWeight: 800 }}>Socio<select value={formulario.socioNombre} onChange={(e) => setFormulario((actual) => ({ ...actual, socioNombre: e.target.value }))} style={{ display: "block", width: "100%", marginTop: 4, padding: 8 }}><option>Kary</option><option>Chory</option><option>Abraham</option></select></label>}
      </div>
      {formulario.tipoAcceso === "SOCIO_CONSULTA" && <fieldset style={{ marginTop: 9, border: "1px solid #d6c7e8", borderRadius: 9 }}><legend style={{ fontSize: 12, fontWeight: 850 }}>Unidades que puede ver</legend><div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))", gap: 6 }}>{unidades.map((unidad) => <label key={unidad.id} style={{ fontSize: 12 }}><input type="checkbox" checked={formulario.unidadIds.includes(unidad.id)} onChange={() => alternarUnidad(unidad.id)} /> {unidad.placas} · {unidad.chofer_nombre || "sin chofer"}</label>)}</div></fieldset>}
      <button type="submit" disabled={guardando || (formulario.tipoAcceso === "SOCIO_CONSULTA" && formulario.unidadIds.length === 0)} style={{ marginTop: 9 }}>{guardando ? "Guardando…" : "Dar o actualizar acceso"}</button>
    </form>
    {mensaje && <p role="status" style={{ color: "#237345", fontWeight: 800 }}>{mensaje}</p>}
    {error && <p role="alert" style={{ color: "#9a3425", fontWeight: 800 }}>{error}</p>}
    {accesos.length > 0 && <div style={{ display: "grid", gap: 6, marginTop: 10 }}>{accesos.map((acceso) => <div key={acceso.id} style={{ padding: 8, borderRadius: 8, background: "#fff", opacity: acceso.activo ? 1 : 0.6 }}><b>{acceso.nombre}</b> · {acceso.correo}<small style={{ display: "block" }}>{acceso.activo ? (acceso.tipo_acceso === "ADMIN_FLOTILLA" ? "Administrador de toda la Flotilla" : `${acceso.socio_nombre} · ${acceso.unidades?.length || 0} unidad(es)`) : "Acceso retirado"}</small>{acceso.activo && <button type="button" disabled={guardando === acceso.id} onClick={() => quitar(acceso)} style={{ marginTop: 5 }}>Quitar acceso</button>}</div>)}</div>}
  </section>;
}
