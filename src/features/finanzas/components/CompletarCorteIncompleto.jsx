import { useState } from "react";
import {
  guardarCierreTurno,
  subirFotoCorteCaja,
} from "../../inteligencia/services/cierresTurnoService";
import {
  crearObservacionesComplementoCierre,
  FONDO_FIJO_CAJA,
} from "../../inteligencia/utils/capturasFinancierasEquipo";
import { validarCierreCajaParaEnvio } from "../../inteligencia/utils/corteTienda";

const campos = [
  ["ventaSicar", "Venta total SICAR"],
  ["efectivoVentas", "Ventas en efectivo"],
  ["tarjeta", "Cobros con tarjeta"],
  ["transferencias", "Transferencias"],
  ["otrosCobros", "Otros cobros"],
  ["fondoInicial", "Fondo inicial"],
  ["efectivoEntregado", "Efectivo retirado"],
  ["efectivoFinal", "Efectivo que quedó en caja"],
];

const formularioInicial = Object.fromEntries(campos.map(([nombre]) => [
  nombre,
  nombre === "fondoInicial" ? String(FONDO_FIJO_CAJA) : "",
]));

export default function CompletarCorteIncompleto({ captura, usuario, onGuardado }) {
  const [abierto, setAbierto] = useState(false);
  const [formulario, setFormulario] = useState(formularioInicial);
  const [foto, setFoto] = useState(null);
  const [nota, setNota] = useState("");
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState("");
  const { cierre, datos } = captura;

  async function guardar(evento) {
    evento.preventDefault();
    setError("");
    const responsable = String(usuario?.nombre || "").trim();
    const validacion = validarCierreCajaParaEnvio({
      responsable,
      branchId: cierre.branch_id,
      cajaId: datos.cajaId,
      corteSinApertura: true,
      fotoCorte: foto,
      formulario,
    });
    if (validacion) { setError(validacion); return; }

    try {
      setGuardando(true);
      const evidencia = await subirFotoCorteCaja({ archivo: foto, branchId: cierre.branch_id });
      await guardarCierreTurno({
        branchId: cierre.branch_id,
        responsable,
        turno: "complemento_cierre",
        fecha: cierre.fecha,
        observaciones: crearObservacionesComplementoCierre({
          cierreId: cierre.id,
          cajaId: datos.cajaId,
          cajaNombre: datos.cajaNombre,
          responsableCierre: cierre.responsable,
          completadoPor: responsable,
          fotoCorteUrl: evidencia.archivoUrl,
          fotoCortePath: evidencia.archivoPath,
          movimientosCaja: [],
          ...Object.fromEntries(Object.entries(formulario).map(([clave, valor]) => [clave, Number(valor)])),
        }, nota),
      });
      setAbierto(false);
      await onGuardado?.();
    } catch (e) {
      setError(e?.message || "No fue posible completar el corte.");
    } finally {
      setGuardando(false);
    }
  }

  if (!abierto) {
    return <button className="completar-corte-abrir" type="button" onClick={() => setAbierto(true)}>Completar corte incompleto →</button>;
  }

  return (
    <form className="completar-corte" onSubmit={guardar}>
      <div className="completar-corte-cabecera">
        <div><span>ACLARACIÓN DE DIRECCIÓN</span><h4>Completar importes del corte</h4></div>
        <button type="button" onClick={() => setAbierto(false)} disabled={guardando}>Cerrar</button>
      </div>
      <p>Captura exactamente lo que aparece en SICAR y el efectivo contado. El registro original se conservará.</p>
      <label className="completar-corte-foto">Foto del reporte SICAR
        <input required type="file" accept="image/*" capture="environment" onChange={e => setFoto(e.target.files?.[0] || null)} />
        <small>{foto ? `Lista: ${foto.name}` : "Obligatoria para comprobar los importes"}</small>
      </label>
      <div className="completar-corte-grid">
        {campos.map(([nombre, etiqueta]) => <label key={nombre}>{etiqueta}<input required type="number" inputMode="decimal" min="0" step="0.01" value={formulario[nombre]} onChange={e => setFormulario(actual => ({ ...actual, [nombre]: e.target.value }))} placeholder="$0.00" /></label>)}
      </div>
      <label>Nota de aclaración (opcional)<textarea rows="2" value={nota} onChange={e => setNota(e.target.value)} placeholder="Ej. Importes tomados del reporte de cierre enviado por Karla" /></label>
      {error && <p className="completar-corte-error" role="alert">{error}</p>}
      <button className="completar-corte-guardar" type="submit" disabled={guardando}>{guardando ? "Guardando y comprobando…" : "Guardar importes y actualizar Finanzas"}</button>
    </form>
  );
}
