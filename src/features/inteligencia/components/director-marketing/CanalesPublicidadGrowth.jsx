import "./CanalesPublicidadGrowth.css";

const CANALES_PAGADOS = [
  {
    id: "meta",
    marca: "Meta Ads",
    detalle: "Facebook e Instagram",
    icono: "M",
    estado: "Falta conectar la cuenta comercial",
    siguientePaso:
      "Entra con el perfil que administra MONYS Glam y confirma que aparezca su cuenta publicitaria de empresa. No conectes una cuenta personal.",
    url: "https://business.facebook.com/adsmanager",
    enlace: "Abrir Meta Business",
  },
  {
    id: "openai",
    marca: "OpenAI Ads",
    detalle: "Anuncios dentro de ChatGPT",
    icono: "✳",
    estado: "Falta habilitar y conectar Ads",
    siguientePaso:
      "Confirma acceso de anunciante en Ads Manager. La conexión técnica de MONYS requiere credencial segura del API de Ads; nunca se pega en esta pantalla.",
    url: "https://ads.openai.com/",
    enlace: "Abrir OpenAI Ads",
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
            <a
              href={canal.url}
              target="_blank"
              rel="noreferrer"
            >
              {canal.enlace}
              <span aria-hidden="true">↗</span>
            </a>
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
