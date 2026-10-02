import { orquestarAgenciaGrowth } from "../../services/growthAgencyService.js";
import "./OrquestadorAgenciaGrowth.css";

export default function OrquestadorAgenciaGrowth({
  actualizacionDatos = null,
  productoLider = null,
  inventarioProductoLider = null,
  campanasActivas = [],
  campanasFinalizadas = [],
}) {
  const flujo = orquestarAgenciaGrowth({
    actualizacionDatos,
    productoLider,
    inventarioProductoLider,
    campanasActivas,
    campanasFinalizadas,
  });

  function abrirDestino(destino) {
    document.getElementById(destino)?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
  }

  return (
    <section className="growth-orchestrator">
      <div className="growth-orchestrator__heading">
        <div>
          <span>Motor central de la Agencia IA</span>
          <h3>Orquestador Growth</h3>
          <p>
            Todos los agentes trabajan sobre la misma memoria. Cada entrega alimenta la siguiente y ninguna etapa inventa resultados faltantes.
          </p>
        </div>

        <div className="growth-orchestrator__score">
          <strong>{flujo.porcentaje}%</strong>
          <small>{flujo.completadas} de {flujo.total} etapas comprobadas</small>
        </div>
      </div>

      <div
        className="growth-orchestrator__progress"
        role="progressbar"
        aria-label="Avance del flujo de la Agencia IA"
        aria-valuemin="0"
        aria-valuemax="100"
        aria-valuenow={flujo.porcentaje}
      >
        <span style={{ width: `${flujo.porcentaje}%` }} />
      </div>

      <div className="growth-orchestrator__handoff">
        <span>Siguiente entrega coordinada</span>
        <strong>
          {flujo.siguiente
            ? `${flujo.siguiente.agente}: ${flujo.siguiente.accion}`
            : "Flujo completo · revisar si conviene escalar"}
        </strong>
        <small>
          Producto: {flujo.producto} · Decisión actual: {flujo.decision}
        </small>
        {flujo.siguiente?.destino && (
          <button
            type="button"
            onClick={() => abrirDestino(flujo.siguiente.destino)}
          >
            Abrir siguiente paso →
          </button>
        )}
      </div>

      <div className="growth-orchestrator__stages">
        {flujo.etapas.map((etapa, indice) => (
          <article
            key={etapa.id}
            className={
              etapa.completado
                ? "growth-orchestrator__stage growth-orchestrator__stage--done"
                : flujo.siguiente?.id === etapa.id
                  ? "growth-orchestrator__stage growth-orchestrator__stage--next"
                  : "growth-orchestrator__stage"
            }
          >
            <span>{etapa.completado ? "✓" : indice + 1}</span>
            <div>
              <small>{etapa.agente}</small>
              <strong>{etapa.etiqueta}</strong>
              <p>{etapa.detalle}</p>
            </div>
          </article>
        ))}
      </div>

      <p className="growth-orchestrator__guard">
        🛡️ El orquestador prepara y recomienda. Publicar, autorizar presupuesto o gastar siempre requiere la decisión de Mónica.
      </p>
    </section>
  );
}
