import { useEffect, useMemo, useState } from "react";
import {
  construirResumenSocios,
  obtenerRutasFlotillaPeriodo,
} from "./services/flotillaService";

function fechaISO(fecha) {
  return [
    fecha.getFullYear(),
    String(fecha.getMonth() + 1).padStart(2, "0"),
    String(fecha.getDate()).padStart(2, "0"),
  ].join("-");
}

function periodoInicial() {
  const hasta = new Date();
  const desde = new Date(hasta);
  desde.setDate(desde.getDate() - 29);
  return { desde: fechaISO(desde), hasta: fechaISO(hasta) };
}

function numero(valor, decimales = 0) {
  return new Intl.NumberFormat("es-MX", {
    minimumFractionDigits: decimales,
    maximumFractionDigits: decimales,
  }).format(Number(valor) || 0);
}

export default function ResumenFlotillaSocios({ unidades = [] }) {
  const [periodo, setPeriodo] = useState(periodoInicial);
  const [rutas, setRutas] = useState([]);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let activo = true;

    async function cargar() {
      try {
        setCargando(true);
        setError("");
        const resultado = await obtenerRutasFlotillaPeriodo(periodo);
        if (activo) setRutas(resultado);
      } catch (errorConsulta) {
        if (activo) {
          setRutas([]);
          setError(errorConsulta?.message || "No fue posible consultar rutas.");
        }
      } finally {
        if (activo) setCargando(false);
      }
    }

    cargar();
    return () => {
      activo = false;
    };
  }, [periodo]);

  const resumen = useMemo(
    () => construirResumenSocios({ unidades, rutas, excluirRental: true }),
    [rutas, unidades]
  );

  return (
    <section
      style={{
        marginBottom: "16px",
        padding: "16px",
        borderRadius: "18px",
        background: "linear-gradient(145deg, #ffffff, #edf7ff)",
        border: "1px solid #c9deef",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", gap: "12px", flexWrap: "wrap" }}>
        <div>
          <div style={{ color: "#3975a6", fontSize: "12px", fontWeight: 900, letterSpacing: ".08em" }}>
            CONTROL DE SOCIOS · SIN RENTAL
          </div>
          <h2 style={{ margin: "5px 0 0", fontSize: "21px" }}>
            Distribución real de rutas
          </h2>
        </div>
        <span style={{ alignSelf: "flex-start", padding: "7px 10px", borderRadius: "999px", background: "#e9f8ef", color: "#267047", fontWeight: 850, fontSize: "12px" }}>
          Datos operativos
        </span>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px", marginTop: "14px" }}>
        <label style={{ fontSize: "12px", fontWeight: 800 }}>
          Desde
          <input type="date" value={periodo.desde} max={periodo.hasta} onChange={(evento) => setPeriodo((actual) => ({ ...actual, desde: evento.target.value }))} style={{ width: "100%", boxSizing: "border-box", marginTop: "5px", padding: "9px", border: "1px solid #c9deef", borderRadius: "9px" }} />
        </label>
        <label style={{ fontSize: "12px", fontWeight: 800 }}>
          Hasta
          <input type="date" value={periodo.hasta} min={periodo.desde} onChange={(evento) => setPeriodo((actual) => ({ ...actual, hasta: evento.target.value }))} style={{ width: "100%", boxSizing: "border-box", marginTop: "5px", padding: "9px", border: "1px solid #c9deef", borderRadius: "9px" }} />
        </label>
      </div>

      {error && <p role="alert" style={{ color: "#a02e2e", fontWeight: 750 }}>{error}</p>}
      {cargando && <p role="status">Calculando rutas reales por socio…</p>}

      {!cargando && !error && resumen.length === 0 && (
        <p style={{ color: "#65798b" }}>No hay unidades MLP o rutas visibles para este periodo.</p>
      )}

      {!cargando && resumen.length > 0 && (
        <div style={{ display: "grid", gap: "10px", marginTop: "14px" }}>
          {resumen.map((socio) => (
            <article key={socio.socio} style={{ padding: "13px", borderRadius: "13px", background: "#fff", border: "1px solid #d5e5f1" }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: "10px" }}>
                <strong>{socio.socio}</strong>
                <strong>{numero(socio.rutasPorUnidad, 2)} rutas/unidad</strong>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "6px", marginTop: "10px", textAlign: "center" }}>
                <div><small>Unidades</small><strong style={{ display: "block" }}>{socio.unidades}</strong></div>
                <div><small>Rutas</small><strong style={{ display: "block" }}>{socio.rutas}</strong></div>
                <div><small>Participación</small><strong style={{ display: "block" }}>{numero(socio.participacionRutas, 1)}%</strong></div>
                <div><small>Paquetes/ruta</small><strong style={{ display: "block" }}>{socio.paquetesPromedio === null ? "Sin dato" : numero(socio.paquetesPromedio, 1)}</strong></div>
              </div>
            </article>
          ))}
        </div>
      )}

      <p style={{ margin: "13px 0 0", color: "#66798b", fontSize: "11px", lineHeight: 1.5 }}>
        Este tablero compara carga operativa ajustada por número de unidades. No calcula ganancia ni demuestra favoritismo por sí solo: para eso faltan pago real por ruta, gastos y peso confirmado.
      </p>
    </section>
  );
}
