import { supabase } from "../../../supabase";

function calcularFechaVencimientoEstimada(
  fechaBase,
  diasCredito
) {
  if (
    !fechaBase ||
    !diasCredito ||
    Number(diasCredito) <= 0
  ) {
    return null;
  }

  const fecha =
    new Date(fechaBase);

  if (
    Number.isNaN(
      fecha.getTime()
    )
  ) {
    return null;
  }

  fecha.setDate(
    fecha.getDate() +
      Number(diasCredito)
  );

  return fecha
    .toISOString()
    .slice(0, 10);
}

export async function obtenerCreditosProveedoresActuales(
  branchId
) {
  if (!branchId) {
    return {
      importacion: null,
      creditos: [],
      saldoTotal: 0,
    };
  }

  const {
    data: importacion,
    error: errorImportacion,
  } = await supabase
    .from("importaciones")
    .select(
      "id, branch_id, archivo_original, created_at"
    )
    .eq(
      "tipo_reporte",
      "Créditos de proveedores"
    )
    .eq(
      "branch_id",
      branchId
    )
    .order(
      "created_at",
      {
        ascending: false,
      }
    )
    .limit(1)
    .maybeSingle();

  if (errorImportacion) {
    throw new Error(
      `No se pudo obtener la última importación de créditos: ${errorImportacion.message}`
    );
  }

  if (!importacion) {
    return {
      importacion: null,
      creditos: [],
      saldoTotal: 0,
    };
  }

  const {
    data: creditos,
    error: errorCreditos,
  } = await supabase
    .from("creditos_proveedores")
    .select(
      "id, numero_proveedor, nombre, telefono, celular, saldo, fecha_vencimiento, dias_credito"
    )
    .eq(
      "importacion_id",
      importacion.id
    )
    .order(
      "saldo",
      {
        ascending: false,
      }
    );

  if (errorCreditos) {
    throw new Error(
      `No se pudieron obtener los créditos de proveedores: ${errorCreditos.message}`
    );
  }

  const listaBase =
    Array.isArray(creditos)
      ? creditos
      : [];

  const lista =
    listaBase.map(
      (credito) => {
        const fechaVencimientoReal =
          credito?.fecha_vencimiento ||
          null;

        const fechaVencimientoEstimada =
          fechaVencimientoReal ||
          calcularFechaVencimientoEstimada(
            importacion.created_at,
            credito?.dias_credito
          );

        return {
          ...credito,

          fecha_vencimiento_estimada:
            fechaVencimientoEstimada,
        };
      }
    );

  const saldoTotal =
    lista.reduce(
      (
        total,
        credito
      ) =>
        total +
        (
          Number(
            credito?.saldo
          ) || 0
        ),
      0
    );

  return {
    importacion,
    creditos: lista,
    saldoTotal,
  };
}