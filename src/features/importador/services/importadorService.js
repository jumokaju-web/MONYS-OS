import { supabase } from "../../../supabase";

import {
  guardarMovimientosTesoreriaMasivos,
} from "../../tesoreria/services/tesoreriaService";

export async function guardarImportacion({
  tipoReporte,
  archivoOriginal,
  datosNormalizados,
  branchId,
}) {
  if (!Array.isArray(datosNormalizados) || datosNormalizados.length === 0) {
    throw new Error("No se puede importar un reporte SICAR sin filas de datos válidas.");
  }

  const reportesPorSucursal = new Set([
    "Ventas por artículo",
    "Utilidad por artículos",
    "Utilidad de ventas",
    "Inventario",
    "Inventario / Utilidad",
    "Existencias",
    "Movimientos de caja",
  ]);

  if (reportesPorSucursal.has(tipoReporte) && !branchId) {
    throw new Error(`Selecciona una sucursal para importar el reporte de ${tipoReporte}.`);
  }

  const {
    data: importacion,
    error: errorImportacion,
  } = await supabase
    .from("importaciones")
    .insert({
      tipo_reporte: tipoReporte,
      archivo_original: archivoOriginal,
      estado: "procesando",
      total_filas: datosNormalizados.length,
      branch_id: branchId || null,
    })
    .select()
    .single();

  if (errorImportacion) {
    throw new Error(
      `No se pudo crear la importación: ${errorImportacion.message}`
    );
  }

  try {
    const detalles = datosNormalizados.map((fila, indice) => ({
      importacion_id: importacion.id,
      numero_fila: indice + 1,
      codigo: fila.codigo,
      descripcion: fila.descripcion,
      categoria: fila.categoria,
      cantidad: fila.cantidad,
      datos_originales: fila,
    }));

    await insertarEnLotes(
      "importacion_detalle",
      detalles,
      "No se pudieron guardar los detalles"
    );

    const {
      count: filasGuardadas,
      error: errorConteo,
    } = await supabase
      .from("importacion_detalle")
      .select("id", { count: "exact", head: true })
      .eq("importacion_id", importacion.id);

    if (errorConteo) {
      throw new Error(
        `No se pudo verificar cuántas filas quedaron guardadas: ${errorConteo.message}`
      );
    }

    if (filasGuardadas !== datosNormalizados.length) {
      throw new Error(
        `Importación incompleta: SICAR entregó ${datosNormalizados.length} filas y MONYS guardó ${filasGuardadas ?? 0}.`
      );
    }

    await guardarDatosPorTipoReporte({
      tipoReporte,
      datosNormalizados,
      importacionId: importacion.id,
      branchId,
    });

    const {
      data: importacionProcesada,
      error: errorEstado,
    } = await supabase
      .from("importaciones")
      .update({ estado: "procesado" })
      .eq("id", importacion.id)
      .select()
      .single();

    if (errorEstado) {
      throw new Error(
        `Los datos se guardaron, pero no se pudo confirmar la importación: ${errorEstado.message}`
      );
    }

    return importacionProcesada;
  } catch (error) {
    const { error: errorMarcar } = await supabase
      .from("importaciones")
      .update({ estado: "error" })
      .eq("id", importacion.id);

    if (errorMarcar) {
      console.error(
        "No se pudo marcar como fallida la importación incompleta:",
        errorMarcar
      );
    }

    throw error;
  }
}

async function insertarEnLotes(tabla, registros, mensajeError) {
  const tamanoLote = 500;

  for (let inicio = 0; inicio < registros.length; inicio += tamanoLote) {
    const lote = registros.slice(inicio, inicio + tamanoLote);
    const { error } = await supabase.from(tabla).insert(lote);

    if (error) {
      const loteActual = Math.floor(inicio / tamanoLote) + 1;
      const totalLotes = Math.ceil(registros.length / tamanoLote);
      throw new Error(
        `${mensajeError} (lote ${loteActual} de ${totalLotes}): ${error.message}`
      );
    }
  }
}

async function guardarDatosPorTipoReporte({
  tipoReporte,
  datosNormalizados,
  importacionId,
  branchId,
}) {
  switch (tipoReporte) {
    case "Ventas por artículo":
    case "Utilidad por artículos": {
      console.log(
        "Guardando ventas por artículo...",
        datosNormalizados.length
      );

      const registros =
        datosNormalizados.map(
          (articulo) => ({
            importacion_id:
              importacionId,

            codigo:
              articulo.codigo || null,

            descripcion:
              articulo.descripcion,

            categoria:
              articulo.categoria || null,

            cantidad:
              articulo.cantidad || 0,

            costo:
              articulo.costo || 0,

            importe:
              articulo.importe || 0,

            descuento:
              articulo.descuento || 0,

            utilidad:
              articulo.utilidad || 0,

            sucursal:
              articulo.sucursal || null,

            fecha:
              articulo.fecha || null,

            folio_venta:
              articulo.folioVenta || null,
          })
        );

      await insertarEnLotes(
        "ventas_articulos",
        registros,
        "Error al guardar ventas"
      );

      break;
    }

    case "Inventario":
      console.log(
        "Guardando inventario...",
        datosNormalizados.length
      );
      break;

    case "Inventario / Utilidad":
      console.log(
        "Guardando utilidad de inventario...",
        datosNormalizados.length
      );
      break;

    case "Existencias":
      console.log(
        "Guardando existencias...",
        datosNormalizados.length
      );
      break;

    case "Utilidad de ventas":
      console.log(
        "Guardando utilidad de ventas...",
        datosNormalizados.length
      );
      break;

    case "Movimientos de caja": {
      console.log(
        "Guardando movimientos de caja...",
        datosNormalizados.length
      );

      await guardarMovimientosTesoreriaMasivos(
        datosNormalizados,
        {
          branchId:
            branchId || null,
          importacionId,
        }
      );

      break;
    }

    case "Créditos de proveedores": {
      console.log(
        "Guardando créditos de proveedores...",
        datosNormalizados.length
      );

      const registros =
        datosNormalizados.map(
          (proveedor) => ({
            importacion_id:
              importacionId,

            numero_proveedor:
              proveedor.numeroProveedor ||
              null,

            nombre:
              proveedor.nombre,

            telefono:
              proveedor.telefono || null,

            celular:
              proveedor.celular || null,

            saldo:
              proveedor.saldo || 0,
          })
        );

      const { error } = await supabase
        .from("creditos_proveedores")
        .insert(registros);

      if (error) {
        throw new Error(
          `Error al guardar créditos: ${error.message}`
        );
      }

      break;
    }

    default:
      console.log(
        "Reporte sin manejador:",
        tipoReporte
      );
  }
}