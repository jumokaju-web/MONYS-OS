import './InicioJefa.css';
import CortesHoyDireccion from './components/CortesHoyDireccion';
import {
  useEffect,
  useState,
} from "react";
import Header from "../../components/layout/Header";
import AgendaJefa from "./components/AgendaJefa";
import SalaRescateJefa from "./components/SalaRescateJefa";
import TendenciaSemanalSucursales from "../inteligencia/components/director-finanzas/TendenciaSemanalSucursales";
import PulsoVentasDireccion from "./components/PulsoVentasDireccion";
import CentroDireccionCEO from "./components/CentroDireccionCEO";
import ActivacionOperativa from "./components/ActivacionOperativa";
import HigieneBacklogOperativo from "./components/HigieneBacklogOperativo";
import {
  obtenerRecordatoriosJefa,
} from "./services/recordatoriosJefaService";
import { generarAnalisisFinanciero } from "../inteligencia/ia/directorFinancieroIA";
import { obtenerEstadoCorte } from "./utils/estadoCorte";
import { resumirCorteFinancieroDireccion } from "./utils/resumenFinancieroDireccion";
import { resumirFlujoFlotilla } from "./utils/resumenFlujoFlotilla.js";

function antiguedadEnDias(fecha) {
  if (!fecha) return null;

  const valor = new Date(`${String(fecha).slice(0, 10)}T12:00:00`);
  if (Number.isNaN(valor.getTime())) return null;

  return Math.max(0, Math.floor((Date.now() - valor.getTime()) / 86400000));
}

export default function InicioJefa({
  usuario = null,
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
  abrirRescateBacklog,
  onAbrirOperacion = null,
  sucursalesDashboard = [],
  cargandoSucursales = false,
  errorSucursales = "",
  cargandoDashboard = false,
  errorDashboard = "",
  cargandoMovimientos = false,
  errorMovimientos = false,

  contenidoOperacion = null,
  contenidoAcciones = null,
  contenidoSicar = null,
  contenidoCierre = null,
}) {
  const [menuMasAbierto, setMenuMasAbierto] = useState(false);

    const formatearFechaPeriodo = (valor) => {
    if (!valor) {
      return "";
    }

    const fecha = valor instanceof Date ? valor : new Date(/^\d{4}-\d{2}-\d{2}$/.test(String(valor)) ? `${valor}T12:00:00` : valor);
    return Number.isNaN(fecha.getTime()) ? 'Fecha pendiente' : fecha.toLocaleDateString('es-MX', {day:'2-digit',month:'2-digit',year:'numeric'});
  };

  const estadoVentasCorte = obtenerEstadoCorte({
    cargando: cargandoDashboard || cargandoSucursales,
    error: errorDashboard || errorSucursales,
    fechaInicial,
    fechaFinal,
  });
  const estadoFlujoCorte = obtenerEstadoCorte({
    cargando: cargandoMovimientos || cargandoDashboard,
    error: errorMovimientos || errorDashboard,
    fechaInicial,
    fechaFinal,
  });

  function abrirOperacionCompleta() {
    if (typeof onAbrirOperacion === "function") {
      onAbrirOperacion();
      return;
    }
    const panel = document.getElementById("operacion-completa-direccion");
    if (!panel) return;
    let contenedor = panel.parentElement?.closest("details");
    while (contenedor) {
      contenedor.open = true;
      contenedor = contenedor.parentElement?.closest("details");
    }
    panel.open = true;
    panel.scrollIntoView({ behavior: "smooth", block: "start" });
  }
  const detallePeriodo =
    estadoVentasCorte === "listo"
      ? `${formatearFechaPeriodo(
          fechaInicial
        )} al ${formatearFechaPeriodo(
          fechaFinal
        )}`
      : estadoVentasCorte === "cargando"
        ? "Cargando corte…"
        : "Periodo pendiente";
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
            await obtenerRecordatoriosJefa({
              organizationId: usuario?.organization_id || datosDashboard?.organization_id,
              businessId: usuario?.business_id || datosDashboard?.business_id,
            });

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
  }, [datosDashboard?.business_id, datosDashboard?.organization_id, usuario?.business_id, usuario?.organization_id]);

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

  const consolidacionFinanciera = resumirCorteFinancieroDireccion(sucursalesDashboard);
  const ventasConsolidadas = consolidacionFinanciera.ventas;
  const utilidadConsolidada = consolidacionFinanciera.utilidad;
  const cifrasConsolidadasDisponibles = ventasConsolidadas !== null && utilidadConsolidada !== null;

  const metricasFinancieras = datosDashboard?.metricas || {};
  const movimientosDelCorte = Array.isArray(movimientosFlujo) ? movimientosFlujo : [];
  const costoConsolidado = Math.max(
    ventasConsolidadas - utilidadConsolidada,
    0,
  );
  const diasAnalizados = Number(metricasFinancieras.diasAnalizados) || 0;
  const analisisFinanciero = generarAnalisisFinanciero({
    movimientos: movimientosDelCorte,
    ventasTotales: cifrasConsolidadasDisponibles ? ventasConsolidadas : ventasTotales,
    costoTotal:
      cifrasConsolidadasDisponibles && ventasConsolidadas > 0
        ? costoConsolidado
        : Number(metricasFinancieras.costoTotal) || 0,
    utilidadTotal: cifrasConsolidadasDisponibles ? utilidadConsolidada : utilidadTotal,
    margenUtilidad:
      cifrasConsolidadasDisponibles && ventasConsolidadas > 0
        ? (utilidadConsolidada / ventasConsolidadas) * 100
        : Number(metricasFinancieras.margenUtilidad) || 0,
    fechaInicial,
    fechaFinal,
    diasAnalizados,
    ventaPromedioDiaria:
      diasAnalizados > 0
        ? (cifrasConsolidadasDisponibles ? ventasConsolidadas : ventasTotales) / diasAnalizados
        : 0,
    utilidadPromedioDiaria:
      diasAnalizados > 0
        ? (cifrasConsolidadasDisponibles ? utilidadConsolidada : utilidadTotal) / diasAnalizados
        : 0,
  });

  const estadoResultados = [
    ["Ventas", cifrasConsolidadasDisponibles ? analisisFinanciero.ventasTotales : null],
    ["Costo de mercancía", cifrasConsolidadasDisponibles ? analisisFinanciero.costoTotal : null],
    ["Utilidad bruta", cifrasConsolidadasDisponibles ? analisisFinanciero.utilidadTotal : null],
    ["Gastos operativos", cifrasConsolidadasDisponibles ? analisisFinanciero.gastosOperativos : null],
    ["Utilidad después de gastos", cifrasConsolidadasDisponibles ? analisisFinanciero.utilidadNetaEstimada : null],
  ];

  const resumenFlotilla = resumirFlujoFlotilla(movimientosDelCorte);
  const movimientosFlotilla = resumenFlotilla.movimientos;
  const flujoFlotilla = resumenFlotilla.neto;

  const puntoEquilibrioDisponible = cifrasConsolidadasDisponibles && Number.isFinite(
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
      completada: movimientosFlotilla > 0,
      prioridad: movimientosFlotilla > 0 ? "LISTO" : "MEDIO",
      titulo:
        movimientosFlotilla > 0
          ? "Flotilla identificada por separado"
          : "Separar el dinero de Flotilla",
      detalle:
        movimientosFlotilla > 0
          ? `${movimientosFlotilla} movimientos operativos de Flotilla están incluidos en este corte.`
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
      <nav className="owner-sidebar" aria-label="Navegación del negocio">
        <span>ESPACIO DE DIRECCIÓN</span>
        <button aria-current="page" onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}>◈ Inicio</button>
        <button onClick={abrirOperacionCompleta}>📋 Tareas y cortes</button>
        <button onClick={abrirFinanzas}>$ Finanzas</button>
        <button type="button" aria-expanded={menuMasAbierto} onClick={() => setMenuMasAbierto((abierto) => !abierto)}>
          {menuMasAbierto ? "− Menos áreas" : "+ Más áreas"}
        </button>
        {menuMasAbierto && <div className="owner-sidebar__more">
          <button onClick={abrirJuntaDirectiva}>Junta Directiva IA</button>
          <button onClick={abrirMarketing}>Crecimiento · Marketing</button>
          <button onClick={abrirFlotilla}>Flotilla</button>
          <button onClick={abrirEmpleados}>Personal y permisos · RH</button>
          <button onClick={abrirInventario}>Inventario</button>
          <button onClick={abrirCentroValor}>Valor generado</button>
          <button onClick={abrirImportador}>Subir reportes</button>
        </div>}
        <small>MONYS OS<br/>Tu centro de decisión y ejecución</small>
      </nav>

      <section
        style={{
          width: "min(100% - 24px, 1100px)",
          margin: "0 auto",
          paddingTop: "12px",
          textAlign: "left",
        }}
      >
        <header className="owner-command-header"><div><span>MONYS OS · CENTRO DE DIRECCIÓN</span><h1>Hola, Mónica</h1><p>Tu equipo, tu dinero y tus decisiones en un mismo lugar.</p></div><div className="owner-command-actions"><button type="button" onClick={abrirOperacionCompleta}>📋 Tareas y cortes de hoy</button><button type="button" onClick={abrirImportador}>＋ Subir reportes</button></div></header>
        {contenidoOperacion && <BloquePlegable id="operacion-completa-direccion" titulo="📋 Tareas y fotos del equipo">{contenidoOperacion}</BloquePlegable>}
        <p className="owner-period">Datos del corte: {cifrasConsolidadasDisponibles ? `${formatearFechaPeriodo(consolidacionFinanciera.fechaInicial)} al ${formatearFechaPeriodo(consolidacionFinanciera.fechaFinal)}` : consolidacionFinanciera.motivo || detallePeriodo}. Las ventas de hoy requieren su reporte.</p>
        <details className="owner-period-sources">
          <summary>Ver archivos SICAR que respaldan estas cifras</summary>
          {sucursalesDashboard.map((sucursal) => {
            const fuente = sucursal.fuenteFinanciera;
            return <p key={sucursal.id}>
              <b>{sucursal.nombre}:</b> {fuente
                ? <>{fuente.tipoReporte} · {fuente.archivo} · {fuente.filas ?? "Filas sin dato"} filas · {fuente.importadoEn ? new Date(fuente.importadoEn).toLocaleString("es-MX", { timeZone: "America/Mexico_City" }) : "fecha de importación sin dato"}</>
                : "sin reporte financiero SICAR disponible"}
            </p>;
          })}
        </details>
        <section className="owner-results" aria-label="Resultados del corte SICAR">
          <div><small>Ventas del corte</small><strong>{estadoVentasCorte === "listo" && cifrasConsolidadasDisponibles ? formatoDinero(ventasConsolidadas) : consolidacionFinanciera.motivo || detallePeriodo}</strong><span>Venta registrada en SICAR</span></div>
          <div><small>Utilidad bruta</small><strong>{estadoVentasCorte === "listo" && cifrasConsolidadasDisponibles ? formatoDinero(utilidadConsolidada) : "Corte por alinear"}</strong><span>Antes de renta, nómina y demás gastos</span></div>
          <div><small>Dinero para decidir</small><strong>Confirmar saldos</strong><span>Ventas y movimientos no equivalen a efectivo disponible</span><button type="button" onClick={abrirFinanzas}>Revisar saldos y compromisos →</button></div>
        </section>
        <CortesHoyDireccion usuario={usuario} sucursales={sucursalesDashboard} />
        {!cargandoSucursales && !errorSucursales && sucursalesDashboard.length > 0 && (
          <TendenciaSemanalSucursales
            sucursales={sucursalesDashboard}
            onAbrirImportador={abrirImportador}
            organizationId={usuario?.organization_id || datosDashboard?.organization_id}
            businessId={usuario?.business_id || datosDashboard?.business_id}
            branchId={usuario?.branch_id || datosDashboard?.branch_id}
            onAbrirValor={abrirCentroValor}
          />
        )}
        <CentroDireccionCEO
          datosDashboard={datosDashboard}
          sucursales={sucursalesDashboard}
          abrirFinanzas={abrirFinanzas}
          abrirDirectorFinanciero={abrirDirectorFinanciero}
          abrirCompraMaestra={abrirCompraMaestra}
          abrirMarketing={abrirMarketing}
          abrirImportador={abrirImportador}
        />

        <nav className="owner-next-actions" aria-label="Decisiones del negocio">
          <button type="button" onClick={abrirCompraMaestra}><b>Qué comprar</b><span>Demanda, existencias y prioridad de reposición</span></button>
          <button type="button" onClick={abrirDirectorFinanciero}><b>Qué abonar</b><span>Deudas, vencimientos y capacidad por confirmar</span></button>
          <button type="button" onClick={abrirTesoreria}><b>Dónde se gasta</b><span>Clasificar salidas y distinguir gastos de retiros</span></button>
          <button type="button" onClick={abrirOperacionCompleta}><b>Tareas y evidencias</b><span>Ver lo que reportó el equipo y sus fotos</span></button>
        </nav>
        <ActivacionOperativa
          organizationId={datosDashboard?.organization_id || usuario?.organization_id || null}
          businessId={datosDashboard?.business_id || usuario?.business_id || null}
          finanzas={{
            disponible: estadoFlujoCorte === "listo" && estadoVentasCorte === "listo",
            datosVigentes: datosFinancierosVigentes,
            movimientosPendientes,
            motivo: estadoFlujoCorte === "cargando" || estadoVentasCorte === "cargando"
              ? "Se están comprobando el corte financiero y sus movimientos."
              : "Falta un periodo válido o no fue posible comprobar el corte financiero.",
          }}
          onAbrirFinanzas={abrirFinanzas}
          onAbrirTesoreria={abrirTesoreria}
          onAbrirEquipo={abrirEmpleados}
          onAbrirOperacion={abrirOperacionCompleta}
          onAbrirMarketing={abrirMarketing}
          onAbrirFlotilla={abrirFlotilla}
        />
        <HigieneBacklogOperativo
          organizationId={datosDashboard?.organization_id || usuario?.organization_id || null}
          businessId={datosDashboard?.business_id || usuario?.business_id || null}
          sucursales={sucursalesDashboard}
          onAbrirEquipo={abrirEmpleados}
          onAbrirRescate={abrirRescateBacklog}
        />

        <PulsoVentasDireccion usuario={usuario} sucursales={sucursalesDashboard} />
        <details id="rescate-integrado" className="owner-rescate"><summary>Plan de rescate · tareas, avance y evidencias</summary><SalaRescateJefa branchId={datosDashboard?.branch_id || null} abrirDirectorFinanciero={abrirDirectorFinanciero}/></details>
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
                    <strong>{valor === null ? "Por confirmar" : formatoDinero(valor)}</strong>
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
                Margen después de gastos: {cifrasConsolidadasDisponibles ? `${Number(analisisFinanciero.margenConGastos || 0).toFixed(1)}%` : "por confirmar"}
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
                {movimientosFlotilla > 0
                  ? formatoDinero(flujoFlotilla)
                  : "Pendiente de separar"}
              </strong>
              <p style={estiloTextoPanel}>
                {movimientosFlotilla > 0
                  ? `Entradas registradas: ${formatoDinero(resumenFlotilla.entradas)} · salidas operativas: ${formatoDinero(resumenFlotilla.salidas)}. Neto de este corte; transferencias internas excluidas.`
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
        <details className="owner-secondary">
          <summary>Más análisis y herramientas de Dirección</summary>
          <div className="owner-secondary__content">
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
          </div>
        </details>
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
  id,
  titulo,
  children,
}) {
  return (
    <details
      id={id}
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
