import { useCallback, useEffect, useMemo, useState } from "react";
import { obtenerEmpleadosRH } from "../../inteligencia/services/empleadosRHService";
import { crearTareaOperativa, obtenerTareasOperativas } from "../../inteligencia/services/tareasOperativasService";
import { resolverResponsabilidadesEmpleado } from "../../inteligencia/shared/responsabilidadesEmpleado";
import { resumirEstadoPulsos } from "../../inteligencia/shared/pulsoVentas";

const dinero = new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN", maximumFractionDigits: 2 });

function fechaMexico() {
  const partes = new Intl.DateTimeFormat("en", {
    timeZone: "America/Mexico_City",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const valores = Object.fromEntries(partes.map(({ type, value }) => [type, value]));
  return `${valores.year}-${valores.month}-${valores.day}`;
}

function prepararSucursales(sucursales, usuario) {
  const opciones = [...(sucursales || [])];
  if (usuario?.branch_id && !opciones.some((item) => String(item.id) === String(usuario.branch_id))) {
    opciones.push({ id: usuario.branch_id, nombre: usuario.sucursal || "Sucursal asignada", business_id: usuario.business_id });
  }
  return opciones
    .filter((item) => item?.id && (!usuario?.business_id || !item.business_id || String(item.business_id) === String(usuario.business_id)))
    .map((item) => ({ id: item.id, nombre: item.name || item.nombre || "Sucursal" }));
}

function esPersonalDeVenta(empleado) {
  return resolverResponsabilidadesEmpleado(empleado).some((responsabilidad) =>
    ["VENTA_TIENDA", "VENTA_WHATSAPP"].includes(responsabilidad)
  );
}

export default function PulsoVentasDireccion({ usuario = null, sucursales = [] }) {
  const fecha = useMemo(fechaMexico, []);
  const ramas = useMemo(() => prepararSucursales(sucursales, usuario), [sucursales, usuario]);
  const [grupos, setGrupos] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState("");
  const [mensaje, setMensaje] = useState("");

  const cargar = useCallback(async () => {
    if (!ramas.length) {
      setGrupos([]);
      setCargando(false);
      return;
    }
    setCargando(true);
    setError("");
    try {
      const datos = await Promise.all(ramas.map(async (sucursal) => {
        const [empleados, tareas] = await Promise.all([
          obtenerEmpleadosRH(sucursal.id),
          obtenerTareasOperativas({ branchId: sucursal.id, fecha }),
        ]);
        return {
          sucursal,
          empleados: empleados.filter((empleado) => empleado.active && esPersonalDeVenta(empleado)),
          tareas: tareas.filter((tarea) => String(tarea.titulo || "").toUpperCase().startsWith("PULSO DE VENTAS:")),
        };
      }));
      setGrupos(datos);
    } catch (errorCarga) {
      setError(errorCarga?.message || "No se pudo consultar el pulso de ventas del equipo.");
    } finally {
      setCargando(false);
    }
  }, [fecha, ramas]);

  useEffect(() => { cargar(); }, [cargar]);

  const resumenes = useMemo(() => grupos.map((grupo) => ({
    ...grupo,
    resumen: resumirEstadoPulsos(grupo),
  })), [grupos]);
  const reportes = resumenes.flatMap((grupo) => grupo.resumen.filas.filter((fila) => fila.reporte));
  const totalEsperado = resumenes.reduce((total, grupo) => total + grupo.empleados.length, 0);
  const solicitudesPendientes = resumenes.reduce((total, grupo) =>
    total + grupo.resumen.filas.filter(({ tarea }) => !tarea).length, 0);
  const solicitudesVinculadas = resumenes.reduce((total, grupo) =>
    total + grupo.resumen.filas.filter(({ empleado, tarea }) => !tarea && empleado.auth_user_id).length, 0);
  const ventaReportada = reportes.length
    ? reportes.reduce((total, fila) => total + fila.reporte.importeReportado, 0)
    : null;
  const atendidas = reportes.length
    ? reportes.reduce((total, fila) => total + fila.reporte.personasAtendidas, 0)
    : null;
  const tickets = reportes.length
    ? reportes.reduce((total, fila) => total + fila.reporte.ticketsOPedidos, 0)
    : null;

  async function solicitarReportes() {
    setGuardando(true);
    setError("");
    setMensaje("");
    try {
      const pendientes = resumenes.flatMap((grupo) => grupo.resumen.filas
        .filter(({ tarea }) => !tarea)
        .map(({ empleado }) => ({ grupo, empleado })));
      const noVinculadas = pendientes.filter(({ empleado }) => !empleado.auth_user_id);
      const vinculadas = pendientes.filter(({ empleado }) => empleado.auth_user_id);
      const resultados = await Promise.allSettled(vinculadas.map(({ grupo, empleado }) => crearTareaOperativa({
        organizationId: empleado.organization_id || usuario?.organization_id,
        businessId: empleado.business_id || usuario?.business_id,
        branchId: grupo.sucursal.id,
        titulo: `PULSO DE VENTAS: ${fecha}`,
        descripcion: "Captura las ventas que realizaste y las personas que atendiste hoy. MONYS las guardará como reporte operativo para revisión de Dirección.",
        area: "ventas",
        responsable: empleado.nombre,
        responsableUsuarioId: empleado.auth_user_id,
        prioridad: "normal",
        fecha,
        creadaPor: usuario?.nombre || "Dirección",
        criterioExito: "Registrar personas atendidas, tickets o pedidos e importe reportado. Revisar productos solicitados o motivos de compra no realizada cuando existan.",
        instrucciones: "Completa los números con base en tu turno. Captura 0 solo si confirmaste que el resultado fue cero. El importe es reporte operativo de la empleada y no sustituye el cierre SICAR.",
      })));
      const creadas = resultados.filter((item) => item.status === "fulfilled").length;
      const fallidas = resultados.filter((item) => item.status === "rejected").length;
      setMensaje(`${creadas} reporte${creadas === 1 ? " solicitado" : "s solicitados"}${noVinculadas.length ? ` · ${noVinculadas.length} empleada${noVinculadas.length === 1 ? " sin" : "s sin"} acceso vinculado` : ""}${fallidas ? ` · ${fallidas} no se pudo asignar` : ""}.`);
      if (fallidas) setError("Revisa la conexión y vuelve a actualizar antes de reintentar.");
      await cargar();
    } catch (errorGuardado) {
      setError(errorGuardado?.message || "No fue posible solicitar los reportes.");
    } finally {
      setGuardando(false);
    }
  }

  return (
    <details className="owner-pulse" id="owner-pulso-ventas">
      <summary>Ventas y atención · reportes del equipo</summary>
      <div className="owner-pulse__content">
        <p className="owner-pulse__note"><b>Reporte operativo de empleadas.</b> No es venta SICAR ni utilidad. Los datos se atribuyen a la cuenta asignada; tickets y personas atendidas se muestran separados.</p>
        <div className="owner-pulse__metrics">
          <div><small>Reportes recibidos</small><strong>{cargando ? "Consultando…" : `${reportes.length} / ${totalEsperado}`}</strong></div>
          <div><small>Importe reportado</small><strong>{ventaReportada === null ? "Pendiente" : dinero.format(ventaReportada)}</strong></div>
          <div><small>Personas atendidas</small><strong>{atendidas === null ? "Pendiente" : atendidas}</strong></div>
          <div><small>Tickets o pedidos</small><strong>{tickets === null ? "Pendiente" : tickets}</strong></div>
        </div>
        <button type="button" className="owner-pulse__assign" onClick={solicitarReportes} disabled={cargando || guardando || totalEsperado === 0 || solicitudesVinculadas === 0}>
          {guardando ? "Solicitando…" : solicitudesVinculadas ? "Solicitar reportes de hoy" : solicitudesPendientes ? "Vincula accesos para solicitar" : "Reportes de hoy solicitados"}
        </button>
        {error && <p className="owner-pulse__error" role="alert">{error}</p>}
        {mensaje && <p className="owner-pulse__message" role="status">{mensaje}</p>}
        {resumenes.map((grupo) => (
          <section className="owner-pulse__branch" key={grupo.sucursal.id}>
            <h3>{grupo.sucursal.nombre}</h3>
            {grupo.resumen.filas.length ? grupo.resumen.filas.map(({ empleado, tarea, reporte }) => (
              <article key={empleado.id}>
                <span><b>{empleado.nombre}</b><small>{reporte ? `${reporte.personasAtendidas} personas · ${reporte.ticketsOPedidos} tickets` : !empleado.auth_user_id ? "Falta vincular su acceso MONYS" : tarea ? (tarea.estado === "terminada" ? "Resultado pendiente de validar" : "Reporte solicitado · falta respuesta") : "Sin solicitud de hoy"}</small></span>
                <strong>{reporte ? dinero.format(reporte.importeReportado) : tarea?.estado === "terminada" ? "Revisar dato" : tarea ? "Pendiente" : "Sin solicitud"}</strong>
              </article>
            )) : <p>No hay personal activo con responsabilidad de venta en esta sucursal.</p>}
          </section>
        ))}
        <button type="button" className="owner-pulse__refresh" onClick={cargar} disabled={cargando}>Actualizar estado</button>
      </div>
    </details>
  );
}
