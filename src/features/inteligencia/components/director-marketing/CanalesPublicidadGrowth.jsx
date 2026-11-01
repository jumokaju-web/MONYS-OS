import "./CanalesPublicidadGrowth.css";

const CANALES_CRECIMIENTO = [
  {
    id: "instagram",
    marca: "Instagram",
    detalle: "Reels, historias, carruseles y mensajes",
    icono: "◎",
    estado: "Cuenta dentro de Meta · conexión técnica pendiente",
    estadoTipo: "parcial",
    tareas: ["Crear campaña", "Preparar contenido", "Reactivar seguidores", "Medir ventas"],
    siguientePaso:
      "Primero conectaremos Insights para saber qué seguidores siguen activos, qué contenido perdió alcance y qué formatos vuelven a generar conversaciones y ventas.",
    url: "https://business.facebook.com/",
    enlace: "Abrir Meta Business",
    destinoInterno: "campanas-marketing-activas",
    accionInterna: "Trabajar Instagram en MONYS",
  },
  {
    id: "facebook",
    marca: "Facebook",
    detalle: "Página, grupos, videos, catálogo y anuncios",
    icono: "f",
    estado: "Cuenta dentro de Meta · conexión técnica pendiente",
    estadoTipo: "parcial",
    tareas: ["Crear campaña", "Publicar en página", "Planear grupos", "Recuperar audiencia"],
    siguientePaso:
      "MONYS preparará una estrategia distinta para página, grupos y anuncios. No copiará automáticamente el mismo contenido de Instagram sin adaptarlo.",
    url: "https://business.facebook.com/",
    enlace: "Abrir Meta Business",
    destinoInterno: "campanas-marketing-activas",
    accionInterna: "Trabajar Facebook en MONYS",
  },
  {
    id: "tiktok",
    marca: "TikTok",
    detalle: "Videos, Lives, comunidad y anuncios",
    icono: "♪",
    estado: "Aplicación y autorización pendientes",
    tareas: ["Crear video", "Preparar Live", "Diseñar campaña", "Medir pedidos"],
    siguientePaso:
      "Kary podrá abrir el canal y recibir producto, gancho, guion, tomas, CTA y meta. La publicación directa se activará solo mediante la autorización oficial de TikTok.",
    url: "https://business-api.tiktok.com/portal",
    enlace: "Abrir TikTok Business",
    destinoInterno: "campanas-marketing-activas",
    accionInterna: "Trabajar TikTok en MONYS",
  },
  {
    id: "tiktokshop",
    marca: "TikTok Shop",
    detalle: "Productos, videos comprables, Live y promociones",
    icono: "TS",
    estado: "Seller Center disponible · integración pendiente",
    tareas: ["Elegir producto", "Preparar promoción", "Planear Live", "Revisar rentabilidad"],
    siguientePaso:
      "La campaña deberá cruzar existencia, precio, comisión y margen antes de recomendar una promoción o producto para Live.",
    url: "https://seller-mx.tiktok.com/",
    enlace: "Abrir Seller Center",
    destinoInterno: "plan-crecimiento-marketing",
    accionInterna: "Trabajar TikTok Shop en MONYS",
  },
  {
    id: "whatsapp",
    marca: "WhatsApp",
    detalle: "Estados, grupos, seguimiento y cierre",
    icono: "W",
    estado: "Número empresarial por vincular",
    tareas: ["Crear estado", "Preparar difusión", "Responder prospectos", "Cerrar pedidos"],
    siguientePaso:
      "MONYS preparará mensajes y seguimientos sin enviar spam. La automatización futura respetará consentimiento, horarios y solicitudes de baja.",
    url: "https://business.whatsapp.com/",
    enlace: "Abrir WhatsApp Business",
    destinoInterno: "campanas-marketing-activas",
    accionInterna: "Trabajar WhatsApp en MONYS",
  },
  {
    id: "mercadolibre",
    marca: "Mercado Libre",
    detalle: "Publicaciones, precio, stock, pedidos y publicidad",
    icono: "ML",
    estado: "Aplicación de vendedor pendiente",
    tareas: ["Crear publicación", "Mejorar título y fotos", "Revisar TACOS", "Medir utilidad"],
    siguientePaso:
      "La conexión comenzará en modo controlado. MONYS no cambiará precio, inventario ni publicidad sin revisar margen y autorización.",
    url: "https://developers.mercadolibre.com.mx/devcenter/home",
    enlace: "Abrir Mercado Libre",
    destinoInterno: "plan-crecimiento-marketing",
    accionInterna: "Trabajar Mercado Libre en MONYS",
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
            Centro de canales y ventas
          </span>
          <h3 id="growth-paid-channels-title">
            Elige dónde quiere trabajar Kary
          </h3>
          <p>
            Cada canal abre su propio tipo de campaña, contenido, calendario y
            resultado. La Agencia IA coordina el plan; Kary ejecuta y MONYS
            conserva evidencia y aprendizaje.
          </p>
        </div>
        <span className="growth-paid-channels__guard">
          Mónica controla publicación y gasto
        </span>
      </div>

      <div className="growth-paid-channels__summary" aria-label="Estado de conexiones">
        <strong>{CANALES_CRECIMIENTO.length} canales de trabajo preparados</strong>
        <span>{conexionesConAvance} con avance de conexión comprobado</span>
      </div>

      <div className="growth-paid-channels__grid">
        {CANALES_CRECIMIENTO.map((canal) => (
          <article className="growth-paid-channel" key={canal.id}>
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
            <div className="growth-paid-channel__tasks" aria-label={`Trabajo disponible para ${canal.marca}`}>
              {canal.tareas.map((tarea) => <span key={tarea}>{tarea}</span>)}
            </div>
            <p>{canal.siguientePaso}</p>
            <div className="growth-paid-channel__links">
              <a className="growth-paid-channel__internal-action" href={`#${canal.destinoInterno}`}>
                {canal.accionInterna}
                <span aria-hidden="true">→</span>
              </a>
              <a href={canal.url} target="_blank" rel="noreferrer">
                {canal.enlace}
                <span aria-hidden="true">↗</span>
              </a>
            </div>
          </article>
        ))}
      </div>
      <p className="growth-paid-channels__note">
        Preparar una campaña no significa publicarla. Hasta completar cada
        conexión oficial, MONYS crea borradores y Kary publica manualmente
        después de la autorización correspondiente.
      </p>
    </section>
  );
}
