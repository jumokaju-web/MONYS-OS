import { useMemo, useState } from "react";
import { useUser } from "../../../context/UserContext";
import { notificarImportacionesActualizadas } from "../../../core/events/importacionesActualizadas";
import { confirmarCeroCreditosProveedores } from "../../inteligencia/services/creditosProveedoresService";

function hoyMexico() {
  const partes = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Mexico_City", year: "numeric", month: "2-digit", day: "2-digit",
  }).formatToParts(new Date());
  const tomar = (tipo) => partes.find((parte) => parte.type === tipo)?.value;
  return `${tomar("year")}-${tomar("month")}-${tomar("day")}`;
}

export default function ConfirmarCeroCreditos({ sucursales = [] }) {
  const { usuario } = useUser();
  const role = String(usuario?.role || "").toLowerCase();
  const permitidos = ["owner", "admin", "director", "finanzas", "compras"];
  const opciones = useMemo(() => sucursales.filter((sucursal) =>
    sucursal?.id && (!usuario?.business_id || sucursal.business_id === usuario.business_id)
  ), [sucursales, usuario?.business_id]);
  const sucursalAnaya = opciones.find((sucursal) => /general\s*anaya/i.test(sucursal.name || sucursal.nombre || ""));
  const [branchId, setBranchId] = useState(sucursalAnaya?.id || usuario?.branch_id || opciones[0]?.id || "");
  const [fechaCorte, setFechaCorte] = useState(hoyMexico);
  const [nota, setNota] = useState("");
  const [guardando, setGuardando] = useState(false);
  const [mensaje, setMensaje] = useState("");
  const [error, setError] = useState("");

  if (!permitidos.includes(role)) return null;

  async function guardar(evento) {
    evento.preventDefault();
    setGuardando(true);
    setError("");
    setMensaje("");
    try {
      await confirmarCeroCreditosProveedores({ branchId, fechaCorte, nota });
      setMensaje("Confirmación guardada con fecha y responsable. Es válida durante 7 días.");
      setNota("");
      notificarImportacionesActualizadas();
    } catch (fallo) {
      setError(fallo?.message || "No se pudo guardar la confirmación.");
    } finally {
      setGuardando(false);
    }
  }

  return <form onSubmit={guardar} style={{ margin: "16px 0", padding: 18, border: "1px solid #e8ccd8", borderRadius: 14, background: "#fff8fb" }}>
    <h3 style={{ marginTop: 0 }}>Confirmar sucursal sin créditos de proveedores</h3>
    <p>Guarda un saldo cero con sucursal, fecha, responsable y motivo. No crea una importación SICAR ni modifica saldos anteriores.</p>
    <label style={{ display: "block", marginBottom: 10 }}>Sucursal
      <select aria-label="Sucursal sin créditos" value={branchId} onChange={(evento) => setBranchId(evento.target.value)} required>
        <option value="" disabled>Selecciona una sucursal</option>
        {opciones.map((sucursal) => <option key={sucursal.id} value={sucursal.id}>{sucursal.name || sucursal.nombre}</option>)}
      </select>
    </label>
    <label style={{ display: "block", marginBottom: 10 }}>Fecha del saldo confirmado
      <input aria-label="Fecha del saldo cero" type="date" value={fechaCorte} max={hoyMexico()} onChange={(evento) => setFechaCorte(evento.target.value)} required />
    </label>
    <label style={{ display: "block", marginBottom: 10 }}>Cómo se confirmó
      <input aria-label="Evidencia de saldo cero" value={nota} onChange={(evento) => setNota(evento.target.value)} placeholder="Ej. Revisé SICAR y confirmé que no hay saldos" required />
    </label>
    <button type="submit" disabled={guardando || !branchId || !nota.trim()}>{guardando ? "Guardando…" : "Confirmar que el saldo es $0"}</button>
    {mensaje && <p role="status">{mensaje}</p>}
    {error && <p role="alert">{error}</p>}
  </form>;
}
