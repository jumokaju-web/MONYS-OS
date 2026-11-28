-- Canales de venta (Mercado Libre, TikTok Shop) de Monys Glam.
-- Autorizado por la propietaria para PREPARAR; aplicar solo tras revisión.
-- Aditiva: crea tablas nuevas; no toca datos existentes.
--
-- Escritura: solo la Edge Function `sincronizar-canales` (service_role).
-- Lectura: owner, director, admin y finanzas de la organización (RLS).
-- Vínculos con SICAR: los confirma una persona (owner/director/admin).
-- Idempotencia: unique (business_id, canal, external_id) + upsert.
-- Tokens OAuth: NO se guardan aquí; van en Supabase Vault.

begin;

create table if not exists public.canal_cuentas (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  business_id uuid not null references public.businesses(id),
  canal text not null check (canal in ('mercado_libre', 'tiktok_shop')),
  cuenta_externa text not null check (length(trim(cuenta_externa)) between 1 and 80),
  nombre text,
  estado text not null default 'PENDIENTE_AUTORIZACION'
    check (estado in ('PENDIENTE_AUTORIZACION', 'ACTIVA', 'ERROR', 'DESCONECTADA')),
  ultimo_sync timestamptz,
  ultimo_error text check (ultimo_error is null or length(ultimo_error) <= 1000),
  intentos_fallidos integer not null default 0 check (intentos_fallidos >= 0),
  proximo_intento timestamptz,          -- reintento automático (backoff)
  sync_en_curso_hasta timestamptz,      -- turno exclusivo (evita corridas simultáneas)
  sync_ejecucion_id uuid,               -- dueño del turno: solo esa corrida lo libera
  sync_iniciado_en timestamptz,         -- inicio del turno vigente (marca mínima de un barrido)
  historico_desde date,                 -- desde cuándo el historial de órdenes está completo (carga inicial)
  cobertura jsonb,                      -- qué trajo cada fuente en la última corrida
  created_at timestamptz not null default now(),
  unique (canal, cuenta_externa)
);

create table if not exists public.canal_ordenes (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  business_id uuid not null references public.businesses(id),
  cuenta_id uuid not null references public.canal_cuentas(id),
  canal text not null check (canal in ('mercado_libre', 'tiktok_shop')),
  external_id text not null,
  fecha timestamptz not null,
  estado text not null check (estado in ('paid', 'cancelled', 'pending', 'other')),
  motivo_cancelacion text,
  total numeric(14,2) not null check (total >= 0),
  comision numeric(14,2) check (comision is null or comision >= 0),
  envio_vendedor numeric(14,2) check (envio_vendedor is null or envio_vendedor >= 0), -- null = desconocido
  envio_estado text,
  fecha_liberacion timestamptz,
  -- Confirmado por la propietaria: las ventas de canales no se registran en SICAR.
  registrado_en_sicar boolean not null default false,
  datos_origen jsonb not null default '{}'::jsonb,
  sincronizado_en timestamptz not null default now(),
  unique (business_id, canal, external_id)
);

create table if not exists public.canal_orden_items (
  id uuid primary key default gen_random_uuid(),
  orden_id uuid not null references public.canal_ordenes(id) on delete cascade,
  publicacion text not null default '',
  variacion text not null default '',   -- tono/color: evita colisiones de variantes
  titulo text,
  sku text not null default '',         -- '' = sin SKU (no null, para que la llave sea única)
  cantidad numeric(12,2) not null check (cantidad > 0),
  precio_unit numeric(14,2) not null check (precio_unit >= 0),
  comision numeric(14,2) check (comision is null or comision >= 0),
  unique (orden_id, publicacion, variacion, sku)
);

create table if not exists public.canal_publicaciones (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  business_id uuid not null references public.businesses(id),
  cuenta_id uuid not null references public.canal_cuentas(id),
  canal text not null check (canal in ('mercado_libre', 'tiktok_shop')),
  publicacion text not null,
  variacion text not null default '',
  titulo text,
  sku text,
  codigo_barras text,
  estado text,                          -- 'no_encontrada' si desapareció en un barrido completo
  precio numeric(14,2),
  existencia integer,
  vendidas integer,
  sincronizado_en timestamptz not null default now(),
  unique (business_id, canal, publicacion, variacion)
);

create table if not exists public.canal_liquidaciones (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  business_id uuid not null references public.businesses(id),
  cuenta_id uuid not null references public.canal_cuentas(id),
  canal text not null check (canal in ('mercado_libre', 'tiktok_shop')),
  external_id text not null,
  fecha timestamptz not null,
  monto_bruto numeric(14,2),
  comisiones numeric(14,2),
  envios numeric(14,2),
  retenciones numeric(14,2),
  devoluciones numeric(14,2),
  monto_neto numeric(14,2),
  estado text,
  datos_origen jsonb not null default '{}'::jsonb,
  unique (business_id, canal, external_id)
);

create table if not exists public.canal_devoluciones (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  business_id uuid not null references public.businesses(id),
  canal text not null check (canal in ('mercado_libre', 'tiktok_shop')),
  external_id text not null,
  orden_external_id text,
  fecha timestamptz not null,
  estado text,
  monto numeric(14,2),
  afecta_reputacion text,
  motivo text,
  unique (business_id, canal, external_id)
);

-- Vínculo confirmado por una persona entre publicación y producto SICAR.
create table if not exists public.producto_vinculos (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  business_id uuid not null references public.businesses(id),
  canal text not null check (canal in ('mercado_libre', 'tiktok_shop')),
  publicacion text not null,
  codigo_sicar text not null check (length(trim(codigo_sicar)) between 1 and 80),
  confirmado_por uuid not null default auth.uid() references auth.users(id),
  confirmado_en timestamptz not null default now(),
  unique (business_id, canal, publicacion)
);

create index if not exists canal_ordenes_negocio_fecha_idx on public.canal_ordenes (business_id, canal, fecha desc);
create index if not exists canal_liquidaciones_negocio_fecha_idx on public.canal_liquidaciones (business_id, canal, fecha desc);

-- RLS: lectura por rol de la organización; escritura solo service_role
-- (la Edge Function), salvo producto_vinculos.
do $$
declare
  tabla text;
begin
  foreach tabla in array array['canal_cuentas','canal_ordenes','canal_publicaciones','canal_liquidaciones','canal_devoluciones','producto_vinculos'] loop
    execute format('alter table public.%I enable row level security', tabla);
    execute format('revoke all on public.%I from anon, authenticated', tabla);
    execute format('grant select on public.%I to authenticated', tabla);
    execute format('drop policy if exists %I on public.%I', tabla || '_lectura', tabla);
    execute format(
      'create policy %I on public.%I for select to authenticated using (private.has_org_role(organization_id, array[''owner'',''director'',''admin'',''finanzas'']::text[]))',
      tabla || '_lectura', tabla
    );
  end loop;
end;
$$;

alter table public.canal_orden_items enable row level security;
revoke all on public.canal_orden_items from anon, authenticated;
grant select on public.canal_orden_items to authenticated;
drop policy if exists canal_orden_items_lectura on public.canal_orden_items;
create policy canal_orden_items_lectura on public.canal_orden_items for select to authenticated
using (exists (
  select 1 from public.canal_ordenes orden
  where orden.id = canal_orden_items.orden_id
    and private.has_org_role(orden.organization_id, array['owner','director','admin','finanzas']::text[])
));

grant insert, update on public.producto_vinculos to authenticated;
drop policy if exists producto_vinculos_confirmar on public.producto_vinculos;
create policy producto_vinculos_confirmar on public.producto_vinculos for insert to authenticated
with check (
  private.has_org_role(organization_id, array['owner','director','admin']::text[])
  and confirmado_por = (select auth.uid())
);
drop policy if exists producto_vinculos_corregir on public.producto_vinculos;
create policy producto_vinculos_corregir on public.producto_vinculos for update to authenticated
using (private.has_org_role(organization_id, array['owner','director','admin']::text[]))
with check (private.has_org_role(organization_id, array['owner','director','admin']::text[]) and confirmado_por = (select auth.uid()));

commit;

-- Turno exclusivo por cuenta: solo una sincronización a la vez. Lo usa
-- únicamente la Edge Function (service_role).
-- Por si una versión previa de esta migración ya creó la tabla o las
-- funciones sin identificador de ejecución.
alter table public.canal_cuentas add column if not exists sync_ejecucion_id uuid;
alter table public.canal_cuentas add column if not exists sync_iniciado_en timestamptz;
alter table public.canal_cuentas add column if not exists historico_desde date;
drop function if exists public.tomar_turno_canal(uuid, integer);
drop function if exists public.liberar_turno_canal(uuid);

-- Cada corrida tiene un identificador propio (p_ejecucion). Una corrida
-- cuyo turno venció no puede liberar ni cerrar el turno de otra.
create or replace function public.tomar_turno_canal(p_cuenta_id uuid, p_minutos integer, p_ejecucion uuid)
returns boolean language plpgsql security definer set search_path = '' as $$
declare
  tomado uuid;
begin
  if p_minutos is null or p_minutos < 1 or p_minutos > 60 then
    raise exception 'Duración de turno inválida';
  end if;
  if p_ejecucion is null then
    raise exception 'Falta el identificador de ejecución';
  end if;
  update public.canal_cuentas
  -- clock_timestamp(): hora real, no la del inicio de la transacción.
  set sync_en_curso_hasta = clock_timestamp() + make_interval(mins => p_minutos),
      sync_ejecucion_id = p_ejecucion,
      sync_iniciado_en = clock_timestamp()
  where id = p_cuenta_id
    and (sync_en_curso_hasta is null or sync_en_curso_hasta < clock_timestamp())
  returning id into tomado;
  return tomado is not null;
end;
$$;

create or replace function public.liberar_turno_canal(p_cuenta_id uuid, p_ejecucion uuid)
returns boolean language plpgsql security definer set search_path = '' as $$
declare
  liberado uuid;
begin
  update public.canal_cuentas
  set sync_en_curso_hasta = null, sync_ejecucion_id = null, sync_iniciado_en = null
  where id = p_cuenta_id and sync_ejecucion_id = p_ejecucion
  returning id into liberado;
  return liberado is not null;
end;
$$;

-- Extiende el turno solo si sigue siendo de esta ejecución y no ha vencido.
-- La Edge Function lo llama antes de rotar credenciales y antes de cada
-- lote de escritura: una corrida vencida se detiene sin escribir.
create or replace function public.renovar_turno_canal(p_cuenta_id uuid, p_ejecucion uuid, p_minutos integer)
returns boolean language plpgsql security definer set search_path = '' as $$
declare
  renovado uuid;
begin
  if p_minutos is null or p_minutos < 1 or p_minutos > 60 then
    raise exception 'Duración de turno inválida';
  end if;
  update public.canal_cuentas
  set sync_en_curso_hasta = clock_timestamp() + make_interval(mins => p_minutos)
  where id = p_cuenta_id and sync_ejecucion_id = p_ejecucion and sync_en_curso_hasta >= clock_timestamp()
  returning id into renovado;
  return renovado is not null;
end;
$$;

revoke all on function public.renovar_turno_canal(uuid, uuid, integer) from public, anon, authenticated;
revoke all on function public.tomar_turno_canal(uuid, integer, uuid) from public, anon, authenticated;
revoke all on function public.liberar_turno_canal(uuid, uuid) from public, anon, authenticated;
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'service_role') then
    execute 'grant execute on function public.tomar_turno_canal(uuid, integer, uuid) to service_role';
    execute 'grant execute on function public.liberar_turno_canal(uuid, uuid) to service_role';
    execute 'grant execute on function public.renovar_turno_canal(uuid, uuid, integer) to service_role';
  end if;
end;
$$;

-- Escritura por lote en UNA transacción con el turno: bloquea la cuenta
-- (for update), valida con la hora real (clock_timestamp, tomada después
-- del bloqueo) que el turno sea de esta ejecución y no haya vencido,
-- extiende el turno y hace los upserts. Una corrida suspendida que reanuda
-- después de que otra tomó el turno falla aquí sin escribir.
-- organization_id, business_id, cuenta_id y canal salen de la cuenta,
-- nunca del lote (aislamiento entre negocios).
-- Devuelve { escritas, colisiones[], itemsEliminados, obsoletas }:
-- una fila que choca con otra cuenta no se escribe y se reporta.
drop function if exists public.guardar_lote_canal(uuid, uuid, text, jsonb, timestamptz);
create or replace function public.guardar_lote_canal(
  p_cuenta_id uuid, p_ejecucion uuid, p_tipo text, p_filas jsonb,
  p_marca timestamptz default null, p_barrido_completo boolean default false
)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  cuenta public.canal_cuentas%rowtype;
  fila jsonb;
  v_orden_id uuid;
  afectadas integer;
  escritas integer := 0;
  eliminados integer := 0;
  obsoletas integer := 0;
  colisiones jsonb := '[]'::jsonb;
  ahora timestamptz;
begin
  if p_ejecucion is null then raise exception 'Falta el identificador de ejecución'; end if;
  if p_tipo not in ('ordenes', 'publicaciones', 'liquidaciones', 'marcar_obsoletas') then
    raise exception 'Tipo de lote inválido: %', p_tipo;
  end if;
  if p_tipo <> 'marcar_obsoletas' and (p_filas is null or jsonb_typeof(p_filas) <> 'array' or jsonb_array_length(p_filas) > 500) then
    raise exception 'El lote debe ser un arreglo de hasta 500 filas';
  end if;

  select * into cuenta from public.canal_cuentas where id = p_cuenta_id for update;
  if not found then raise exception 'Cuenta de canal inexistente'; end if;
  ahora := clock_timestamp();
  if cuenta.sync_ejecucion_id is distinct from p_ejecucion or cuenta.sync_en_curso_hasta is null or cuenta.sync_en_curso_hasta < ahora then
    raise exception 'Turno vencido o ajeno: no se escribe el lote';
  end if;
  update public.canal_cuentas set sync_en_curso_hasta = ahora + interval '15 minutes' where id = p_cuenta_id;

  if p_tipo = 'ordenes' then
    for fila in select * from jsonb_array_elements(p_filas) loop
      v_orden_id := null;
      insert into public.canal_ordenes as o (
        organization_id, business_id, cuenta_id, canal, external_id, fecha, estado, motivo_cancelacion,
        total, comision, envio_vendedor, envio_estado, fecha_liberacion, datos_origen, sincronizado_en
      ) values (
        cuenta.organization_id, cuenta.business_id, cuenta.id, cuenta.canal,
        fila->>'external_id', (fila->>'fecha')::timestamptz, fila->>'estado', fila->>'motivo_cancelacion',
        (fila->>'total')::numeric, (fila->>'comision')::numeric, (fila->>'envio_vendedor')::numeric,
        fila->>'envio_estado', (fila->>'fecha_liberacion')::timestamptz,
        coalesce(fila->'datos_origen', '{}'::jsonb), coalesce(p_marca, ahora)
      )
      on conflict (business_id, canal, external_id) do update set
        fecha = excluded.fecha, estado = excluded.estado, motivo_cancelacion = excluded.motivo_cancelacion,
        total = excluded.total, comision = excluded.comision, envio_vendedor = excluded.envio_vendedor,
        envio_estado = excluded.envio_estado, fecha_liberacion = excluded.fecha_liberacion,
        datos_origen = excluded.datos_origen, sincronizado_en = excluded.sincronizado_en
      where o.cuenta_id = cuenta.id
      returning id into v_orden_id;
      if v_orden_id is null then
        colisiones := colisiones || jsonb_build_object('tipo', 'orden', 'id', fila->>'external_id', 'motivo', 'pertenece a otra cuenta');
        continue;
      end if;
      escritas := escritas + 1;
      -- Los items de la orden se reemplazan: los que ya no vienen se borran.
      if jsonb_typeof(fila->'items') = 'array' then
        delete from public.canal_orden_items i
        where i.orden_id = v_orden_id
          and not exists (
            select 1 from jsonb_array_elements(fila->'items') n
            where coalesce(n->>'publicacion', '') = i.publicacion and coalesce(n->>'variacion', '') = i.variacion and coalesce(n->>'sku', '') = i.sku
          );
        get diagnostics afectadas = row_count;
        eliminados := eliminados + afectadas;
        insert into public.canal_orden_items (orden_id, publicacion, variacion, titulo, sku, cantidad, precio_unit, comision)
        select v_orden_id, coalesce(n->>'publicacion', ''), coalesce(n->>'variacion', ''), n->>'titulo',
               coalesce(n->>'sku', ''), (n->>'cantidad')::numeric, (n->>'precio_unit')::numeric, (n->>'comision')::numeric
        from jsonb_array_elements(fila->'items') n
        on conflict (orden_id, publicacion, variacion, sku) do update set
          titulo = excluded.titulo, cantidad = excluded.cantidad, precio_unit = excluded.precio_unit, comision = excluded.comision;
      end if;
    end loop;
  elsif p_tipo = 'publicaciones' then
    for fila in select * from jsonb_array_elements(p_filas) loop
      insert into public.canal_publicaciones as p (
        organization_id, business_id, cuenta_id, canal, publicacion, variacion, titulo, sku, codigo_barras,
        estado, precio, existencia, vendidas, sincronizado_en
      ) values (
        cuenta.organization_id, cuenta.business_id, cuenta.id, cuenta.canal,
        fila->>'publicacion', coalesce(fila->>'variacion', ''), fila->>'titulo', fila->>'sku', fila->>'codigo_barras',
        fila->>'estado', (fila->>'precio')::numeric, (fila->>'existencia')::integer, (fila->>'vendidas')::integer,
        coalesce(p_marca, ahora)
      )
      on conflict (business_id, canal, publicacion, variacion) do update set
        titulo = excluded.titulo, sku = excluded.sku, codigo_barras = excluded.codigo_barras, estado = excluded.estado,
        precio = excluded.precio, existencia = excluded.existencia, vendidas = excluded.vendidas,
        sincronizado_en = excluded.sincronizado_en
      where p.cuenta_id = cuenta.id;
      get diagnostics afectadas = row_count;
      if afectadas = 0 then
        colisiones := colisiones || jsonb_build_object('tipo', 'publicacion', 'id', fila->>'publicacion', 'variacion', coalesce(fila->>'variacion', ''), 'motivo', 'pertenece a otra cuenta');
      else
        escritas := escritas + afectadas;
      end if;
    end loop;
  elsif p_tipo = 'liquidaciones' then
    for fila in select * from jsonb_array_elements(p_filas) loop
      insert into public.canal_liquidaciones as l (
        organization_id, business_id, cuenta_id, canal, external_id, fecha, monto_bruto, comisiones, envios,
        retenciones, devoluciones, monto_neto, estado, datos_origen
      ) values (
        cuenta.organization_id, cuenta.business_id, cuenta.id, cuenta.canal,
        fila->>'external_id', (fila->>'fecha')::timestamptz, (fila->>'monto_bruto')::numeric, (fila->>'comisiones')::numeric,
        (fila->>'envios')::numeric, (fila->>'retenciones')::numeric, (fila->>'devoluciones')::numeric,
        (fila->>'monto_neto')::numeric, fila->>'estado', coalesce(fila->'datos_origen', '{}'::jsonb)
      )
      on conflict (business_id, canal, external_id) do update set
        fecha = excluded.fecha, monto_bruto = excluded.monto_bruto, comisiones = excluded.comisiones,
        envios = excluded.envios, retenciones = excluded.retenciones, devoluciones = excluded.devoluciones,
        monto_neto = excluded.monto_neto, estado = excluded.estado, datos_origen = excluded.datos_origen
      where l.cuenta_id = cuenta.id;
      get diagnostics afectadas = row_count;
      if afectadas = 0 then
        colisiones := colisiones || jsonb_build_object('tipo', 'liquidacion', 'id', fila->>'external_id', 'motivo', 'pertenece a otra cuenta');
      else
        escritas := escritas + afectadas;
      end if;
    end loop;
  else
    -- Solo con un barrido completo de ESTA corrida: la marca no puede ser
    -- anterior al inicio del turno vigente.
    if not coalesce(p_barrido_completo, false) then raise exception 'Solo un barrido completo puede marcar publicaciones ausentes'; end if;
    if p_marca is null or cuenta.sync_iniciado_en is null or p_marca < cuenta.sync_iniciado_en then
      raise exception 'La marca del barrido no corresponde a esta ejecución';
    end if;
    update public.canal_publicaciones set estado = 'no_encontrada'
    where cuenta_id = cuenta.id and sincronizado_en < p_marca and estado is distinct from 'no_encontrada';
    get diagnostics obsoletas = row_count;
  end if;
  return jsonb_build_object('escritas', escritas, 'colisiones', colisiones, 'itemsEliminados', eliminados, 'obsoletas', obsoletas);
end;
$$;

revoke all on function public.guardar_lote_canal(uuid, uuid, text, jsonb, timestamptz, boolean) from public, anon, authenticated;
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'service_role') then
    execute 'grant execute on function public.guardar_lote_canal(uuid, uuid, text, jsonb, timestamptz, boolean) to service_role';
  end if;
end;
$$;

-- Credenciales de las plataformas (JSON: access/refresh token, vencimientos,
-- shop_cipher) cifradas en Supabase Vault. Solo service_role puede leerlas o
-- rotarlas, y solo para cuentas registradas en canal_cuentas.
do $do$
begin
  if exists (select 1 from pg_namespace where nspname = 'vault') then
    execute $f$
      create or replace function public.leer_credencial_canal(p_cuenta_id uuid)
      returns text language plpgsql security definer set search_path = '' as $$
      begin
        if not exists (select 1 from public.canal_cuentas where id = p_cuenta_id) then
          raise exception 'Cuenta de canal inexistente';
        end if;
        return (select decrypted_secret from vault.decrypted_secrets where name = 'canal_credencial_' || p_cuenta_id::text);
      end;
      $$;
    $f$;
    execute 'drop function if exists public.guardar_credencial_canal(uuid, text)';
    -- p_ejecucion: la corrida que rota la credencial debe tener el turno
    -- vigente (la fila queda bloqueada mientras se escribe). Sin ejecución
    -- (alta inicial por OAuth) solo se permite si no hay turno activo.
    execute $f$
      create or replace function public.guardar_credencial_canal(p_cuenta_id uuid, p_credencial text, p_ejecucion uuid)
      returns void language plpgsql security definer set search_path = '' as $$
      declare
        existente uuid;
        datos jsonb;
        cuenta record;
      begin
        select sync_ejecucion_id, sync_en_curso_hasta into cuenta
        from public.canal_cuentas where id = p_cuenta_id for update;
        if not found then
          raise exception 'Cuenta de canal inexistente';
        end if;
        if p_ejecucion is null then
          if cuenta.sync_en_curso_hasta is not null and cuenta.sync_en_curso_hasta >= clock_timestamp() then
            raise exception 'Hay una sincronización en curso: no se reemplaza la credencial';
          end if;
        elsif cuenta.sync_ejecucion_id is distinct from p_ejecucion or cuenta.sync_en_curso_hasta is null or cuenta.sync_en_curso_hasta < clock_timestamp() then
          raise exception 'Turno vencido o ajeno: no se guarda la credencial';
        end if;
        datos := p_credencial::jsonb;  -- debe ser JSON válido
        if coalesce(datos->>'access_token', '') = '' or coalesce(datos->>'refresh_token', '') = '' then
          raise exception 'Credencial incompleta: no se reemplaza la anterior';
        end if;
        select id into existente from vault.secrets where name = 'canal_credencial_' || p_cuenta_id::text;
        if existente is null then
          perform vault.create_secret(p_credencial, 'canal_credencial_' || p_cuenta_id::text, 'Credencial de canal (solo lectura)');
        else
          perform vault.update_secret(existente, p_credencial);
        end if;
      end;
      $$;
    $f$;
    execute 'revoke all on function public.leer_credencial_canal(uuid) from public, anon, authenticated';
    execute 'revoke all on function public.guardar_credencial_canal(uuid, text, uuid) from public, anon, authenticated';
    if exists (select 1 from pg_roles where rolname = 'service_role') then
      execute 'grant execute on function public.leer_credencial_canal(uuid) to service_role';
      execute 'grant execute on function public.guardar_credencial_canal(uuid, text, uuid) to service_role';
    end if;
  end if;
end;
$do$;
