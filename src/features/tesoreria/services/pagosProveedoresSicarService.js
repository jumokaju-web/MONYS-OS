import { supabase } from "../../../supabase";

const CAMPOS = "id,importacion_detalle_id,proveedor_credito_id,proveedor_nombre_snapshot,numero_proveedor_snapshot,tipo_aplicacion,fecha_pago,importe_pago,evidencia,estado,registrado_en,motivo_anulacion,anulado_en";

export async function obtenerPagosProveedoresSicar(importacionId) {
  if (!importacionId) return [];
  const { data, error } = await supabase
    .from("pagos_proveedores_sicar")
    .select(CAMPOS)
    .eq("importacion_id", importacionId)
    .order("registrado_en", { ascending: true });
  if (error) throw new Error(`No se pudieron cargar las atribuciones de cheques: ${error.message}`);
  return data || [];
}

export async function registrarPagoProveedorSicar({
  organizationId, businessId, branchId, importacionId, detalleId,
  proveedorId = null, proveedorNombre, numeroProveedor = null,
  tipoAplicacion = "POR_DETERMINAR", fechaPago, importePago, evidencia,
}) {
  const nombre = String(proveedorNombre || "").trim();
  const nota = String(evidencia || "").trim();
  if (nombre.length < 2) throw new Error("Indica el proveedor que recibió el cheque.");
  if (nota.length < 5) throw new Error("Agrega una nota de referencia del cheque.");
  if (!["ABONO", "LIQUIDACION", "POR_DETERMINAR"].includes(tipoAplicacion)) throw new Error("Selecciona si fue abono, liquidación o si queda por determinar.");
  const { data: sesion, error: errorSesion } = await supabase.auth.getUser();
  if (errorSesion || !sesion?.user?.id) throw new Error("Inicia sesión para guardar el pago.");
  const { data, error } = await supabase.from("pagos_proveedores_sicar").insert({
    organization_id: organizationId,
    business_id: businessId,
    branch_id: branchId,
    importacion_id: importacionId,
    importacion_detalle_id: detalleId,
    proveedor_credito_id: proveedorId || null,
    proveedor_nombre_snapshot: nombre,
    numero_proveedor_snapshot: numeroProveedor || null,
    tipo_aplicacion: tipoAplicacion,
    fecha_pago: fechaPago,
    importe_pago: importePago,
    evidencia: nota,
    registrado_por: sesion.user.id,
  }).select(CAMPOS).single();
  if (error) throw new Error(`No se pudo guardar la atribución: ${error.message}`);
  return data;
}

export async function anularPagoProveedorSicar(id, motivo) {
  const { data: sesion, error: errorSesion } = await supabase.auth.getUser();
  if (errorSesion || !sesion?.user?.id) throw new Error("Inicia sesión para corregir el registro.");
  const razon = String(motivo || "").trim();
  if (razon.length < 5 || razon.length > 500) throw new Error("El motivo debe tener entre 5 y 500 caracteres.");
  const { data, error } = await supabase.from("pagos_proveedores_sicar").update({
    estado: "ANULADA",
    motivo_anulacion: razon,
    anulado_por: sesion.user.id,
    anulado_en: new Date().toISOString(),
  }).eq("id", id).eq("estado", "ACTIVA").select(CAMPOS).single();
  if (error) throw new Error(`No se pudo corregir la atribución: ${error.message}`);
  return data;
}
