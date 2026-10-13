-- Bonos MLP confirmados y ambulancia como transferencia entre choferes.

alter table public.flotilla_ambulancias
  add column if not exists ruta_apoyada_id uuid references public.flotilla_rutas(id) on delete set null;

create index if not exists flotilla_ambulancias_ruta_apoyada_idx
  on public.flotilla_ambulancias (ruta_apoyada_id, fecha);

create or replace function public.preparar_ambulancia_chory()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_usuario public.usuarios%rowtype;
  v_ruta_ayudante public.flotilla_rutas%rowtype;
  v_ruta_apoyada public.flotilla_rutas%rowtype;
  v_tipo_pago text;
  v_km numeric := 0;
  v_pago_ruta numeric := 0;
  v_coincidencias integer := 0;
  v_es_admin boolean;
begin
  select * into v_usuario from public.usuarios
  where auth_user_id = (select auth.uid()) and active limit 1;
  if v_usuario.id is null then raise exception 'Cuenta sin usuario activo de MONYS OS'; end if;
  v_es_admin := v_usuario.role in ('owner', 'admin', 'director', 'logistica');

  if new.ruta_origen_id is null then
    if not v_es_admin then raise exception 'La ambulancia del chofer requiere una ruta'; end if;
    new.organization_id := coalesce(new.organization_id, v_usuario.organization_id);
    new.registrado_por := coalesce(new.registrado_por, (select auth.uid()));
    new.updated_at := now();
    return new;
  end if;

  select * into v_ruta_ayudante from public.flotilla_rutas where id = new.ruta_origen_id;
  if v_ruta_ayudante.id is null then raise exception 'Ruta del ayudante no encontrada'; end if;
  if not v_es_admin and v_ruta_ayudante.driver_auth_user_id is distinct from (select auth.uid()) then
    raise exception 'Solo el chofer de la ruta puede registrar la ambulancia';
  end if;

  new.organization_id := v_ruta_ayudante.organization_id;
  new.business_id := v_ruta_ayudante.business_id;
  new.branch_id := v_ruta_ayudante.branch_id;
  new.driver_auth_user_id := v_ruta_ayudante.driver_auth_user_id;
  new.registrado_por := coalesce(new.registrado_por, (select auth.uid()));
  if not v_es_admin then new.estado := 'REGISTRADA'; end if;

  if new.estado = 'CONFIRMADA' then
    if not v_es_admin then raise exception 'Solo Administración puede confirmar una ambulancia'; end if;
    if coalesce(new.paros_apoyados, 0) < 1 then
      raise exception 'Captura cuántas paradas se apoyaron antes de confirmar';
    end if;

    if new.ruta_apoyada_id is null then
      select count(*) into v_coincidencias
      from public.flotilla_rutas r
      where r.organization_id = v_ruta_ayudante.organization_id
        and r.fecha = new.fecha
        and r.id <> new.ruta_origen_id
        and (
          lower(trim(r.chofer_nombre)) = lower(trim(new.solicitante))
          or lower(trim(r.chofer_nombre)) like lower(trim(new.solicitante)) || ' %'
          or lower(trim(new.solicitante)) like lower(trim(r.chofer_nombre)) || ' %'
        );
      if v_coincidencias <> 1 then
        raise exception 'No se encontró una sola ruta para el chofer apoyado %. Revisa nombre y fecha.', new.solicitante;
      end if;
      select * into v_ruta_apoyada
      from public.flotilla_rutas r
      where r.organization_id = v_ruta_ayudante.organization_id
        and r.fecha = new.fecha
        and r.id <> new.ruta_origen_id
        and (
          lower(trim(r.chofer_nombre)) = lower(trim(new.solicitante))
          or lower(trim(r.chofer_nombre)) like lower(trim(new.solicitante)) || ' %'
          or lower(trim(new.solicitante)) like lower(trim(r.chofer_nombre)) || ' %'
        )
      limit 1;
      new.ruta_apoyada_id := v_ruta_apoyada.id;
    else
      select * into v_ruta_apoyada from public.flotilla_rutas where id = new.ruta_apoyada_id;
      if v_ruta_apoyada.id is null
         or v_ruta_apoyada.organization_id is distinct from v_ruta_ayudante.organization_id
         or v_ruta_apoyada.fecha is distinct from new.fecha
         or v_ruta_apoyada.id = new.ruta_origen_id then
        raise exception 'La ruta apoyada no corresponde a esta fecha y organización';
      end if;
    end if;

    select coalesce(v_ruta_apoyada.tipo_pago, u.tipo_pago_chory, 'MLP')
      into v_tipo_pago
    from public.flotilla_unidades u
    where u.id = v_ruta_apoyada.unidad_id;
    v_tipo_pago := coalesce(v_tipo_pago, v_ruta_apoyada.tipo_pago, 'MLP');
    v_km := greatest(0, case
      when coalesce(v_ruta_apoyada.kilometros_ruta, 0) > 0 then v_ruta_apoyada.kilometros_ruta
      when v_ruta_apoyada.km_final >= v_ruta_apoyada.km_inicial
        then v_ruta_apoyada.km_final - v_ruta_apoyada.km_inicial
      else 0 end);

    if v_tipo_pago = 'RENTAL_SMALL' then v_pago_ruta := 850;
    elsif v_tipo_pago = 'RENTAL_LARGE' then v_pago_ruta := 1000;
    elsif v_km <= 100 then v_pago_ruta := 1600;
    elsif v_km <= 150 then v_pago_ruta := 1750;
    elsif v_km <= 200 then v_pago_ruta := 1900;
    elsif v_km <= 250 then v_pago_ruta := 2025;
    else v_pago_ruta := 2100;
    end if;

    if new.paros_apoyados <= 15 then new.pago_por_kilometraje := 200;
    elsif new.paros_apoyados <= 30 then new.pago_por_kilometraje := 320;
    else new.pago_por_kilometraje := round(v_pago_ruta * 0.5, 2);
    end if;
  end if;

  new.updated_at := now();
  return new;
end;
$$;

create or replace function public.aplicar_ambulancia_confirmada_chory()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ruta_apoyada public.flotilla_rutas%rowtype;
begin
  if old.estado = 'CONFIRMADA' and new.estado <> 'CONFIRMADA' then
    update public.flotilla_cuenta_chofer
    set estado_conciliacion = 'DESCARTADO'
    where referencia_origen in (
      'AMBULANCIA:' || new.id::text,
      'AMBULANCIA:' || new.id::text || ':ABONO',
      'AMBULANCIA:' || new.id::text || ':DESCUENTO'
    );
    return new;
  end if;

  if new.estado = 'CONFIRMADA'
     and new.pago_por_kilometraje > 0
     and new.ruta_apoyada_id is not null then
    select * into v_ruta_apoyada from public.flotilla_rutas where id = new.ruta_apoyada_id;

    if exists (
      select 1 from public.flotilla_cuenta_chofer
      where referencia_origen = 'AMBULANCIA:' || new.id::text
    ) and not exists (
      select 1 from public.flotilla_cuenta_chofer
      where referencia_origen = 'AMBULANCIA:' || new.id::text || ':ABONO'
    ) then
      update public.flotilla_cuenta_chofer
      set referencia_origen = 'AMBULANCIA:' || new.id::text || ':ABONO'
      where referencia_origen = 'AMBULANCIA:' || new.id::text;
    end if;

    if exists (
      select 1 from public.flotilla_cuenta_chofer
      where referencia_origen = 'AMBULANCIA:' || new.id::text || ':ABONO'
    ) then
      update public.flotilla_cuenta_chofer
      set fecha = new.fecha, chofer_nombre = new.ayudante, unidad_id = new.unidad_apoyo_id,
          ruta_id = new.ruta_origen_id, ambulancia_id = new.id,
          concepto = 'Ambulancia a favor por ' || new.paros_apoyados || ' paradas',
          monto = new.pago_por_kilometraje, naturaleza = 'SUMA', automatico = true,
          estado_conciliacion = 'CONCILIADO', organization_id = new.organization_id,
          business_id = new.business_id, branch_id = new.branch_id,
          driver_auth_user_id = new.driver_auth_user_id, registrado_por = (select auth.uid())
      where referencia_origen = 'AMBULANCIA:' || new.id::text || ':ABONO';
    else
      insert into public.flotilla_cuenta_chofer (
        fecha, chofer_nombre, unidad_id, ruta_id, ambulancia_id, tipo_movimiento,
        concepto, monto, naturaleza, automatico, estado_conciliacion, referencia_origen,
        organization_id, business_id, branch_id, driver_auth_user_id, registrado_por
      ) values (
        new.fecha, new.ayudante, new.unidad_apoyo_id, new.ruta_origen_id, new.id, 'AMBULANCIA',
        'Ambulancia a favor por ' || new.paros_apoyados || ' paradas', new.pago_por_kilometraje,
        'SUMA', true, 'CONCILIADO', 'AMBULANCIA:' || new.id::text || ':ABONO',
        new.organization_id, new.business_id, new.branch_id, new.driver_auth_user_id, (select auth.uid())
      );
    end if;

    if exists (
      select 1 from public.flotilla_cuenta_chofer
      where referencia_origen = 'AMBULANCIA:' || new.id::text || ':DESCUENTO'
    ) then
      update public.flotilla_cuenta_chofer
      set fecha = new.fecha, chofer_nombre = v_ruta_apoyada.chofer_nombre,
          unidad_id = v_ruta_apoyada.unidad_id, ruta_id = v_ruta_apoyada.id,
          ambulancia_id = null,
          concepto = 'Descuento por ambulancia de ' || new.paros_apoyados || ' paradas',
          monto = new.pago_por_kilometraje, naturaleza = 'RESTA', automatico = true,
          estado_conciliacion = 'CONCILIADO', organization_id = v_ruta_apoyada.organization_id,
          business_id = v_ruta_apoyada.business_id, branch_id = v_ruta_apoyada.branch_id,
          driver_auth_user_id = v_ruta_apoyada.driver_auth_user_id,
          registrado_por = (select auth.uid())
      where referencia_origen = 'AMBULANCIA:' || new.id::text || ':DESCUENTO';
    else
      insert into public.flotilla_cuenta_chofer (
        fecha, chofer_nombre, unidad_id, ruta_id, ambulancia_id, tipo_movimiento,
        concepto, monto, naturaleza, automatico, estado_conciliacion, referencia_origen,
        organization_id, business_id, branch_id, driver_auth_user_id, registrado_por
      ) values (
        new.fecha, v_ruta_apoyada.chofer_nombre, v_ruta_apoyada.unidad_id, v_ruta_apoyada.id,
        null, 'AMBULANCIA', 'Descuento por ambulancia de ' || new.paros_apoyados || ' paradas',
        new.pago_por_kilometraje, 'RESTA', true, 'CONCILIADO',
        'AMBULANCIA:' || new.id::text || ':DESCUENTO', v_ruta_apoyada.organization_id,
        v_ruta_apoyada.business_id, v_ruta_apoyada.branch_id,
        v_ruta_apoyada.driver_auth_user_id, (select auth.uid())
      );
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists flotilla_ambulancia_chory_preparar on public.flotilla_ambulancias;
create trigger flotilla_ambulancia_chory_preparar
before insert or update on public.flotilla_ambulancias
for each row execute function public.preparar_ambulancia_chory();

drop trigger if exists flotilla_ambulancia_chory_aplicar on public.flotilla_ambulancias;
create trigger flotilla_ambulancia_chory_aplicar
after update of estado, ruta_apoyada_id, paros_apoyados, pago_por_kilometraje
on public.flotilla_ambulancias
for each row execute function public.aplicar_ambulancia_confirmada_chory();
