import { supabase } from "../../../supabase";

const DIAS_VIGENCIA_CERO = 7;

function fechaMexico(valor = new Date()) {
  const fecha = valor instanceof Date ? valor : new Date(valor);
  if (Number.isNaN(fecha.getTime())) return null;
  const partes = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Mexico_City",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(fecha);
  const parte = (tipo) => partes.find((item) => item.type === tipo)?.value;
  return `${parte("year")}-${parte("month")}-${parte("day")}`;
}

function diasDesde(fecha, hoy = fechaMexico()) {
  if (!fecha || !hoy) return null;
  const inicio = new Date(`${String(fecha).slice(0, 10)}T12:00:00Z`);
  const fin = new Date(`${hoy}T12:00:00Z`);
  if (Number.isNaN(inicio.getTime()) || Number.isNaN(fin.getTime())) return null;
  return Math.floor((fin.getTime() - inicio.getTime()) / 86400000);
}

async function obtenerConfirmacionCeroReciente(branchId) {
  const { data, error } = await supabase
    .from("creditos_proveedores_confirmaciones")
    .select("id, organization_id, business_id, branch_id, fecha_corte, nota, confirmado_por, confirmado_en")
    .eq("branch_id", branchId)
    .eq("estado", "CONFIRMADO_CERO")
    .order("fecha_corte", { ascending: false })
    .order("confirmado_en", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(`No se pudo consultar la confirmación de cero créditos: ${error.message}`);
  return data || null;
}

export async function obtenerCreditosProveedoresActuales(
  branchId
) {
  if (!branchId) {
    return {
      importacion: null,
      confirmacion: null,
      fuente: null,
      disponible: false,
      creditos: [],
      saldoTotal: 0,
    };
  }

  const [{
    data: importacion,
    error: errorImportacion,
  }, confirmacion] = await Promise.all([supabase
    .from("importaciones")
    .select(
      "id, branch_id, archivo_original, created_at"
    )
    .eq("estado", "procesado")
    .eq(
      "tipo_reporte",
      "Créditos de proveedores"
    )
    .eq(
      "branch_id",
      branchId
    )
    .order(
      "created_at",
      {
        ascending: false,
      }
    )
    .limit(1)
    .maybeSingle(), obtenerConfirmacionCeroReciente(branchId)]);

  if (errorImportacion) {
    throw new Error(
      `No se pudo obtener la última importación de créditos: ${errorImportacion.message}`
    );
  }

  if (!importacion) {
    const antiguedad = diasDesde(confirmacion?.fecha_corte);
    const vigente = Boolean(confirmacion)
      && antiguedad !== null
      && antiguedad >= 0
      && antiguedad <= DIAS_VIGENCIA_CERO;
    return {
      importacion: null,
      confirmacion: vigente ? confirmacion : null,
      fuente: vigente ? "confirmacion_cero" : null,
      disponible: vigente,
      creditos: [],
      saldoTotal: 0,
    };
  }

  const fechaCorteConfirmacion = confirmacion?.confirmado_en
    ? new Date(confirmacion.confirmado_en).getTime()
    : 0;
  const fechaImportacion = new Date(importacion.created_at).getTime();
  const antiguedadConfirmacion = diasDesde(confirmacion?.fecha_corte);
  if (fechaCorteConfirmacion > fechaImportacion
    && antiguedadConfirmacion !== null
    && antiguedadConfirmacion >= 0
    && antiguedadConfirmacion <= DIAS_VIGENCIA_CERO) {
    return {
      importacion: null,
      confirmacion,
      fuente: "confirmacion_cero",
      disponible: true,
      creditos: [],
      saldoTotal: 0,
    };
  }

  const {
    data: creditos,
    error: errorCreditos,
  } = await supabase
    .from("creditos_proveedores")
    .select(
      "id, numero_proveedor, nombre, telefono, celular, saldo, fecha_vencimiento, dias_credito"
    )
    .eq(
      "importacion_id",
      importacion.id
    )
    .order(
      "saldo",
      {
        ascending: false,
      }
    );

  if (errorCreditos) {
    throw new Error(
      `No se pudieron obtener los créditos de proveedores: ${errorCreditos.message}`
    );
  }

  const listaBase =
    Array.isArray(creditos)
      ? creditos
      : [];

  const lista =
    listaBase.map(
      (credito) => {
        const fechaVencimientoReal =
          credito?.fecha_vencimiento ||
          null;

        const fechaVencimientoEstimada =
          fechaVencimientoReal;

        return {
          ...credito,

          fecha_vencimiento_estimada:
            fechaVencimientoEstimada,
        };
      }
    );

  const saldoTotal =
    lista.reduce(
      (
        total,
        credito
      ) =>
        total +
        (
          Number(
            credito?.saldo
          ) || 0
        ),
      0
    );

  return {
    importacion,
    confirmacion: null,
    fuente: "importacion_sicar",
    disponible: true,
    creditos: lista,
    saldoTotal,
  };
}

export async function confirmarCeroCreditosProveedores({ branchId, fechaCorte, nota }) {
  if (!branchId || !fechaCorte || fechaCorte > fechaMexico()) {
    throw new Error("Selecciona una sucursal y una fecha de corte válida.");
  }
  const comentario = String(nota || "").trim();
  if (!comentario) throw new Error("Escribe cómo confirmaste que la sucursal no tiene créditos de proveedores.");

  const { data: auth, error: errorAuth } = await supabase.auth.getUser();
  if (errorAuth || !auth?.user?.id) throw new Error("Tu sesión venció. Inicia sesión para guardar la confirmación.");
  const { data: usuario, error: errorUsuario } = await supabase
    .from("usuarios")
    .select("organization_id, business_id, branch_id, role, active")
    .eq("auth_user_id", auth.user.id)
    .maybeSingle();
  const rol = String(usuario?.role || "").toLowerCase();
  if (errorUsuario || !usuario?.active || !["owner", "admin", "director", "finanzas", "compras"].includes(rol)) {
    throw new Error("Tu usuario no tiene permiso para confirmar saldos de proveedores.");
  }

  const { data: sucursal, error: errorSucursal } = await supabase
    .from("branches")
    .select("id, business_id, businesses!inner(organization_id)")
    .eq("id", branchId)
    .maybeSingle();
  if (errorSucursal || !sucursal) throw new Error("No se encontró la sucursal seleccionada.");
  const negocio = Array.isArray(sucursal.businesses) ? sucursal.businesses[0] : sucursal.businesses;
  if (usuario.organization_id !== negocio?.organization_id
    || (rol !== "owner" && usuario.business_id && usuario.business_id !== sucursal.business_id)
    || (rol !== "owner" && usuario.branch_id && usuario.branch_id !== sucursal.id)) {
    throw new Error("La sucursal no pertenece al alcance de tu usuario.");
  }

  const { data, error } = await supabase
    .from("creditos_proveedores_confirmaciones")
    .insert({
      organization_id: usuario.organization_id,
      business_id: sucursal.business_id,
      branch_id: sucursal.id,
      fecha_corte: fechaCorte,
      estado: "CONFIRMADO_CERO",
      nota: comentario,
      confirmado_por: auth.user.id,
    })
    .select("id, branch_id, fecha_corte, nota, confirmado_por, confirmado_en")
    .single();
  if (error) throw new Error(`No se pudo guardar la confirmación: ${error.message}`);
  return data;
}
