import {
  obtenerSucursalesInventario,
} from "./inventarioService";

import {
  obtenerUltimosInventariosPorSucursal,
  obtenerUltimasVentasPorSucursal,
} from "../../dashboard/services/dashboardDataService";
import { leerExistenciaReportada } from "../shared/existenciaReportada";
import { crearPendienteExistenciaDestino } from "../shared/pendienteExistenciaDestino";
import { calcularUnidadesParaDias } from "../shared/calcularUnidadesParaDias";

const DIAS_OBJETIVO_DESTINO = 14;
const DIAS_RESERVA_ORIGEN = 30;

const RESERVA_MINIMA_PIEZAS = 3;
const PORCENTAJE_RESERVA_MINIMA = 0.40;

const EXISTENCIA_MAXIMA_CONFIABLE = 500;

/*
 * MODO PILOTO MONYS
 *
 * Mientras todavía tenemos poco histórico:
 *
 * - destino recibe inventario para aprox. 14 días;
 * - origen conserva al menos 30 días de sus ventas;
 * - además conserva mínimo 40% de su existencia;
 * - nunca deja menos de 3 piezas.
 *
 * Después de acumular histórico confiable,
 * MONYS podrá flexibilizar estas reglas.
 */

function convertirNumero(valor) {
  const numero = Number(valor);

  if (!Number.isFinite(numero)) {
    return 0;
  }

  return numero;
}

function limpiarTexto(valor) {
  return String(valor ?? "")
    .trim()
    .toLowerCase();
}

function obtenerCodigo(detalle) {
  return String(
    detalle?.codigo ??
      detalle?.datos_originales?.codigo ??
      ""
  ).trim();
}

function obtenerDescripcion(detalle) {
  return String(
    detalle?.descripcion ??
      detalle?.datos_originales
        ?.descripcion ??
      "Producto"
  ).trim();
}

function obtenerExistencia(detalle) {
  return leerExistenciaReportada(detalle);
}

function obtenerClaveProducto(detalle) {
  const codigo =
    limpiarTexto(
      obtenerCodigo(detalle)
    );

  if (codigo) {
    return `codigo:${codigo}`;
  }

  const descripcion =
    limpiarTexto(
      obtenerDescripcion(detalle)
    );

  if (descripcion) {
    return `descripcion:${descripcion}`;
  }

  return "";
}

function obtenerNombreSucursal(
  sucursales,
  branchId
) {
  const sucursal =
    sucursales.find(
      (item) =>
        item.id === branchId
    );

  return (
    sucursal?.name ||
    "Sucursal"
  );
}

function convertirFecha(valor) {
  if (!valor) {
    return null;
  }

  const fecha =
    new Date(valor);

  if (
    Number.isNaN(
      fecha.getTime()
    )
  ) {
    return null;
  }

  return fecha;
}

function obtenerFechaCorteExistencia(inventario) {
  const fecha =
    inventario?.importacion?.created_at;

  return fecha
    ? String(fecha).slice(0, 10)
    : null;
}

function diferenciaDias(
  fechaInicio,
  fechaFin
) {
  if (
    !fechaInicio ||
    !fechaFin
  ) {
    return null;
  }

  const milisegundosDia =
    1000 * 60 * 60 * 24;

  return Math.max(
    0,
    Math.floor(
      (
        fechaFin.getTime() -
        fechaInicio.getTime()
      ) / milisegundosDia
    )
  );
}

function obtenerPeriodoComparable(
  ventasOrigen,
  ventasDestino
) {
  const inicioOrigen =
    convertirFecha(
      ventasOrigen?.periodo
        ?.fechaInicio
    );

  const finOrigen =
    convertirFecha(
      ventasOrigen?.periodo
        ?.fechaFin
    );

  const inicioDestino =
    convertirFecha(
      ventasDestino?.periodo
        ?.fechaInicio
    );

  const finDestino =
    convertirFecha(
      ventasDestino?.periodo
        ?.fechaFin
    );

  if (
    !inicioOrigen ||
    !finOrigen ||
    !inicioDestino ||
    !finDestino
  ) {
    return null;
  }

  const mismoInicio =
    inicioOrigen.getTime() ===
    inicioDestino.getTime();

  const mismoFin =
    finOrigen.getTime() ===
    finDestino.getTime();

  if (
    !mismoInicio ||
    !mismoFin
  ) {
    return null;
  }

  const diasAnalizados =
    diferenciaDias(
      inicioOrigen,
      finOrigen
    ) + 1;

  return {
    fechaInicio:
      inicioOrigen,

    fechaFin:
      finOrigen,

    diasAnalizados:
      Math.max(
        1,
        diasAnalizados
      ),
  };
}

function calcularCoberturaDias({
  existencia,
  cantidadVendida,
  diasAnalizados,
}) {
  if (
    diasAnalizados <= 0 ||
    cantidadVendida <= 0
  ) {
    return null;
  }

  const ventaDiaria =
    cantidadVendida /
    diasAnalizados;

  if (ventaDiaria <= 0) {
    return null;
  }

  return (
    existencia /
    ventaDiaria
  );
}

function construirMapaInventario(
  detalles
) {
  const mapa =
    new Map();

  for (
    const detalle of
    detalles || []
  ) {
    const clave =
      obtenerClaveProducto(
        detalle
      );

    if (!clave) {
      continue;
    }

    const existencia =
      obtenerExistencia(
        detalle
      );

    // Una fila sin existencia informada no equivale a cero piezas.
    if (existencia === null) {
      continue;
    }

    const registroActual =
      mapa.get(clave);

    if (
      !registroActual ||
      existencia >
        registroActual.existencia
    ) {
      mapa.set(
        clave,
        {
          clave,

          codigo:
            obtenerCodigo(
              detalle
            ),

          descripcion:
            obtenerDescripcion(
              detalle
            ),

          existencia,
        }
      );
    }
  }

  return mapa;
}

function construirMapaVentas(
  ventas
) {
  const mapa =
    new Map();

  for (
    const venta of
    ventas || []
  ) {
    const codigo =
      limpiarTexto(
        venta?.codigo
      );

    if (!codigo) {
      continue;
    }

    const clave =
      `codigo:${codigo}`;

    const cantidadVendida =
      Math.max(
        0,
        convertirNumero(
          venta?.cantidad
        )
      );

    const registroActual =
      mapa.get(clave) || {
        cantidadVendida: 0,
      };

    registroActual
      .cantidadVendida +=
      cantidadVendida;

    mapa.set(
      clave,
      registroActual
    );
  }

  return mapa;
}

function calcularPlanTransferencia({
  existenciaOrigen,
  existenciaDestino,
  ventasOrigen,
  ventasDestino,
  diasAnalizados,
}) {
  if (
    diasAnalizados <= 0 ||
    ventasDestino <= 0
  ) {
    return null;
  }

  const ventaDiariaOrigen =
    ventasOrigen > 0
      ? ventasOrigen /
        diasAnalizados
      : 0;

  const ventaDiariaDestino =
    ventasDestino /
    diasAnalizados;

  /*
    DESTINO

    Intentamos dejar aproximadamente
    14 días de inventario según
    su velocidad real de venta.
  */
  const objetivoDestino =
    Math.max(
      1,
      calcularUnidadesParaDias({
        unidadesVendidas: ventasDestino,
        diasAnalizados,
        diasObjetivo: DIAS_OBJETIVO_DESTINO,
      })
    );

  const necesidadDestino =
    Math.max(
      0,
      objetivoDestino -
        existenciaDestino
    );

  if (
    necesidadDestino <= 0
  ) {
    return null;
  }

  /*
    ORIGEN

    Primero protegemos aproximadamente
    30 días de sus propias ventas.
  */
  const reservaPorVentas =
    ventasOrigen > 0
      ? calcularUnidadesParaDias({
          unidadesVendidas: ventasOrigen,
          diasAnalizados,
          diasObjetivo: DIAS_RESERVA_ORIGEN,
        })
      : 0;

  /*
    También dejamos una reserva mínima
    física aunque el producto tenga
    ventas muy bajas o cero.
  */
  const reservaPorPorcentaje =
    Math.ceil(
      existenciaOrigen *
        PORCENTAJE_RESERVA_MINIMA
    );

  const reservaMinimaOrigen =
    Math.max(
      RESERVA_MINIMA_PIEZAS,
      reservaPorVentas,
      reservaPorPorcentaje
    );

  const excedenteOrigen =
    Math.max(
      0,
      existenciaOrigen -
        reservaMinimaOrigen
    );

  /*
    Si el origen no tiene verdadero
    excedente, NO debe donar mercancía.
  */
  if (
    excedenteOrigen <= 0
  ) {
    return null;
  }

  const cantidadSugerida =
    Math.floor(
      Math.min(
        excedenteOrigen,
        necesidadDestino
      )
    );

  if (
    cantidadSugerida <= 0
  ) {
    return null;
  }

  return {
    ventaDiariaOrigen,
    ventaDiariaDestino,

    objetivoOrigen:
      reservaMinimaOrigen,

    objetivoDestino,

    reservaMinimaOrigen,

    excedenteOrigen,
    necesidadDestino,

    cantidadSugerida,
  };
}

function calcularPrioridad({
  existenciaDestino,
  ventasDestino,
  coberturaDestino,
  cantidadSugerida,
}) {
  if (
    ventasDestino > 0 &&
    existenciaDestino <= 0
  ) {
    return "ALTA";
  }

  if (
    coberturaDestino !== null &&
    coberturaDestino <= 7
  ) {
    return "ALTA";
  }

  if (
    coberturaDestino !== null &&
    coberturaDestino <= 15
  ) {
    return "MEDIA";
  }

  if (
    cantidadSugerida >= 10
  ) {
    return "MEDIA";
  }

  return "BAJA";
}

export async function generarAnalisisRebalanceo(businessId = null) {
  const sucursales = await obtenerSucursalesInventario(businessId);
  const branchIds = sucursales.map((sucursal) => sucursal?.id).filter(Boolean);
  if (businessId && branchIds.length === 0) {
    return { recomendaciones: [], pendientesValidacion: [] };
  }
  const [inventariosPorSucursal, ventasPorSucursal] = await Promise.all([
    obtenerUltimosInventariosPorSucursal(branchIds),
    obtenerUltimasVentasPorSucursal(branchIds),
  ]);

  if (
    !Array.isArray(
      inventariosPorSucursal
    ) ||
    inventariosPorSucursal.length <
      2
  ) {
    return {
      recomendaciones: [],
      pendientesValidacion: [],
    };
  }

  const inventariosPreparados =
    inventariosPorSucursal.map(
      (inventario) => ({
        ...inventario,

        mapa:
          construirMapaInventario(
            inventario.detalles
          ),
      })
    );

  const ventasPorBranch =
    new Map();

  for (
    const ventasSucursal of
    ventasPorSucursal || []
  ) {
    ventasPorBranch.set(
      ventasSucursal.branch_id,
      ventasSucursal
    );
  }

  const recomendaciones =
    [];

  const pendientesValidacion =
    [];

  const recomendacionesUnicas =
    new Set();

  const pendientesUnicos =
    new Set();

  for (
    let origenIndice = 0;
    origenIndice <
    inventariosPreparados.length;
    origenIndice += 1
  ) {
    const origen =
      inventariosPreparados[
        origenIndice
      ];

    for (
      let destinoIndice = 0;
      destinoIndice <
      inventariosPreparados.length;
      destinoIndice += 1
    ) {
      if (
        origenIndice ===
        destinoIndice
      ) {
        continue;
      }

      const destino =
        inventariosPreparados[
          destinoIndice
        ];

      const ventasSucursalOrigen =
        ventasPorBranch.get(
          origen.branch_id
        );

      const ventasSucursalDestino =
        ventasPorBranch.get(
          destino.branch_id
        );

      if (
        !ventasSucursalOrigen ||
        !ventasSucursalDestino
      ) {
        continue;
      }

      const periodoComparable =
        obtenerPeriodoComparable(
          ventasSucursalOrigen,
          ventasSucursalDestino
        );

      if (!periodoComparable) {
        continue;
      }

      const mapaVentasOrigen =
        construirMapaVentas(
          ventasSucursalOrigen
            .ventas
        );

      const mapaVentasDestino =
        construirMapaVentas(
          ventasSucursalDestino
            .ventas
        );

      for (
        const [
          clave,
          productoOrigen,
        ] of origen.mapa
      ) {
        const productoDestino =
          destino.mapa.get(
            clave
          );

        const ventasProductoOrigen =
          mapaVentasOrigen.get(
            clave
          ) || {
            cantidadVendida: 0,
          };

        const ventasProductoDestino =
          mapaVentasDestino.get(
            clave
          ) || {
            cantidadVendida: 0,
          };

        const cantidadVendidaOrigen =
          convertirNumero(
            ventasProductoOrigen
              .cantidadVendida
          );

        const cantidadVendidaDestino =
          convertirNumero(
            ventasProductoDestino
              .cantidadVendida
          );

        const existenciaOrigen =
          convertirNumero(
            productoOrigen
              .existencia
          );

        const datoOrigenSospechoso =
          existenciaOrigen < 0 ||
          existenciaOrigen >
            EXISTENCIA_MAXIMA_CONFIABLE;

        if (
          datoOrigenSospechoso ||
          existenciaOrigen <= 0 ||
          cantidadVendidaDestino <= 0
        ) {
          continue;
        }

        if (!productoDestino) {
          const clavePendiente =
            `${clave}-${origen.branch_id}-${destino.branch_id}`;

          if (
            pendientesUnicos.has(
              clavePendiente
            )
          ) {
            continue;
          }

          pendientesUnicos.add(
            clavePendiente
          );

          const fechaInicioTexto =
            periodoComparable.fechaInicio
              .toISOString()
              .slice(0, 10);

          const fechaFinTexto =
            periodoComparable.fechaFin
              .toISOString()
              .slice(0, 10);

          pendientesValidacion.push(
            crearPendienteExistenciaDestino({
              productId:
                productoOrigen.codigo ||
                clave,

              codigo:
                productoOrigen.codigo,

              producto:
                productoOrigen.descripcion,

              branchOrigenId:
                origen.branch_id,

              sucursalOrigen:
                obtenerNombreSucursal(
                  sucursales,
                  origen.branch_id
                ),

              branchDestinoId:
                destino.branch_id,

              sucursalDestino:
                obtenerNombreSucursal(
                  sucursales,
                  destino.branch_id
                ),

              existenciaOrigen,

              fechaExistenciaOrigen:
                obtenerFechaCorteExistencia(origen),

              fechaExistenciaDestino:
                obtenerFechaCorteExistencia(destino),

              ventasOrigen:
                cantidadVendidaOrigen,

              ventasDestino:
                cantidadVendidaDestino,

              periodoInicio:
                periodoComparable
                  .fechaInicio
                  .toISOString(),

              periodoFin:
                periodoComparable
                  .fechaFin
                  .toISOString(),

              diasAnalizados:
                periodoComparable
                  .diasAnalizados,

              motivo:
                `El reporte de existencias de ${obtenerNombreSucursal(sucursales, destino.branch_id)} no muestra este código. En el periodo ${fechaInicioTexto} al ${fechaFinTexto}, esa sucursal vendió ${cantidadVendidaDestino} piezas; ${obtenerNombreSucursal(sucursales, origen.branch_id)} reporta ${existenciaOrigen} piezas. La existencia destino está pendiente: MONYS no la toma como cero ni calcula piezas por traspasar.`,

              recomendacion:
                `Verificar existencia física y registro SICAR en ${obtenerNombreSucursal(sucursales, destino.branch_id)}.`,
            })
          );

          continue;
        }

        const existenciaDestino =
          convertirNumero(
            productoDestino
              .existencia
          );

        const datoDestinoSospechoso =
          existenciaDestino < 0 ||
          existenciaDestino >
            EXISTENCIA_MAXIMA_CONFIABLE;

        if (
          datoOrigenSospechoso ||
          datoDestinoSospechoso
        ) {
          continue;
        }

        /*
          Una sucursal destino debe
          haber vendido el producto.
        */
        if (
          cantidadVendidaDestino <= 0
        ) {
          continue;
        }

        const coberturaOrigen =
          calcularCoberturaDias({
            existencia:
              existenciaOrigen,

            cantidadVendida:
              cantidadVendidaOrigen,

            diasAnalizados:
              periodoComparable
                .diasAnalizados,
          });

        const coberturaDestino =
          calcularCoberturaDias({
            existencia:
              existenciaDestino,

            cantidadVendida:
              cantidadVendidaDestino,

            diasAnalizados:
              periodoComparable
                .diasAnalizados,
          });

        const plan =
          calcularPlanTransferencia({
            existenciaOrigen,
            existenciaDestino,

            ventasOrigen:
              cantidadVendidaOrigen,

            ventasDestino:
              cantidadVendidaDestino,

            diasAnalizados:
              periodoComparable
                .diasAnalizados,
          });

        /*
          Aquí está la protección clave:

          si el origen también necesita
          su inventario, plan será null
          y NO habrá recomendación.
        */
        if (!plan) {
          continue;
        }

        const {
          cantidadSugerida,
          objetivoOrigen,
          objetivoDestino,
          reservaMinimaOrigen,
          excedenteOrigen,
          necesidadDestino,
          ventaDiariaOrigen,
          ventaDiariaDestino,
        } = plan;

        const periodoInicioTexto =
          periodoComparable.fechaInicio
            .toISOString()
            .slice(0, 10);

        const periodoFinTexto =
          periodoComparable.fechaFin
            .toISOString()
            .slice(0, 10);

        const fechaExistenciaOrigen =
          obtenerFechaCorteExistencia(origen);

        const fechaExistenciaDestino =
          obtenerFechaCorteExistencia(destino);

        const claveRecomendacion =
          `${clave}-${origen.branch_id}-${destino.branch_id}`;

        if (
          recomendacionesUnicas.has(
            claveRecomendacion
          )
        ) {
          continue;
        }

        recomendacionesUnicas.add(
          claveRecomendacion
        );

        const sucursalOrigen =
          obtenerNombreSucursal(
            sucursales,
            origen.branch_id
          );

        const sucursalDestino =
          obtenerNombreSucursal(
            sucursales,
            destino.branch_id
          );

        const prioridad =
          calcularPrioridad({
            existenciaDestino,

            ventasDestino:
              cantidadVendidaDestino,

            coberturaDestino,

            cantidadSugerida,
          });

        recomendaciones.push({
          productId:
            productoOrigen.codigo ||
            clave,

          codigo:
            productoOrigen.codigo,

          producto:
            productoOrigen
              .descripcion,

          branchOrigenId:
            origen.branch_id,

          sucursalOrigen,

          branchDestinoId:
            destino.branch_id,

          sucursalDestino,

          existenciaOrigen,
          existenciaDestino,

          fechaExistenciaOrigen,
          fechaExistenciaDestino,

          ventasOrigen:
            cantidadVendidaOrigen,

          ventasDestino:
            cantidadVendidaDestino,

          ventaDiariaOrigen,
          ventaDiariaDestino,

          coberturaOrigen,
          coberturaDestino,

          /*
            El reporte agregado no
            permite conocer la última
            venta individual.
          */
          diasSinVentaOrigen: null,
          diasSinVentaDestino: null,

          periodoInicio:
            periodoComparable
              .fechaInicio
              .toISOString(),

          periodoFin:
            periodoComparable
              .fechaFin
              .toISOString(),

          diasAnalizados:
            periodoComparable
              .diasAnalizados,

          diasObjetivoDestino:
            DIAS_OBJETIVO_DESTINO,

          diasReservaOrigen:
            DIAS_RESERVA_ORIGEN,

          objetivoOrigen,
          objetivoDestino,

          reservaMinimaOrigen,

          excedenteOrigen,
          necesidadDestino,

          sobreinventarioOrigen:
            excedenteOrigen > 0,

          cantidadSugerida,

          existenciaOrigenTrasPropuesta:
            existenciaOrigen -
            cantidadSugerida,

          existenciaDestinoTrasPropuesta:
            existenciaDestino +
            cantidadSugerida,

          periodoEvidencia:
            `${periodoInicioTexto}–${periodoFinTexto}`,

          prioridad,

          motivo:
            `Ventas SICAR ${periodoInicioTexto}–${periodoFinTexto}: ${sucursalDestino} vendió ${cantidadVendidaDestino} piezas y ${sucursalOrigen} ${cantidadVendidaOrigen}. Existencias SICAR (${fechaExistenciaDestino || "fecha pendiente"}): ${sucursalDestino} ${existenciaDestino}, ${sucursalOrigen} ${existenciaOrigen} (${fechaExistenciaOrigen || "fecha pendiente"}). La propuesta busca hasta ${DIAS_OBJETIVO_DESTINO} días estimados en destino y deja ${existenciaOrigen - cantidadSugerida} piezas en origen; la reserva mínima es el mayor entre ${DIAS_RESERVA_ORIGEN} días de venta, 40% del stock o ${RESERVA_MINIMA_PIEZAS} piezas.`,

          recomendacion:
            `Verificar si conviene enviar ${cantidadSugerida} piezas de ${sucursalOrigen} a ${sucursalDestino}.`,
        });
      }
    }
  }

  recomendaciones.sort(
    (a, b) => {
      const pesos = {
        ALTA: 3,
        MEDIA: 2,
        BAJA: 1,
      };

      const diferenciaPrioridad =
        pesos[b.prioridad] -
        pesos[a.prioridad];

      if (
        diferenciaPrioridad !== 0
      ) {
        return diferenciaPrioridad;
      }

      const diferenciaCobertura =
        (
          a.coberturaDestino ??
          Number.POSITIVE_INFINITY
        ) -
        (
          b.coberturaDestino ??
          Number.POSITIVE_INFINITY
        );

      if (
        Number.isFinite(
          diferenciaCobertura
        ) &&
        diferenciaCobertura !== 0
      ) {
        return diferenciaCobertura;
      }

      return (
        b.cantidadSugerida -
        a.cantidadSugerida
      );
    }
  );

  pendientesValidacion.sort(
    (a, b) =>
      b.ventasDestino -
      a.ventasDestino
  );

  return {
    recomendaciones,
    pendientesValidacion,
  };
}

export async function generarRecomendacionesRebalanceo(businessId = null) {
  const analisis =
    await generarAnalisisRebalanceo(businessId);

  return analisis.recomendaciones;
}
