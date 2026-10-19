import "./InicioAdministrador.css";

const ETIQUETAS_MODULO = {
  "Registrar dinero": ["💰", "Finanzas", "Saldos y movimientos"],
  "Producto solicitado": ["📦", "Inventario", "Existencias y solicitudes"],
  "Compra Maestra": ["🛒", "Compra Maestra", "Reposición y traspasos"],
  "Problemas e incidencias": ["⚠️", "Incidencias", "Problemas de la operación"],
  "Ideas y oportunidades": ["💡", "Ideas", "Oportunidades de mejora"],
  Flotilla: ["🚚", "Flotilla", "Rutas, evidencias y cortes"],
  "Centro de Órdenes": ["📋", "Órdenes", "Decisiones pendientes"],
  Usuarios: ["👥", "Usuarios", "Consulta de accesos"],
};

export default function InicioAdministrador({
  usuario,
  modulos = [],
  abrirModulo,
  abrirOperacion,
  abrirVentas,
  ventasTotales = null,
  utilidadTotal = null,
  formatoDinero,
}) {
  const nombre = String(usuario?.nombre || "Administración").split(" ")[0];
  const dinero = typeof formatoDinero === "function"
    ? formatoDinero
    : (valor) => new Intl.NumberFormat("es-MX", {
        style: "currency",
        currency: "MXN",
      }).format(Number(valor) || 0);

  const accesos = modulos
    .filter(([, nombreModulo]) => ETIQUETAS_MODULO[nombreModulo])
    .map(([, nombreModulo]) => ({
      nombreModulo,
      icono: ETIQUETAS_MODULO[nombreModulo][0],
      titulo: ETIQUETAS_MODULO[nombreModulo][1],
      detalle: ETIQUETAS_MODULO[nombreModulo][2],
    }));

  return (
    <main className="inicio-admin">
      <section className="inicio-admin__encabezado">
        <div>
          <span>MONYS OS · ADMINISTRACIÓN</span>
          <h1>Hola, {nombre}</h1>
          <p>Elige un área. Cada botón abre una pantalla de trabajo independiente.</p>
        </div>
      </section>

      <section className="inicio-admin__pulso" aria-label="Resumen comercial">
        <button type="button" onClick={abrirVentas}>
          <span>Ventas del último corte</span>
          <strong>{ventasTotales == null ? "Dato pendiente" : dinero(ventasTotales)}</strong>
          <small>Abrir resumen →</small>
        </button>
        <div>
          <span>Utilidad registrada</span>
          <strong>{utilidadTotal == null ? "Dato pendiente" : dinero(utilidadTotal)}</strong>
          <small>Fuente: reporte SICAR disponible</small>
        </div>
      </section>

      <section className="inicio-admin__acciones" aria-labelledby="inicio-admin-acciones">
        <div className="inicio-admin__titulo">
          <div>
            <span>ACCESOS DIRECTOS</span>
            <h2 id="inicio-admin-acciones">¿Qué necesitas revisar?</h2>
          </div>
        </div>

        <div className="inicio-admin__grid">
          <button type="button" onClick={abrirOperacion}>
            <b>⚡</b>
            <span>Operación de tienda</span>
            <small>Tareas, caja y cierre</small>
          </button>

          <button type="button" onClick={abrirVentas}>
            <b>📊</b>
            <span>Ventas</span>
            <small>Productos y resultados SICAR</small>
          </button>

          {accesos.map((acceso) => (
            <button
              type="button"
              key={acceso.nombreModulo}
              onClick={() => abrirModulo(acceso.nombreModulo)}
            >
              <b>{acceso.icono}</b>
              <span>{acceso.titulo}</span>
              <small>{acceso.detalle}</small>
            </button>
          ))}
        </div>
      </section>

      <p className="inicio-admin__nota">
        Cuenta administrativa de consulta y prueba. Las decisiones sensibles de personal
        y las autorizaciones finales permanecen con Mónica.
      </p>
    </main>
  );
}
