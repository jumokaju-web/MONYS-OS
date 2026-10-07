import { supabase } from "../../../supabase";
import { crearTareaOperativa } from "./tareasOperativasService";

const ETAPAS_CRM = new Set(["NUEVO", "CONTACTADO", "COTIZANDO", "GANADO", "PERDIDO"]);
const CANALES_CRM = new Set(["MOSTRADOR", "WHATSAPP", "FACEBOOK", "INSTAGRAM", "TIKTOK", "MERCADO_LIBRE", "OTRO"]);

export async function listarOportunidadesCRM({ businessId } = {}) {
  if (!businessId) return [];
  const { data, error } = await supabase
    .from("crm_oportunidades")
    .select("*")
    .eq("business_id", businessId)
    .order("proximo_seguimiento", { ascending: true, nullsFirst: false })
    .order("created_at", { ascending: false });
  if (error) throw error;
  return Array.isArray(data) ? data : [];
}

export async function crearOportunidadCRM({
  organizationId,
  businessId,
  branchId = null,
  cliente,
  telefono = null,
  canal = "MOSTRADOR",
  etapa = "NUEVO",
  productoInteres = null,
  montoEstimado = null,
  proximoSeguimiento = null,
  empleado = null,
  notas = null,
} = {}) {
  const nombre = String(cliente || "").trim();
  if (!organizationId || !businessId) {
    throw new Error("Falta el negocio activo para registrar la oportunidad.");
  }
  if (nombre.length < 2) {
    throw new Error("Escribe el nombre del cliente.");
  }
  if (!CANALES_CRM.has(canal)) {
    throw new Error("Selecciona un canal válido.");
  }
  if (!ETAPAS_CRM.has(etapa)) {
    throw new Error("Selecciona una etapa válida.");
  }
  const importe = montoEstimado === "" || montoEstimado == null
    ? null
    : Number(montoEstimado);
  if (importe !== null && (!Number.isFinite(importe) || importe < 0)) {
    throw new Error("El monto estimado debe ser cero o mayor.");
  }

  const registro = {
    organization_id: organizationId,
    business_id: businessId,
    branch_id: branchId || null,
    created_by: (await supabase.auth.getUser()).data?.user?.id || null,
    cliente: nombre,
    telefono: String(telefono || "").trim() || null,
    canal,
    etapa,
    producto_interes: String(productoInteres || "").trim() || null,
    monto_estimado: importe,
    proximo_seguimiento: proximoSeguimiento || null,
    empleado_id: empleado?.id || null,
    asignado_a: empleado?.usuario_id || null,
    notas: String(notas || "").trim() || null,
  };

  const { data, error } = await supabase
    .from("crm_oportunidades")
    .insert(registro)
    .select()
    .single();
  if (error) throw error;

  let tarea = null;
  let errorTarea = null;
  if (empleado?.usuario_id && proximoSeguimiento) {
    try {
      tarea = await crearTareaOperativa({
      organizationId,
      businessId,
      branchId,
      titulo: `Seguimiento CRM: ${nombre}`,
      descripcion: [
        productoInteres ? `Interés: ${productoInteres}` : null,
        telefono ? `Contacto: ${telefono}` : null,
        `Oportunidad CRM ${data.id}`,
      ].filter(Boolean).join(" · "),
      area: "ventas",
      responsable: empleado.nombre,
      responsableUsuarioId: empleado.usuario_id,
      prioridad: "alta",
      fecha: proximoSeguimiento,
      instrucciones: "Contactar al cliente por el canal acordado, actualizar la etapa y registrar el resultado en MONYS OS.",
      creadaPor: "MONYS OS · CRM",
      requiereEvidencia: false,
      criterioExito: "Seguimiento realizado y resultado registrado en MONYS OS.",
      });
    } catch (error) {
      errorTarea = error?.message || "No se pudo crear la tarea de seguimiento.";
    }
  }
  return { oportunidad: data, tarea, errorTarea };
}

export async function actualizarEtapaCRM({ id, etapa } = {}) {
  if (!id || !ETAPAS_CRM.has(etapa)) {
    throw new Error("La oportunidad o etapa no es válida.");
  }
  const { data, error } = await supabase
    .from("crm_oportunidades")
    .update({ etapa, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function listarEmpleadosAsignablesCRM({ businessId } = {}) {
  if (!businessId) return [];
  const { data, error } = await supabase
    .from("empleados")
    .select("id, organization_id, business_id, branch_id, nombre, puesto, usuario_id, active")
    .eq("business_id", businessId)
    .eq("active", true)
    .not("usuario_id", "is", null)
    .order("nombre", { ascending: true });
  if (error) throw error;
  return Array.isArray(data) ? data : [];
}

export async function programarSeguimientoCRM({
  id,
  fecha,
  empleado,
} = {}) {
  if (!id || !fecha || !empleado?.id || !empleado?.usuario_id) {
    throw new Error("Elige una fecha y una empleada con cuenta activa para programar el seguimiento.");
  }

  const { data: actual, error: errorConsulta } = await supabase
    .from("crm_oportunidades")
    .select("*")
    .eq("id", id)
    .single();
  if (errorConsulta) throw errorConsulta;

  const ahora = new Date().toISOString();
  const { data: oportunidad, error } = await supabase
    .from("crm_oportunidades")
    .update({
      proximo_seguimiento: fecha,
      empleado_id: empleado.id,
      asignado_a: empleado.usuario_id,
      branch_id: empleado.branch_id || actual.branch_id || null,
      updated_at: ahora,
    })
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;

  let errorTarea = null;
  try {
    const { error: errorCancelar } = await supabase
      .from("tareas_operativas")
      .update({
        estado: "cancelada",
        resultado: "Reprogramada desde el CRM de MONYS OS.",
        updated_at: ahora,
      })
      .ilike("descripcion", `%Oportunidad CRM ${id}%`)
      .in("estado", ["pendiente", "en_proceso", "analizando"]);
    if (errorCancelar) throw errorCancelar;

    await crearTareaOperativa({
      organizationId: oportunidad.organization_id,
      businessId: oportunidad.business_id,
      branchId: oportunidad.branch_id,
      titulo: `Seguimiento CRM: ${oportunidad.cliente}`,
      descripcion: [
        oportunidad.producto_interes ? `Interés: ${oportunidad.producto_interes}` : null,
        oportunidad.telefono ? `Contacto: ${oportunidad.telefono}` : null,
        `Oportunidad CRM ${oportunidad.id}`,
      ].filter(Boolean).join(" · "),
      area: "ventas",
      responsable: empleado.nombre,
      responsableUsuarioId: empleado.usuario_id,
      prioridad: "alta",
      fecha,
      instrucciones: "Contactar al cliente por el canal acordado, actualizar la etapa y registrar el resultado en MONYS OS.",
      creadaPor: "MONYS OS · CRM",
      requiereEvidencia: false,
      criterioExito: "Seguimiento realizado y resultado registrado en MONYS OS.",
    });
  } catch (err) {
    errorTarea = err?.message || "No se pudo actualizar la tarea del calendario.";
  }

  return { oportunidad, errorTarea };
}
