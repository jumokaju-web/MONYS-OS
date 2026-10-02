import "./CanalesPublicidadGrowth.css";

const CANALES_CRECIMIENTO = [
  {
    id: "meta",
    marca: "Meta Ads",
    detalle: "Facebook e Instagram",
    icono: "M",
    estado: "Acceso a MONYS Glam pendiente",
    siguientePaso:
      "Si solo aparece tu perfil personal, un administrador de MONYS Glam debe darte acceso a su cuenta publicitaria desde la configuración del negocio. Después confirma que ves la cuenta de empresa; no compartas contraseñas.",
    url: "https://business.facebook.com/adsmanager",
    enlace: "Abrir Meta Business",
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
    capacidad: "Anuncios, medición y optimización",
  },
];

export default function CanalesPublicidadGrowth() {
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
            <div className="growth-paid-channel__status">
              <span aria-hidden="true" />
              {canal.estado}
            </div>
            <div className="growth-paid-channel__capability">
              Entregará: {canal.capacidad}
            </div>
            <p>{canal.siguientePaso}</p>
            <div className="growth-paid-channel__links">
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
