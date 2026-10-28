import { useCallback, useEffect, useMemo, useState } from "react";
import { useUser } from "../../../context/UserContext";
import { obtenerCierresTurno } from "../../inteligencia/services/cierresTurnoService";
import { extraerCapturasFinancieras } from "../../inteligencia/utils/capturasFinancierasEquipo";
import {
  clasificarCuentaBancaria,
  guardarSaldoBancarioConfirmado,
  obtenerCuentasBancariasParaConfirmar,
  obtenerCuentasBancariasSinNegocio,
} from "../../tesoreria/services/cuentasFinancierasService";
import { resumirCierreDiarioDireccion } from "../utils/cierreDiarioDireccion";
import { obtenerCortesCajaSicar } from "../services/cortesCajaSicarService";
import { resumirCortesOficialesParaDisponibilidad } from "../utils/disponibilidadCortesOficiales";
import { fechaMexico, resumirDisponibilidadFinanciera } from "../utils/disponibilidadFinanciera";
import { resumirRemanenteSemanaAnterior } from "../utils/remanenteSemanaAnterior.js";
import { obtenerComprobacionesRetiros } from "../services/comprobacionesRetirosService.js";
import { obtenerDeudasFinancieras } from "../../inteligencia/services/deudasFinancierasService";
import { obtenerControlObligacionesOperativas } from "../../inteligencia/services/obligacionesOperativasService";
import ComprobacionRetiroCard from "./ComprobacionRetiroCard.jsx";
import ObligacionesOperativas from "./ObligacionesOperativas.jsx";
import { resumirObligacionesOperativas } from "../utils/obligacionesOperativas";
import "./DisponibilidadFinancieraHoy.css";

const dinero = new Intl.NumberFormat("es-MX", {
  style: "currency",
  currency: "MXN",
  maximumFractionDigits: 2,
});

function fechaHora(fecha) {
  if (!fecha) return "Sin confirmación";
  return new Intl.DateTimeFormat("es-MX", {
    timeZone: "America/Mexico_City",
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(fecha));
}

function Importe({ valor, pendiente = "Por confirmar" }) {
  return <strong>{valor === null || valor === undefined ? pendiente : dinero.format(valor)}</strong>;
}

export default function DisponibilidadFinancieraHoy({
  branchId,
  sucursales = [],
  creditosProveedores = {},
  onAbrirArea,
  onAbrirImportador,
}) {
  const { usuario } = useUser();
  const [cuentas, setCuentas] = useState([]);
  const [cuentasSinAsignar, setCuentasSinAsignar] = useState([]);
  const [cierre, setCierre] = useState({});
  const [importacionesCortes, setImportacionesCortes] = useState([]);
  const [capturas, setCapturas] = useState({});
  const [comprobacionesRetiros, setComprobacionesRetiros] = useState([]);
  const [deudasFinancieras, setDeudasFinancieras] = useState([]);
  const [deudasConsultadas, setDeudasConsultadas] = useState(false);
  const [obligaciones, setObligaciones] = useState([]);
  const [obligacionesConsultadas, setObligacionesConsultadas] = useState(false);
  const [coberturaObligacionesConfirmada, setCoberturaObligacionesConfirmada] = useState(false);
  const [errorObligaciones, setErrorObligaciones] = useState("");
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(null);
  const [clasificacionCuenta, setClasificacionCuenta] = useState({});
  const [clasificandoCuenta, setClasificandoCuenta] = useState(null);
  const [mensaje, setMensaje] = useState("");
  const [error, setError] = useState("");

  const role = String(usuario?.role || "").toLowerCase();
  const puedeConfirmar = ["owner", "director", "admin", "finanzas"].includes(role);
  const alcanceCompleto = ["owner", "director", "admin", "finanzas"].includes(role);
  const branchIds = useMemo(() => {
    const ids = (sucursales || []).map((sucursal) => sucursal?.id || sucursal?.branch_id).filter(Boolean);
    const principal = usuario?.branch_id || branchId;
    return [...new Set(principal ? [...ids, principal] : ids)];
  }, [branchId, sucursales, usuario?.branch_id]);

  const cargar = useCallback(async () => {
    if (!usuario?.organization_id) return;
    setCargando(true);
    setError("");
    try {
      const consultaSinAsignar = role === "owner"
        ? obtenerCuentasBancariasSinNegocio({ organizationId: usuario.organization_id })
        : Promise.resolve([]);
      const consultaObligaciones = obtenerControlObligacionesOperativas({ organizationId: usuario.organization_id, businessId: usuario.business_id })
        .then((data) => ({ data }))
        .catch((error) => ({ error }));
      const [resumenBancos, cierres, cortesOficiales, sinAsignar, deudas, resultadoObligaciones] = await Promise.all([
        obtenerCuentasBancariasParaConfirmar({ organizationId: usuario.organization_id, businessId: usuario.business_id }),
        obtenerCierresTurno({ branchId: alcanceCompleto ? null : branchId, limite: 100 }),
        obtenerCortesCajaSicar({ branchIds }),
        consultaSinAsignar,
        obtenerDeudasFinancieras({ organizationId: usuario.organization_id, businessId: usuario.business_id }),
        consultaObligaciones,
      ]);
      const capturasFinancieras = extraerCapturasFinancieras(cierres);
      setCuentas(resumenBancos.cuentas);
      setCuentasSinAsignar(sinAsignar);
      setDeudasFinancieras(deudas);
      setDeudasConsultadas(true);
      if (resultadoObligaciones.error) {
        setObligaciones([]);
        setObligacionesConsultadas(false);
        setCoberturaObligacionesConfirmada(false);
        setErrorObligaciones(resultadoObligaciones.error?.message || "Consulta de obligaciones no disponible.");
      } else {
        setObligaciones(resultadoObligaciones.data.obligaciones);
        setObligacionesConsultadas(true);
        setCoberturaObligacionesConfirmada(resultadoObligaciones.data.coberturaConfirmada);
        setErrorObligaciones("");
      }
      const cierreResumido = resumirCierreDiarioDireccion({
        capturas: capturasFinancieras,
        sucursales: [
          ...(sucursales || []),
          ...(usuario?.branch_id && usuario?.sucursal
            ? [{ id: usuario.branch_id, nombre: usuario.sucursal }]
            : []),
        ],
      });
      setCierre(cierreResumido);
      setImportacionesCortes(cortesOficiales);
      setComprobacionesRetiros(await obtenerComprobacionesRetiros(
        cierreResumido.retiros.map((retiro) => retiro.cierreId).filter(Boolean)
      ));
    } catch (e) {
      setDeudasConsultadas(false);
      setObligacionesConsultadas(false);
      setCoberturaObligacionesConfirmada(false);
      setError(e?.message || "No fue posible preparar la disponibilidad financiera de hoy.");
    } finally {
      setCargando(false);
    }
  }, [alcanceCompleto, branchId, branchIds, role, sucursales, usuario?.branch_id, usuario?.business_id, usuario?.organization_id, usuario?.sucursal]);

  useEffect(() => { cargar(); }, [cargar]);

  const cortesOficiales = useMemo(() => resumirCortesOficialesParaDisponibilidad({
    importaciones: importacionesCortes,
    cierre,
    hoy: cierre?.fecha,
  }), [cierre, importacionesCortes]);

  const resumen = useMemo(() => resumirDisponibilidadFinanciera({
    cuentas,
    cierre,
    cortesOficiales,
    creditosProveedores,
    deudasFinancieras,
    deudasConsultadas,
    obligacionesOperativas: resumirObligacionesOperativas({ obligaciones, consultadas: obligacionesConsultadas, hoy: fechaMexico() }),
    obligacionesOperativasConfirmadas: coberturaObligacionesConfirmada,
    comprobacionesRetiros,
  }), [cuentas, cierre, cortesOficiales, creditosProveedores, deudasFinancieras, deudasConsultadas, obligaciones, obligacionesConsultadas, coberturaObligacionesConfirmada, comprobacionesRetiros]);

  const semanaAnterior = useMemo(() => resumirRemanenteSemanaAnterior({
    importaciones: importacionesCortes,
    cierre,
    referencia: fechaMexico(),
  }), [importacionesCortes, cierre]);

  async function retiroActualizado(texto) {
    setMensaje(texto);
    await cargar();
  }

  function resolverPrioridad() {
    resolverDestino(resumen.prioridad.destino);
  }

  function resolverDestino(destino) {
    if (destino === "importador") onAbrirImportador?.();
    else onAbrirArea?.(destino);
  }

  function cambiarCaptura(accountId, campo, valor) {
    setCapturas((actual) => ({
      ...actual,
      [accountId]: { ...actual[accountId], [campo]: valor },
    }));
  }

  async function confirmarSaldo(evento, cuenta) {
    evento.preventDefault();
    const captura = capturas[cuenta.id] || {};
    setMensaje("");
    setError("");
    try {
      setGuardando(cuenta.id);
      await guardarSaldoBancarioConfirmado({
        organizationId: usuario.organization_id,
        accountId: cuenta.id,
        balance: captura.saldo,
        notes: captura.nota,
      });
      setCapturas((actual) => ({ ...actual, [cuenta.id]: { saldo: "", nota: "" } }));
      setMensaje(`Saldo de ${cuenta.nombre} confirmado correctamente.`);
      await cargar();
    } catch (e) {
      setError(e?.message || "No fue posible confirmar el saldo.");
    } finally {
      setGuardando(null);
    }
  }

  async function guardarClasificacionCuenta(evento, cuenta) {
    evento.preventDefault();
    const seleccion = clasificacionCuenta[cuenta.id] || {};
    const tipo = String(seleccion.tipo || "").toUpperCase();
    const nota = String(seleccion.nota || "").trim();
    if (!["EMPRESA", "PERSONAL", "MIXTA"].includes(tipo)) {
      setError("Selecciona si la cuenta es de empresa, personal o mixta.");
      return;
    }
    if (tipo === "EMPRESA" && !usuario?.business_id) {
      setError("Tu perfil no tiene un negocio asignado. No se modificó la cuenta.");
      return;
    }
    if (nota.length < 5) {
      setError("Describe brevemente cómo verificaste quién es titular o usa esta cuenta.");
      return;
    }
    const accion = tipo === "EMPRESA"
      ? "vincularla a Monys Glam como cuenta empresarial"
      : tipo === "PERSONAL"
        ? "marcarla como personal y excluirla del dinero de Monys Glam"
        : "marcarla como mixta y excluirla del dinero disponible empresarial";
    if (!window.confirm(`Confirma que revisaste ${cuenta.name} y es correcto ${accion}. La decisión quedará registrada con tu usuario y la nota.`)) return;

    setClasificandoCuenta(cuenta.id);
    setError("");
    setMensaje("");
    try {
      await clasificarCuentaBancaria({
        accountId: cuenta.id,
        clasificacion: tipo,
        businessId: tipo === "EMPRESA" ? usuario.business_id : null,
        nota,
      });
      setMensaje(`${cuenta.name}: clasificación guardada. Si es empresarial, confirma también su saldo actual para incluirlo en el cálculo.`);
      await cargar();
    } catch (fallo) {
      setError(fallo?.message || "No se pudo guardar la clasificación de la cuenta.");
    } finally {
      setClasificandoCuenta(null);
    }
  }

  const clase = `disponibilidad-hoy es-${resumen.prioridad.nivel}`;
  return (
    <section className={clase} aria-labelledby="disponibilidad-hoy-titulo">
      <header className="disponibilidad-hoy__encabezado">
        <div>
          <span>DIRECCIÓN FINANCIERA · VERDAD DE EFECTIVO</span>
          <h2 id="disponibilidad-hoy-titulo">¿Cuánto dinero puedo usar hoy?</h2>
          <p>Primero localiza el dinero; después protege lo comprometido. MONYS no confunde ventas con efectivo.</p>
        </div>
        <button type="button" onClick={cargar} disabled={cargando || Boolean(guardando)}>
          {cargando ? "Consultando…" : "Actualizar control"}
        </button>
      </header>

      <section className="remanente-semanal" aria-labelledby="remanente-semanal-titulo">
        <div className="remanente-semanal__encabezado">
          <div>
            <span>REVISIÓN DEL LUNES · CICLO LUNES A DOMINGO</span>
            <h3 id="remanente-semanal-titulo">Efectivo reportado al cierre de la semana anterior</h3>
            <small>{semanaAnterior.semana ? `${semanaAnterior.semana.inicio} al ${semanaAnterior.semana.fin}` : "Periodo por confirmar"}</small>
          </div>
          <strong>{semanaAnterior.efectivoReportado === null ? "Por confirmar" : dinero.format(semanaAnterior.efectivoReportado)}</strong>
        </div>
        <p>{semanaAnterior.completo
          ? "Dato de SICAR después de los retiros reportados. Es la base para revisar el remanente, todavía no es una autorización de retiro: falta cotejar el efectivo contado físicamente y conservar el fondo fijo de cada caja."
          : semanaAnterior.motivo}</p>
        {semanaAnterior.cajas.length > 0 && <div className="remanente-semanal__cajas">
          {semanaAnterior.cajas.map((caja) => <article key={`${caja.branchId}-${caja.cajaId}`}>
            <span>{caja.sucursal} · {caja.nombre}</span>
            <strong>{caja.efectivoEnCaja === null ? "Sin dato completo" : dinero.format(caja.efectivoEnCaja)}</strong>
            <small>{caja.estado === "completo"
              ? Math.abs(Number(caja.diferencia) || 0) > 0.009 ? `Diferencia SICAR: ${dinero.format(caja.diferencia)}` : "Corte completo · sin diferencia reportada"
              : caja.estado === "faltante" ? "Falta corte del domingo" : "Corte incompleto"}</small>
          </article>)}
        </div>}
      </section>

      <div className="disponibilidad-hoy__principal">
        <div>
          <small>DINERO LIBRE PARA DECIDIR</small>
          <Importe valor={resumen.dineroLibre} />
          <p>{resumen.calculable
            ? "Después de separar las obligaciones confirmadas de los próximos 7 días."
            : `No se mostrará una cifra hasta comprobar bancos, cajas, proveedores, deudas y gastos operativos. Remanente de obligaciones registradas: ${resumen.remanenteRegistrado === null ? "por calcular" : dinero.format(resumen.remanenteRegistrado)}; aún faltan gastos de operación confirmados.`}</p>
        </div>
        <article>
          <span>PRIORIDAD</span>
          <h3>{resumen.prioridad.titulo}</h3>
          <p>{resumen.prioridad.detalle}</p>
          <button type="button" onClick={resolverPrioridad}>
            Resolver esta prioridad →
          </button>
        </article>
      </div>

      {resumen.faltantes.length > 0 && <section className="disponibilidad-hoy__faltantes" aria-labelledby="disponibilidad-faltantes-titulo">
        <div>
          <strong id="disponibilidad-faltantes-titulo">Qué falta para calcular el dinero libre</strong>
          <span>{resumen.faltantes.length} pasos pendientes</span>
        </div>
        <ol>{resumen.faltantes.map((faltante, indice) => <li key={faltante.id}>
          <span><b>{indice + 1}</b>{faltante.titulo}</span>
          <button type="button" onClick={() => resolverDestino(faltante.destino)}>Abrir →</button>
        </li>)}</ol>
        <small>MONYS mantiene la cifra como “por confirmar” mientras falten datos; no convierte faltantes en ceros.</small>
      </section>}

      <div className="disponibilidad-hoy__metricas">
        <article><span>En bancos</span><Importe valor={resumen.saldoBancos} /><small>{resumen.bancosVigentes ? "Confirmado hoy" : `${resumen.cuentasPendientes} por actualizar`}</small></article>
        <article><span>En cajas</span><Importe valor={resumen.efectivoCajas} /><small>{resumen.cajasCompletas ? `${resumen.cajasEsperadas} cajas · ${resumen.fuenteCajas === "SICAR_OFICIAL" ? "SICAR oficial" : "cierre del equipo"}` : "Cierre incompleto"}</small></article>
        <article><span>Liquidez localizada</span><Importe valor={resumen.liquidezLocalizada} /><small>Banco + efectivo que permanece en caja</small></article>
        <article><span>Obligaciones a 7 días</span><Importe valor={resumen.proveedores.vigente && resumen.proveedores.sinFecha === 0 ? resumen.proveedores.compromisos7Dias : null} /><small>{!resumen.proveedores.vigente ? "Reporte por actualizar" : resumen.proveedores.sinFecha ? `${resumen.proveedores.sinFecha} sin vencimiento` : "Según fechas reportadas"}</small></article>
        <article><span>Pagos de deuda a 7 días</span><Importe valor={resumen.deudas.completas ? resumen.deudas.compromisos7Dias : null} /><small>{!resumen.deudas.consultadas ? "Consulta pendiente" : resumen.deudas.incompletas ? `${resumen.deudas.incompletas} créditos incompletos` : "Según calendario registrado"}</small></article>
      </div>

      <ObligacionesOperativas
        usuario={usuario}
        sucursales={sucursales}
        obligaciones={obligaciones}
        consultadas={obligacionesConsultadas}
        errorConsulta={errorObligaciones}
        coberturaConfirmada={coberturaObligacionesConfirmada}
        puedeGestionar={puedeConfirmar}
        onGuardar={cargar}
      />

      <div className={`disponibilidad-hoy__fuente ${cortesOficiales.completo ? "esta-lista" : ""}`}>
        <div>
          <span>{cortesOficiales.completo ? "DATO REAL · SICAR" : "PENDIENTE · CORTE OFICIAL"}</span>
          <strong>{cortesOficiales.completo
            ? "Cortes oficiales de hoy completos"
            : cortesOficiales.fechaUltimoCorte
              ? `Último corte oficial: ${cortesOficiales.fechaUltimoCorte}`
              : "Todavía no hay cortes SICAR importados"}</strong>
          <small>{cortesOficiales.completo
            ? `${cortesOficiales.cajasEncontradas} cajas comprobadas. Solo se suma el efectivo que permanece en caja.`
            : `${cortesOficiales.cajasFaltantes} sin corte de hoy y ${cortesOficiales.cajasIncompletas} incompletas. La ausencia no se convierte en cero.`}</small>
        </div>
        <button type="button" onClick={onAbrirImportador}>Actualizar cortes</button>
      </div>

      <div className="disponibilidad-hoy__ruta" aria-label="Comprobaciones para liberar dinero">
        <div className={resumen.bancosVigentes ? "esta-lista" : ""}><b>1</b><span><strong>Bancos</strong><small>{resumen.bancosVigentes ? "Confirmados hoy" : "Falta actualizar"}</small></span></div>
        <div className={resumen.cajasCompletas ? "esta-lista" : ""}><b>2</b><span><strong>Cajas</strong><small>{resumen.cajasCompletas ? "Cierre completo" : "Faltan importes"}</small></span></div>
        <div className={resumen.proveedores.vigente && !resumen.proveedores.sinFecha ? "esta-lista" : ""}><b>3</b><span><strong>Compromisos</strong><small>{!resumen.proveedores.vigente ? "Reporte desactualizado" : resumen.proveedores.sinFecha ? "Fechas pendientes" : "Vencimientos listos"}</small></span></div>
      </div>

      {resumen.efectivoResguardado > 0 && (
        <div className="disponibilidad-hoy__retiros">
          <div><span>EFECTIVO RETIRADO</span><strong>{dinero.format(resumen.efectivoResguardado)}</strong><small>No se suma al banco ni a la caja.</small></div>
          <div><span>COMPROBACIÓN REAL</span><strong>{resumen.comprobacionRetiros.comprobados} de {resumen.comprobacionRetiros.filas.length}</strong><small>{resumen.comprobacionRetiros.diferencias > 0 ? `${resumen.comprobacionRetiros.diferencias} diferencias requieren aclaración.` : resumen.comprobacionRetiros.reportados > 0 ? `${resumen.comprobacionRetiros.reportados} evidencias esperan revisión.` : resumen.comprobacionRetiros.pendientes > 0 ? `${resumen.comprobacionRetiros.pendientes} retiros siguen sin comprobante.` : "Todos los retiros están comprobados."}</small></div>
          <details className="disponibilidad-hoy__bandeja-retiros">
            <summary>📎 Abrir bandeja de comprobantes</summary>
            <h3>Comprobar retiros de caja</h3>
            <p>Un destino declarado o una foto reportada no comprueban el movimiento hasta que Dirección revise la evidencia.</p>
            {resumen.comprobacionRetiros.filas.map((retiro) => <ComprobacionRetiroCard
              key={`${retiro.cierreId || retiro.branchId}-${retiro.cajaId}`}
              retiro={retiro}
              puedeRevisar={puedeConfirmar}
              onActualizado={retiroActualizado}
            />)}
          </details>
        </div>
      )}
      {mensaje && <p className="disponibilidad-hoy__mensaje" role="status">✓ {mensaje}</p>}
      {error && <p className="disponibilidad-hoy__error" role="alert">{error}</p>}

      <details className="disponibilidad-hoy__bancos" open={!resumen.bancosVigentes}>
        <summary>Confirmar saldos bancarios de hoy</summary>
        <p>Consulta cada aplicación bancaria y captura el saldo disponible que ves ahora. Esto crea un corte nuevo; no borra los anteriores.</p>
        <div className="disponibilidad-hoy__cuentas">
          {resumen.cuentas.map((cuenta) => (
            <form key={cuenta.id} onSubmit={(evento) => confirmarSaldo(evento, cuenta)}>
              <div className="disponibilidad-hoy__cuenta-titulo">
                <div><strong>{cuenta.nombre}</strong><small>Última base: {fechaHora(cuenta.fechaSaldo)}</small></div>
                <span className={cuenta.confirmadaHoy ? "esta-vigente" : ""}>{cuenta.confirmadaHoy ? "Confirmada hoy" : cuenta.saldo === null ? "Sin saldo" : "Desactualizada"}</span>
              </div>
              <label>Saldo disponible ahora
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  inputMode="decimal"
                  placeholder={cuenta.saldo === null ? "0.00" : dinero.format(cuenta.saldo)}
                  value={capturas[cuenta.id]?.saldo || ""}
                  onChange={(evento) => cambiarCaptura(cuenta.id, "saldo", evento.target.value)}
                  disabled={!puedeConfirmar || guardando === cuenta.id}
                  required
                />
              </label>
              <label>Nota opcional
                <input
                  type="text"
                  maxLength="160"
                  placeholder="Ej. saldo visto en la app BBVA"
                  value={capturas[cuenta.id]?.nota || ""}
                  onChange={(evento) => cambiarCaptura(cuenta.id, "nota", evento.target.value)}
                  disabled={!puedeConfirmar || guardando === cuenta.id}
                />
              </label>
              <button type="submit" disabled={!puedeConfirmar || Boolean(guardando)}>
                {guardando === cuenta.id ? "Guardando…" : "Confirmar saldo"}
              </button>
            </form>
          ))}
        </div>
        {!resumen.cuentas.length && !cargando && <p>No hay cuentas bancarias activas configuradas para esta organización.</p>}
        {!puedeConfirmar && <p>Tu perfil puede consultar este control, pero Dirección o Finanzas deben confirmar los saldos.</p>}
      </details>
      {role === "owner" && cuentasSinAsignar.length > 0 && <aside role="status" style={{ marginTop: 16, padding: 16, border: "1px solid #e8c98c", borderRadius: 12, background: "#fff9ed" }}>
        <strong>Cuentas bancarias pendientes de asignar</strong>
        <p>Estas cuentas siguen excluidas del dinero disponible hasta que confirmes su uso. Personal o mixta queda registrada, pero nunca se suma al efectivo empresarial.</p>
        <div style={{ display: "grid", gap: 12 }}>{cuentasSinAsignar.map((cuenta) => <form key={cuenta.id} onSubmit={(evento) => guardarClasificacionCuenta(evento, cuenta)} style={{ padding: 12, borderRadius: 10, background: "#fff", border: "1px solid #eadfc8" }}>
          <strong>{cuenta.name}</strong><span style={{ marginLeft: 8, color: "#7b6b53" }}>Saldo excluido hasta clasificar</span>
          <label style={{ display: "block", marginTop: 8 }}>Titularidad y uso
            <select value={clasificacionCuenta[cuenta.id]?.tipo || ""} onChange={(evento) => setClasificacionCuenta((actual) => ({ ...actual, [cuenta.id]: { ...actual[cuenta.id], tipo: evento.target.value } }))} required>
              <option value="">Selecciona después de revisar</option>
              <option value="EMPRESA">Es cuenta de Monys Glam</option>
              <option value="PERSONAL">Es personal</option>
              <option value="MIXTA">Es personal y del negocio (mixta)</option>
            </select>
          </label>
          <label style={{ display: "block", marginTop: 8 }}>Cómo verificaste
            <input value={clasificacionCuenta[cuenta.id]?.nota || ""} onChange={(evento) => setClasificacionCuenta((actual) => ({ ...actual, [cuenta.id]: { ...actual[cuenta.id], nota: evento.target.value } }))} maxLength={500} minLength={5} placeholder="Ej. Revisé la titularidad y el uso de la cuenta" required />
          </label>
          <button type="submit" disabled={Boolean(clasificandoCuenta)} style={{ marginTop: 10 }}>{clasificandoCuenta === cuenta.id ? "Guardando…" : "Guardar clasificación"}</button>
        </form>)}</div>
      </aside>}
    </section>
  );
}
