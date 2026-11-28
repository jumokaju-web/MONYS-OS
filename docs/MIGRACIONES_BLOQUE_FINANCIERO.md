# Migraciones del bloque financiero: comprobaciones y procedimiento

Ninguna migración se aplica sin autorización expresa de la propietaria. Cada una se aplica **primero en staging** y después en producción, siempre en este orden:

| Orden | Migración | PR | Requiere |
|---|---|---|---|
| 1 | `20261128010000_categorias_deuda_impuestos_marketplace` | #167 | Funciones de Tesorería en su versión revisada (huella md5) |
| 2 | `20261128020000_canales_marketplace` | #170 | Vault para credenciales |
| 3 | `20261128030000_calendario_operativo_sucursales` | #172 | — |
| 4 | `20261128040000_conciliacion_plataformas_tesoreria` | #173 | La migración 2 |

## Procedimiento por migración

1. **Respaldo:** hacer un respaldo o punto de restauración del proyecto.
2. **Comprobación previa:** ejecutar `supabase/verificaciones/<migración>_previa.sql` en el editor SQL. Es de solo lectura (`begin transaction read only … rollback`).
   - Todas las filas deben decir **OK**.
   - **AVISO:** revisar con Claude antes de seguir.
   - **FALLA:** no aplicar.
   - **INFO:** anotar el valor para comparar después.
3. **Aplicar** la migración.
4. **Comprobación posterior:** ejecutar `supabase/verificaciones/<migración>_posterior.sql`. Todas las filas deben decir **OK**, y los valores INFO deben coincidir con los de la previa.
5. **Registrar** en el PR la fecha, el ambiente y el resultado de las dos comprobaciones.

Las cuatro se probaron así, en secuencia, en Postgres 16 local con los privilegios por defecto de Supabase. Además, la comprobación posterior del calendario **detecta** la versión anterior vulnerable (TRUNCATE por anon y authenticated).

## Reversión (solo si la comprobación posterior falla)

| Migración | Cómo revertir |
|---|---|
| 1 | Restaurar las dos funciones de Tesorería desde su migración anterior en `main`. Quitar el CHECK `cash_movement_group_reviews_no_aplica_check` y la función `categoria_tesoreria_sin_impacto`. No borra ni cambia movimientos. |
| 2 | `drop` de las tablas `canal_*` y `producto_vinculos`, de sus funciones y de los secretos en Vault con prefijo `canal_`. Antes de activar conexiones no hay datos que perder. |
| 3 | `drop` de `sucursal_calendario`, `sucursal_vigencias`, su auditoría y las funciones `private.validar_calendario_sucursal` y `private.auditar_calendario_sucursal`. |
| 4 | `drop` de `cash_movement_platform_links`, su auditoría y sus funciones. No toca `cash_movements`. |

## Matriz de permisos por rol

Los roles se resuelven con `private.has_org_role(organization_id, roles)`.

| Tabla o función | owner / director / admin | finanzas | encargada | anon |
|---|---|---|---|---|
| `canal_*` (datos sincronizados) | leer | leer | — | — |
| `producto_vinculos` | leer, confirmar, corregir | leer | — | — |
| Funciones de turno, lote y credenciales | — (solo `service_role`) | — | — | — |
| `sucursal_vigencias`, `sucursal_calendario` | leer, escribir, confirmar | leer | leer | — |
| Auditoría del calendario | leer | — | — | — |
| `cash_movement_platform_links` | leer, proponer, **verificar, anular** | leer, proponer | — | — |
| Auditoría de vínculos | leer | — | — | — |

En todas las tablas nuevas:

- Se revocan los privilegios por defecto de Supabase (incluido `TRUNCATE`, que ignora RLS).
- Nadie puede `TRUNCATE`.
- La auditoría solo se lee.
- Los vínculos verificados no se editan: se anulan y se crea otro.

Las funciones `SECURITY DEFINER` fijan `search_path`.

## Riesgos conocidos (fuera de estas migraciones)

- **Multiempresa:** `productos` (costos SICAR) no tiene `organization_id`, y su RLS depende solo del rol en `usuarios`. Mientras haya una sola organización (Monys Glam) no hay fuga. Antes de vender el sistema a otra empresa, hay que separar los productos por organización y negocio.
- **Rol `encargada`:** solo lee el calendario. Si se quiere que capture los cierres de su propia sucursal, hace falta una política por alcance (`private.monys_puede_acceder_alcance_operativo`). Es una decisión pendiente de la propietaria.
