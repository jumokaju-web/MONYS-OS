import { supabase } from "../../../supabase";

function numeroONulo(valor) {
  if (valor === "" || valor === null || valor === undefined) {
    return null;
  }

  const numero = Number(valor);
  return Number.isFinite(numero) ? numero : null;
}

function limpiarTexto(valor) {
  return String(valor || "").trim();
}

export function calcularResumenDeudas(deudas = []) {
  const activas = (Array.isArray(deudas) ? deudas : []).filter(
    (deuda) => String(deuda?.estado || "").toUpperCase() === "ACTIVA"
  );

  return activas.reduce(
    (resumen, deuda) => {
      const saldo = Number(deuda?.saldo_actual);
      const pago = Number(deuda?.pago_mensual);
      const tasa = numeroONulo(deuda?.tasa_anual);

      return {
        cantidad: resumen.cantidad + 1,
        saldoTotal:
          resumen.saldoTotal + (Number.isFinite(saldo) ? saldo : 0),
        pagoMensualTotal:
          resumen.pagoMensualTotal + (Number.isFinite(pago) ? pago : 0),
        sinTasa: resumen.sinTasa + (tasa === null ? 1 : 0),
        sinPagoMensual:
          resumen.sinPagoMensual +
          (!Number.isFinite(pago) || pago <= 0 ? 1 : 0),
      };
    },
    {
      cantidad: 0,
      saldoTotal: 0,
      pagoMensualTotal: 0,
      sinTasa: 0,
      sinPagoMensual: 0,
    }
  );
}

export async function obtenerDeudasFinancieras({
  organizationId,
  incluirCerradas = false,
} = {}) {
  if (!organizationId) {
    throw new Error("Falta identificar la organización.");
  }

  let consulta = supabase
    .from("deudas_financieras")
    .select("*")
    .eq("organization_id", organizationId)
    .order("fecha_proximo_pago", { ascending: true, nullsFirst: false });

  if (!incluirCerradas) {
    consulta = consulta.in("estado", ["ACTIVA", "REESTRUCTURADA"]);
  }

  const { data, error } = await consulta;

  if (error) {
    throw new Error(`No fue posible consultar los créditos: ${error.message}`);
  }

  return data || [];
}

export async function guardarDeudaFinanciera({
  id = null,
  organizationId,
  businessId = null,
  branchId = null,
  nombre,
  acreedor,
  tipo,
  alcance = "NEGOCIO",
  saldoActual,
  pagoMensual = null,
  tasaAnual = null,
  fechaProximoPago = null,
  estado = "ACTIVA",
  fuente = "CAPTURA_MANUAL",
  fechaCorteDato = null,
  notas = null,
} = {}) {
  const nombreLimpio = limpiarTexto(nombre);
  const acreedorLimpio = limpiarTexto(acreedor);
  const saldo = numeroONulo(saldoActual);

  if (!organizationId || !nombreLimpio || !acreedorLimpio || !tipo) {
    throw new Error("Completa organización, nombre, acreedor y tipo de crédito.");
  }

  if (saldo === null || saldo < 0) {
    throw new Error("El saldo actual debe ser un número válido.");
  }

  const registro = {
    organization_id: organizationId,
    business_id: businessId,
    branch_id: branchId,
    nombre: nombreLimpio,
    acreedor: acreedorLimpio,
    tipo,
    alcance,
    saldo_actual: saldo,
    pago_mensual: numeroONulo(pagoMensual),
    tasa_anual: numeroONulo(tasaAnual),
    fecha_proximo_pago: fechaProximoPago || null,
    estado,
    fuente,
    fecha_corte_dato: fechaCorteDato || new Date().toISOString().slice(0, 10),
    notas: limpiarTexto(notas) || null,
    updated_at: new Date().toISOString(),
  };

  const consulta = id
    ? supabase.from("deudas_financieras").update(registro).eq("id", id)
    : supabase.from("deudas_financieras").insert(registro);

  const { data, error } = await consulta.select().single();

  if (error) {
    throw new Error(`No fue posible guardar el crédito: ${error.message}`);
  }

  return data;
}

