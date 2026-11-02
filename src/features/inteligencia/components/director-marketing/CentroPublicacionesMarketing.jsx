import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  crearBorradorPublicacion,
  obtenerPublicacionesMarketing,
  programarPublicacionMarketing,
  rechazarPublicacionMarketing,
  resolverAprobacionPublicacion,
  solicitarAprobacionPublicacion,
} from "../../services/publicacionesMarketingService";
import { obtenerClientesAgenciaMarketing } from "../../services/clientesAgenciaMarketingService";
import {
  clasificarPublicacionesContenido,
  validarComentarioDecision,
} from "../../utils/bandejaContenidoMarketing";
import CentroAutomatizacionMarketing from "./CentroAutomatizacionMarketing";
import CalendarioCampanasMarketing from "./CalendarioCampanasMarketing";
import CentroResultadosCampanas from "./CentroResultadosCampanas";
import PlanSemanalContenidoMarketing from "./PlanSemanalContenidoMarketing";

import "./CentroPublicacionesMarketing.css";

const CANALES = [
  "TIKTOK",
  "INSTAGRAM",
  "FACEBOOK",
  "WHATSAPP",
  "TIKTOK_SHOP",
  "MERCADO_LIBRE",
];

function etiquetaEstado(publicacion) {
  const estadoNormalizado = String(
    publicacion?.estado || "BORRADOR"
  ).toUpperCase();

  if (estadoNormalizado === "PROGRAMADA") {
    return "Agendada en MONYS · sin publicar";
  }

  if (estadoNormalizado === "APROBADA") {
    return "Aprobada · lista para publicación manual";
  }

  if (estadoNormalizado === "PENDIENTE_APROBACION") {
    return publicacion?.requiere_autorizacion_duena
      ? "Pendiente de Mónica"
      : "Lista para revisión de Kary";
  }

  if (estadoNormalizado === "REQUIERE_AJUSTES") {
    return "Requiere ajustes de Kary";
  }

  return estadoNormalizado
    .replaceAll("_", " ")
    .toLowerCase()
    .replace(/^./, (letra) => letra.toUpperCase());
}

function contenidosDesdeKit(kit, canales, productos = []) {
  const mensaje = kit?.mensajeCentral || {};

  return Object.fromEntries(
    canales.map((canal) => {
      if (canal === "TIKTOK") {
        return [canal, kit?.tiktok || {}];
      }

      if (canal === "WHATSAPP") {
        return [canal, kit?.whatsapp || {}];
      }

      if (canal === "TIKTOK_SHOP") {
        const contenidoShop =
          kit?.tiktokShop || kit?.tiktok || {};

        return [
          canal,
          {
            ...contenidoShop,
            textoPublicacion:
              contenidoShop.textoPublicacion ||
              kit?.tiktok?.textoPublicacion ||
              [
                mensaje.gancho,
                mensaje.beneficio,
                mensaje.oferta,
                mensaje.llamadoAComprar,
              ]
                .filter(Boolean)
                .join("\n\n"),
            llamadoAComprar:
              contenidoShop.llamadoAComprar ||
              kit?.tiktok?.llamadoAComprar ||
              mensaje.llamadoAComprar ||
              "",
            guion:
              contenidoShop.guion ||
              kit?.tiktok?.guion ||
              [],
            productosParaEtiquetar: productos,
            instruccionesShop: [
              "Antes de publicar, confirma que cada producto esté disponible y etiquétalo en TikTok Shop.",
              "La cola de MONYS todavía no publica directamente en TikTok Shop.",
            ],
          },
        ];
      }

      if (canal === "MERCADO_LIBRE") {
        return [canal, kit?.mercadoLibre || {}];
      }

      if (canal === "INSTAGRAM" || canal === "FACEBOOK") {
        return [
          canal,
          {
            texto:
              kit?.marcaPersonal?.textoPublicacion ||
              [
                mensaje.gancho,
                mensaje.beneficio,
                mensaje.oferta,
                mensaje.llamadoAComprar,
              ]
                .filter(Boolean)
                .join("\n\n"),
            instrucciones:
              kit?.marcaPersonal?.instruccionesGrabacion ||
              [],
          },
        ];
      }

      return [canal, {}];
    })
  );
}

function textoContenido(contenido) {
  if (!contenido || typeof contenido !== "object") {
    return "Contenido todavía no disponible.";
  }

  const lineas = [
    contenido.titulo,
    contenido.gancho,
    contenido.texto,
    contenido.textoPublicacion,
    contenido.descripcion,
    contenido.beneficio,
    contenido.oferta,
    contenido.llamadoAComprar,
    contenido.cta,
    ...(Array.isArray(contenido.guion)
      ? contenido.guion
      : []),
  ]
    .map((linea) => String(linea || "").trim())
    .filter(Boolean);

  return [...new Set(lineas)].join("\n\n") ||
    "Contenido preparado sin texto de vista previa.";
}

export default function CentroPublicacionesMarketing({
  usuario,
  organizationId,
  businessId,
  branchId = null,
  campana = null,
  kit = null,
  productoPrincipal = "",
  soloRevision = false,
}) {
  const [productosTexto, setProductosTexto] =
    useState(productoPrincipal || "");

  const [canales, setCanales] = useState([
    "TIKTOK",
    "INSTAGRAM",
    "FACEBOOK",
  ]);
  const [tipoCampana, setTipoCampana] = useState("ORGANICA");
  const [presupuestoPropuesto, setPresupuestoPropuesto] = useState(0);
  const [clientesAgencia, setClientesAgencia] = useState([]);
  const [clienteAgenciaId, setClienteAgenciaId] = useState("");

  const [publicaciones, setPublicaciones] =
    useState([]);

  const [cargando, setCargando] =
    useState(false);

  const [guardando, setGuardando] =
    useState(false);

  const [error, setError] = useState("");
  const [mensaje, setMensaje] = useState("");

  const [fechasProgramacion, setFechasProgramacion] =
    useState({});
  const [comentariosRevision, setComentariosRevision] = useState({});
  const [vistaCola, setVistaCola] = useState(soloRevision ? "REVISION" : "TRABAJO");
  const [resolviendoId, setResolviendoId] = useState("");

  const esPropietaria = [
    "owner",
    "admin",
  ].includes(
    String(usuario?.role || "").toLowerCase()
  );
  const esMarketing = String(usuario?.role || "").toLowerCase() === "marketing";
  const puedeRevisar = esPropietaria || esMarketing;

  const clienteSeleccionado = useMemo(
    () => clientesAgencia.find((cliente) => cliente.id === clienteAgenciaId) || null,
    [clientesAgencia, clienteAgenciaId]
  );

  const clientesPorId = useMemo(
    () => new Map(clientesAgencia.map((cliente) => [cliente.id, cliente])),
    [clientesAgencia]
  );

  const productos = useMemo(
    () =>
      productosTexto
        .split(/\n|,/)
        .map((producto) => producto.trim())
        .filter(Boolean),
    [productosTexto]
  );

  const publicacionesOrdenadas = useMemo(() => {
    const prioridadEstado = {
      PENDIENTE_APROBACION: 0,
      APROBADA: 1,
      PROGRAMADA: 2,
      REQUIERE_AJUSTES: 3,
      BORRADOR: 4,
    };

    return [...publicaciones].sort((a, b) => {
      const prioridadA =
        prioridadEstado[a?.estado] ?? 9;
      const prioridadB =
        prioridadEstado[b?.estado] ?? 9;

      if (prioridadA !== prioridadB) {
        return prioridadA - prioridadB;
      }

      return new Date(b?.created_at || 0) -
        new Date(a?.created_at || 0);
    });
  }, [publicaciones]);

  const pendientesAprobacion = publicaciones.filter(
    (publicacion) =>
      publicacion.estado === "PENDIENTE_APROBACION"
  ).length;

  const publicacionesVisibles = useMemo(
    () => clasificarPublicacionesContenido(publicacionesOrdenadas, vistaCola),
    [publicacionesOrdenadas, vistaCola]
  );

  const conteosCola = useMemo(
    () => ({
      REVISION: clasificarPublicacionesContenido(publicaciones, "REVISION").length,
      TRABAJO: clasificarPublicacionesContenido(publicaciones, "TRABAJO").length,
      HISTORIAL: clasificarPublicacionesContenido(publicaciones, "HISTORIAL").length,
    }),
    [publicaciones]
  );

  const cargarPublicaciones = useCallback(async () => {
    if (!organizationId) {
      return;
    }

    try {
      setCargando(true);
      setError("");

      const registros =
        await obtenerPublicacionesMarketing({
          organizationId,
          businessId,
          branchId,
        });

      setPublicaciones(registros);
    } catch (errorCarga) {
      console.error(
        "Error cargando publicaciones:",
        errorCarga
      );

      setError(
        "No fue posible cargar la cola de publicaciones."
      );
    } finally {
      setCargando(false);
    }
  }, [organizationId, businessId, branchId]);

  useEffect(() => {
    cargarPublicaciones();
  }, [cargarPublicaciones]);

  useEffect(() => {
    let vigente = true;

    async function cargarClientes() {
      if (!organizationId) {
        return;
      }

      try {
        const registros = await obtenerClientesAgenciaMarketing({ organizationId });
        if (!vigente) {
          return;
        }

        const activos = registros.filter((cliente) => cliente.estado === "ACTIVO");
        setClientesAgencia(activos);
        setClienteAgenciaId((actual) => {
          if (activos.some((cliente) => cliente.id === actual)) {
            return actual;
          }

          return activos.find((cliente) => cliente.tipo === "INTERNO")?.id || activos[0]?.id || "";
        });
      } catch (errorClientes) {
        if (vigente) {
          setError(errorClientes?.message || "No fue posible cargar los negocios de la agencia.");
        }
      }
    }

    cargarClientes();
    return () => {
      vigente = false;
    };
  }, [organizationId]);

  function cambiarCanal(canal) {
    setCanales((actuales) =>
      actuales.includes(canal)
        ? actuales.filter(
            (elemento) => elemento !== canal
          )
        : [...actuales, canal]
    );
  }

  async function guardarBorrador() {
    try {
      setGuardando(true);
      setError("");
      setMensaje("");

      await crearBorradorPublicacion({
        organizationId,
        businessId,
        clienteAgenciaId,
        branchId,
        campanaId: campana?.id || null,
        productos,
        canales,
        contenidosPorCanal:
          contenidosDesdeKit(kit, canales, productos),
        tipoCampana,
        presupuestoPropuesto,
      });

      setMensaje(
        "Borrador multicanal guardado. Ya puede enviarse a autorización."
      );

      await cargarPublicaciones();
    } catch (errorGuardado) {
      setError(
        errorGuardado?.message ||
          "No fue posible guardar el borrador."
      );
    } finally {
      setGuardando(false);
    }
  }

  async function enviarAAprobacion(publicacionId) {
    try {
      setError("");
      await solicitarAprobacionPublicacion(
        publicacionId
      );
      setMensaje(
        "Publicación enviada a autorización."
      );
      await cargarPublicaciones();
    } catch (errorSolicitud) {
      setError(
        errorSolicitud?.message ||
          "No fue posible solicitar autorización."
      );
    }
  }

  async function resolver(publicacionId, aprobar) {
    const publicacion = publicaciones.find(
      (elemento) => elemento.id === publicacionId
    );
    const esPagada = publicacion?.tipo_campana === "PAGADA";
    let comentario = "";

    try {
      comentario = validarComentarioDecision(
        aprobar ? "APROBAR" : "AJUSTAR",
        comentariosRevision[publicacionId]
      );
    } catch (errorComentario) {
      setError(errorComentario.message);
      return;
    }

    const confirmacion = window.confirm(
      aprobar
        ? esPagada
          ? `¿Autorizas el contenido y un presupuesto máximo de $${Number(publicacion?.presupuesto_propuesto || 0).toLocaleString("es-MX")} MXN? MONYS todavía no enviará el gasto hasta conectar el canal.`
          : "¿Autorizas este contenido orgánico para programación? No incluye gasto."
        : "¿Quieres devolver este contenido a Kary para que haga ajustes?"
    );

    if (!confirmacion) {
      return;
    }

    try {
      setResolviendoId(publicacionId);
      setError("");
      await resolverAprobacionPublicacion({
        publicacionId,
        aprobar,
        observaciones: aprobar
          ? comentario || (esPagada
              ? "Contenido y presupuesto autorizados."
              : "Contenido orgánico autorizado.")
          : comentario,
      });
      setMensaje(
        aprobar
          ? "Contenido autorizado. Quedó listo para programar; la publicación externa se activará al conectar el canal."
          : "Publicación devuelta para ajustes."
      );
      await cargarPublicaciones();
      setComentariosRevision((actuales) => ({ ...actuales, [publicacionId]: "" }));
    } catch (errorResolucion) {
      setError(
        errorResolucion?.message ||
          "No fue posible resolver la autorización."
      );
    } finally {
      setResolviendoId("");
    }
  }

  async function rechazar(publicacionId) {
    let comentario = "";
    try {
      comentario = validarComentarioDecision("RECHAZAR", comentariosRevision[publicacionId]);
    } catch (errorComentario) {
      setError(errorComentario.message);
      return;
    }

    if (!window.confirm("¿Rechazar definitivamente esta propuesta? Permanecerá en el historial para auditoría.")) return;

    try {
      setResolviendoId(publicacionId);
      setError("");
      await rechazarPublicacionMarketing({ publicacionId, observaciones: comentario });
      setMensaje("Propuesta rechazada. Se conservó en el historial y no se publicará.");
      setComentariosRevision((actuales) => ({ ...actuales, [publicacionId]: "" }));
      await cargarPublicaciones();
    } catch (errorRechazo) {
      setError(errorRechazo?.message || "No fue posible rechazar la propuesta.");
    } finally {
      setResolviendoId("");
    }
  }

  async function programar(publicacionId) {
    try {
      setError("");
      setMensaje("");

      await programarPublicacionMarketing({
        publicacionId,
        programadaPara:
          fechasProgramacion[publicacionId],
      });

      setMensaje(
        "Quedó en la agenda interna de MONYS. Todavía no se publicó en redes: falta conectar el canal."
      );

      await cargarPublicaciones();
    } catch (errorProgramacion) {
      setError(
        errorProgramacion?.message ||
          "No fue posible programar la publicación."
      );
    }
  }

  function prepararIdeaSemanal(idea) {
    setClienteAgenciaId(idea.clienteId);
    setProductosTexto(idea.productoConfirmado ? idea.producto : "");
    setCanales([idea.canal]);
    setTipoCampana("ORGANICA");
    setVistaCola("TRABAJO");
    setMensaje(
      idea.productoConfirmado
        ? `${idea.dia}: ${idea.canal.replaceAll("_", " ")} y ${idea.producto} quedaron seleccionados. Revisa el kit y guarda el borrador.`
        : `${idea.dia}: primero escribe el producto real; MONYS no lo inventó.`
    );
    window.setTimeout(() => {
      document.getElementById("marketing-content-factory")?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 0);
  }

  return (
    <>
    <CentroAutomatizacionMarketing
      usuario={usuario}
      organizationId={organizationId}
      businessId={businessId}
    />
    <section
      className="marketing-publisher"
      style={{
        marginTop: "16px",
        padding: "16px",
        border: "1px solid #e8cddd",
        borderRadius: "18px",
        background:
          "linear-gradient(145deg, #fff8fc, #ffffff)",
      }}
    >
      <div className="marketing-publisher__steps" aria-label="Flujo para publicar una campaña">
        <div className={clienteAgenciaId ? "is-ready" : ""}><b>1</b><span><strong>Marca</strong><small>Elegir negocio</small></span></div>
        <div className={productos.length && canales.length ? "is-ready" : ""}><b>2</b><span><strong>Campaña</strong><small>Contenido y canales</small></span></div>
        <div><b>3</b><span><strong>Revisión</strong><small>Aprobar y programar</small></span></div>
      </div>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          gap: "12px",
          alignItems: "flex-start",
          flexWrap: "wrap",
        }}
      >
        <div>
          <strong
            style={{ color: "#7a234f" }}
          >
            {soloRevision
              ? "Bandeja de aprobación"
              : "Fábrica de contenido"}
          </strong>
          <div
            style={{
              marginTop: "4px",
              color: "#7d6470",
              fontSize: "12px",
            }}
          >
            {soloRevision
              ? "Revisa una propuesta a la vez: aprobar, pedir cambios o rechazar. Kary trabaja dentro de sus límites y Mónica autoriza las excepciones."
              : "Convierte un producto y un objetivo en piezas por canal, listas para revisión y calendario."}
          </div>
        </div>

        <span
          style={{
            padding: "6px 9px",
            borderRadius: "999px",
            background: "#f5e4ed",
            color: "#7a234f",
            fontSize: "10px",
            fontWeight: "900",
          }}
        >
          {soloRevision
            ? `${pendientesAprobacion} por autorizar`
            : `${publicaciones.length} en cola`}
        </span>
      </div>

      <nav className="marketing-publisher__queue-tabs" aria-label="Vistas de la fábrica de contenido">
        {[
          ["REVISION", "Por revisar"],
          ["TRABAJO", "En preparación"],
          ["HISTORIAL", "Historial"],
        ].map(([valor, etiqueta]) => (
          <button
            key={valor}
            type="button"
            className={vistaCola === valor ? "is-active" : ""}
            aria-pressed={vistaCola === valor}
            onClick={() => setVistaCola(valor)}
          >
            <span>{conteosCola[valor]}</span>{etiqueta}
          </button>
        ))}
      </nav>

      <div
        role="status"
        style={{
          marginTop: "12px",
          padding: "10px 12px",
          border: "1px solid #ead8a8",
          borderRadius: "12px",
          background: "#fff9e9",
          color: "#66521d",
          fontSize: "11px",
          lineHeight: 1.5,
        }}
      >
        <strong>Publicación directa: por conectar.</strong>{" "}
        Esta cola guarda, autoriza y agenda dentro de MONYS; todavía no
        envía contenido a Instagram, Facebook, TikTok, TikTok Shop ni
        Mercado Libre. La fecha programada es interna y no significa que
        ya se publicó.
      </div>

      <PlanSemanalContenidoMarketing
        clientes={clientesAgencia}
        publicaciones={publicacionesOrdenadas}
        productoPreferido={productoPrincipal}
        soloLectura={soloRevision}
        onPreparar={prepararIdeaSemanal}
      />

      <CalendarioCampanasMarketing
        publicaciones={publicacionesOrdenadas}
        clientesPorId={clientesPorId}
      />

      <CentroResultadosCampanas
        organizationId={organizationId}
        publicaciones={publicacionesOrdenadas}
        clientesPorId={clientesPorId}
      />

      {!soloRevision && (
        <>
      <div className="marketing-publisher__brand" id="marketing-content-factory">
        <label htmlFor="marketing-client">¿Para qué negocio es esta campaña?</label>
        <select
          id="marketing-client"
          value={clienteAgenciaId}
          onChange={(evento) => setClienteAgenciaId(evento.target.value)}
        >
          <option value="">Selecciona un negocio o cliente</option>
          {clientesAgencia.map((cliente) => (
            <option key={cliente.id} value={cliente.id}>
              {cliente.nombre} · {cliente.tipo === "INTERNO" ? "Negocio propio" : "Cliente externo"}
            </option>
          ))}
        </select>
        {clienteSeleccionado && (
          <div>
            <b>{clienteSeleccionado.nombre.slice(0, 1).toUpperCase()}</b>
            <span><strong>{clienteSeleccionado.nombre}</strong><small>{clienteSeleccionado.objetivo_principal || "Objetivo por definir"}</small></span>
            <i>{clienteSeleccionado.tipo === "INTERNO" ? "Monys" : "Agencia"}</i>
          </div>
        )}
      </div>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
          gap: "8px",
          marginTop: "14px",
        }}
      >
        {[
          ["ORGANICA", "Orgánica", "Sin gasto publicitario"],
          ["PAGADA", "Pagada", "Con presupuesto y autorización"],
        ].map(([valor, titulo, detalle]) => (
          <button
            key={valor}
            type="button"
            onClick={() => setTipoCampana(valor)}
            aria-pressed={tipoCampana === valor}
            style={{
              padding: "11px",
              border: tipoCampana === valor
                ? "2px solid #8f2b5c"
                : "1px solid #dfcbd5",
              borderRadius: "12px",
              background: tipoCampana === valor ? "#fff0f6" : "#fff",
              color: "#5d3548",
              textAlign: "left",
              cursor: "pointer",
            }}
          >
            <strong style={{ display: "block", fontSize: "12px" }}>
              {tipoCampana === valor ? "✓ " : ""}{titulo}
            </strong>
            <small style={{ display: "block", marginTop: "3px" }}>{detalle}</small>
          </button>
        ))}
      </div>

      {tipoCampana === "PAGADA" && (
        <label
          style={{
            display: "grid",
            gap: "6px",
            marginTop: "12px",
            color: "#684b59",
            fontSize: "12px",
            fontWeight: "800",
          }}
        >
          Presupuesto máximo propuesto (MXN)
          <input
            type="number"
            min="1"
            step="50"
            value={presupuestoPropuesto}
            onChange={(evento) => setPresupuestoPropuesto(evento.target.value)}
            style={{
              padding: "11px",
              border: "1px solid #ddc3d0",
              borderRadius: "12px",
              font: "inherit",
            }}
          />
          <small style={{ color: "#826d78", fontWeight: "600" }}>
            Si excede el límite configurado, solamente Mónica podrá autorizarla.
          </small>
        </label>
      )}
      <label
        style={{
          display: "grid",
          gap: "6px",
          marginTop: "14px",
          color: "#684b59",
          fontSize: "12px",
          fontWeight: "800",
        }}
      >
        Productos, uno por línea
        <textarea
          value={productosTexto}
          onChange={(event) =>
            setProductosTexto(event.target.value)
          }
          rows={3}
          placeholder="Ej. Base Moira\nLabial hidratante\nMáscara de pestañas"
          style={{
            padding: "11px",
            border: "1px solid #ddc3d0",
            borderRadius: "12px",
            font: "inherit",
          }}
        />
      </label>

      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: "8px",
          marginTop: "12px",
        }}
      >
        {CANALES.map((canal) => (
          <button
            key={canal}
            type="button"
            onClick={() => cambiarCanal(canal)}
            style={{
              padding: "8px 10px",
              border: canales.includes(canal)
                ? "1px solid #9d245b"
                : "1px solid #ddcfd6",
              borderRadius: "999px",
              background: canales.includes(canal)
                ? "#fff0f6"
                : "#ffffff",
              color: canales.includes(canal)
                ? "#8b1f51"
                : "#70616a",
              fontSize: "10px",
              fontWeight: "900",
              cursor: "pointer",
            }}
          >
            {canales.includes(canal) ? "✓ " : ""}
            {canal.replaceAll("_", " ")}
          </button>
        ))}
      </div>

      <button
        type="button"
        onClick={guardarBorrador}
        disabled={guardando || !kit || !clienteAgenciaId}
        style={{
          width: "100%",
          marginTop: "14px",
          padding: "12px",
          border: "none",
          borderRadius: "12px",
          background: "#7a234f",
          color: "#fff",
          fontWeight: "900",
          cursor: kit && clienteAgenciaId ? "pointer" : "not-allowed",
          opacity: kit && clienteAgenciaId ? 1 : 0.55,
        }}
      >
        {guardando
          ? "Guardando..."
          : "Guardar borrador multicanal"}
      </button>
        </>
      )}

      {mensaje && (
        <div style={{ marginTop: "10px", color: "#26734d", fontSize: "12px" }}>
          {mensaje}
        </div>
      )}

      {error && (
        <div style={{ marginTop: "10px", color: "#a22525", fontSize: "12px" }}>
          {error}
        </div>
      )}

      <div
        style={{
          display: "grid",
          gap: "9px",
          marginTop: "14px",
        }}
      >
        {cargando ? (
          <div style={{ color: "#7d6470", fontSize: "12px" }}>
            Cargando cola...
          </div>
        ) : (
          publicacionesVisibles.slice(0, 8).map(
            (publicacion) => (
              <article
                key={publicacion.id}
                id={`marketing-publicacion-${publicacion.id}`}
                tabIndex={-1}
                style={{
                  padding: "11px",
                  border: "1px solid #eadce3",
                  borderRadius: "12px",
                  background: "#fff",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    gap: "10px",
                    fontSize: "11px",
                  }}
                >
                  <strong style={{ color: "#6f2d5f" }}>
                    {(publicacion.productos || [])
                      .map((item) => item.nombre)
                      .join(", ") || "Publicación"}
                  </strong>
                  <span>{etiquetaEstado(publicacion)}</span>
                </div>

                <div className="marketing-publisher__client-badge">
                  {clientesPorId.get(publicacion.cliente_agencia_id)?.nombre || "Campaña anterior · cliente por asignar"}
                </div>

                <div
                  style={{
                    marginTop: "5px",
                    color: "#806f78",
                    fontSize: "10px",
                  }}
                >
                  {(publicacion.canales || [])
                    .join(" · ")}
                </div>

                <div
                  style={{
                    marginTop: "6px",
                    color: publicacion.tipo_campana === "PAGADA" ? "#8a4d00" : "#176b4b",
                    fontSize: "10px",
                    fontWeight: "900",
                  }}
                >
                  {publicacion.tipo_campana === "PAGADA"
                    ? `Campaña pagada · presupuesto propuesto $${Number(publicacion.presupuesto_propuesto || 0).toLocaleString("es-MX")} MXN`
                    : "Campaña orgánica · sin gasto publicitario"}
                </div>

                {publicacion.programada_para && (
                  <div
                    style={{
                      marginTop: "5px",
                      color: "#6f2d5f",
                      fontSize: "10px",
                      fontWeight: "800",
                    }}
                  >
                    Programada: {new Date(
                      publicacion.programada_para
                    ).toLocaleString("es-MX")}
                  </div>
                )}

                {publicacion.observaciones_aprobacion && (
                  <div className="marketing-publisher__review-note">
                    <strong>Comentario de revisión</strong>
                    <span>{publicacion.observaciones_aprobacion}</span>
                  </div>
                )}

                <details
                  style={{
                    marginTop: "9px",
                    padding: "8px 9px",
                    borderRadius: "9px",
                    background: "#fff8fb",
                    color: "#684b59",
                    fontSize: "10px",
                  }}
                >
                  <summary
                    style={{
                      cursor: "pointer",
                      fontWeight: "900",
                    }}
                  >
                    Revisar contenido por canal
                  </summary>

                  <div
                    style={{
                      display: "grid",
                      gap: "8px",
                      marginTop: "9px",
                    }}
                  >
                    {Object.entries(
                      publicacion.contenidos_por_canal || {}
                    ).map(([canal, contenido]) => (
                      <div
                        key={canal}
                        style={{
                          padding: "9px",
                          border: "1px solid #eadce3",
                          borderRadius: "9px",
                          background: "#ffffff",
                        }}
                      >
                        <strong>{canal.replaceAll("_", " ")}</strong>
                        <div
                          style={{
                            marginTop: "5px",
                            lineHeight: 1.5,
                            whiteSpace: "pre-wrap",
                          }}
                        >
                          {textoContenido(contenido)}
                        </div>
                      </div>
                    ))}
                  </div>
                </details>

                {!soloRevision && [
                  "BORRADOR",
                  "REQUIERE_AJUSTES",
                ].includes(publicacion.estado) && (
                  <button
                    type="button"
                    onClick={() =>
                      enviarAAprobacion(publicacion.id)
                    }
                    style={{
                      marginTop: "9px",
                      padding: "8px 10px",
                      border: "none",
                      borderRadius: "9px",
                      background: "#9d245b",
                      color: "#fff",
                      fontSize: "10px",
                      fontWeight: "900",
                      cursor: "pointer",
                    }}
                  >
                    Enviar a autorización
                  </button>
                )}

                {puedeRevisar &&
                  publicacion.estado ===
                    "PENDIENTE_APROBACION" &&
                  !(esMarketing && publicacion.requiere_autorizacion_duena) && (
                    <div className="marketing-publisher__decision">
                      <label>
                        Comentario para el equipo
                        <textarea
                          rows={2}
                          value={comentariosRevision[publicacion.id] || ""}
                          onChange={(evento) => setComentariosRevision((actuales) => ({
                            ...actuales,
                            [publicacion.id]: evento.target.value,
                          }))}
                          placeholder="Obligatorio para pedir cambios o rechazar"
                          maxLength={500}
                        />
                      </label>
                      <div>
                      <button
                        type="button"
                        disabled={resolviendoId === publicacion.id}
                        onClick={() =>
                          resolver(publicacion.id, true)
                        }
                        className="is-approve"
                      >
                        ✓ Aprobar
                      </button>
                      <button
                        type="button"
                        disabled={resolviendoId === publicacion.id}
                        onClick={() =>
                          resolver(publicacion.id, false)
                        }
                        className="is-adjust"
                      >
                        ↻ Pedir cambios
                      </button>
                      <button
                        type="button"
                        disabled={resolviendoId === publicacion.id}
                        onClick={() => rechazar(publicacion.id)}
                        className="is-reject"
                      >
                        × Rechazar
                      </button>
                      </div>
                    </div>
                  )}

                {esMarketing &&
                  publicacion.estado === "PENDIENTE_APROBACION" &&
                  publicacion.requiere_autorizacion_duena && (
                    <div
                      style={{
                        marginTop: "9px",
                        padding: "9px 10px",
                        borderRadius: "9px",
                        background: "#fff7e5",
                        color: "#7a5710",
                        fontSize: "10px",
                        fontWeight: "800",
                      }}
                    >
                      El presupuesto supera la autorización de Kary. Esperando a Mónica.
                    </div>
                  )}

                {puedeRevisar &&
                  ["APROBADA", "PROGRAMADA"].includes(
                    publicacion.estado
                  ) && (
                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns: "1fr auto",
                        gap: "8px",
                        marginTop: "9px",
                      }}
                    >
                      <input
                        type="datetime-local"
                        value={
                          fechasProgramacion[
                            publicacion.id
                          ] || ""
                        }
                        onChange={(event) =>
                          setFechasProgramacion(
                            (actuales) => ({
                              ...actuales,
                              [publicacion.id]:
                                event.target.value,
                            })
                          )
                        }
                        aria-label="Fecha y hora para la agenda de MONYS"
                        style={{
                          minWidth: 0,
                          padding: "8px",
                          border:
                            "1px solid #ddcfd6",
                          borderRadius: "9px",
                          fontSize: "10px",
                        }}
                      />
                      <button
                        type="button"
                        onClick={() =>
                          programar(publicacion.id)
                        }
                        style={{
                          padding: "8px 10px",
                          border: "none",
                          borderRadius: "9px",
                          background: "#4d1837",
                          color: "#ffffff",
                          fontSize: "10px",
                          fontWeight: "900",
                          cursor: "pointer",
                        }}
                      >
                        Programar en MONYS
                      </button>
                    </div>
                  )}
              </article>
            )
          )
        )}

        {!cargando && publicacionesVisibles.length === 0 && (
          <div
            style={{
              padding: "14px",
              border: "1px dashed #d9bdca",
              borderRadius: "12px",
              background: "#ffffff",
              color: "#765f6b",
              fontSize: "12px",
              lineHeight: 1.5,
              textAlign: "center",
            }}
          >
            {soloRevision
              ? vistaCola === "REVISION"
                ? "No hay propuestas esperando tu decisión."
                : "No hay contenido en esta sección."
              : "No hay contenido en esta sección de la fábrica."}
          </div>
        )}
      </div>
    </section>
    </>
  );
}
