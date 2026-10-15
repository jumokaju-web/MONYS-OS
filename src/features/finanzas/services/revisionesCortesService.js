import { supabase } from '../../../supabase';
import { diagnosticarCorte } from '../utils/prioridadesCortes';
import { validarRevisionCorte } from '../utils/revisionCortes';
function errorRevision(error) {
  if (['PGRST202', 'PGRST205', '42P01', '42883'].includes(error?.code)) return new Error('La revisión compartida aún no está activada en la base de datos. Tus cortes originales siguen disponibles.');
  return new Error(error?.message || 'No fue posible consultar la revisión compartida.');
}
export async function obtenerRevisionesCortes(ids) {
  if (!ids.length) return [];
  const { data, error } = await supabase.rpc('obtener_revisiones_cortes_diarios', { p_cierre_ids: ids });
  if (error) throw errorRevision(error);
  return data || [];
}
export async function obtenerHistorialRevisionCorte(id) {
  const { data, error } = await supabase.from('revisiones_cortes_diarios').select('*').eq('cierre_id', id).order('version', { ascending: false }).limit(50);
  if (error) throw errorRevision(error);
  return data || [];
}
export async function guardarRevisionCorte(captura, revision, formulario) {
  if (formulario.estado === 'REVISADO' && diagnosticarCorte(captura).nivel === 'incompleto') throw new Error('Completa las diferencias de caja y venta antes de marcar revisado.');
  const validacion = validarRevisionCorte(formulario);
  if (validacion) throw new Error(validacion);
  const { data, error } = await supabase.rpc('registrar_revision_corte_diario', {
    p_cierre_id: captura.cierre.id, p_version: revision?.version || 0,
    p_observaciones: captura.cierre.observaciones,
    p_estado: formulario.estado, p_nota: formulario.nota.trim(), p_evidencia: formulario.evidencia.trim(),
    p_comprobaciones: formulario.comprobaciones,
  });
  if (error) throw errorRevision(error);
  if (!data?.id) throw new Error('No se pudo confirmar el guardado. Actualiza antes de reintentar.');
  return data;
}
