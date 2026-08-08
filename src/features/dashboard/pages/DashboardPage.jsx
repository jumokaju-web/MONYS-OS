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

  const importacion =
    datosDashboard.importacion || {};

  const productoMasVendido =
    metricas.productoMasVendido;

  return (
    <main style={estilos.pagina}>
      <header style={estilos.encabezado}>
        <h1 style={estilos.titulo}>
          Hola, Jefa
        </h1>

        <p style={estilos.subtitulo}>
          Este es el resumen real de la última
          importación de ventas.
        </p>
      </header>

      <section style={estilos.cuadricula}>
        <TarjetaMetrica
          etiqueta="Ventas totales"
          valor={formatoDinero.format(
            Number(metricas.ventasTotales) || 0
          )}
        />

        <TarjetaMetrica
          etiqueta="Utilidad total"
          valor={formatoDinero.format(
            Number(metricas.utilidadTotal) || 0
          )}
        />

        <TarjetaMetrica
          etiqueta="Costo total"
          valor={formatoDinero.format(
            Number(metricas.costoTotal) || 0
          )}
        />

        <TarjetaMetrica
          etiqueta="Margen de utilidad"
          valor={formatoPorcentaje(
            metricas.margenUtilidad
          )}
        />

        <TarjetaMetrica
          etiqueta="Piezas vendidas"
          valor={formatoNumero.format(
            Number(metricas.totalPiezas) || 0
          )}
        />

        <TarjetaMetrica
          etiqueta="Registros analizados"
          valor={formatoNumero.format(
            Number(metricas.totalProductos) || 0
          )}
        />
      </section>

      <section style={estilos.seccion}>
        <h2 style={estilos.tituloSeccion}>
          Producto más vendido
        </h2>

        {productoMasVendido ? (
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
          Información de la importación
        </h2>

        <div style={estilos.filaDato}>
          <span style={estilos.nombreDato}>
            Reporte
          </span>

          <span style={estilos.valorDato}>
            {importacion.tipo_reporte ||
              "Sin información"}
          </span>
        </div>

        <div style={estilos.filaDato}>
          <span style={estilos.nombreDato}>
            Archivo
          </span>

          <span style={estilos.valorDato}>
            {importacion.archivo_original ||
              "Sin información"}
          </span>
        </div>

        <div style={estilos.filaDato}>
          <span style={estilos.nombreDato}>
            Filas importadas
          </span>

          <span style={estilos.valorDato}>
            {formatoNumero.format(
              Number(
                importacion.total_filas
              ) || 0
            )}
          </span>
        </div>

        <div style={estilos.filaDato}>
          <span style={estilos.nombreDato}>
            Fecha de importación
          </span>

          <span style={estilos.valorDato}>
            {importacion.created_at
              ? new Date(
                  importacion.created_at
                ).toLocaleString("es-MX")
              : "Sin información"}
          </span>
        </div>
      </section>
    </main>
  );
};

export default DashboardPage;