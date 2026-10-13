-- Roster operativo confirmado por placas. No almacena CURP ni crea cuentas Auth.

with roster (
  placa_normalizada,
  da_nombre,
  chofer_nombre,
  quien_saca_nombre,
  tipo_pago_chory,
  aplica_admin_chory
) as (
  values
    ('JY13117', 'Ana Karina Jiménez Meza', 'Iván', 'Kary', 'MLP', true),
    ('HU4027A', 'Paola Corona', 'Cris', 'Paola', 'MLP', false),
    ('JY21009', 'Mónica Janet Jiménez Meza', 'Óscar', 'Mónica', 'MLP', true),
    ('HU1812B', 'Javier Vazquez Flores', 'Javier Vazquez Flores', 'Javier Vazquez Flores', 'MLP', true),
    ('LG44598', 'Luis Alfonso Piña', 'Luis Alfonso Piña', 'Luis Alfonso Piña', 'RENTAL_SMALL', false),
    ('LG67379', 'Fernandez Corona Ricardo Joshua', 'Fernandez Corona Ricardo Joshua', 'Fernandez Corona Ricardo Joshua', 'RENTAL_LARGE', false)
)
update public.flotilla_unidades as unidad
set da_nombre = roster.da_nombre,
    chofer_nombre = roster.chofer_nombre,
    quien_saca_nombre = roster.quien_saca_nombre,
    tipo_pago_chory = roster.tipo_pago_chory,
    aplica_admin_chory = roster.aplica_admin_chory
from roster
where upper(regexp_replace(coalesce(unidad.placas, ''), '[^A-Z0-9]', '', 'g')) = roster.placa_normalizada;

-- La RAM se conserva sin asignación hasta que Administración confirme placas y chofer.
