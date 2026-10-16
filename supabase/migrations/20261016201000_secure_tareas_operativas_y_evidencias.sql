-- La asignación de tareas y sus evidencias debe validarse en Postgres.
-- El navegador no es un límite de seguridad.

do $migration_preflight$
begin
  if exists (
    select 1
    from public.tareas_operativas tarea
    left join public.branches sucursal
      on sucursal.id = tarea.branch_id
    left join public.businesses negocio
      on negocio.id = sucursal.business_id
    where sucursal.id is null
      or negocio.id is null
      or (
        tarea.business_id is not null
        and tarea.business_id is distinct from sucursal.business_id
      )
      or (
        tarea.organization_id is not null
        and tarea.organization_id is distinct from negocio.organization_id
      )
  ) then
    raise exception 'Migración pausada: hay tareas con sucursal, negocio u organización que no coinciden. Corrige su alcance antes de cambiar permisos.';
  end if;

  -- Completa el alcance únicamente desde la relación sucursal → negocio →
  -- organización, después de comprobar que no hay relaciones contradictorias.
  update public.tareas_operativas tarea
  set
    business_id = sucursal.business_id,
    organization_id = negocio.organization_id
  from public.branches sucursal
  join public.businesses negocio
    on negocio.id = sucursal.business_id
  where tarea.branch_id = sucursal.id
    and (
      tarea.business_id is null
      or tarea.organization_id is null
    );

  if exists (
    select 1
    from public.tareas_operativas
    where organization_id is null
  ) then
    raise exception 'Migración pausada: hay tareas sin organización. Corrige su alcance antes de activar las nuevas políticas.';
  end if;
end;
$migration_preflight$;

alter table public.usuarios enable row level security;
alter table public.tareas_operativas enable row level security;
alter table public.tarea_evidencias enable row level security;

create or replace function private.monys_puede_acceder_alcance_operativo(
  p_organization_id uuid,
  p_business_id uuid,
  p_branch_id uuid,
  p_responsable_usuario_id uuid default null,
  p_solo_direccion boolean default false,
  p_permitir_reclamo boolean default false
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $function$
  select exists (
    select 1
    from public.usuarios actor
    where actor.auth_user_id = (select auth.uid())
      and actor.active is true
      and actor.organization_id = p_organization_id
      and (
        actor.role = 'owner'
        or (
          actor.role = 'admin'
          and actor.business_id is not distinct from p_business_id
          and actor.branch_id is not distinct from p_branch_id
        )
        or (
          p_solo_direccion is false
          and actor.role not in ('owner', 'admin')
          and actor.business_id is not distinct from p_business_id
          and actor.branch_id is not distinct from p_branch_id
          and (
            p_responsable_usuario_id = (select auth.uid())
            or (p_permitir_reclamo and p_responsable_usuario_id is null)
          )
        )
      )
  );
$function$;

create or replace function private.monys_asignacion_operativa_valida(
  p_organization_id uuid,
  p_business_id uuid,
  p_branch_id uuid,
  p_responsable_usuario_id uuid,
  p_solo_direccion boolean default false
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $function$
  select
    private.monys_puede_acceder_alcance_operativo(
      p_organization_id,
      p_business_id,
      p_branch_id,
      p_responsable_usuario_id,
      p_solo_direccion
    )
    and (
      p_responsable_usuario_id is null
      or exists (
      select 1
      from public.usuarios asignado
      where asignado.auth_user_id = p_responsable_usuario_id
        and asignado.active is true
        and asignado.organization_id = p_organization_id
        and asignado.business_id is not distinct from p_business_id
        and asignado.branch_id is not distinct from p_branch_id
      )
    );
$function$;

revoke all on function private.monys_puede_acceder_alcance_operativo(uuid, uuid, uuid, uuid, boolean, boolean) from public, anon;
revoke all on function private.monys_asignacion_operativa_valida(uuid, uuid, uuid, uuid, boolean) from public, anon;
grant execute on function private.monys_puede_acceder_alcance_operativo(uuid, uuid, uuid, uuid, boolean, boolean) to authenticated;
grant execute on function private.monys_asignacion_operativa_valida(uuid, uuid, uuid, uuid, boolean) to authenticated;

-- Quita permisos anónimos y privilegios que el RLS no puede limitar (TRUNCATE,
-- REFERENCES y TRIGGER). Conserva únicamente las operaciones que usa la app.
revoke all on table public.tareas_operativas from anon, authenticated;
grant select, insert, update, delete on table public.tareas_operativas to authenticated;

revoke all on table public.tarea_evidencias from anon, authenticated;
grant select, insert, update, delete on table public.tarea_evidencias to authenticated;

drop policy if exists monys_delete_tareas_operativas on public.tareas_operativas;
drop policy if exists monys_insert_tareas_operativas on public.tareas_operativas;
drop policy if exists monys_read_tareas_operativas on public.tareas_operativas;
drop policy if exists monys_update_tareas_operativas on public.tareas_operativas;

create policy monys_tareas_leer_por_alcance
  on public.tareas_operativas
  for select
  to authenticated
  using (
    private.monys_puede_acceder_alcance_operativo(
      organization_id,
      business_id,
      branch_id,
      responsable_usuario_id,
      false,
      area = 'inventario'
        and estado = 'pendiente'
        and responsable is null
    )
  );

create policy monys_tareas_crear_direccion
  on public.tareas_operativas
  for insert
  to authenticated
  with check (
    private.monys_puede_acceder_alcance_operativo(
      organization_id,
      business_id,
      branch_id,
      responsable_usuario_id,
      true
    )
    and private.monys_asignacion_operativa_valida(
      organization_id,
      business_id,
      branch_id,
      responsable_usuario_id,
      true
    )
  );

create policy monys_tareas_actualizar_asignadas
  on public.tareas_operativas
  for update
  to authenticated
  using (
    private.monys_puede_acceder_alcance_operativo(
      organization_id,
      business_id,
      branch_id,
      responsable_usuario_id,
      false,
      area = 'inventario'
        and estado = 'pendiente'
        and responsable is null
    )
  )
  with check (
    private.monys_puede_acceder_alcance_operativo(
      organization_id,
      business_id,
      branch_id,
      responsable_usuario_id,
      false
    )
    and private.monys_asignacion_operativa_valida(
      organization_id,
      business_id,
      branch_id,
      responsable_usuario_id,
      false
    )
  );

create policy monys_tareas_eliminar_direccion
  on public.tareas_operativas
  for delete
  to authenticated
  using (
    private.monys_puede_acceder_alcance_operativo(
      organization_id,
      business_id,
      branch_id,
      responsable_usuario_id,
      true
    )
  );

-- Vincula tareas históricas solo cuando el padrón operativo y el perfil
-- autenticado identifican a la misma persona activa dentro del mismo alcance.
with coincidencias_unicas as (
  select
    tarea.id,
    min(usuario.auth_user_id::text)::uuid as auth_user_id
  from public.tareas_operativas tarea
  join public.empleados empleado
    on empleado.organization_id = tarea.organization_id
    and empleado.business_id is not distinct from tarea.business_id
    and empleado.branch_id is not distinct from tarea.branch_id
    and lower(btrim(empleado.nombre)) = lower(btrim(tarea.responsable))
    and empleado.active is true
  join public.usuarios usuario
    on (
      usuario.id = empleado.usuario_id
      or usuario.auth_user_id = empleado.usuario_id
    )
    and usuario.organization_id = tarea.organization_id
    and usuario.business_id is not distinct from tarea.business_id
    and usuario.branch_id is not distinct from tarea.branch_id
    and usuario.active is true
    and usuario.auth_user_id is not null
  where tarea.responsable_usuario_id is null
    and nullif(btrim(tarea.responsable), '') is not null
  group by tarea.id
  having count(distinct usuario.auth_user_id) = 1
)
update public.tareas_operativas tarea
set responsable_usuario_id = coincidencias_unicas.auth_user_id
from coincidencias_unicas
where tarea.id = coincidencias_unicas.id;

drop policy if exists monys_tarea_evidencias_all on public.tarea_evidencias;

create policy monys_evidencias_leer_tarea_accesible
  on public.tarea_evidencias
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.tareas_operativas tarea
      where tarea.id = tarea_evidencias.tarea_id
        and private.monys_puede_acceder_alcance_operativo(
          tarea.organization_id,
          tarea.business_id,
          tarea.branch_id,
          tarea.responsable_usuario_id,
          false
        )
    )
  );

create policy monys_evidencias_subir_a_tarea_asignada
  on public.tarea_evidencias
  for insert
  to authenticated
  with check (
    exists (
      select 1
      from public.tareas_operativas tarea
      where tarea.id = tarea_evidencias.tarea_id
        and private.monys_puede_acceder_alcance_operativo(
          tarea.organization_id,
          tarea.business_id,
          tarea.branch_id,
          tarea.responsable_usuario_id,
          false
        )
    )
  );

create policy monys_evidencias_editar_direccion
  on public.tarea_evidencias
  for update
  to authenticated
  using (
    exists (
      select 1
      from public.tareas_operativas tarea
      where tarea.id = tarea_evidencias.tarea_id
        and private.monys_puede_acceder_alcance_operativo(
          tarea.organization_id,
          tarea.business_id,
          tarea.branch_id,
          tarea.responsable_usuario_id,
          true
        )
    )
  )
  with check (
    exists (
      select 1
      from public.tareas_operativas tarea
      where tarea.id = tarea_evidencias.tarea_id
        and private.monys_puede_acceder_alcance_operativo(
          tarea.organization_id,
          tarea.business_id,
          tarea.branch_id,
          tarea.responsable_usuario_id,
          true
        )
    )
  );

create policy monys_evidencias_eliminar_direccion
  on public.tarea_evidencias
  for delete
  to authenticated
  using (
    exists (
      select 1
      from public.tareas_operativas tarea
      where tarea.id = tarea_evidencias.tarea_id
        and private.monys_puede_acceder_alcance_operativo(
          tarea.organization_id,
          tarea.business_id,
          tarea.branch_id,
          tarea.responsable_usuario_id,
          true
        )
    )
  );

-- El acceso directo público a las fotos evita cualquier política RLS.
update storage.buckets
set public = false
where id = 'tareas-evidencias';

-- Los perfiles también tenían lectura pública. La app necesita que cada
-- persona lea su ficha y que Dirección consulte únicamente su propio alcance.
revoke all on table public.usuarios from anon, authenticated;
grant select on table public.usuarios to authenticated;
grant update (active) on table public.usuarios to authenticated;

drop policy if exists "Permitir leer usuarios" on public.usuarios;
drop policy if exists "Owner y admin pueden crear usuarios" on public.usuarios;
drop policy if exists monys_usuarios_actualizar_estado_en_alcance on public.usuarios;

create policy monys_usuarios_leer_mi_perfil_o_alcance
  on public.usuarios
  for select
  to authenticated
  using (
    auth_user_id = (select auth.uid())
    or private.monys_puede_acceder_alcance_operativo(
      organization_id,
      business_id,
      branch_id,
      null,
      true
    )
  );

create policy monys_usuarios_actualizar_estado_en_alcance
  on public.usuarios
  for update
  to authenticated
  using (
    private.monys_puede_acceder_alcance_operativo(
      organization_id,
      business_id,
      branch_id,
      null,
      true
    )
  )
  with check (
    private.monys_puede_acceder_alcance_operativo(
      organization_id,
      business_id,
      branch_id,
      null,
      true
    )
  );

drop policy if exists monys_tareas_evidencias_delete on storage.objects;
drop policy if exists monys_tareas_evidencias_insert on storage.objects;
drop policy if exists monys_tareas_evidencias_select on storage.objects;
drop policy if exists monys_tareas_evidencias_update on storage.objects;

create policy monys_tareas_evidencias_leer
  on storage.objects
  for select
  to authenticated
  using (
    bucket_id = 'tareas-evidencias'
    and exists (
      select 1
      from public.tareas_operativas tarea
      where tarea.id::text = split_part(storage.objects.name, '/', 1)
        and private.monys_puede_acceder_alcance_operativo(
          tarea.organization_id,
          tarea.business_id,
          tarea.branch_id,
          tarea.responsable_usuario_id,
          false
        )
    )
  );

create policy monys_tareas_evidencias_subir
  on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'tareas-evidencias'
    and exists (
      select 1
      from public.tareas_operativas tarea
      where tarea.id::text = split_part(storage.objects.name, '/', 1)
        and private.monys_puede_acceder_alcance_operativo(
          tarea.organization_id,
          tarea.business_id,
          tarea.branch_id,
          tarea.responsable_usuario_id,
          false
        )
    )
  );

create policy monys_tareas_evidencias_actualizar
  on storage.objects
  for update
  to authenticated
  using (
    bucket_id = 'tareas-evidencias'
    and exists (
      select 1
      from public.tareas_operativas tarea
      where tarea.id::text = split_part(storage.objects.name, '/', 1)
        and private.monys_puede_acceder_alcance_operativo(
          tarea.organization_id,
          tarea.business_id,
          tarea.branch_id,
          tarea.responsable_usuario_id,
          true
        )
    )
  )
  with check (
    bucket_id = 'tareas-evidencias'
    and exists (
      select 1
      from public.tareas_operativas tarea
      where tarea.id::text = split_part(storage.objects.name, '/', 1)
        and private.monys_puede_acceder_alcance_operativo(
          tarea.organization_id,
          tarea.business_id,
          tarea.branch_id,
          tarea.responsable_usuario_id,
          true
        )
    )
  );

create policy monys_tareas_evidencias_eliminar
  on storage.objects
  for delete
  to authenticated
  using (
    bucket_id = 'tareas-evidencias'
    and exists (
      select 1
      from public.tareas_operativas tarea
      where tarea.id::text = split_part(storage.objects.name, '/', 1)
        and private.monys_puede_acceder_alcance_operativo(
          tarea.organization_id,
          tarea.business_id,
          tarea.branch_id,
          tarea.responsable_usuario_id,
          true
        )
    )
  );
