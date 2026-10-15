import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { obtenerCierresTurno } from "../../inteligencia/services/cierresTurnoService";
import {
  extraerCapturaFinanciera,
  obtenerSesionCajaActiva,
} from "../../inteligencia/utils/capturasFinancierasEquipo";

import { diagnosticarCorte, seleccionarCortes, resumirAlertasCortes } from "../utils/prioridadesCortes";

const moneda = new Intl.NumberFormat("es-MX", {
  style: "currency",
  currency: "MXN",
  maximumFractionDigits: 2,
});

function fechaLegible(fecha) {
  if (!fecha) return "Sin fecha";
  const [anio, mes, dia] = String(fecha).split("-");
  return dia && mes && anio ? `${dia}/${mes}/${anio}` : fecha;
}

const etiquetasCategoria = {
  retiro_caja: "Retiro de caja",
  proveedor: "Proveedor / mercancía",
  nomina_comision: "Nómina o comisión",
  logistica: "Envío, ruta o paquetería",
  deposito_traspaso: "Depósito o traspaso",
  servicios: "Servicio del negocio",
  compra_emergencia: "Compra de emergencia",
  prestamo_anticipo: "Préstamo o anticipo",
  otro: "Otro movimiento",
};

function TarjetaDato({ titulo, valor, alerta = false, esDinero = true }) {
  return (
    <div className={alerta ? "captura-dato captura-dato-alerta" : "captura-dato"}>
      <small>{titulo}</small>
      <strong>{esDinero ? moneda.format(Number(valor) || 0) : Number(valor) || 0}</strong>
    </div>
  );
}

export default function BandejaCapturasEquipo({ branchId }) {
  const [capturas, setCapturas] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState("");
  const [sesionCajaActiva, setSesionCajaActiva] = useState(null);

  const solicitud = useRef(0);
  const [filtros, setFiltros] = useState({ desde: '', hasta: '', buscar: '', tipo: '', nivel: '' });
  const [limiteAlcanzado, setLimiteAlcanzado] = useState(false);
  const [actualizadoEn, setActualizadoEn] = useState(null);
  const rangoInvalido = Boolean(filtros.desde && filtros.hasta && filtros.desde > filtros.hasta);
  const visibles = useMemo(() => rangoInvalido ? [] : seleccionarCortes(capturas, filtros), [capturas, filtros, rangoInvalido]);
  const alertas = useMemo(() => resumirAlertasCortes(visibles), [visibles]);
  const cambiarFiltro = (campo, valor) => setFiltros(actual => ({ ...actual, [campo]: valor }));

  const cargar = useCallback(async () => {
    const actual = ++solicitud.current;
    setCapturas([]);
    setSesionCajaActiva(null);
    setActualizadoEn(null);
    setLimiteAlcanzado(false);
    try {
      setCargando(true);
      setError("");
      const cierres = await obtenerCierresTurno({ branchId, limite: 100 });
      if (actual !== solicitud.current) return;
      setLimiteAlcanzado(cierres.length === 100);
      setActualizadoEn(new Date());
      setSesionCajaActiva(branchId ? obtenerSesionCajaActiva(cierres) : null);
      setCapturas(cierres.map(extraerCapturaFinanciera).filter(Boolean));
    } catch (errorConsulta) {
      if (actual !== solicitud.current) return;
      setError(errorConsulta?.message || "No fue posible cargar las capturas del equipo.");
    } finally {
      if (actual === solicitud.current) setCargando(false);
    }
  }, [branchId]);

  const invalidarSolicitud = useCallback(() => { solicitud.current++; }, []);
  useEffect(() => {
    cargar();
    return invalidarSolicitud;
  }, [cargar, invalidarSolicitud]);

  const resumen = useMemo(() => {
    const cajas = visibles.filter((item) => item.tipo === "caja");
    const flotilla = visibles.filter((item) => item.tipo === "flotilla");
    return {
      cajas: cajas.length,
      flotilla: flotilla.length,
      diferenciasCaja: cajas.reduce(
        (total, item) => total + (Number(item.datos.diferenciaCaja) || 0),
        0
      ),
      entradasCaja: cajas.reduce(
        (total, item) => total + (Number(item.datos.entradasPosteriores) || 0), 0
      ),
      salidasCaja: cajas.reduce(
        (total, item) => total + (Number(item.datos.salidasPosteriores) || 0), 0
      ),
      traspasos: cajas.reduce(
        (total, item) => total + (Number(item.datos.traspasos) || 0), 0
      ),
      prestamos: cajas.reduce(
        (total, item) => total + (Number(item.datos.prestamos) || 0), 0
      ),
      resultadoFlotilla: flotilla.reduce(
        (total, item) => total + (Number(item.datos.resultadoEstimado) || 0),
        0
      ),
    };
  }, [visibles]);

  return (
    <section className="capturas-equipo">
      <div className="capturas-equipo-cabecera">
        <div>
          <span>MONYS OS · CONTROL DIARIO</span>
          <h2>Primero, lo que necesita tu atención</h2>
          <p>
            Aquí llega lo que registran empleadas y choferes. Primero se revisa;
            después se concilia con SICAR, banco y comprobantes.
          </p>
        </div>
        <button type="button" onClick={cargar} disabled={cargando}>
          {cargando ? "Actualizando…" : "Actualizar"}
        </button>
      </div>

      <div className="cortes-filtros" aria-label="Filtrar cortes">
        <label>Desde<input type="date" value={filtros.desde} onChange={e => cambiarFiltro('desde', e.target.value)} /></label>
        <label>Hasta<input type="date" value={filtros.hasta} onChange={e => cambiarFiltro('hasta', e.target.value)} /></label>
        <label>Responsable o unidad<input type="search" value={filtros.buscar} placeholder="Buscar nombre o placas" onChange={e => cambiarFiltro('buscar', e.target.value)} /></label>
        <label>Origen<select value={filtros.tipo} onChange={e => cambiarFiltro('tipo', e.target.value)}><option value="">Todos</option><option value="caja">Tiendas</option><option value="flotilla">Flotilla</option></select></label>
        <label>Atención<select value={filtros.nivel} onChange={e => cambiarFiltro('nivel', e.target.value)}><option value="">Todo, por prioridad</option><option value="diferencia">Diferencias por aclarar</option><option value="incompleto">Datos incompletos</option><option value="evidencia">Sin diferencia, falta foto</option><option value="revision">Revisión de comprobantes</option></select></label>
        <button type="button" onClick={() => setFiltros({ desde: '', hasta: '', buscar: '', tipo: '', nivel: '' })}>Limpiar filtros</button>
      </div>
      {rangoInvalido && <p role="alert">La fecha inicial debe ser anterior o igual a la final.</p>}
      <p className="cortes-alcance" role="status">{cargando ? 'Consultando cortes…' : error ? 'Consulta no disponible.' : `${visibles.length} capturas visibles de ${capturas.length} recibidas.`} {actualizadoEn && `Actualizado a las ${actualizadoEn.toLocaleTimeString('es-MX')}.`} {limiteAlcanzado && 'Se alcanzó el límite de 100 registros recientes; este resumen puede estar incompleto.'}</p>
      {!branchId && <p className="capturas-aviso">Vista de varias sucursales. Selecciona una sucursal para consultar quién tiene su caja abierta.</p>}
      <div className="cortes-prioridad">
        <div><span>POR ACLARAR · NO COMPENSADOS</span><h3>{alertas.conDiferencia} cortes con diferencias</h3><p>Los faltantes y sobrantes se revisan por separado; no se cancelan entre sí.</p></div>
        <div><small>Faltantes de caja reportados</small><strong>{moneda.format(alertas.faltantes)}</strong></div>
        <div><small>Sobrantes de caja reportados</small><strong>{moneda.format(alertas.sobrantes)}</strong></div>
        <div><small>Sin foto / datos incompletos</small><strong>{alertas.sinEvidencia} / {alertas.incompletos}</strong></div>
      </div>

      {branchId && !cargando && !error && <div className={sesionCajaActiva ? "captura-caja-activa" : "captura-caja-activa esta-cerrada"}>
        <span>CAJA AHORA</span>
        {sesionCajaActiva ? (
          <>
            <strong>{sesionCajaActiva.responsable}</strong>
            <small>
              Responsable desde {new Date(sesionCajaActiva.abiertoEn).toLocaleString("es-MX")} · Fondo $1,000.00
            </small>
          </>
        ) : (
          <>
            <strong>Sin responsable activa</strong>
            <small>La caja está cerrada o el último corte ya fue entregado.</small>
          </>
        )}
      </div>}

      <div className="capturas-resumen">
        <TarjetaDato titulo="Cortes recibidos" valor={resumen.cajas} esDinero={false} />
        <TarjetaDato titulo="Entradas posteriores" valor={resumen.entradasCaja} />
        <TarjetaDato titulo="Salidas posteriores" valor={resumen.salidasCaja} />
        <TarjetaDato
          titulo="Saldo neto de diferencias (no conciliado)"
          valor={resumen.diferenciasCaja}
          alerta={Math.abs(resumen.diferenciasCaja) > 0.009}
        />
        {resumen.traspasos > 0 && <TarjetaDato titulo="Depósitos / traspasos" valor={resumen.traspasos} />}
        {resumen.prestamos > 0 && <TarjetaDato titulo="Préstamos / anticipos" valor={resumen.prestamos} />}
        {resumen.flotilla > 0 && <TarjetaDato titulo="Resultado estimado flotilla" valor={resumen.resultadoFlotilla} />}
      </div>

      <p className="capturas-aviso">
        Las cifras son reportes del equipo y todavía no son contabilidad final.
        No se suman a utilidad hasta comprobarlas contra las otras fuentes.
      </p>

      {error && <p role="alert">{error}</p>}
      {cargando && capturas.length === 0 && <p role="status">Cargando capturas…</p>}
      {!cargando && !error && capturas.length === 0 && (
        <div className="capturas-vacio">
          Aún no hay cortes de caja ni liquidaciones de flotilla con el nuevo formato.
          En cuanto el equipo guarde uno, aparecerá aquí.
        </div>
      )}

      {!cargando && !error && capturas.length > 0 && visibles.length === 0 && !rangoInvalido && <p className="capturas-vacio">No hay capturas que coincidan con estos filtros.</p>}
      <div className="capturas-lista">
        {visibles.map(({ tipo, datos, cierre }) => (
          <article key={cierre.id} className={`captura-registro corte-${diagnosticarCorte({ tipo, datos }).nivel}`}>
            <header>
              <div>
                <span>{tipo === "caja" ? "CORTE DE TIENDA" : "LIQUIDACIÓN DE FLOTILLA"}</span>
                <h3>
                  {tipo === "caja"
                    ? cierre.responsable
                    : `${datos.placas || "Unidad"} · ${datos.chofer || cierre.responsable}`}
                </h3>
              </div>
              <div className="captura-estado">
                <b>Pendiente de revisión</b>
                <small>{fechaLegible(cierre.fecha)}</small>
              </div>
            </header>

            <div className="corte-siguiente"><strong>{diagnosticarCorte({ tipo, datos }).titulo}</strong><p>{diagnosticarCorte({ tipo, datos }).accion}</p></div>
            {tipo === "caja" ? (
              <>
                <div className="captura-grid">
                  <TarjetaDato titulo="Venta SICAR" valor={datos.ventaSicar} />
                  <TarjetaDato titulo="Cobrado" valor={datos.cobrado} />
                  <TarjetaDato titulo="Salidas posteriores" valor={datos.salidasPosteriores} />
                  <TarjetaDato titulo="Diferencia contra SICAR" valor={datos.diferenciaVenta} alerta={Math.abs(Number(datos.diferenciaVenta) || 0) > 0.009} />
                  <TarjetaDato titulo="Diferencia de caja" valor={datos.diferenciaCaja} alerta={Math.abs(Number(datos.diferenciaCaja) || 0) > 0.009} />
                </div>
                {Array.isArray(datos.movimientosCaja) && datos.movimientosCaja.length > 0 && (
                  <div className="captura-movimientos">
                    <h4>Movimientos declarados por el equipo</h4>
                    {datos.movimientosCaja.map((movimiento, index) => {
                      const noEsGasto = ["deposito_traspaso", "prestamo_anticipo"].includes(movimiento.categoria);
                      return (
                        <div className="captura-movimiento" key={`${cierre.id}-${index}`}>
                          <div>
                            <b>{movimiento.concepto || "Sin concepto"}</b>
                            <small>{etiquetasCategoria[movimiento.categoria] || "Otro movimiento"}{movimiento.recibidoPor ? ` · ${movimiento.recibidoPor}` : ""}</small>
                            {noEsGasto && <em>No se considera gasto operativo</em>}
                          </div>
                          <strong className={movimiento.tipo === "entrada" ? "es-entrada" : "es-salida"}>
                            {movimiento.tipo === "entrada" ? "+" : "−"}{moneda.format(Number(movimiento.monto) || 0)}
                          </strong>
                        </div>
                      );
                    })}
                  </div>
                )}
                {datos.fotoCorteUrl && (
                  <a
                    className="captura-evidencia-corte"
                    href={datos.fotoCorteUrl}
                    target="_blank"
                    rel="noreferrer"
                  >
                    Ver foto del corte de SICAR →
                  </a>
                )}
              </>
            ) : (
              <div className="captura-grid">
                <TarjetaDato titulo="Ingreso de ruta" valor={datos.ingresoRuta} />
                <TarjetaDato titulo="Gastos reportados" valor={datos.gastos} />
                <TarjetaDato titulo="Resultado estimado" valor={datos.resultadoEstimado} />
                <div className="captura-dato">
                  <small>Ruta</small>
                  <strong>{datos.codigoRuta || "Sin ruta"}</strong>
                </div>
              </div>
            )}
          </article>
        ))}
      </div>
    </section>
  );
}
