import { useMemo, useState } from "react";
import { crearObligacionOperativa, obtenerSalidasSinAsignar, asignarPagoObligacion, confirmarCoberturaObligaciones } from "../../inteligencia/services/obligacionesOperativasService";
import { resumirObligacionesOperativas } from "../utils/obligacionesOperativas";
import "./ObligacionesOperativas.css";

const CATEGORIAS = ["RENTA", "NOMINA", "IMPUESTOS", "SERVICIOS", "SEGUROS", "OTRO"];
const FRECUENCIAS = ["UNICA", "SEMANAL", "QUINCENAL", "MENSUAL", "BIMESTRAL", "TRIMESTRAL", "SEMESTRAL", "ANUAL"];
const moneda = new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" });
const fechaHoy = () => new Intl.DateTimeFormat("en-CA", { timeZone: "America/Mexico_City", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());

const formularioVacio = (branchId = "") => ({ branchId, categoria: "RENTA", concepto: "", proveedor: "", importe: "", fechaVencimiento: fechaHoy(), frecuencia: "MENSUAL", notas: "" });

function saldoPendiente(obligacion) {
  const pagado = (obligacion.obligaciones_operativas_pagos || []).reduce((total, pago) => total + Number(pago.importe || 0), 0);
  return Math.max(0, Math.round((Number(obligacion.importe) - pagado) * 100) / 100);
}

export default function ObligacionesOperativas({ usuario, sucursales = [], obligaciones = [], consultadas = false, errorConsulta = "", coberturaConfirmada = false, puedeGestionar = false, onGuardar }) {
  const branchOptions = useMemo(() => sucursales.filter((sucursal) =>
    sucursal?.id && (!usuario?.business_id || sucursal.business_id === usuario.business_id)
  ), [sucursales, usuario?.business_id]);
  const [formulario, setFormulario] = useState(() => formularioVacio(usuario?.branch_id || ""));
  const [pago, setPago] = useState({ obligacionId: "", movimientoId: "", importe: "" });
  const [salidas, setSalidas] = useState([]);
  const [cargandoSalidas, setCargandoSalidas] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [mensaje, setMensaje] = useState("");
  const [error, setError] = useState("");
  const [notaRevision, setNotaRevision] = useState("");

  const resumen = useMemo(() => resumirObligacionesOperativas({ obligaciones, consultadas, hoy: fechaHoy() }), [obligaciones, consultadas]);
  const abiertas = obligaciones.filter((item) => item.estado !== "CANCELADA" && saldoPendiente(item) > 0);
  const ramas = new Map(branchOptions.map((branch) => [branch.id, branch.name || branch.nombre]));

  async function guardarObligacion(evento) {
    evento.preventDefault();
    setGuardando(true); setError(""); setMensaje("");
    try {
      await crearObligacionOperativa({
        organizationId: usuario.organization_id,
        businessId: usuario.business_id,
        branchId: formulario.branchId || null,
        categoria: formulario.categoria,
        concepto: formulario.concepto,
        proveedor: formulario.proveedor,
        importe: formulario.importe,
        fechaVencimiento: formulario.fechaVencimiento,
        frecuencia: formulario.frecuencia,
        notas: formulario.notas,
      });
      setFormulario(formularioVacio(usuario.branch_id || ""));
      setMensaje("Compromiso guardado. Todavía no representa un pago realizado.");
      await onGuardar?.();
    } catch (fallo) { setError(fallo?.message || "No se pudo guardar el compromiso."); }
    finally { setGuardando(false); }
  }

  async function cargarSalidas() {
    setCargandoSalidas(true); setError("");
    try {
      const lista = await obtenerSalidasSinAsignar({
        organizationId: usuario.organization_id,
        businessId: usuario.business_id,
        branchId: abiertas.find((item) => item.id === pago.obligacionId)?.branch_id || null,
      });
      setSalidas(lista);
    } catch (fallo) { setError(fallo?.message || "No se pudieron consultar las salidas."); }
    finally { setCargandoSalidas(false); }
  }

  async function guardarPago(evento) {
    evento.preventDefault();
    const movimiento = salidas.find((item) => item.id === pago.movimientoId);
    if (!movimiento) { setError("Selecciona una salida de caja o banco."); return; }
    setGuardando(true); setError(""); setMensaje("");
    try {
      await asignarPagoObligacion({
        organizationId: usuario.organization_id,
        businessId: usuario.business_id,
        branchId: movimiento.branch_id,
        obligacionId: pago.obligacionId,
        cashMovementId: movimiento.id,
        importe: pago.importe,
      });
      setPago({ obligacionId: "", movimientoId: "", importe: "" });
      setSalidas([]);
      setMensaje("Abono vinculado a la salida registrada; el saldo de la obligación se recalculará.");
      await onGuardar?.();
    } catch (fallo) { setError(fallo?.message || "No se pudo relacionar el pago."); }
    finally { setGuardando(false); }
  }

  async function confirmarRevision(evento) {
    evento.preventDefault();
    setGuardando(true); setError(""); setMensaje("");
    try {
      await confirmarCoberturaObligaciones({ organizationId: usuario.organization_id, businessId: usuario.business_id, nota: notaRevision });
      setNotaRevision("");
      setMensaje("Revisión del negocio registrada. Se invalidará si cambian los compromisos o abonos.");
      await onGuardar?.();
    } catch (fallo) { setError(fallo?.message || "No se pudo guardar la revisión."); }
    finally { setGuardando(false); }
  }

  return <section className="obligaciones-operativas" aria-label="Compromisos operativos">
    <header><div><span>COMPROMISOS · TESORERÍA</span><h3>Pagos que vienen</h3><p>Registra vencimientos futuros y enlaza cada abono con una salida existente. Las frecuencias repetidas todavía no generan el siguiente vencimiento automáticamente.</p></div><button type="button" onClick={onGuardar}>Actualizar</button></header>
    {errorConsulta ? <p className="obligaciones-operativas__pendiente" role="status">El registro todavía no está habilitado en la base de datos. No asumí cero compromisos. {errorConsulta}</p> : <>
      <div className="obligaciones-operativas__totales"><article><span>Pendiente registrado</span><strong>{resumen.totalPendiente === null ? "Por confirmar" : moneda.format(resumen.totalPendiente)}</strong></article><article><span>Vencido o vence en 7 días</span><strong>{resumen.compromisos7Dias === null ? "Por confirmar" : moneda.format(resumen.compromisos7Dias)}</strong></article></div>
      {!consultadas && <p role="status">Consultando obligaciones guardadas…</p>}
      {resumen.incompletas > 0 && <p className="obligaciones-operativas__pendiente" role="status">{resumen.incompletas} registros requieren corregir importe, fecha o abonos antes de usarlos en el flujo.</p>}
      {resumen.frecuenciasNoProyectadas > 0 && <p className="obligaciones-operativas__pendiente" role="status">{resumen.frecuenciasNoProyectadas} obligaciones recurrentes no tienen su siguiente vencimiento calculado. La cifra de dinero libre queda bloqueada hasta capturar cada periodo próximo.</p>}
      <div className="obligaciones-operativas__lista">{resumen.filas.map((item) => <article key={item.id}>
        <div><strong>{item.concepto}</strong><small>{item.categoria} · {ramas.get(item.branch_id) || "Todo el negocio"} · vence {item.fecha_vencimiento}{item.proveedor ? ` · ${item.proveedor}` : ""}</small></div>
        <div><strong>{moneda.format(item.saldoPendiente)}</strong><small>{item.vencida ? "VENCIDA" : "Pendiente"}</small></div>
      </article>)}{consultadas && !obligaciones.length && <p>No hay obligaciones registradas. Esto no confirma por sí solo que no haya pagos próximos.</p>}</div>
      {puedeGestionar && <details><summary>Registrar compromiso operativo</summary><form className="obligaciones-operativas__form" onSubmit={guardarObligacion}>
        <label>Categoría<select value={formulario.categoria} onChange={(e) => setFormulario({ ...formulario, categoria: e.target.value })}>{CATEGORIAS.map((categoria) => <option key={categoria}>{categoria}</option>)}</select></label>
        <label>Sucursal<select value={formulario.branchId} onChange={(e) => setFormulario({ ...formulario, branchId: e.target.value })}><option value="">Todo el negocio</option>{branchOptions.map((branch) => <option key={branch.id} value={branch.id}>{branch.name || branch.nombre}</option>)}</select></label>
        <label>Concepto<input required maxLength="180" value={formulario.concepto} onChange={(e) => setFormulario({ ...formulario, concepto: e.target.value })} placeholder="Ej. Renta de noviembre" /></label>
        <label>Proveedor o a quién se paga<input maxLength="180" value={formulario.proveedor} onChange={(e) => setFormulario({ ...formulario, proveedor: e.target.value })} /></label>
        <label>Importe<input required type="number" min="0.01" step="0.01" inputMode="decimal" value={formulario.importe} onChange={(e) => setFormulario({ ...formulario, importe: e.target.value })} /></label>
        <label>Vencimiento<input required type="date" value={formulario.fechaVencimiento} onChange={(e) => setFormulario({ ...formulario, fechaVencimiento: e.target.value })} /></label>
        <label>Frecuencia<select value={formulario.frecuencia} onChange={(e) => setFormulario({ ...formulario, frecuencia: e.target.value })}>{FRECUENCIAS.map((frecuencia) => <option key={frecuencia}>{frecuencia}</option>)}</select></label>
        <label>Nota o referencia<input maxLength="500" value={formulario.notas} onChange={(e) => setFormulario({ ...formulario, notas: e.target.value })} /></label>
        <button type="submit" disabled={guardando}>{guardando ? "Guardando…" : "Guardar compromiso"}</button>
      </form></details>}
      {puedeGestionar && abiertas.length > 0 && <details><summary>Relacionar abono con salida registrada</summary><form className="obligaciones-operativas__form" onSubmit={guardarPago}>
        <label>Obligación<select required value={pago.obligacionId} onChange={(e) => { setPago({ obligacionId: e.target.value, movimientoId: "", importe: "" }); setSalidas([]); }}><option value="">Selecciona</option>{abiertas.map((item) => <option key={item.id} value={item.id}>{item.concepto} · pendiente {moneda.format(saldoPendiente(item))}</option>)}</select></label>
        <button type="button" disabled={!pago.obligacionId || cargandoSalidas} onClick={cargarSalidas}>{cargandoSalidas ? "Buscando salidas…" : "Buscar salidas sin asignar"}</button>
        <label>Salida existente<select required value={pago.movimientoId} onChange={(e) => setPago({ ...pago, movimientoId: e.target.value })}><option value="">Selecciona movimiento</option>{salidas.map((movimiento) => <option key={movimiento.id} value={movimiento.id}>{new Date(movimiento.occurred_at).toLocaleDateString("es-MX")} · {movimiento.concept} · disponible {moneda.format(movimiento.disponibleParaAsignar)}</option>)}</select></label>
        <label>Importe de este abono<input required type="number" min="0.01" step="0.01" inputMode="decimal" value={pago.importe} onChange={(e) => setPago({ ...pago, importe: e.target.value })} /></label>
        <button type="submit" disabled={guardando || !pago.movimientoId}>{guardando ? "Guardando…" : "Vincular abono"}</button>
      </form></details>}
      {puedeGestionar && <form className="obligaciones-operativas__revision" onSubmit={confirmarRevision}>
        <strong>{coberturaConfirmada ? "Revisión de hoy confirmada" : "Revisión completa pendiente"}</strong>
        <p>Antes de confirmar, revisa pagos de ambas sucursales: renta, nómina, impuestos, servicios, proveedores y créditos. Una lista vacía no demuestra que no haya pagos.</p>
        <label>Qué fuentes o documentos revisaste<textarea minLength={8} maxLength={1000} required value={notaRevision} onChange={(e) => setNotaRevision(e.target.value)} placeholder="Ej. Calendario de renta, nómina de esta semana y pagos BBVA próximos" /></label>
        <button type="submit" disabled={guardando || !consultadas || Boolean(errorConsulta)}>{guardando ? "Guardando…" : coberturaConfirmada ? "Volver a confirmar revisión" : "Confirmo que revisé todos los pagos próximos"}</button>
      </form>}
    </>}
    {mensaje && <p role="status">{mensaje}</p>}{error && !errorConsulta && <p role="alert">{error}</p>}
    <small>Un compromiso capturado no equivale a pago. Un pago solo se reconoce si ya existe la salida y queda enlazada aquí.</small>
  </section>;
}
