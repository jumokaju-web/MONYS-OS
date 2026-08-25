// ======================================================
// MONYS OS
// Director Inventario IA 3.0
// ======================================================

import {
  useEffect,
  useState,
} from "react";

import TarjetaIndicador from "../../shared/TarjetaIndicador";
import { analizarInventario } from "../../../analyzers/inventarioAnalyzer";
import TransferenciasInventario from "../../../../inventario/components/TransferenciasInventario";
import RecomendacionesRebalanceo from "../../../../inventario/components/RecomendacionesRebalanceo";
import "../../../../inventario/services/compraMaestraService";
import {
  generarRecomendacionesRebalanceo,
} from "../../../../inventario/services/rebalanceoInventarioService";


function convertirNumero(valor) {
  const numero = Number(valor);

  return Number.isFinite(numero)
    ? numero
    : 0;
}

function formatearDinero(valor) {
  return new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency: "MXN",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(
    convertirNumero(valor)
  );
}

function formatearNumero(valor) {
  return new Intl.NumberFormat(
    "es-MX",
    {
      maximumFractionDigits: 2,
    }
  ).format(
    convertirNumero(valor)
  );
}

function formatearCobertura(valor) {
  if (
    valor === null ||
    valor === undefined ||
    !Number.isFinite(Number(valor))
  ) {
    return "Sin cálculo";
  }

  return `${Number(valor).toFixed(1)} días`;
}

function contieneDatoInventario(detalle) {
  if (
    !detalle ||
    typeof detalle !== "object"
  ) {
    return false;
  }

  const datosOriginales =
    detalle.datos_originales || {};

  const camposInventario = [
    detalle.existencia,
    detalle.exis,
    detalle.stock,
    detalle.precioCompra,
    detalle.precio_compra,
    detalle.precioUnitario,
    detalle.precio_unitario,

    datosOriginales.existencia,
    datosOriginales.exis,
    datosOriginales.stock,
    datosOriginales.precioCompra,
    datosOriginales.precio_compra,
    datosOriginales.precioUnitario,
    datosOriginales.precio_unitario,
  ];

  return camposInventario.some(
    (valor) =>
      valor !== undefined &&
      valor !== null &&
      valor !== ""
  );
}

function obtenerEstiloEstado({
  tieneDatosInventario,
  productosNegativos,
  productosAgotados,
  productosCriticos,
}) {
  if (!tieneDatosInventario) {
    return {
      icono: "⚪",
      etiqueta:
        "Sin reporte de inventario",
      fondo: "#f5f3f4",
      borde: "#ddd7da",
      color: "#6f666a",
    };
  }

  if (
    productosNegativos > 0 ||
    productosCriticos > 0
  ) {
    return {
      icono: "🔴",
      etiqueta:
        "Inventario requiere atención",
      fondo: "#fff0f0",
      borde: "#efb8b8",
      color: "#a52d2d",
    };
  }

  if (productosAgotados > 0) {
    return {
      icono: "🟡",
      etiqueta:
        "Reposición necesaria",
      fondo: "#fff8df",
      borde: "#f2dc8b",
      color: "#8a6800",
    };
  }

  return {
    icono: "🟢",
    etiqueta:
      "Inventario estable",
    fondo: "#eaf8f0",
    borde: "#b8e5ca",
    color: "#207a4a",
  };
}

function obtenerEstiloPrioridad(
  prioridad
) {
  if (prioridad === "CRITICA") {
    return {
      icono: "🔴",
      fondo: "#fff0f0",
      borde: "#efb8b8",
    };
  }

  if (prioridad === "ALTA") {
    return {
      icono: "🟠",
      fondo: "#fff6ed",
      borde: "#efbd84",
    };
  }

  return {
    icono: "🟡",
    fondo: "#fffbea",
    borde: "#e4d17d",
  };
}

function limpiarCodigo(valor) {
  return String(valor ?? "")
    .trim()
    .toLowerCase();
}

function obtenerCodigoRecomendacion(
  recomendacion
) {
  const codigo = limpiarCodigo(
    recomendacion?.codigo
  );

  if (codigo) {
    return codigo;
  }

  const productId = limpiarCodigo(
    recomendacion?.productId
  );

  if (
    productId.startsWith(
      "codigo:"
    )
  ) {
    return productId.slice(7);
  }

  return productId;
}

function DirectorInventario({
  datosDashboard,
  analisisFinanciero = null,
}) {


  const branchId =
    datosDashboard?.branch_id ||
    null;

  const [
    recomendacionesRebalanceo,
    setRecomendacionesRebalanceo,
  ] = useState([]);

  const [
    rebalanceoValidado,
    setRebalanceoValidado,
  ] = useState(false);

  const [
    errorRebalanceo,
    setErrorRebalanceo,
  ] = useState("");

  useEffect(() => {
    let activo = true;

    async function cargarRebalanceo() {
      try {
        setRebalanceoValidado(false);
        setErrorRebalanceo("");

        const recomendaciones =
          await generarRecomendacionesRebalanceo();

        if (!activo) {
          return;
        }

        setRecomendacionesRebalanceo(
          Array.isArray(recomendaciones)
            ? recomendaciones
            : []
        );
      } catch (error) {
        console.error(
          "Error al validar traspasos antes de comprar:",
          error
        );

        if (!activo) {
          return;
        }

        setRecomendacionesRebalanceo([]);

        setErrorRebalanceo(
          error?.message ||
            "No fue posible validar los traspasos entre sucursales."
        );
      } finally {
        if (activo) {
          setRebalanceoValidado(true);
        }
      }
    }

    cargarRebalanceo();

    return () => {
      activo = false;
    };
  }, [branchId]);

  const detalles =
    Array.isArray(
      datosDashboard?.inventario
        ?.detalles
    )
      ? datosDashboard.inventario
          .detalles
      : [];

  const detallesInventario =
    detalles.filter(
      contieneDatoInventario
    );

  const tieneDatosInventario =
    detallesInventario.length > 0;

  const ventas =
    datosDashboard?.inteligencia
      ?.comercial?.ventas || [];

  const diasAnalizados =
    convertirNumero(
      datosDashboard?.metricas
        ?.diasAnalizados
    ) || 7;

  const analisis =
    analizarInventario(
      tieneDatosInventario
        ? detallesInventario
        : [],
      {
        ventas,
        diasAnalizados,
        diasObjetivoInventario: 30,
      }
    );

  const resumenAnalisis =
    analisis?.resumen || {};

  const alertas =
    Array.isArray(
      analisis?.alertas
    )
      ? analisis.alertas
      : [];

  const sugerenciasCompraBase =
    Array.isArray(
      analisis?.sugerenciasCompra
    )
      ? analisis.sugerenciasCompra
      : [];

  /*
    REGLA EJECUTIVA DE COMPRA:

    1. Primero revisar si otra sucursal
       puede cubrir el faltante mediante
       un traspaso seguro.

    2. Después comprar solamente lo que
       todavía haga falta.
  */
  const traspasosEntrantesPorProducto =
    new Map();

  if (
    branchId &&
    rebalanceoValidado &&
    !errorRebalanceo
  ) {
    for (
      const recomendacion of
      recomendacionesRebalanceo
    ) {
      if (
        recomendacion?.branchDestinoId !==
        branchId
      ) {
        continue;
      }

      const codigo =
        obtenerCodigoRecomendacion(
          recomendacion
        );

      if (!codigo) {
        continue;
      }

      const cantidad = Math.max(
        0,
        convertirNumero(
          recomendacion?.cantidadSugerida
        )
      );

      const cantidadActual =
        traspasosEntrantesPorProducto.get(
          codigo
        ) || 0;

      traspasosEntrantesPorProducto.set(
        codigo,
        cantidadActual + cantidad
      );
    }
  }

  const sugerenciasCompraAjustadas =
    sugerenciasCompraBase.map(
      (producto) => {
        const codigo = limpiarCodigo(
          producto?.codigo
        );

        const compraOriginal = Math.max(
          0,
          convertirNumero(
            producto?.cantidadSugerida
          )
        );

        const traspasoDisponible =
          codigo
            ? traspasosEntrantesPorProducto.get(
                codigo
              ) || 0
            : 0;

        const cubiertoPorTraspaso =
          Math.min(
            compraOriginal,
            traspasoDisponible
          );

        const cantidadSugerida =
          Math.max(
            0,
            compraOriginal -
              cubiertoPorTraspaso
          );

        const precioCompra =
          Math.max(
            0,
            convertirNumero(
              producto?.precioCompra
            )
          );

        return {
          ...producto,

          compraOriginal,

          cantidadCubiertaPorTraspaso:
            cubiertoPorTraspaso,

          cantidadSugerida,

          inversionEstimada:
            cantidadSugerida *
            precioCompra,
        };
      }
    );

  const piezasCubiertasPorTraspaso =
    sugerenciasCompraAjustadas.reduce(
      (total, producto) =>
        total +
        convertirNumero(
          producto
            .cantidadCubiertaPorTraspaso
        ),
      0
    );

  const sugerenciasCompra =
    rebalanceoValidado &&
    !errorRebalanceo
      ? sugerenciasCompraAjustadas.filter(
          (producto) =>
            convertirNumero(
              producto.cantidadSugerida
            ) > 0
        )
      : [];

  const piezasSugeridasCompra =
    sugerenciasCompra.reduce(
      (total, producto) =>
        total +
        convertirNumero(
          producto.cantidadSugerida
        ),
      0
    );

  const inversionSugerida =
    sugerenciasCompra.reduce(
      (total, producto) =>
        total +
        convertirNumero(
          producto.inversionEstimada
        ),
      0
    );

    const presupuestoFinanciero =
  Math.max(
    0,
    convertirNumero(
      analisisFinanciero
        ?.capacidadCompra
    )
  );

const vencimientos30Dias =
  Math.max(
    0,
    convertirNumero(
      analisisFinanciero
        ?.vencimientos30Dias
    )
  );

const compraFinancieramenteAutorizada =
  Math.min(
    presupuestoFinanciero,
    inversionSugerida
  );

  const resumen = {
    ...resumenAnalisis,

    piezasSugeridasCompra,
    inversionSugerida,
  };

  const sobreinventario =
    Array.isArray(
      analisis?.sobreinventario
    )
      ? analisis.sobreinventario
      : [];

  const agotados =
    Array.isArray(
      analisis?.agotados
    )
      ? analisis.agotados
      : [];

  const alertasCriticas =
    alertas.filter(
      (alerta) =>
        alerta.prioridad ===
        "critica"
    );

  const estiloEstado =
    obtenerEstiloEstado({
      tieneDatosInventario,

      productosNegativos:
        convertirNumero(
          resumen.productosNegativos
        ),

      productosAgotados:
        convertirNumero(
          resumen.productosAgotados
        ),

      productosCriticos:
        convertirNumero(
          resumen.productosCriticos
        ),
    });

  const planAccion = [];

   function imprimirRevisionInventario() {
  const prioridadPeso = {
    critica: 3,
    alta: 2,
    media: 1,
    baja: 0,
  };

  const productosUnicos =
    new Map();

  const alertasOrdenadas =
    [...alertas].sort(
      (a, b) =>
        (prioridadPeso[
          String(
            b?.prioridad || ""
          ).toLowerCase()
        ] || 0) -
        (prioridadPeso[
          String(
            a?.prioridad || ""
          ).toLowerCase()
        ] || 0)
    );

  for (
    const alerta of
    alertasOrdenadas
  ) {
    const descripcion =
      String(
        alerta?.descripcion ||
        "Producto"
      ).trim();

    if (
      !descripcion ||
      productosUnicos.has(
        descripcion.toLowerCase()
      )
    ) {
      continue;
    }

    productosUnicos.set(
      descripcion.toLowerCase(),
      {
        descripcion,

        codigo:
          alerta?.codigo ||
          alerta?.sku ||
          "",

        prioridad:
          String(
            alerta?.prioridad ||
            ""
          ).toUpperCase(),

        existenciaSistema:
          alerta?.existencia ??
          alerta?.stock ??
          "",

        motivo:
          alerta?.mensaje ||
          "Revisión física requerida.",
      }
    );

    if (
      productosUnicos.size >= 30
    ) {
      break;
    }
  }

  const productosRevision =
    Array.from(
      productosUnicos.values()
    );

  if (
    productosRevision.length === 0
  ) {
    window.alert(
      "MONYS no encontró productos prioritarios para imprimir."
    );

    return;
  }

  function escapar(valor) {
    return String(
      valor ?? ""
    )
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;");
  }

  const nombreSucursal =
    datosDashboard?.branch_name ||
    datosDashboard?.sucursal ||
    datosDashboard?.nombreSucursal ||
    "Sucursal";

  const filas =
    productosRevision
      .map(
        (
          producto,
          index
        ) => `
          <tr>
            <td>${index + 1}</td>

            <td>
              <strong>
                ${escapar(
                  producto.descripcion
                )}
              </strong>
              ${
                producto.codigo
                  ? `<div class="codigo">
                      ${escapar(
                        producto.codigo
                      )}
                    </div>`
                  : ""
              }
            </td>

            <td>
              ${escapar(
                producto.prioridad
              )}
            </td>

            <td>
              ${escapar(
                producto.existenciaSistema
              )}
            </td>

            <td></td>

            <td></td>

            <td>
              ${escapar(
                producto.motivo
              )}
            </td>

            <td></td>
          </tr>
        `
      )
      .join("");

  const ventana =
    window.open(
      "",
      "_blank",
      "width=1200,height=800"
    );

  if (!ventana) {
    window.alert(
      "El navegador bloqueó la ventana de impresión."
    );

    return;
  }

  ventana.document.write(`
    <!DOCTYPE html>

    <html>
      <head>
        <meta charset="UTF-8" />

        <title>
          Revisión de Inventario MONYS OS
        </title>

        <style>
          body {
            font-family:
              Arial,
              sans-serif;

            margin: 24px;

            color: #222;
          }

          h1 {
            margin-bottom: 4px;
          }

          .subtitulo {
            margin-bottom: 20px;

            color: #666;
          }

          .datos {
            display: flex;

            justify-content:
              space-between;

            margin-bottom: 18px;

            gap: 20px;
          }

          table {
            width: 100%;

            border-collapse:
              collapse;

            font-size: 12px;
          }

          th,
          td {
            border:
              1px solid #888;

            padding: 7px;

            vertical-align:
              top;
          }

          th {
            background:
              #f4f4f4;
          }

          td:nth-child(4),
          td:nth-child(5),
          td:nth-child(6) {
            text-align:
              center;

            min-width:
              65px;
          }

          td:nth-child(8) {
            min-width:
              90px;
          }

          .codigo {
            margin-top: 3px;

            font-size: 10px;

            color: #666;
          }

          .firmas {
            margin-top: 35px;

            display: grid;

            grid-template-columns:
              1fr 1fr;

            gap: 60px;
          }

          .firma {
            border-top:
              1px solid #333;

            padding-top:
              6px;

            text-align:
              center;
          }

          @media print {
            body {
              margin: 10mm;
            }
          }
        </style>
      </head>

      <body>
        <h1>
          MONYS OS · Revisión de Inventario
        </h1>

        <div class="subtitulo">
          Productos seleccionados automáticamente
          por prioridad de revisión física.
        </div>

        <div class="datos">
          <div>
            <strong>Sucursal:</strong>
            ${escapar(
              nombreSucursal
            )}
          </div>

          <div>
            <strong>Fecha:</strong>
            ${new Date().toLocaleDateString(
              "es-MX"
            )}
          </div>

          <div>
            <strong>Productos:</strong>
            ${productosRevision.length}
          </div>
        </div>

        <table>
          <thead>
            <tr>
              <th>#</th>
              <th>Producto</th>
              <th>Prioridad</th>
              <th>SICAR</th>
              <th>Físico</th>
              <th>Diferencia</th>
              <th>Motivo / observación MONYS</th>
              <th>Revisó</th>
            </tr>
          </thead>

          <tbody>
            ${filas}
          </tbody>
        </table>

        <div class="firmas">
          <div class="firma">
            Empleada que realizó revisión
          </div>

          <div class="firma">
            Encargada / Supervisión
          </div>
        </div>

        <script>
          window.onload = function () {
            window.print();
          };
        </script>
      </body>
    </html>
  `);

  ventana.document.close();
}

  if (!tieneDatosInventario) {
    planAccion.push(
      "Importar desde SICAR un reporte de Inventario, Existencias o Inventario/Utilidad."
    );
  } else {
    if (
      resumen.productosNegativos > 0
    ) {
      planAccion.push(
        `Revisar físicamente ${resumen.productosNegativos} productos con existencia negativa.`
      );
    }

    if (
      resumen.productosCriticos > 0
    ) {
      planAccion.push(
        `Atender primero ${resumen.productosCriticos} productos con cobertura crítica.`
      );
    }

    if (
      resumen.productosAgotados > 0
    ) {
      planAccion.push(
        `Revisar reposición de ${resumen.productosAgotados} productos agotados.`
      );
    }

    if (
      piezasCubiertasPorTraspaso > 0
    ) {
      planAccion.push(
        `Cubrir primero ${formatearNumero(
          piezasCubiertasPorTraspaso
        )} piezas mediante traspasos sugeridos entre sucursales antes de comprar.`
      );
    }

    if (errorRebalanceo) {
      planAccion.push(
        "No autorizar compras hasta volver a validar los traspasos disponibles entre sucursales."
      );
   
      } else if (
  rebalanceoValidado &&
  sugerenciasCompra.length > 0
) {
  if (
    compraFinancieramenteAutorizada > 0
  ) {
    planAccion.push(
      `Después de descontar los traspasos disponibles, Inventario detecta una necesidad de ${formatearNumero(
        resumen.piezasSugeridasCompra
      )} piezas con inversión estimada de ${formatearDinero(
        resumen.inversionSugerida
      )}. Finanzas autoriza actualmente hasta ${formatearDinero(
        compraFinancieramenteAutorizada
      )}.`
    );
  } else {
    planAccion.push(
      `Después de descontar los traspasos disponibles, Inventario detecta una necesidad de ${formatearNumero(
        resumen.piezasSugeridasCompra
      )} piezas con inversión estimada de ${formatearDinero(
        resumen.inversionSugerida
      )}, pero actualmente Finanzas no autoriza presupuesto para nuevas compras.`
    );
  }
}

    if (
      resumen.productosSobreinventario >
      0
    ) {
      planAccion.push(
        `Evitar nuevas compras de ${resumen.productosSobreinventario} productos con sobreinventario.`
      );
    }

    planAccion.push(
      "Cruzar diariamente ventas y existencias antes de autorizar nuevas compras."
    );
  }

  return (
    <section
      style={{
        marginTop: "30px",
        padding: "28px",
        borderRadius: "22px",
        background:
          "linear-gradient(135deg, #ffffff 0%, #eef9ff 100%)",
        border:
          "1px solid #b8dff5",
        boxShadow:
          "0 12px 35px rgba(39, 120, 170, 0.12)",
      }}
    >
      {/* ENCABEZADO */}

      <div
        style={{
          display: "flex",
          justifyContent:
            "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: "15px",
        }}
      >
        <div>
          <p
            style={{
              margin: "0 0 7px",
              color: "#287da9",
              fontWeight: "800",
              letterSpacing: "1px",
            }}
          >
            MONYS OS · DIRECTOR
            INVENTARIO
          </p>

          <h2
            style={{
              margin: 0,
              fontSize: "28px",
            }}
          >
            📦 Informe de Inventario IA
            3.0
          </h2>
        </div>

        <div
          style={{
            padding: "11px 17px",
            borderRadius: "999px",
            backgroundColor:
              estiloEstado.fondo,
            border: `1px solid ${estiloEstado.borde}`,
            color:
              estiloEstado.color,
            fontWeight: "800",
          }}
        >
          {estiloEstado.icono}{" "}
          {estiloEstado.etiqueta}
        </div>
        <button
  type="button"
  onClick={imprimirRevisionInventario}
  style={{
    padding: "11px 17px",
    borderRadius: "12px",
    border: "1px solid #d6a9bf",
    backgroundColor: "#fff7fb",
    color: "#a62d67",
    fontWeight: "800",
    cursor: "pointer",
  }}
>
  🖨️ Imprimir 30 productos para revisar
</button>
      </div>

      {!tieneDatosInventario && (
        <div
          style={{
            marginTop: "22px",
            padding: "18px",
            borderRadius: "15px",
            backgroundColor:
              "#fff8df",
            border:
              "1px solid #f2dc8b",
            color: "#75600d",
            lineHeight: "1.6",
          }}
        >
          <strong>
            ℹ️ Falta información de
            inventario
          </strong>

          <p
            style={{
              margin: "9px 0 0",
            }}
          >
            Importa un reporte de
            Inventario, Existencias o
            Inventario/Utilidad para
            activar cobertura,
            resurtido y sobreinventario.
          </p>
        </div>
      )}

      {/* INDICADORES PRINCIPALES */}

      <div
        style={{
          display: "grid",
          gridTemplateColumns:
            "repeat(auto-fit, minmax(210px, 1fr))",
          gap: "16px",
          marginTop: "24px",
        }}
      >
        <TarjetaIndicador
          icono="📦"
          titulo="Productos analizados"
          valor={
            resumen.totalProductos || 0
          }
        />

        <TarjetaIndicador
  icono={
    compraFinancieramenteAutorizada > 0
      ? "✅"
      : "⛔"
  }
  titulo="Presupuesto autorizado"
  valor={formatearDinero(
    compraFinancieramenteAutorizada
  )}
  subtitulo={
    vencimientos30Dias > 0
      ? `${formatearDinero(
          vencimientos30Dias
        )} comprometidos a 30 días`
      : "Según capacidad financiera actual"
  }
/>

        <TarjetaIndicador
          icono="✅"
          titulo="Con existencia"
          valor={
            resumen.productosConExistencia ||
            0
          }
        />

        <TarjetaIndicador
          icono="⚠️"
          titulo="Agotados"
          valor={
            resumen.productosAgotados ||
            0
          }
        />

        <TarjetaIndicador
          icono="🚨"
          titulo="Cobertura crítica"
          valor={
            resumen.productosCriticos ||
            0
          }
        />

        <TarjetaIndicador
          icono="🟡"
          titulo="Inventario bajo"
          valor={
            resumen.productosBajos ||
            0
          }
        />

        <TarjetaIndicador
          icono="📚"
          titulo="Sobreinventario"
          valor={
            resumen.productosSobreinventario ||
            0
          }
        />

        <TarjetaIndicador
          icono="🧮"
          titulo="Piezas en inventario"
          valor={formatearNumero(
            resumen.existenciaTotal
          )}
        />

        <TarjetaIndicador
          icono="💰"
          titulo="Valor del inventario"
          valor={formatearDinero(
            resumen.valorInventario
          )}
        />
      </div>

      {/* DECISIÓN DE COMPRA */}

      <div
        style={{
          marginTop: "26px",
          padding: "22px",
          borderRadius: "18px",
          background:
            "linear-gradient(135deg, #ffffff 0%, #f0fff5 100%)",
          border:
            "1px solid #b8dfc6",
        }}
      >
        <h3
          style={{
            margin: "0 0 8px",
            color: "#207a4a",
          }}
        >
        📦 Necesidad de compra detectada por
      Inventario IA
        </h3>

        <p
          style={{
            margin: "0 0 18px",
            color: "#5f6d65",
            lineHeight: "1.5",
          }}
        >
        MONYS OS calcula la necesidad operativa
     después de descontar los traspasos seguros.
    La compra final queda sujeta al presupuesto
     autorizado por Finanzas.
        </p>

        {!rebalanceoValidado && (
          <p
            style={{
              margin: "0 0 18px",
              color: "#8a6800",
              fontWeight: "700",
            }}
          >
            🔄 Validando traspasos antes de
            calcular compras...
          </p>
        )}

        {errorRebalanceo && (
          <p
            style={{
              margin: "0 0 18px",
              color: "#a52d2d",
              fontWeight: "700",
            }}
          >
            ⚠️ No se pudo validar el
            rebalanceo. Las compras quedan
            detenidas hasta revisar el
            problema.
          </p>
        )}

        <div
          style={{
            display: "grid",
            gridTemplateColumns:
              "repeat(auto-fit, minmax(220px, 1fr))",
            gap: "16px",
          }}
        >
          <TarjetaIndicador
            icono="📦"
            titulo="Piezas sugeridas"
            valor={formatearNumero(
              resumen.piezasSugeridasCompra
            )}
          />

          <TarjetaIndicador
            icono="💳"
            titulo="Inversión estimada"
            valor={formatearDinero(
              resumen.inversionSugerida
            )}
          />

          <TarjetaIndicador
            icono="🔄"
            titulo="Cubiertas por traspaso"
            valor={formatearNumero(
              piezasCubiertasPorTraspaso
            )}
          />

          <TarjetaIndicador
            icono="📅"
            titulo="Cobertura objetivo"
            valor="30 días"
          />

          <TarjetaIndicador
            icono="📊"
            titulo="Días de ventas analizados"
            valor={diasAnalizados}
          />
        </div>
      </div>

      {/* PRIORIDADES DE RESURTIDO */}

      {sugerenciasCompra.length >
        0 && (
        <div
          style={{
            marginTop: "24px",
            padding: "22px",
            borderRadius: "18px",
            backgroundColor:
              "#fffdf8",
            border:
              "1px solid #ecd9aa",
          }}
        >
          <h3
            style={{
              margin: "0 0 6px",
              color: "#8a6800",
            }}
          >
            ⭐ Prioridades de
            resurtido
          </h3>

          <p
            style={{
              marginTop: 0,
              color: "#675a60",
            }}
          >
            Productos ordenados según
            existencia, rotación y cobertura,
            después de descontar lo que puede
            cubrirse con traspasos internos.
          </p>

          <div
            style={{
              display: "grid",
              gap: "12px",
              marginTop: "16px",
            }}
          >
            {sugerenciasCompra
              .slice(0, 15)
              .map(
                (
                  producto,
                  index
                ) => {
                  const estilo =
                    obtenerEstiloPrioridad(
                      producto.prioridad
                    );

                  return (
                    <article
                      key={`${producto.codigo}-${producto.descripcion}-${index}`}
                      style={{
                        padding:
                          "16px",
                        borderRadius:
                          "14px",
                        backgroundColor:
                          estilo.fondo,
                        border: `1px solid ${estilo.borde}`,
                      }}
                    >
                      <div
                        style={{
                          display:
                            "flex",
                          justifyContent:
                            "space-between",
                          gap: "15px",
                          flexWrap:
                            "wrap",
                        }}
                      >
                        <strong>
                          {estilo.icono}{" "}
                          #{index + 1}{" "}
                          {
                            producto.descripcion
                          }
                        </strong>

                        <strong>
                          Comprar{" "}
                          {
                            producto.cantidadSugerida
                          }{" "}
                          pzas
                        </strong>
                      </div>

                      <div
                        style={{
                          display:
                            "grid",
                          gridTemplateColumns:
                            "repeat(auto-fit, minmax(150px, 1fr))",
                          gap: "8px",
                          marginTop:
                            "12px",
                          fontSize:
                            "14px",
                        }}
                      >
                        <span>
                          Existencia:{" "}
                          <strong>
                            {
                              producto.existencia
                            }
                          </strong>
                        </span>

                        <span>
                          Vendidas:{" "}
                          <strong>
                            {
                              producto.piezasVendidas
                            }
                          </strong>
                        </span>

                        <span>
                          Cobertura:{" "}
                          <strong>
                            {formatearCobertura(
                              producto.diasCobertura
                            )}
                          </strong>
                        </span>

                        <span>
                          Inversión:{" "}
                          <strong>
                            {formatearDinero(
                              producto.inversionEstimada
                            )}
                          </strong>
                        </span>

                        {producto
                          .cantidadCubiertaPorTraspaso >
                          0 && (
                          <span>
                            Traspaso cubre:{" "}
                            <strong>
                              {formatearNumero(
                                producto
                                  .cantidadCubiertaPorTraspaso
                              )}{" "}
                              pzas
                            </strong>
                          </span>
                        )}
                      </div>
                    </article>
                  );
                }
              )}
          </div>
        </div>
      )}

      {/* AGOTADOS QUE SÍ VENDEN */}

      {agotados.length > 0 && (
        <div
          style={{
            marginTop: "24px",
            padding: "22px",
            borderRadius: "18px",
            backgroundColor:
              "#fff4f4",
            border:
              "1px solid #efc2c2",
          }}
        >
          <h3
            style={{
              margin: "0 0 15px",
              color: "#a52d2d",
            }}
          >
            🔥 Productos agotados
          </h3>

          {agotados
            .slice(0, 10)
            .map(
              (
                producto,
                index
              ) => (
                <div
                  key={`${producto.codigo}-${index}`}
                  style={{
                    padding:
                      "11px 0",
                    borderBottom:
                      "1px solid #efdada",
                  }}
                >
                  <strong>
                    🔴{" "}
                    {
                      producto.descripcion
                    }
                  </strong>

                  <div
                    style={{
                      marginTop:
                        "4px",
                      color:
                        "#675a60",
                    }}
                  >
                    Vendió{" "}
                    {
                      producto.piezasVendidas
                    }{" "}
                    piezas y actualmente
                    tiene existencia 0.
                  </div>
                </div>
              )
            )}
        </div>
      )}

      {/* SOBREINVENTARIO */}

      {sobreinventario.length >
        0 && (
        <div
          style={{
            marginTop: "24px",
            padding: "22px",
            borderRadius: "18px",
            backgroundColor:
              "#f6f3ff",
            border:
              "1px solid #d9cff0",
          }}
        >
          <h3
            style={{
              margin: "0 0 6px",
              color: "#655093",
            }}
          >
            🚫 Productos con
            sobreinventario
          </h3>

          <p
            style={{
              marginTop: 0,
              color: "#675a60",
            }}
          >
            Evita recomprar estos
            productos hasta reducir su
            cobertura.
          </p>

          {sobreinventario
            .slice(0, 10)
            .map(
              (
                producto,
                index
              ) => (
                <div
                  key={`${producto.codigo}-${index}`}
                  style={{
                    display:
                      "flex",
                    justifyContent:
                      "space-between",
                    gap: "15px",
                    padding:
                      "12px 0",
                    borderBottom:
                      "1px solid #e2daf2",
                    flexWrap:
                      "wrap",
                  }}
                >
                  <div>
                    <strong>
                      {
                        producto.descripcion
                      }
                    </strong>

                    <div
                      style={{
                        marginTop:
                          "4px",
                        fontSize:
                          "13px",
                        color:
                          "#675a60",
                      }}
                    >
                      Cobertura:{" "}
                      {formatearCobertura(
                        producto.diasCobertura
                      )}
                    </div>
                  </div>

                  <strong>
                    {formatearDinero(
                      producto.valorInventario
                    )}{" "}
                    en inventario
                  </strong>
                </div>
              )
            )}
        </div>
      )}

      {/* ALERTAS */}

      {tieneDatosInventario &&
        alertas.length > 0 && (
          <div
            style={{
              marginTop: "24px",
              padding: "20px",
              borderRadius:
                "16px",
              backgroundColor:
                "#fff7f7",
              border:
                "1px solid #efc7c7",
            }}
          >
            <h3
              style={{
                margin:
                  "0 0 15px",
                color:
                  "#a52d2d",
              }}
            >
              🚨 Alertas de
              inventario
            </h3>

            <p>
              Se detectaron{" "}
              <strong>
                {alertas.length}
              </strong>{" "}
              situaciones;{" "}
              <strong>
                {
                  alertasCriticas.length
                }
              </strong>{" "}
              son críticas.
            </p>

            {alertas
              .slice(0, 10)
              .map(
                (
                  alerta,
                  index
                ) => (
                  <div
                    key={`${alerta.descripcion}-${index}`}
                    style={{
                      marginBottom:
                        "10px",
                      padding:
                        "12px",
                      borderRadius:
                        "11px",
                      backgroundColor:
                        "#ffffff",
                      border:
                        "1px solid #efdada",
                    }}
                  >
                    <strong>
                      {alerta.prioridad ===
                      "critica"
                        ? "🔴"
                        : "🟡"}{" "}
                      {
                        alerta.descripcion
                      }
                    </strong>

                    <div
                      style={{
                        marginTop:
                          "5px",
                      }}
                    >
                      {
                        alerta.mensaje
                      }
                    </div>
                  </div>
                )
              )}
          </div>
        )}

      {/* PLAN DE ACCIÓN */}

      <div
        style={{
          marginTop: "24px",
          padding: "20px",
          borderRadius: "16px",
          backgroundColor:
            "#f3fff6",
          border:
            "1px solid #ccebd5",
        }}
      >
        <h3
          style={{
            margin: "0 0 15px",
            color: "#207a4a",
          }}
        >
          📋 Plan de acción de
          Inventario IA
        </h3>

        {planAccion.map(
          (accion, index) => (
            <div
              key={`${accion}-${index}`}
              style={{
                display: "flex",
                alignItems:
                  "flex-start",
                gap: "10px",
                marginBottom:
                  "12px",
                lineHeight:
                  "1.6",
              }}
            >
              <span>✅</span>
              <span>
                {accion}
              </span>
            </div>
          )
        )}
      </div>
      <RecomendacionesRebalanceo />

      <TransferenciasInventario />
    </section>
  );
}

export default DirectorInventario;