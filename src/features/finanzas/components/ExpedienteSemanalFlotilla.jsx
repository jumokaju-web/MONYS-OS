import { useEffect, useState } from "react";
import { obtenerExpedienteSemanalFlotilla } from "../services/expedienteSemanalFlotillaService.js";
import { resumirExpedienteSemanalFlotilla } from "../utils/expedienteSemanalFlotilla.js";

const dinero = (valor) => valor === null || valor === undefined ? "Por confirmar" : new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" }).format(valor);

export function VistaExpedienteSemanalFlotilla({ resumen, negocioEncontrado = true }) {
  if (!resumen?.periodoValido) return <p role="status">Elige una semana válida de lunes a domingo para revisar Flotilla.</p>;
  return <section aria-label="Evidencia semanal de Flotilla" style={{ background: "#fff", border: "1px solid #e6c6d5", borderRadius: 14, padding: 16, margin: "16px 0" }}>
    <h3 style={{ marginTop: 0 }}>Flotilla · servicio y cobros por separado</h3>
    {!negocioEncontrado && <p role="alert">No se pudo identificar una sola empresa de Flotilla. La fuente queda pendiente.</p>}
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(170px,1fr))", gap: 12 }}>
      <div><strong>Servicio de esta semana</strong><p>{dinero(resumen.servicio.total)}</p><small>{resumen.servicio.cantidad} facturas con servicio en el corte. Si una factura abarca otras semanas, no se imputa completa ni se prorratea.</small></div>
      <div><strong>Cobros registrados en esta semana</strong><p>{dinero(resumen.cobros.total)}</p><small>{resumen.cobros.cantidad} facturas marcadas pagadas por fecha de cobro. No equivale a abonos bancarios comprobados.</small></div>
      <div><strong>Cobros con enlace comprobable</strong><p>{resumen.cobros.conciliados} de {resumen.cobros.cantidad}</p><small>{resumen.cobros.pendientes} cobros pendientes de evidencia.</small></div>
    </div>
    <p><strong>Banco guardado:</strong> {resumen.banco.revisionId ? `${resumen.banco.desdeObservado || "Sin fecha"} al ${resumen.banco.hastaObservado || "sin fecha"} · ${resumen.banco.movimientosObservados} movimientos observados` : "No hay una revisión bancaria guardada para este contexto."}</p>
    <small>Se consulta la última revisión guardada del negocio y sucursal seleccionados. Las fechas observadas no certifican que el estado esté completo ni que incluya todas las cuentas.</small>
    {resumen.cobros.filas.length > 0 && <div style={{ overflowX: "auto", marginTop: 14 }}><table style={{ width: "100%", textAlign: "left", borderCollapse: "collapse" }}>
      <caption style={{ textAlign: "left", fontWeight: 700, paddingBottom: 8 }}>Expediente de cada cobro del corte</caption>
      <thead><tr><th>Factura y servicio</th><th>Cobro</th><th>Importe</th><th>Evidencia</th></tr></thead>
      <tbody>{resumen.cobros.filas.map((fila, indice) => <tr key={fila.factura.id || `sin-id-${indice}`}>
        <td style={{ padding: "10px 8px 10px 0", borderTop: "1px solid #eedde5" }}>{fila.factura.folio || "Sin folio"}<br/><small>{fila.factura.periodo_desde} al {fila.factura.periodo_hasta}</small></td>
        <td>{fila.fechaCobro || "Por confirmar"}</td><td>{dinero(fila.monto)}</td>
        <td>{fila.estadoEvidencia === "CONCILIADA_CON_EVIDENCIA" ? "Enlace bancario comprobable" : "Pendiente"}<br/><small>{fila.motivo}</small></td>
      </tr>)}</tbody>
    </table></div>}
    <p><strong>Servicio facturado y cobro no se suman como dos ingresos.</strong> Este expediente consulta registros; no crea depósitos, gastos ni conciliaciones automáticas. El IVA facturado no se presenta como utilidad.</p>
  </section>;
}

export default function ExpedienteSemanalFlotilla({ usuario, desde, hasta, onEstado, onAbrirBancos }) {
  const [estado, setEstado] = useState({ clave: "", cargando: true });
  const [intento, setIntento] = useState(0);
  const clave = JSON.stringify([usuario?.auth_user_id, usuario?.organization_id, usuario?.business_id, usuario?.branch_id, usuario?.role, desde, hasta]);
  useEffect(() => {
    let vigente = true;
    onEstado?.({ clave, consultado: false, completo: false });
    obtenerExpedienteSemanalFlotilla({ usuario: {
      auth_user_id: usuario?.auth_user_id, organization_id: usuario?.organization_id,
      business_id: usuario?.business_id, branch_id: usuario?.branch_id, role: usuario?.role,
    }, desde, hasta }).then((datos) => {
      if (!vigente) return;
      const resumen = resumirExpedienteSemanalFlotilla({ ...datos, desde, hasta });
      const bancoObservadoIncluyeCorte = Boolean(resumen.banco.revisionId && resumen.banco.desdeObservado <= desde && resumen.banco.hastaObservado >= hasta);
      const completo = datos.negocioEncontrado && resumen.periodoValido && bancoObservadoIncluyeCorte
        && resumen.cobros.pendientes === 0 && resumen.cobros.importesPendientes === 0
        && resumen.cobros.fechasPendientes === 0 && resumen.servicio.fechasPendientes === 0
        && resumen.servicio.importesPendientes === 0 && resumen.servicio.periodosParciales === 0
        && resumen.cobros.total !== null && resumen.servicio.total !== null && !resumen.identidadPendiente;
      const revision = JSON.stringify([resumen, datos.negocioEncontrado]);
      setEstado({ clave, cargando: false, resumen, negocioEncontrado: datos.negocioEncontrado, bancoObservadoIncluyeCorte });
      onEstado?.({ clave, consultado: true, completo, revision });
    }).catch((error) => {
      if (!vigente) return;
      setEstado({ clave, cargando: false, error: error.message || "No se pudo consultar el expediente." });
      onEstado?.({ clave, consultado: false, completo: false });
    });
    return () => { vigente = false; };
  }, [clave, usuario?.auth_user_id, usuario?.organization_id, usuario?.business_id, usuario?.branch_id, usuario?.role, desde, hasta, intento, onEstado]);
  if (estado.clave !== clave || estado.cargando) return <p role="status">Consultando facturas, cobros y evidencia bancaria de Flotilla…</p>;
  return <>
    {estado.error ? <p role="alert">{estado.error} La consulta no se interpreta como cero.</p> : <>
      <VistaExpedienteSemanalFlotilla resumen={estado.resumen} negocioEncontrado={estado.negocioEncontrado} />
      {!estado.bancoObservadoIncluyeCorte && <p role="status"><strong>Falta evidencia bancaria del corte.</strong> Revisa o carga en Finanzas → Bancos los movimientos que cubran esta semana. El estado guardado no muestra todo el intervalo seleccionado.</p>}
    </>}
    <button type="button" onClick={() => { onEstado?.({ clave, consultado: false, completo: false }); setEstado({ clave, cargando: true }); setIntento((valor) => valor + 1); }}>Volver a consultar evidencia</button>
    {typeof onAbrirBancos === "function" && <button type="button" onClick={onAbrirBancos}>Abrir banco y aclaraciones</button>}
  </>;
}
