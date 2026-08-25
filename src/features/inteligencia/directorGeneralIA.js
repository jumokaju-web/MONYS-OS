import knowledgeService from "../../services/knowledgeService";

function convertirNumero(valor) {
  const numero = Number(valor);

  return Number.isFinite(numero)
    ? numero
    : 0;
}

function formatearNumero(valor) {
  return convertirNumero(
    valor
  ).toLocaleString("es-MX");
}

export function generarMensajeDirectorGeneral(
  metricas
) {
  const empresa =
    knowledgeService.getCompanyProfile();

  const objetivos =
    knowledgeService.getObjectives() || [];

  const nombreResponsable =
    empresa?.owner || "Jefa";

  if (!metricas) {
    return {
      saludo:
        `Buenos días, ${nombreResponsable}.`,

      estado:
        "Todavía no existe información suficiente para preparar el informe ejecutivo.",

      hallazgos: [],

      recomendaciones: [
        "Importar el reporte comercial más reciente para iniciar el análisis.",
      ],
    };
  }

  const totalProductos =
    convertirNumero(
      metricas.totalProductos
    );

  const totalPiezas =
    convertirNumero(
      metricas.totalPiezas
    );

  const productoMasVendido =
    metricas.productoMasVendido || {};

  const productoLider =
    productoMasVendido.descripcion ||
    "";

  const piezasProductoLider =
    convertirNumero(
      productoMasVendido.cantidad
    );

  const promedioPiezasPorProducto =
    totalProductos > 0
      ? totalPiezas /
        totalProductos
      : 0;

  const participacionProductoLider =
    totalPiezas > 0
      ? (
          piezasProductoLider /
          totalPiezas
        ) * 100
      : 0;

  const hallazgos = [];

  const recomendaciones = [];

  let estado =
    "La información comercial disponible fue revisada correctamente.";

  if (
    totalProductos === 0 &&
    totalPiezas === 0
  ) {
    estado =
      "No se detectó actividad comercial suficiente para emitir una conclusión ejecutiva confiable.";

    recomendaciones.push(
      "Verificar que el reporte de ventas más reciente esté correctamente importado."
    );

    return {
      saludo:
        `Buenos días, ${nombreResponsable}.`,

      estado,

      hallazgos,

      recomendaciones,
    };
  }

  estado =
    `La operación comercial registró ${formatearNumero(
      totalPiezas
    )} piezas en ${formatearNumero(
      totalProductos
    )} productos analizados.`;

  hallazgos.push(
    `El promedio fue de ${promedioPiezasPorProducto.toFixed(
      1
    )} piezas vendidas por producto.`
  );

  if (productoLider) {
    hallazgos.push(
      `"${productoLider}" encabeza el desempeño comercial con ${formatearNumero(
        piezasProductoLider
      )} piezas vendidas.`
    );

    if (
      participacionProductoLider >=
      20
    ) {
      hallazgos.push(
        `El producto líder concentra el ${participacionProductoLider.toFixed(
          1
        )}% del volumen vendido, por lo que representa una dependencia comercial importante.`
      );

      recomendaciones.push(
        `Proteger la disponibilidad de "${productoLider}" y mantener una existencia de seguridad para evitar una caída directa en ventas.`
      );
    } else if (
      participacionProductoLider >=
      10
    ) {
      hallazgos.push(
        `El producto líder representa el ${participacionProductoLider.toFixed(
          1
        )}% del volumen vendido y tiene una participación comercial relevante.`
      );

      recomendaciones.push(
        `Confirmar existencias y velocidad de reposición de "${productoLider}" antes de autorizar promociones adicionales.`
      );
    } else {
      hallazgos.push(
        `Las ventas se encuentran diversificadas: el producto líder representa únicamente el ${participacionProductoLider.toFixed(
          1
        )}% del volumen total.`
      );

      recomendaciones.push(
        `Mantener disponible "${productoLider}", pero distribuir el presupuesto de compra entre varios productos con demanda comprobada.`
      );
    }
  } else {
    hallazgos.push(
      "No fue posible identificar un producto líder dentro de la información comercial disponible."
    );
  }

  if (
    promedioPiezasPorProducto <
    2
  ) {
    hallazgos.push(
      "El volumen promedio por producto es bajo, lo que puede indicar un catálogo muy amplio en relación con la rotación."
    );

    recomendaciones.push(
      "Identificar productos con poca rotación antes de realizar nuevas compras generales."
    );
  } else {
    recomendaciones.push(
      "Concentrar las compras en productos con ventas comprobadas y validar sus existencias reales."
    );
  }

  if (
    objetivos.length > 0
  ) {
    hallazgos.push(
      `El análisis considera ${objetivos.length} objetivos empresariales activos.`
    );
  }

  recomendaciones.push(
    "Comparar este resultado con el siguiente periodo para detectar crecimiento, disminución o cambios en la demanda."
  );

  return {
    saludo:
      `Buenos días, ${nombreResponsable}.`,

    estado,

    hallazgos,

    recomendaciones,
  };
}