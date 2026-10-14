# Publicar Flotilla: accesos, gasolina, préstamos y prefacturas

## Orden obligatorio

1. En Supabase, abrir **SQL Editor** y ejecutar completos, uno por uno, estos archivos:
   1. `supabase/migrations/20261014023000_permisos_individuales_usuario.sql`
   2. `supabase/migrations/20261014031500_flotilla_gasolina_evidencia_prestamo.sql`
   3. `supabase/migrations/20261014033000_flotilla_accesos_socios.sql`
2. Confirmar que cada ejecución termine sin error antes de continuar.
3. Publicar el código de esta rama en MONYS OS.
4. Abrir MONYS con la cuenta de Mónica y entrar a **Flotilla → Accesos de Flotilla**.
5. Registrar `crjm86@gmail.com` como **Administrador de Flotilla**. La cuenta debe existir previamente dentro de Usuarios de MONYS.
6. Para Kary y Abraham, seleccionar **Socio: solo consultar** y marcar únicamente las unidades que cada uno puede ver.
7. Pedir a cada persona cerrar sesión y volver a entrar para que se actualice el permiso del módulo.

## Prueba mínima antes de usarlo

1. Un chofer registra una carga de gasolina.
2. Deben aparecer tres evidencias separadas: ticket, tablero antes y tablero después.
3. Mientras falte una foto o una aprobación, el importe debe aparecer como **Préstamo personal por gasolina** y no sumarse como gasolina.
4. Al aprobar las tres fotos, debe cambiar a **Gasolina aprobada** y cancelarse el préstamo automático sin duplicar el importe.
5. En Prefacturas, preparar un periodo y descargar Excel; después abrir **Guardar PDF**.

## Validación técnica realizada

- 258 pruebas automatizadas aprobadas.
- Compilación de producción aprobada.
- Reglas de lectura separadas para Administrador de Flotilla, socio y chofer.
- Los accesos de Flotilla no conceden acceso a Finanzas ni al resto de MONYS.

## Dato pendiente por confirmar

La tarifa de cobro empresarial de Rental Large permanece en `$1,221`, que era el valor ya configurado. El pago al chofer sí está en `$1,000`. No cambiar la tarifa empresarial hasta que Mónica confirme el cobro correcto.
