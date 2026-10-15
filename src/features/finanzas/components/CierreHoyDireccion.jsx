import { useState } from "react";
import { guardarCierreTurno } from "../../inteligencia/services/cierresTurnoService";
import { claveSeguimientoCierre, crearObservacionesSeguimientoCierre, mensajeSeguimientoCierre } from "../utils/seguimientoCierre";

const moneda = new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN", maximumFractionDigits: 2 });

function fechaLegible(fecha) {
  const [anio, mes, dia] = String(fecha || "").split("-");
  return dia && mes && anio ? `${dia}/${mes}/${anio}` : fecha;
}

function AccionSeguimiento({ caja, sucursal, fecha, seguimiento, usuario, onGuardado }) {
  const [preparado, setPreparado] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState("");
  if (caja.estado === "completo") return null;
  const destinatario = caja.captura?.cierre?.responsable || "";
  const mensaje = mensajeSeguimientoCierre({ fecha: fechaLegible(fecha), sucursal: sucursal.nombre, caja: caja.nombre, estado: caja.estado, destinatario });

  function abrirWhatsApp() {
    setPreparado(true);
    window.open(`https://wa.me/?text=${encodeURIComponent(mensaje)}`, "_blank", "noopener,noreferrer");
  }

  async function confirmarEnvio() {
    setError("");
    try {
      setGuardando(true);
      await guardarCierreTurno({
        branchId: sucursal.branchId,
        responsable: usuario?.nombre,
        turno: "seguimiento_cierre",
        fecha,
        observaciones: crearObservacionesSeguimientoCierre({
          fecha,
          branchId: sucursal.branchId,
          cajaId: caja.cajaId,
          tipo: caja.estado === "incompleto" ? "importes" : "cierre",
          destinatario: destinatario || `Encargada de ${sucursal.nombre}`,
          registradoPor: usuario?.nombre,
        }),
      });
      setPreparado(false);
      await onGuardado?.();
    } catch (e) {
      setError(e?.message || "No se pudo registrar el seguimiento.");
    } finally { setGuardando(false); }
  }

  return <div className="cierre-hoy-accion">
    {seguimiento && <small>Solicitado {new Date(seguimiento.enviadoEn).toLocaleString("es-MX", { timeZone: "America/Mexico_City", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}</small>}
    <button type="button" onClick={abrirWhatsApp}>{seguimiento ? "Volver a pedir" : caja.estado === "incompleto" ? "Pedir importes" : "Pedir cierre"}</button>
    {preparado && <button className="confirmar" type="button" onClick={confirmarEnvio} disabled={guardando}>{guardando ? "Registrando…" : "Ya lo envié"}</button>}
    {error && <small className="error" role="alert">{error}</small>}
  </div>;
}

export default function CierreHoyDireccion({ resumen, cargando, error, onActualizar, seguimientos = new Map(), usuario }) {
  const todoCerrado = resumen.cajasEsperadas > 0 && resumen.cajasFaltantes === 0 && resumen.cajasIncompletas === 0;
  return (
    <section className={`cierre-hoy ${todoCerrado ? "esta-completo" : "requiere-atencion"}`} aria-label="Cierre de hoy para Dirección">
      <header>
        <div><span>CIERRE DE HOY · {fechaLegible(resumen.fecha)}</span><h2>{cargando ? "Consultando cajas…" : error ? "No se pudo confirmar el cierre" : todoCerrado ? "Todas las cajas reportaron" : "Todavía hay cajas por confirmar"}</h2><p>Venta, efectivo y pendientes del día en una sola vista.</p></div>
        <button type="button" onClick={onActualizar} disabled={cargando}>{cargando ? "Actualizando…" : "Actualizar ahora"}</button>
      </header>
      <div className="cierre-hoy-totales">
        <div><small>Venta SICAR reportada</small><strong>{cargando || error ? "—" : moneda.format(resumen.ventaSicar)}</strong></div>
        <div><small>Efectivo que quedó</small><strong>{cargando || error ? "—" : moneda.format(resumen.efectivoFinal)}</strong></div>
        <div><small>Efectivo retirado</small><strong>{cargando || error ? "—" : moneda.format(resumen.efectivoEntregado)}</strong></div>
        <div><small>Cajas listas</small><strong>{cargando || error ? "—" : `${resumen.cajasCompletas} de ${resumen.cajasEsperadas}`}</strong></div>
      </div>
      {!cargando && !error && <div className="cierre-hoy-sucursales">
        {resumen.sucursales.map((sucursal) => <article key={sucursal.branchId}>
          <div><h3>{sucursal.nombre}</h3><small>{sucursal.faltantes ? `${sucursal.faltantes} sin cerrar` : sucursal.incompletas ? `${sucursal.incompletas} sin importes completos` : "Cierre recibido"}</small></div>
          <div className="cierre-hoy-cajas">{sucursal.cajas.map((caja) => <div className="cierre-hoy-caja" key={caja.cajaId}><span className={`estado-${caja.estado}`}>{caja.nombre}: {caja.estado === "completo" ? "lista" : caja.estado === "incompleto" ? "aclarar" : "falta"}</span><AccionSeguimiento caja={caja} sucursal={sucursal} fecha={resumen.fecha} seguimiento={seguimientos.get(claveSeguimientoCierre({ fecha: resumen.fecha, branchId: sucursal.branchId, cajaId: caja.cajaId }))} usuario={usuario} onGuardado={onActualizar} /></div>)}</div>
        </article>)}
      </div>}
      {!cargando && !error && resumen.diferencias > 0 && <p className="cierre-hoy-alerta">{resumen.diferencias} {resumen.diferencias === 1 ? "caja necesita" : "cajas necesitan"} revisar diferencias antes de decidir con el dinero.</p>}
      {!cargando && !error && !todoCerrado && <p className="cierre-hoy-nota">Los totales incluyen únicamente cajas con importes completos. Lo faltante no se sustituye por cero.</p>}
    </section>
  );
}
