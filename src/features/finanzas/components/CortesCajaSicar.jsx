import { useEffect, useMemo, useState } from "react";
import { obtenerCortesCajaSicar } from "../services/cortesCajaSicarService";
import { combinarCortesImportados } from "../utils/cortesCajaSicar";

const dinero = new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" });
const fecha = new Intl.DateTimeFormat("es-MX", { day: "2-digit", month: "short", year: "numeric" });

function nombreSucursal(branchId, sucursales) {
  return sucursales.find((sucursal) => sucursal.id === branchId)?.name || "Sucursal";
}

export default function CortesCajaSicar({ branchId, sucursales = [], onAbrirImportador }) {
  const [importaciones, setImportaciones] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState("");
  const branchIds = useMemo(() => {
    const permitidas = sucursales.map((sucursal) => sucursal.id).filter(Boolean);
    return permitidas.length ? permitidas : [branchId].filter(Boolean);
  }, [branchId, sucursales]);

  useEffect(() => {
    let activo = true;
    setCargando(true);
    setError("");
    obtenerCortesCajaSicar({ branchIds })
      .then((resultado) => { if (activo) setImportaciones(resultado); })
      .catch((fallo) => { if (activo) setError(fallo.message || "No se pudieron cargar los cortes."); })
      .finally(() => { if (activo) setCargando(false); });
    return () => { activo = false; };
  }, [branchIds]);

  const { cortes, resumen } = useMemo(() => combinarCortesImportados(importaciones), [importaciones]);
  const cortesOrdenados = [...cortes].sort((a, b) => `${b.fecha || ""}${b.hora || ""}`.localeCompare(`${a.fecha || ""}${a.hora || ""}`));
  const tarjetaTransferenciaDisponible = resumen.metodosContados.tarjeta !== undefined || resumen.metodosContados.transferencia !== undefined;

  if (cargando) return <p className="cortes-sicar-estado">Consultando cortes oficiales de SICAR…</p>;
  if (error) return <p className="cortes-sicar-estado es-error" role="alert">{error}</p>;
  if (!cortes.length) return <section className="cortes-sicar-vacio"><h2>No hay cortes SICAR importados</h2><p>Carga el “Reporte de Corte de Caja” de cada sucursal. Hasta entonces, MONYS no asumirá que la caja está en cero.</p><button type="button" onClick={onAbrirImportador}>Cargar cortes de caja →</button></section>;

  return <section className="cortes-sicar" aria-labelledby="cortes-sicar-titulo">
    <header><div><span>DATO REAL · SICAR</span><h2 id="cortes-sicar-titulo">Cortes oficiales de caja</h2><p>{resumen.fechaInicio && resumen.fechaFin ? `${fecha.format(new Date(`${resumen.fechaInicio}T12:00:00`))} al ${fecha.format(new Date(`${resumen.fechaFin}T12:00:00`))}` : "Periodo sin confirmar"} · {resumen.totalCortes} cortes</p></div><button type="button" onClick={onAbrirImportador}>Actualizar reportes</button></header>
    <div className="cortes-sicar-metricas">
      <article><small>Total contado</small><strong>{resumen.totalContado === null ? "Sin dato" : dinero.format(resumen.totalContado)}</strong><span>No significa efectivo libre</span></article>
      <article><small>Efectivo contado</small><strong>{resumen.metodosContados.efectivo === undefined ? "Sin dato" : dinero.format(resumen.metodosContados.efectivo)}</strong><span>Antes de retiros y pagos</span></article>
      <article><small>Tarjeta + transferencia</small><strong>{tarjetaTransferenciaDisponible ? dinero.format((resumen.metodosContados.tarjeta || 0) + (resumen.metodosContados.transferencia || 0)) : "Sin dato"}</strong><span>Según desglose SICAR</span></article>
      <article className={Math.abs(resumen.diferenciaOperativa || 0) >= 100 ? "es-alerta" : ""}><small>Diferencia operativa</small><strong>{resumen.diferenciaOperativa === null ? "Sin dato" : dinero.format(resumen.diferenciaOperativa)}</strong><span>Excluye anomalías identificadas</span></article>
    </div>
    {resumen.alertas.length > 0 && <div className="cortes-sicar-alerta"><b>{resumen.alertas.length} anomalías de SICAR separadas</b><p>Hay valores negativos en “Cheque” sin dinero contado ni retirado. Se conservan para auditoría, pero no se presentan como faltante real.</p></div>}
    {resumen.faltantesPorSucursal.length > 0 && <div className="cortes-sicar-alerta"><b>Cortes no disponibles en el periodo</b><p>{resumen.faltantesPorSucursal.map((faltante) => `${nombreSucursal(faltante.branchId, sucursales)}: ${faltante.fecha}`).join(" · ")}. No se sustituyen por cero.</p></div>}
    {resumen.mayorDiferencia && <div className="cortes-sicar-accion"><span>ACCIÓN EXACTA</span><b>Revisar {resumen.mayorDiferencia.corte.caja} del {resumen.mayorDiferencia.corte.fecha}</b><p>Es la mayor diferencia operativa del periodo: {dinero.format(resumen.mayorDiferencia.valor)}. Confirma depósitos, retiros y pagos antes de clasificarla.</p></div>}
    <div className="cortes-sicar-lista">
      {cortesOrdenados.slice(0, 12).map((corte) => <article key={`${corte.importacionId}-${corte.codigo}`}>
        <div><b>{nombreSucursal(corte.branchId, sucursales)} · {corte.caja}</b><small>{corte.fecha} {corte.hora || ""} · {corte.usuario || "Usuario no informado"}</small></div>
        <div><strong>{corte.contado === null ? "Sin contado" : dinero.format(corte.contado)}</strong><small>Diferencia real: {corte.diferenciaOperativa === null ? "sin dato" : dinero.format(corte.diferenciaOperativa)}</small></div>
      </article>)}
    </div>
  </section>;
}
