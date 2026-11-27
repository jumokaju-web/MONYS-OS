import { useEffect, useState } from "react";
import { obtenerAccionesDelDia } from "../services/accionesDelDiaService.js";
import { ESTADOS_IMPACTO } from "../../../core/impacto/motorImpactoDinero.js";
import "./ImpactoDineroHoy.css";

const ETIQUETA_ESTADO = {
  [ESTADOS_IMPACTO.ESTIMADO]: "Lista para hacer",
  [ESTADOS_IMPACTO.REQUIERE_LIQUIDEZ]: "Confirmar dinero",
  [ESTADOS_IMPACTO.FALTAN_DATOS]: "Faltan datos",
};

const ICONO_TIPO = {
  traspaso: "🔁",
  compra: "🛒",
  pago_deuda: "💳",
  campana: "📣",
};

function dineroPredeterminado(valor) {
  return new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency: "MXN",
    maximumFractionDigits: 0,
  }).format(Number(valor) || 0);
}

export default function ImpactoDineroHoy({
  organizationId = null,
  businessId = null,
  formatoDinero,
  abrirCompraMaestra,
  abrirFinanzas,
}) {
  const dinero = typeof formatoDinero === "function" ? formatoDinero : dineroPredeterminado;
  const [estado, setEstado] = useState({ cargando: true, error: "", datos: null });

  useEffect(() => {
    let activo = true;
    setEstado({ cargando: true, error: "", datos: null });
    obtenerAccionesDelDia({ organizationId, businessId })
      .then((datos) => {
        if (activo) setEstado({ cargando: false, error: "", datos });
      })
      .catch((error) => {
        if (activo) setEstado({ cargando: false, error: error?.message || "No se pudo calcular.", datos: null });
      });
    return () => {
      activo = false;
    };
  }, [organizationId, businessId]);

  const abrir = {
    compraMaestra: abrirCompraMaestra,
    finanzas: abrirFinanzas,
  };
  const { cargando, error, datos } = estado;

  return (
    <section className="impacto-dinero" aria-labelledby="impacto-dinero-titulo">
      <header>
        <span>QUÉ HACER HOY · ORDENADO POR DINERO</span>
        <h3 id="impacto-dinero-titulo">Lo que más dinero te deja</h3>
      </header>

      {cargando && <p className="impacto-dinero__nota">Calculando con tus reportes SICAR y tus deudas…</p>}
      {!cargando && error && <p className="impacto-dinero__nota">No se pudo calcular: {error}</p>}

      {!cargando && !error && datos && (
        <>
          {datos.totalAcciones === 0 ? (
            <p className="impacto-dinero__nota">
              Por ahora no hay acciones con dinero calculable. Sube "Ventas por artículo" e inventario de cada sucursal y captura tus deudas con su tasa.
            </p>
          ) : (
            <>
              <div className="impacto-dinero__totales">
                <div>
                  <small>Listo para hacer</small>
                  <strong>{dinero(datos.resumen.ganancia)}</strong>
                  <span>Ganancia estimada sin gastar</span>
                </div>
                <div>
                  <small>Si confirmas dinero</small>
                  <strong className="impacto-dinero__neutro">{dinero(datos.resumen.gananciaPorConfirmarDinero)}</strong>
                  <span>Compras y abonos por autorizar</span>
                </div>
              </div>

              <ol className="impacto-dinero__lista">
                {datos.principales.map((accion) => {
                  const abrirArea = abrir[accion.area];
                  return (
                    <li key={accion.id}>
                      <div>
                        <b>
                          {ICONO_TIPO[accion.tipo] || "•"} {accion.titulo}
                        </b>
                        <small>{accion.detalle}</small>
                        {accion.impacto.estado === ESTADOS_IMPACTO.FALTAN_DATOS && accion.impacto.faltantes?.length > 0 && (
                          <small className="impacto-dinero__falta">Falta: {accion.impacto.faltantes.join(", ")}</small>
                        )}
                        {typeof abrirArea === "function" && (
                          <button type="button" className="impacto-dinero__ir" onClick={abrirArea}>
                            Revisar →
                          </button>
                        )}
                      </div>
                      <div className="impacto-dinero__monto">
                        <strong>{accion.impacto.ganancia == null ? "—" : `+${dinero(accion.impacto.ganancia)}`}</strong>
                        <em>{ETIQUETA_ESTADO[accion.impacto.estado] || accion.impacto.estado}</em>
                      </div>
                    </li>
                  );
                })}
              </ol>
              <p className="impacto-dinero__nota">
                Son estimaciones con tus datos de SICAR y tus deudas registradas. Nada se ejecuta ni se paga solo: tú confirmas cada decisión.
              </p>
            </>
          )}
          {datos.errores?.length > 0 && (
            <p className="impacto-dinero__nota impacto-dinero__falta">No se pudo leer: {datos.errores.join(" · ")}</p>
          )}
        </>
      )}
    </section>
  );
}
