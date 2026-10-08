import {
  useEffect,
  useState,
} from "react";
import Header from "../../components/layout/Header";
import AgendaJefa from "./components/AgendaJefa";
import {
  obtenerRecordatoriosJefa,
} from "./services/recordatoriosJefaService";
export default function InicioJefa({
  ventasTotales = 0,
  utilidadTotal = 0,
  disponible = 0,
fechaInicial = null,
fechaFinal = null,
movimientos = [],
  formatoDinero,
  abrirJuntaDirectiva,
  abrirCentroValor,
  abrirTesoreria,
  abrirInventario,
  abrirCompraMaestra,
  abrirUsuarios,
  abrirImportador,
  abrirFlotilla,
  sucursalesDashboard = [],
  cargandoSucursales = false,
  errorSucursales = "",

  contenidoOperacion = null,
  contenidoAcciones = null,
  contenidoSicar = null,
  contenidoCierre = null,
}) {

    const formatearFechaPeriodo = (valor) => {
    if (!valor) {
      return "";
    }

    const fechaTexto =
      String(valor).slice(0, 10);

    const [
      anio,
      mes,
      dia,
    ] = fechaTexto.split("-");

    if (
      !anio ||
      !mes ||
      !dia
    ) {
      return fechaTexto;
    }

    return `${dia}/${mes}/${anio}`;
  };

  const detallePeriodo =
    fechaInicial && fechaFinal
      ? `${formatearFechaPeriodo(
          fechaInicial
        )} al ${formatearFechaPeriodo(
          fechaFinal
        )}`
      : "Periodo no disponible";

  const [
    recordatoriosJefa,
    setRecordatoriosJefa,
  ] = useState([]);

  const [
    cargandoRecordatorios,
    setCargandoRecordatorios,
  ] = useState(true);

  const [
    errorRecordatorios,
    setErrorRecordatorios,
  ] = useState("");

  useEffect(() => {
    let componenteActivo = true;

    const cargarRecordatorios =
      async () => {
        try {
          setCargandoRecordatorios(
            true
          );

          setErrorRecordatorios(
            ""
          );

          const resultado =
            await obtenerRecordatoriosJefa();

          if (componenteActivo) {
            setRecordatoriosJefa(
              resultado.recordatorios ||
                []
            );
          }
        } catch (error) {
          console.error(
            "Error al cargar recordatorios:",
            error
          );

          if (componenteActivo) {
            setErrorRecordatorios(
              error?.message ||
                "No fue posible revisar las tareas pendientes."
            );
          }
        } finally {
          if (componenteActivo) {
            setCargandoRecordatorios(
              false
            );
          }
        }
      };

    cargarRecordatorios();

    return () => {
      componenteActivo = false;
    };
  }, []);

  const movimientosPendientes =
     movimientos.filter((movimiento) => {
      const estado = String(
        movimiento?.estado || ""
      ).toLowerCase();

      return (
        estado.includes("pendiente") ||
        estado.includes("revision")
      );
    }).length;

  const hayPendientes =
    movimientosPendientes > 0;

    const ventasConsolidadas =
  sucursalesDashboard.reduce(
    (total, sucursal) =>
      total +
      (Number(
        sucursal?.ventasTotales
      ) || 0),
    0
  );

const utilidadConsolidada =
  sucursalesDashboard.reduce(
    (total, sucursal) =>
      total +
      (Number(
        sucursal?.utilidadTotal
      ) || 0),
    0
  );

  const recordatorioPrioritario =
    recordatoriosJefa[0] || null;

  const sucursalConRiesgo =
    sucursalesDashboard.find(
      (sucursal) =>
        sucursal?.tieneDatos &&
        sucursal?.salud?.causas?.length > 0
    ) || null;

  const decisionDelDia = cargandoRecordatorios
    ? {
        titulo: "Analizando la operación real de hoy",
        detalle:
          "MONYS está ordenando pendientes, datos y riesgos antes de recomendarte una acción.",
        boton: "Revisando datos…",
        accion: null,
      }
    : movimientosPendientes > 0
      ? {
          titulo:
            movimientosPendientes === 1
              ? "Aclarar el movimiento pendiente antes de decidir con el flujo"
              : `Aclarar ${movimientosPendientes} movimientos antes de decidir con el flujo`,
          detalle:
            "La prioridad es dejar confiable el dinero real antes de autorizar nuevas compras o gastos.",
          boton: "Revisar en Tesorería",
          accion: abrirTesoreria,
        }
      : recordatorioPrioritario
        ? {
            titulo: recordatorioPrioritario.titulo,
            detalle: recordatorioPrioritario.detalle,
            boton: recordatorioPrioritario.boton,
            accion:
              recordatorioPrioritario.tipo === "importador"
                ? abrirImportador
                : abrirTesoreria,
          }
        : sucursalConRiesgo
          ? {
              titulo: `Revisar ${sucursalConRiesgo.nombre}: ${
                sucursalConRiesgo.salud?.titulo || "requiere atención"
              }`,
              detalle:
                sucursalConRiesgo.salud?.causas?.[0] ||
                "La sucursal presenta una señal que necesita revisión.",
              boton: "Abrir Junta Directiva",
              accion: abrirJuntaDirectiva,
            }
          : {
              titulo: "La operación no presenta una decisión crítica pendiente",
              detalle:
                "Puedes revisar oportunidades y siguientes acciones con tus Directores IA.",
              boton: "Abrir Junta Directiva",
              accion: abrirJuntaDirectiva,
            };

  return (
    <main
      style={{
        minHeight: "100vh",
        background:
          "radial-gradient(circle at 85% 0%, #fde7f2 0, transparent 30%), #fff9fc",
        paddingBottom: "40px",
      }}
    >
      <Header />

      <section
        style={{
          width: "min(100% - 24px, 1100px)",
          margin: "0 auto",
          paddingTop: "20px",
          textAlign: "left",
        }}
      >
        {/* SALUDO */}

        <div
          style={{
            marginBottom: "14px",
            padding: "20px",
            border: "1px solid #efdce6",
            borderRadius: "22px",
            background:
              "linear-gradient(135deg, rgba(255,255,255,.98), rgba(255,241,247,.96))",
            boxShadow:
              "0 14px 38px rgba(105, 37, 72, 0.08)",
          }}
        >
          <div
            style={{
              color: "#a92e67",
              fontSize: "12px",
              fontWeight: "900",
              letterSpacing: "1px",
            }}
          >
            MONYS OS · DIRECCIÓN
          </div>

          <h1
            style={{
              margin: "4px 0 3px",
              fontSize: "clamp(26px, 4vw, 38px)",
              letterSpacing: "-0.8px",
              color: "#291d23",
            }}
          >
            Hola, Jefa 👑
          </h1>

          <div
            style={{
              color: "#7d6e75",
              fontSize: "14px",
            }}
          >
            Esto es lo que requiere tu
            atención hoy.
          </div>
        </div>

        {/* MÉTRICAS */}

        <div
          style={{
            display: "grid",
            gridTemplateColumns:
              "repeat(auto-fit, minmax(190px, 1fr))",
            gap: "8px",
            marginBottom: "16px",
          }}
        >
          <MetricaJefa
            icono="↗"
            titulo="Ventas"
            valor={formatoDinero(
              ventasConsolidadas
            )}
          />

          <MetricaJefa
            icono="◆"
            titulo="Utilidad bruta"
            valor={formatoDinero(
              utilidadConsolidada
            )}
          />

         <MetricaJefa
  icono="◎"
  titulo="Flujo neto del periodo"
  valor={formatoDinero(
    disponible
  )}
  detalle={detallePeriodo}
/>

        </div>

        <section style={{ background: "#49293e", borderRadius: 18, padding: 20, color: "white", marginBottom: 18 }}>
          <div style={{ fontSize: 10, letterSpacing: 1.4, color: "#e9bed3", fontWeight: 800 }}>DIRECCIÓN · INTELIGENCIA · RESULTADOS</div>
          <h2 style={{ fontSize: 23, margin: "10px 0" }}>Tu Junta y el valor de tus decisiones</h2>
          <p style={{ fontSize: 13, color: "#ead5e2", lineHeight: 1.5 }}>Revisa propuestas, trabaja iniciativas y comprueba sus resultados. Los ingresos por vender MONYS se consultan por separado.</p>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <button type="button" onClick={abrirJuntaDirectiva} style={{ padding: "12px 16px", minHeight: 44, border: 0, borderRadius: 11, background: "#f0c1d8", color: "#49293e", fontWeight: 800, cursor: "pointer" }}>Abrir Junta Directiva →</button>
            <button type="button" onClick={abrirCentroValor} style={{ padding: "12px 16px", minHeight: 44, border: "1px solid #e6bdd2", borderRadius: 11, background: "white", color: "#49293e", fontWeight: 800, cursor: "pointer" }}>Centro de Valor →</button>
          </div>
        </section>

        {/* ATENCIÓN */}

                <AgendaJefa
          recordatorios={
            recordatoriosJefa
          }
          movimientosPendientes={
            movimientosPendientes
          }
          cargando={
            cargandoRecordatorios
          }
          error={
            errorRecordatorios
          }
          abrirTesoreria={
            abrirTesoreria
          }
          abrirImportador={
            abrirImportador
          }
        />


        <section
          style={{
           display: "none",
            background: hayPendientes
              ? "#fff7f3"
              : "#f3faf6",
            border: hayPendientes
              ? "1px solid #f0d1c5"
              : "1px solid #cae6d5",
            borderRadius: "18px",
            padding: "16px",
            marginBottom: "12px",
          }}
        >
          <div
            style={{
              fontSize: "11px",
              fontWeight: "900",
              color: hayPendientes
                ? "#a65435"
                : "#377357",
              marginBottom: "5px",
              letterSpacing: "0.5px",
            }}
          >
            {hayPendientes
              ? "🚨 REQUIERE TU ATENCIÓN"
              : "✅ OPERACIÓN BAJO CONTROL"}
          </div>

          <strong
            style={{
              display: "block",
              fontSize: "18px",
              color: "#30232a",
            }}
          >
            {hayPendientes
              ? `${movimientosPendientes} movimientos pendientes`
              : "No hay alertas críticas aquí"}
          </strong>

          <div
            style={{
              marginTop: "5px",
              color: "#77686f",
              fontSize: "13px",
              lineHeight: 1.4,
            }}
          >
            {hayPendientes
              ? "MONYS te mostrará aquí solamente lo que realmente necesite tu decisión."
              : "Si todo está funcionando, no necesitas revisar listas completas."}
          </div>

          {hayPendientes && (
            <button
              type="button"
              onClick={abrirTesoreria}
              style={estiloBotonSecundario}
            >
              Revisar pendientes
            </button>
          )}
        </section>

        {/* DECISIÓN DEL DÍA */}

        <section
          style={{
            background:
              "linear-gradient(135deg, #6f2750 0%, #a93670 100%)",
            borderRadius: "20px",
            padding: "18px",
            color: "#ffffff",
            marginBottom: "12px",
            boxShadow:
              "0 10px 28px rgba(112,39,80,0.17)",
          }}
        >
          <div
            style={{
              fontSize: "11px",
              fontWeight: "900",
              opacity: 0.82,
              letterSpacing: "0.7px",
            }}
          >
            🧠 DECISIÓN DEL DÍA
          </div>

          <div
            style={{
              fontSize: "20px",
              fontWeight: "900",
              marginTop: "6px",
              lineHeight: 1.25,
            }}
          >
            {decisionDelDia.titulo}
          </div>

          <div
            style={{
              marginTop: "7px",
              fontSize: "13px",
              opacity: 0.9,
              lineHeight: 1.45,
            }}
          >
            {decisionDelDia.detalle}
          </div>

          <button
            type="button"
            onClick={decisionDelDia.accion || undefined}
            disabled={!decisionDelDia.accion}
            style={{
              marginTop: "13px",
              width: "100%",
              border: "none",
              background: "#ffffff",
              color: "#762a53",
              borderRadius: "13px",
              padding: "12px",
              fontWeight: "900",
              cursor: decisionDelDia.accion
                ? "pointer"
                : "wait",
              opacity: decisionDelDia.accion ? 1 : 0.72,
            }}
          >
            {decisionDelDia.boton}
          </button>
        </section>

        {/* SUCURSALES */}

        <section
          style={{
            background: "#ffffff",
            border:
              "1px solid #eadde4",
            borderRadius: "18px",
            padding: "16px",
            marginBottom: "12px",
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent:
                "space-between",
              alignItems: "center",
              gap: "10px",
              marginBottom: "12px",
            }}
          >
            <div>
              <div
                style={{
                  fontSize: "11px",
                  fontWeight: "900",
                  color: "#8b315d",
                  letterSpacing: "0.6px",
                }}
              >
                🏪 MIS SUCURSALES
              </div>

              <div
                style={{
                  marginTop: "3px",
                  color: "#7b6a72",
                  fontSize: "12px",
                }}
              >
                Vista rápida por sucursal
              </div>
            </div>

            <span
              style={{
                fontSize: "12px",
                color: "#9b8891",
                fontWeight: "700",
              }}
            >
              {sucursalesDashboard.length}{" "}
              sucursal
              {sucursalesDashboard.length ===
              1
                ? ""
                : "es"}
            </span>
          </div>

          {cargandoSucursales && (
            <div
              style={{
                padding: "16px",
                borderRadius: "14px",
                background: "#faf6f8",
                color: "#7d6c74",
                textAlign: "center",
                fontSize: "13px",
              }}
            >
              Analizando sucursales...
            </div>
          )}

          {!cargandoSucursales &&
            errorSucursales && (
              <div
                style={{
                  padding: "12px",
                  borderRadius: "12px",
                  background: "#fff2f2",
                  color: "#a33d3d",
                  fontSize: "13px",
                }}
              >
                {errorSucursales}
              </div>
            )}

          {!cargandoSucursales &&
            !errorSucursales &&
            sucursalesDashboard.length ===
              0 && (
              <div
                style={{
                  padding: "16px",
                  borderRadius: "14px",
                  background: "#faf6f8",
                  color: "#7d6c74",
                  textAlign: "center",
                  fontSize: "13px",
                }}
              >
                No hay sucursales activas
                disponibles para analizar.
              </div>
            )}

          {!cargandoSucursales &&
            !errorSucursales &&
            sucursalesDashboard.length >
              0 && (
              <div
                style={{
                  display: "grid",
                  gap: "9px",
                }}
              >
                {sucursalesDashboard.map(
                  (sucursal) => (
                    <SucursalCard
                      key={sucursal.id}
                      sucursal={sucursal}
                      formatoDinero={
                        formatoDinero
                      }
                    />
                  )
                )}
              </div>
            )}
        </section>

        {/* VALOR MONYS */}

        <section
          style={{
            background: "#ffffff",
            border:
              "1px solid #eadde4",
            borderRadius: "18px",
            padding: "16px",
            marginBottom: "12px",
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent:
                "space-between",
              alignItems: "center",
              gap: "12px",
            }}
          >
            <div>
              <div
                style={{
                  color: "#8b315d",
                  fontSize: "11px",
                  fontWeight: "900",
                  letterSpacing: "0.5px",
                }}
              >
                💰 VALOR GENERADO POR MONYS
              </div>

              <strong
                style={{
                  display: "block",
                  marginTop: "5px",
                  fontSize: "18px",
                  color: "#2d2127",
                }}
              >
                Empezaremos a medirlo
              </strong>

              <div
                style={{
                  color: "#786970",
                  marginTop: "5px",
                  fontSize: "12px",
                  lineHeight: 1.4,
                }}
              >
                Compras evitadas + ventas
                recuperadas + capital liberado
                + horas que MONYS te ahorre.
              </div>
            </div>

            <div
              style={{
                fontSize: "27px",
              }}
            >
              📈
            </div>
          </div>
        </section>

        {/* ACCIONES RÁPIDAS */}

        <div
          style={{
            marginBottom: "8px",
            fontSize: "11px",
            fontWeight: "900",
            color: "#846e79",
            letterSpacing: "0.5px",
          }}
        >
          ACCIONES RÁPIDAS
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns:
              "repeat(auto-fit, minmax(190px, 1fr))",
            gap: "9px",
            marginBottom: "18px",
          }}
        >
         
              <Acceso
  icono="📄"
  texto="Importar reportes"
  onClick={() => {
    console.log("CLICK IMPORTADOR");
    abrirImportador?.();
  }}
/>


          <Acceso
            icono="🛒"
            texto="Compra Maestra"
            onClick={
              abrirCompraMaestra
            }
          />

          <Acceso
            icono="💰"
            texto="Tesorería"
            onClick={
              abrirTesoreria
            }
          />

          <Acceso
            icono="🚚"
            texto="Flotilla"
            onClick={abrirFlotilla}
          />

          <Acceso
            icono="👥"
            texto="Usuarios"
            onClick={
              abrirUsuarios
            }
          />
        </div>

        {/* MÁS INFORMACIÓN */}

        <div
          style={{
            marginBottom: "8px",
            fontSize: "11px",
            fontWeight: "900",
            color: "#846e79",
            letterSpacing: "0.5px",
          }}
        >
          MÁS INFORMACIÓN
        </div>

        {contenidoAcciones && (
          <BloquePlegable
            titulo="🎯 Acciones prioritarias"
          >
            {contenidoAcciones}
          </BloquePlegable>
        )}

        {contenidoOperacion && (
          <BloquePlegable
            titulo="⚡ Operación completa"
          >
            {contenidoOperacion}
          </BloquePlegable>
        )}

        {contenidoSicar && (
          <BloquePlegable
            titulo="📊 Resumen SICAR"
          >
            {contenidoSicar}
          </BloquePlegable>
        )}

        {contenidoCierre && (
          <BloquePlegable
            titulo="📝 Cierre de turno"
          >
            {contenidoCierre}
          </BloquePlegable>
        )}
      </section>
    </main>
  );
}

function SucursalCard({
  sucursal,
  formatoDinero,
}) {
  const tieneDatos =
    sucursal?.tieneDatos;

  return (
    <details
      style={{
        border:
          "1px solid #eee2e8",
        borderRadius: "14px",
        background: "#fffafd",
        overflow: "hidden",
      }}
    >
      <summary
        style={{
          display: "flex",
          justifyContent:
            "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: "10px",
          padding: "13px",
          cursor: "pointer",
          listStyle: "none",
        }}
      >
        <div style={{ minWidth: "150px", flex: "1 1 180px" }}>
          <strong
            style={{
              display: "block",
              color: "#32242b",
              fontSize: "16px",
            }}
          >
            🏬 {sucursal.nombre}
          </strong>

          <div
            style={{
              color: "#8b7982",
              fontSize: "11px",
              marginTop: "3px",
            }}
          >
            {tieneDatos
              ? `${sucursal.diasAnalizados || 0} días analizados`
              : "Sin información suficiente"}
          </div>
        </div>

        {tieneDatos && (
          <div
            style={{
              display: "flex",
              gap: "18px",
              flex: "1 1 250px",
            }}
          >
            <ResumenSucursal
              titulo="Ventas"
              valor={formatoDinero(sucursal.ventasTotales)}
            />
            <ResumenSucursal
              titulo="Utilidad"
              valor={formatoDinero(sucursal.utilidadTotal)}
            />
          </div>
        )}

        <span
          style={{
            padding: "6px 9px",
            borderRadius: "999px",
            background: tieneDatos
              ? "#fff5db"
              : "#f5f1f3",
            color: tieneDatos
              ? "#8a6500"
              : "#88727d",
            fontSize: "10px",
            fontWeight: "900",
            whiteSpace: "nowrap",
            flex: "0 0 auto",
          }}
        >
          {tieneDatos
            ? sucursal?.salud?.titulo || "POR EVALUAR"
            : "SIN DATOS"}
        </span>
      </summary>

      {tieneDatos && (
        <div
          style={{
            borderTop: "1px solid #eee2e8",
            padding: "12px 13px 13px",
            display: "grid",
            gridTemplateColumns:
              "repeat(2, minmax(0, 1fr))",
            gap: "8px",
          }}
        >
          <DatoSucursal
            titulo="Promedio diario"
            valor={formatoDinero(
              sucursal.ventaPromedioDiaria
            )}
          />

          <DatoSucursal
            titulo="Inventario"
            valor={`${sucursal.productosInventario || 0} registros`}
          />

          {sucursal?.salud?.causas?.length > 0 && (
            <div
              style={{
                gridColumn: "1 / -1",
                padding: "10px 11px",
                borderRadius: "11px",
                background: "#fff8e5",
                color: "#735a12",
                fontSize: "12px",
                lineHeight: 1.45,
              }}
            >
              <strong>Por qué requiere atención: </strong>
              {sucursal.salud.causas[0]}
            </div>
          )}
        </div>
      )}
    </details>
  );
}

function ResumenSucursal({ titulo, valor }) {
  return (
    <div style={{ minWidth: 0 }}>
      <div
        style={{
          color: "#927f88",
          fontSize: "10px",
          fontWeight: "800",
        }}
      >
        {titulo}
      </div>
      <strong
        style={{
          display: "block",
          marginTop: "2px",
          color: "#392a31",
          fontSize: "13px",
        }}
      >
        {valor}
      </strong>
    </div>
  );
}

function DatoSucursal({
  titulo,
  valor,
}) {

  
  return (
    <div
      style={{
        background: "#ffffff",
        borderRadius: "11px",
        padding: "9px",
        border:
          "1px solid #f0e5ea",
      }}
    >
      <div
        style={{
          color: "#927f88",
          fontSize: "10px",
          fontWeight: "800",
        }}
      >
        {titulo}
      </div>

      <strong
        style={{
          display: "block",
          marginTop: "3px",
          color: "#392a31",
          fontSize: "13px",
        }}
      >
           {valor}
    </strong>

    </div>
  );
}

function MetricaJefa({
  icono,
  titulo,
  valor,
  detalle = "",
}) {
  return (
    <div
      style={{
        background: "#ffffff",
        border: "1px solid #eadde4",
        borderRadius: "14px",
        padding: "15px",
        textAlign: "left",
        minWidth: 0,
        boxShadow:
          "0 8px 24px rgba(83, 39, 62, 0.05)",
      }}
    >
      <div
        style={{
          color: "#8a7680",
          fontSize: "11px",
          fontWeight: "900",
          marginBottom: "7px",
          display: "flex",
          alignItems: "center",
          gap: "6px",
        }}
      >
        <span style={{ color: "#c72772" }}>{icono}</span>
        <span>{titulo}</span>
      </div>

      <strong
        style={{
          color: "#2d2026",
          fontSize: "clamp(15px, 2vw, 20px)",
          wordBreak: "break-word",
        }}
      >
        {valor}
      </strong>

      {detalle && (
        <div
          style={{
            marginTop: "4px",
            color: "#8a7680",
            fontSize: "10px",
            fontWeight: "600",
          }}
        >
          {detalle}
        </div>
      )}
    </div>
  );
}


function Acceso({
  icono,
  texto,
  onClick,
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        border:
          "1px solid #eadde4",
        background: "#ffffff",
        borderRadius: "14px",
        padding: "13px 10px",
        color: "#4d3642",
        fontWeight: "800",
        cursor: "pointer",
        textAlign: "left",
      }}
    >
      <span
        style={{
          marginRight: "7px",
        }}
      >
        {icono}
      </span>

      {texto}
    </button>
  );
}

function BloquePlegable({
  titulo,
  children,
}) {
  return (
    <details
      style={{
        background: "#ffffff",
        border:
          "1px solid #eadde4",
        borderRadius: "15px",
        marginBottom: "10px",
        overflow: "hidden",
      }}
    >
      <summary
        style={{
          padding: "15px",
          cursor: "pointer",
          fontWeight: "800",
          color: "#6e4058",
          fontSize: "14px",
        }}
      >
        {titulo}
      </summary>

      <div
        style={{
          padding:
            "0 8px 14px",
        }}
      >
        {children}
      </div>
    </details>
  );
}

const estiloBotonSecundario = {
  marginTop: "11px",
  border:
    "1px solid #e3c4b8",
  background: "#ffffff",
  color: "#8d4b35",
  borderRadius: "11px",
  padding: "9px 12px",
  fontWeight: "800",
  cursor: "pointer",
  fontSize: "13px",
};
