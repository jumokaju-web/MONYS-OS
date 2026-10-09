import { confirmarFilasCaja } from '../utils/confirmarFilasCaja';
import { guardarCargaConfirmada } from '../utils/guardarCargaConfirmada';
import { supabase } from "../../../supabase";
import { guardarMovimientosTesoreriaMasivos } from "../../tesoreria/services/tesoreriaService";
export async function guardarImportacion(carga) {
 if (!Array.isArray(carga.datosNormalizados) || !carga.datosNormalizados.length) throw new Error('No se puede importar sin filas válidas.');
 if (!carga.branchId) throw new Error('Selecciona una sucursal antes de importar.');
 if(carga.tipoReporte === 'Créditos de proveedores' && Array.isArray(carga.datosNormalizados) && carga.datosNormalizados.some(p=>p.saldo == null || !Number.isFinite(Number(p.saldo)) || Number(p.saldo)<0)) throw new Error('Hay saldos ausentes, inválidos o negativos. Revisa el reporte; no se creó una carga.');
 return guardarCargaConfirmada(carga, {
  async buscar(id) { const {data,error}=await supabase.from('importaciones').select('id,estado').eq('id',id).eq('branch_id',carga.branchId).maybeSingle();if(error)throw new Error(`No se pudo comprobar una carga anterior: ${error.message}`);return data; },
  async crear({id,estado}) { const {data,error}=await supabase.from('importaciones').insert({id,tipo_reporte:carga.tipoReporte,archivo_original:carga.archivoOriginal,estado,total_filas:carga.datosNormalizados.length,branch_id:carga.branchId}).select().single();if(error)throw new Error(error.message);return data; },
  async detalles(registro) { const detalles=carga.datosNormalizados.map((fila,indice)=>({importacion_id:registro.id,numero_fila:indice+1,codigo:fila.codigo,descripcion:fila.descripcion,categoria:fila.categoria,cantidad:fila.cantidad,datos_originales:fila}));await insertarEnLotes('importacion_detalle',detalles,'No se pudieron guardar los detalles');const {count,error}=await supabase.from('importacion_detalle').select('id',{count:'exact',head:true}).eq('importacion_id',registro.id);if(error)throw error;if(count!==detalles.length)throw new Error('El detalle de la importación quedó incompleto.'); },
  async destino(registro) { await guardarDatosPorTipoReporte({ ...carga,importacionId:registro.id }); },
  async confirmar(registro) { const {data,error}=await supabase.from('importaciones').update({estado:'procesado'}).eq('id',registro.id).eq('branch_id',carga.branchId).eq('estado','pendiente').select().single();if(error)throw new Error(error.message);return data; }
 });
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

      const filasGuardadas = await guardarMovimientosTesoreriaMasivos(
        datosNormalizados,
        {
          branchId:
            branchId || null,
          importacionId,
        }
      );
      confirmarFilasCaja(filasGuardadas, datosNormalizados.length);

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
              proveedor.saldo,
            fecha_vencimiento: proveedor.fechaVencimiento ?? null,
            dias_credito: proveedor.diasCredito ?? null,
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
      throw new Error(`Reporte sin manejador: ${tipoReporte}`);
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
