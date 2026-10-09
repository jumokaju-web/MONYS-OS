import './InicioJefa.css';
import {
  useEffect,
  useState,
} from "react";
import Header from "../../components/layout/Header";
import AgendaJefa from "./components/AgendaJefa";
import SalaRescateJefa from "./components/SalaRescateJefa";
import {
  obtenerRecordatoriosJefa,
} from "./services/recordatoriosJefaService";
import { generarAnalisisFinanciero } from "../inteligencia/ia/directorFinancieroIA";

function antiguedadEnDias(fecha) {
  if (!fecha) return null;

  const valor = new Date(`${String(fecha).slice(0, 10)}T12:00:00`);
  if (Number.isNaN(valor.getTime())) return null;

  return Math.max(0, Math.floor((Date.now() - valor.getTime()) / 86400000));
}

export default function InicioJefa({
  datosDashboard = null,
  ventasTotales = 0,
  utilidadTotal = 0,
  disponible = 0,
  movimientosFlujo = [],
fechaInicial = null,
fechaFinal = null,
movimientos = [],
  formatoDinero,
  abrirMarketing,
  abrirEmpleados,
  abrirFinanzas,
  abrirJuntaDirectiva,
  abrirCentroValor,
  abrirDirectorFinanciero,
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

    const fecha = valor instanceof Date ? valor : new Date(/^\d{4}-\d{2}-\d{2}$/.test(String(valor)) ? `${valor}T12:00:00` : valor);
    return Number.isNaN(fecha.getTime()) ? 'Fecha pendiente' : fecha.toLocaleDateString('es-MX', {day:'2-digit',month:'2-digit',year:'numeric'});
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

  const antiguedadDatos = antiguedadEnDias(fechaFinal);
  const datosFinancierosVigentes =
    antiguedadDatos !== null && antiguedadDatos <= 7;
  const flujoPositivo = Number(disponible) > 0;
  const salidaNuevaBloqueada =
    !datosFinancierosVigentes || hayPendientes || !flujoPositivo;

  const controlesDinero = [
    {
      titulo: "Base para decidir",
      valor: datosFinancierosVigentes ? "Vigente" : "Actualizar",
      detalle:
        antiguedadDatos === null
          ? "No hay fecha confirmada"
          : `Corte de hace ${antiguedadDatos} día${antiguedadDatos === 1 ? "" : "s"}`,
      estado: datosFinancierosVigentes ? "bien" : "alerta",
    },
    {
      titulo: "Flujo comprobable",
      valor: datosFinancierosVigentes
        ? formatoDinero(disponible)
        : "Sin autorizar",
      detalle: datosFinancierosVigentes
        ? detallePeriodo
        : "No usar datos antiguos para gastar",
      estado: datosFinancierosVigentes && flujoPositivo ? "bien" : "alerta",
    },
    {
      titulo: "Movimientos por aclarar",
      valor: movimientosPendientes,
      detalle: hayPendientes
        ? "Primero conciliar en Tesorería"
        : "Sin pendientes detectados",
      estado: hayPendientes ? "alerta" : "bien",
    },
    {
      titulo: "Nuevas salidas",
      valor: salidaNuevaBloqueada ? "Detenidas" : "Con autorización",
      detalle: salidaNuevaBloqueada
        ? "No comprar ni pagar desde MONYS"
        : "Mónica conserva la decisión final",
      estado: salidaNuevaBloqueada ? "bloqueado" : "bien",
    },
  ];

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

  const metricasFinancieras = datosDashboard?.metricas || {};
  const costoConsolidado = Math.max(
    ventasConsolidadas - utilidadConsolidada,
    0,
  );
  const diasAnalizados = Number(metricasFinancieras.diasAnalizados) || 0;
  const analisisFinanciero = generarAnalisisFinanciero({
    movimientos,
    ventasTotales: ventasConsolidadas || ventasTotales,
    costoTotal:
      ventasConsolidadas > 0
        ? costoConsolidado
        : Number(metricasFinancieras.costoTotal) || 0,
    utilidadTotal: utilidadConsolidada || utilidadTotal,
    margenUtilidad:
      ventasConsolidadas > 0
        ? (utilidadConsolidada / ventasConsolidadas) * 100
        : Number(metricasFinancieras.margenUtilidad) || 0,
    fechaInicial,
    fechaFinal,
    diasAnalizados,
    ventaPromedioDiaria:
      diasAnalizados > 0
        ? (ventasConsolidadas || ventasTotales) / diasAnalizados
        : 0,
    utilidadPromedioDiaria:
      diasAnalizados > 0
        ? (utilidadConsolidada || utilidadTotal) / diasAnalizados
        : 0,
  });

  const estadoResultados = [
    ["Ventas", analisisFinanciero.ventasTotales],
    ["Costo de mercancía", analisisFinanciero.costoTotal],
    ["Utilidad bruta", analisisFinanciero.utilidadTotal],
    ["Gastos operativos", analisisFinanciero.gastosOperativos],
    ["Utilidad después de gastos", analisisFinanciero.utilidadNetaEstimada],
  ];

  const movimientosFlotilla = movimientos.filter((movimiento) => {
    const referencia = [
      movimiento?.negocio,
      movimiento?.categoria,
      movimiento?.expense_category,
      movimiento?.concepto,
      movimiento?.concept,
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();

    return referencia.includes("flotilla") || referencia.includes("ruta");
  });

  const flujoFlotilla = movimientosFlotilla.reduce((total, movimiento) => {
    const tipo = String(
      movimiento?.tipo || movimiento?.movement_type || "",
    ).toLowerCase();
    const monto = Number(movimiento?.monto ?? movimiento?.amount ?? 0) || 0;

    if (tipo.includes("entrada")) return total + monto;
    if (tipo.includes("salida")) return total - monto;
    return total;
  }, 0);

  const puntoEquilibrioDisponible = Number.isFinite(
    Number(analisisFinanciero.puntoEquilibrioVentas),
  );

  const planFinanciero7Dias = [
    {
      id: "datos",
      completada: datosFinancierosVigentes,
      prioridad: datosFinancierosVigentes ? "LISTO" : "CRÍTICO",
      titulo: datosFinancierosVigentes
        ? "Reportes financieros vigentes"
        : "Actualizar ventas e inventario",
      detalle: datosFinancierosVigentes
        ? "La base tiene menos de 8 días de antigüedad."
        : "Sin reportes actuales MONYS no autorizará distribución ni compras.",
      responsable: "Administración",
      boton: datosFinancierosVigentes ? "Ver reportes" : "Actualizar ahora",
      accion: abrirImportador,
    },
    {
      id: "tesoreria",
      completada: movimientosPendientes === 0,
      prioridad: movimientosPendientes === 0 ? "LISTO" : "ALTO",
      titulo:
        movimientosPendientes === 0
          ? "Tesorería sin movimientos pendientes"
          : `Aclarar ${movimientosPendientes} movimiento${movimientosPendientes === 1 ? "" : "s"}`,
      detalle:
        movimientosPendientes === 0
          ? "No se detectan movimientos esperando revisión."
          : "Cada movimiento pendiente reduce la confianza del flujo.",
      responsable: "Administración",
      boton: "Abrir Tesorería",
      accion: abrirTesoreria,
    },
    {
      id: "pagos",
      completada:
        datosFinancierosVigentes &&
        movimientosPendientes === 0 &&
        Number(analisisFinanciero.vencimientos7Dias || 0) === 0,
      prioridad:
        Number(analisisFinanciero.vencimientos7Dias || 0) > 0 ? "ALTO" : "REVISAR",
      titulo:
        Number(analisisFinanciero.vencimientos7Dias || 0) > 0
          ? `Revisar ${formatoDinero(analisisFinanciero.vencimientos7Dias)} por vencer`
          : "Completar calendario de pagos",
      detalle:
        "MONYS ordena fechas y montos; Mónica decide qué se paga y cuándo.",
      responsable: "Jefa + Finanzas",
      boton: "Revisar programación",
      accion: abrirDirectorFinanciero,
    },
    {
      id: "flotilla",
      completada: movimientosFlotilla.length > 0,
      prioridad: movimientosFlotilla.length > 0 ? "LISTO" : "MEDIO",
      titulo:
        movimientosFlotilla.length > 0
          ? "Flotilla identificada por separado"
          : "Separar el dinero de Flotilla",
      detalle:
        movimientosFlotilla.length > 0
          ? `${movimientosFlotilla.length} movimientos ya se reconocen como ruta o flotilla.`
          : "Etiquetar ingresos, combustible, mantenimiento y pago por unidad.",
      responsable: "Flotilla + Administración",
      boton: "Abrir Flotilla",
      accion: abrirFlotilla,
    },
  ];

  const pasosPlanCompletos = planFinanciero7Dias.filter(
    (paso) => paso.completada,
  ).length;
  const avancePlanFinanciero = Math.round(
    (pasosPlanCompletos / planFinanciero7Dias.length) * 100,
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
              titulo: "Revisar las siguientes decisiones en la Junta",
              detalle:
                "No hay una prioridad específica en estas fuentes; revisa su vigencia y los análisis conectados.",
              boton: "Abrir Junta Directiva",
              accion: abrirJuntaDirectiva,
            };

  return (
    <main className="monys-owner"
      style={{
        minHeight: "100vh",
        background:
          "radial-gradient(circle at 85% 0%, #fde7f2 0, transparent 30%), #fff9fc",
        paddingBottom: "40px",
      }}
    >
      <Header />
      <aside className="owner-sidebar" aria-label="Navegación del negocio"><span>ESPACIO DE DIRECCIÓN</span><button aria-current="page" onClick={()=>window.scrollTo({top:0,behavior:'smooth'})}>◈ Resumen ejecutivo</button><button onClick={abrirJuntaDirectiva}>◉ Junta Directiva IA</button><button onClick={abrirFinanzas}>$ Finanzas</button><button onClick={abrirMarketing}>↗ Crecimiento</button><button onClick={abrirFlotilla}>◇ Flotilla</button><button onClick={abrirEmpleados}>◎ Equipo</button><button onClick={abrirInventario}>▦ Inventario</button><button onClick={abrirCentroValor}>✧ Valor generado</button><button onClick={abrirImportador}>＋ Reportes</button><small>MONYS OS<br/>Tu centro de decisión y ejecución</small></aside>

      <section
        style={{
          width: "min(100% - 24px, 1100px)",
          margin: "0 auto",
          paddingTop: "12px",
          textAlign: "left",
        }}
      >
        <header className="owner-command-header"><div><span>MONYS OS · CENTRO DE DIRECCIÓN</span><h1>Hola, Mónica</h1><p>Tu equipo, tu dinero y tus decisiones en un mismo lugar.</p></div><button type="button" onClick={abrirImportador}>＋ Subir reportes</button></header>
        <div className="owner-decision-strip"><span>PRIORIDAD DE DIRECCIÓN</span><h2>{movimientosPendientes ? `Aclara ${movimientosPendientes} movimiento${movimientosPendientes===1?'':'s'} antes de decidir con la caja` : 'Revisa la Junta y actualiza el corte del negocio'}</h2><p>{movimientosPendientes ? 'La evidencia y el destino del dinero necesitan revisión.' : 'El siguiente paso depende de las fuentes cargadas y su vigencia.'}</p><button onClick={movimientosPendientes ? abrirTesoreria : abrirJuntaDirectiva}>Trabajar esta prioridad →</button></div><div className="owner-command-links"><button onClick={abrirJuntaDirectiva}>Junta Directiva →</button><button onClick={abrirCentroValor}>Valor generado →</button><button onClick={()=>{const panel=document.getElementById('rescate-integrado');panel.open=true;panel.scrollIntoView({behavior:'smooth'});}}>Plan de rescate →</button></div>
        <p className="owner-period">Datos del corte: {detallePeriodo}. Las ventas de hoy requieren su reporte.</p>
        {/* MÉTRICAS */}

        <div className="owner-metrics">
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
  titulo="Flujo registrado del corte"
  valor={movimientosFlujo.length ? formatoDinero(disponible) : "Sin movimientos del corte"}
  detalle={`${movimientosFlujo.length} registros en este periodo · no es saldo bancario`}
/>

        </div>

        <section className="owner-workspaces"><header><span>AVANCES REUNIDOS</span><h2>Entra a tu centro de trabajo</h2></header><div>
          <article><span className="owner-workspace-icon">$</span><h3>Finanzas</h3><p>Bancos y aclaraciones · Meta diaria · Deudas y rescate</p><button onClick={abrirFinanzas}>Control del dinero →</button><button className="owner-link" onClick={abrirDirectorFinanciero}>Plan de rescate y deudas →</button></article>
          <article><span className="owner-workspace-icon">↗</span><h3>Marketing</h3><p>Campañas · Trabajo diario · Resultados y aprendizaje</p><button onClick={abrirMarketing}>Centro de crecimiento →</button></article>
          <article><span className="owner-workspace-icon">◇</span><h3>Flotilla</h3><p>Unidades y rutas · Resumen de socios · Seguimiento</p><button onClick={abrirFlotilla}>Revisar flotilla →</button></article>
          <article><span className="owner-workspace-icon">◎</span><h3>Empleados</h3><p>Equipo · Accesos · Comisiones y operación</p><button onClick={abrirEmpleados}>Gestionar equipo →</button><button className="owner-link" onClick={()=>{const panel=document.getElementById('operacion-equipo');const bloque=panel?.closest('details');if(bloque)bloque.open=true;panel?.scrollIntoView({behavior:'smooth'});}}>Operación de hoy ↓</button></article>
        </div></section>
        <details id="rescate-integrado" className="owner-rescate"><summary>Plan de rescate · tareas, avance y evidencias</summary><SalaRescateJefa branchId={datosDashboard?.branch_id || null} abrirDirectorFinanciero={abrirDirectorFinanciero}/></details>

        <section className="owner-financial-hub"><div><span>FINANZAS · CENTRO DE TRABAJO</span><h2>Controla tu dinero y tu siguiente paso</h2><p>Bancos y aclaraciones · Entradas y salidas · Punto de equilibrio · Proveedores · Planeación de flujo</p></div><button onClick={abrirFinanzas}>Abrir Finanzas →</button></section>

        <section style={{ background: "#49293e", borderRadius: 18, padding: 20, color: "white", marginBottom: 18 }}>
          <div style={{ fontSize: 10, letterSpacing: 1.4, color: "#e9bed3", fontWeight: 800 }}>DIRECCIÓN · INTELIGENCIA · RESULTADOS</div>
          <h2 style={{ fontSize: 21, margin: "8px 0", color: "#fff8fc", lineHeight: 1.25 }}>Decide con evidencia</h2>
          <p style={{ fontSize: 13, color: "#ead5e2", lineHeight: 1.5 }}>Revisa prioridades y comprueba qué acciones mejoraron tu negocio.</p>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <button type="button" onClick={abrirJuntaDirectiva} style={{ padding: "12px 16px", minHeight: 44, border: 0, borderRadius: 11, background: "#f0c1d8", color: "#49293e", fontWeight: 800, cursor: "pointer" }}>Abrir Junta Directiva →</button>
            <button type="button" onClick={abrirCentroValor} style={{ padding: "12px 16px", minHeight: 44, border: "1px solid #e6bdd2", borderRadius: 11, background: "white", color: "#49293e", fontWeight: 800, cursor: "pointer" }}>Centro de Valor →</button>
          </div>
        </section>

        <nav className="owner-shortcuts" aria-label="Accesos de dirección">
          <button type="button" onClick={abrirTesoreria}>Movimientos registrados →</button>
          <button type="button" onClick={abrirImportador}>Subir reportes →</button>
          <button type="button" onClick={abrirInventario}>Inventario →</button>
          <button type="button" onClick={() => { const panel=document.getElementById('operacion-equipo'); const bloque=panel?.closest('details'); if(bloque)bloque.open=true; panel?.scrollIntoView({behavior:'smooth'}); }}>Operación del equipo ↓</button>
        </nav>
        <details className="owner-expanded"><summary>Detalle financiero · fuentes, compromisos y decisiones</summary>
        <section
          style={{
            marginBottom: "16px",
            padding: "18px",
            borderRadius: "20px",
            background:
              "linear-gradient(145deg, #281b22 0%, #5f2445 100%)",
            color: "#fff",
            boxShadow: "0 14px 34px rgba(70, 28, 51, 0.18)",
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "flex-start",
              gap: "12px",
              flexWrap: "wrap",
            }}
          >
            <div>
              <div
                style={{
                  color: "#f2b9d3",
                  fontSize: "11px",
                  fontWeight: 900,
                  letterSpacing: "0.8px",
                }}
              >
                CONTROL DE DINERO · HOY
              </div>
              <h2 style={{ margin: "5px 0 4px", fontSize: "23px" }}>
                Qué puedes decidir y qué debe esperar
              </h2>
              <p
                style={{
                  margin: 0,
                  maxWidth: "680px",
                  color: "rgba(255,255,255,.78)",
                  fontSize: "13px",
                  lineHeight: 1.5,
                }}
              >
                MONYS ordena la información y protege el efectivo. No mueve dinero,
                no realiza pagos y no autoriza compras por sí solo.
              </p>
            </div>
            <span
              style={{
                padding: "8px 11px",
                borderRadius: "999px",
                background: salidaNuevaBloqueada ? "#ffe7b2" : "#dff6e7",
                color: salidaNuevaBloqueada ? "#744d00" : "#17663a",
                fontWeight: 900,
                fontSize: "12px",
              }}
            >
              {salidaNuevaBloqueada ? "⚠ Proteger efectivo" : "✓ Base revisable"}
            </span>
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
              gap: "9px",
              marginTop: "16px",
            }}
          >
            {controlesDinero.map((control) => (
              <article
                key={control.titulo}
                style={{
                  minWidth: 0,
                  padding: "13px",
                  borderRadius: "14px",
                  background:
                    control.estado === "bien"
                      ? "rgba(222,247,231,.12)"
                      : "rgba(255,229,177,.12)",
                  border:
                    control.estado === "bien"
                      ? "1px solid rgba(181,231,199,.28)"
                      : "1px solid rgba(255,221,153,.32)",
                }}
              >
                <div
                  style={{
                    color: "rgba(255,255,255,.68)",
                    fontSize: "10px",
                    fontWeight: 850,
                    textTransform: "uppercase",
                    letterSpacing: "0.45px",
                  }}
                >
                  {control.titulo}
                </div>
                <strong
                  style={{
                    display: "block",
                    marginTop: "5px",
                    color: control.estado === "bien" ? "#dff6e7" : "#ffe7b2",
                    fontSize: "18px",
                    lineHeight: 1.2,
                  }}
                >
                  {control.valor}
                </strong>
                <div
                  style={{
                    marginTop: "5px",
                    color: "rgba(255,255,255,.72)",
                    fontSize: "11px",
                    lineHeight: 1.35,
                  }}
                >
                  {control.detalle}
                </div>
              </article>
            ))}
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
              gap: "8px",
              marginTop: "14px",
            }}
          >
            <button
              type="button"
              onClick={abrirImportador}
              style={estiloBotonControlDinero}
            >
              Actualizar reportes
            </button>
            <button
              type="button"
              onClick={abrirTesoreria}
              style={estiloBotonControlDinero}
            >
              Revisar Tesorería
            </button>
            <button
              type="button"
              onClick={abrirDirectorFinanciero}
              style={estiloBotonControlDinero}
            >
              Abrir Director Financiero
            </button>
          </div>
        </section>

        <section
          style={{
            marginBottom: "16px",
            padding: "18px",
            borderRadius: "20px",
            background: "#fff",
            border: "1px solid #eadde4",
            boxShadow: "0 10px 30px rgba(83,39,62,.06)",
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "flex-start",
              gap: "12px",
              flexWrap: "wrap",
            }}
          >
            <div>
              <div style={estiloEyebrowJefa}>MAPA FINANCIERO DEL NEGOCIO</div>
              <h2 style={{ margin: "5px 0", fontSize: "22px", color: "#291d23" }}>
                Lo que ganas, lo que debes cubrir y lo que puedes decidir
              </h2>
            </div>
            <span style={estiloEtiquetaPrivada}>🔒 Solo dirección</span>
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
              gap: "10px",
              marginTop: "15px",
            }}
          >
            <article style={estiloPanelFinanciero}>
              <div style={estiloTituloPanel}>📑 Estado de resultados</div>
              <div style={{ display: "grid", gap: "8px", marginTop: "12px" }}>
                {estadoResultados.map(([etiqueta, valor], indice) => (
                  <div
                    key={etiqueta}
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      gap: "12px",
                      paddingTop: indice === estadoResultados.length - 1 ? "9px" : 0,
                      borderTop:
                        indice === estadoResultados.length - 1
                          ? "1px solid #eadde4"
                          : "none",
                      color:
                        indice === estadoResultados.length - 1 ? "#7c2653" : "#67565f",
                      fontWeight: indice === estadoResultados.length - 1 ? 900 : 700,
                      fontSize: "12px",
                    }}
                  >
                    <span>{etiqueta}</span>
                    <strong>{formatoDinero(valor)}</strong>
                  </div>
                ))}
              </div>
              {!datosFinancierosVigentes && (
                <div style={estiloAvisoDato}>
                  Histórico: actualiza reportes antes de decidir.
                </div>
              )}
            </article>

            <article style={estiloPanelFinanciero}>
              <div style={estiloTituloPanel}>⚖️ Punto de equilibrio</div>
              <strong style={estiloCifraFinanciera}>
                {puntoEquilibrioDisponible
                  ? formatoDinero(analisisFinanciero.puntoEquilibrioVentas)
                  : "Falta base suficiente"}
              </strong>
              <p style={estiloTextoPanel}>
                Ventas mínimas estimadas para cubrir costos y gastos registrados.
              </p>
              <div style={estiloAvisoDato}>
                Margen después de gastos: {Number(analisisFinanciero.margenConGastos || 0).toFixed(1)}%
              </div>
            </article>

            <article style={estiloPanelFinanciero}>
              <div style={estiloTituloPanel}>🗓️ Pagos programables</div>
              <strong style={estiloCifraFinanciera}>
                {formatoDinero(analisisFinanciero.vencimientos7Dias || 0)}
              </strong>
              <p style={estiloTextoPanel}>Compromisos registrados para los próximos 7 días.</p>
              <div style={estiloAvisoDato}>
                Próximos 30 días: {formatoDinero(analisisFinanciero.vencimientos30Dias || 0)}
              </div>
            </article>

            <article style={estiloPanelFinanciero}>
              <div style={estiloTituloPanel}>🚚 Dinero de Flotilla</div>
              <strong style={estiloCifraFinanciera}>
                {movimientosFlotilla.length > 0
                  ? formatoDinero(flujoFlotilla)
                  : "Pendiente de separar"}
              </strong>
              <p style={estiloTextoPanel}>
                {movimientosFlotilla.length > 0
                  ? `${movimientosFlotilla.length} movimientos identificados por ruta o flotilla.`
                  : "Falta etiquetar ingresos, combustible, mantenimiento y pagos por ruta."}
              </p>
              <button type="button" onClick={abrirFlotilla} style={estiloBotonPanel}>
                Abrir Flotilla →
              </button>
            </article>
          </div>

          <button
            type="button"
            onClick={abrirDirectorFinanciero}
            style={{ ...estiloBotonPanel, width: "100%", marginTop: "12px" }}
          >
            Ver análisis financiero completo →
          </button>
        </section>

        <section
          style={{
            marginBottom: "16px",
            padding: "18px",
            borderRadius: "20px",
            background: "linear-gradient(135deg, #fff6e8, #fff 52%, #fff1f7)",
            border: "1px solid #ead5b5",
          }}
        >
          <div style={estiloEyebrowJefa}>RUTA DE CRECIMIENTO MONYS</div>
          <h2 style={{ margin: "5px 0 4px", fontSize: "22px" }}>
            Del rescate a un negocio franquiciable
          </h2>
          <p style={{ margin: 0, color: "#735f69", fontSize: "13px", lineHeight: 1.5 }}>
            No saltaremos etapas: cada nivel necesita evidencia real antes de avanzar.
          </p>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
              gap: "9px",
              marginTop: "14px",
            }}
          >
            {[
              ["1", "Rescatar", "Caja, deudas y pagos bajo control", "EN CURSO"],
              ["2", "Estabilizar", "Punto de equilibrio y utilidad repetible", "SIGUE"],
              ["3", "Escalar", "Sucursal que funciona sin depender de ti", "DESPUÉS"],
              ["4", "Franquiciar", "Manual, números por unidad y controles", "META"],
            ].map(([numero, titulo, detalle, estado], indice) => (
              <article
                key={numero}
                style={{
                  padding: "13px",
                  borderRadius: "14px",
                  background: indice === 0 ? "#6f2750" : "rgba(255,255,255,.82)",
                  color: indice === 0 ? "#fff" : "#392a31",
                  border: indice === 0 ? "1px solid #6f2750" : "1px solid #eadde4",
                }}
              >
                <div style={{ fontSize: "10px", fontWeight: 900, opacity: 0.7 }}>
                  ETAPA {numero} · {estado}
                </div>
                <strong style={{ display: "block", marginTop: "5px", fontSize: "16px" }}>
                  {titulo}
                </strong>
                <div style={{ marginTop: "5px", fontSize: "11px", lineHeight: 1.4, opacity: 0.8 }}>
                  {detalle}
                </div>
              </article>
            ))}
          </div>
        </section>

        <section
          style={{
            marginBottom: "16px",
            padding: "18px",
            borderRadius: "20px",
            background: "#fff",
            border: "1px solid #eadde4",
            boxShadow: "0 12px 34px rgba(83,39,62,.07)",
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "flex-start",
              gap: "12px",
              flexWrap: "wrap",
            }}
          >
            <div>
              <div style={estiloEyebrowJefa}>PLAN EJECUTIVO · PRÓXIMOS 7 DÍAS</div>
              <h2 style={{ margin: "5px 0 4px", fontSize: "22px" }}>
                MONYS te quita pendientes, tú conservas decisiones
              </h2>
              <p style={{ margin: 0, color: "#76656d", fontSize: "12px", lineHeight: 1.45 }}>
                Avance operativo confirmado; no representa ventas futuras.
              </p>
            </div>
            <div style={{ textAlign: "right" }}>
              <strong style={{ display: "block", color: "#8b315d", fontSize: "26px" }}>
                {avancePlanFinanciero}%
              </strong>
              <small style={{ color: "#8b7982", fontWeight: 750 }}>
                {pasosPlanCompletos} de {planFinanciero7Dias.length} controles
              </small>
            </div>
          </div>

          <div
            role="progressbar"
            aria-label="Avance del plan financiero de siete días"
            aria-valuemin="0"
            aria-valuemax="100"
            aria-valuenow={avancePlanFinanciero}
            style={{
              height: "9px",
              marginTop: "14px",
              borderRadius: "999px",
              background: "#f2e5eb",
              overflow: "hidden",
            }}
          >
            <span
              style={{
                display: "block",
                width: `${avancePlanFinanciero}%`,
                height: "100%",
                borderRadius: "inherit",
                background: "linear-gradient(90deg, #b51f67, #ee5b9c)",
              }}
            />
          </div>

          <div style={{ display: "grid", gap: "9px", marginTop: "15px" }}>
            {planFinanciero7Dias.map((paso, indice) => (
              <article
                key={paso.id}
                style={{
                  display: "grid",
                  gridTemplateColumns: "36px minmax(0, 1fr)",
                  gap: "11px",
                  padding: "13px",
                  borderRadius: "14px",
                  background: paso.completada ? "#f1faf4" : "#fff8fb",
                  border: paso.completada ? "1px solid #bfdfc9" : "1px solid #ead5df",
                }}
              >
                <div
                  style={{
                    width: "34px",
                    height: "34px",
                    display: "grid",
                    placeItems: "center",
                    borderRadius: "11px",
                    background: paso.completada ? "#d8f0e0" : "#f8dfeb",
                    color: paso.completada ? "#1e6a3d" : "#8b315d",
                    fontWeight: 900,
                  }}
                >
                  {paso.completada ? "✓" : indice + 1}
                </div>
                <div style={{ minWidth: 0 }}>
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "flex-start",
                      gap: "8px",
                      flexWrap: "wrap",
                    }}
                  >
                    <strong style={{ color: "#35262d", fontSize: "14px" }}>
                      {paso.titulo}
                    </strong>
                    <span
                      style={{
                        padding: "4px 7px",
                        borderRadius: "999px",
                        background: paso.completada ? "#dff4e6" : "#fff0c9",
                        color: paso.completada ? "#24683e" : "#765200",
                        fontSize: "9px",
                        fontWeight: 900,
                      }}
                    >
                      {paso.prioridad}
                    </span>
                  </div>
                  <p style={{ margin: "5px 0 0", color: "#77666e", fontSize: "11px", lineHeight: 1.4 }}>
                    {paso.detalle}
                  </p>
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      gap: "8px",
                      flexWrap: "wrap",
                      marginTop: "9px",
                    }}
                  >
                    <small style={{ color: "#927f88", fontWeight: 750 }}>
                      Responsable: {paso.responsable}
                    </small>
                    <button
                      type="button"
                      onClick={paso.accion}
                      style={{ ...estiloBotonPanel, marginTop: 0, minHeight: "34px", padding: "6px 9px" }}
                    >
                      {paso.boton} →
                    </button>
                  </div>
                </div>
              </article>
            ))}
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
              gap: "9px",
              marginTop: "13px",
            }}
          >
            <div style={estiloResponsabilidadMonys}>
              <strong>🤖 MONYS prepara</strong>
              <span>Datos, alertas, prioridades, calendario y seguimiento.</span>
            </div>
            <div style={estiloResponsabilidadMonica}>
              <strong>👑 Mónica decide</strong>
              <span>Pagos, compras, deuda, inversión y crecimiento.</span>
            </div>
          </div>
        </section>

        </details>
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
        <details className="owner-decision-summary"><summary>Ver motivo de la prioridad recomendada</summary>

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

        </details>
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

        <div className="owner-module-grid">
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
    <details className="owner-branch-card"
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
              titulo="Utilidad bruta"
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

const estiloBotonControlDinero = {
  minHeight: "44px",
  border: "1px solid rgba(255,255,255,.3)",
  background: "rgba(255,255,255,.96)",
  color: "#642448",
  borderRadius: "12px",
  padding: "10px 12px",
  fontWeight: 900,
  cursor: "pointer",
  fontSize: "12px",
};

const estiloEyebrowJefa = {
  color: "#a92e67",
  fontSize: "11px",
  fontWeight: 900,
  letterSpacing: "0.75px",
};

const estiloEtiquetaPrivada = {
  padding: "7px 10px",
  borderRadius: "999px",
  background: "#f7eef2",
  color: "#7b2c52",
  fontSize: "11px",
  fontWeight: 850,
};

const estiloPanelFinanciero = {
  minWidth: 0,
  padding: "15px",
  borderRadius: "15px",
  background: "linear-gradient(145deg, #fff, #fff9fc)",
  border: "1px solid #eadde4",
};

const estiloTituloPanel = {
  color: "#432f39",
  fontSize: "14px",
  fontWeight: 900,
};

const estiloCifraFinanciera = {
  display: "block",
  marginTop: "11px",
  color: "#7c2653",
  fontSize: "clamp(19px, 4vw, 26px)",
  lineHeight: 1.15,
  wordBreak: "break-word",
};

const estiloTextoPanel = {
  margin: "7px 0 0",
  color: "#76656d",
  fontSize: "12px",
  lineHeight: 1.45,
};

const estiloAvisoDato = {
  marginTop: "10px",
  padding: "8px 9px",
  borderRadius: "9px",
  background: "#fbf3f7",
  color: "#785366",
  fontSize: "10px",
  fontWeight: 750,
  lineHeight: 1.4,
};

const estiloBotonPanel = {
  marginTop: "10px",
  minHeight: "40px",
  border: "1px solid #dfc8d3",
  background: "#fff",
  color: "#7c2653",
  borderRadius: "11px",
  padding: "9px 11px",
  fontWeight: 900,
  cursor: "pointer",
  fontSize: "12px",
};

const estiloResponsabilidadMonys = {
  display: "grid",
  gap: "5px",
  padding: "12px",
  borderRadius: "13px",
  background: "#f7edf2",
  color: "#6e2a4b",
  fontSize: "11px",
  lineHeight: 1.4,
};

const estiloResponsabilidadMonica = {
  display: "grid",
  gap: "5px",
  padding: "12px",
  borderRadius: "13px",
  background: "#fff5d9",
  color: "#6c5200",
  fontSize: "11px",
  lineHeight: 1.4,
};
