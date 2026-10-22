import { useEffect, useMemo, useState } from "react";

import {
  leerDetalleImportacionVentas,
  listarEmpleadosComision,
  listarImportacionesUtilidadVentas,
  listarOportunidadesGanadasComision,
} from "../services/comisionesSicarService";
import { resumirComisionesSicar } from "../shared/resumenComisionesSicar";
import {
  construirGuiaVenta,
  construirLigaVendedoras,
  recomendarProductoVendedora,
  resolverEmpleadoVendedora,
} from "../shared/asistenteVendedora";

const dinero = new Intl.NumberFormat("es-MX", {
  style: "currency", currency: "MXN", maximumFractionDigits: 2,
});

function fechaISO(valor) {
  if (typeof valor === "number" && valor > 20000) {
    return new Date(Date.UTC(1899, 11, 30) + Math.floor(valor) * 86400000).toISOString().slice(0, 10);
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
  onVerSemana,
}) {
  const [comision, setComision] = useState({ estado: "cargando" });
  const producto = useMemo(() => recomendarProductoVendedora(datosDashboard), [datosDashboard]);
  const guia = useMemo(
    () => construirGuiaVenta({ producto, tareaPrioritaria }),
    [producto, tareaPrioritaria],
  );
  const datosComercialesListos = Boolean(producto?.nombre) && comision.estado === "lista";

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
        const empleadoActual = resolverEmpleadoVendedora(empleados, usuario);
        const resultado = resumen.comisiones.find((fila) => fila.empleadoId === empleadoActual?.id);
        const liga = construirLigaVendedoras({
          comisiones: resumen.comisiones,
          empleadoId: empleadoActual?.id,
        });
        if (activo) {
          setComision({
            estado: resultado ? "lista" : "sin_asignacion",
            importe: resultado?.comision ?? null,
            ventas: resultado?.ventas ?? null,
            tickets: resultado?.tickets ?? null,
            ticketPromedio: resultado?.tickets > 0 ? resultado.ventas / resultado.tickets : null,
            liga,
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

  return (
    <section className="sales-copilot" aria-labelledby="sales-copilot-title">
      <header className="sales-copilot__header">
        <div><span>MONYS · COPILOTO DE VENTA</span><h2 id="sales-copilot-title">Tu siguiente mejor acción</h2></div>
        <span className="sales-copilot__status">
          {datosComercialesListos ? "DATOS VERIFICADOS" : "CONEXIONES PENDIENTES"}
        </span>
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
          <button type="button" className="is-secondary" onClick={onVerSemana}>Ver mi semana</button>
        </div>
      </article>

      <div className="sales-copilot__metrics">
        <article>
          <span>Tu meta de atención hoy</span>
          <strong>Por definir</strong>
          <small>Dirección debe fijarla con tu horario y una línea base real; registra hoy cuántas personas atendiste</small>
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

      <section className="sales-league" aria-labelledby="sales-league-title">
        <header className="sales-league__header">
          <div>
            <span>LIGA MONYS · MISMO CORTE Y SUCURSAL</span>
            <h3 id="sales-league-title">Tu avance como vendedora</h3>
          </div>
          {comision.liga?.destacada && (
            <strong>🏆 {comision.liga.destacada.nombreCorto}</strong>
          )}
        </header>

        {comision.estado === "lista" ? (
          <>
            <div className="sales-league__personal">
              <article>
                <span>Clientes con compra*</span>
                <strong>{comision.tickets}</strong>
                <small>Medidos por tickets</small>
              </article>
              <article>
                <span>Tu ticket promedio</span>
                <strong>{dinero.format(comision.ticketPromedio || 0)}</strong>
                <small>Venta ÷ tickets del corte</small>
              </article>
              <article>
                <span>Tu posición</span>
                <strong>{comision.liga?.actual && comision.liga.comparable
                  ? `#${comision.liga.actual.posicion} de ${comision.liga.ranking.length}`
                  : "En formación"}</strong>
                <small>Mínimo {comision.liga?.minimoTickets || 3} tickets</small>
              </article>
            </div>

            {comision.liga?.comparable ? (
              <ol className="sales-league__ranking">
                {comision.liga.ranking.slice(0, 3).map((fila) => (
                  <li key={fila.empleadoId} className={fila.empleadoId === comision.liga.actual?.empleadoId ? "is-current" : ""}>
                    <b>{fila.posicion}</b>
                    <span><strong>{fila.nombreCorto}</strong><small>{fila.tickets} compras · ticket {dinero.format(fila.ticketPromedio)}</small></span>
                    <em>{fila.puntaje} pts</em>
                  </li>
                ))}
              </ol>
            ) : (
              <p className="sales-league__empty">La comparación aparecerá cuando al menos dos vendedoras tengan 3 tickets asignados correctamente.</p>
            )}

            <p className="sales-league__coach"><b>💡 Cómo subir:</b> {comision.liga?.recomendacion}</p>
            <small className="sales-league__note">*SICAR cuenta tickets, no personas únicas. El puntaje combina ventas 40%, compras atendidas 35% y ticket promedio 25%.</small>
          </>
        ) : (
          <p className="sales-league__empty">La liga se activará cuando Dirección vincule los usuarios SICAR y cargue el corte comparable.</p>
        )}
      </section>

      <footer className="sales-copilot__flow">
        <span><b>1</b> Escucha qué necesita</span>
        <span><b>2</b> Confirma existencia</span>
        <span><b>3</b> Ofrece alternativa</span>
        <span><b>4</b> Registra si no compró</span>
      </footer>
    </section>
  );
}
