# Revisión compartida de cortes diarios

## Alcance

Agrega una bitácora independiente de `cierres_turno`. Conserva el corte original y sus importes. Solo una cuenta activa `owner` del mismo negocio y organización puede registrar y consultar revisiones. No cambia permisos de empleadas ni datos de flotilla.

Estados: En aclaración y Revisado por propietaria. Revisado exige comprobar SICAR, cobros y movimientos; exige explicación y referencia de evidencia. No equivale a cierre contable, conciliación bancaria ni descuento a una empleada.

## Activación pendiente

1. Verificar en la base real los tipos y relaciones existentes: `cierres_turno.id` UUID, `branch_id`, `observaciones`; `branches.business_id`; `businesses.organization_id`; `usuarios.auth_user_id`, `active`, `role`, `nombre`, `organization_id`, `business_id`.
2. Con autorización inmediata, ejecutar `supabase/migrations/20261015010000_revision_cortes_diarios.sql`. Crea una tabla con RLS y dos funciones; no modifica cortes existentes. No ejecutarla dos veces: si ya existe, revisar el estado antes de repetir.
3. Probar dos sesiones de propietaria, una vendedora y una cuenta de otra organización. Revisar un corte, consultar desde otro equipo y verificar conflicto de versión al guardar una revisión antigua. Editar un corte de prueba y comprobar que invalida su revisión.
4. Verificar pantalla en computadora y celular antes de publicar el código. Confirmar autorización inmediata para fusión/publicación.

Si falta la migración, la interfaz muestra que la revisión compartida no está activada. No muestra un guardado ficticio ni marca capturas como revisadas. Los cortes originales siguen visibles.

La actualización entre dispositivos se consulta con Actualizar; no existe suscripción en tiempo real. La bandeja recibe 100 registros recientes y el historial muestra las últimas 50 revisiones de un corte. Los importes históricos se conservan aun si se marca revisado.

## Validación realizada

- 301 pruebas unitarias aprobadas y compilación aprobada.
- Lint sin advertencias en los archivos financieros modificados; existen advertencias previas en el repositorio.
- Migración ejecutada en PostgreSQL aislado mediante PGlite con esquema mínimo de prueba: RLS entre organizaciones y roles; rechazo de escritura directa, revisión desactualizada y versión anterior; exigencia de comprobaciones; conservación de eventos anteriores.
- Interacción del formulario comprobada con React y DOM de prueba: apertura, validación, comprobaciones y confirmación de guardado.
- Vista previa de escritorio inspeccionada con sesión real: bandeja sin capturas de formato nuevo en la consulta actual; no se crearon datos de prueba en producción.
- Pendientes: validación del esquema real, migración en producción, comprobación visual móvil y de cortes con datos, y prueba entre dispositivos reales. La base aislada no demuestra que la migración ya esté aplicada en Supabase.
