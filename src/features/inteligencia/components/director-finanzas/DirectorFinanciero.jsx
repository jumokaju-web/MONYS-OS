// ======================================================
// MONYS OS
// Director Financiero IA
// ======================================================

import {
  useEffect,
  useState,
} from "react";
import {
  obtenerCreditosProveedoresActuales,
} from "../../services/creditosProveedoresService";
import TarjetaIndicador from "../shared/TarjetaIndicador";
import { generarAnalisisFinanciero } from "../../ia/directorFinancieroIA";
import {
  actualizarEjecucionDecision,
  guardarDecisionAprobada,
  guardarDecisionPospuesta,
  guardarDecisionRechazada,
  obtenerHistorialDecisiones,
} from "../../services/decisionesService";

function DirectorFinanciero({
  datosDashboard,
  movimientos = [],
}) {

    const [
    decisionGuardando,
    setDecisionGuardando,
  ] = useState(null);

  const [
    decisionesTomadas,
    setDecisionesTomadas,
  ] = useState({});

  const [
    mensajeDecision,
    setMensajeDecision,
  ] = useState("");

  const [
  historialDecisiones,
  setHistorialDecisiones,
] = useState([]);

const [
  ejecucionGuardando,
  setEjecucionGuardando,
] = useState(null);

const [
  resultadosEjecucion,
  setResultadosEjecucion,
] = useState({});
  
const [
  creditosProveedores,
  setCreditosProveedores,
] = useState({
  importacion: null,
  creditos: [],
  saldoTotal: 0,
});

  const metricas =
    datosDashboard?.metricas || {};

const branchId =
  datosDashboard?.branch_id || null;


  const analisisFinanciero =
    generarAnalisisFinanciero({
      movimientos,

      ventasTotales:
        metricas.ventasTotales ?? 0,

      costoTotal:
        metricas.costoTotal ?? 0,

      utilidadTotal:
        metricas.utilidadTotal ?? 0,

      margenUtilidad:
        metricas.margenUtilidad ?? 0,

      fechaInicial:
        metricas.fechaInicial ?? null,

      fechaFinal:
        metricas.fechaFinal ?? null,

      diasAnalizados:
        metricas.diasAnalizados ?? 0,

      ventaPromedioDiaria:
        metricas.ventaPromedioDiaria ?? 0,

      utilidadPromedioDiaria:
        metricas.utilidadPromedioDiaria ?? 0,
       
      saldoProveedores:
  creditosProveedores?.saldoTotal ?? 0,
    
     creditosProveedores:
  creditosProveedores?.creditos ?? [],

      });

  const {
    ventasTotales,
    costoTotal,
    utilidadTotal,
    margenUtilidad,

    entradasTesoreria,
    salidasTesoreria,
    dineroDisponible,

    movimientosPendientes,
    porcentajeGastos,

    proyeccionVentasMes,
    proyeccionUtilidadMes,

    reservaRecomendada,
    capacidadCompra,

    vencimientos7Dias,
    vencimientos15Dias,
    vencimientos30Dias,
    vencimientos60Dias,
    vencimientos90Dias,

    alertasFinancieras = [],
    decisionPrioritaria,

    accionesPrioritarias = [],

    nivel,
    estado,
    mensaje,
    recomendacion,
  } = analisisFinanciero;

     useEffect(() => {
  async function cargarCreditosProveedores() {
    if (!branchId) {
      setCreditosProveedores({
        importacion: null,
        creditos: [],
        saldoTotal: 0,
      });

      return;
    }

    try {
      const datos =
        await obtenerCreditosProveedoresActuales(
          branchId
        );

      setCreditosProveedores(datos);

  
     
    } catch (error) {
      console.error(
        "Error al cargar créditos de proveedores:",
        error
      );

      setCreditosProveedores({
        importacion: null,
        creditos: [],
        saldoTotal: 0,
      });
    }
  }

  cargarCreditosProveedores();
}, [branchId]);

     useEffect(() => {
      let activo = true;

    async function cargarDecisionesGuardadas() {
      try {
      
        const importacionActual =
  datosDashboard
    ?.importacion
    ?.id || null;

const historial =
  await obtenerHistorialDecisiones({
    limite: 100,
    importacionId:
      importacionActual,
  });

        if (!activo) {
          return;
        }
       
        const decisionesRecuperadas = {};

        accionesPrioritarias.forEach(
          (accion, indice) => {
            const claveAccion =
              `${accion.titulo}-${indice}`;

            const decisionGuardada =
              historial.find(
                (decision) =>
                  decision?.descripcion ===
                    accion.descripcion &&
                  (
                    !importacionActual ||
                    decision?.importacion_id ===
                      importacionActual
                  ) &&
                  [
                    "APROBADA",
                    "POSPUESTA",
                    "RECHAZADA",
                  ].includes(
                    decision?.estado
                  )
              );

            if (decisionGuardada) {
              decisionesRecuperadas[
                claveAccion
              ] =
                decisionGuardada.estado;
            }
          }
        );

        setDecisionesTomadas(
          decisionesRecuperadas
        );

        setHistorialDecisiones(
  historial
);

      } catch (errorHistorial) {
        console.error(
          "No fue posible recuperar las decisiones financieras:",
          errorHistorial
        );
      }
    }

    cargarDecisionesGuardadas();

    return () => {
      activo = false;
    };
  }, [
    datosDashboard?.importacion?.id,
  ]);

  const formatoDinero = (cantidad) =>
    new Intl.NumberFormat("es-MX", {
      style: "currency",
      currency: "MXN",
      minimumFractionDigits: 2,
    }).format(Number(cantidad) || 0);

  const formatoPorcentaje = (cantidad) =>
    `${(Number(cantidad) || 0).toFixed(2)} %`;

  const colorPrioridad = (prioridad) => {
    if (prioridad === "CRITICA") {
      return {
        fondo: "#fff0f0",
        borde: "#efaaaa",
        icono: "🔴",
      };
    }

    if (prioridad === "ALTA") {
      return {
        fondo: "#fff7ed",
        borde: "#f4c58d",
        icono: "🟠",
      };
    }

    if (prioridad === "MEDIA") {
      return {
        fondo: "#fffde8",
        borde: "#e8d77b",
        icono: "🟡",
      };
    }

    return {
      fondo: "#f2fff6",
      borde: "#b5dfc1",
      icono: "🟢",
    };
  };

  const tomarDecisionAccion =
    async (
      accion,
      indice,
      decision
    ) => {
      const claveAccion =
        `${accion.titulo}-${indice}`;

      if (
        decisionGuardando
      ) {
        return;
      }

      try {
        setDecisionGuardando(
          claveAccion
        );

        setMensajeDecision("");

        const opciones = {
          autorizadoPor: "Jefa",

          importacionId:
            datosDashboard
              ?.importacion
              ?.id || null,
        };

        if (
          decision ===
          "APROBADA"
        ) {
          await guardarDecisionAprobada(
            accion,
            opciones
          );
        } else if (
          decision ===
          "POSPUESTA"
        ) {
          await guardarDecisionPospuesta(
            accion,
            opciones
          );
        } else if (
          decision ===
          "RECHAZADA"
        ) {
          await guardarDecisionRechazada(
            accion,
            opciones
          );
        } else {
          throw new Error(
            "Decisión no reconocida."
          );
        }

        setDecisionesTomadas(
          (anteriores) => ({
            ...anteriores,

            [claveAccion]:
              decision,
          })
        );

        const textoDecision =
          decision ===
          "APROBADA"
            ? "aprobada"
            : decision ===
                "POSPUESTA"
              ? "pospuesta"
              : "descartada";

        setMensajeDecision(
          `✅ Decisión ${textoDecision} y registrada correctamente.`
        );
      } catch (errorDecision) {
        console.error(
          "Error al registrar decisión financiera:",
          errorDecision
        );

        setMensajeDecision(
          `❌ ${
            errorDecision?.message ||
            "No fue posible registrar la decisión."
          }`
        );
      } finally {
        setDecisionGuardando(
          null
        );
      }
    };

    const cambiarEstadoEjecucion =
  async (
    decision,
    nuevoEstado,
    resultadoEjecucion = null
  ) => {

      if (
        !decision?.id ||
        ejecucionGuardando
      ) {
        return;
      }

      try {
        setEjecucionGuardando(
          decision.id
        );

        setMensajeDecision("");

       const decisionActualizada =
  await actualizarEjecucionDecision({
    decisionId:
      decision.id,

    estadoEjecucion:
      nuevoEstado,

    resultadoEjecucion:
      nuevoEstado === "COMPLETADA"
        ? resultadoEjecucion
        : null,
  });

        setHistorialDecisiones(
          (anteriores) =>
            anteriores.map(
              (item) =>
                item.id ===
                decisionActualizada.id
                  ? decisionActualizada
                  : item
            )
        );

        setMensajeDecision(
          nuevoEstado ===
            "EN_PROCESO"
            ? "✅ Ejecución iniciada correctamente."
            : "✅ Ejecución actualizada correctamente."
        );
      } catch (errorEjecucion) {
        console.error(
          "Error al actualizar ejecución financiera:",
          errorEjecucion
        );

        setMensajeDecision(
          `❌ ${
            errorEjecucion?.message ||
            "No fue posible actualizar la ejecución."
          }`
        );
      } finally {
        setEjecucionGuardando(
          null
        );
      }
    };

         return (
    <section
      style={{
        marginTop: "30px",
        padding: "28px",
        borderRadius: "22px",
        background:
          "linear-gradient(135deg, #ffffff 0%, #fff8ef 100%)",
        border: "1px solid #f3d19c",
        boxShadow:
          "0 12px 35px rgba(180, 120, 40, 0.12)",
      }}
    >
      {mensajeDecision && (
        <div
          style={{
            marginBottom: "18px",
            padding: "12px 14px",
            borderRadius: "12px",
            backgroundColor:
              mensajeDecision.startsWith("✅")
                ? "#effaf2"
                : "#fff3f3",
            border:
              mensajeDecision.startsWith("✅")
                ? "1px solid #9bcbaa"
                : "1px solid #e5aaaa",
            color:
              mensajeDecision.startsWith("✅")
                ? "#247244"
                : "#9d3333",
            fontWeight: "800",
            textAlign: "center",
          }}
        >
          {mensajeDecision}
        </div>
      )}

      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          gap: "16px",
          flexWrap: "wrap",
        }}
      >
        <div>
          <p
            style={{
              margin: 0,
              color: "#9a6a29",
              fontWeight: "700",
            }}
          >
            MONYS OS · ANÁLISIS FINANCIERO
          </p>

          <h2
            style={{
              margin: "8px 0 0",
              fontSize: "28px",
            }}
          >
            💰 Informe del Director Financiero IA
          </h2>
        </div>

        <span
          style={{
            padding: "9px 14px",
            borderRadius: "999px",
            backgroundColor: "#ffffff",
            border: "1px solid #ead19f",
            fontWeight: "700",
          }}
        >
          {nivel} {estado}
        </span>
      </div>

      <h3
        style={{
          marginTop: "28px",
          marginBottom: "4px",
          fontSize: "20px",
        }}
      >
        Información de ventas SICAR
      </h3>

      <p
        style={{
          marginTop: 0,
          color: "#756d62",
          lineHeight: "1.7",
        }}
      >
        Resultados calculados con la última
        información disponible.
        <br />

        📅 Periodo analizado:{" "}
        <strong>
          {metricas.fechaInicial
            ? new Date(
                metricas.fechaInicial
              ).toLocaleDateString("es-MX")
            : "Sin fecha"}
        </strong>

        {" "}a{" "}

        <strong>
          {metricas.fechaFinal
            ? new Date(
                metricas.fechaFinal
              ).toLocaleDateString("es-MX")
            : "Sin fecha"}
        </strong>

        {" · "}

        🗓️{" "}
        <strong>
          {Number(
            metricas.diasAnalizados
          ) || 0} días analizados
        </strong>

        <br />

        💵 Venta promedio diaria:{" "}
        <strong>
          {formatoDinero(
            metricas.ventaPromedioDiaria
          )}
        </strong>

        {" · "}

        📈 Utilidad promedio diaria:{" "}
        <strong>
          {formatoDinero(
            metricas.utilidadPromedioDiaria
          )}
        </strong>
      </p>

      <div
        style={{
          display: "grid",
          gridTemplateColumns:
            "repeat(auto-fit, minmax(210px, 1fr))",
          gap: "16px",
          marginTop: "18px",
        }}
      >
        <TarjetaIndicador
          titulo="Ventas Totales"
          valor={formatoDinero(ventasTotales)}
          icono="🛒"
        />

        <TarjetaIndicador
           titulo="Saldo con proveedores"
           valor={formatoDinero(
           creditosProveedores?.saldoTotal || 0
           )}
           icono="💳"
           />

        <TarjetaIndicador
          titulo="Costo Total"
          valor={formatoDinero(costoTotal)}
          icono="🏷️"
        />

        <TarjetaIndicador
          titulo="Utilidad Total"
          valor={formatoDinero(utilidadTotal)}
          icono="📈"
        />

        <TarjetaIndicador
          titulo="Margen"
          valor={formatoPorcentaje(
            margenUtilidad
          )}
          icono="📊"
        />
      </div>

      <h3
        style={{
          marginTop: "30px",
          marginBottom: "4px",
          fontSize: "20px",
        }}
      >
        Flujo real de Tesorería
      </h3>

      <div
        style={{
          display: "grid",
          gridTemplateColumns:
            "repeat(auto-fit, minmax(210px, 1fr))",
          gap: "16px",
          marginTop: "18px",
        }}
      >
        <TarjetaIndicador
          titulo="Entradas"
          valor={formatoDinero(
            entradasTesoreria
          )}
          icono="📥"
        />

        <TarjetaIndicador
          titulo="Salidas"
          valor={formatoDinero(
            salidasTesoreria
          )}
          icono="📤"
        />

        <TarjetaIndicador
          titulo="Disponible"
          valor={formatoDinero(
            dineroDisponible
          )}
          icono="💵"
        />

        <TarjetaIndicador
          titulo="Movimientos pendientes"
          valor={String(
            movimientosPendientes
          )}
          icono="⏳"
        />

        <TarjetaIndicador
          titulo="Porcentaje utilizado"
          valor={formatoPorcentaje(
            porcentajeGastos
          )}
          icono="📉"
        />
      </div>

      <h3
        style={{
          marginTop: "32px",
          marginBottom: "4px",
          fontSize: "20px",
        }}
      >
        Proyección y capacidad financiera
      </h3>

      <div
        style={{
          display: "grid",
          gridTemplateColumns:
            "repeat(auto-fit, minmax(210px, 1fr))",
          gap: "16px",
          marginTop: "18px",
        }}
      >
        <TarjetaIndicador
          titulo="Proyección ventas del mes"
          valor={formatoDinero(
            proyeccionVentasMes
          )}
          icono="📅"
        />

        <TarjetaIndicador
          titulo="Proyección utilidad del mes"
          valor={formatoDinero(
            proyeccionUtilidadMes
          )}
          icono="📈"
        />

        <TarjetaIndicador
          titulo="Capacidad de compra sugerida"
          valor={formatoDinero(
            capacidadCompra
          )}
          icono="🛒"
        />

        <TarjetaIndicador
          titulo="Reserva recomendada"
          valor={formatoDinero(
            reservaRecomendada
          )}
          icono="🏦"
        />
      </div>

        <div
  style={{
    marginTop: "28px",
    padding: "22px",
    borderRadius: "18px",
    backgroundColor: "#fffaf4",
    border: "1px solid #ead7bd",
  }}
>
  <h2
    style={{
      margin: 0,
      fontSize: "22px",
    }}
  >
    💳 Obligaciones financieras identificadas
  </h2>

  <p
    style={{
      marginTop: "8px",
      color: "#756d62",
      lineHeight: "1.5",
    }}
  >
    Estas obligaciones ya fueron detectadas,
    pero todavía no todas tienen fecha de pago
    registrada.
  </p>

  <div
    style={{
      marginTop: "16px",
      padding: "16px",
      borderRadius: "14px",
      backgroundColor: "#ffffff",
      border: "1px solid #eadfd3",
    }}
  >
    <strong>
      Proveedores pendientes
    </strong>

    <div
      style={{
        marginTop: "6px",
        fontSize: "24px",
        fontWeight: "800",
      }}
    >
      {formatoDinero(
        creditosProveedores?.saldoTotal || 0
      )}
    </div>

    <div
      style={{
        marginTop: "6px",
        fontSize: "13px",
        color: "#756d62",
      }}
    >
      {creditosProveedores?.creditos?.length || 0}{" "}
      proveedores detectados en la última
      importación.
    </div>
    <div
  style={{
    marginTop: "18px",
    display: "grid",
    gridTemplateColumns:
      "repeat(auto-fit, minmax(150px, 1fr))",
    gap: "10px",
  }}
>
  <div
    style={{
      padding: "12px",
      borderRadius: "12px",
      backgroundColor: "#ffffff",
      border: "1px solid #eadfd3",
    }}
  >
    <strong>7 días</strong>

    <div
      style={{
        marginTop: "5px",
        fontWeight: "800",
      }}
    >
      {formatoDinero(
        vencimientos7Dias || 0
      )}
    </div>
  </div>

  <div
    style={{
      padding: "12px",
      borderRadius: "12px",
      backgroundColor: "#ffffff",
      border: "1px solid #eadfd3",
    }}
  >
    <strong>15 días</strong>

    <div
      style={{
        marginTop: "5px",
        fontWeight: "800",
      }}
    >
      {formatoDinero(
        vencimientos15Dias || 0
      )}
    </div>
  </div>

  <div
    style={{
      padding: "12px",
      borderRadius: "12px",
      backgroundColor: "#ffffff",
      border: "1px solid #eadfd3",
    }}
  >
    <strong>30 días</strong>

    <div
      style={{
        marginTop: "5px",
        fontWeight: "800",
      }}
    >
      {formatoDinero(
        vencimientos30Dias || 0
      )}
    </div>
  </div>

  <div
    style={{
      padding: "12px",
      borderRadius: "12px",
      backgroundColor: "#ffffff",
      border: "1px solid #eadfd3",
    }}
  >
    <strong>60 días</strong>

    <div
      style={{
        marginTop: "5px",
        fontWeight: "800",
      }}
    >
      {formatoDinero(
        vencimientos60Dias || 0
      )}
    </div>
  </div>

  <div
    style={{
      padding: "12px",
      borderRadius: "12px",
      backgroundColor: "#ffffff",
      border: "1px solid #eadfd3",
    }}
  >
    <strong>90 días</strong>

    <div
      style={{
        marginTop: "5px",
        fontWeight: "800",
      }}
    >
      {formatoDinero(
        vencimientos90Dias || 0
      )}
    </div>
  </div>
</div>
    <div
  style={{
    display: "grid",
    gap: "10px",
    marginTop: "18px",
  }}
>
  {creditosProveedores?.creditos?.map(
    (credito) => (
      <div
        key={credito.id}
        style={{
          padding: "12px 14px",
          borderRadius: "12px",
          backgroundColor: "#fffaf6",
          border: "1px solid #eee0d3",
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            gap: "12px",
            flexWrap: "wrap",
            fontWeight: "700",
          }}
        >
          <span>
            {credito.nombre}
          </span>

          <span>
            {formatoDinero(
              credito.saldo || 0
            )}
          </span>
        </div>

        <div
          style={{
            marginTop: "6px",
            fontSize: "13px",
            color: "#756d62",
          }}
        >
          Crédito:{" "}
          {credito.dias_credito
            ? `${credito.dias_credito} días`
            : "Sin registrar"}
          {" · "}

          {credito.fecha_vencimiento
            ? "Vence: "
            : "Vencimiento estimado: "}

          {credito.fecha_vencimiento_estimada
            ? new Date(
                `${credito.fecha_vencimiento_estimada}T00:00:00`
              ).toLocaleDateString(
                "es-MX"
              )
            : "Sin fecha"}
        </div>
      </div>
    )
  )}
</div>
  </div>
</div>

      {/* ============================================= */}
      {/* ACCIONES PRIORITARIAS */}
      {/* ============================================= */}

      <div
        style={{
          marginTop: "32px",
          padding: "24px",
          borderRadius: "20px",
          background:
            "linear-gradient(135deg, #fff 0%, #fff5f8 100%)",
          border: "2px solid #e8b8ca",
        }}
      >
        <h2
          style={{
            margin: 0,
            fontSize: "24px",
          }}
        >
          🎯 Acciones Prioritarias de Hoy
        </h2>

        <p
          style={{
            marginTop: "8px",
            color: "#756d62",
          }}
        >
          Ordenadas automáticamente por urgencia
          e impacto financiero.
        </p>

        <div
          style={{
            display: "grid",
            gap: "14px",
            marginTop: "20px",
          }}
        >
          {accionesPrioritarias.map(
            (accion, indice) => {
              const estilo =
                colorPrioridad(
                  accion.prioridad
                );

              return (
                <article
                  key={`${accion.titulo}-${indice}`}
                  style={{
                    padding: "18px",
                    borderRadius: "15px",
                    backgroundColor:
                      estilo.fondo,
                    border:
                      `1px solid ${estilo.borde}`,
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      justifyContent:
                        "space-between",
                      gap: "15px",
                      flexWrap: "wrap",
                    }}
                  >
                    <strong
                      style={{
                        fontSize: "17px",
                      }}
                    >
                      {estilo.icono}{" "}
                      PRIORIDAD {indice + 1}:{" "}
                      {accion.titulo}
                    </strong>

                    <span
                      style={{
                        fontSize: "13px",
                        fontWeight: "700",
                      }}
                    >
                      Impacto: {accion.impacto}
                    </span>
                  </div>

                  <p
                    style={{
                      lineHeight: "1.6",
                      marginBottom: "8px",
                    }}
                  >
                    {accion.descripcion}
                  </p>

                <div
  style={{
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: "12px",
    flexWrap: "wrap",
    marginTop: "10px",
  }}
>
  <small
    style={{
      color: "#756d62",
    }}
  >
    Responsable:{" "}
    {accion.responsable}
  </small>

  <span
    style={{
      padding: "5px 9px",
      borderRadius: "999px",
      backgroundColor: "#f3e8ff",
      color: "#6f42a8",
      fontSize: "12px",
      fontWeight: "800",
    }}
  >
    {decisionesTomadas[
  `${accion.titulo}-${indice}`
]
  ? decisionesTomadas[
      `${accion.titulo}-${indice}`
    ] === "APROBADA"
    ? "✅ Propuesta IA · Aprobada por Jefa"
    : decisionesTomadas[
          `${accion.titulo}-${indice}`
        ] === "POSPUESTA"
      ? "⏰ Propuesta IA · Pospuesta por Jefa"
      : "❌ Propuesta IA · Descartada por Jefa"
  : "🤖 Propuesta IA · Pendiente de decisión"}
  </span>
</div>

{!decisionesTomadas[
  `${accion.titulo}-${indice}`
] ? (
  <div
    style={{
      display: "flex",
      gap: "10px",
      flexWrap: "wrap",
      marginTop: "14px",
    }}
  >
    <button
      type="button"
      disabled={
        Boolean(decisionGuardando)
      }
      onClick={() =>
        tomarDecisionAccion(
          accion,
          indice,
          "APROBADA"
        )
      }
      style={{
        padding: "9px 13px",
        borderRadius: "10px",
        border: "1px solid #9bcbaa",
        backgroundColor: "#effaf2",
        color: "#247244",
        fontWeight: "800",
        cursor: decisionGuardando
          ? "default"
          : "pointer",
      }}
    >
      ✅ Aprobar
    </button>

    <button
      type="button"
      disabled={
        Boolean(decisionGuardando)
      }
      onClick={() =>
        tomarDecisionAccion(
          accion,
          indice,
          "POSPUESTA"
        )
      }
      style={{
        padding: "9px 13px",
        borderRadius: "10px",
        border: "1px solid #e2c66e",
        backgroundColor: "#fffbea",
        color: "#80691b",
        fontWeight: "800",
        cursor: decisionGuardando
          ? "default"
          : "pointer",
      }}
    >
      ⏰ Posponer
    </button>

    <button
      type="button"
      disabled={
        Boolean(decisionGuardando)
      }
      onClick={() =>
        tomarDecisionAccion(
          accion,
          indice,
          "RECHAZADA"
        )
      }
      style={{
        padding: "9px 13px",
        borderRadius: "10px",
        border: "1px solid #e5aaaa",
        backgroundColor: "#fff3f3",
        color: "#9d3333",
        fontWeight: "800",
        cursor: decisionGuardando
          ? "default"
          : "pointer",
      }}
    >
      ❌ Descartar
    </button>
  </div>
) : (
  <div
    style={{
      marginTop: "14px",
      padding: "9px 12px",
      borderRadius: "10px",
      backgroundColor: "#ffffff",
      border: "1px solid #ded5d9",
      fontWeight: "800",
      fontSize: "13px",
    }}
  >
    {decisionesTomadas[
      `${accion.titulo}-${indice}`
    ] === "APROBADA"
      ? "✅ Decisión humana: Aprobada"
      : decisionesTomadas[
            `${accion.titulo}-${indice}`
          ] === "POSPUESTA"
        ? "⏰ Decisión humana: Pospuesta"
        : "❌ Decisión humana: Descartada"}
  </div>
)}

                </article>
              );
            }
          )}
        </div>
      </div>

     {historialDecisiones.length > 0 && (
  <div
    style={{
      marginTop: "24px",
      padding: "22px",
      borderRadius: "18px",
      backgroundColor: "#ffffff",
      border: "1px solid #ead5df",
    }}
  >
    <h2
      style={{
        margin: 0,
        fontSize: "22px",
      }}
    >
      📋 Historial de decisiones financieras
    </h2>

    <p
      style={{
        marginTop: "8px",
        color: "#756d62",
      }}
    >
      Decisiones tomadas sobre la fotografía financiera actual.
    </p>

    <div
      style={{
        display: "grid",
        gap: "12px",
        marginTop: "18px",
      }}
    >
      {historialDecisiones.map(
        (decision) => (
          <div
            key={decision.id}
            style={{
              padding: "14px",
              borderRadius: "12px",
              border: "1px solid #eadde4",
              backgroundColor: "#fffdfd",
            }}
          >
            <strong>
              {decision.estado === "APROBADA"
                ? "✅ APROBADA"
                : decision.estado === "POSPUESTA"
                  ? "⏰ POSPUESTA"
                  : decision.estado === "RECHAZADA"
                    ? "❌ DESCARTADA"
                    : decision.estado}
            </strong>

            <p
              style={{
                margin: "8px 0 4px",
                lineHeight: "1.5",
              }}
            >
              {decision.descripcion}
            </p>

            <small
              style={{
                color: "#756d62",
              }}
            >
              Decidido por:{" "}
              {decision.autorizado_por || "Sin registrar"}
            </small>
            {decision.estado === "APROBADA" && (
  <div
    style={{
      marginTop: "12px",
      display: "flex",
      alignItems: "center",
      gap: "10px",
      flexWrap: "wrap",
    }}
  >
    <span
      style={{
        padding: "6px 10px",
        borderRadius: "999px",
        backgroundColor:
          decision.estado_ejecucion === "EN_PROCESO"
            ? "#fff6dd"
            : decision.estado_ejecucion === "COMPLETADA"
              ? "#effaf2"
              : "#f4f1f2",
        color:
          decision.estado_ejecucion === "EN_PROCESO"
            ? "#8a6718"
            : decision.estado_ejecucion === "COMPLETADA"
              ? "#247244"
              : "#655b60",
        fontSize: "12px",
        fontWeight: "800",
      }}
    >
      {decision.estado_ejecucion === "EN_PROCESO"
        ? "⏳ Ejecución: En proceso"
        : decision.estado_ejecucion === "COMPLETADA"
          ? "✅ Ejecución: Completada"
          : "🕒 Ejecución: Pendiente"}
    </span>

        {decision.estado_ejecucion === "COMPLETADA" &&
  decision.resultado_ejecucion && (
    <div
      style={{
        flexBasis: "100%",
        marginTop: "8px",
        padding: "10px 12px",
        borderRadius: "10px",
        backgroundColor: "#f4fff7",
        border: "1px solid #bfe2ca",
        color: "#247244",
        fontSize: "13px",
        lineHeight: "1.5",
      }}
    >
      <strong>
        📌 Resultado obtenido:
      </strong>{" "}
      {decision.resultado_ejecucion}
    </div>
  )}

    {(
      !decision.estado_ejecucion ||
      decision.estado_ejecucion === "PENDIENTE"
    ) && (
      <button
        type="button"
        disabled={
          Boolean(ejecucionGuardando)
        }
        onClick={() =>
          cambiarEstadoEjecucion(
            decision,
            "EN_PROCESO"
          )
        }
        style={{
          padding: "8px 12px",
          borderRadius: "9px",
          border: "1px solid #e2c66e",
          backgroundColor: "#fffbea",
          color: "#80691b",
          fontWeight: "800",
          cursor: ejecucionGuardando
            ? "default"
            : "pointer",
        }}
      >
        ▶️ Iniciar ejecución
      </button>
    )}

  {decision.estado_ejecucion === "EN_PROCESO" && (
  <>
    <input
      type="text"
      placeholder="Escribe el resultado obtenido..."
      value={
        resultadosEjecucion[
          decision.id
        ] || ""
      }
      onChange={(evento) =>
        setResultadosEjecucion(
          (anteriores) => ({
            ...anteriores,
            [decision.id]:
              evento.target.value,
          })
        )
      }
      style={{
        flex: "1 1 260px",
        minWidth: "220px",
        padding: "9px 11px",
        borderRadius: "9px",
        border: "1px solid #d8cfd3",
        backgroundColor: "#ffffff",
      }}
    />

    <button
      type="button"
      disabled={
        Boolean(ejecucionGuardando) ||
        !String(
          resultadosEjecucion[
            decision.id
          ] || ""
        ).trim()
      }
      onClick={() =>
        cambiarEstadoEjecucion(
          decision,
          "COMPLETADA",
          resultadosEjecucion[
            decision.id
          ]
        )
      }
      style={{
        padding: "8px 12px",
        borderRadius: "9px",
        border: "1px solid #9bcbaa",
        backgroundColor: "#effaf2",
        color: "#247244",
        fontWeight: "800",
        cursor:
          ejecucionGuardando ||
          !String(
            resultadosEjecucion[
              decision.id
            ] || ""
          ).trim()
            ? "default"
            : "pointer",
      }}
    >
      ✅ Completar ejecución
    </button>
  </>
)}

  </div>
)}
          </div>
        )
      )}
    </div>
  </div>
)}

      <div
        style={{
          marginTop: "24px",
          padding: "22px",
          borderRadius: "16px",
          backgroundColor: "#fff7df",
          border: "1px solid #ecd392",
        }}
      >
        <strong
          style={{
            fontSize: "18px",
          }}
        >
          🎯 Decisión prioritaria del CFO
        </strong>

        <p
          style={{
            marginBottom: 0,
            lineHeight: "1.7",
          }}
        >
          {decisionPrioritaria}
        </p>
      </div>

      <div
        style={{
          marginTop: "18px",
          padding: "22px",
          borderRadius: "16px",
          backgroundColor:
            alertasFinancieras.length > 0
              ? "#fff4f4"
              : "#f3fff7",
          border:
            alertasFinancieras.length > 0
              ? "1px solid #efc2c2"
              : "1px solid #bfe2ca",
        }}
      >
        <strong
          style={{
            fontSize: "18px",
          }}
        >
          🚨 Alertas financieras
        </strong>

        {alertasFinancieras.length === 0 ? (
          <p>
            No se detectaron alertas financieras
            críticas.
          </p>
        ) : (
          <ul>
            {alertasFinancieras.map(
              (alerta, indice) => (
                <li key={indice}>
                  {alerta}
                </li>
              )
            )}
          </ul>
        )}
      </div>

      <div
        style={{
          marginTop: "24px",
          padding: "20px",
          borderRadius: "16px",
          backgroundColor: "#ffffff",
          border: "1px solid #f2dfbb",
        }}
      >
        <strong
          style={{
            fontSize: "18px",
          }}
        >
          {nivel} Diagnóstico financiero
        </strong>

        <p
          style={{
            marginBottom: 0,
            lineHeight: "1.7",
          }}
        >
          {mensaje}
        </p>
      </div>

      <div
        style={{
          marginTop: "18px",
          padding: "20px",
          borderRadius: "16px",
          backgroundColor: "#fffdf8",
          border: "1px solid #f2dfbb",
        }}
      >
        <strong
          style={{
            fontSize: "18px",
          }}
        >
          📋 Recomendación del Director Financiero
        </strong>

        <p
          style={{
            marginBottom: 0,
            lineHeight: "1.7",
          }}
        >
          {recomendacion}
        </p>
      </div>
    </section>
  );
}

export default DirectorFinanciero;