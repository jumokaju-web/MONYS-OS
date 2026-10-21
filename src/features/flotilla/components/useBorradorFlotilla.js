import { useEffect, useMemo, useSyncExternalStore } from 'react';
import { claveBorradorFlotilla, crearBorradorFlotilla } from '../utils/borradorFlotilla';

export function useBorradorFlotilla(contexto, inicial, advertirSalida = true) {
  const clave = claveBorradorFlotilla(contexto);
  const esquema = JSON.stringify(inicial);
  const borrador = useMemo(() => {
    let storage;
    try { storage = window.localStorage; } catch { /* Se informa al capturar. */ }
    return crearBorradorFlotilla(storage, clave, JSON.parse(esquema));
  }, [clave, esquema]);
  const estado = useSyncExternalStore(borrador.subscribe, borrador.getSnapshot);
  useEffect(() => {
    if (!estado.pendiente || !advertirSalida) return;
    const advertir = (evento) => { evento.preventDefault(); evento.returnValue = ''; };
    window.addEventListener('beforeunload', advertir);
    return () => window.removeEventListener('beforeunload', advertir);
  }, [estado.pendiente, advertirSalida]);
  return { ...estado, controlador: borrador };
}
