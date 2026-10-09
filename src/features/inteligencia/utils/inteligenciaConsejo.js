const nivel = p => ({ CRITICA:0, ALTA:1, MEDIA:2, NORMAL:3, BAJA:4 })[String(p || '').toUpperCase()] ?? 3;
export function construirInteligenciaConsejo({ datosDashboard = {}, financiero = {}, comercial = {}, inventario = {}, marketing = {}, rh = {}, ahora = Date.now() } = {}) {
  const metricas = datosDashboard.metricas || {};
  const fecha = metricas.fechaFinal;
  const timestamp = /^\d{4}-\d{2}-\d{2}/.test(String(fecha || '')) ? Date.parse(String(fecha).slice(0,10)+'T12:00:00Z') : NaN;
  const edad = Number.isFinite(timestamp) ? (ahora-timestamp)/86400000 : null;
  const vigente = edad !== null && edad >= -1 && edad <= 7;
  const hayVentas = Array.isArray(datosDashboard.inteligencia?.comercial?.ventas) && datosDashboard.inteligencia.comercial.ventas.length > 0;
  const hayInventario = Array.isArray(datosDashboard.inventario?.detalles) && datosDashboard.inventario.detalles.length > 0;
  const propuestas = [];
  if (!vigente) propuestas.push({id:'actualizar-base',director:'comercial',titulo:'Actualizar el corte antes de decidir',descripcion:'Carga ventas e inventario recientes de la sucursal. El corte antiguo se conserva como historial.',prioridad:'CRITICA',fuente:'Fechas del corte SICAR',cruce:'Todos los directores dependen de la vigencia de esta base.'});
  if (vigente && hayVentas && hayInventario) {
    for (const [director,analisis,fuente] of [['comercial',comercial,'Ventas SICAR e inventario de la sucursal'],['marketing',marketing,'Cruce de ventas, inventario y análisis financiero']]) {
      (Array.isArray(analisis.accionesPrioritarias) ? analisis.accionesPrioritarias : []).forEach((a,i) => {
        if (!a?.titulo || !a?.descripcion) return;
        propuestas.push({...a,id:`${director}-${i}`,director,fuente,cruce:director === 'marketing' ? 'Validar stock por tienda y autorización de presupuesto. La caja registrada no confirma liquidez conciliada.' : 'Validar margen, disponibilidad y resultado de la acción.'});
      });
    }
    const cantidad = inventario.sobreinventario?.length || 0;
    if (cantidad) propuestas.push({id:'rotacion-stock',director:'inventario',titulo:'Revisar rotación antes de comprar más',descripcion:`El análisis de inventario marca ${cantidad} productos con sobreinventario. Revisa sus candidatos en Inventario.`,prioridad:'ALTA',fuente:'Inventario y ventas SICAR de la sucursal',cruce:'Inventario propone rotación; Marketing revisa campaña; Finanzas valida capacidad de gasto.'});
  }
  if (Number(financiero.movimientosPendientes) > 0) propuestas.push({id:'clasificar-caja',director:'financiero',titulo:'Resolver movimientos financieros pendientes',descripcion:`Hay ${financiero.movimientosPendientes} movimientos pendientes de clasificación en el análisis.`,prioridad:'ALTA',fuente:'Movimientos cargados en Tesorería',cruce:'Separar gasto, préstamo, retiro, inventario y traslado antes de calcular utilidad.'});
  const seen = new Set();
  const prioridades = propuestas.sort((a,b) => nivel(a.prioridad)-nivel(b.prioridad)).filter(a => { const key=a.titulo.trim().toLowerCase();if(seen.has(key))return false;seen.add(key);return true; }).slice(0,5);
  return {vigente,fecha:fecha instanceof Date ? (Number.isNaN(fecha.getTime()) ? null : fecha.toLocaleDateString('es-MX')) : (fecha || null),prioridades,fuentes:[{nombre:'Ventas SICAR',disponible:hayVentas},{nombre:'Inventario SICAR',disponible:hayInventario},{nombre:'Corte reciente',disponible:vigente}],cruces:[{titulo:'Compras ↔ Caja',detalle:'Las sugerencias de compra requieren presupuesto y compromisos revisados. No equivalen a una orden autorizada.'},{titulo:'Campañas ↔ Stock ↔ Ventas',detalle:hayVentas && hayInventario && vigente ? 'Los motores de Marketing reciben ventas e inventario del corte. Abre cada propuesta para revisar productos y presupuesto.' : 'Faltan ventas, inventario o vigencia para una propuesta comercial basada en el corte.'},{titulo:'Equipo ↔ Finanzas',detalle:rh.conexionCompleta ? 'Revisar el análisis de RH y sus fuentes antes de decidir.' : 'Nómina, incidencias y capacitación todavía no están completamente conectadas. No se calcula productividad con esas ausencias.'}]};
}
