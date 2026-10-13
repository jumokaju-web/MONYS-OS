import { useEffect, useState } from "react";
import {
  generarCodigoActivacionChofer,
  obtenerUnidadesParaAcceso,
} from "./services/operacionFlotilla";

const caja = {
  background: "#fff",
  border: "1px solid #d5e5f1",
  borderRadius: 12,
  padding: 12,
};

export default function FlotillaAccesosChofer() {
  const [unidades, setUnidades] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [generando, setGenerando] = useState("");
  const [codigoVisible, setCodigoVisible] = useState(null);
  const [mensaje, setMensaje] = useState("");

  useEffect(() => {
    let vigente = true;
    obtenerUnidadesParaAcceso()
      .then((datos) => { if (vigente) setUnidades(datos); })
      .catch((error) => { if (vigente) setMensaje(error?.message || "No fue posible cargar los accesos."); })
      .finally(() => { if (vigente) setCargando(false); });
    return () => { vigente = false; };
  }, []);

  async function generar(unidad) {
    try {
      setGenerando(unidad.id);
      setCodigoVisible(null);
      setMensaje("");
      const resultado = await generarCodigoActivacionChofer(unidad.id);
      setCodigoVisible({ ...resultado, placas: unidad.placas, chofer: unidad.chofer_nombre });
    } catch (error) {
      setMensaje(error?.message || "No fue posible generar el código.");
    } finally {
      setGenerando("");
    }
  }

  async function copiarCodigo() {
    if (!codigoVisible?.codigo) return;
    try {
      await navigator.clipboard.writeText(codigoVisible.codigo);
      setMensaje("Código copiado. Envíalo únicamente al chofer asignado.");
    } catch {
      setMensaje("Mantén presionado el código para copiarlo.");
    }
  }

  return (
    <section style={{ ...caja, marginTop: 16, background: "#f7fbff" }}>
      <small style={{ color: "#3975a6", fontWeight: 900 }}>ACCESO DE CHOFERES</small>
      <h3 style={{ margin: "5px 0" }}>Códigos personales por unidad</h3>
      <p style={{ marginTop: 0, color: "#5e7182", fontSize: 12 }}>
        Cada código funciona una sola vez, vence en 7 días y reemplaza cualquier código anterior de esa unidad.
      </p>

      {cargando && <p role="status">Cargando unidades…</p>}
      {mensaje && <p role="status" style={{ color: mensaje.startsWith("Código copiado") ? "#247044" : "#8b3b2e", fontWeight: 750 }}>{mensaje}</p>}

      {codigoVisible && <div style={{ ...caja, borderColor: "#77b790", background: "#effbf3", marginBottom: 12 }}>
        <b>{codigoVisible.chofer} · {codigoVisible.placas}</b>
        <code style={{ display: "block", margin: "9px 0", fontSize: 22, letterSpacing: 2, fontWeight: 900 }}>{codigoVisible.codigo}</code>
        <button type="button" onClick={copiarCodigo}>Copiar código</button>
        <small style={{ display: "block", marginTop: 7 }}>Se muestra solamente ahora. No lo publiques en grupos.</small>
      </div>}

      <div style={{ display: "grid", gap: 8 }}>
        {unidades.map((unidad) => <div key={unidad.id} style={{ ...caja, display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          <div>
            <strong>{unidad.chofer_nombre || "Sin chofer"}</strong>
            <small style={{ display: "block", color: "#65798b" }}>{unidad.placas} · {unidad.tipo_pago_chory || unidad.tipo_operacion || "Sin tipo"}</small>
          </div>
          {unidad.chofer_auth_user_id
            ? <b style={{ color: "#247044" }}>✓ Activado</b>
            : <button type="button" disabled={!unidad.chofer_nombre || generando === unidad.id} onClick={() => generar(unidad)}>
              {generando === unidad.id ? "Generando…" : "Crear código"}
            </button>}
        </div>)}
      </div>
    </section>
  );
}
