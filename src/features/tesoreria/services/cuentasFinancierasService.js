import { supabase } from "../../../supabase";

function numeroONulo(valor) {
  if (valor === null || valor === undefined || String(valor).trim() === "") return null;
  const numero = Number(valor);
  return Number.isFinite(numero) ? numero : null;
}

export async function obtenerCuentasBancariasParaConfirmar({
  organizationId = null,
} = {}) {
  let consultaCuentas = supabase
    .from("accounts")
    .select("id, organization_id, business_id, branch_id, name, account_type, currency, active")
    .eq("active", true)
    .eq("account_type", "banco")
    .order("name", { ascending: true });

  if (organizationId) {
    consultaCuentas = consultaCuentas.eq("organization_id", organizationId);
  }

  const { data: cuentas, error: errorCuentas } = await consultaCuentas;
  if (errorCuentas) {
    throw new Error(`No fue posible consultar las cuentas bancarias: ${errorCuentas.message}`);
  }

  const cuentasActivas = Array.isArray(cuentas) ? cuentas : [];
  if (!cuentasActivas.length) {
    return { cuentas: [], saldoTotal: null, completo: false };
  }

  const ids = cuentasActivas.map((cuenta) => cuenta.id);
  const [{ data: cortes, error: errorCortes }, { data: movimientos, error: errorMovimientos }] = await Promise.all([
    supabase
      .from("account_balance_snapshots")
      .select("account_id, balance, captured_at, source, notes")
      .in("account_id", ids)
      .order("captured_at", { ascending: false }),
    supabase
      .from("cash_movements")
      .select("account_id, movement_type, amount, occurred_at, status")
      .in("account_id", ids)
      .neq("status", "Cancelado"),
  ]);

  if (errorCortes) {
    throw new Error(`No fue posible consultar los saldos bancarios: ${errorCortes.message}`);
  }
  if (errorMovimientos) {
    throw new Error(`No fue posible actualizar los saldos con movimientos: ${errorMovimientos.message}`);
  }

  const ultimoPorCuenta = new Map();
  for (const corte of cortes || []) {
    if (!ultimoPorCuenta.has(corte.account_id)) ultimoPorCuenta.set(corte.account_id, corte);
  }

  const resultado = cuentasActivas.map((cuenta) => {
    const corte = ultimoPorCuenta.get(cuenta.id) || null;
    const saldoConfirmado = numeroONulo(corte?.balance);
    if (saldoConfirmado === null || !corte?.captured_at) {
      return {
        id: cuenta.id,
        nombre: cuenta.name,
        moneda: cuenta.currency || "MXN",
        saldo: null,
        saldoConfirmado: null,
        fechaSaldo: null,
        fechaActualizacion: null,
        fuente: null,
        movimientosPosteriores: 0,
        ajusteMovimientos: 0,
        esEstimado: false,
      };
    }

    const fechaCorte = new Date(corte.captured_at).getTime();
    const posteriores = (movimientos || []).filter((movimiento) =>
      movimiento.account_id === cuenta.id &&
      new Date(movimiento.occurred_at).getTime() > fechaCorte
    );
    const ajuste = posteriores.reduce((total, movimiento) => {
      const monto = numeroONulo(movimiento.amount) || 0;
      return total + (movimiento.movement_type === "ENTRADA" ? monto : -monto);
    }, 0);
    const fechaActualizacion = posteriores.reduce(
      (masReciente, movimiento) =>
        new Date(movimiento.occurred_at).getTime() > new Date(masReciente).getTime()
          ? movimiento.occurred_at
          : masReciente,
      corte.captured_at
    );

    return {
      id: cuenta.id,
      nombre: cuenta.name,
      moneda: cuenta.currency || "MXN",
      saldo: saldoConfirmado + ajuste,
      saldoConfirmado,
      fechaSaldo: corte.captured_at,
      fechaActualizacion,
      fuente: corte.source,
      movimientosPosteriores: posteriores.length,
      ajusteMovimientos: ajuste,
      esEstimado: posteriores.length > 0,
    };
  });

  const completo = resultado.every((cuenta) => cuenta.saldo !== null);
  return {
    cuentas: resultado,
    saldoTotal: completo
      ? resultado.reduce((total, cuenta) => total + cuenta.saldo, 0)
      : null,
    completo,
  };
}

export async function guardarSaldoBancarioConfirmado({
  organizationId,
  accountId,
  balance,
  notes = null,
}) {
  const saldo = numeroONulo(balance);
  if (!organizationId || !accountId) {
    throw new Error("No fue posible identificar la organización o la cuenta bancaria.");
  }
  if (saldo === null || saldo < 0) {
    throw new Error("Escribe el saldo actual de la cuenta. Puede ser cero, pero no negativo.");
  }

  const { data: authData, error: authError } = await supabase.auth.getUser();
  if (authError || !authData?.user?.id) {
    throw new Error("Tu sesión venció. Inicia sesión de nuevo para confirmar el saldo.");
  }

  const { data: cuenta, error: errorCuenta } = await supabase
    .from("accounts")
    .select("id")
    .eq("id", accountId)
    .eq("organization_id", organizationId)
    .eq("account_type", "banco")
    .eq("active", true)
    .maybeSingle();

  if (errorCuenta || !cuenta?.id) {
    throw new Error("La cuenta bancaria no pertenece a esta organización o ya no está activa.");
  }

  const { data, error } = await supabase
    .from("account_balance_snapshots")
    .insert({
      organization_id: organizationId,
      account_id: accountId,
      balance: saldo,
      captured_at: new Date().toISOString(),
      source: "confirmacion_manual_direccion",
      notes: String(notes || "").trim() || null,
      created_by: authData.user.id,
    })
    .select("id, account_id, balance, captured_at, source")
    .single();

  if (error) {
    throw new Error(`No fue posible guardar el saldo bancario: ${error.message}`);
  }
  return data;
}

/*
  Obtiene el último saldo confirmado de cada cuenta
  y calcula un saldo actualizado con los movimientos
  registrados después de ese corte.
*/
export const obtenerSaldosBancariosActuales =
  async ({ organizationId = null } = {}) => {
    const resumenSeguro = await obtenerCuentasBancariasParaConfirmar({ organizationId });
    if (organizationId || resumenSeguro.cuentas.length) return resumenSeguro;

    const {
      data: cortesSaldo,
      error: errorCortes,
    } = await supabase
      .from(
        "account_balance_snapshots"
      )
      .select(`
        account_id,
        balance,
        captured_at,
        source,
        accounts (
          id,
          name,
          account_type,
          currency,
          active
        )
      `)
      .order(
        "captured_at",
        {
          ascending: false,
        }
      );

    if (errorCortes) {
      console.error(
        "Error al consultar saldos bancarios:",
        errorCortes
      );

      throw new Error(
        `No fue posible consultar los saldos bancarios: ${errorCortes.message}`
      );
    }

    const cuentasEncontradas =
      new Map();

    (cortesSaldo || []).forEach(
      (registro) => {
        const cuenta =
          Array.isArray(
            registro.accounts
          )
            ? registro.accounts[0]
            : registro.accounts;

        if (
          !cuenta?.id ||
          cuenta.active === false ||
          cuenta.account_type !==
            "banco" ||
          cuentasEncontradas.has(
            cuenta.id
          )
        ) {
          return;
        }

        cuentasEncontradas.set(
          cuenta.id,
          {
            id: cuenta.id,
            nombre: cuenta.name,
            tipo:
              cuenta.account_type,
            moneda:
              cuenta.currency ||
              "MXN",
            saldoConfirmado:
              Number(
                registro.balance
              ) || 0,
            fechaSaldo:
              registro.captured_at,
            fuente:
              registro.source,
          }
        );
      }
    );

    const cuentasBase =
      Array.from(
        cuentasEncontradas.values()
      );

    if (
      cuentasBase.length === 0
    ) {
      return {
        cuentas: [],
        saldoTotal: 0,
      };
    }

    const idsCuentas =
      cuentasBase.map(
        (cuenta) => cuenta.id
      );

    const {
      data: movimientos,
      error: errorMovimientos,
    } = await supabase
      .from("cash_movements")
      .select(`
        account_id,
        movement_type,
        amount,
        occurred_at,
        status
      `)
      .in(
        "account_id",
        idsCuentas
      )
      .neq(
        "status",
        "Cancelado"
      );

    if (errorMovimientos) {
      console.error(
        "Error al calcular saldos:",
        errorMovimientos
      );

      throw new Error(
        `No fue posible actualizar los saldos con los movimientos: ${errorMovimientos.message}`
      );
    }

    const cuentas =
      cuentasBase.map(
        (cuenta) => {
          const fechaCorte =
            new Date(
              cuenta.fechaSaldo
            ).getTime();

          const posteriores =
            (movimientos || []).filter(
              (movimiento) =>
                movimiento.account_id ===
                  cuenta.id &&
                new Date(
                  movimiento.occurred_at
                ).getTime() >
                  fechaCorte
            );

          const ajuste =
            posteriores.reduce(
              (
                acumulado,
                movimiento
              ) => {
                const monto =
                  Number(
                    movimiento.amount
                  ) || 0;

                return (
                  acumulado +
                  (
                    movimiento.movement_type ===
                    "ENTRADA"
                      ? monto
                      : -monto
                  )
                );
              },
              0
            );

                     const fechaActualizacion =
            posteriores.length > 0
              ? posteriores.reduce(
                  (
                    fechaMasReciente,
                    movimiento
                  ) =>
                    new Date(
                      movimiento.occurred_at
                    ).getTime() >
                    new Date(
                      fechaMasReciente
                    ).getTime()
                      ? movimiento.occurred_at
                      : fechaMasReciente,
                  cuenta.fechaSaldo
                )
              : cuenta.fechaSaldo;

          return {
            ...cuenta,
            saldo:
              cuenta.saldoConfirmado +
              ajuste,
            ajusteMovimientos:
              ajuste,
            movimientosPosteriores:
              posteriores.length,
            esEstimado:
              posteriores.length > 0,
            fechaActualizacion,
          };
        }
      );

    const saldoTotal =
      cuentas.reduce(
        (
          acumulado,
          cuenta
        ) =>
          acumulado +
          cuenta.saldo,
        0
      );

    return {
      cuentas,
      saldoTotal,
    };
  };
