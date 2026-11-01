import { useMemo, useState } from "react";

import { claveFechaMexico, horaMexico } from "./calendarioCampanasMarketingUtils";

import "./CalendarioCampanasMarketing.css";

function diasSiguientes(cantidad = 7) {
  const hoy = claveFechaMexico(new Date());
  const base = new Date(`${hoy}T12:00:00Z`);

  return Array.from({ length: cantidad }, (_, indice) => {
    const fecha = new Date(base);
    fecha.setUTCDate(base.getUTCDate() + indice);
    const clave = fecha.toISOString().slice(0, 10);
    return {
      clave,
      nombre: new Intl.DateTimeFormat("es-MX", { weekday: "short", timeZone: "UTC" }).format(fecha).replace(".", ""),
      numero: fecha.getUTCDate(),
      esHoy: indice === 0,
    };
  });
}

function nombrePublicacion(publicacion) {
  return (publicacion.productos || []).map((item) => item.nombre).filter(Boolean).join(", ") || "Campaña sin producto";
}

export default function CalendarioCampanasMarketing({ publicaciones = [], clientesPorId = new Map() }) {
  const [vista, setVista] = useState("SEMANA");
  const [diaSeleccionado, setDiaSeleccionado] = useState(claveFechaMexico(new Date()));

  const dias = useMemo(() => diasSiguientes(7), []);
  const programadas = useMemo(
    () => publicaciones.filter((publicacion) => publicacion.programada_para),
    [publicaciones]
  );
  const sinFecha = useMemo(
    () => publicaciones.filter((publicacion) => !publicacion.programada_para && publicacion.estado !== "PUBLICADA"),
    [publicaciones]
  );
  const conteoPorDia = useMemo(() => {
    const conteos = new Map();
    programadas.forEach((publicacion) => {
      const clave = claveFechaMexico(publicacion.programada_para);
      if (clave) conteos.set(clave, (conteos.get(clave) || 0) + 1);
    });
    return conteos;
  }, [programadas]);

  const visibles = vista === "SIN_FECHA"
    ? sinFecha.slice(0, 6)
    : programadas
        .filter((publicacion) => claveFechaMexico(publicacion.programada_para) === diaSeleccionado)
        .sort((a, b) => new Date(a.programada_para) - new Date(b.programada_para));

  function abrir(publicacionId) {
    document.getElementById(`marketing-publicacion-${publicacionId}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
  }

  return (
    <section className="campaign-calendar" aria-labelledby="campaign-calendar-title">
      <div className="campaign-calendar__heading">
        <div><span>Agenda inteligente</span><h4 id="campaign-calendar-title">Calendario de campañas</h4><p>Elige un día y abre solamente la campaña que necesitas revisar.</p></div>
        <div className="campaign-calendar__tabs" aria-label="Vista del calendario">
          <button type="button" className={vista === "SEMANA" ? "is-active" : ""} onClick={() => setVista("SEMANA")}>7 días</button>
          <button type="button" className={vista === "SIN_FECHA" ? "is-active" : ""} onClick={() => setVista("SIN_FECHA")}>Sin fecha · {sinFecha.length}</button>
        </div>
      </div>

      {vista === "SEMANA" && (
        <div className="campaign-calendar__days">
          {dias.map((dia) => (
            <button key={dia.clave} type="button" className={`${diaSeleccionado === dia.clave ? "is-selected" : ""} ${dia.esHoy ? "is-today" : ""}`} onClick={() => setDiaSeleccionado(dia.clave)}>
              <small>{dia.esHoy ? "Hoy" : dia.nombre}</small><strong>{dia.numero}</strong><i>{conteoPorDia.get(dia.clave) || 0}</i>
            </button>
          ))}
        </div>
      )}

      <div className="campaign-calendar__list">
        {visibles.map((publicacion) => {
          const cliente = clientesPorId.get(publicacion.cliente_agencia_id);
          return (
            <button key={publicacion.id} type="button" onClick={() => abrir(publicacion.id)}>
              <b>{publicacion.programada_para ? horaMexico(publicacion.programada_para) : "Programar"}</b>
              <span><strong>{nombrePublicacion(publicacion)}</strong><small>{cliente?.nombre || "Cliente por asignar"} · {(publicacion.canales || []).join(" · ") || "Canal pendiente"}</small></span>
              <i>Abrir →</i>
            </button>
          );
        })}
        {!visibles.length && <p>{vista === "SIN_FECHA" ? "Todas las campañas visibles ya tienen fecha." : "No hay campañas programadas para este día."}</p>}
      </div>
    </section>
  );
}
