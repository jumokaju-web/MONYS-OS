const moneda = new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN", maximumFractionDigits: 2 });

function fechaLegible(fecha) {
  const [anio, mes, dia] = String(fecha || "").split("-");
  return dia && mes && anio ? `${dia}/${mes}/${anio}` : fecha;
}

export default function CierreHoyDireccion({ resumen, cargando, error, onActualizar }) {
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
          <div className="cierre-hoy-cajas">{sucursal.cajas.map((caja) => <span key={caja.cajaId} className={`estado-${caja.estado}`}>{caja.nombre}: {caja.estado === "completo" ? "lista" : caja.estado === "incompleto" ? "aclarar" : "falta"}</span>)}</div>
        </article>)}
      </div>}
      {!cargando && !error && resumen.diferencias > 0 && <p className="cierre-hoy-alerta">{resumen.diferencias} {resumen.diferencias === 1 ? "caja necesita" : "cajas necesitan"} revisar diferencias antes de decidir con el dinero.</p>}
      {!cargando && !error && !todoCerrado && <p className="cierre-hoy-nota">Los totales incluyen únicamente cajas con importes completos. Lo faltante no se sustituye por cero.</p>}
    </section>
  );
}
