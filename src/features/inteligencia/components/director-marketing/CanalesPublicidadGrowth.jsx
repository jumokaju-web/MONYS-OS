import "./CanalesPublicidadGrowth.css";

const CANALES_CRECIMIENTO = [
  {
    id: "meta",
    marca: "Meta Ads",
    detalle: "Facebook e Instagram",
    icono: "M",
    estado: "Cuenta publicitaria integrada · app pendiente",
    estadoTipo: "parcial",
    progreso: "1 de 3 pasos comprobados",
    hitos: [
      { estado: "listo", texto: "Cuenta publicitaria dentro de MONYS GLAM SHOP" },
      { estado: "pendiente", texto: "Crear la aplicación técnica de MONYS OS" },
      { estado: "bloqueado", texto: "Autorizar publicación directa y medición" },
    ],
    siguientePaso:
      "La cuenta publicitaria ya está protegida dentro del portafolio de MONYS. Falta crear la aplicación técnica y completar OAuth; hasta entonces MONYS solo prepara y agenda borradores, sin publicar ni gastar.",
    url: "https://business.facebook.com/adsmanager",
    enlace: "Abrir Meta Business",
    destinoInterno: "campanas-marketing-activas",
    accionInterna: "Preparar campaña en MONYS",
    capacidad: "Anuncios, medición y audiencias",
  },
  {
    id: "tiktok",
    marca: "TikTok y TikTok Shop",
    detalle: "Contenido orgánico, tienda y anuncios",
    icono: "♪",
    estado: "Aplicación y autorización pendientes",
    siguientePaso:
      "Conectar la cuenta oficial de MONYS Glam mediante OAuth. La publicación directa necesita una aplicación aprobada; mientras tanto MONYS prepara el video y lo conserva como borrador.",
    url: "https://developers.tiktok.com/products/content-posting-api",
    enlace: "Revisar publicación oficial",
    documentacion: "https://business-api.tiktok.com/portal",
    enlaceDocumentacion: "Abrir TikTok Business API",
    destinoInterno: "campanas-marketing-activas",
    accionInterna: "Preparar contenido en MONYS",
    capacidad: "Videos, borradores, tienda y campañas",
  },
  {
    id: "mercadolibre",
    marca: "Mercado Libre",
    detalle: "Publicaciones, precios, inventario y pedidos",
    icono: "ML",
    estado: "Aplicación de vendedor pendiente",
    siguientePaso:
      "Crear la aplicación de MONYS Glam con la cuenta propietaria y autorizar lectura/escritura. Primero se probarán publicaciones controladas; MONYS no cambiará precio ni stock sin revisión.",
    url: "https://developers.mercadolibre.com.mx/devcenter/home",
    enlace: "Abrir DevCenter",
    documentacion:
      "https://developers.mercadolibre.com.mx/es_mx/crea-una-aplicacion-en-mercado-libre-es",
    enlaceDocumentacion: "Ver requisitos de conexión",
    destinoInterno: "plan-crecimiento-marketing",
    accionInterna: "Revisar producto e inventario",
    capacidad: "Catálogo, ventas, pedidos y rentabilidad",
  },
  {
    id: "whatsapp",
    marca: "WhatsApp Business",
    detalle: "Mensajes, seguimiento y conversión",
    icono: "W",
    estado: "Número empresarial por vincular",
    siguientePaso:
      "Vincular el número empresarial mediante WhatsApp Cloud API y aprobar plantillas cuando correspondan. Los mensajes automáticos deberán respetar consentimiento y baja del cliente.",
    url: "https://developers.facebook.com/docs/whatsapp/cloud-api/",
    enlace: "Abrir documentación oficial",
    destinoInterno: "campanas-marketing-activas",
    accionInterna: "Preparar seguimiento en MONYS",
    capacidad: "Prospectos, respuestas y cierre de venta",
  },
  {
    id: "openai",
    marca: "ChatGPT Ads",
    detalle: "Anuncios dentro de ChatGPT · OpenAI Ads API",
    icono: "✳",
    estado: "Cuenta y acceso a API por confirmar",
    siguientePaso:
      "Confirma que MONYS Glam tenga cuenta de anunciante y acceso a Ads API. La clave es específica de la cuenta y debe guardarse solo en el servidor; primero se verifica la cuenta y los anuncios se preparan pausados.",
    url: "https://ads.openai.com/",
    enlace: "Abrir Ads Manager",
    documentacion: "https://developers.openai.com/ads/api-overview",
    enlaceDocumentacion: "Ver guía oficial de la API",
    destinoInterno: "campanas-marketing-activas",
    accionInterna: "Preparar anuncio en MONYS",
    capacidad: "Anuncios, medición y optimización",
  },
];

export default function CanalesPublicidadGrowth() {
  const conexionesConAvance = CANALES_CRECIMIENTO.filter(
    (canal) => canal.estadoTipo === "parcial" || canal.estadoTipo === "listo"
  ).length;

  return (
    <section
      className="growth-paid-channels"
      aria-labelledby="growth-paid-channels-title"
    >
      <div className="growth-paid-channels__heading">
        <div>
          <span className="growth-paid-channels__eyebrow">
            Capa de ejecución externa
          </span>
          <h3 id="growth-paid-channels-title">
            Conexiones de crecimiento
          </h3>
          <p>
            La Agencia IA ya puede preparar estrategia, contenido y medición. Para publicar,
            sincronizar pedidos o ejecutar anuncios necesita autorización oficial de cada cuenta.
          </p>
        </div>
        <span className="growth-paid-channels__guard">
          Sin publicar ni gastar
        </span>
      </div>

      <div className="growth-paid-channels__summary" aria-label="Estado de conexiones">
        <strong>{conexionesConAvance} canal con avance comprobado</strong>
        <span>{CANALES_CRECIMIENTO.length - conexionesConAvance} conexiones técnicas pendientes</span>
      </div>

      <div className="growth-paid-channels__grid">
        {CANALES_CRECIMIENTO.map((canal) => (
          <article
            className="growth-paid-channel"
            key={canal.id}
          >
            <div className={`growth-paid-channel__icon growth-paid-channel__icon--${canal.id}`}>
              {canal.icono}
            </div>
            <div className="growth-paid-channel__brand">
              <h4>{canal.marca}</h4>
              <span>{canal.detalle}</span>
            </div>
            <div
              className={`growth-paid-channel__status growth-paid-channel__status--${canal.estadoTipo || "pendiente"}`}
            >
              <span aria-hidden="true" />
              {canal.estado}
            </div>
            {canal.progreso && (
              <div className="growth-paid-channel__progress">
                <strong>{canal.progreso}</strong>
                <div className="growth-paid-channel__milestones">
                  {canal.hitos.map((hito) => (
                    <span
                      className={`growth-paid-channel__milestone growth-paid-channel__milestone--${hito.estado}`}
                      key={hito.texto}
                    >
                      <b aria-hidden="true">
                        {hito.estado === "listo" ? "✓" : hito.estado === "bloqueado" ? "🔒" : "○"}
                      </b>
                      {hito.texto}
                    </span>
                  ))}
                </div>
              </div>
            )}
            <div className="growth-paid-channel__capability">
              Entregará: {canal.capacidad}
            </div>
            <p>{canal.siguientePaso}</p>
            <div className="growth-paid-channel__links">
              <a
                className="growth-paid-channel__internal-action"
                href={`#${canal.destinoInterno}`}
              >
                {canal.accionInterna}
                <span aria-hidden="true">→</span>
              </a>
              <a
                href={canal.url}
                target="_blank"
                rel="noreferrer"
              >
                {canal.enlace}
                <span aria-hidden="true">↗</span>
              </a>
              {canal.documentacion && (
                <a
                  href={canal.documentacion}
                  target="_blank"
                  rel="noreferrer"
                >
                  {canal.enlaceDocumentacion}
                  <span aria-hidden="true">↗</span>
                </a>
              )}
            </div>
          </article>
        ))}
      </div>
      <p className="growth-paid-channels__note">
        Cada anuncio debe quedar en borrador y pausado hasta confirmar cuenta, producto,
        presupuesto y autorización de Mónica.
      </p>
    </section>
  );
}
