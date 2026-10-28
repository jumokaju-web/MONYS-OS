import { supabase } from '../../../supabase';

async function sesion() {
  const { data, error } = await supabase.auth.getUser();
  if (error || !data?.user) throw new Error('La sesión administrativa ya no está activa.');
  return data.user;
}

export async function obtenerConciliacionesBancarias(revisionBancariaId) {
  if (!revisionBancariaId) return [];
  const { data, error } = await supabase
    .from('conciliaciones_bancarias')
    .select('id,revision_bancaria_id,banco_movimiento_id,cash_movement_id,cuenta,fecha_banco,monto,direccion,estado,registrado_en,motivo_anulacion,anulado_en,snapshot')
    .eq('revision_bancaria_id', revisionBancariaId)
    .order('registrado_en', { ascending: false });
  if (error) throw new Error(`No fue posible consultar los vínculos bancarios: ${error.message}`);
  return data || [];
}

export async function obtenerConciliacionesBancariasPorMovimientos(cashMovementIds = []) {
  const ids = [...new Set((Array.isArray(cashMovementIds) ? cashMovementIds : []).filter(Boolean))];
  if (!ids.length) return [];
  const { data, error } = await supabase
    .from('conciliaciones_bancarias')
    .select('id,revision_bancaria_id,banco_movimiento_id,cash_movement_id,cuenta,fecha_banco,monto,direccion,estado,registrado_en,snapshot')
    .in('cash_movement_id', ids)
    .eq('estado', 'ACTIVA')
    .order('registrado_en', { ascending: false });
  if (error) throw new Error(`No fue posible consultar la evidencia bancaria vinculada a los cheques: ${error.message}`);
  return data || [];
}

export async function guardarConciliacionBancaria({ revisionBancariaId, banco, movimiento, proveedoresSugeridos = [] }) {
  if (!revisionBancariaId || !banco?.id || !movimiento?.id) throw new Error('Falta seleccionar el movimiento bancario y el registro de Tesorería.');
  const salida = Number(banco.cargo) > 0;
  const montoBanco = Number(salida ? banco.cargo : banco.abono);
  const montoCaja = Number(movimiento.monto ?? movimiento.amount);
  const tipoCaja = String(movimiento.tipo ?? movimiento.movement_type ?? '').toLowerCase();
  const fechaCaja = String(movimiento.fecha ?? movimiento.occurred_at ?? '').slice(0, 10);
  if (!Number.isFinite(montoBanco) || montoBanco <= 0 || Math.round(montoBanco * 100) !== Math.round(montoCaja * 100)) throw new Error('Los importes del banco y Tesorería no coinciden.');
  if (salida ? !['salida', 'egreso'].includes(tipoCaja) : !['entrada', 'ingreso'].includes(tipoCaja)) throw new Error('La dirección del movimiento no coincide.');
  if (![banco.fecha_operacion, banco.fecha_liquidacion].includes(fechaCaja)) throw new Error('La fecha de Tesorería no coincide con la fecha de operación o liquidación bancaria.');

  const usuario = await sesion();
  const { data: revision, error: errorRevision } = await supabase
    .from('revisiones_bancarias')
    .select('organization_id,business_id,branch_id,created_by')
    .eq('id', revisionBancariaId)
    .single();
  if (errorRevision || !revision || revision.created_by !== usuario.id) throw new Error('No puedes conciliar una revisión bancaria de otra sesión o contexto.');

  const { data, error } = await supabase
    .from('conciliaciones_bancarias')
    .insert({
      revision_bancaria_id: revisionBancariaId,
      organization_id: revision.organization_id,
      business_id: revision.business_id,
      branch_id: revision.branch_id,
      banco_movimiento_id: banco.id,
      cash_movement_id: movimiento.id,
      cuenta: banco.cuenta,
      fecha_banco: banco.fecha_operacion,
      monto: montoBanco,
      direccion: salida ? 'SALIDA' : 'ENTRADA',
      estado: 'ACTIVA',
      registrado_por: usuario.id,
      snapshot: {
        banco,
        movimiento,
        proveedores_sugeridos: (proveedoresSugeridos || []).map((proveedor) => ({
          id: proveedor.id || null,
          numeroProveedor: proveedor.numeroProveedor || null,
          nombre: proveedor.nombre || null,
          saldoReportado: proveedor.saldoReportado ?? null,
          evidencia: proveedor.evidencia || null,
        })),
        alcance: 'Vínculo banco–Tesorería. No registra un abono ni liquida el saldo del proveedor.',
      },
    })
    .select('id,revision_bancaria_id,banco_movimiento_id,cash_movement_id,cuenta,fecha_banco,monto,direccion,estado,registrado_en,snapshot')
    .single();
  if (error) throw new Error(error.message || 'No fue posible confirmar el vínculo bancario.');
  return data;
}

export async function anularConciliacionBancaria({ conciliacionId, motivo }) {
  if (!conciliacionId || !String(motivo || '').trim()) throw new Error('Escribe el motivo de la anulación.');
  const usuario = await sesion();
  const ahora = new Date().toISOString();
  const { data, error } = await supabase
    .from('conciliaciones_bancarias')
    .update({ estado: 'ANULADA', motivo_anulacion: String(motivo).trim(), anulado_por: usuario.id, anulado_en: ahora })
    .eq('id', conciliacionId)
    .eq('estado', 'ACTIVA')
    .select('id,estado,motivo_anulacion,anulado_en')
    .single();
  if (error) throw new Error(error.message || 'No fue posible anular el vínculo bancario.');
  return data;
}
