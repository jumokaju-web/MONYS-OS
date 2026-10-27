import { useCallback, useEffect, useMemo, useState } from "react";
import { useUser } from "../../../context/UserContext";
import { obtenerCierresTurno } from "../../inteligencia/services/cierresTurnoService";
import { obtenerCreditosProveedoresActuales } from "../../inteligencia/services/creditosProveedoresService";
import { obtenerDeudasFinancieras } from "../../inteligencia/services/deudasFinancierasService";
import { obtenerCampanasMarketing } from "../../inteligencia/services/campanasMarketingService";
import { extraerCapturasFinancieras } from "../../inteligencia/utils/capturasFinancierasEquipo";
import { obtenerCuentasBancariasParaConfirmar } from "../../tesoreria/services/cuentasFinancierasService";
import { generarCompraMaestra } from "../services/compraMaestraService";
import { resumirCierreDiarioDireccion } from "../../finanzas/utils/cierreDiarioDireccion";
import { resumirDisponibilidadFinanciera } from "../../finanzas/utils/disponibilidadFinanciera";
import { resumirCortesOficialesParaDisponibilidad } from "../../finanzas/utils/disponibilidadCortesOficiales";
import { obtenerCortesCajaSicar } from "../../finanzas/services/cortesCajaSicarService";
import { construirCentroDireccionCEO, consolidarCreditosProveedores } from "../utils/centroDireccionCEO";
import PlanPagosComprasCEO from "./PlanPagosComprasCEO";
import "./CentroDireccionCEO.css";

const dinero = new Intl.NumberFormat("es-MX", {
  style: "currency",
  currency: "MXN",
  maximumFractionDigits: 0,
});

function TextoDinero({ valor, pendiente = "Por confirmar" }) {
  return <strong>{valor === null || valor === undefined ? pendiente : dinero.format(valor)}</strong>;
}

export default function CentroDireccionCEO({
  datosDashboard,
  sucursales = [],
  abrirFinanzas,
  abrirDirectorFinanciero,
  abrirCompraMaestra,
  abrirMarketing,
  abrirImportador,
}) {
  const { usuario } = useUser();
  const [datos, setDatos] = useState({ cargando: true, errores: [] });

  const organizationId = usuario?.organization_id || datosDashboard?.organization_id || null;
  const businessId = usuario?.business_id || datosDashboard?.business_id || null;
  const branchIds = useMemo(() => {
    const ids = sucursales.map((sucursal) => sucursal?.id || sucursal?.branch_id).filter(Boolean);
    const principal = usuario?.branch_id || datosDashboard?.branch_id;
    return [...new Set(principal ? [...ids, principal] : ids)];
  }, [datosDashboard?.branch_id, sucursales, usuario?.branch_id]);

  const cargar = useCallback(async () => {
    if (!organizationId) return;
    setDatos((actual) => ({ ...actual, cargando: true, errores: [] }));

    const proveedoresPromesa = Promise.allSettled(
      branchIds.map((branchId) => obtenerCreditosProveedoresActuales(branchId)),
    ).then((resultados) => consolidarCreditosProveedores(resultados, branchIds.length));

    const resultados = await Promise.allSettled([
      proveedoresPromesa,
      obtenerDeudasFinancieras({ organizationId, businessId }),
      obtenerCampanasMarketing({ organizationId, businessId }),
      generarCompraMaestra(),
      obtenerCuentasBancariasParaConfirmar({ organizationId, businessId }),
      obtenerCierresTurno({ branchId: null, limite: 100 }),
      obtenerCortesCajaSicar({ branchIds }),
    ]);

    const valor = (indice, respaldo) => resultados[indice].status === "fulfilled"
      ? resultados[indice].value
      : respaldo;
    const errores = resultados
      .filter((resultado) => resultado.status === "rejected")
      .map((resultado) => resultado.reason?.message || "Una fuente no respondió.");
    const proveedores = valor(0, {
      importacion: null,
      creditos: [],
      fuenteCompleta: false,
      sucursalesEsperadas: branchIds.length,
      sucursalesConReporte: 0,
    });
    const cuentas = valor(4, { cuentas: [] });
    const cierres = valor(5, []);
    const cierre = resumirCierreDiarioDireccion({
      capturas: extraerCapturasFinancieras(cierres),
      sucursales,
    });
    const proveedoresParaCaja = proveedores.fuenteCompleta
      ? proveedores
      : { ...proveedores, importacion: null };
    const cortesOficiales = resumirCortesOficialesParaDisponibilidad({
      importaciones: valor(6, []),
      cierre,
      hoy: cierre.fecha,
    });

    setDatos({
      cargando: false,
      errores,
      proveedores,
      deudas: valor(1, []),
      deudasConsultadas: resultados[1].status === "fulfilled",
      campanas: valor(2, []),
      campanasConsultadas: resultados[2].status === "fulfilled",
      compraMaestra: valor(3, null),
      compraConsultada: resultados[3].status === "fulfilled",
      disponibilidad: resumirDisponibilidadFinanciera({
        cuentas: cuentas?.cuentas || [],
        cierre,
        cortesOficiales,
        creditosProveedores: proveedoresParaCaja,
        deudasFinancieras: valor(1, []),
        deudasConsultadas: resultados[1].status === "fulfilled",
      }),
    });
  }, [branchIds, businessId, organizationId, sucursales]);

  useEffect(() => { cargar(); }, [cargar]);

  const resumen = useMemo(() => construirCentroDireccionCEO({
    disponibilidad: datos.disponibilidad,
    deudas: datos.deudas,
    deudasConsultadas: datos.deudasConsultadas,
    creditosProveedores: datos.proveedores,
    compraMaestra: datos.compraMaestra,
    compraConsultada: datos.compraConsultada,
    campanas: datos.campanas,
    campanasConsultadas: datos.campanasConsultadas,
    sucursales,
  }), [datos, sucursales]);

  const accionCompra = resumen.compra.estado === "datos" ? abrirImportador : abrirCompraMaestra;
  const primerPago = resumen.pagos.completo ? resumen.pagos.lista[0] : null;

  return (
    <section className="centro-ceo" aria-labelledby="centro-ceo-titulo">
      <header className="centro-ceo__header">
        <div>
          <span>DIRECCIÓN CEO · DECISIONES CON EVIDENCIA</span>
          <h2 id="centro-ceo-titulo">Qué pagar, qué comprar y qué conviene pausar</h2>
          <p>MONYS reúne caja, deudas, inventario y campañas. Recomienda; tú autorizas.</p>
        </div>
        <button type="button" onClick={cargar} disabled={datos.cargando}>
          {datos.cargando ? "Analizando…" : "Actualizar análisis"}
        </button>
      </header>

      <div className="centro-ceo__numeros">
        <article className={!resumen.deuda.completa ? "es-pendiente" : ""}>
          <small>CUÁNTO DEBO</small>
          <TextoDinero valor={resumen.deuda.completa ? resumen.deuda.identificada : null} />
          <p>{resumen.deuda.completa
            ? `${resumen.deuda.creditosActivos} créditos y ${resumen.deuda.proveedoresConSaldo} proveedores con saldo.`
            : `${dinero.format(resumen.deuda.identificada)} identificados; falta ${resumen.deuda.fuentesFaltantes.join(" y ") || "comprobar fuentes"}.`}</p>
          <button type="button" onClick={abrirDirectorFinanciero}>Ver deuda completa →</button>
        </article>

        <article className={resumen.dineroLibre === null ? "es-pendiente" : ""}>
          <small>DINERO LIBRE HOY</small>
          <TextoDinero valor={resumen.dineroLibre} />
          <p>{resumen.dineroLibre === null
            ? "Falta confirmar banco, todas las cajas y compromisos próximos."
            : "Disponible después de obligaciones comprobadas de los próximos 7 días."}</p>
          <button type="button" onClick={abrirFinanzas}>Comprobar dinero →</button>
        </article>

        <article className={resumen.pagos.vencidos ? "es-urgente" : ""}>
          <small>QUÉ PAGAR PRIMERO</small>
          <TextoDinero valor={resumen.pagos.completo && resumen.pagos.lista.length ? resumen.pagos.total7Dias : null} pendiente="Sin calendario completo" />
          <p>{primerPago
            ? `${primerPago.vencido ? "Vencido" : `Vence ${primerPago.fecha}`}: ${primerPago.nombre} · ${dinero.format(primerPago.monto)}.`
            : "Completa fechas y mensualidades; MONYS no confundirá falta de datos con cero deuda."}</p>
          <button type="button" onClick={abrirDirectorFinanciero}>Ordenar pagos →</button>
        </article>
      </div>

      <div className="centro-ceo__decisiones">
        <article className={`decision-ceo es-${resumen.compra.estado}`}>
          <div className="decision-ceo__icono">▦</div>
          <div>
            <small>QUÉ COMPRAR</small>
            <h3>{resumen.compra.titulo}</h3>
            <p>{resumen.compra.detalle}</p>
            {resumen.compra.inversion !== undefined && (
              <div className="decision-ceo__dato">
                Propuesta: {resumen.compra.piezas} piezas · {dinero.format(resumen.compra.inversion || 0)}
              </div>
            )}
            {resumen.compra.productos?.length > 0 && (
              <ul>{resumen.compra.productos.map((producto) => (
                <li key={producto.llave || producto.codigo || producto.descripcion}>
                  {producto.descripcion} · {producto.compraTotal} pzas.
                </li>
              ))}</ul>
            )}
            <button type="button" onClick={accionCompra}>
              {resumen.compra.estado === "datos" ? "Subir Ventas por artículo" : "Revisar Compra Maestra"} →
            </button>
          </div>
        </article>

        <article className={`decision-ceo es-${resumen.pausar.estado}`}>
          <div className="decision-ceo__icono">Ⅱ</div>
          <div>
            <small>QUÉ PAUSAR</small>
            <h3>{resumen.pausar.titulo}</h3>
            <p>{resumen.pausar.detalle}</p>
            {resumen.pausar.elementos?.length > 0 && (
              <ul>{resumen.pausar.elementos.slice(0, 3).map((elemento) => (
                <li key={elemento.id || elemento.nombre}>{elemento.nombre}</li>
              ))}</ul>
            )}
            <button type="button" onClick={abrirMarketing}>Revisar resultados →</button>
          </div>
        </article>

        <article className="decision-ceo es-crecer">
          <div className="decision-ceo__icono">↗</div>
          <div>
            <small>QUÉ HACER CRECER</small>
            <h3>{resumen.crecimiento
              ? `Subir 10% ${resumen.crecimiento.sucursal}`
              : "Definir una base real de crecimiento"}</h3>
            <p>{resumen.crecimiento
              ? `Meta del siguiente ciclo: ${dinero.format(resumen.crecimiento.meta10)}; incremento medible de ${dinero.format(resumen.crecimiento.aumento)}.`
              : "Carga ventas recientes de cada sucursal para fijar una meta alcanzable."}</p>
            {resumen.campanas.crecer.length > 0 && (
              <div className="decision-ceo__dato">Campaña con retorno comprobado: {resumen.campanas.crecer[0].nombre}</div>
            )}
            <button type="button" onClick={resumen.crecimiento ? abrirMarketing : abrirImportador}>
              {resumen.crecimiento ? "Abrir plan de crecimiento" : "Actualizar ventas"} →
            </button>
          </div>
        </article>
      </div>

      <PlanPagosComprasCEO
        disponibilidad={datos.disponibilidad}
        deudas={datos.deudas}
        deudasConsultadas={datos.deudasConsultadas}
        creditosProveedores={datos.proveedores}
        compraMaestra={datos.compraMaestra}
        compraConsultada={datos.compraConsultada}
        abrirDirectorFinanciero={abrirDirectorFinanciero}
        abrirCompraMaestra={abrirCompraMaestra}
      />

      <footer className="centro-ceo__pie">
        <span><b>REAL</b> cifras comprobadas</span>
        <span><b>PENDIENTE</b> fuente por completar</span>
        <span><b>RECOMENDACIÓN</b> requiere autorización de Mónica</span>
      </footer>
      {datos.errores?.length > 0 && (
        <p className="centro-ceo__error" role="alert">
          {datos.errores.length} fuente{datos.errores.length === 1 ? "" : "s"} no respondieron. Las decisiones relacionadas quedaron bloqueadas, no se mostraron como cero.
        </p>
      )}
    </section>
  );
}

