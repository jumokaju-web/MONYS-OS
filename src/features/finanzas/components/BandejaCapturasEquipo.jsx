import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { obtenerCierresTurno } from "../../inteligencia/services/cierresTurnoService";
import {
  extraerCapturasFinancieras,
  obtenerSesionesCajaActivas,
} from "../../inteligencia/utils/capturasFinancierasEquipo";

import { diagnosticarCorte, seleccionarCortes, resumirAlertasCortes } from "../utils/prioridadesCortes";

import { useUser } from '../../../context/UserContext';
import RevisionCorteDiario from './RevisionCorteDiario';
import CompletarCorteIncompleto from './CompletarCorteIncompleto';
import CierreHoyDireccion from './CierreHoyDireccion';
import { resumirCierreDiarioDireccion } from '../utils/cierreDiarioDireccion';
import { indexarSeguimientosCierre } from '../utils/seguimientoCierre';
import { obtenerRevisionesCortes } from '../services/revisionesCortesService';
import { etiquetasRevision, estadoRevisionCorte, resumirEstadosRevision } from '../utils/revisionCortes';

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
  const tieneValor = valor !== null && valor !== undefined && String(valor).trim() !== "";
  return (
    <div className={alerta ? "captura-dato captura-dato-alerta" : "captura-dato"}>
      <small>{titulo}</small>
      <strong>{tieneValor ? (esDinero ? moneda.format(Number(valor)) : Number(valor)) : "—"}</strong>
    </div>
  );
}

export default function BandejaCapturasEquipo({ branchId, sucursales = [] }) {
  const { usuario } = useUser();
  const esOwner = usuario?.role === 'owner';
  const alcanceBranchId = esOwner ? null : branchId;
  const nombresSucursales = useMemo(
    () => {
      const nombres = new Map((sucursales || []).map((sucursal) => [String(sucursal.id), sucursal.name || sucursal.nombre || 'Sucursal']));
      if (usuario?.branch_id && usuario?.sucursal) nombres.set(String(usuario.branch_id), usuario.sucursal);
      return nombres;
    },
    [sucursales, usuario?.branch_id, usuario?.sucursal]
  );
  const [revisiones, setRevisiones] = useState({});
  const [errorRevisiones, setErrorRevisiones] = useState('');
  const [revisionDisponible, setRevisionDisponible] = useState(false);
  const [filtroRevision, setFiltroRevision] = useState('');
  const [capturas, setCapturas] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState("");
  const [sesionesCajaActivas, setSesionesCajaActivas] = useState([]);
  const [seguimientosCierre, setSeguimientosCierre] = useState(new Map());

  const solicitud = useRef(0);
  const [filtros, setFiltros] = useState({ desde: '', hasta: '', buscar: '', tipo: '', nivel: '' });
  const [limiteAlcanzado, setLimiteAlcanzado] = useState(false);
  const [actualizadoEn, setActualizadoEn] = useState(null);
  const rangoInvalido = Boolean(filtros.desde && filtros.hasta && filtros.desde > filtros.hasta);
  const seleccionadas = useMemo(() => rangoInvalido ? [] : seleccionarCortes(capturas, filtros, revisiones), [capturas, filtros, rangoInvalido, revisiones]);
  const visibles = useMemo(() => seleccionadas.filter(c => !filtroRevision || (c.tipo === 'caja' && estadoRevisionCorte(c, revisiones[c.cierre.id]) === filtroRevision)), [seleccionadas, filtroRevision, revisiones]);
  const estados = useMemo(() => resumirEstadosRevision(seleccionadas, revisiones), [seleccionadas, revisiones]);
  const alertas = useMemo(() => resumirAlertasCortes(visibles, revisiones), [visibles, revisiones]);
  const sinBase = cargando || Boolean(error) || visibles.length === 0;
  const cambiarFiltro = (campo, valor) => setFiltros(actual => ({ ...actual, [campo]: valor }));

  const cargar = useCallback(async () => {
    const actual = ++solicitud.current;
    setRevisiones({});
    setRevisionDisponible(false);
    setErrorRevisiones('');
    setCapturas([]);
    setSesionesCajaActivas([]);
    setSeguimientosCierre(new Map());
    setActualizadoEn(null);
    setLimiteAlcanzado(false);
    try {
      setCargando(true);
      setError("");
      const cierres = await obtenerCierresTurno({ branchId: alcanceBranchId, limite: 100 });
      if (actual !== solicitud.current) return;
      setLimiteAlcanzado(cierres.length === 100);
      setActualizadoEn(new Date());
      setSesionesCajaActivas(!esOwner && branchId ? Object.values(obtenerSesionesCajaActivas(cierres)) : []);
      setSeguimientosCierre(indexarSeguimientosCierre(cierres));
      const recibidas = extraerCapturasFinancieras(cierres);
      setCapturas(recibidas);
      if (esOwner) {
        try {
          const resultados = await obtenerRevisionesCortes(recibidas.filter(c => c.tipo === 'caja').map(c => c.cierre.id));
          if (actual !== solicitud.current) return;
          setRevisiones(Object.fromEntries(resultados.map(r => [r.cierre_id, r])));
          setRevisionDisponible(true);
        } catch (e) { if (actual === solicitud.current) setErrorRevisiones(e.message); }
      }
    } catch (errorConsulta) {
      if (actual !== solicitud.current) return;
      setError(errorConsulta?.message || "No fue posible cargar las capturas del equipo.");
    } finally {
      if (actual === solicitud.current) setCargando(false);
    }
  }, [alcanceBranchId, branchId, esOwner]);

  const invalidarSolicitud = useCallback(() => { solicitud.current++; }, []);
  useEffect(() => {
    cargar();
    return invalidarSolicitud;
  }, [cargar, invalidarSolicitud]);

  const resumen = useMemo(() => {
    const cajas = visibles.filter((item) => item.tipo === "caja");
    const cajasEvaluables = cajas.filter((item) => !item.datos.registroIncompleto);
    const flotilla = visibles.filter((item) => item.tipo === "flotilla");
    const sumarCajasEvaluables = (campo) => cajasEvaluables.length
      ? cajasEvaluables.reduce((total, item) => total + (Number(item.datos[campo]) || 0), 0)
      : null;
    return {
      cajas: cajas.length,
      cajasEvaluables: cajasEvaluables.length,
      cajasIncompletas: cajas.length - cajasEvaluables.length,
      flotilla: flotilla.length,
      ventaSicar: sumarCajasEvaluables("ventaSicar"),
      cobrado: sumarCajasEvaluables("cobrado"),
      efectivoFinal: sumarCajasEvaluables("efectivoFinal"),
      efectivoEntregado: sumarCajasEvaluables("efectivoEntregado"),
      diferenciasCaja: sumarCajasEvaluables("diferenciaCaja"),
      entradasCaja: sumarCajasEvaluables("entradasPosteriores"),
      salidasCaja: sumarCajasEvaluables("salidasPosteriores"),
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
  const resumenCierreHoy = useMemo(() => resumirCierreDiarioDireccion({
    capturas,
    sucursales: [
      ...(sucursales || []),
      ...(usuario?.branch_id && usuario?.sucursal ? [{ id: usuario.branch_id, nombre: usuario.sucursal }] : []),
    ],
  }), [capturas, sucursales, usuario?.branch_id, usuario?.sucursal]);

  return (
    <section className="capturas-equipo">
      {esOwner && <CierreHoyDireccion resumen={resumenCierreHoy} cargando={cargando} error={error} onActualizar={cargar} seguimientos={seguimientosCierre} usuario={usuario} />}
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
        <label>Atención<select value={filtros.nivel} onChange={e => cambiarFiltro('nivel', e.target.value)}><option value="">Todo, por prioridad</option><option value="diferencia">Diferencias por aclarar</option><option value="incompleto">Datos incompletos</option><option value="evidencia">Comprobar foto o apertura</option><option value="revision">Revisión de comprobantes</option></select></label>
        {esOwner && <label>Revisión<select disabled={!revisionDisponible} value={filtroRevision} onChange={e => setFiltroRevision(e.target.value)}><option value="">Todos los estados</option>{Object.entries(etiquetasRevision).map(([id, texto]) => <option key={id} value={id}>{texto}</option>)}</select></label>}
        <button type="button" onClick={() => { setFiltroRevision(''); setFiltros({ desde: '', hasta: '', buscar: '', tipo: '', nivel: '' }); }}>Limpiar filtros</button>
      </div>
      {rangoInvalido && <p role="alert">La fecha inicial debe ser anterior o igual a la final.</p>}
      {esOwner && <section className="cortes-seguimiento" aria-label="Seguimiento de revisiones">
        <div className="cortes-seguimiento-titulo"><div><span>TU MESA DE REVISIÓN</span><h3>Cada corte, con un siguiente paso</h3></div><p>Solo cortes recibidos que coinciden con los filtros de arriba. No indica qué sucursales faltan por cerrar.</p></div>
        <div className="cortes-estados">{[
          ['PENDIENTE', 'Por revisar', 'Comparar foto, cobros y efectivo'],
          ['ACLARAR', 'En aclaración', 'Dar seguimiento a la explicación'],
          ['DESACTUALIZADO', 'Revisar de nuevo', 'El contenido cambió tras la revisión'],
          ['REVISADO', 'Revisión registrada', 'Consultar evidencia e historial'],
        ].map(([id, titulo, ayuda]) => <button type="button" key={id} disabled={cargando || Boolean(error) || !revisionDisponible || rangoInvalido} aria-pressed={filtroRevision === id} onClick={() => setFiltroRevision(actual => actual === id ? '' : id)}><span>{titulo}</span><strong>{cargando || error || !revisionDisponible || rangoInvalido ? '—' : estados[id]}</strong><small>{ayuda}</small></button>)}</div>
        <p className="cortes-alcance">{!revisionDisponible ? 'Los estados se mostrarán al confirmar la consulta de revisiones.' : filtroRevision ? 'Filtro activo: ' + etiquetasRevision[filtroRevision] + '. Pulsa la misma tarjeta para ver todos los estados.' : 'Selecciona una tarjeta para ver sus cortes.'}</p>
      </section>}
      <p className="cortes-alcance" role="status">{cargando ? 'Consultando cortes…' : error ? 'Consulta no disponible.' : `${visibles.length} capturas visibles de ${capturas.length} recibidas.`} {actualizadoEn && `Actualizado a las ${actualizadoEn.toLocaleTimeString('es-MX', { timeZone: 'America/Mexico_City' })}.`} {limiteAlcanzado && 'Se alcanzó el límite de 100 registros recientes; este resumen puede estar incompleto.'}</p>
      {esOwner && <p className="capturas-aviso">Vista de Dirección: se muestran los cortes de todas las sucursales.</p>}
      {!branchId && <p className="capturas-aviso">Vista de varias sucursales. Selecciona una sucursal para consultar quién tiene su caja abierta.</p>}
      <div className="cortes-prioridad">
        <div><span>POR ACLARAR · NO COMPENSADOS</span><h3>{sinBase ? (cargando ? 'Consultando cortes…' : error ? 'No se pudo consultar' : 'Sin cortes para evaluar') : resumen.cajasIncompletas > 0 && resumen.cajasEvaluables === 0 ? `${resumen.cajasIncompletas} corte sin importes para evaluar` : revisionDisponible ? alertas.conDiferencia + ' cortes con diferencias sin revisar' : alertas.conDiferencia + ' cortes con diferencias reportadas'}</h3><p>{resumen.cajasIncompletas > 0 && resumen.cajasEvaluables === 0 ? 'Faltan la venta SICAR, los cobros, el efectivo contado y la foto. Hasta recibirlos no existe un monto verificable.' : 'Los faltantes y sobrantes se revisan por separado; no se cancelan entre sí.'}</p></div>
        <div><small>Faltantes de caja reportados</small><strong>{sinBase || resumen.cajasEvaluables === 0 ? '—' : moneda.format(alertas.faltantes)}</strong></div>
        <div><small>Sobrantes de caja reportados</small><strong>{sinBase || resumen.cajasEvaluables === 0 ? '—' : moneda.format(alertas.sobrantes)}</strong></div>
        <div><small>Sin foto / datos incompletos</small><strong>{sinBase ? '—' : `${alertas.sinEvidencia} / ${alertas.incompletos}`} </strong></div>
      </div>

      {branchId && !cargando && !error && <div className={sesionesCajaActivas.length ? "captura-caja-activa" : "captura-caja-activa esta-cerrada"}>
        <span>CAJA AHORA</span>
        {sesionesCajaActivas.length ? (
          <div className="captura-cajas-activas">{sesionesCajaActivas.map(sesion => <div key={sesion.cajaId}><strong>{sesion.cajaNombre || (sesion.cajaId === 'SIN_IDENTIFICAR' ? 'Caja anterior sin identificar' : sesion.cajaId)} · {sesion.responsable}</strong><small>Abierta {new Date(sesion.abiertoEn).toLocaleString("es-MX")} · Fondo $1,000.00</small></div>)}</div>
        ) : (
          <>
            <strong>No se encontró una apertura activa</strong>
            <small>No hay una apertura vigente entre los registros consultados; confirma con la encargada.</small>
          </>
        )}
      </div>}

      {!sinBase && <div className="capturas-resumen">
        <TarjetaDato titulo="Cortes recibidos" valor={resumen.cajas} esDinero={false} />
        <TarjetaDato titulo="Venta total SICAR" valor={resumen.ventaSicar} />
        <TarjetaDato titulo="Total cobrado" valor={resumen.cobrado} />
        <TarjetaDato titulo="Efectivo que quedó en cajas" valor={resumen.efectivoFinal} />
        <TarjetaDato titulo="Efectivo retirado / resguardado" valor={resumen.efectivoEntregado} />
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
      </div>}

      <p className="capturas-aviso">
        Las cifras son reportes del equipo y todavía no son contabilidad final.
        No se suman a utilidad hasta comprobarlas contra las otras fuentes.
      </p>

      {errorRevisiones && <p role="alert" className="capturas-aviso">{errorRevisiones} No se puede confirmar el estado de revisión de estos cortes.</p>}
      {esOwner && revisionDisponible && <p className="cortes-alcance">Las revisiones se guardan en MONYS. Pulsa Actualizar para consultar cambios de otro equipo. Conserva tu texto antes de actualizar: se vuelven a cargar los cortes.</p>}
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
                    ? `${nombresSucursales.get(String(cierre.branch_id)) || 'Sucursal sin identificar'} · ${datos.cajaNombre || 'Caja sin identificar'} · ${cierre.responsable}`
                    : `${datos.placas || "Unidad"} · ${datos.chofer || cierre.responsable}`}
                </h3>
              </div>
              <div className="captura-estado">
                <b>{tipo === 'caja' && esOwner ? (revisionDisponible ? etiquetasRevision[estadoRevisionCorte({ cierre }, revisiones[cierre.id])] : 'Estado de revisión sin confirmar') : 'Captura recibida'}</b>
                <small>{fechaLegible(cierre.fecha)}</small>
              </div>
            </header>

            {tipo === 'caja' && datos.responsableApertura && <p className="corte-responsables">Abrió: <b>{datos.responsableApertura}</b> · Cerró: <b>{datos.responsableCierre || cierre.responsable}</b></p>}
            {tipo === 'caja' && datos.responsableOriginal && datos.responsableOriginal !== cierre.responsable && <p className="corte-responsables">Registro original: <b>{datos.responsableOriginal}</b> · Corrección de Dirección conservada para auditoría.</p>}
            {tipo === 'caja' && datos.registroIncompleto && <p className="capturas-aviso"><b>Importe pendiente de aclaración.</b> Este cierre sí fue recibido, pero no guardó la venta total SICAR, cobros por método, efectivo contado ni fotografía. Solicita esos datos; MONYS no los sustituye por ceros.</p>}
            {tipo === 'caja' && esOwner && datos.registroIncompleto && <CompletarCorteIncompleto captura={{ tipo, datos, cierre }} usuario={usuario} onGuardado={cargar} />}
            {tipo === 'caja' && datos.complementoDireccion && <p className="capturas-aviso"><b>Corte completado por Dirección.</b> Los importes se agregaron con evidencia sin borrar el registro original. Completó: {datos.completadoPor || 'Dirección'}.</p>}

            <div className="corte-siguiente"><strong>{revisionDisponible && estadoRevisionCorte({ cierre }, revisiones[cierre.id]) === 'REVISADO' ? 'Revisión registrada; importes originales conservados' : diagnosticarCorte({ tipo, datos }).titulo}</strong><p>{diagnosticarCorte({ tipo, datos }).accion}</p></div>
            {tipo === 'caja' && esOwner && <RevisionCorteDiario captura={{ tipo, datos, cierre }} revision={revisiones[cierre.id]} disponible={revisionDisponible} onGuardado={r => setRevisiones(actual => ({ ...actual, [cierre.id]: r }))}/>}
            {tipo === "caja" ? (
              <>
                <div className="captura-grid">
                  <TarjetaDato titulo="Venta SICAR" valor={datos.ventaSicar} />
                  <TarjetaDato titulo="Cobrado" valor={datos.cobrado} />
                  <TarjetaDato titulo="Efectivo que quedó" valor={datos.efectivoFinal} />
                  <TarjetaDato titulo="Efectivo retirado / resguardado" valor={datos.efectivoEntregado} />
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
