import TarjetaMetrica from "./TarjetaMetrica";

export default function ResumenReporte({ resumen }) {
  if (!resumen) return null;

  const formatoDinero = (cantidad) =>
    Number(cantidad || 0).toLocaleString("es-MX", {
      style: "currency",
      currency: "MXN",
      minimumFractionDigits: 2,
    });

  const formatoNumero = (cantidad) =>
    Number(cantidad || 0).toLocaleString("es-MX");

  const esInventario =
    Object.prototype.hasOwnProperty.call(
      resumen,
      "existenciaTotal"
    ) ||
    Object.prototype.hasOwnProperty.call(
      resumen,
      "valorInventario"
    );

  return (
    <section
      style={{
        width: "100%",
        maxWidth: "1000px",
        margin: "24px auto 0",
        padding: "24px",
        boxSizing: "border-box",
        borderRadius: "18px",
        backgroundColor: "#fffafb",
        border: "1px solid #eadce4",
        boxShadow: "0 8px 24px rgba(70, 45, 60, 0.10)",
      }}
    >
      <h2
        style={{
          margin: "0 0 24px",
          fontSize: "26px",
          lineHeight: "1.2",
          textAlign: "center",
          color: "#352b32",
        }}
      >
        📊 Resumen Inteligente
      </h2>

      {esInventario ? (
        <>
          <div
            style={{
              display: "grid",
              gridTemplateColumns:
                "repeat(auto-fit, minmax(210px, 1fr))",
              gap: "18px",
            }}
          >
            <TarjetaMetrica
              icono="🧾"
              titulo="Artículos diferentes"
              valor={formatoNumero(
                resumen.articulosDiferentes
              )}
              detalle={`${formatoNumero(
                resumen.totalRegistros
              )} registros analizados`}
            />

            <TarjetaMetrica
              icono="📦"
              titulo="Existencias totales"
              valor={formatoNumero(
                resumen.existenciaTotal
              )}
              detalle="Unidades registradas en inventario"
            />

            <TarjetaMetrica
              icono="💰"
              titulo="Valor del inventario"
              valor={formatoDinero(
                resumen.valorInventario
              )}
              detalle="Valor total calculado"
            />

            <TarjetaMetrica
              icono="✅"
              titulo="Productos con existencia"
              valor={formatoNumero(
                resumen.productosConExistencia
              )}
              detalle="Productos disponibles"
            />

            <TarjetaMetrica
              icono="⚠️"
              titulo="Productos agotados"
              valor={formatoNumero(
                resumen.productosAgotados
              )}
              detalle="Productos con existencia en cero"
            />

            <TarjetaMetrica
              icono="🚨"
              titulo="Existencias negativas"
              valor={formatoNumero(
                resumen.productosNegativos
              )}
              detalle="Productos que requieren revisión"
            />
          </div>

          <div
            style={{
              marginTop: "18px",
              padding: "16px 20px",
              borderRadius: "14px",
              backgroundColor: "#ffffff",
              border: "1px solid #eadce4",
              textAlign: "center",
            }}
          >
            <p
              style={{
                margin: 0,
                fontSize: "15px",
                lineHeight: "1.5",
                color: "#6b5c65",
              }}
            >
              🏆 <strong>Producto con mayor existencia:</strong>{" "}
              {resumen.productoMayorExistencia ||
                "Sin información"}
            </p>

            <p
              style={{
                margin: "6px 0 0",
                fontSize: "14px",
                color: "#887780",
              }}
            >
              {formatoNumero(
                resumen.cantidadMayorExistencia
              )}{" "}
              unidades disponibles
            </p>
          </div>
        </>
      ) : (
        <>
          <div
            style={{
              display: "grid",
              gridTemplateColumns:
                "repeat(auto-fit, minmax(210px, 1fr))",
              gap: "18px",
            }}
          >
            <TarjetaMetrica
              icono="💰"
              titulo="Venta total"
              valor={formatoDinero(
                resumen.ventaTotal
              )}
              detalle="Importe total del reporte"
            />

            <TarjetaMetrica
              icono="📈"
              titulo="Utilidad"
              valor={formatoDinero(
                resumen.utilidadTotal
              )}
              detalle="Utilidad calculada"
            />

            <TarjetaMetrica
              icono="📦"
              titulo="Piezas vendidas"
              valor={formatoNumero(
                resumen.cantidadTotal
              )}
              detalle={`${formatoNumero(
                resumen.totalRegistros
              )} registros analizados`}
            />

            <TarjetaMetrica
              icono="🧾"
              titulo="Artículos diferentes"
              valor={formatoNumero(
                resumen.articulosDiferentes
              )}
              detalle={`🏆 ${
                resumen.productoMasVendido ||
                "Sin información"
              }`}
            />
          </div>

          <div
            style={{
              marginTop: "18px",
              padding: "16px 20px",
              borderRadius: "14px",
              backgroundColor: "#ffffff",
              border: "1px solid #eadce4",
              textAlign: "center",
            }}
          >
            <p
              style={{
                margin: 0,
                fontSize: "15px",
                lineHeight: "1.5",
                color: "#6b5c65",
              }}
            >
              🏆 <strong>Producto más vendido:</strong>{" "}
              {resumen.productoMasVendido ||
                "Sin información"}
            </p>

            <p
              style={{
                margin: "6px 0 0",
                fontSize: "14px",
                color: "#887780",
              }}
            >
              {formatoNumero(
                resumen.cantidadProductoMasVendido
              )}{" "}
              piezas vendidas
            </p>
          </div>
        </>
      )}
    </section>
  );
}