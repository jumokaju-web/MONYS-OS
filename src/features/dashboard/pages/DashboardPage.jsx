import { useDashboardData } from "../hooks/useDashboardData";

const formatoDinero = new Intl.NumberFormat(
  "es-MX",
  {
    style: "currency",
    currency: "MXN",
    minimumFractionDigits: 2,
  }
);

const formatoNumero = new Intl.NumberFormat(
  "es-MX",
  {
    maximumFractionDigits: 2,
  }
);

const formatoPorcentaje = (valor) =>
  `${formatoNumero.format(Number(valor) || 0)}%`;

function formatoFechaCorte(valor) {
  if (!valor) return "Fecha no disponible";
  const fecha = new Date(`${String(valor).slice(0, 10)}T00:00:00Z`);
  if (Number.isNaN(fecha.getTime())) return "Fecha no disponible";
  return fecha.toLocaleDateString("es-MX", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
}

const estilos = {
  pagina: {
    minHeight: "100vh",
    padding: "32px",
    background: "#f8f5f7",
    color: "#332d30",
    fontFamily:
      "Inter, system-ui, -apple-system, BlinkMacSystemFont, sans-serif",
  },

  encabezado: {
    marginBottom: "28px",
  },

  titulo: {
    margin: 0,
    fontSize: "34px",
    fontWeight: 800,
  },

  subtitulo: {
    marginTop: "8px",
    marginBottom: 0,
    color: "#766c71",
    fontSize: "16px",
  },

  cuadricula: {
    display: "grid",
    gridTemplateColumns:
      "repeat(auto-fit, minmax(220px, 1fr))",
    gap: "18px",
    marginBottom: "28px",
  },

  tarjeta: {
    padding: "22px",
    borderRadius: "18px",
    background: "#ffffff",
    border: "1px solid #eadfe4",
    boxShadow:
      "0 8px 24px rgba(80, 46, 61, 0.06)",
  },

  etiqueta: {
    margin: 0,
    color: "#7b6f75",
    fontSize: "14px",
    fontWeight: 600,
  },

  valor: {
    marginTop: "12px",
    marginBottom: 0,
    fontSize: "28px",
    fontWeight: 800,
    color: "#4a2638",
  },

  seccion: {
    marginTop: "22px",
    padding: "24px",
    borderRadius: "18px",
    background: "#ffffff",
    border: "1px solid #eadfe4",
    boxShadow:
      "0 8px 24px rgba(80, 46, 61, 0.06)",
  },

  tituloSeccion: {
    marginTop: 0,
    marginBottom: "18px",
    fontSize: "21px",
  },

  filaDato: {
    display: "flex",
    justifyContent: "space-between",
    gap: "20px",
    padding: "12px 0",
    borderBottom: "1px solid #f0e8eb",
  },

  nombreDato: {
    color: "#74686e",
    fontWeight: 600,
  },

  valorDato: {
    textAlign: "right",
    fontWeight: 700,
  },

  estado: {
    padding: "50px 30px",
    textAlign: "center",
    color: "#665b60",
  },

  alerta: {
    padding: "18px",
    borderRadius: "14px",
    background: "#fff4f4",
    border: "1px solid #efcaca",
    color: "#9e3030",
  },

  productoDestacado: {
    padding: "20px",
    borderRadius: "16px",
    background: "#fdf4f8",
    border: "1px solid #edcfdd",
  },

  nombreProducto: {
    margin: 0,
    fontSize: "20px",
    fontWeight: 800,
  },

  detalleProducto: {
    marginTop: "10px",
    marginBottom: 0,
    color: "#6f6268",
  },
};

const TarjetaMetrica = ({
  etiqueta,
  valor,
}) => (
  <article style={estilos.tarjeta}>
    <p style={estilos.etiqueta}>
      {etiqueta}
    </p>

    <p style={estilos.valor}>
      {valor}
    </p>
  </article>
);

const DashboardPage = () => {
  const {
    datosDashboard,
    cargandoDashboard,
    errorDashboard,
  } = useDashboardData();

  if (cargandoDashboard) {
    return (
      <div style={estilos.estado}>
        <h2>Cargando Dashboard...</h2>
        <p>
          MONYS OS está preparando la información
          del negocio.
        </p>
      </div>
    );
  }

  if (errorDashboard) {
    return (
      <div style={estilos.pagina}>
        <div style={estilos.alerta}>
          <h2>
            No fue posible cargar el Dashboard
          </h2>

          <p>{errorDashboard}</p>
        </div>
      </div>
    );
  }

  if (!datosDashboard) {
    return (
      <div style={estilos.estado}>
        <h2>
          No existe ninguna importación procesada
        </h2>

        <p>
          Importa un reporte de Ventas por artículo
          para comenzar el análisis.
        </p>
      </div>
    );
  }

  const metricas =
    datosDashboard.metricas || {};

  const productoMasVendido =
    metricas.productoMasVendido;

  const usaReporteUtilidad =
    metricas.fuenteFinanciera === "utilidad";

  const importacionFinanciera =
    usaReporteUtilidad
      ? datosDashboard.utilidadVentas?.importacion || {}
      : datosDashboard.ventasOriginales?.importacion || {};

  const importacionProductos =
    datosDashboard.ventasOriginales?.importacion ||
    {};

  const periodoFinanciero =
    usaReporteUtilidad
      ? datosDashboard.utilidadVentas?.periodo
      : datosDashboard.ventasOriginales?.periodo;

  const inicioCorte = formatoFechaCorte(
    periodoFinanciero?.fechaInicial
  );

  const finCorte = formatoFechaCorte(
    periodoFinanciero?.fechaFinal
  );

  return (
    <main style={estilos.pagina}>
      <header style={estilos.encabezado}>
        <h1 style={estilos.titulo}>
          Hola, Jefa
        </h1>

        <p style={estilos.subtitulo}>
          Este es el resumen real de la última importación de SICAR.
        </p>
      </header>

      <section
        aria-label="Periodo financiero SICAR"
        style={{
          marginBottom: "22px",
          padding: "16px 20px",
          borderRadius: "14px",
          background: "#fdf4f8",
          border: "1px solid #edcfdd",
          color: "#5b3c4d",
          lineHeight: 1.5,
        }}
      >
        <strong>Corte financiero: {inicioCorte} – {finCorte}</strong>
        <div>Utilidad y margen son brutos según SICAR, antes de gastos operativos.</div>
      </section>

      <section style={estilos.cuadricula}>
        <TarjetaMetrica
          etiqueta="Ventas totales"
          valor={formatoDinero.format(
            metricas.tieneDatosFinancieros
              ? Number(metricas.ventasTotales) || 0
              : "Sin dato SICAR"
          )}
        />

        <TarjetaMetrica
          etiqueta="Utilidad bruta"
          valor={formatoDinero.format(
            metricas.tieneDatosFinancieros
              ? Number(metricas.utilidadTotal) || 0
              : "Sin dato SICAR"
          )}
        />

        <TarjetaMetrica
          etiqueta="Costo total"
          valor={formatoDinero.format(
            metricas.tieneDatosFinancieros
              ? Number(metricas.costoTotal) || 0
              : "Sin dato SICAR"
          )}
        />

        <TarjetaMetrica
          etiqueta="Margen bruto"
          valor={formatoPorcentaje(
            metricas.tieneDatosFinancieros
              ? formatoPorcentaje(metricas.margenUtilidad)
              : "Sin dato SICAR"
          )}
        />

        <TarjetaMetrica
          etiqueta="Piezas vendidas"
          valor={
            metricas.periodosComparables === false
              ? "Sin corte comparable"
              : formatoNumero.format(
                  Number(metricas.totalPiezas) || 0
                )
          }
        />

        <TarjetaMetrica
          etiqueta="Registros analizados"
          valor={
            metricas.periodosComparables === false
              ? "Sin corte comparable"
              : formatoNumero.format(
                  Number(metricas.totalProductos) || 0
                )
          }
        />
      </section>

      <section style={estilos.seccion}>
        <h2 style={estilos.tituloSeccion}>
          Producto más vendido
        </h2>

        {datosDashboard.comparabilidadProductos?.comparable === false ? (
          <p role="status">{datosDashboard.comparabilidadProductos.mensaje}</p>
        ) : productoMasVendido ? (
          <div
            style={
              estilos.productoDestacado
            }
          >
            <h3
              style={
                estilos.nombreProducto
              }
            >
              {productoMasVendido.descripcion ||
                "Producto sin descripción"}
            </h3>

            <p
              style={
                estilos.detalleProducto
              }
            >
              Código:{" "}
              {productoMasVendido.codigo ||
                "Sin código"}
            </p>

            <p
              style={
                estilos.detalleProducto
              }
            >
              Categoría:{" "}
              {productoMasVendido.categoria ||
                "Sin categoría"}
            </p>

            <p
              style={
                estilos.detalleProducto
              }
            >
              Cantidad vendida:{" "}
              <strong>
                {formatoNumero.format(
                  Number(
                    productoMasVendido.cantidad
                  ) || 0
                )}
              </strong>
            </p>
          </div>
        ) : (
          <p>
            Todavía no existe información
            suficiente para identificarlo.
          </p>
        )}
      </section>

      <section style={estilos.seccion}>
        <h2 style={estilos.tituloSeccion}>
          Fuentes de este tablero
        </h2>

        <div style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
          gap: "16px",
        }}>
          <article style={estilos.productoDestacado}>
            <h3 style={estilos.nombreProducto}>
              Finanzas · {metricas.tieneDatosFinancieros
                ? importacionFinanciera.tipo_reporte || (usaReporteUtilidad ? "Utilidad de ventas" : "Ventas por artículo")
                : "sin importes disponibles"}
            </h3>
            <p style={estilos.detalleProducto}>
              Archivo: {importacionFinanciera.archivo_original || "Sin fuente financiera válida"}
            </p>
            <p style={estilos.detalleProducto}>
              Periodo: {periodoFinanciero
                ? `${formatoFechaCorte(periodoFinanciero.fechaInicial)} – ${formatoFechaCorte(periodoFinanciero.fechaFinal)}`
                : "Sin periodo registrado"}
            </p>
            <p style={estilos.detalleProducto}>
              Filas: {formatoNumero.format(Number(importacionFinanciera.total_filas) || 0)}
              {" · "}Importado: {importacionFinanciera.created_at
                ? new Date(importacionFinanciera.created_at).toLocaleString("es-MX")
                : "Sin fecha"}
            </p>
          </article>

          <article style={estilos.productoDestacado}>
            <h3 style={estilos.nombreProducto}>
              Productos · {importacionProductos.tipo_reporte || "Ventas por artículo"}
            </h3>
            <p style={estilos.detalleProducto}>
              Archivo: {importacionProductos.archivo_original || "Sin información"}
            </p>
            <p style={estilos.detalleProducto}>
              Periodo: {datosDashboard.ventasOriginales?.periodo
                ? `${formatoFechaCorte(datosDashboard.ventasOriginales.periodo.fechaInicial)} – ${formatoFechaCorte(datosDashboard.ventasOriginales.periodo.fechaFinal)}`
                : "Sin periodo registrado"}
            </p>
            <p style={estilos.detalleProducto}>
              Filas: {formatoNumero.format(Number(importacionProductos.total_filas) || 0)}
              {" · "}Importado: {importacionProductos.created_at
                ? new Date(importacionProductos.created_at).toLocaleString("es-MX")
                : "Sin fecha"}
            </p>
          </article>
        </div>

        <p style={estilos.detalleProducto}>
          Cada cifra conserva el corte de su propio reporte SICAR; los reportes de finanzas y productos no se suman entre sí.
        </p>
      </section>
    </main>
  );
};

export default DashboardPage;