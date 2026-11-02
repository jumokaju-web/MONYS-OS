import { useMemo, useState } from "react";

import { generarPlanSemanalContenido } from "../../utils/planSemanalContenidoMarketing";

import "./PlanSemanalContenidoMarketing.css";

const NOMBRE_CANAL = {
  INSTAGRAM: "Instagram",
  TIKTOK: "TikTok",
  FACEBOOK: "Facebook",
  WHATSAPP: "WhatsApp",
  TIKTOK_SHOP: "TikTok Shop",
  MERCADO_LIBRE: "Mercado Libre",
};

function fechaCorta(fecha) {
  return new Date(`${fecha}T12:00:00`).toLocaleDateString("es-MX", { day: "numeric", month: "short" });
}

export default function PlanSemanalContenidoMarketing({
  clientes = [],
  publicaciones = [],
  productoPreferido = "",
  soloLectura = false,
  onPreparar,
}) {
  const plan = useMemo(() => generarPlanSemanalContenido({
    clientes,
    publicaciones,
    productoPreferido,
  }), [clientes, publicaciones, productoPreferido]);
  const [seleccionadoId, setSeleccionadoId] = useState("");
  const seleccionado = plan.find((item) => item.id === seleccionadoId) || plan[0];
  const agendados = plan.filter((item) => item.estado === "AGENDADO").length;

  if (!plan.length) return null;

  return (
    <section className="weekly-content" aria-labelledby="weekly-content-title">
      <div className="weekly-content__heading">
        <div>
          <span>Directora de contenido IA</span>
          <h4 id="weekly-content-title">Plan semanal automático</h4>
          <p>Siete días, una intención clara por pieza y cero promociones inventadas.</p>
        </div>
        <strong>{agendados}/7 agendados</strong>
      </div>

      <div className="weekly-content__days" role="tablist" aria-label="Días del plan">
        {plan.map((item) => (
          <button
            key={item.id}
            type="button"
            role="tab"
            aria-selected={seleccionado?.id === item.id}
            className={seleccionado?.id === item.id ? "is-active" : ""}
            onClick={() => setSeleccionadoId(item.id)}
          >
            <small>{item.dia.slice(0, 3)}</small>
            <b>{fechaCorta(item.fecha)}</b>
            <i className={`is-${item.estado.toLowerCase()}`}>{item.estado === "AGENDADO" ? "✓" : "•"}</i>
          </button>
        ))}
      </div>

      {seleccionado && (
        <article className="weekly-content__card">
          <div className="weekly-content__meta">
            <span>{seleccionado.cliente}</span>
            <i>{seleccionado.estado === "AGENDADO" ? "Ya está en calendario" : seleccionado.estado === "FALTA_DATO" ? "Falta elegir producto" : "Idea lista"}</i>
          </div>
          <h5>{seleccionado.producto}</h5>
          <p>{seleccionado.instruccion}.</p>
          <div className="weekly-content__details">
            <span><small>Canal</small><b>{NOMBRE_CANAL[seleccionado.canal] || seleccionado.canal}</b></span>
            <span><small>Formato</small><b>{seleccionado.formato}</b></span>
            <span><small>Objetivo</small><b>{seleccionado.enfoque}</b></span>
          </div>
          <small className="weekly-content__business-goal">Meta del negocio: {seleccionado.objetivoNegocio}</small>
          {!soloLectura && seleccionado.estado !== "AGENDADO" && (
            <button type="button" onClick={() => onPreparar?.(seleccionado)}>
              {seleccionado.productoConfirmado ? "Preparar esta pieza →" : "Elegir producto y preparar →"}
            </button>
          )}
        </article>
      )}
    </section>
  );
}
