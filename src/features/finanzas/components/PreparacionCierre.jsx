import { useEffect, useState } from "react";
import { useUser } from "../../../context/UserContext";
import { prepararRutaCierre } from "../utils/preparacionCierre.js";
import { obtenerExpedienteSemanalFlotilla } from "../services/expedienteSemanalFlotillaService.js";
import { resumirExpedienteSemanalFlotilla } from "../utils/expedienteSemanalFlotilla.js";
import "./PreparacionCierre.css";

const ETIQUETAS = { CARGADO: "Datos cargados", PENDIENTE: "Pendiente", POR_CONSULTAR: "Por confirmar", REVISAR: "Por revisar" };

export function VistaPreparacionCierre({ plan, estadoConsulta = "pendiente", error = "", onAbrirArea, onReintentar }) {
  return <section className="preparacion-cierre" aria-labelledby="preparacion-cierre-titulo">
    <header><span>CONTINÚA CUANDO TENGAS ACCESO</span><h2 id="preparacion-cierre-titulo">Tu ruta para terminar el cierre</h2>
      <p>{plan.semanaValida ? `Semana del ${plan.desde} al ${plan.hasta}. Los reportes guardados se vuelven a consultar al entrar.` : plan.motivo}</p>
      <strong>El cierre sigue abierto. Puedes avanzar sin cargar el banco ahora.</strong>
    </header>
    <div className="preparacion-cierre__acciones">
      <button type="button" onClick={() => onAbrirArea?.("plan", "cierre")}>Retomar cierre semanal</button>
      <button type="button" onClick={() => onAbrirArea?.("plan", "proveedores")}>Preparar pagos y vencimientos</button>
    </div>
    <ol className="preparacion-cierre__pasos">{plan.pasos.map((paso) => <li key={paso.id}>
      <span className={`preparacion-cierre__estado es-${paso.estado.toLowerCase()}`}>{ETIQUETAS[paso.estado]}</span>
      <h3>{paso.titulo}</h3><p>{paso.detalle}</p>
      <button type="button" onClick={() => onAbrirArea?.(paso.destino, paso.vista)}>{paso.accion} →</button>
    </li>)}</ol>
    {estadoConsulta === "cargando" && <p role="status">Consultando el banco y el expediente guardado de Flotilla…</p>}
    {error && <p role="alert">{error} La consulta fallida no se interpreta como cero ni como una semana conciliada.</p>}
    {typeof onReintentar === "function" && <button type="button" onClick={onReintentar}>Volver a consultar banco y Flotilla</button>}
    <p className="preparacion-cierre__nota">Primero revisa ventas, movimientos y pagos. Cuando tengas el banco, incorpóralo y comprueba los enlaces. Las marcas manuales del cierre se conservan solo en el dispositivo donde las haces; esta ruta se reconstruye con los datos guardados de MONYS.</p>
  </section>;
}

export default function PreparacionCierre({ sucursales = [], movimientos, cargandoMovimientos, errorMovimientos, cargandoTiendas = false, errorTiendas = false, onAbrirArea }) {
  const { usuario } = useUser();
  const [consulta, setConsulta] = useState({ clave: "", estado: "pendiente" });
  const [intento, setIntento] = useState(0);
  const sucursalesVigentes = cargandoTiendas || errorTiendas ? [] : sucursales;
  const base = prepararRutaCierre({ sucursales: sucursalesVigentes, movimientos, cargandoMovimientos, errorMovimientos });
  const { desde, hasta } = base;
  const clave = JSON.stringify([usuario?.auth_user_id, usuario?.organization_id, usuario?.business_id, usuario?.branch_id, usuario?.role, desde, hasta]);
  useEffect(() => {
    if (!desde || !hasta || usuario?.role !== "owner") return undefined;
    let activo = true;
    obtenerExpedienteSemanalFlotilla({ usuario: {
      auth_user_id: usuario?.auth_user_id, organization_id: usuario?.organization_id, business_id: usuario?.business_id,
      branch_id: usuario?.branch_id, role: usuario?.role,
    }, desde, hasta }).then((datos) => {
      if (activo) setConsulta({ clave, estado: "consultado", negocioEncontrado: datos.negocioEncontrado,
        error: datos.negocioEncontrado ? "" : "No se pudo identificar una sola empresa de Flotilla para comprobar sus cobros.",
        expediente: resumirExpedienteSemanalFlotilla({ ...datos, desde, hasta }) });
    }).catch((error) => { if (activo) setConsulta({ clave, estado: "error", error: error.message || "No se pudo consultar el expediente." }); });
    return () => { activo = false; };
  }, [clave, desde, hasta, usuario?.auth_user_id, usuario?.organization_id, usuario?.business_id, usuario?.branch_id, usuario?.role, intento]);
  if (usuario?.role !== "owner") return null;
  const vigente = consulta.clave === clave ? consulta : { estado: desde && hasta ? "cargando" : "pendiente" };
  const plan = prepararRutaCierre({ sucursales: sucursalesVigentes, movimientos, cargandoMovimientos, errorMovimientos,
    expediente: vigente.expediente, estadoExpediente: vigente.estado, negocioEncontrado: vigente.negocioEncontrado });
  if (cargandoTiendas || errorTiendas) {
    plan.motivo = errorTiendas ? "No se pudo comprobar el corte de las tiendas. La preparación conserva las fuentes como pendientes." : "Consultando los reportes guardados de las tiendas…";
  }
  return <VistaPreparacionCierre plan={plan} estadoConsulta={vigente.estado} error={vigente.error} onAbrirArea={onAbrirArea}
    onReintentar={base.semanaValida ? () => { setConsulta({ clave, estado: "cargando" }); setIntento((n) => n + 1); } : undefined} />;
}
