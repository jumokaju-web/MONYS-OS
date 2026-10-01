import "./CanalesPublicidadGrowth.css";

const CANALES_PAGADOS = [
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
            Publicidad pagada
          </span>
          <h3 id="growth-paid-channels-title">
            Conexiones de anuncios
          </h3>
          <p>
            MONYS puede preparar la estrategia. Para ejecutar o medir anuncios desde aquí,
            primero debe tener acceso autorizado a la cuenta correcta.
          </p>
        </div>
        <span className="growth-paid-channels__guard">
          Sin publicar ni gastar
        </span>
      </div>

      <div className="growth-paid-channels__grid">
        {CANALES_PAGADOS.map((canal) => (
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
