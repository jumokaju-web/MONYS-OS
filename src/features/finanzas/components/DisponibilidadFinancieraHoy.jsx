import { useCallback, useEffect, useMemo, useState } from "react";
import { useUser } from "../../../context/UserContext";
import { obtenerCierresTurno } from "../../inteligencia/services/cierresTurnoService";
import { extraerCapturasFinancieras } from "../../inteligencia/utils/capturasFinancierasEquipo";
import {
  guardarSaldoBancarioConfirmado,
  obtenerCuentasBancariasParaConfirmar,
} from "../../tesoreria/services/cuentasFinancierasService";
import { resumirCierreDiarioDireccion } from "../utils/cierreDiarioDireccion";
import { obtenerCortesCajaSicar } from "../services/cortesCajaSicarService";
import { resumirCortesOficialesParaDisponibilidad } from "../utils/disponibilidadCortesOficiales";
import { resumirDisponibilidadFinanciera } from "../utils/disponibilidadFinanciera";
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
  const [cierre, setCierre] = useState({});
  const [importacionesCortes, setImportacionesCortes] = useState([]);
  const [capturas, setCapturas] = useState({});
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(null);
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
      const [resumenBancos, cierres, cortesOficiales] = await Promise.all([
        obtenerCuentasBancariasParaConfirmar({ organizationId: usuario.organization_id }),
        obtenerCierresTurno({ branchId: alcanceCompleto ? null : branchId, limite: 100 }),
        obtenerCortesCajaSicar({ branchIds }),
      ]);
      const capturasFinancieras = extraerCapturasFinancieras(cierres);
      setCuentas(resumenBancos.cuentas);
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
    } catch (e) {
      setError(e?.message || "No fue posible preparar la disponibilidad financiera de hoy.");
    } finally {
      setCargando(false);
    }
  }, [alcanceCompleto, branchId, branchIds, sucursales, usuario?.branch_id, usuario?.organization_id, usuario?.sucursal]);

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
  }), [cuentas, cierre, cortesOficiales, creditosProveedores]);

  function resolverPrioridad() {
    if (resumen.prioridad.destino === "importador") onAbrirImportador?.();
    else onAbrirArea?.(resumen.prioridad.destino);
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

      <div className="disponibilidad-hoy__principal">
        <div>
          <small>DINERO LIBRE PARA DECIDIR</small>
          <Importe valor={resumen.dineroLibre} />
          <p>{resumen.calculable
            ? "Después de separar las obligaciones confirmadas de los próximos 7 días."
            : "No se mostrará una cifra hasta comprobar bancos, cajas y vencimientos."}</p>
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

      <div className="disponibilidad-hoy__metricas">
        <article><span>En bancos</span><Importe valor={resumen.saldoBancos} /><small>{resumen.bancosVigentes ? "Confirmado hoy" : `${resumen.cuentasPendientes} por actualizar`}</small></article>
        <article><span>En cajas</span><Importe valor={resumen.efectivoCajas} /><small>{resumen.cajasCompletas ? `${resumen.cajasEsperadas} cajas · ${resumen.fuenteCajas === "SICAR_OFICIAL" ? "SICAR oficial" : "cierre del equipo"}` : "Cierre incompleto"}</small></article>
        <article><span>Liquidez localizada</span><Importe valor={resumen.liquidezLocalizada} /><small>Banco + efectivo que permanece en caja</small></article>
        <article><span>Obligaciones a 7 días</span><Importe valor={resumen.proveedores.vigente && resumen.proveedores.sinFecha === 0 ? resumen.proveedores.compromisos7Dias : null} /><small>{!resumen.proveedores.vigente ? "Reporte por actualizar" : resumen.proveedores.sinFecha ? `${resumen.proveedores.sinFecha} sin vencimiento` : "Según fechas reportadas"}</small></article>
      </div>

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
          <div><span>DESTINO IDENTIFICADO</span><strong>{resumen.controlRetiros.identificados} de {resumen.controlRetiros.filas.length}</strong><small>{resumen.controlRetiros.diferencias > 0 ? `${resumen.controlRetiros.diferencias} importes no coinciden con SICAR.` : resumen.controlRetiros.pendientes > 0 ? `${resumen.controlRetiros.pendientes} retiros requieren aclaración.` : "Todos los retiros tienen destino reportado."}</small></div>
          {resumen.controlRetiros.filas.map((retiro) => <article key={`${retiro.branchId}-${retiro.cajaId}`}>
            <b>{retiro.cajaId.replace("_", " ")} · {dinero.format(retiro.monto)}</b>
            <span>{retiro.estado === "IDENTIFICADO" ? retiro.etiquetaDestino : retiro.estado === "DIFERENCIA" ? "Importe distinto entre fuentes" : "Destino pendiente"}</span>
            {retiro.responsable && <small>{retiro.responsable} · {retiro.detalle}</small>}
          </article>)}
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
    </section>
  );
}
