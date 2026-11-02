-- Las políticas basadas en organization_members quedaron reemplazadas por
-- las políticas de usuarios activos y roles explícitos. Mantener ambas hacía
-- que Postgres evaluara dos políticas permisivas por cada consulta o alta.
drop policy if exists "Miembros crean borradores de marketing"
  on public.marketing_publicaciones;

drop policy if exists "Miembros consultan publicaciones de marketing"
  on public.marketing_publicaciones;
