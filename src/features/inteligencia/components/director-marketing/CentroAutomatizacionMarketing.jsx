import { useEffect, useMemo, useState } from "react";

import {
  guardarPoliticaAutomatizacionMarketing,
  obtenerConfiguracionAutomatizacionMarketing,
  politicaInicialMarketing,
} from "../../services/automatizacionMarketingService";

import "./CentroAutomatizacionMarketing.css";

const CANALES = [
  ["META", "Instagram y Facebook", "◎"],
  ["TIKTOK", "TikTok", "♪"],
  ["TIKTOK_SHOP", "TikTok Shop", "TS"],
  ["WHATSAPP", "WhatsApp", "W"],
  ["MERCADO_LIBRE", "Mercado Libre", "ML"],
];

const PASOS = [
  ["01", "El equipo IA investiga", "Mercado, tendencias, producto, inventario y margen."],
  ["02", "Prepara la campaña", "Contenido distinto por canal, presupuesto y criterio de éxito."],
  ["03", "Kary revisa", "Aprueba, pide cambios o confirma presupuesto."],
  ["04", "MONYS publica y aprende", "Programa, confirma resultado y protege la utilidad."],
];

function moneda(valor) {
  return new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency: "MXN",
    maximumFractionDigits: 0,
  }).format(Number(valor || 0));
}

export default function CentroAutomatizacionMarketing({
  usuario,
  organizationId,
  businessId,
}) {
  const [politica, setPolitica] = useState(politicaInicialMarketing);
  const [conexiones, setConexiones] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [mensaje, setMensaje] = useState("");
  const [error, setError] = useState("");

  const puedeConfigurar = ["owner", "admin"].includes(
    String(usuario?.role || "").toLowerCase()
  );

  const conexionesPorProveedor = useMemo(
    () =>
      new Map(
        conexiones.map((conexion) => [
          String(conexion.proveedor || "").toUpperCase(),
          conexion,
        ])
      ),
    [conexiones]
  );

  useEffect(() => {
    let vigente = true;

    async function cargar() {
      try {
        setCargando(true);
        setError("");
        const resultado =
          await obtenerConfiguracionAutomatizacionMarketing({
            organizationId,
            businessId,
          });

        if (vigente) {
          setPolitica(resultado.politica);
          setConexiones(resultado.conexiones);
        }
      } catch (errorCarga) {
        if (vigente) {
          setError(
            errorCarga?.message ||
              "No fue posible cargar la automatización de Marketing."
          );
        }
      } finally {
        if (vigente) {
          setCargando(false);
        }
      }
    }

    cargar();
    return () => {
      vigente = false;
    };
  }, [organizationId, businessId]);

  async function guardar() {
    try {
      setGuardando(true);
      setError("");
      setMensaje("");
      const guardada = await guardarPoliticaAutomatizacionMarketing({
        organizationId,
        businessId,
        politica,
      });
      setPolitica(guardada);
      setMensaje("Reglas guardadas. MONYS respetará estos límites al conectar las redes.");
    } catch (errorGuardado) {
      setError(
        errorGuardado?.message ||
          "No fue posible guardar las reglas de publicación."
      );
    } finally {
      setGuardando(false);
    }
  }

  return (
    <section className="marketing-auto" aria-labelledby="marketing-auto-title">
      <div className="marketing-auto__heading">
        <div>
          <span>Agencia automática con autorización humana</span>
          <h3 id="marketing-auto-title">Kary revisa; MONYS hace el trabajo pesado</h3>
          <p>
            La IA investiga, prepara y mide. Ninguna red recibe contraseñas y
            ninguna campaña gasta fuera de los límites autorizados.
          </p>
        </div>
        <strong>{cargando ? "Cargando…" : "Control seguro activo"}</strong>
      </div>

      <div className="marketing-auto__steps">
        {PASOS.map(([numero, titulo, detalle]) => (
          <article key={numero}>
            <b>{numero}</b>
            <div>
              <strong>{titulo}</strong>
              <span>{detalle}</span>
            </div>
          </article>
        ))}
      </div>

      <div className="marketing-auto__workspace">
        <article className="marketing-auto__rules">
          <div className="marketing-auto__section-title">
            <div>
              <span>Reglas de aprobación</span>
              <h4>Presupuesto protegido</h4>
            </div>
            <i>{puedeConfigurar ? "Mónica configura" : "Solo consulta"}</i>
          </div>

          <label className="marketing-auto__switch">
            <input
              type="checkbox"
              checked={politica.publicarOrganicoAutomatico}
              disabled={!puedeConfigurar}
              onChange={(evento) =>
                setPolitica((actual) => ({
                  ...actual,
                  publicarOrganicoAutomatico: evento.target.checked,
                }))
              }
            />
            <span>
              <strong>Orgánico después de aprobación</strong>
              <small>Sin gasto. Kary revisa y MONYS podrá programar y publicar.</small>
            </span>
          </label>

          <label className="marketing-auto__switch">
            <input
              type="checkbox"
              checked={politica.publicarPagadoAutomatico}
              disabled={!puedeConfigurar}
              onChange={(evento) =>
                setPolitica((actual) => ({
                  ...actual,
                  publicarPagadoAutomatico: evento.target.checked,
                }))
              }
            />
            <span>
              <strong>Pagado dentro del límite</strong>
              <small>Fuera del límite, stock bajo o margen dudoso siempre vuelve a Mónica.</small>
            </span>
          </label>

          <div className="marketing-auto__limits">
            <label>
              Máximo por campaña
              <input
                type="number"
                min="0"
                step="100"
                value={politica.limitePorCampana}
                disabled={!puedeConfigurar}
                onChange={(evento) =>
                  setPolitica((actual) => ({
                    ...actual,
                    limitePorCampana: evento.target.value,
                  }))
                }
              />
              <small>{moneda(politica.limitePorCampana)} MXN</small>
            </label>
            <label>
              Máximo diario total
              <input
                type="number"
                min="0"
                step="100"
                value={politica.limiteDiario}
                disabled={!puedeConfigurar}
                onChange={(evento) =>
                  setPolitica((actual) => ({
                    ...actual,
                    limiteDiario: evento.target.value,
                  }))
                }
              />
              <small>{moneda(politica.limiteDiario)} MXN</small>
            </label>
          </div>

          {puedeConfigurar && (
            <button type="button" onClick={guardar} disabled={guardando}>
              {guardando ? "Guardando…" : "Guardar reglas de publicación"}
            </button>
          )}
        </article>

        <article className="marketing-auto__connections">
          <div className="marketing-auto__section-title">
            <div>
              <span>Cuentas del negocio</span>
              <h4>Conexiones oficiales</h4>
            </div>
            <i>{conexiones.filter((c) => c.estado === "CONECTADA").length} conectadas</i>
          </div>

          <div className="marketing-auto__channel-list">
            {CANALES.map(([proveedor, nombre, icono]) => {
              const conexion = conexionesPorProveedor.get(proveedor);
              const conectada = conexion?.estado === "CONECTADA";
              return (
                <div key={proveedor}>
                  <b>{icono}</b>
                  <span>
                    <strong>{nombre}</strong>
                    <small>{conexion?.nombre_cuenta || "Cuenta por autorizar"}</small>
                  </span>
                  <i className={conectada ? "is-connected" : ""}>
                    {conectada ? "Conectada" : "Pendiente"}
                  </i>
                </div>
              );
            })}
          </div>

          <p>
            El botón de conexión se activará con la aplicación oficial de cada
            plataforma. El acceso ocurrirá en la propia red; MONYS no guardará
            correos ni contraseñas externas.
          </p>
        </article>
      </div>

      {mensaje && <p className="marketing-auto__message">{mensaje}</p>}
      {error && <p className="marketing-auto__error">{error}</p>}
    </section>
  );
}
