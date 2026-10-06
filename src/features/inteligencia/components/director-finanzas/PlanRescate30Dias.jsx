import { useEffect, useMemo, useState } from "react";
import {
  crearTareaOperativa,
  obtenerCalendarioTareasOperativas,
} from "../../services/tareasOperativasService";
import {
  asignarResponsableAutomatico,
  obtenerEmpleadosActivosParaAsignacion,
} from "../../services/empleadosRHService";

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

function moverFechaISO(fechaISOBase, dias) {
  const fecha = new Date(`${fechaISOBase}T12:00:00`);
  fecha.setDate(fecha.getDate() + dias);
  return fechaISO(fecha);
}

function diferenciaDias(fechaA, fechaB) {
  const a = Date.parse(`${fechaA}T00:00:00Z`);
  const b = Date.parse(`${fechaB}T00:00:00Z`);
  return Math.round((a - b) / 86400000);
}

function etiquetaFecha(valor) {
  return new Intl.DateTimeFormat("es-MX", {
    weekday: "short",
    day: "numeric",
    month: "short",
  }).format(new Date(`${valor}T12:00:00`));
}

function normalizar(valor) {
  return String(valor || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function perfilesEmpleado(empleado) {
  const puesto = normalizar(empleado?.puesto);
  const perfiles = [];
  if (/marketing|redes|contenido|mercado libre/.test(puesto)) perfiles.push("marketing");
  if (/administracion|administrativa|administrativo|contab|finanz|encargad/.test(puesto)) perfiles.push("administracion");
  if (/chofer|logistica|flotilla|ruta/.test(puesto)) perfiles.push("flotilla");
  if (/venta|vendedor|vendedora|tienda|encargad/.test(puesto)) perfiles.push("ventas", "tienda", "inventario");
  return [...new Set(perfiles)];
}

function construirPlan(fechaInicio = fechaISO(new Date())) {
  const inicio = new Date(`${fechaInicio}T12:00:00`);

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
  const [fechaInicio, setFechaInicio] = useState(() => fechaISO(new Date()));
  const plan = useMemo(() => construirPlan(fechaInicio), [fechaInicio]);
  const [abierta, setAbierta] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [mensaje, setMensaje] = useState("");
  const [asignaciones, setAsignaciones] = useState([]);
  const [empleados, setEmpleados] = useState([]);
  const [cargandoEquipo, setCargandoEquipo] = useState(true);

  useEffect(() => {
    let activo = true;

    async function recuperarPlanActivo() {
      if (!branchId) return;
      try {
        const tareas = await obtenerCalendarioTareasOperativas({
          branchId,
          fechaInicio: moverFechaISO(fechaISO(new Date()), -35),
          fechaFin: moverFechaISO(fechaISO(new Date()), 35),
        });
        const tareasRescate = (tareas || []).filter((tarea) => String(tarea?.titulo || "").startsWith("Rescate 30 días ·"));
        const hoy = fechaISO(new Date());
        const iniciosPorCreacion = tareasRescate.reduce((conteo, tarea) => {
          const fechaCreacion = String(tarea?.created_at || "").slice(0, 10);
          if (fechaCreacion && diferenciaDias(hoy, fechaCreacion) >= 0 && diferenciaDias(hoy, fechaCreacion) <= 30) {
            conteo.set(fechaCreacion, (conteo.get(fechaCreacion) || 0) + 1);
          }
          return conteo;
        }, new Map());
        const inicioPorCreacion = [...iniciosPorCreacion.entries()]
          .sort((a, b) => b[1] - a[1] || b[0].localeCompare(a[0]))[0]?.[0];
        const candidatos = tareasRescate
          .map((tarea) => {
            const definicion = plan.find((item) => item.titulo === tarea.titulo);
            if (!definicion) return null;
            const desfase = diferenciaDias(definicion.fecha, fechaInicio);
            const inicioDetectado = moverFechaISO(tarea.fecha, -desfase);
            const edad = diferenciaDias(hoy, inicioDetectado);
            return edad >= 0 && edad <= 30 ? inicioDetectado : null;
          })
          .filter(Boolean)
          .sort((a, b) => b.localeCompare(a));
        const inicioGuardado = inicioPorCreacion || candidatos[0];
        if (activo && inicioGuardado && inicioGuardado !== fechaInicio) {
          setFechaInicio(inicioGuardado);
          return;
        }

        const existentes = tareasRescate
          .map((tarea) => {
            const definicion = plan.find((item) => item.titulo === tarea.titulo && item.fecha === tarea.fecha);
            return definicion ? {
              id: definicion.id,
              responsable: tarea.responsable,
              estadoTarea: tarea.estado || "pendiente",
              fecha: tarea.fecha,
            } : null;
          })
          .filter(Boolean);
        if (activo) setAsignaciones(existentes);
      } catch (error) {
        console.error("No fue posible recuperar el plan de rescate:", error);
      }
    }

    recuperarPlanActivo();
    return () => { activo = false; };
  }, [branchId, fechaInicio, plan]);

  useEffect(() => {
    let activo = true;
    async function cargarEquipo() {
      if (!branchId) {
        setEmpleados([]);
        setCargandoEquipo(false);
        return;
      }
      try {
        setCargandoEquipo(true);
        const registros = await obtenerEmpleadosActivosParaAsignacion(branchId);
        if (activo) setEmpleados(registros || []);
      } catch (error) {
        console.error("No fue posible comprobar los accesos del equipo:", error);
        if (activo) setEmpleados([]);
      } finally {
        if (activo) setCargandoEquipo(false);
      }
    }
    cargarEquipo();
    return () => { activo = false; };
  }, [branchId]);

  const empleadosConAcceso = empleados.filter((empleado) => Boolean(empleado?.usuario_id));
  const empleadosSinAcceso = empleados.filter((empleado) => !empleado?.usuario_id);
  const perfilesCubiertos = new Set(empleadosConAcceso.flatMap(perfilesEmpleado));
  const perfilesRequeridos = ["administracion", "ventas", "inventario", "marketing", "flotilla", "tienda"];
  const perfilesFaltantes = perfilesRequeridos.filter((perfil) => !perfilesCubiertos.has(perfil));
  const tareasTerminadas = asignaciones.filter((item) => item.estadoTarea === "terminada").length;
  const tareasEnProceso = asignaciones.filter((item) => item.estadoTarea === "en_proceso").length;
  const tareasCreadas = asignaciones.length;
  const porcentajeRescate = Math.round((tareasTerminadas / plan.length) * 100);

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
      const tareasExistentes = await obtenerCalendarioTareasOperativas({
        branchId,
        fechaInicio: plan[0].fecha,
        fechaFin: plan[plan.length - 1].fecha,
      });
      const existentesPorClave = new Map(
        (tareasExistentes || [])
          .filter((tarea) => String(tarea?.titulo || "").startsWith("Rescate 30 días ·"))
          .map((tarea) => [`${tarea.titulo}|${tarea.fecha}`, tarea])
      );
      for (const tarea of plan) {
        const existente = existentesPorClave.get(`${tarea.titulo}|${tarea.fecha}`);
        if (existente) {
          resultados.push({
            ...tarea,
            estado: "existente",
            responsable: existente.responsable,
            estadoTarea: existente.estado || "pendiente",
          });
          continue;
        }

        const responsable = await asignarResponsableAutomatico({
          branchId,
          titulo: tarea.titulo,
          descripcion: tarea.descripcion,
          area: tarea.area,
          fecha: tarea.fecha,
          requiereUsuarioVinculado: true,
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
          estadoTarea: creada?.estado || "pendiente",
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

      setAsignaciones(resultados.filter((resultado) => resultado.responsable || resultado.estado === "existente"));
      const faltantes = resultados.filter((resultado) => !resultado.responsable).length;
      setMensaje(
        faltantes > 0
          ? `⚠️ Se enviaron ${tareasDelPlan.length} tareas. ${faltantes} requieren un empleado compatible con acceso a MONYS.`
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

      <div style={{ marginTop: 15, padding: 15, borderRadius: 15, background: perfilesFaltantes.length === 0 && empleadosConAcceso.length > 0 ? "#eef9f2" : "#fff6e2", border: perfilesFaltantes.length === 0 && empleadosConAcceso.length > 0 ? "1px solid #b8dcc5" : "1px solid #e4c47d" }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
          <div>
            <strong style={{ color: "#3b2831" }}>Acceso real del equipo</strong>
            <p style={{ margin: "5px 0 0", color: "#715f67", fontSize: 13, lineHeight: 1.45 }}>
              {cargandoEquipo
                ? "Comprobando usuarios vinculados…"
                : `${empleadosConAcceso.length} de ${empleados.length} empleados activos pueden entrar y recibir tareas.`}
            </p>
          </div>
          <span style={{ padding: "7px 10px", borderRadius: 999, background: "#fff", color: empleadosConAcceso.length === empleados.length && empleados.length > 0 ? COLOR.verde : COLOR.dorado, fontWeight: 900, fontSize: 12 }}>
            {empleadosConAcceso.length === empleados.length && empleados.length > 0 ? "✓ Equipo conectado" : `${Math.max(empleados.length - empleadosConAcceso.length, 0)} sin usuario`}
          </span>
        </div>
        {!cargandoEquipo && perfilesFaltantes.length > 0 && (
          <div style={{ marginTop: 10, color: "#7a5713", fontSize: 12, fontWeight: 750 }}>
            Perfiles sin cobertura conectada: {perfilesFaltantes.join(", ")}.
          </div>
        )}
        {!cargandoEquipo && empleadosSinAcceso.length > 0 && (
          <div style={{ marginTop: 10, padding: 11, borderRadius: 11, background: "#fff", color: "#5d4531", fontSize: 12, lineHeight: 1.5 }}>
            <strong>Personas que aún no recibirán tareas:</strong>{" "}
            {empleadosSinAcceso.map((empleado) => `${empleado.nombre || "Sin nombre"}${empleado.puesto ? ` · ${empleado.puesto}` : ""}`).join("; ")}.
            <div style={{ marginTop: 4, color: "#76636c" }}>Vincula sus cuentas desde Director de RH y después vuelve a activar las tareas pendientes.</div>
          </div>
        )}
        <p style={{ margin: "9px 0 0", color: "#76636c", fontSize: 11, lineHeight: 1.4 }}>
          MONYS solo enviará nuevas tareas del rescate a personas activas con usuario vinculado. Las demás quedarán señaladas, no asignadas en silencio.
        </p>
      </div>

      <div style={{ marginTop: 12, padding: 16, borderRadius: 15, background: "#fff", border: "1px solid #ead4de" }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
          <div>
            <strong style={{ color: "#3b2831" }}>Avance comprobado del rescate</strong>
            <p style={{ margin: "5px 0 0", color: "#715f67", fontSize: 13 }}>
              {tareasCreadas
                ? `${tareasTerminadas} terminadas · ${tareasEnProceso} en proceso · ${Math.max(tareasCreadas - tareasTerminadas - tareasEnProceso, 0)} pendientes registradas · ${tareasCreadas} de ${plan.length} tareas creadas.`
                : "El avance comenzará cuando actives el plan y el equipo registre sus tareas."}
            </p>
          </div>
          <strong style={{ color: COLOR.rosa, fontSize: 24 }}>{porcentajeRescate}%</strong>
        </div>
        <div style={{ marginTop: 10, height: 9, borderRadius: 999, background: "#f0e1e8", overflow: "hidden" }}>
          <div style={{ width: `${porcentajeRescate}%`, height: "100%", borderRadius: 999, background: `linear-gradient(90deg, ${COLOR.rosa}, ${COLOR.vino})`, transition: "width .2s ease" }} />
        </div>
        <small style={{ display: "block", marginTop: 7, color: "#806d76" }}>Porcentaje calculado con tareas terminadas sobre las 16 acciones; no representa ventas ni recuperación financiera.</small>
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
                <div style={{ color: asignada ? COLOR.verde : COLOR.dorado, fontWeight: 800, fontSize: 13 }}>
                  {asignada?.responsable ? `✓ ${asignada.responsable}` : asignada ? "⚠ Tarea creada · falta responsable" : `Perfil: ${tarea.area}`}
                  {asignada && <small style={{ display: "block", marginTop: 4, color: asignada.estadoTarea === "terminada" ? COLOR.verde : "#806d76", fontWeight: 700 }}>{asignada.estadoTarea === "terminada" ? "✓ Terminada" : asignada.estadoTarea === "en_proceso" ? "En proceso" : "Pendiente"}</small>}
                </div>
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
