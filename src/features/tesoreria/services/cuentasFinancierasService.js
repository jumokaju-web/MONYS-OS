import { supabase } from "../../../supabase";

/*
  Obtiene el último saldo confirmado de cada cuenta
  y calcula un saldo actualizado con los movimientos
  registrados después de ese corte.
*/
export const obtenerSaldosBancariosActuales =
  async () => {
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