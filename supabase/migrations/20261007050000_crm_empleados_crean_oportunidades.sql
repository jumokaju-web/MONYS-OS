-- Permite que cada empleada registre clientes que ella misma atiende.
-- La política de dueña/administración existente conserva las asignaciones del equipo.
drop policy if exists "Equipo crea sus oportunidades CRM"
  on public.crm_oportunidades;

create policy "Equipo crea sus oportunidades CRM"
on public.crm_oportunidades
for insert
to authenticated
with check (
  created_by = (select auth.uid())
  and asignado_a = (select auth.uid())
  and exists (
    select 1
    from public.usuarios usuario
    join public.empleados empleado
      on empleado.usuario_id = usuario.auth_user_id
    where usuario.auth_user_id = (select auth.uid())
      and usuario.organization_id = crm_oportunidades.organization_id
      and usuario.active
      and empleado.id = crm_oportunidades.empleado_id
      and empleado.organization_id = crm_oportunidades.organization_id
      and empleado.business_id = crm_oportunidades.business_id
      and empleado.branch_id is not distinct from crm_oportunidades.branch_id
      and empleado.active
  )
);
