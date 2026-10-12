import { useEffect, useMemo, useState } from "react";

import {
  leerDetalleImportacionVentas,
  listarEmpleadosComision,
  listarImportacionesUtilidadVentas,
  listarOportunidadesGanadasComision,
} from "../services/comisionesSicarService";
import { resumirComisionesSicar } from "../shared/resumenComisionesSicar";
import { construirGuiaVenta, recomendarProductoVendedora } from "../shared/asistenteVendedora";

const dinero = new Intl.NumberFormat("es-MX", {
  style: "currency", currency: "MXN", maximumFractionDigits: 2,
});

function fechaISO(valor) {
  if (typeof valor === "number" && valor > 20000) {
    return new Date(Date.UTC(1899, 11, 30) + Math.round(valor) * 86400000).toISOString().slice(0, 10);
  }
  const cadena = String(valor || "").trim();
  const iso = cadena.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})/);
  if (iso) return `${iso[1]}-${String(iso[2]).padStart(2, "0")}-${String(iso[3]).padStart(2, "0")}`;
  const mx = cadena.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})/);
  return mx ? `${mx[3]}-${String(mx[2]).padStart(2, "0")}-${String(mx[1]).padStart(2, "0")}` : null;
}

function etiquetaFecha(valor) {
  if (!valor) return "fecha pendiente";
  const [year, month, day] = valor.split("-").map(Number);
  return new Intl.DateTimeFormat("es-MX", { day: "numeric", month: "short", year: "numeric" })
    .format(new Date(year, month - 1, day, 12));
}

export default function AsistenteVendedora({
  usuario,
  datosDashboard,
  tareaPrioritaria,
  onTrabajarPrioridad,
  onRegistrarFaltante,
}) {
  const [comision, setComision] = useState({ estado: "cargando" });
  const producto = useMemo(() => recomendarProductoVendedora(datosDashboard), [datosDashboard]);
  const guia = useMemo(
    () => construirGuiaVenta({ producto, tareaPrioritaria }),
    [producto, tareaPrioritaria],
  );

  useEffect(() => {
    let activo = true;
    async function cargarComision() {
      const branchId = usuario?.branch_id || datosDashboard?.branch_id;
      const businessId = usuario?.business_id || datosDashboard?.business_id;
      if (!branchId) {
        setComision({ estado: "sin_datos" });
        return;
      }
      try {
        const importaciones = await listarImportacionesUtilidadVentas(branchId);
        const ultima = importaciones[0];
        if (!ultima) {
          if (activo) setComision({ estado: "sin_datos" });
          return;
        }
        const [filas, empleados, oportunidadesCRM] = await Promise.all([
          leerDetalleImportacionVentas(ultima.id, ultima.total_filas),
          listarEmpleadosComision(branchId),
          listarOportunidadesGanadasComision({ branchId, businessId }).catch(() => []),
        ]);
        const fechas = filas
          .map((fila) => fechaISO((fila?.datos_originales || fila)?.fecha))
          .filter(Boolean)
          .sort();
        const desde = fechas[0];
        const hasta = fechas[fechas.length - 1];
        if (!desde || !hasta) {
          if (activo) setComision({ estado: "sin_periodo" });
          return;
        }
        const resumen = resumirComisionesSicar({ filas, empleados, desde, hasta, oportunidadesCRM });
        const empleadoActual = empleados.find((persona) => persona.usuario_id === usuario?.auth_user_id);
        const resultado = resumen.comisiones.find((fila) => fila.empleadoId === empleadoActual?.id);
        if (activo) {
          setComision({
            estado: resultado ? "lista" : "sin_asignacion",
            importe: resultado?.comision ?? null,
            ventas: resultado?.ventas ?? null,
            tickets: resultado?.tickets ?? null,
            desde,
            hasta,
          });
        }
      } catch (error) {
        console.error("No fue posible preparar la comisión de la vendedora:", error);
        if (activo) setComision({ estado: "error" });
      }
    }
    cargarComision();
    return () => { activo = false; };
  }, [datosDashboard?.branch_id, datosDashboard?.business_id, usuario]);

  const metricas = datosDashboard?.metricas || {};
  const fechaInicial = metricas.fechaInicial instanceof Date
    ? metricas.fechaInicial.toISOString().slice(0, 10)
    : fechaISO(metricas.fechaInicial);
  const fechaFinal = metricas.fechaFinal instanceof Date
    ? metricas.fechaFinal.toISOString().slice(0, 10)
    : fechaISO(metricas.fechaFinal);
  const periodo = fechaInicial && fechaFinal
    ? `${etiquetaFecha(fechaInicial)} – ${etiquetaFecha(fechaFinal)}`
    : "Último corte SICAR";

  return (
    <section className="sales-copilot" aria-labelledby="sales-copilot-title">
      <header className="sales-copilot__header">
        <div><span>MONYS · COPILOTO DE VENTA</span><h2 id="sales-copilot-title">Tu siguiente mejor acción</h2></div>
        <span className="sales-copilot__status">DATOS REALES</span>
      </header>

      <article className="sales-copilot__action">
        <small>{guia.origen}</small>
        <h3>{guia.titulo}</h3>
        <p>{guia.detalle}</p>
        <div className="sales-copilot__buttons">
          {tareaPrioritaria && (
            <button type="button" onClick={onTrabajarPrioridad}>
              {String(tareaPrioritaria.estado).toLowerCase() === "pendiente" ? "Empezar ahora" : "Continuar tarea"}
            </button>
          )}
          <button type="button" className="is-secondary" onClick={onRegistrarFaltante}>Reportar faltante</button>
        </div>
      </article>

      <div className="sales-copilot__metrics">
        <article>
          <span>Ritmo diario de la sucursal</span>
          <strong>{Number(metricas.ventaPromedioDiaria) > 0 ? dinero.format(metricas.ventaPromedioDiaria) : "Por calcular"}</strong>
          <small>{periodo} · referencia, no meta</small>
        </article>
        <article>
          <span>Producto para iniciar conversación</span>
          <strong>{producto?.nombre || "Pendiente de SICAR"}</strong>
          <small>{producto?.inventarioVerificado ? `${producto.existencia} en sistema · confirma físicamente` : "Falta cruzar existencia"}</small>
        </article>
        <article>
          <span>Tu comisión del corte</span>
          <strong>{comision.estado === "lista" ? dinero.format(comision.importe) : "Por confirmar"}</strong>
          <small>
            {comision.estado === "lista"
              ? `${dinero.format(comision.ventas)} vendidos · ${comision.tickets} tickets · ${etiquetaFecha(comision.desde)} a ${etiquetaFecha(comision.hasta)}`
              : comision.estado === "cargando"
                ? "Verificando ventas y usuario SICAR…"
                : "Dirección debe vincular tu usuario SICAR o cargar el reporte"}
          </small>
        </article>
      </div>

      <footer className="sales-copilot__flow">
        <span><b>1</b> Escucha qué necesita</span>
        <span><b>2</b> Confirma existencia</span>
        <span><b>3</b> Ofrece alternativa</span>
        <span><b>4</b> Registra si no compró</span>
      </footer>
    </section>
  );
}
