import { supabase } from '../../supabase';
import { crearServicioValor } from './valorRepository';
export const { cargarCentroValor, crearIniciativaValor, registrarResultadoValor, revisarResultadoValor } = crearServicioValor(supabase);
