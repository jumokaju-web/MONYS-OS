import { useEffect, useMemo, useState } from "react";
import { obtenerFechaLocalISO } from "../../shared/fechaLocal";
import { asignarResponsableAutomatico } from "../../services/empleadosRHService";
import { crearTareaOperativa } from "../../services/tareasOperativasService";
import {
  calcularResumenDeudas,
  guardarDeudaFinanciera,
  obtenerDeudasFinancieras,
} from "../../services/deudasFinancierasService";
import { calcularMensualidadesConFecha } from "../../shared/resumenProgramacionPagos.js";

const FORMULARIO_INICIAL = {
  nombre: "",
  acreedor: "",
  tipo: "SIMPLE",
  alcance: "NEGOCIO",
  saldoActual: "",
  pagoMensual: "",
  tasaAnual: "",
  fechaProximoPago: "",
  fuente: "CAPTURA_MANUAL",
  fechaCorteDato: obtenerFechaLocalISO(),
  notas: "",
};

function dinero(valor) {
  return new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency: "MXN",
    maximumFractionDigits: 2,
  }).format(Number(valor) || 0);
}

function fechaCorta(valor) {
  if (!valor) return "Sin fecha";
  return new Date(`${String(valor).slice(0, 10)}T12:00:00`).toLocaleDateString(
    "es-MX",
    { day: "numeric", month: "short", year: "numeric" }
  );
}

function diasHasta(valor) {
  if (!valor) return null;
  const fecha = new Date(`${String(valor).slice(0, 10)}T12:00:00`);
  if (Number.isNaN(fecha.getTime())) return null;

  const hoy = new Date();
  hoy.setHours(12, 0, 0, 0);
  return Math.ceil((fecha.getTime() - hoy.getTime()) / 86400000);
}

function prioridadPago(fecha) {
  const dias = diasHasta(fecha);
  if (dias === null) return { etiqueta: "FALTA FECHA", color: "#80530d", fondo: "#fff0c9" };
  if (dias < 0) return { etiqueta: "VENCIDO", color: "#9b2525", fondo: "#ffe2e2" };
  if (dias <= 7) return { etiqueta: "URGENTE", color: "#994119", fondo: "#ffe8d8" };
  if (dias <= 30) return { etiqueta: "ESTE MES", color: "#765b00", fondo: "#fff5bf" };
  return { etiqueta: "PROGRAMABLE", color: "#236641", fondo: "#e1f5e8" };
}

function obtenerFechaRevisionPago(fechaPago) {
  const hoy = obtenerFechaLocalISO();
  if (!fechaPago) return hoy;

  const fechaRevision = new Date(`${String(fechaPago).slice(0, 10)}T12:00:00`);
  if (Number.isNaN(fechaRevision.getTime())) return hoy;

  fechaRevision.setDate(fechaRevision.getDate() - 3);
  const fechaLocal = obtenerFechaLocalISO(fechaRevision);
  return fechaLocal < hoy ? hoy : fechaLocal;
}

function esTablaPendiente(error) {
  const codigo = String(error?.code || "").toUpperCase();
  const texto = [error?.message, error?.details, error?.hint]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  if (codigo === "42P01" || codigo === "PGRST205") {
    return true;
  }

  return (
    texto.includes("deudas_financieras") &&
    ((texto.includes("relation") && texto.includes("does not exist")) ||
      (texto.includes("could not find the table") &&
        texto.includes("schema cache")) ||
      (texto.includes("table") && texto.includes("not found")))
  );
}

const inputStyle = {
  width: "100%",
  minHeight: "46px",
  boxSizing: "border-box",
  border: "1px solid #dfcfb5",
  borderRadius: "11px",
  padding: "10px 12px",
  background: "#fff",
  color: "#33291f",
  font: "inherit",
};

function CentroRescateFinanciero({
  organizationId,
  businessId = null,
  branchId = null,
  flujoNetoPeriodo = 0,
  reservaRecomendada = 0,
  baseFinancieraVigente = false,
  movimientosPendientes = 0,
}) {
  const [deudas, setDeudas] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [formularioAbierto, setFormularioAbierto] = useState(false);
  const [formulario, setFormulario] = useState(FORMULARIO_INICIAL);
  const [mensaje, setMensaje] = useState("");
  const [basePendiente, setBasePendiente] = useState(false);
  const [programacion, setProgramacion] = useState({ guardandoId: null, agendadas: {}, mensaje: "" });

  async function cargarDeudas() {
    if (!organizationId) {
      setCargando(false);
      return;
    }

    try {
      setCargando(true);
      setBasePendiente(false);
      const registros = await obtenerDeudasFinancieras({ organizationId });
      setDeudas(registros);
    } catch (error) {
      setDeudas([]);
      setBasePendiente(esTablaPendiente(error));
      setMensaje(
        esTablaPendiente(error)
          ? "La base privada de créditos está preparada en código y falta activarla en Supabase."
          : error?.message || "No fue posible consultar los créditos."
      );
    } finally {
      setCargando(false);
    }
  }

  useEffect(() => {
    cargarDeudas();
    // La función solo depende de la organización activa.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [organizationId]);

  const resumen = useMemo(() => calcularResumenDeudas(deudas), [deudas]);
  const datosFaltantes = resumen.sinTasa + resumen.sinPagoMensual;
  const pagosOrdenados = useMemo(
    () =>
      [...deudas]
        .filter((deuda) => String(deuda?.estado || "").trim().toUpperCase() !== "CERRADA")
        .sort((a, b) => {
          const diasA = diasHasta(a?.fecha_proximo_pago);
          const diasB = diasHasta(b?.fecha_proximo_pago);
          return (diasA ?? Number.MAX_SAFE_INTEGER) - (diasB ?? Number.MAX_SAFE_INTEGER);
        })
        .slice(0, 6),
    [deudas],
  );
  const mensualidadesConFecha = useMemo(
    () => calcularMensualidadesConFecha(deudas),
    [deudas],
  );
  const baseAptaParaProgramar =
    baseFinancieraVigente && Number(movimientosPendientes) === 0;

  const actualizarCampo = (evento) => {
    const { name, value } = evento.target;
    setFormulario((anterior) => ({ ...anterior, [name]: value }));
  };

  const agendarRevisionPago = async (deuda) => {
    if (!branchId || programacion.guardandoId) return;

    try {
      setProgramacion((actual) => ({ ...actual, guardandoId: deuda.id, mensaje: "" }));
      const responsable = await asignarResponsableAutomatico({
        branchId,
        titulo: `Revisar pago · ${deuda.nombre}`,
        descripcion: "Confirmar vencimiento y saldo del compromiso financiero.",
        area: "administracion",
        fecha: obtenerFechaRevisionPago(deuda.fecha_proximo_pago),
        requiereUsuarioVinculado: true,
      });

      if (!responsable?.nombre) {
        throw new Error("No hay una persona de administración con usuario MONYS vinculado en esta sucursal.");
      }

      const fechaRevision = obtenerFechaRevisionPago(deuda.fecha_proximo_pago);
      const etiquetaVencimiento = deuda.fecha_proximo_pago
        ? `Vence ${String(deuda.fecha_proximo_pago).slice(0, 10)}`
        : "Falta confirmar la fecha de vencimiento";
      const titulo = `Revisar pago · ${deuda.nombre} · ${etiquetaVencimiento}`;

      await crearTareaOperativa({
        organizationId,
        businessId,
        branchId,
        titulo,
        descripcion: `Revisar el crédito con ${deuda.acreedor}. ${etiquetaVencimiento}. Mensualidad registrada: ${Number(deuda.pago_mensual) > 0 ? dinero(deuda.pago_mensual) : "sin confirmar"}.`,
        area: "administracion",
        responsable: responsable.nombre,
        prioridad: prioridadPago(deuda.fecha_proximo_pago).etiqueta === "VENCIDO" ? "urgente" : "alta",
        fecha: fechaRevision,
        horaLimite: "12:00",
        instrucciones: "Confirma el saldo, la fecha y la disponibilidad de efectivo; prepara la propuesta para autorización de Mónica. No marques como pagado ni realices transferencias desde esta tarea.",
        creadaPor: "Centro de Rescate Financiero",
        requiereEvidencia: true,
        criterioExito: "Datos del pago y disponibilidad verificados; propuesta documentada para autorización humana. Ningún pago se ejecuta automáticamente.",
      });

      setProgramacion((actual) => ({
        guardandoId: null,
        agendadas: { ...actual.agendadas, [deuda.id]: true },
        mensaje: `Recordatorio agendado para ${responsable.nombre}, el ${fechaCorta(fechaRevision)}. No se realizó ningún pago.`,
      }));
    } catch (error) {
      setProgramacion((actual) => ({
        ...actual,
        guardandoId: null,
        mensaje: error?.message || "No se pudo agendar la revisión.",
      }));
    }
  };

  const guardar = async (evento) => {
    evento.preventDefault();
    if (guardando || basePendiente) return;

    try {
      setGuardando(true);
      setMensaje("");
      await guardarDeudaFinanciera({
        organizationId,
        businessId,
        branchId,
        ...formulario,
      });
      setFormulario(FORMULARIO_INICIAL);
      setFormularioAbierto(false);
      setMensaje("✅ Crédito registrado. El resumen fue recalculado con datos reales.");
      await cargarDeudas();
    } catch (error) {
      setMensaje(error?.message || "No fue posible guardar el crédito.");
    } finally {
      setGuardando(false);
    }
  };

  return (
    <section
      style={{
        marginTop: "22px",
        padding: "22px",
        borderRadius: "18px",
        background: "linear-gradient(145deg, #fffaf1 0%, #fff 70%)",
        border: "1px solid #e7c889",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          gap: "14px",
          flexWrap: "wrap",
        }}
      >
        <div style={{ maxWidth: "620px" }}>
          <p
            style={{
              margin: 0,
              color: "#a06317",
              fontSize: "13px",
              fontWeight: 900,
              letterSpacing: "0.08em",
            }}
          >
            PLAN DE SALIDA · INFORMACIÓN PRIVADA
          </p>
          <h3 style={{ margin: "7px 0", fontSize: "23px" }}>
            🛟 Mapa de créditos y compromisos
          </h3>
          <p style={{ margin: 0, color: "#6f6254", lineHeight: 1.55 }}>
            Primero reunimos saldo, mensualidad, tasa y próxima fecha. MONYS puede
            ordenar la revisión, pero no paga, refinancia ni acepta deuda nueva.
          </p>
        </div>
        <span
          style={{
            padding: "8px 12px",
            borderRadius: "999px",
            background: "#eef8f0",
            color: "#267044",
            border: "1px solid #b9ddc3",
            fontWeight: 850,
          }}
        >
          🔒 Dueña / administración
        </span>
      </div>

      {mensaje && (
        <div
          role="status"
          style={{
            marginTop: "16px",
            padding: "12px 14px",
            borderRadius: "11px",
            background: mensaje.startsWith("✅") ? "#eef9f1" : "#fff3df",
            border: mensaje.startsWith("✅")
              ? "1px solid #acd2b8"
              : "1px solid #e3bd73",
            color: mensaje.startsWith("✅") ? "#24683d" : "#714c12",
            fontWeight: 750,
          }}
        >
          {mensaje}
        </div>
      )}

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
          gap: "12px",
          marginTop: "18px",
        }}
      >
        {[
          ["Créditos activos", cargando ? "…" : resumen.cantidad],
          ["Saldo registrado", cargando ? "…" : dinero(resumen.saldoTotal)],
          ["Carga mensual", cargando ? "…" : dinero(resumen.pagoMensualTotal)],
          ["Datos por completar", cargando ? "…" : datosFaltantes],
        ].map(([etiqueta, valor]) => (
          <div
            key={etiqueta}
            style={{
              padding: "15px",
              borderRadius: "14px",
              background: "#fff",
              border: "1px solid #eadcc4",
            }}
          >
            <div style={{ color: "#7c6e60", fontSize: "13px" }}>{etiqueta}</div>
            <strong style={{ display: "block", marginTop: "6px", fontSize: "21px" }}>
              {valor}
            </strong>
          </div>
        ))}
      </div>

      <section
        style={{
          marginTop: "18px",
          padding: "18px",
          borderRadius: "16px",
          background: "linear-gradient(135deg, #2d2025, #6f3d25)",
          color: "#fff",
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            gap: "12px",
            flexWrap: "wrap",
            alignItems: "flex-start",
          }}
        >
          <div>
            <p
              style={{
                margin: 0,
                color: "#ffd9ae",
                fontSize: "11px",
                fontWeight: 900,
                letterSpacing: ".08em",
              }}
            >
              PROGRAMADOR SEGURO DE PAGOS
            </p>
            <h3 style={{ margin: "6px 0", fontSize: "21px" }}>
              Qué vence primero y qué falta confirmar
            </h3>
          </div>
          <span
            style={{
              padding: "7px 10px",
              borderRadius: "999px",
              background: baseAptaParaProgramar ? "#dff5e7" : "#ffe8b8",
              color: baseAptaParaProgramar ? "#1d643b" : "#714b00",
              fontSize: "11px",
              fontWeight: 900,
            }}
          >
            {baseAptaParaProgramar ? "Base revisable" : "Propuesta bloqueada"}
          </span>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(145px, 1fr))",
            gap: "9px",
            marginTop: "13px",
          }}
        >
          {[
            [
              "Flujo neto del periodo",
              baseFinancieraVigente ? dinero(flujoNetoPeriodo) : "Sin base vigente",
            ],
            [
              "Reserva recomendada",
              baseFinancieraVigente ? dinero(reservaRecomendada) : "Sin base vigente",
            ],
            ["Mensualidades con fecha", dinero(mensualidadesConFecha.montoTotal)],
          ].map(([etiqueta, valor]) => (
            <div
              key={etiqueta}
              style={{
                padding: "11px",
                borderRadius: "12px",
                background: "rgba(255,255,255,.08)",
                border: "1px solid rgba(255,255,255,.14)",
              }}
            >
              <div style={{ fontSize: "10px", opacity: 0.72 }}>{etiqueta}</div>
              <strong style={{ display: "block", marginTop: "5px", fontSize: "17px" }}>
                {valor}
              </strong>
            </div>
          ))}
        </div>

        <p style={{ margin: "8px 0 0", color: "rgba(255,255,255,.78)", fontSize: "11px", lineHeight: 1.45 }}>
          El total incluye todos los créditos activos con monto y vencimiento; la lista muestra hasta seis, ordenados por fecha.
        </p>

        <div
          style={{
            marginTop: "12px",
            padding: "11px 12px",
            borderRadius: "11px",
            background: "rgba(255,255,255,.09)",
            fontSize: "12px",
            lineHeight: 1.5,
          }}
        >
          {!baseFinancieraVigente
            ? "Actualiza ventas y Tesorería antes de distribuir dinero."
            : Number(movimientosPendientes) > 0
              ? `Aclara ${movimientosPendientes} movimiento${Number(movimientosPendientes) === 1 ? "" : "s"} antes de programar.`
              : "Orden sugerido: compromisos vencidos → operación esencial → reserva → crecimiento autorizado."}
          <strong style={{ display: "block", marginTop: "4px", color: "#ffd9ae" }}>
            MONYS prepara el calendario; no realiza transferencias ni pagos.
          </strong>
        </div>

        {pagosOrdenados.length > 0 ? (
          <div style={{ display: "grid", gap: "8px", marginTop: "13px" }}>
            {pagosOrdenados.map((deuda) => {
              const prioridad = prioridadPago(deuda.fecha_proximo_pago);
              return (
                <article
                  key={`pago-${deuda.id}`}
                  style={{
                    display: "grid",
                    gridTemplateColumns: "minmax(0, 1fr) auto",
                    gap: "10px",
                    padding: "11px 12px",
                    borderRadius: "11px",
                    background: "rgba(255,255,255,.96)",
                    color: "#33291f",
                  }}
                >
                  <div style={{ minWidth: 0 }}>
                    <strong style={{ display: "block" }}>{deuda.nombre}</strong>
                    <small style={{ color: "#76675c" }}>
                      {fechaCorta(deuda.fecha_proximo_pago)} · {deuda.acreedor}
                    </small>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <span
                      style={{
                        display: "inline-block",
                        padding: "4px 7px",
                        borderRadius: "999px",
                        background: prioridad.fondo,
                        color: prioridad.color,
                        fontSize: "9px",
                        fontWeight: 900,
                      }}
                    >
                      {prioridad.etiqueta}
                    </span>
                    <strong style={{ display: "block", marginTop: "4px", fontSize: "13px" }}>
                      {Number(deuda.pago_mensual) > 0
                        ? dinero(deuda.pago_mensual)
                        : "Falta monto"}
                    </strong>
                  </div>
                  <button
                    type="button"
                    disabled={!branchId || Boolean(programacion.guardandoId)}
                    onClick={() => agendarRevisionPago(deuda)}
                    style={{ gridColumn: "1 / -1", minHeight: 38, borderRadius: 9, border: "1px solid #d8bd91", background: programacion.agendadas[deuda.id] ? "#e3f5e8" : "#fff8e9", color: programacion.agendadas[deuda.id] ? "#236641" : "#714b00", fontWeight: 850, cursor: !branchId || programacion.guardandoId ? "wait" : "pointer" }}
                  >
                    {programacion.guardandoId === deuda.id
                      ? "Agendando revisión…"
                      : programacion.agendadas[deuda.id]
                        ? "✓ Revisión agendada"
                        : "Agendar revisión en tareas del equipo"}
                  </button>
                </article>
              );
            })}
          </div>
        ) : (
          <div
            style={{
              marginTop: "13px",
              padding: "13px",
              borderRadius: "11px",
              background: "rgba(255,255,255,.08)",
              fontSize: "12px",
            }}
          >
            Registra créditos, mensualidades y fechas para construir el calendario real.
          </div>
        )}
        {programacion.mensaje && (
          <div role="status" style={{ marginTop: 10, padding: 11, borderRadius: 10, background: programacion.mensaje.startsWith("Recordatorio") ? "rgba(225,245,232,.96)" : "rgba(255,240,224,.96)", color: programacion.mensaje.startsWith("Recordatorio") ? "#236641" : "#75451a", fontWeight: 750, fontSize: 12 }}>
            {programacion.mensaje}
          </div>
        )}
      </section>

      {deudas.length > 0 && (
        <div style={{ display: "grid", gap: "10px", marginTop: "16px" }}>
          {deudas.map((deuda) => (
            <article
              key={deuda.id}
              style={{
                display: "grid",
                gridTemplateColumns: "minmax(150px, 1.5fr) repeat(4, minmax(105px, 1fr))",
                gap: "12px",
                padding: "14px",
                borderRadius: "13px",
                background: "#fff",
                border: "1px solid #eadcc4",
                overflowX: "auto",
              }}
            >
              <div>
                <strong>{deuda.nombre}</strong>
                <div style={{ color: "#74675a", marginTop: "3px", fontSize: "13px" }}>
                  {deuda.acreedor} · {deuda.tipo}
                </div>
              </div>
              <div>
                <small>Saldo</small>
                <strong style={{ display: "block" }}>{dinero(deuda.saldo_actual)}</strong>
              </div>
              <div>
                <small>Mensualidad</small>
                <strong style={{ display: "block" }}>
                  {deuda.pago_mensual == null || deuda.pago_mensual === ""
                    ? "Falta dato"
                    : dinero(deuda.pago_mensual)}
                </strong>
              </div>
              <div>
                <small>Tasa anual</small>
                <strong style={{ display: "block" }}>
                  {deuda.tasa_anual == null || deuda.tasa_anual === ""
                    ? "Falta dato"
                    : `${Number(deuda.tasa_anual).toFixed(2)}% anual`}
                </strong>
              </div>
              <div>
                <small>Próximo pago</small>
                <strong style={{ display: "block" }}>{fechaCorta(deuda.fecha_proximo_pago)}</strong>
              </div>
            </article>
          ))}
        </div>
      )}

      <button
        type="button"
        onClick={() => setFormularioAbierto((abierto) => !abierto)}
        disabled={!organizationId || basePendiente}
        style={{
          width: "100%",
          marginTop: "18px",
          minHeight: "48px",
          borderRadius: "12px",
          border: "1px solid #92590f",
          background: basePendiente ? "#eee7dc" : "#8a5410",
          color: basePendiente ? "#766f65" : "#fff",
          fontWeight: 850,
          cursor: basePendiente ? "not-allowed" : "pointer",
        }}
      >
        {basePendiente
          ? "Base de créditos lista para activar"
          : formularioAbierto
            ? "Cerrar captura"
            : "+ Registrar crédito o deuda"}
      </button>

      {formularioAbierto && !basePendiente && (
        <form onSubmit={guardar} style={{ marginTop: "18px" }}>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))",
              gap: "13px",
            }}
          >
            <label>
              Nombre del crédito
              <input required name="nombre" value={formulario.nombre} onChange={actualizarCampo} style={inputStyle} placeholder="Ej. Crédito terminal" />
            </label>
            <label>
              Banco o acreedor
              <input required name="acreedor" value={formulario.acreedor} onChange={actualizarCampo} style={inputStyle} placeholder="Nombre real" />
            </label>
            <label>
              Tipo
              <select name="tipo" value={formulario.tipo} onChange={actualizarCampo} style={inputStyle}>
                <option value="SIMPLE">Crédito simple</option>
                <option value="REVOLVENTE">Revolvente</option>
                <option value="TERMINAL">Terminal de venta</option>
                <option value="TARJETA">Tarjeta</option>
                <option value="OTRO">Otro</option>
              </select>
            </label>
            <label>
              Relación con MONYS
              <select name="alcance" value={formulario.alcance} onChange={actualizarCampo} style={inputStyle}>
                <option value="NEGOCIO">Deuda del negocio</option>
                <option value="PERSONAL_RESPALDA_NEGOCIO">Personal que respalda al negocio</option>
              </select>
            </label>
            <label>
              Saldo actual $
              <input required min="0" step="0.01" type="number" name="saldoActual" value={formulario.saldoActual} onChange={actualizarCampo} style={inputStyle} />
            </label>
            <label>
              Pago mensual $ (si se conoce)
              <input min="0" step="0.01" type="number" name="pagoMensual" value={formulario.pagoMensual} onChange={actualizarCampo} style={inputStyle} />
            </label>
            <label>
              Tasa anual % (si se conoce)
              <input min="0" step="0.0001" type="number" name="tasaAnual" value={formulario.tasaAnual} onChange={actualizarCampo} style={inputStyle} />
            </label>
            <label>
              Próximo pago
              <input type="date" name="fechaProximoPago" value={formulario.fechaProximoPago} onChange={actualizarCampo} style={inputStyle} />
            </label>
            <label>
              Fuente del dato
              <select name="fuente" value={formulario.fuente} onChange={actualizarCampo} style={inputStyle}>
                <option value="CAPTURA_MANUAL">Captura manual</option>
                <option value="ESTADO_CUENTA">Estado de cuenta</option>
                <option value="CONTRATO">Contrato</option>
                <option value="BANCA_EN_LINEA">Banca en línea</option>
              </select>
            </label>
            <label>
              Fecha de corte del dato
              <input required type="date" name="fechaCorteDato" value={formulario.fechaCorteDato} onChange={actualizarCampo} style={inputStyle} />
            </label>
          </div>
          <label style={{ display: "block", marginTop: "13px" }}>
            Notas privadas
            <textarea name="notas" value={formulario.notas} onChange={actualizarCampo} style={{ ...inputStyle, minHeight: "82px", resize: "vertical" }} placeholder="Garantía, atraso, contacto o dato que falta confirmar" />
          </label>
          <button
            type="submit"
            disabled={guardando}
            style={{
              width: "100%",
              minHeight: "48px",
              marginTop: "14px",
              border: 0,
              borderRadius: "12px",
              background: "#2f6e43",
              color: "white",
              fontWeight: 900,
              cursor: guardando ? "wait" : "pointer",
            }}
          >
            {guardando ? "Guardando…" : "Guardar sin realizar ningún pago"}
          </button>
        </form>
      )}
    </section>
  );
}

export default CentroRescateFinanciero;
