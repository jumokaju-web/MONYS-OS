# MONYS OS — Coordinación de agentes

## Responsabilidades
- Claude: motor financiero, impacto monetario, rescate comercial, arquitectura multiempresa y aislamiento de datos.
- ChatGPT/Codex: pantallas, experiencia móvil, cortes, tareas de personal y marketing operativo de Kary. Consumir contratos financieros existentes; no duplicar cálculos.
- Ambos: revisión cruzada. La propietaria decide cada integración y publicación.

## Protocolo obligatorio
1. Leer este archivo, actualizar main y revisar PR abiertos antes de editar. Declarar alcance, archivos previstos y dependencias en issue o PR borrador. Si hay solapamiento, coordinar mediante comentario y esperar resolución; no sobrescribir trabajo ajeno.
2. Usar ramas separadas y PR pequeños. No hacer push directo a main, auto-merge, despliegue, migraciones productivas ni cambios de permisos sin autorización explícita. No modificar datos reales durante pruebas.
3. Cada PR debe indicar alcance, archivos, pruebas ejecutadas y fallidas, riesgos, dependencias, pasos de validación y siguiente tarea. Revisar cambios del otro agente cuando se solicite; dejar comentarios verificables. No afirmar aprobación o pruebas no realizadas.
4. Mantener contratos de datos compatibles; acordar cambios de interfaz antes de editar módulos compartidos. No exponer secretos, datos financieros reales, clientes ni empleados: este repositorio es público. Usar datos sintéticos.

## Reglas financieras y operativas
- Dato faltante no es cero; estimado no es real. Registrar fuente, periodo, sucursal, supuestos y estado de validación. No duplicar ingresos, costos, traspasos o demanda. Distinguir utilidad, ahorro y flujo de caja.
- Ningún gasto, compra, pago, campaña pagada o movimiento de dinero queda autorizado sin confirmación humana. No ejecutar acciones financieras.
- Comparar días y horarios equivalentes; excluir cierres de productividad, no de gastos devengados. No confundir días sin datos con cierre confirmado.
- Respetar roles y aislamiento entre negocios; no inventar tablas ni credenciales. Inspeccionar servicios existentes antes de cambiar contratos.

## Cola inicial (verificar estado antes de trabajar)
- Claude: PR #160 motor de impacto; #161 depende de #160 y toca compras y marketing. Revisar pruebas y dependencia xlsx; no integrar sin aprobación. Continuar conciliación, gastos, equilibrio, inventario y arquitectura multiempresa.
- ChatGPT/Codex: revisar #160 y #161; evitar editar sus archivos hasta resolver dependencia. Auditar cortes y tareas móviles; revisar PR #68 (comparación SICAR) y #39 (permisos) antes de duplicar funcionalidad. Después integrar UI de marketing con contratos aprobados.
- Ambos: validar flujos por rol, pruebas, lint y build; registrar bloqueos. Priorizar recuperación comercial y operación diaria antes de expansión.

## Entrega entre agentes
En cada PR o issue dejar: responsable, estado (pendiente/en curso/bloqueado/listo para revisión), rama, archivos, dependencia, evidencia, próximo paso. GitHub es el canal común; no se presume comunicación directa ni ejecución autónoma de otro agente. Actualizar este protocolo mediante PR cuando cambie el reparto.
