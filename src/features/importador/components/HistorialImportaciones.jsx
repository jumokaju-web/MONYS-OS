import { useEffect, useState } from "react";
import { supabase } from "../../../supabase";

const fechaCarga = (valor) => valor
  ? new Date(valor).toLocaleString("es-MX", { timeZone: "America/Mexico_City" })
  : "Por confirmar";

export default function HistorialImportaciones({ branchId, revision = 0, onAbrirConciliacion, onAbrirAbonos }) {
  const [filas, setFilas] = useState([]);
  const [error, setError] = useState("");
  const [cargando, setCargando] = useState(false);
  const [recarga, setRecarga] = useState(0);

  useEffect(() => {
    let activo = true;
    setFilas([]);
    setError("");
    setCargando(false);
    if (!branchId) return undefined;
    setCargando(true);
    (async () => {
      try {
        const { data: sesion, error: falloSesion } = await supabase.auth.getUser();
        if (falloSesion || !sesion?.user?.id) throw new Error("Inicia sesión para consultar las cargas.");
        const { data, error: fallo } = await supabase
          .from("importaciones")
          .select("id,tipo_reporte,archivo_original,estado,total_filas,created_at,branch_id")
          .eq("branch_id", branchId)
          .order("created_at", { ascending: false })
          .limit(30);
        if (fallo) throw new Error(fallo.message);
        if (activo) setFilas(data || []);
      } catch (e) {
        if (activo) setError(e.message);
      } finally {
        if (activo) setCargando(false);
      }
    })();
    return () => { activo = false; };
  }, [branchId, revision, recarga]);

  const accionDe = (fila) => {
    if (fila.estado !== "procesado") return null;
    if (fila.tipo_reporte === "Movimientos de caja") {
      return <button type="button" style={styles.actionButton} onClick={() => onAbrirConciliacion?.(fila)}>Revisar salidas por cheque</button>;
    }
    if (fila.tipo_reporte === "Abonos de proveedores") {
      return <button type="button" style={styles.actionButton} onClick={() => onAbrirAbonos?.(fila)}>Abrir abonos y enlazar cheques</button>;
    }
    return <span style={styles.noAction}>Sin revisión disponible</span>;
  };

  return <section style={styles.section} aria-label="Historial de cargas">
    <div style={styles.headingRow}>
      <div>
        <h2 style={styles.heading}>Tus últimas cargas</h2>
        <p style={styles.intro}>Archivos guardados de esta sucursal. Puedes volver a abrir una carga sin subir el archivo otra vez.</p>
      </div>
      <button type="button" style={styles.refreshButton} disabled={cargando || !branchId} onClick={() => setRecarga((valor) => valor + 1)}>
        {cargando ? "Actualizando…" : "Actualizar"}
      </button>
    </div>
    <p style={styles.note}>El estado de una carga no confirma que sus datos estén conciliados financieramente.</p>
    {!branchId ? <p>Selecciona una sucursal.</p>
      : cargando ? <p role="status">Consultando archivos guardados…</p>
        : error ? <p role="alert">No se pudo consultar el historial: {error}</p>
          : filas.length === 0 ? <p>No hay registros de importación en esta sucursal.</p>
            : <div style={styles.list}>{filas.map((fila) => <article key={fila.id} style={styles.card}>
              <div style={styles.cardTop}>
                <div style={styles.fileBlock}>
                  <strong style={styles.fileName}>{fila.archivo_original || "Nombre pendiente"}</strong>
                  <span style={styles.report}>{fila.tipo_reporte || "Reporte por identificar"}</span>
                </div>
                <span style={{ ...styles.status, ...(fila.estado === "procesado" ? styles.statusReady : {}) }}>
                  {fila.estado || "Por confirmar"}
                </span>
              </div>
              <div style={styles.metaGrid}>
                <div><span style={styles.metaLabel}>Filas guardadas</span><strong>{fila.total_filas ?? "Por confirmar"}</strong></div>
                <div><span style={styles.metaLabel}>Fecha de carga</span><strong>{fechaCarga(fila.created_at)}</strong></div>
              </div>
              <div style={styles.cardBottom}>
                <details style={styles.reference}>
                  <summary>Ver referencia</summary>
                  <code>{fila.id}</code>
                </details>
                {accionDe(fila)}
              </div>
            </article>)}</div>}
  </section>;
}

const styles = {
  section: { marginTop: 28, border: "1px solid #ead8e2", borderRadius: 16, padding: 20, background: "#fffafc", color: "#35232d" },
  headingRow: { display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16, flexWrap: "wrap" },
  heading: { color: "#5e3048", margin: "0 0 6px", fontSize: 22 },
  intro: { margin: 0, color: "#62545b", lineHeight: 1.5 },
  note: { margin: "14px 0 18px", padding: "10px 12px", borderRadius: 9, background: "#f5edf1", color: "#62545b", fontSize: 13 },
  refreshButton: { minHeight: 40, padding: "8px 16px", borderRadius: 9, border: "1px solid #cdb7c2", background: "white", color: "#5e3048", fontWeight: 700, cursor: "pointer" },
  list: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 330px), 1fr))", gap: 12 },
  card: { minWidth: 0, border: "1px solid #eadde4", borderRadius: 12, padding: 15, background: "#fff", boxShadow: "0 2px 8px rgba(94,48,72,.04)" },
  cardTop: { display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 },
  fileBlock: { minWidth: 0, display: "grid", gap: 5 },
  fileName: { overflowWrap: "anywhere", color: "#34242d", fontSize: 15 },
  report: { color: "#6c5360", fontSize: 13 },
  status: { flexShrink: 0, padding: "5px 9px", borderRadius: 999, background: "#f4edf1", color: "#62545b", fontSize: 12, fontWeight: 700 },
  statusReady: { background: "#e8f4ec", color: "#23643a" },
  metaGrid: { display: "grid", gridTemplateColumns: "1fr 1.5fr", gap: 10, margin: "15px 0", padding: "12px 0", borderTop: "1px solid #f0e8ec", borderBottom: "1px solid #f0e8ec" },
  metaLabel: { display: "block", marginBottom: 4, color: "#796b72", fontSize: 11 },
  cardBottom: { display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" },
  reference: { color: "#6c5360", fontSize: 12 },
  actionButton: { minHeight: 42, maxWidth: "100%", padding: "9px 14px", border: 0, borderRadius: 9, background: "#6d3553", color: "white", fontSize: 14, fontWeight: 700, whiteSpace: "normal", lineHeight: 1.3, cursor: "pointer" },
  noAction: { color: "#8b7c83", fontSize: 12 },
};
