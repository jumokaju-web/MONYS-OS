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
  resolverAprobacionPublicacion,
  solicitarAprobacionPublicacion,
} from "../../services/publicacionesMarketingService";

const CANALES = [
  "TIKTOK",
  "INSTAGRAM",
  "FACEBOOK",
  "WHATSAPP",
  "TIKTOK_SHOP",
  "MERCADO_LIBRE",
];

function etiquetaEstado(estado) {
  if (String(estado || "").toUpperCase() === "PROGRAMADA") {
    return "Agendada en MONYS · sin publicar";
  }

  return String(estado || "BORRADOR")
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

export default function CentroPublicacionesMarketing({
  usuario,
  organizationId,
  businessId,
  branchId = null,
  campana = null,
  kit = null,
  productoPrincipal = "",
}) {
  const [productosTexto, setProductosTexto] =
    useState(productoPrincipal || "");

  const [canales, setCanales] = useState([
    "TIKTOK",
    "INSTAGRAM",
    "FACEBOOK",
  ]);

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

  const esPropietaria = [
    "owner",
    "admin",
  ].includes(
    String(usuario?.role || "").toLowerCase()
  );

  const productos = useMemo(
    () =>
      productosTexto
        .split(/\n|,/)
        .map((producto) => producto.trim())
        .filter(Boolean),
    [productosTexto]
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
        branchId,
        campanaId: campana?.id || null,
        productos,
        canales,
        contenidosPorCanal:
          contenidosDesdeKit(kit, canales, productos),
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
    try {
      setError("");
      await resolverAprobacionPublicacion({
        publicacionId,
        aprobar,
        observaciones: aprobar
          ? "Autorizada para publicación."
          : "Requiere ajustes antes de publicar.",
      });
      setMensaje(
        aprobar
          ? "Publicación autorizada."
          : "Publicación devuelta para ajustes."
      );
      await cargarPublicaciones();
    } catch (errorResolucion) {
      setError(
        errorResolucion?.message ||
          "No fue posible resolver la autorización."
      );
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

  return (
    <section
      style={{
        marginTop: "16px",
        padding: "16px",
        border: "1px solid #e8cddd",
        borderRadius: "18px",
        background:
          "linear-gradient(145deg, #fff8fc, #ffffff)",
      }}
    >
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
            Publicación multicanal
          </strong>
          <div
            style={{
              marginTop: "4px",
              color: "#7d6470",
              fontSize: "12px",
            }}
          >
            Varios productos, varios canales y autorización humana.
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
          {publicaciones.length} en cola
        </span>
      </div>

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
        disabled={guardando || !kit}
        style={{
          width: "100%",
          marginTop: "14px",
          padding: "12px",
          border: "none",
          borderRadius: "12px",
          background: "#7a234f",
          color: "#fff",
          fontWeight: "900",
          cursor: kit ? "pointer" : "not-allowed",
          opacity: kit ? 1 : 0.55,
        }}
      >
        {guardando
          ? "Guardando..."
          : "Guardar borrador multicanal"}
      </button>

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
          publicaciones.slice(0, 8).map(
            (publicacion) => (
              <article
                key={publicacion.id}
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
                  <span>{etiquetaEstado(publicacion.estado)}</span>
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

                {[
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

                {esPropietaria &&
                  publicacion.estado ===
                    "PENDIENTE_APROBACION" && (
                    <div
                      style={{
                        display: "flex",
                        gap: "8px",
                        marginTop: "9px",
                      }}
                    >
                      <button
                        type="button"
                        onClick={() =>
                          resolver(publicacion.id, true)
                        }
                      >
                        Aprobar
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          resolver(publicacion.id, false)
                        }
                      >
                        Pedir ajustes
                      </button>
                    </div>
                  )}

                {esPropietaria &&
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
      </div>
    </section>
  );
}
