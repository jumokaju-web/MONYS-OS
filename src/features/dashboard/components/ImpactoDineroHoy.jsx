import { useEffect, useState } from "react";
import { generarAnalisisRebalanceo } from "../../inventario/services/rebalanceoInventarioService";
import { prepararImpactoDineroHoy } from "../utils/accionesImpactoDinero.js";
import { ESTADOS_IMPACTO } from "../../../core/impacto/motorImpactoDinero.js";
import "./ImpactoDineroHoy.css";

const ETIQUETA_ESTADO = {
  [ESTADOS_IMPACTO.ESTIMADO]: "Estimado",
  [ESTADOS_IMPACTO.REQUIERE_LIQUIDEZ]: "Confirmar dinero",
  [ESTADOS_IMPACTO.FALTAN_DATOS]: "Faltan datos",
};

function dineroPredeterminado(valor) {
  return new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency: "MXN",
    maximumFractionDigits: 0,
  }).format(Number(valor) || 0);
}

export default function ImpactoDineroHoy({ businessId = null, formatoDinero, abrirCompraMaestra }) {
  const dinero = typeof formatoDinero === "function" ? formatoDinero : dineroPredeterminado;
  const [estado, setEstado] = useState({ cargando: true, error: "", datos: null });

  useEffect(() => {
    let activo = true;
    setEstado({ cargando: true, error: "", datos: null });
    generarAnalisisRebalanceo(businessId)
      .then((analisis) => {
        if (!activo) return;
        setEstado({
          cargando: false,
          error: "",
          datos: prepararImpactoDineroHoy({ recomendacionesTraspaso: analisis?.recomendaciones }),
        });
      })
      .catch((error) => {
        if (!activo) return;
        setEstado({ cargando: false, error: error?.message || "No se pudo calcular.", datos: null });
      });
    return () => {
      activo = false;
    };
  }, [businessId]);

  const { cargando, error, datos } = estado;

  return (
    <section className="impacto-dinero" aria-labelledby="impacto-dinero-titulo">
      <header>
        <span>CUÁNTO GANAS SI ACTÚAS</span>
        <h3 id="impacto-dinero-titulo">Dinero que puedes ganar o ahorrar</h3>
      </header>

      {cargando && <p className="impacto-dinero__nota">Calculando con tus reportes SICAR…</p>}
      {!cargando && error && <p className="impacto-dinero__nota">No se pudo calcular: {error}</p>}

      {!cargando && !error && datos && datos.totalAcciones === 0 && (
        <p className="impacto-dinero__nota">
          Por ahora no hay traspasos que convengan. Sube "Ventas por artículo" e inventario de cada sucursal para calcularlos.
        </p>
      )}

      {!cargando && !error && datos && datos.totalAcciones > 0 && (
        <>
          <div className="impacto-dinero__totales">
            <div>
              <small>Ganancia estimada</small>
              <strong>{datos.resumen.ganancia == null ? "Sin dato" : dinero(datos.resumen.ganancia)}</strong>
              <span>Utilidad extra en 14 días</span>
            </div>
            <div>
              <small>Compras que te ahorras</small>
              <strong>{datos.resumen.ahorro == null ? "Sin dato" : dinero(datos.resumen.ahorro)}</strong>
              <span>Se confirma con el plan de compra</span>
            </div>
          </div>

          <ol className="impacto-dinero__lista">
            {datos.principales.map((accion) => (
              <li key={accion.id}>
                <div>
                  <b>{accion.titulo}</b>
                  <small>{accion.detalle}</small>
                  {accion.impacto.faltantes?.length > 0 && (
                    <small className="impacto-dinero__falta">Falta: {accion.impacto.faltantes.join(", ")}</small>
                  )}
                </div>
                <div className="impacto-dinero__monto">
                  {accion.impacto.ganancia == null ? (
                    <strong>—</strong>
                  ) : (
                    <strong>+{dinero(accion.impacto.ganancia)}</strong>
                  )}
                  <em>{ETIQUETA_ESTADO[accion.impacto.estado] || accion.impacto.estado}</em>
                </div>
              </li>
            ))}
          </ol>

          <p className="impacto-dinero__nota">
            Calculadas {datos.resumen.cobertura.calculables} de {datos.resumen.cobertura.total} sugerencias
            {datos.resumen.accionesExcluidasPorEscenario > 0 ? `; ${datos.resumen.accionesExcluidasPorEscenario} son alternativas de la misma mercancía y no se suman` : ""}.
            Son estimaciones con tus ventas y utilidad de SICAR; confirma existencias antes de mover mercancía.
          </p>
          {typeof abrirCompraMaestra === "function" && (
            <button type="button" onClick={abrirCompraMaestra}>
              Ver los {datos.totalAcciones} traspasos en Compra Maestra →
            </button>
          )}
        </>
      )}
    </section>
  );
}
