import { supabase } from "../../../supabase";

import {
  guardarMovimientosTesoreriaMasivos,
} from "../../tesoreria/services/tesoreriaService";

export async function guardarImportacion({
  tipoReporte,
  archivoOriginal,
  datosNormalizados,
}) {
  const {
    data: importacion,
    error: errorImportacion,
  } = await supabase
    .from("importaciones")
    .insert({
      tipo_reporte: tipoReporte,
      archivo_original: archivoOriginal,
      estado: "procesado",
      total_filas: datosNormalizados.length,
    })
    .select()
    .single();

  if (errorImportacion) {
    throw new Error(
      `No se pudo crear la importación: ${errorImportacion.message}`
    );
  }

  const detalles = datosNormalizados.map(
    (fila, indice) => ({
      importacion_id: importacion.id,
      numero_fila: indice + 1,
      codigo: fila.codigo,
      descripcion: fila.descripcion,
      categoria: fila.categoria,
      cantidad: fila.cantidad,
      datos_originales: fila,
    })
  );

  console.log(detalles[0]);

  const { error: errorDetalles } = await supabase
    .from("importacion_detalle")
    .insert(detalles);

  if (errorDetalles) {
    throw new Error(
      `No se pudieron guardar los detalles: ${errorDetalles.message}`
    );
  }

  await guardarDatosPorTipoReporte({
    tipoReporte,
    datosNormalizados,
    importacionId: importacion.id,
  });

  return importacion;
}

async function guardarDatosPorTipoReporte({
  tipoReporte,
  datosNormalizados,
  importacionId,
}) {
  switch (tipoReporte) {
   
    case "Ventas por artículo": {
  console.log(
    "Guardando ventas por artículo...",
    datosNormalizados.length
  );

  const registros = datosNormalizados.map(
    (articulo) => ({
      importacion_id: importacionId,

      codigo: articulo.codigo || null,

      descripcion: articulo.descripcion,

      categoria: articulo.categoria || null,

      cantidad: articulo.cantidad || 0,

      costo: articulo.costo || 0,

      importe: articulo.importe || 0,

      descuento: articulo.descuento || 0,

      utilidad: articulo.utilidad || 0,

      sucursal: articulo.sucursal || null,

      fecha: articulo.fecha || null,

      folio_venta:
        articulo.folioVenta || null,
    })
  );

  const { error } = await supabase
    .from("ventas_articulos")
    .insert(registros);

  if (error) {
    throw new Error(
      `Error al guardar ventas: ${error.message}`
    );
  }

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
    datosNormalizados
  );

  break;
}

   
    case "Créditos de proveedores": {
      console.log(
        "Guardando créditos de proveedores...",
        datosNormalizados.length
      );

      const registros = datosNormalizados.map(
        (proveedor) => ({
          importacion_id: importacionId,

          numero_proveedor:
            proveedor.numeroProveedor || null,

          nombre: proveedor.nombre,

          telefono: proveedor.telefono || null,

          celular: proveedor.celular || null,

          saldo: proveedor.saldo || 0,
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