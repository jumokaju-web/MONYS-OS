import {
  useEffect,
  useState,
} from "react";

import {
  useUser,
} from "../../../../context/UserContext";

import {
  actualizarCampanaMarketing,
  obtenerCampanasMarketing,
} from "../../services/campanasMarketingService";

import {
  obtenerSucursalesActivas,
} from "../../../usuarios/services/usuariosService";

import {
  crearTareaAutomaticaDesdePrioridad,
} from "../../services/tareasOperativasService";

import TarjetaIndicador from "../shared/TarjetaIndicador";

function convertirNumero(valor) {
  const numero = Number(valor);

  return Number.isFinite(numero)
    ? numero
    : 0;
}

function formatearDinero(valor) {
  return new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency: "MXN",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(convertirNumero(valor));
}

function etiquetaAutorizacionCampana(
  accion
) {
  if (accion === "PAUSAR_CAMPAÑA") {
    return "⏸️ Campaña pausada";
  }

  if (accion === "REANUDAR_CAMPAÑA") {
    return "▶️ Campaña reanudada";
  }

  if (accion === "AUMENTAR_PRESUPUESTO") {
    return "💰 Presupuesto aumentado";
  }

  return "🛡️ Decisión autorizada";
}

function obtenerEstiloPrioridad(prioridad) {
  if (prioridad === "CRITICA") {
    return {
      icono: "🔴",
      fondo: "#fff0f0",
      borde: "#efb8b8",
      color: "#a52d2d",
    };
  }

  if (prioridad === "ALTA") {
    return {
      icono: "🟠",
      fondo: "#fff5ed",
      borde: "#efbd84",
      color: "#9a5416",
    };
  }

  return {
    icono: "🟡",
    fondo: "#fffbea",
    borde: "#e4d17d",
    color: "#806600",
  };
}

export default function DirectorMarketing({
  analisisMarketing,
}) {

    const {
    usuario,
  } = useUser();

  const [
    campanasMarketing,
    setCampanasMarketing,
  ] = useState([]);

     const [
    campanaActualizandoId,
    setCampanaActualizandoId,
  ] = useState(null);

  const [
    mensajeAccionCampana,
    setMensajeAccionCampana,
  ] = useState("");

  const [
    creandoSeguimientoId,
    setCreandoSeguimientoId,
  ] = useState(null);

  const [
    cargandoCampanas,
    setCargandoCampanas,
  ] = useState(true);

  const [
    errorCampanas,
    setErrorCampanas,
  ] = useState("");

    const [
    sucursales,
    setSucursales,
  ] = useState([]);

     
       useEffect(() => {
    async function cargarDatosCampanas() {
      if (
        !usuario?.organization_id ||
        !usuario?.business_id
      ) {
        setCampanasMarketing([]);
        setSucursales([]);
        setCargandoCampanas(false);
        return;
      }

      try {
        setCargandoCampanas(true);
        setErrorCampanas("");

        const [
          campanas,
          sucursalesActivas,
        ] = await Promise.all([
          obtenerCampanasMarketing({
            organizationId:
              usuario.organization_id,
            businessId:
              usuario.business_id,
          }),

          obtenerSucursalesActivas(),
        ]);

        setCampanasMarketing(
          campanas
        );

        setSucursales(
          sucursalesActivas.filter(
            (sucursal) =>
              sucursal.business_id ===
              usuario.business_id
          )
        );
      } catch (error) {
        console.error(
          "Error cargando campañas en Director de Marketing:",
          error
        );

        setCampanasMarketing([]);
        setSucursales([]);

        setErrorCampanas(
          error.message ||
            "No se pudieron cargar las campañas."
        );
      } finally {
        setCargandoCampanas(false);
      }
    }

    cargarDatosCampanas();
  }, [
    usuario?.organization_id,
    usuario?.business_id,
  ]);
 
     
  if (!analisisMarketing) {
    return null;
  }

      async function pausarCampana(
    campana
  ) {
    if (!campana?.id) {
      return;
    }

    const confirmarPausa =
      window.confirm(
        `¿Confirmas que deseas pausar la campaña "${campana.nombre || campana.producto || "seleccionada"}"?`
      );

    if (!confirmarPausa) {
      return;
    }

    try {
      setCampanaActualizandoId(
        campana.id
      );

      setMensajeAccionCampana("");
      setErrorCampanas("");

      const resultadoActual =
        campana.resultado || {};

      const historialAutorizacionesActual =
        Array.isArray(
          resultadoActual.historialAutorizaciones
        )
          ? resultadoActual.historialAutorizaciones
          : [];

      const nuevaAutorizacionPausa = {
        accion: "PAUSAR_CAMPAÑA",
        fecha: new Date().toISOString(),
        usuarioId:
          usuario?.id || null,
        usuarioNombre:
          usuario?.nombre || "Dueño",
      };

      const campanaPausada =
        await actualizarCampanaMarketing(
          campana.id,
          {
            estado: "PAUSADA",

            resultado: {
              ...resultadoActual,

              autorizacionDueno:
                nuevaAutorizacionPausa,

              historialAutorizaciones: [
                ...historialAutorizacionesActual,
                nuevaAutorizacionPausa,
              ],
            },
          }
        );

      setCampanasMarketing(
        (campanasActuales) =>
          campanasActuales.map(
            (campanaActual) =>
              campanaActual.id ===
              campanaPausada.id
                ? campanaPausada
                : campanaActual
          )
      );

      setMensajeAccionCampana(
        "Campaña pausada con autorización del dueño."
      );
    } catch (error) {
      console.error(
        "Error pausando campaña:",
        error
      );

      setErrorCampanas(
        error?.message ||
          "MONYS no pudo pausar la campaña."
      );
    } finally {
      setCampanaActualizandoId(
        null
      );
    }
  }

  async function reanudarCampana(
    campana
  ) {
    if (!campana?.id) {
      return;
    }

    const confirmarReanudacion =
      window.confirm(
        `¿Confirmas que deseas reanudar la campaña "${campana.nombre || campana.producto || "seleccionada"}"?`
      );

    if (!confirmarReanudacion) {
      return;
    }

    try {
      setCampanaActualizandoId(
        campana.id
      );

      setMensajeAccionCampana("");
      setErrorCampanas("");

      const resultadoActual =
        campana.resultado || {};

      const historialAutorizacionesActual =
        Array.isArray(
          resultadoActual.historialAutorizaciones
        )
          ? resultadoActual.historialAutorizaciones
          : [];

      const nuevaAutorizacionReanudacion = {
        accion: "REANUDAR_CAMPAÑA",
        fecha: new Date().toISOString(),
        usuarioId:
          usuario?.id || null,
        usuarioNombre:
          usuario?.nombre || "Dueño",
      };

      const campanaReanudada =
        await actualizarCampanaMarketing(
          campana.id,
          {
            estado: "ACTIVA",

            resultado: {
              ...resultadoActual,

              autorizacionDueno:
                nuevaAutorizacionReanudacion,

              historialAutorizaciones: [
                ...historialAutorizacionesActual,
                nuevaAutorizacionReanudacion,
              ],
            },
          }
        );

      setCampanasMarketing(
        (campanasActuales) =>
          campanasActuales.map(
            (campanaActual) =>
              campanaActual.id ===
              campanaReanudada.id
                ? campanaReanudada
                : campanaActual
          )
      );

      setMensajeAccionCampana(
        "Campaña reanudada con autorización del dueño."
      );
    } catch (error) {
      console.error(
        "Error reanudando campaña:",
        error
      );

      setErrorCampanas(
        error?.message ||
          "MONYS no pudo reanudar la campaña."
      );
    } finally {
      setCampanaActualizandoId(
        null
      );
    }
  }

  async function crearSeguimientoCampana(
    campana
  ) {
    if (
      !campana?.id ||
      !campana?.branch_id
    ) {
      setErrorCampanas(
        "No se pudo identificar la campaña o su sucursal."
      );
      return;
    }

    const nombreCampana =
      campana.nombre ||
      campana.producto ||
      "campaña seleccionada";

    const confirmarCreacion =
      window.confirm(
        `¿Autorizas crear una tarea de seguimiento para la campaña "${nombreCampana}"? MONYS elegirá al responsable según perfil y carga de trabajo.`
      );

    if (!confirmarCreacion) {
      return;
    }

    try {
      setCreandoSeguimientoId(
        campana.id
      );
      setMensajeAccionCampana("");
      setErrorCampanas("");

      const respuesta =
        await crearTareaAutomaticaDesdePrioridad({
          prioridad: {
            titulo:
              `Dar seguimiento a campaña sin avances: ${nombreCampana}`,
            descripcion:
              "La campaña activa llegó a 24 horas desde la última actualización del registro y continúa con 0 avances reales. Verificar ejecución y registrar únicamente gasto, pedidos y venta nuevos reales.",
            prioridad: "ALTA",
          },
          organizationId:
            usuario?.organization_id || null,
          businessId:
            usuario?.business_id || null,
          branchId:
            campana.branch_id,
          creadaPor:
            usuario?.nombre || "Dueño",
        });

      if (
        respuesta?.motivo ===
        "DUPLICADA"
      ) {
        setMensajeAccionCampana(
          "La tarea de seguimiento ya estaba activa; MONYS no creó un duplicado."
        );
      } else if (respuesta?.creada) {
        const responsable =
          respuesta?.asignacion?.nombre ||
          respuesta?.tarea?.responsable ||
          "el responsable seleccionado";

        setMensajeAccionCampana(
          `Seguimiento autorizado y asignado a ${responsable}.`
        );
      } else {
        setErrorCampanas(
          "MONYS no pudo crear la tarea de seguimiento."
        );
      }
    } catch (error) {
      console.error(
        "Error creando seguimiento de campaña:",
        error
      );

      setErrorCampanas(
        error?.message ||
          "MONYS no pudo crear la tarea de seguimiento."
      );
    } finally {
      setCreandoSeguimientoId(null);
    }
  }

  async function autorizarNuevoPresupuesto(
    campana
  ) {
    if (!campana?.id) {
      return;
    }

    const presupuestoActual =
      convertirNumero(
        campana.presupuesto
      );

    const respuesta = window.prompt(
      `Presupuesto autorizado actual: ${formatearDinero(
        presupuestoActual
      )}. Escribe el nuevo presupuesto total autorizado:`,
      String(presupuestoActual)
    );

    if (respuesta === null) {
      return;
    }

    const nuevoPresupuesto =
      Number(respuesta);

    if (
      !Number.isFinite(nuevoPresupuesto) ||
      nuevoPresupuesto <=
        presupuestoActual
    ) {
      setErrorCampanas(
        "El nuevo presupuesto debe ser un número mayor al presupuesto actual."
      );
      return;
    }

    const confirmarAumento =
      window.confirm(
        `¿Autorizas aumentar el presupuesto total de ${formatearDinero(
          presupuestoActual
        )} a ${formatearDinero(
          nuevoPresupuesto
        )}?`
      );

    if (!confirmarAumento) {
      return;
    }

    try {
      setCampanaActualizandoId(
        campana.id
      );
      setMensajeAccionCampana("");
      setErrorCampanas("");

      const resultadoActual =
        campana.resultado || {};

      const historialActual =
        Array.isArray(
          resultadoActual.historialAutorizaciones
        )
          ? resultadoActual.historialAutorizaciones
          : [];

      const autorizacionPresupuesto = {
        accion: "AUMENTAR_PRESUPUESTO",
        fecha: new Date().toISOString(),
        usuarioId:
          usuario?.id || null,
        usuarioNombre:
          usuario?.nombre || "Dueño",
        presupuestoAnterior:
          presupuestoActual,
        presupuestoNuevo:
          nuevoPresupuesto,
      };

      const campanaActualizada =
        await actualizarCampanaMarketing(
          campana.id,
          {
            presupuesto:
              nuevoPresupuesto,
            resultado: {
              ...resultadoActual,
              autorizacionDueno:
                autorizacionPresupuesto,
              historialAutorizaciones: [
                ...historialActual,
                autorizacionPresupuesto,
              ],
            },
          }
        );

      setCampanasMarketing(
        (campanasActuales) =>
          campanasActuales.map(
            (campanaActual) =>
              campanaActual.id ===
              campanaActualizada.id
                ? campanaActualizada
                : campanaActual
          )
      );

      setMensajeAccionCampana(
        `Nuevo presupuesto autorizado: ${formatearDinero(
          nuevoPresupuesto
        )}.`
      );
    } catch (error) {
      console.error(
        "Error autorizando presupuesto:",
        error
      );

      setErrorCampanas(
        error?.message ||
          "MONYS no pudo actualizar el presupuesto."
      );
    } finally {
      setCampanaActualizandoId(null);
    }
  }

    const campanasActivas =
    campanasMarketing.filter(
      (campana) =>
        campana.estado === "ACTIVA"
    );

       const campanasFinalizadas =
    campanasMarketing.filter(
      (campana) =>
        campana.estado ===
        "FINALIZADA"
    );

      const campanasPausadas =
    campanasMarketing.filter(
      (campana) =>
        campana.estado ===
        "PAUSADA"
    );

  const {
    estadoGeneral,
    ventasTotales,
    margenUtilidad,
    capacidadCompra,
    vencimientos30Dias,
    productoLider,
    categoriaLider,
    inventarioProductoLider,
    sobreinventarioDetectado = [],
    oportunidades = [],
    recomendaciones = [],
    accionesPrioritarias = [],
  } = analisisMarketing;

  const capacidadCompraNumero =
    convertirNumero(capacidadCompra);

  const vencimientos30DiasNumero =
    convertirNumero(vencimientos30Dias);

  const sinPresupuesto =
    capacidadCompraNumero <= 0 &&
    vencimientos30DiasNumero > 0;

  const productosParaRotar =
    Array.isArray(sobreinventarioDetectado)
      ? sobreinventarioDetectado
      : [];

  const listaOportunidades =
    Array.isArray(oportunidades)
      ? oportunidades
      : [];

  const listaRecomendaciones =
    Array.isArray(recomendaciones)
      ? recomendaciones
      : [];

  const listaAcciones =
    Array.isArray(accionesPrioritarias)
      ? accionesPrioritarias
      : [];

  return (
    <section
      style={{
        marginTop: "30px",
        padding: "28px",
        borderRadius: "22px",
        background:
          "linear-gradient(135deg, #ffffff 0%, #fff3f8 100%)",
        border: "1px solid #efbfd3",
        boxShadow:
          "0 12px 35px rgba(180, 65, 120, 0.12)",
      }}
    >
      {/* ENCABEZADO */}

      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: "15px",
        }}
      >
        <div>
          <p
            style={{
              margin: "0 0 7px",
              color: "#b44178",
              fontWeight: "800",
              letterSpacing: "1px",
            }}
          >
            MONYS OS · DIRECTOR MARKETING
          </p>

          <h2
            style={{
              margin: 0,
              fontSize: "28px",
            }}
          >
            📢 Informe de Marketing IA
          </h2>
        </div>

        <div
          style={{
            padding: "11px 17px",
            borderRadius: "999px",
            backgroundColor:
              sinPresupuesto
                ? "#fff0f0"
                : "#eaf8f0",
            border: sinPresupuesto
              ? "1px solid #efb8b8"
              : "1px solid #b8e5ca",
            color: sinPresupuesto
              ? "#a52d2d"
              : "#207a4a",
            fontWeight: "800",
          }}
        >
          {sinPresupuesto ? "🔴 " : "🟢 "}
          {estadoGeneral || "Analizando"}
        </div>
      </div>

             {/* CAMPAÑAS ACTIVAS */}

      <div
        style={{
          marginTop: "24px",
          padding: "20px",
          borderRadius: "16px",
          backgroundColor: "#ffffff",
          border: "1px solid #efbfd3",
        }}
      >
        <h3
          style={{
            margin: "0 0 8px",
          }}
        >
          📊 Campañas activas y en seguimiento
        </h3>

                 {mensajeAccionCampana && (
          <div
            style={{
              marginBottom: "12px",
              padding: "11px",
              borderRadius: "10px",
              backgroundColor:
                "#eaf8f0",
              border:
                "1px solid #b8e5ca",
              color: "#207a4a",
              fontWeight: "700",
            }}
          >
            ✅ {mensajeAccionCampana}
          </div>
        )}

        {cargandoCampanas ? (
          <p>
            MONYS está consultando las
            campañas...
          </p>
        ) : errorCampanas ? (
          <p
            style={{
              color: "#a52d2d",
              fontWeight: "700",
            }}
          >
            {errorCampanas}
          </p>
        ) : campanasActivas.length === 0 ? (
          <p>
            No hay campañas activas en este
            momento.
          </p>
                ) : (
          <div
            style={{
              display: "grid",
              gap: "14px",
              marginTop: "16px",
            }}
          >
            {campanasActivas.map(
              (campana) => {
                const resultado =
                  campana.resultado || {};

                const historialResultados =
                  Array.isArray(
                    resultado.historial
                  )
                    ? resultado.historial
                    : [];

                const historialAutorizaciones =
                  Array.isArray(
                    resultado.historialAutorizaciones
                  )
                    ? resultado.historialAutorizaciones
                    : [];

                const fechaUltimaActualizacion =
                  campana.updated_at
                    ? new Date(
                        campana.updated_at
                      )
                    : null;

                const horasSinAvance =
                  fechaUltimaActualizacion &&
                  !Number.isNaN(
                    fechaUltimaActualizacion.getTime()
                  )
                    ? Math.max(
                        0,
                        Math.floor(
                          (Date.now() -
                            fechaUltimaActualizacion.getTime()) /
                            3600000
                        )
                      )
                    : null;

                const requiereSeguimiento =
                  historialResultados.length === 0 &&
                  horasSinAvance !== null &&
                  horasSinAvance >= 24;

                return (
                  <div
                    key={campana.id}
                    style={{
                      padding: "18px",
                      borderRadius: "14px",
                      backgroundColor:
                        "#fff7fa",
                      border:
                        "1px solid #efcada",
                    }}
                  >
                    <h4
                      style={{
                        margin: "0 0 12px",
                        fontSize: "18px",
                      }}
                    >
                      {campana.nombre ||
                        campana.producto ||
                        "Campaña activa"}
                    </h4>

                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns:
                          "repeat(auto-fit, minmax(160px, 1fr))",
                        gap: "12px",
                        lineHeight: "1.5",
                      }}
                    >
                      <div>
                        <strong>
                          Producto
                        </strong>
                        <br />
                        {campana.producto ||
                          "Sin producto"}
                      </div>

                      <div>
                        <strong>Canal</strong>
                        <br />
                                                 {campana.canal_principal
                          ?.split(",")[0]
                          ?.trim() ||
                          "Sin canal"}
                      </div>

                                                <div>
                        <strong>
                          Sucursal
                        </strong>
                        <br />
                        {campana.branch_id
                          ? sucursales.find(
                              (sucursal) =>
                                sucursal.id ===
                                campana.branch_id
                            )?.name ||
                            "Sucursal no identificada"
                          : "Todas las sucursales"}
                      </div>    

                      <div>
                        <strong>
                          Presupuesto
                        </strong>
                        <br />
                        {formatearDinero(
                          convertirNumero(
                            campana.presupuesto
                          )
                        )}
                      </div>

                      <div>
                        <strong>
                          Gasto acumulado
                        </strong>
                        <br />
                        {formatearDinero(
                          convertirNumero(
                            resultado.gastoAcumulado
                          )
                        )}
                      </div>

                      <div>
                        <strong>
                          Pedidos
                        </strong>
                        <br />
                        {convertirNumero(
                          resultado.pedidosAcumulados
                        ).toLocaleString(
                          "es-MX"
                        )}
                      </div>

                      <div>
                        <strong>
                          Venta acumulada
                        </strong>
                        <br />
                        {formatearDinero(
                          convertirNumero(
                            resultado.ventaAcumulada
                          )
                        )}
                      </div>

                      <div>
                        <strong>
                          Costo por pedido
                        </strong>
                        <br />
                        {convertirNumero(
                          resultado.pedidosAcumulados
                        ) > 0
                          ? formatearDinero(
                              convertirNumero(
                                resultado.costoPorPedido
                              )
                            )
                          : "Sin pedidos todavía"}
                      </div>

                      <div>
                        <strong>Estado</strong>
                        <br />
                        {campana.estado}
                      </div>
                                               <div>
                        <strong>
                          Última actualización
                        </strong>
                        <br />
                        {campana.updated_at
                          ? new Date(
                              campana.updated_at
                            ).toLocaleString(
                              "es-MX",
                              {
                                dateStyle:
                                  "short",

                                timeStyle:
                                  "short",
                              }
                            )
                          : "Sin actualización"}
                      </div>   

                                                 <div>
                        <strong>
                          Avances registrados
                        </strong>
                        <br />
                        {Array.isArray(
                          resultado.historial
                        )
                          ? resultado
                              .historial
                              .length
                          : 0}
                      </div>
                           
                    </div>

                    <div
                      style={{
                        marginTop: "14px",
                        padding: "12px",
                        borderRadius: "10px",
                        backgroundColor:
                          "#ffffff",
                        border:
                          "1px solid #ead7df",
                      }}
                    >
                      <strong>
                        Decisión actual de MONYS
                      </strong>
                      <br />
                                           {(
                        resultado.decisionActual ||
                        campana.decision_ia ||
                        "ESPERANDO_RESULTADOS"
                      ).replaceAll("_", " ")}
                    </div>
                 
                  {historialResultados.length ===
                    0 && (
                    <div
                      style={{
                        marginTop: "10px",
                        padding: "11px",
                        borderRadius: "10px",
                        backgroundColor:
                          requiereSeguimiento
                            ? "#fff0f0"
                            : "#fff8e6",
                        border: requiereSeguimiento
                          ? "1px solid #e3a0a0"
                          : "1px solid #efd58a",
                        color: requiereSeguimiento
                          ? "#9b2525"
                          : "#7a5a00",
                        fontWeight: "700",
                      }}
                    >
                      {requiereSeguimiento
                        ? `🚨 Requiere seguimiento: 0 avances reales y ${horasSinAvance} horas desde la última actualización del registro.`
                        : `⏳ Pendiente el primer avance real. Dato real: 0 avances${
                            horasSinAvance !== null
                              ? ` y ${horasSinAvance} horas desde la última actualización del registro`
                              : ""
                          }. Regla de seguimiento: alertar al cumplir 24 horas.`}

                      <button
                        type="button"
                        onClick={() =>
                          crearSeguimientoCampana(
                            campana
                          )
                        }
                        disabled={
                          !requiereSeguimiento ||
                          creandoSeguimientoId ===
                            campana.id
                        }
                        style={{
                          width: "100%",
                          marginTop: "10px",
                          padding: "10px",
                          border: "none",
                          borderRadius: "8px",
                          backgroundColor:
                            requiereSeguimiento
                              ? "#a52d2d"
                              : "#e7dcc0",
                          color:
                            requiereSeguimiento
                              ? "#ffffff"
                              : "#766b55",
                          fontWeight: "800",
                          cursor:
                            requiereSeguimiento
                              ? "pointer"
                              : "not-allowed",
                        }}
                      >
                        {creandoSeguimientoId ===
                        campana.id
                          ? "Creando seguimiento..."
                          : requiereSeguimiento
                            ? "📋 Autorizar tarea de seguimiento"
                            : "🔒 Seguimiento disponible al cumplir 24 horas"}
                      </button>
                    </div>
                  )}

                  {historialAutorizaciones.length >
                    0 && (
                    <div
                      style={{
                        marginTop: "10px",
                        padding: "12px",
                        borderRadius: "10px",
                        backgroundColor: "#f4f0ff",
                        border:
                          "1px solid #d8ccef",
                        textAlign: "left",
                      }}
                    >
                      <strong>
                        🛡️ Historial de autorizaciones
                      </strong>

                      {historialAutorizaciones.map(
                        (autorizacion, indice) => (
                          <div
                            key={`${autorizacion.fecha}-${indice}`}
                            style={{
                              marginTop: "8px",
                              fontSize: "14px",
                            }}
                          >
                            {etiquetaAutorizacionCampana(
                              autorizacion.accion
                            )}
                            {autorizacion.accion ===
                              "AUMENTAR_PRESUPUESTO" &&
                              ` de ${formatearDinero(
                                autorizacion.presupuestoAnterior
                              )} a ${formatearDinero(
                                autorizacion.presupuestoNuevo
                              )}`}
                            {" · "}
                            {autorizacion.usuarioNombre ||
                              "Dueño"}
                            {" · "}
                            {autorizacion.fecha
                              ? new Date(
                                  autorizacion.fecha
                                ).toLocaleString(
                                  "es-MX"
                                )
                              : "Fecha no disponible"}
                          </div>
                        )
                      )}
                    </div>
                  )}

                  <button
                    type="button"
                    onClick={() =>
                      pausarCampana(campana)
                    }
                    disabled={
                      campanaActualizandoId ===
                      campana.id
                    }
                    style={{
                      width: "100%",
                      marginTop: "10px",
                      padding: "11px",
                      border:
                        "1px solid #9a6700",
                      borderRadius: "9px",
                      backgroundColor: "#ffffff",
                      color: "#7a5200",
                      fontWeight: "800",
                      cursor:
                        campanaActualizandoId ===
                        campana.id
                          ? "wait"
                          : "pointer",
                    }}
                  >
                    {campanaActualizandoId ===
                    campana.id
                      ? "Pausando..."
                      : "⏸️ Pausar campaña"}
                  </button>

                  <button
                    type="button"
                    onClick={() =>
                      autorizarNuevoPresupuesto(
                        campana
                      )
                    }
                    disabled={
                      campanaActualizandoId ===
                      campana.id
                    }
                    style={{
                      width: "100%",
                      marginTop: "10px",
                      padding: "11px",
                      border:
                        "1px solid #2563a8",
                      borderRadius: "9px",
                      backgroundColor: "#ffffff",
                      color: "#1f5792",
                      fontWeight: "800",
                      cursor:
                        campanaActualizandoId ===
                        campana.id
                          ? "wait"
                          : "pointer",
                    }}
                  >
                    💰 Autorizar nuevo presupuesto
                  </button>
                </div>
              );
            }
          )}
        </div>
      )}

      </div>

      {/* INDICADORES */}

              {/* CAMPAÑAS PAUSADAS */}

      {campanasPausadas.length > 0 && (
        <div
          style={{
            marginTop: "18px",
            padding: "20px",
            borderRadius: "16px",
            backgroundColor:
              "#fff8e6",
            border:
              "1px solid #efd58a",
          }}
        >
          <h3
            style={{
              margin: "0 0 12px",
            }}
          >
            ⏸️ Campañas pausadas
          </h3>

          <div
            style={{
              display: "grid",
              gap: "12px",
            }}
          >
            {campanasPausadas.map(
              (campana) => {
                const resultadoPausado =
                  campana.resultado || {};

                const historialPausado =
                  Array.isArray(
                    resultadoPausado.historialAutorizaciones
                  )
                    ? resultadoPausado.historialAutorizaciones
                    : [];

                return (
                <div
                  key={campana.id}
                  style={{
                    padding: "14px",
                    borderRadius:
                      "11px",
                    backgroundColor:
                      "#ffffff",
                    border:
                      "1px solid #ead9a5",
                  }}
                >
                  <strong>
                    {campana.nombre ||
                      campana.producto ||
                      "Campaña pausada"}
                  </strong>

                  <p
                    style={{
                      margin:
                        "7px 0",
                    }}
                  >
                    Producto:{" "}
                    {campana.producto ||
                      "Sin producto"}
                  </p>

                  <p
                    style={{
                      margin:
                        "7px 0",
                    }}
                  >
                    Sucursal:{" "}
                    {campana.branch_id
                      ? sucursales.find(
                          (sucursal) =>
                            sucursal.id ===
                            campana.branch_id
                        )?.name ||
                        "Sucursal no identificada"
                      : "Todas las sucursales"}
                  </p>

                  {historialPausado.length > 0 && (
                    <div
                      style={{
                        marginTop: "10px",
                        padding: "12px",
                        borderRadius: "10px",
                        backgroundColor: "#f4f0ff",
                        border:
                          "1px solid #d8ccef",
                        textAlign: "left",
                      }}
                    >
                      <strong>
                        🛡️ Historial de autorizaciones
                      </strong>

                      {historialPausado.map(
                        (autorizacion, indice) => (
                          <div
                            key={`${autorizacion.fecha}-${indice}`}
                            style={{
                              marginTop: "8px",
                              fontSize: "14px",
                            }}
                          >
                            {etiquetaAutorizacionCampana(
                              autorizacion.accion
                            )}
                            {autorizacion.accion ===
                              "AUMENTAR_PRESUPUESTO" &&
                              ` de ${formatearDinero(
                                autorizacion.presupuestoAnterior
                              )} a ${formatearDinero(
                                autorizacion.presupuestoNuevo
                              )}`}
                            {" · "}
                            {autorizacion.usuarioNombre ||
                              "Dueño"}
                            {" · "}
                            {autorizacion.fecha
                              ? new Date(
                                  autorizacion.fecha
                                ).toLocaleString(
                                  "es-MX"
                                )
                              : "Fecha no disponible"}
                          </div>
                        )
                      )}
                    </div>
                  )}

                  <button
                    type="button"
                    onClick={() =>
                      reanudarCampana(
                        campana
                      )
                    }
                    disabled={
                      campanaActualizandoId ===
                      campana.id
                    }
                    style={{
                      width: "100%",
                      marginTop: "8px",
                      padding: "11px",
                      border: "none",
                      borderRadius:
                        "9px",
                      backgroundColor:
                        "#8a6b00",
                      color: "#ffffff",
                      fontWeight:
                        "800",
                      cursor:
                        campanaActualizandoId ===
                        campana.id
                          ? "wait"
                          : "pointer",
                    }}
                  >
                    {campanaActualizandoId ===
                    campana.id
                      ? "Reanudando..."
                      : "▶️ Reanudar campaña"}
                  </button>
                </div>
                );
              }
            )}
          </div>
        </div>
      )}

            {/* HISTORIAL Y APRENDIZAJE */}

      <div
        style={{
          marginTop: "18px",
          padding: "20px",
          borderRadius: "16px",
          backgroundColor: "#f8f7ff",
          border:
            "1px solid #d8d2ef",
        }}
      >
        <h3
          style={{
            margin: "0 0 8px",
          }}
        >
          🧠 Historial y aprendizaje de campañas
        </h3>

        {cargandoCampanas ? (
          <p>
            MONYS está consultando el
            historial...
          </p>
        ) : campanasFinalizadas.length ===
          0 ? (
          <p
            style={{
              margin: 0,
              color: "#675f75",
            }}
          >
            Todavía no hay campañas
            finalizadas con resultados
            reales.
          </p>
                ) : (
          <div
            style={{
              display: "grid",
              gap: "12px",
              marginTop: "14px",
            }}
          >
            {campanasFinalizadas.map(
              (campana) => {
                const aprendizaje =
                  campana.aprendizaje ||
                  {};

                return (
                  <div
                    key={campana.id}
                    style={{
                      padding: "16px",
                      borderRadius: "12px",
                      backgroundColor:
                        "#ffffff",
                      border:
                        "1px solid #d8d2ef",
                    }}
                  >
                    <h4
                      style={{
                        margin: "0 0 12px",
                      }}
                    >
                      {campana.nombre ||
                        campana.producto ||
                        "Campaña finalizada"}
                    </h4>

                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns:
                          "repeat(auto-fit, minmax(145px, 1fr))",
                        gap: "10px",
                        lineHeight: "1.5",
                      }}
                    >
                      <div>
                        <strong>
                          Producto
                        </strong>
                        <br />
                        {campana.producto ||
                          "Sin producto"}
                      </div>

                      <div>
                        <strong>
                          Sucursal
                        </strong>
                        <br />
                        {campana.branch_id
                          ? sucursales.find(
                              (sucursal) =>
                                sucursal.id ===
                                campana.branch_id
                            )?.name ||
                            "Sucursal no identificada"
                          : "Todas las sucursales"}
                      </div>

                      <div>
                        <strong>
                          Gasto final
                        </strong>
                        <br />
                        {formatearDinero(
                          convertirNumero(
                            aprendizaje.gastoFinal
                          )
                        )}
                      </div>

                      <div>
                        <strong>
                          Pedidos
                        </strong>
                        <br />
                        {convertirNumero(
                          aprendizaje.pedidosFinales
                        )}
                      </div>

                      <div>
                        <strong>
                          Venta final
                        </strong>
                        <br />
                        {formatearDinero(
                          convertirNumero(
                            aprendizaje.ventaFinal
                          )
                        )}
                      </div>

                      <div>
                        <strong>
                          Registros reales
                        </strong>
                        <br />
                        {convertirNumero(
                          aprendizaje.registrosAnalizados
                        )}
                      </div>
                    </div>

                    <div
                      style={{
                        marginTop: "12px",
                        padding: "10px",
                        borderRadius: "9px",
                        backgroundColor:
                          "#f8f7ff",
                      }}
                    >
                      <strong>
                        Fuente:
                      </strong>{" "}
                      {aprendizaje.tipoFuente ||
                        "Sin clasificar"}
                    </div>
                                              <div
                      style={{
                        marginTop: "10px",
                        padding: "12px",
                        borderRadius: "9px",
                        backgroundColor:
                          "#fffdf5",
                        border:
                          "1px solid #eadfb5",
                        lineHeight: "1.6",
                      }}
                    >
                      <strong>
                        Aprendizaje de MONYS
                      </strong>

                      <p
                        style={{
                          margin:
                            "7px 0 0",
                        }}
                      >
                        {aprendizaje.resumenIA ||
                          "El análisis inteligente todavía no está disponible."}
                      </p>

                      <p
                        style={{
                          margin:
                            "7px 0 0",
                        }}
                      >
                        <strong>
                          Próxima decisión:
                        </strong>{" "}
                        {(
                          aprendizaje.decisionFutura ||
                          "REQUIERE_MAS_DATOS"
                        ).replaceAll(
                          "_",
                          " "
                        )}
                      </p>

                      <p
                        style={{
                          margin:
                            "7px 0 0",
                        }}
                      >
                        <strong>
                          Recomendación:
                        </strong>{" "}
                        {aprendizaje.recomendacionFutura ||
                          "Pendiente"}
                      </p>

                      <p
                        style={{
                          margin:
                            "7px 0 0",
                        }}
                      >
                        <strong>
                          Confianza:
                        </strong>{" "}
                        {convertirNumero(
                          campana.confianza_ia
                        ).toFixed(0)}
                        /100
                      </p>
                    </div>

                  </div>
                );
              }
            )}
          </div>
        )}
      </div> 

      <div
        style={{
          display: "grid",
          gridTemplateColumns:
            "repeat(auto-fit, minmax(210px, 1fr))",
          gap: "16px",
          marginTop: "24px",
        }}
      >
        <TarjetaIndicador
          icono="💰"
          titulo="Ventas analizadas"
          valor={formatearDinero(
            ventasTotales
          )}
        />

        <TarjetaIndicador
          icono="📊"
          titulo="Margen comercial"
          valor={`${convertirNumero(
            margenUtilidad
          ).toFixed(2)}%`}
        />

        <TarjetaIndicador
          icono={
            capacidadCompraNumero > 0
              ? "✅"
              : "⛔"
          }
          titulo="Presupuesto disponible"
          valor={formatearDinero(
            capacidadCompraNumero
          )}
        />

        <TarjetaIndicador
          icono="🧾"
          titulo="Compromisos 30 días"
          valor={formatearDinero(
            vencimientos30DiasNumero
          )}
        />

        <TarjetaIndicador
          icono="⭐"
          titulo="Producto líder"
          valor={
            productoLider?.nombre ||
            "Sin datos"
          }
        />

        <TarjetaIndicador
          icono="🏷️"
          titulo="Categoría líder"
          valor={
            categoriaLider?.categoria ||
            "Sin datos"
          }
        />

        <TarjetaIndicador
          icono="📚"
          titulo="Productos para rotar"
          valor={productosParaRotar.length}
        />
      </div>

      {/* ESTRATEGIA */}

      <div
        style={{
          marginTop: "26px",
          padding: "20px",
          borderRadius: "16px",
          backgroundColor:
            sinPresupuesto
              ? "#fff4f4"
              : "#f3fff6",
          border: sinPresupuesto
            ? "1px solid #efc2c2"
            : "1px solid #ccebd5",
          textAlign: "center",
        }}
      >
        <h3
          style={{
            margin: "0 0 8px",
          }}
        >
          🎯 Estrategia de Marketing
        </h3>

        {sinPresupuesto ? (
          <p
            style={{
              margin: 0,
              lineHeight: "1.6",
            }}
          >
            Finanzas no autoriza
            presupuesto adicional en este
            momento. Marketing debe
            concentrarse en{" "}
            <strong>
              rotación, exhibición,
              contenido orgánico y acciones
              que no requieran nuevas
              compras.
            </strong>
          </p>
        ) : (
          <p
            style={{
              margin: 0,
              lineHeight: "1.6",
            }}
          >
            Existe capacidad financiera
            para evaluar acciones de
            Marketing, protegiendo siempre
            margen e inventario.
          </p>
        )}
      </div>

      {/* PRODUCTO LÍDER */}

      {productoLider &&
        inventarioProductoLider && (
          <div
            style={{
              marginTop: "24px",
              padding: "20px",
              borderRadius: "16px",
              backgroundColor: "#fffdf7",
              border:
                "1px solid #ecd9aa",
            }}
          >
            <h3
              style={{
                margin: "0 0 12px",
                textAlign: "center",
              }}
            >
              ⭐ Producto líder bajo análisis
            </h3>

            <div
              style={{
                textAlign: "center",
                lineHeight: "1.7",
              }}
            >
              <strong>
                {productoLider.nombre}
              </strong>

              <div>
                Vendidas:{" "}
                <strong>
                  {convertirNumero(
                    productoLider.piezas
                  ).toLocaleString("es-MX")}
                </strong>
              </div>

              <div>
                Existencia:{" "}
                <strong>
                  {convertirNumero(
                    inventarioProductoLider
                      .existencia
                  ).toLocaleString("es-MX")}
                </strong>
              </div>

              <div>
                Cobertura:{" "}
                <strong>
                  {convertirNumero(
                    inventarioProductoLider
                      .diasCobertura
                  ).toFixed(1)}{" "}
                  días
                </strong>
              </div>

              <div>
                Estado inventario:{" "}
                <strong>
                  {inventarioProductoLider
                    .nivelInventario ||
                    "Sin datos"}
                </strong>
              </div>
            </div>
          </div>
        )}

      {/* ACCIONES PRIORITARIAS */}

      <div
        style={{
          marginTop: "24px",
          padding: "22px",
          borderRadius: "18px",
          backgroundColor: "#ffffff",
          border:
            "1px solid #efc7d9",
        }}
      >
        <h3
          style={{
            textAlign: "center",
            marginTop: 0,
          }}
        >
          🎯 Acciones prioritarias de Marketing
        </h3>

        <div
          style={{
            display: "grid",
            gap: "12px",
            marginTop: "16px",
          }}
        >
          {listaAcciones.length > 0 ? (
            listaAcciones.map(
              (accion, index) => {
                const estilo =
                  obtenerEstiloPrioridad(
                    accion?.prioridad
                  );

                return (
                  <article
                    key={`accion-marketing-${index}`}
                    style={{
                      padding: "16px",
                      borderRadius: "14px",
                      backgroundColor:
                        estilo.fondo,
                      border: `1px solid ${estilo.borde}`,
                    }}
                  >
                    <strong
                      style={{
                        color:
                          estilo.color,
                      }}
                    >
                      {estilo.icono}{" "}
                      {accion?.titulo ||
                        "Acción recomendada"}
                    </strong>

                    <p
                      style={{
                        margin: "8px 0 0",
                        lineHeight: "1.6",
                      }}
                    >
                      {accion?.descripcion ||
                        "Sin descripción disponible."}
                    </p>
                  </article>
                );
              }
            )
          ) : (
            <p
              style={{
                margin: 0,
                textAlign: "center",
              }}
            >
              No hay acciones prioritarias
              disponibles por el momento.
            </p>
          )}
        </div>
      </div>

      {/* OPORTUNIDADES */}

      <div
        style={{
          marginTop: "24px",
          padding: "22px",
          borderRadius: "18px",
          backgroundColor: "#eef9ff",
          border:
            "1px solid #b8dff5",
        }}
      >
        <h3
          style={{
            textAlign: "center",
            marginTop: 0,
          }}
        >
          🚀 Oportunidades de Marketing
        </h3>

        {listaOportunidades.length > 0 ? (
          listaOportunidades
            .slice(0, 8)
            .map(
              (oportunidad, index) => (
                <div
                  key={`oportunidad-marketing-${index}`}
                  style={{
                    marginBottom: "16px",
                    textAlign: "center",
                  }}
                >
                  <strong>
                    {oportunidad?.titulo ||
                      "Oportunidad"}
                  </strong>

                  <div
                    style={{
                      marginTop: "5px",
                      lineHeight: "1.6",
                    }}
                  >
                    {oportunidad?.descripcion ||
                      "Sin descripción disponible."}
                  </div>
                </div>
              )
            )
        ) : (
          <p
            style={{
              margin: 0,
              textAlign: "center",
            }}
          >
            No hay oportunidades detectadas
            por el momento.
          </p>
        )}
      </div>

      {/* RECOMENDACIONES */}

      <div
        style={{
          marginTop: "24px",
          padding: "22px",
          borderRadius: "18px",
          backgroundColor: "#fff5fa",
          border:
            "1px solid #efc7da",
        }}
      >
        <h3
          style={{
            textAlign: "center",
            marginTop: 0,
            color: "#9c2f62",
          }}
        >
          🧠 Recomendaciones de Marketing
        </h3>

        {listaRecomendaciones.length > 0 ? (
          listaRecomendaciones.map(
            (recomendacion, index) => (
              <div
                key={`recomendacion-marketing-${index}`}
                style={{
                  display: "flex",
                  gap: "10px",
                  marginBottom: "12px",
                  lineHeight: "1.6",
                }}
              >
                <span>💡</span>

                <span>
                  {typeof recomendacion ===
                  "string"
                    ? recomendacion
                    : recomendacion
                        ?.descripcion ||
                      recomendacion
                        ?.titulo ||
                      "Recomendación disponible"}
                </span>
              </div>
            )
          )
        ) : (
          <p
            style={{
              margin: 0,
              textAlign: "center",
            }}
          >
            No hay recomendaciones
            disponibles por el momento.
          </p>
        )}
      </div>
    </section>
  );
}
