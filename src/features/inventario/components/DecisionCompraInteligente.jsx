import "./DecisionCompraInteligente.css";

const dinero = (valor) => valor == null
  ? "Pendiente"
  : new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN", maximumFractionDigits: 2 }).format(valor);

export default function DecisionCompraInteligente({ decision, onVerCompra, onVerTraspasos }) {
  const principales = decision?.productosPriorizados?.slice(0, 5) || [];
  const titulo = decision?.estado === "LISTA_PARA_AUTORIZACION"
    ? "Lista para revisión de autorización"
    : decision?.estado === "SUPERA_PRESUPUESTO"
      ? "Ajustar la compra al presupuesto"
      : "Preparar la compra; autorización pendiente";

  return <section className={`decision-compra decision-compra--${String(decision?.estado || "pendiente").toLowerCase()}`}>
    <div className="decision-compra__encabezado">
      <div><small>DECISIÓN DE COMPRA</small><h2>{titulo}</h2></div>
      <span>{decision?.productosCriticos || 0} productos críticos</span>
    </div>
    <p>MONYS ordena la atención por cobertura y velocidad. La recomendación conserva revisión humana y no genera pedidos ni movimientos de inventario.</p>
    <div className="decision-compra__metricas">
      <div><small>Inversión propuesta</small><strong>{dinero(decision?.inversionPropuesta)}</strong></div>
      <div><small>Presupuesto confirmado</small><strong>{dinero(decision?.capacidadCompra)}</strong></div>
      <div><small>Atención crítica</small><strong>{dinero(decision?.inversionCritica)}</strong></div>
    </div>
    {decision?.bloqueos?.length > 0 && <div className="decision-compra__bloqueos" role="status"><strong>Antes de autorizar</strong><ul>{decision.bloqueos.map((bloqueo) => <li key={bloqueo}>{bloqueo}</li>)}</ul></div>}
    {decision?.advertencias?.map((advertencia) => <p className="decision-compra__advertencia" key={advertencia}>{advertencia}</p>)}
    {decision?.fuentes?.length > 0 && <details><summary>Ver fuentes por sucursal</summary><div className="decision-compra__fuentes">{decision.fuentes.map((fuente) => <p key={fuente.branchId || fuente.sucursal}><strong>{fuente.sucursal}</strong> · Inventario: {fuente.inventarioDisponible ? `cargado ${fuente.inventarioImportadoEn || "fecha pendiente"}` : "pendiente"} · Ventas: {fuente.ventasDisponibles ? `${fuente.periodoVentasInicio || "fecha pendiente"} a ${fuente.periodoVentasFin || "fecha pendiente"}` : "pendientes"}</p>)}</div></details>}
    <h3>Primero revisa estos productos</h3>
    {!principales.length ? <p>No hay productos con compra propuesta.</p> : <div className="decision-compra__lista">{principales.map((producto) => <article key={producto.llave || producto.codigo || producto.descripcion}>
      <span>{producto.prioridadCompra}</span><h3>{producto.descripcion}</h3><p>{producto.motivoPrioridad}</p>
      <small>Comprar {Number(producto.compraTotal || 0).toLocaleString("es-MX")} piezas · {dinero(producto.inversionTotal)}{producto.costoConocido ? "" : " · costo pendiente"} · margen {producto.margenPorcentaje == null ? "pendiente" : `${producto.margenPorcentaje.toFixed(1)}%`}</small>
    </article>)}</div>}
    <div className="decision-compra__acciones"><button type="button" onClick={onVerCompra}>Revisar compra completa</button><button type="button" onClick={onVerTraspasos}>Revisar traspasos primero</button></div>
  </section>;
}
