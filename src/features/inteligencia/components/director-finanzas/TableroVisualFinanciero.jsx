import { construirComparativoSucursales } from "../../shared/resumenSucursalesFinanciero.js";

const PALETA = {
  vino: "#64143f",
  rosa: "#d22b78",
  rosaClaro: "#f6b4d2",
  verde: "#2c7a57",
  verdeClaro: "#b9e5ce",
  dorado: "#c28a24",
  gris: "#88747e",
  rojo: "#b83d4a",
};

function numero(valor) {
  const convertido = Number(valor);
  return Number.isFinite(convertido) ? convertido : 0;
}

function dinero(valor) {
  return new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency: "MXN",
    maximumFractionDigits: 0,
  }).format(numero(valor));
}

function porcentaje(valor) {
  return `${numero(valor).toFixed(1)}%`;
}

function Barra({ etiqueta, valor, maximo, color, detalle }) {
  const ancho = maximo > 0 ? Math.max(2, Math.min(100, (Math.abs(numero(valor)) / maximo) * 100)) : 0;

  return (
    <div style={{ marginBottom: 13 }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "baseline" }}>
        <span style={{ color: "#5d4852", fontWeight: 760 }}>{etiqueta}</span>
        <strong style={{ color: "#2f1823" }}>{detalle || dinero(valor)}</strong>
      </div>
      <div style={{ height: 11, marginTop: 7, borderRadius: 999, overflow: "hidden", background: "#f1e6eb" }}>
        <div style={{ width: `${ancho}%`, height: "100%", borderRadius: 999, background: color, transition: "width .35s ease" }} />
      </div>
    </div>
  );
}

function MensajeSinDatos({ texto }) {
  return (
    <div style={{ padding: 18, borderRadius: 14, background: "#fffaf0", border: "1px dashed #dbbd83", color: "#73551e", lineHeight: 1.5 }}>
      <strong>Esperando datos reales.</strong> {texto}
    </div>
  );
}

export default function TableroVisualFinanciero({
  ventas = 0,
  costos = 0,
  utilidadBruta = 0,
  gastosFijos = 0,
  gastosVariables = 0,
  gastosSinClasificar = 0,
  utilidadNeta = 0,
  margenBruto = 0,
  margenNeto = 0,
  puntoEquilibrio = 0,
  entradas = 0,
  salidas = 0,
  disponible = 0,
  reserva = 0,
  movimientosPendientes = 0,
  vencimientos = [],
  sucursales = [],
  baseVigente = false,
  fechaCorte = null,
}) {
  const hayVentas = numero(ventas) > 0;
  const gastosOperativos = numero(gastosFijos) + numero(gastosVariables) + numero(gastosSinClasificar);
  const maxResultados = Math.max(numero(ventas), numero(costos), Math.abs(numero(utilidadBruta)), gastosOperativos, Math.abs(numero(utilidadNeta)), 1);
  const maxFlujo = Math.max(numero(entradas), numero(salidas), Math.abs(numero(disponible)), numero(reserva), 1);
  const punto = numero(puntoEquilibrio);
  const avanceEquilibrio = punto > 0 ? (numero(ventas) / punto) * 100 : 0;
  const faltanteEquilibrio = punto > numero(ventas) ? punto - numero(ventas) : 0;
  const maxVencimiento = Math.max(...vencimientos.map((item) => numero(item.valor)), 1);
  const sucursalesResumen = construirComparativoSucursales(sucursales);
  const sucursalesValidas = sucursalesResumen.filter((sucursal) => sucursal.ventas !== null && sucursal.ventas > 0);
  const maxSucursal = Math.max(...sucursalesValidas.map((sucursal) => sucursal.ventas), 1);
  const sucursalMayorVenta = [...sucursalesValidas].sort((a, b) => b.ventas - a.ventas)[0] || null;
  const sucursalMayorUtilidad = [...sucursalesValidas]
    .filter((sucursal) => sucursal.utilidadBruta !== null)
    .sort((a, b) => b.utilidadBruta - a.utilidadBruta)[0] || null;
  const sucursalMayorMargen = [...sucursalesValidas]
    .filter((sucursal) => sucursal.margenBruto !== null)
    .sort((a, b) => b.margenBruto - a.margenBruto)[0] || null;

  const lecturaPrioritaria = !hayVentas
    ? "Sube ventas y costos para iniciar el diagnóstico."
    : numero(movimientosPendientes) > 0
      ? `Clasifica ${movimientosPendientes} movimientos antes de decidir cuánto dinero está disponible.`
      : punto > 0 && avanceEquilibrio < 100
        ? `Faltan ${dinero(faltanteEquilibrio)} en ventas para cubrir el punto de equilibrio del periodo.`
        : numero(utilidadNeta) < 0
          ? "Hay venta, pero los gastos consumen el margen. Revisa primero las salidas controlables."
          : "La operación cubre el punto de equilibrio; protege la reserva antes de comprometer efectivo.";

  return (
    <section style={{ marginTop: 22, padding: 22, borderRadius: 22, border: "1px solid #e5cfda", background: "linear-gradient(150deg, #fff 0%, #fff7fb 100%)", boxShadow: "0 18px 45px rgba(82, 20, 53, .07)" }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 14, alignItems: "flex-start", flexWrap: "wrap" }}>
        <div>
          <p style={{ margin: 0, color: PALETA.rosa, fontWeight: 900, letterSpacing: ".09em", fontSize: 13 }}>RADIOGRAFÍA VISUAL</p>
          <h3 style={{ margin: "7px 0", fontSize: 25, color: "#2e1722" }}>📊 ¿Dónde está el dinero?</h3>
          <p style={{ margin: 0, color: "#74616a", lineHeight: 1.5 }}>Ventas, utilidad, equilibrio, liquidez y compromisos en una sola vista.</p>
        </div>
        <span style={{ padding: "8px 12px", borderRadius: 999, fontWeight: 850, background: baseVigente ? "#e6f6ed" : "#fff1cd", color: baseVigente ? PALETA.verde : "#7b5711" }}>
          {baseVigente ? "● Datos vigentes" : "⚠ Actualización pendiente"}{fechaCorte ? ` · ${fechaCorte}` : ""}
        </span>
      </div>

      <div style={{ marginTop: 17, padding: 16, borderRadius: 15, background: "linear-gradient(135deg, #64143f, #a51f63)", color: "#fff" }}>
        <small style={{ display: "block", opacity: .8, fontWeight: 850, letterSpacing: ".07em" }}>LECTURA PRIORITARIA</small>
        <strong style={{ display: "block", marginTop: 6, fontSize: 18, lineHeight: 1.45 }}>{lecturaPrioritaria}</strong>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(270px, 1fr))", gap: 15, marginTop: 16 }}>
        <article style={{ padding: 18, borderRadius: 17, background: "#fff", border: "1px solid #eadce3" }}>
          <h4 style={{ margin: "0 0 15px", color: PALETA.vino, fontSize: 18 }}>Estado de resultados</h4>
          {!hayVentas ? <MensajeSinDatos texto="La gráfica aparecerá al cargar el reporte de ventas por artículo." /> : (
            <>
              <Barra etiqueta="Ventas" valor={ventas} maximo={maxResultados} color={PALETA.rosa} />
              <Barra etiqueta="Costo de mercancía" valor={costos} maximo={maxResultados} color={PALETA.dorado} />
              <Barra etiqueta="Utilidad bruta" valor={utilidadBruta} maximo={maxResultados} color={PALETA.rosaClaro} detalle={`${dinero(utilidadBruta)} · ${porcentaje(margenBruto)}`} />
              <Barra etiqueta="Gastos operativos" valor={gastosOperativos} maximo={maxResultados} color={PALETA.gris} />
              <Barra etiqueta="Utilidad neta estimada" valor={utilidadNeta} maximo={maxResultados} color={numero(utilidadNeta) >= 0 ? PALETA.verde : PALETA.rojo} detalle={`${dinero(utilidadNeta)} · ${porcentaje(margenNeto)}`} />
            </>
          )}
        </article>

        <article style={{ padding: 18, borderRadius: 17, background: "#fff", border: "1px solid #eadce3" }}>
          <h4 style={{ margin: "0 0 15px", color: PALETA.vino, fontSize: 18 }}>Punto de equilibrio</h4>
          {punto <= 0 ? <MensajeSinDatos texto="Necesitamos clasificar gastos fijos y conocer el margen real." /> : (
            <>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "end" }}>
                <div><small style={{ color: "#7b6871" }}>Ventas actuales</small><strong style={{ display: "block", fontSize: 22 }}>{dinero(ventas)}</strong></div>
                <div style={{ textAlign: "right" }}><small style={{ color: "#7b6871" }}>Meta mínima</small><strong style={{ display: "block", fontSize: 22 }}>{dinero(punto)}</strong></div>
              </div>
              <div style={{ height: 22, marginTop: 18, borderRadius: 999, overflow: "hidden", background: "#f0e4ea", position: "relative" }}>
                <div style={{ width: `${Math.min(100, Math.max(0, avanceEquilibrio))}%`, height: "100%", background: avanceEquilibrio >= 100 ? PALETA.verde : `linear-gradient(90deg, ${PALETA.rosa}, ${PALETA.rosaClaro})` }} />
              </div>
              <strong style={{ display: "block", marginTop: 10, textAlign: "center", color: avanceEquilibrio >= 100 ? PALETA.verde : PALETA.vino }}>{porcentaje(avanceEquilibrio)} cubierto</strong>
              <p style={{ margin: "12px 0 0", color: "#75616b", lineHeight: 1.45 }}>{avanceEquilibrio >= 100 ? `Superávit sobre equilibrio: ${dinero(numero(ventas) - punto)}.` : `Faltante para no perder: ${dinero(faltanteEquilibrio)}.`}</p>
            </>
          )}
        </article>

        <article style={{ padding: 18, borderRadius: 17, background: "#fff", border: "1px solid #eadce3" }}>
          <h4 style={{ margin: "0 0 15px", color: PALETA.vino, fontSize: 18 }}>Flujo y dinero protegido</h4>
          {numero(entradas) === 0 && numero(salidas) === 0 ? <MensajeSinDatos texto="Carga o clasifica movimientos bancarios para separar entradas y salidas." /> : (
            <>
              <Barra etiqueta="Entradas" valor={entradas} maximo={maxFlujo} color={PALETA.verde} />
              <Barra etiqueta="Salidas" valor={salidas} maximo={maxFlujo} color={PALETA.rojo} />
              <Barra etiqueta="Flujo disponible" valor={disponible} maximo={maxFlujo} color={numero(disponible) >= 0 ? PALETA.rosa : PALETA.rojo} />
              <Barra etiqueta="Reserva recomendada" valor={reserva} maximo={maxFlujo} color={PALETA.dorado} />
              {numero(movimientosPendientes) > 0 && <p style={{ margin: "8px 0 0", color: "#8b5c0a", fontWeight: 780 }}>⚠ {movimientosPendientes} movimientos todavía no están clasificados.</p>}
            </>
          )}
        </article>

        <article style={{ padding: 18, borderRadius: 17, background: "#fff", border: "1px solid #eadce3" }}>
          <h4 style={{ margin: "0 0 15px", color: PALETA.vino, fontSize: 18 }}>Pagos próximos acumulados</h4>
          {vencimientos.every((item) => numero(item.valor) === 0) ? <MensajeSinDatos texto="Sube créditos de proveedores y registra las fechas de pago." /> : vencimientos.map((item, indice) => (
            <Barra key={item.etiqueta} etiqueta={item.etiqueta} valor={item.valor} maximo={maxVencimiento} color={[PALETA.rojo, "#d9654d", PALETA.dorado, PALETA.rosaClaro, PALETA.verdeClaro][indice]} />
          ))}
          <small style={{ color: "#837079" }}>Cada plazo incluye los compromisos de los plazos anteriores.</small>
        </article>
      </div>

      <article style={{ marginTop: 15, padding: 18, borderRadius: 17, background: "#fff", border: "1px solid #eadce3" }}>
        <h4 style={{ margin: "0 0 8px", color: PALETA.vino, fontSize: 18 }}>Comparativo financiero por sucursal</h4>
        <p style={{ margin: "0 0 14px", color: "#75616b", fontSize: 13, lineHeight: 1.5 }}>Ventas, costo de mercancía y utilidad bruta según la última información importada.</p>
        {sucursalesValidas.length === 0 ? <MensajeSinDatos texto="La comparación se habilitará cuando existan ventas y utilidad registradas por sucursal." /> : (
          <>
            {sucursalesValidas.length > 1 && (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))", gap: 9, marginBottom: 13 }}>
                {[
                  ["Mayor venta", sucursalMayorVenta, sucursalMayorVenta?.ventas],
                  ["Mayor utilidad bruta", sucursalMayorUtilidad, sucursalMayorUtilidad?.utilidadBruta],
                  ["Mayor margen bruto", sucursalMayorMargen, sucursalMayorMargen?.margenBruto, true],
                ].filter(([, sucursal]) => Boolean(sucursal)).map(([etiqueta, sucursal, valor, esPorcentaje]) => (
                  <div key={etiqueta} style={{ padding: 11, borderRadius: 12, background: "#fff7fb", border: "1px solid #efdae4" }}>
                    <small style={{ display: "block", color: "#735d68" }}>{etiqueta}</small>
                    <strong style={{ display: "block", marginTop: 3, color: "#442333" }}>{sucursal.nombre} · {esPorcentaje ? porcentaje(valor) : dinero(valor)}</strong>
                  </div>
                ))}
              </div>
            )}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(230px, 1fr))", gap: 12 }}>
              {sucursalesValidas.map((sucursal) => (
                <div key={sucursal.id} style={{ padding: 15, borderRadius: 14, background: "#fff8fb", border: "1px solid #efdae4" }}>
                  <strong style={{ color: "#442333" }}>{sucursal.nombre}</strong>
                  <Barra etiqueta="Ventas" valor={sucursal.ventas} maximo={maxSucursal} color={PALETA.rosa} />
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginTop: 8 }}>
                    <div><small style={{ display: "block", color: "#735d68" }}>Costo de mercancía</small><strong>{sucursal.costoMercancia === null ? "Sin dato" : dinero(sucursal.costoMercancia)}</strong></div>
                    <div><small style={{ display: "block", color: "#735d68" }}>Utilidad bruta SICAR</small><strong>{sucursal.utilidadBruta === null ? "Sin dato" : dinero(sucursal.utilidadBruta)}</strong></div>
                    <div><small style={{ display: "block", color: "#735d68" }}>Margen bruto</small><strong>{sucursal.margenBruto === null ? "Sin dato" : porcentaje(sucursal.margenBruto)}</strong></div>
                  </div>
                  {sucursal.costoInconsistente && <p role="alert" style={{ margin: "10px 0 0", color: PALETA.rojo, fontWeight: 750 }}>Revisar importación: la utilidad supera las ventas registradas.</p>}
                </div>
              ))}
            </div>
            <p style={{ margin: "12px 0 0", color: "#75616b", fontSize: 12, lineHeight: 1.5 }}>La utilidad bruta todavía no descuenta nómina, renta, servicios ni otros gastos. Confirma que ambas sucursales tengan el mismo periodo antes de compararlas.</p>
          </>
        )}
      </article>

      <p style={{ margin: "15px 0 0", color: "#7c6872", fontSize: 13, lineHeight: 1.5 }}>Estas gráficas describen información registrada. No pronostican ventas futuras ni autorizan pagos, compras o gasto.</p>
    </section>
  );
}
