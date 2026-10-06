import { useEffect, useMemo, useState } from "react";
import {
  crearTareaOperativa,
  obtenerCalendarioTareasOperativas,
} from "../../services/tareasOperativasService";
import { asignarResponsableAutomatico } from "../../services/empleadosRHService";

const COLOR = {
  vino: "#64143f",
  rosa: "#b61f69",
  crema: "#fffaf5",
  verde: "#276749",
  dorado: "#a36b12",
};

function fechaISO(fecha) {
  return fecha.toISOString().slice(0, 10);
}

function sumarDiasPlan(fechaBase, dias) {
  const fecha = new Date(fechaBase);
  fecha.setDate(fecha.getDate() + dias);
  if (fecha.getDay() === 0) fecha.setDate(fecha.getDate() + 1);

  return fecha;
}

function etiquetaFecha(valor) {
  return new Intl.DateTimeFormat("es-MX", {
    weekday: "short",
    day: "numeric",
    month: "short",
  }).format(new Date(`${valor}T12:00:00`));
}

function construirPlan() {
  const inicio = new Date();
  inicio.setHours(12, 0, 0, 0);

  const definiciones = [
    [0, 1, "administracion", "Conciliar ventas, bancos y caja", "Confirmar que las ventas cobradas coincidan con bancos y efectivo.", "Captura o reporte conciliado; diferencias explicadas."],
    [1, 1, "inventario", "Contar inventario que puede convertirse en efectivo", "Identificar existencias disponibles, lentas y faltantes por sucursal.", "Conteo por producto y sucursal con evidencia."],
    [2, 1, "administracion", "Ordenar pagos inevitables por fecha", "Registrar proveedor, importe, vencimiento y consecuencia de no pagar.", "Lista completa sin pagos estimados ni duplicados."],
    [4, 1, "ventas", "Definir meta diaria de ventas por sucursal", "Convertir el objetivo semanal en una meta diaria visible para el equipo.", "Meta respaldada por ventas reales y días abiertos."],
    [6, 2, "ventas", "Detectar productos con margen o rotación débil", "Separar productos rentables, lentos y de margen insuficiente.", "Lista priorizada con precio, costo, margen y existencia."],
    [8, 2, "administracion", "Preparar propuesta de reducción de gastos", "Detectar gastos prescindibles, renegociables y protegidos.", "Propuesta con monto mensual; ningún recorte ejecutado sin aprobación."],
    [10, 2, "flotilla", "Medir costo real de flotilla", "Registrar combustible, mantenimiento, pagos e ingreso atribuible por unidad.", "Costo e ingreso por unidad con comprobantes."],
    [12, 2, "ventas", "Activar guion de venta y seguimiento", "Aplicar un guion único para atención, seguimiento y cierre.", "Guion usado y registro de prospectos atendidos."],
    [14, 3, "marketing", "Preparar campaña orgánica de recuperación", "Crear oferta, contenido y llamada a la acción con inventario vigente.", "Kit listo para revisión; no publicar ni gastar sin autorización."],
    [16, 3, "ventas", "Contactar clientes y prospectos recuperables", "Dar seguimiento a clientes recientes con una propuesta autorizada.", "Contactos, respuestas, pedidos y ventas registrados."],
    [18, 3, "administracion", "Registrar cierre diario de caja y compromisos", "Cerrar ventas, cobros, salidas y pendientes del día.", "Cierre firmado y diferencias documentadas."],
    [20, 3, "marketing", "Medir resultados reales de la campaña", "Capturar alcance, mensajes, pedidos, ventas y gasto real.", "Resultados completos para decidir continuar, mejorar o detener."],
    [22, 4, "tienda", "Estandarizar apertura, venta y cierre", "Documentar el flujo mínimo que cada sucursal debe repetir.", "Checklist probado por el equipo y evidencia de ejecución."],
    [24, 4, "administracion", "Revisar punto de equilibrio y liquidez", "Comparar ventas, margen, gastos y pagos contra la base actualizada.", "Cálculo con datos vigentes; sin proyecciones inventadas."],
    [26, 4, "ventas", "Confirmar acciones que sí produjeron ventas", "Separar actividades útiles de trabajo sin resultado comprobable.", "Lista de mantener, corregir y eliminar con evidencia."],
    [29, 4, "administracion", "Cerrar el rescate de 30 días", "Presentar resultados, pendientes, riesgos y siguiente plan de 30 días.", "Cierre con ventas, utilidad, flujo, deudas, inventario y responsables."],
  ];

  return definiciones.map(([desfase, semana, area, titulo, descripcion, criterio], indice) => ({
    id: `rescate-30-${indice + 1}`,
    semana,
    area,
    titulo: `Rescate 30 días · ${titulo}`,
    descripcion,
    criterio,
    fecha: fechaISO(sumarDiasPlan(inicio, desfase)),
    prioridad: semana === 1 ? "urgente" : semana === 2 ? "alta" : "normal",
  }));
}

const FASES = [
  { semana: 1, nombre: "Proteger el efectivo", meta: "Verdad financiera, inventario útil y pagos ordenados." },
  { semana: 2, nombre: "Detener fugas", meta: "Margen, gastos, flotilla y meta comercial bajo control." },
  { semana: 3, nombre: "Recuperar ventas", meta: "Ejecución comercial y marketing con resultados medibles." },
  { semana: 4, nombre: "Volverlo sistema", meta: "Procesos repetibles y cierre para decidir el siguiente ciclo." },
];

export default function PlanRescate30Dias({ organizationId, businessId, branchId }) {
  const plan = useMemo(() => construirPlan(), []);
  const [abierta, setAbierta] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [mensaje, setMensaje] = useState("");
  const [asignaciones, setAsignaciones] = useState([]);

  useEffect(() => {
    let activo = true;

    async function recuperarPlanActivo() {
      if (!branchId) return;
      try {
        const tareas = await obtenerCalendarioTareasOperativas({
          branchId,
          fechaInicio: plan[0].fecha,
          fechaFin: plan[plan.length - 1].fecha,
        });
        const existentes = (tareas || [])
          .filter((tarea) => String(tarea?.titulo || "").startsWith("Rescate 30 días ·"))
          .map((tarea) => ({
            id: plan.find((item) => item.titulo === tarea.titulo)?.id,
            responsable: tarea.responsable,
          }))
          .filter((tarea) => tarea.id && tarea.responsable);

        if (activo && existentes.length) setAsignaciones(existentes);
      } catch (error) {
        console.error("No fue posible recuperar el plan de rescate:", error);
      }
    }

    recuperarPlanActivo();
    return () => { activo = false; };
  }, [branchId, plan]);

  async function activarPlan() {
    if (!branchId || guardando) return;

    const confirmado = window.confirm(
      "¿Autorizas crear el plan de rescate de 30 días y enviarlo a los usuarios de los empleados? MONYS asignará por puesto y carga. No moverá dinero ni publicará campañas."
    );

    if (!confirmado) return;

    try {
      setGuardando(true);
      setMensaje("");

      const resultados = [];
      for (const tarea of plan) {
        const responsable = await asignarResponsableAutomatico({
          branchId,
          titulo: tarea.titulo,
          descripcion: tarea.descripcion,
          area: tarea.area,
          fecha: tarea.fecha,
        });

        if (!responsable?.nombre) {
          resultados.push({ ...tarea, estado: "sin_responsable" });
          continue;
        }

        const creada = await crearTareaOperativa({
          organizationId,
          businessId,
          branchId,
          titulo: tarea.titulo,
          descripcion: tarea.descripcion,
          area: tarea.area,
          responsable: responsable.nombre,
          prioridad: tarea.prioridad,
          fecha: tarea.fecha,
          horaLimite: tarea.area === "administracion" ? "18:00" : "17:00",
          instrucciones: `${tarea.descripcion} Sube evidencia y termina la tarea únicamente cuando se cumpla el criterio de éxito.`,
          creadaPor: "Plan de Rescate 30 días · Jefa",
          requiereEvidencia: true,
          criterioExito: tarea.criterio,
        });

        resultados.push({
          ...tarea,
          estado: creada?.id ? "asignada" : "existente",
          responsable: responsable.nombre,
        });
      }

      const tareasGuardadas = await obtenerCalendarioTareasOperativas({
        branchId,
        fechaInicio: plan[0].fecha,
        fechaFin: plan[plan.length - 1].fecha,
      });
      const tareasDelPlan = (tareasGuardadas || []).filter((tarea) =>
        String(tarea?.titulo || "").startsWith("Rescate 30 días ·")
      );

      setAsignaciones(resultados.filter((resultado) => resultado.responsable));
      const faltantes = resultados.filter((resultado) => resultado.estado === "sin_responsable").length;
      setMensaje(
        faltantes > 0
          ? `⚠️ Se enviaron ${tareasDelPlan.length} tareas. ${faltantes} requieren dar de alta a un empleado compatible.`
          : `✅ Plan activado: ${tareasDelPlan.length} tareas reales ya están disponibles en las cuentas del equipo.`
      );
    } catch (error) {
      setMensaje(`❌ ${error?.message || "No fue posible activar el plan."}`);
    } finally {
      setGuardando(false);
    }
  }

  return (
    <section style={{ marginTop: 22, padding: 22, borderRadius: 22, background: "linear-gradient(145deg, #fff 0%, #fff5f9 55%, #fffaf0 100%)", border: "1px solid #eccbd9", boxShadow: "0 18px 48px rgba(100,20,63,.08)" }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 14, alignItems: "flex-start", flexWrap: "wrap" }}>
        <div style={{ maxWidth: 680 }}>
          <p style={{ margin: 0, color: COLOR.rosa, fontWeight: 900, letterSpacing: ".09em", fontSize: 13 }}>PLAN DE RESCATE EJECUTABLE</p>
          <h3 style={{ margin: "7px 0", fontSize: 25, color: "#2e1722" }}>🛟 30 días para recuperar control y ventas</h3>
          <p style={{ margin: 0, color: "#6c5962", lineHeight: 1.55 }}>La Jefa autoriza una sola vez. Después cada empleado entra a su cuenta, ve sus tareas con fecha, sube evidencia y MONYS concentra el avance.</p>
        </div>
        <span style={{ padding: "9px 13px", borderRadius: 999, background: "#fff1c9", color: "#77520c", fontWeight: 850 }}>16 acciones · 4 semanas</span>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))", gap: 11, marginTop: 18 }}>
        {FASES.map((fase) => (
          <div key={fase.semana} style={{ padding: 15, borderRadius: 15, background: fase.semana === 1 ? "#fff0f5" : "#fff", border: "1px solid #ead4de" }}>
            <div style={{ color: COLOR.rosa, fontWeight: 900, fontSize: 12, letterSpacing: ".06em" }}>SEMANA {fase.semana}</div>
            <strong style={{ display: "block", marginTop: 5, color: "#3d1d2d" }}>{fase.nombre}</strong>
            <p style={{ margin: "6px 0 0", color: "#77636d", fontSize: 13, lineHeight: 1.45 }}>{fase.meta}</p>
          </div>
        ))}
      </div>

      <button type="button" onClick={() => setAbierta((valor) => !valor)} style={{ width: "100%", marginTop: 15, minHeight: 45, borderRadius: 12, border: "1px solid #d9b9c8", background: "#fff", color: COLOR.vino, fontWeight: 850, cursor: "pointer" }}>
        {abierta ? "Ocultar acciones" : "Ver las 16 acciones, fechas y responsables"} {abierta ? "▲" : "▼"}
      </button>

      {abierta && (
        <div style={{ marginTop: 14, display: "grid", gap: 10 }}>
          {plan.map((tarea) => {
            const asignada = asignaciones.find((item) => item.id === tarea.id);
            return (
              <div key={tarea.id} style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 12, alignItems: "center", padding: 14, borderRadius: 14, background: "#fff", border: "1px solid #eddce4" }}>
                <div><strong style={{ color: COLOR.rosa }}>{etiquetaFecha(tarea.fecha)}</strong><small style={{ display: "block", color: "#806d76", marginTop: 3 }}>Semana {tarea.semana}</small></div>
                <div><strong style={{ color: "#3b2330" }}>{tarea.titulo.replace("Rescate 30 días · ", "")}</strong><small style={{ display: "block", color: "#79666f", marginTop: 4, lineHeight: 1.4 }}>{tarea.criterio}</small></div>
                <div style={{ color: asignada ? COLOR.verde : COLOR.dorado, fontWeight: 800, fontSize: 13 }}>{asignada ? `✓ ${asignada.responsable}` : `Perfil: ${tarea.area}`}</div>
              </div>
            );
          })}
        </div>
      )}

      <div style={{ marginTop: 17, padding: 16, borderRadius: 15, background: "#f6fff9", border: "1px solid #bfe0ca", color: "#285c3c", lineHeight: 1.5 }}>
        <strong>Control humano activo.</strong> El equipo puede ejecutar y comprobar. Mónica conserva la autorización de pagos, descuentos, gasto y publicaciones externas.
      </div>

      {mensaje && <div role="status" style={{ marginTop: 14, padding: 13, borderRadius: 12, background: mensaje.startsWith("✅") ? "#edf9f1" : "#fff5df", border: "1px solid #d9c58e", fontWeight: 800 }}>{mensaje}</div>}

      <button type="button" disabled={!branchId || guardando} onClick={activarPlan} style={{ width: "100%", minHeight: 52, marginTop: 15, border: 0, borderRadius: 14, color: "#fff", background: !branchId || guardando ? "#a99aa1" : `linear-gradient(135deg, ${COLOR.vino}, ${COLOR.rosa})`, fontWeight: 900, fontSize: 16, cursor: !branchId || guardando ? "not-allowed" : "pointer" }}>
        {guardando ? "Asignando y enviando al equipo…" : asignaciones.length ? "Plan activo en las cuentas del equipo ✓" : "Autorizar plan y enviarlo al equipo →"}
      </button>
    </section>
  );
}
