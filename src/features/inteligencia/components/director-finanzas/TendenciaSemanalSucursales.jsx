import { useEffect, useMemo, useState } from "react";
import { obtenerHistorialImportacionesUtilidad } from "../../../dashboard/services/dashboardDataService";
import {
  construirLecturaEjecutiva,
  construirMetaRecuperacion,
  construirTendenciaSemanal,
  resumirImportacionUtilidad,
  seleccionarCandidatosCampana,
} from "../../utils/tendenciaSemanalSucursales";
import "./TendenciaSemanalSucursales.css";
import "./TendenciaSemanalEjecutiva.css";

const METRICAS = {
  ventas: { etiqueta: "Ventas", valor: (semana) => semana.ventas, variacion: (semana) => semana.variacionVentas, dinero: true },
  utilidadBruta: { etiqueta: "Utilidad bruta", valor: (semana) => semana.utilidadBruta, variacion: (semana) => semana.variacionUtilidad, dinero: true },
  margen: { etiqueta: "Margen", valor: (semana) => semana.margen, variacion: (semana) => semana.variacionMargenPuntos, dinero: false, puntos: true },
};

function moneda(valor) {
  if (valor === null || valor === undefined || !Number.isFinite(Number(valor))) return "Por confirmar";
  return new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency: "MXN",
    maximumFractionDigits: 0,
  }).format(Number(valor) || 0);
}

function porcentaje(valor) {
  return Number.isFinite(Number(valor)) ? `${Number(valor).toFixed(1)}%` : "Sin dato";
}

function fechaCorta(valor) {
  const fecha = new Date(`${valor}T12:00:00Z`);
  return new Intl.DateTimeFormat("es-MX", { day: "numeric", month: "short", timeZone: "UTC" }).format(fecha);
}

export default function TendenciaSemanalSucursales({ sucursales = [], onAbrirImportador }) {
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState("");
  const [semanas, setSemanas] = useState([]);
  const [metrica, setMetrica] = useState("ventas");
  const sucursalesClave = useMemo(() => sucursales.map((sucursal) => sucursal.id).filter(Boolean).sort().join(":"), [sucursales]);

  useEffect(() => {
    let activo = true;

    async function cargar() {
      if (!sucursalesClave) {
        setSemanas([]);
        setCargando(false);
        return;
      }

      try {
        setCargando(true);
        setError("");
        const paquetes = await obtenerHistorialImportacionesUtilidad(sucursalesClave.split(":"), 8);
        if (!activo) return;
        const mapa = new Map(sucursales.map((sucursal) => [sucursal.id, sucursal]));
        setSemanas(
          paquetes
            .map(({ importacion, detalles }) => resumirImportacionUtilidad({ importacion, detalles, sucursal: mapa.get(importacion.branch_id) }))
            .filter(Boolean),
        );
      } catch (errorCarga) {
        if (activo) setError(errorCarga?.message || "No fue posible cargar la tendencia semanal.");
      } finally {
        if (activo) setCargando(false);
      }
    }

    cargar();
    return () => { activo = false; };
  }, [sucursalesClave, sucursales]);

  const tendencia = useMemo(() => construirTendenciaSemanal(semanas), [semanas]);
  const lectura = useMemo(() => construirLecturaEjecutiva(tendencia), [tendencia]);
  const configuracion = METRICAS[metrica];
  const maximo = Math.max(...tendencia.semanas.map((semana) => Number(configuracion.valor(semana)) || 0), 1);
  const meta = construirMetaRecuperacion(tendencia.semanas, "General Anaya", 10);
  const sucursalAnaya = sucursales.find((sucursal) => String(sucursal.nombre || sucursal.name || "").toLowerCase().includes("general anaya"));
  const candidatos = seleccionarCandidatosCampana(sucursalAnaya?.inventario || [], 3);
  const ultimaSemanaAnaya = meta?.base || null;
  const centroMismoPeriodo = ultimaSemanaAnaya
    ? tendencia.semanas.find((semana) => semana.sucursal.toLowerCase().includes("centro") && semana.periodoInicio === ultimaSemanaAnaya.periodoInicio && semana.periodoFin === ultimaSemanaAnaya.periodoFin)
    : null;
  const brechaCentro = centroMismoPeriodo ? Math.max(0, centroMismoPeriodo.ventas - ultimaSemanaAnaya.ventas) : null;

  return (
    <section className="weekly-rescue" aria-labelledby="weekly-rescue-title">
      <header className="weekly-rescue__header">
        <div>
          <span>CRECIMIENTO POR SUCURSAL · DATOS SICAR</span>
          <h3 id="weekly-rescue-title">Pulso semanal y rescate de General Anaya</h3>
          <p>Cada nuevo corte se agrega a la historia para saber si la venta subió, bajó y qué acción produjo el cambio.</p>
        </div>
        <strong>{tendencia.periodos.length} semana{tendencia.periodos.length === 1 ? "" : "s"} registrada{tendencia.periodos.length === 1 ? "" : "s"}</strong>
      </header>

      <div className="weekly-rescue__tabs" aria-label="Métrica de la gráfica">
        {Object.entries(METRICAS).map(([id, opcion]) => (
          <button key={id} type="button" aria-pressed={metrica === id} onClick={() => setMetrica(id)}>{opcion.etiqueta}</button>
        ))}
      </div>

      {lectura.sucursales.length > 0 && (
        <section className="weekly-rescue__executive" aria-label="Lectura ejecutiva de la última semana">
          <div className="weekly-rescue__executive-title">
            <div><span>LECTURA EJECUTIVA · ÚLTIMO CORTE</span><h4>Qué cambió y qué conviene revisar</h4></div>
            <small className={lectura.comparacionMismoCorte ? "es-listo" : "es-pendiente"}>
              {lectura.comparacionMismoCorte ? "Sucursales comparables" : "Los cortes no coinciden entre sucursales"}
            </small>
          </div>
          <div className="weekly-rescue__executive-grid">
            {lectura.sucursales.map((semana) => (
              <article key={semana.branchId} className={`es-${semana.lectura.estado}`}>
                <div><span>{semana.sucursal}</span><small>{fechaCorta(semana.periodoInicio)}–{fechaCorta(semana.periodoFin)}</small></div>
                <h5>{semana.lectura.titulo}</h5>
                <div className="weekly-rescue__executive-numbers">
                  <p><small>Ventas</small><b>{moneda(semana.ventas)}</b><em>{semana.variacionVentas === null ? "Sin comparación" : `${semana.variacionVentas >= 0 ? "▲" : "▼"} ${Math.abs(semana.variacionVentas).toFixed(1)}%`}</em></p>
                  <p><small>Utilidad</small><b>{moneda(semana.utilidadBruta)}</b><em>{semana.variacionUtilidad === null ? "Sin comparación" : `${semana.variacionUtilidad >= 0 ? "▲" : "▼"} ${Math.abs(semana.variacionUtilidad).toFixed(1)}%`}</em></p>
                  <p><small>Margen</small><b>{porcentaje(semana.margen)}</b><em>{semana.variacionMargenPuntos === null ? "Sin comparación" : `${semana.variacionMargenPuntos >= 0 ? "+" : ""}${semana.variacionMargenPuntos.toFixed(1)} pts`}</em></p>
                </div>
                <p className="weekly-rescue__executive-action"><b>Siguiente revisión:</b> {semana.lectura.accion}</p>
              </article>
            ))}
          </div>
        </section>
      )}

      {cargando ? <p className="weekly-rescue__message">Cargando semanas reales…</p> : error ? <p role="alert" className="weekly-rescue__message weekly-rescue__message--error">{error}</p> : tendencia.periodos.length === 0 ? (
        <p className="weekly-rescue__message">Sube el reporte semanal “Utilidad de ventas” de cada sucursal para iniciar la gráfica.</p>
      ) : (
        <div className="weekly-chart" role="img" aria-label={`Comparación semanal de ${configuracion.etiqueta.toLowerCase()} por sucursal`}>
          {tendencia.periodos.map((periodo) => (
            <article key={periodo.clave} className="weekly-chart__period">
              <div className="weekly-chart__date"><strong>{fechaCorta(periodo.periodoInicio)}–{fechaCorta(periodo.periodoFin)}</strong><span>{periodo.sucursales.length > 1 ? "Comparación completa" : "Falta una sucursal"}</span></div>
              <div className="weekly-chart__bars">
                {periodo.sucursales.map((semana) => {
                  const valor = configuracion.valor(semana);
                  const variacion = configuracion.variacion(semana);
                  const ancho = valor === null || valor === undefined
                    ? 0
                    : Math.max(3, Math.min(100, ((Number(valor) || 0) / maximo) * 100));
                  const esAnaya = semana.sucursal.toLowerCase().includes("general anaya");
                  return (
                    <div key={semana.id} className="weekly-chart__branch">
                      <div><span>{semana.sucursal}</span><strong>{configuracion.dinero ? moneda(valor) : porcentaje(valor)}</strong></div>
                      <div className="weekly-chart__track"><i className={esAnaya ? "is-anaya" : "is-centro"} style={{ width: `${ancho}%` }} /></div>
                      <small>{variacion === null
                        ? "Sin corte anterior comparable"
                        : configuracion.puntos
                          ? `${variacion >= 0 ? "+" : ""}${variacion.toFixed(1)} puntos vs corte anterior`
                          : `${variacion >= 0 ? "▲" : "▼"} ${Math.abs(variacion).toFixed(1)}% vs corte anterior`}</small>
                    </div>
                  );
                })}
              </div>
            </article>
          ))}
        </div>
      )}

      {meta && (
        <div className="weekly-rescue__plan">
          <article className="weekly-rescue__target">
            <span>PRIMER ESCALÓN · 4 SEMANAS</span>
            <h4>Subir General Anaya 10% sin sacrificar margen</h4>
            <div className="weekly-rescue__numbers">
              <div><small>Línea base semanal</small><strong>{moneda(meta.base.ventas)}</strong></div>
              <div><small>Meta semanal inicial</small><strong>{moneda(meta.objetivo)}</strong></div>
              <div><small>Venta adicional</small><strong>{moneda(meta.brecha)}</strong></div>
              <div><small>Incremento promedio</small><strong>{moneda(meta.incrementoDiario)} / día</strong></div>
            </div>
            {brechaCentro !== null && <p>La brecha actual contra Centro es de <b>{moneda(brechaCentro)}</b>. No conviene intentar cerrarla de golpe: primero comprobaremos cuatro incrementos semanales rentables.</p>}
          </article>

          <article className="weekly-rescue__campaign">
            <span>EXPERIMENTO COMERCIAL RECOMENDADO</span>
            <h4>Una campaña pequeña, medible y con inventario real</h4>
            <ol>
              <li>Elegir un solo producto candidato y una oferta sin bajar del margen autorizado.</li>
              <li>Promoverlo 7 días en mostrador, historias y WhatsApp; registrar el canal de cada venta.</li>
              <li>Comparar venta, utilidad y existencias contra esta línea base antes de repetir o pagar publicidad.</li>
            </ol>
          </article>
        </div>
      )}

      <div className="weekly-rescue__products">
        <div>
          <span>CANDIDATOS PARA VALIDAR · NO SON “PRODUCTOS ESTRELLA” TODAVÍA</span>
          <h4>Stock y utilidad potencial disponibles en General Anaya</h4>
          <p>Se eligen por existencia y margen del inventario actual. El reporte “Ventas por artículo” permitirá confirmar demanda y rotación.</p>
        </div>
        {candidatos.length > 0 ? (
          <div className="weekly-rescue__product-grid">
            {candidatos.map((producto, indice) => (
              <article key={`${producto.codigo}-${producto.descripcion}`}>
                <small>OPCIÓN {indice + 1}</small>
                <strong>{producto.descripcion}</strong>
                <span>{producto.existencia} piezas · {moneda(producto.precioVenta)} · margen {porcentaje(producto.margen)}</span>
              </article>
            ))}
          </div>
        ) : <p className="weekly-rescue__message">No hay suficientes productos con stock, precio y utilidad completos para sugerir una prueba.</p>}
        {onAbrirImportador && <button type="button" className="weekly-rescue__import" onClick={onAbrirImportador}>Subir “Ventas por artículo” para elegir productos con demanda real →</button>}
      </div>

      <p className="weekly-rescue__footnote">MONYS mostrará “línea base” hasta reunir una segunda semana. Después calculará automáticamente la variación semanal; una campaña no se declarará exitosa sin venta, utilidad y evidencia del canal.</p>
    </section>
  );
}
