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
