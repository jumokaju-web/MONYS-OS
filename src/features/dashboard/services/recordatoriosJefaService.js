import { supabase } from "../../../supabase";

const calcularDiasDesde = (
  fecha
) => {
  if (!fecha) {
    return Number.POSITIVE_INFINITY;
  }

  const fechaValor =
    new Date(fecha).getTime();

  if (
    Number.isNaN(fechaValor)
  ) {
    return Number.POSITIVE_INFINITY;
  }

  return Math.floor(
    (
      Date.now() -
      fechaValor
    ) /
      (
        1000 *
        60 *
        60 *
        24
      )
  );
};

export const obtenerRecordatoriosJefa =
  async () => {
    const [
      resultadoSucursales,
      resultadoImportaciones,
      resultadoSaldos,
    ] = await Promise.all([
      supabase
        .from("branches")
             .select("*"),

      supabase
        .from("importaciones")
        .select(`
          id,
          branch_id,
          tipo_reporte,
          estado,
          created_at
        `)
        .eq(
          "estado",
          "procesado"
        )
        .eq(
          "tipo_reporte",
          "Ventas por artículo"
        )
        .order(
          "created_at",
          {
            ascending: false,
          }
        ),

      supabase
        .from(
          "account_balance_snapshots"
        )
        .select(
          "captured_at"
        )
        .order(
          "captured_at",
          {
            ascending: false,
          }
        )
        .limit(1),
    ]);

    if (
      resultadoSucursales.error
    ) {
      throw new Error(
        `No fue posible revisar las sucursales: ${resultadoSucursales.error.message}`
      );
    }

    if (
      resultadoImportaciones.error
    ) {
      throw new Error(
        `No fue posible revisar las importaciones: ${resultadoImportaciones.error.message}`
      );
    }

    if (
      resultadoSaldos.error
    ) {
      throw new Error(
        `No fue posible revisar los saldos bancarios: ${resultadoSaldos.error.message}`
      );
    }

        const nombresOperativos =
      [
        "Centro",
        "General Anaya",
      ];

    const sucursales =
      (
        resultadoSucursales.data ||
        []
      ).filter(
        (sucursal) =>
          sucursal.active !==
            false &&
          nombresOperativos.includes(
            sucursal.name
          )
      );

    const importaciones =
      resultadoImportaciones.data ||
      [];

    const recordatorios = [];

    sucursales.forEach(
      (sucursal) => {
        const ultimaImportacion =
          importaciones.find(
            (importacion) =>
              importacion.branch_id ===
              sucursal.id
          );

        const diasSinImportar =
          calcularDiasDesde(
            ultimaImportacion?.created_at
          );

        if (
          diasSinImportar >= 7
        ) {
          recordatorios.push({
            id:
              `sicar-${sucursal.id}`,
            prioridad:
              "alta",
            tipo:
              "importador",
            titulo:
                           `Subir SICAR de ${
                sucursal.branch_name ||
                sucursal.name ||
                "sucursal"
              }`,
            detalle:
              ultimaImportacion
                ? `Han pasado ${diasSinImportar} días desde la última carga.`
                : "Esta sucursal todavía no tiene una carga de ventas.",
            boton:
              "Subir reporte",
          });
        }
      }
    );

    const ultimoSaldo =
      resultadoSaldos.data?.[0]
        ?.captured_at ||
      null;

    const diasSinActualizarBanco =
      calcularDiasDesde(
        ultimoSaldo
      );

    if (
      diasSinActualizarBanco >= 7
    ) {
      recordatorios.push({
        id: "actualizar-bancos",
        prioridad: "alta",
        tipo: "tesoreria",
        titulo:
          "Actualizar movimientos bancarios",
        detalle:
          ultimoSaldo
            ? `Han pasado ${diasSinActualizarBanco} días desde la última confirmación bancaria.`
            : "Todavía no existe un saldo bancario confirmado.",
        boton:
          "Ir a Tesorería",
      });
    }

    return {
      recordatorios,
      ultimaActualizacionBanco:
        ultimoSaldo,
    };
  };