import { useEffect, useMemo, useState } from "react";

import { supabase } from "../../../supabase";
import {
  guardarCierreTurno,
  subirFotoCorteCaja,
} from "../../inteligencia/services/cierresTurnoService";
import {
  crearObservacionesCorte,
  leerCorteCaja,
} from "../../inteligencia/utils/capturasFinancierasEquipo";
import {
  DESTINOS_EFECTIVO_RETIRADO,
  fechaOperativaMexico,
} from "../../inteligencia/utils/corteTienda";
import {
  construirCorteRecibidoDireccion,
  MOTIVOS_CORTE_RECIBIDO,
  validarCorteRecibidoDireccion,
} from "../utils/corteRecibidoDireccion";

const CAMPOS_DINERO = [
  ["ventaSicar", "Venta total SICAR"],
  ["efectivoVentas", "Venta cobrada en efectivo"],
  ["tarjeta", "Cobrado con tarjeta"],
  ["transferencias", "Cobrado por transferencia"],
  ["otrosCobros", "Otros métodos de cobro"],
  ["fondoInicial", "Fondo inicial real"],
  ["gastosCaja", "Otras salidas o gastos pagados desde caja"],
  ["efectivoEntregado", "Efectivo retirado o entregado"],
  ["efectivoFinal", "Efectivo que quedó en caja"],
];

function formularioVacio(fecha) {
  return {
    branchId: "",
    empleadoId: "",
    fecha,
    cajaId: "",
    motivo: "",
    detalleMotivo: "",
    ventaSicar: "",
    efectivoVentas: "",
    tarjeta: "",
    transferencias: "",
    otrosCobros: "",
    fondoInicial: "",
    gastosCaja: "",
    detalleGastosCaja: "",
    efectivoEntregado: "",
    efectivoFinal: "",
    destinoEfectivoRetirado: "",
    responsableEfectivoRetirado: "",
    detalleEfectivoRetirado: "",
  };
}
const estiloCampo = {
  width: "100%",
  minHeight: 46,
  padding: "10px 12px",
  border: "1px solid #d8c6d0",
  borderRadius: 11,
  background: "#fff",
  boxSizing: "border-box",
  fontSize: 16,
};

export default function CapturaCorteRecibido({
  usuario,
  sucursales = [],
  onGuardado,
}) {
  const fechaActual = fechaOperativaMexico();
  const [abierto, setAbierto] = useState(false);
  const [empleados, setEmpleados] = useState([]);
  const [formulario, setFormulario] = useState(() => formularioVacio(fechaActual));
  const [foto, setFoto] = useState(null);
  const [cargandoEquipo, setCargandoEquipo] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState("");
  const [mensaje, setMensaje] = useState("");

  const sucursalesDisponibles = useMemo(
    () =>
      (sucursales || []).filter(
        (sucursal) =>
          sucursal?.id &&
          (!sucursal.business_id || sucursal.business_id === usuario?.business_id)
      ),
    [sucursales, usuario?.business_id]
  );
  const empleadosSucursal = empleados.filter(
    (empleado) => empleado.branch_id === formulario.branchId
  );
  const sucursalElegida = sucursalesDisponibles.find(
    (sucursal) => sucursal.id === formulario.branchId
  );
  const esSucursalCentro = String(
    sucursalElegida?.nombre || sucursalElegida?.name || ""
  ).toLowerCase().includes("centro");
  const requiereDestino = Number(formulario.efectivoEntregado) > 0;
  const requiereDetalleGastos = Number(formulario.gastosCaja) > 0;

  useEffect(() => {
    if (!abierto || !sucursalesDisponibles.length) return undefined;
    let vigente = true;
    async function cargar() {
      setCargandoEquipo(true);
      setError("");
      const ids = sucursalesDisponibles.map((sucursal) => sucursal.id);
      const { data, error: fallo } = await supabase
        .from("empleados")
        .select("id,nombre,branch_id,active,responsabilidades")
        .in("branch_id", ids)
        .eq("active", true)
        .order("nombre", { ascending: true });
      if (!vigente) return;
      if (fallo) setError("No se pudo consultar el personal activo.");
      else setEmpleados(data || []);
      setCargandoEquipo(false);
    }
    cargar();
    return () => {
      vigente = false;
    };
  }, [abierto, sucursalesDisponibles]);

  function cambiar(campo, valor) {
    setFormulario((actual) => ({
      ...actual,
      [campo]: valor,
      ...(campo === "branchId" ? { empleadoId: "", cajaId: "" } : {}),
    }));
  }

  async function confirmar(evento) {
    evento.preventDefault();
    setError("");
    setMensaje("");
    const validacion = validarCorteRecibidoDireccion({
      formulario,
      foto,
      fechaActual,
    });
    if (validacion) {
      setError(validacion);
      return;
    }

    const empleado = empleados.find((item) => item.id === formulario.empleadoId);
    if (!empleado || empleado.branch_id !== formulario.branchId) {
      setError("La empleada no corresponde a la sucursal seleccionada.");
      return;
    }

    try {
      setGuardando(true);
      const { data: existentes, error: errorExistentes } = await supabase
        .from("cierres_turno")
        .select("id,observaciones")
        .eq("branch_id", formulario.branchId)
        .eq("fecha", formulario.fecha)
        .limit(100);
      if (errorExistentes) throw errorExistentes;
      const cajaOcupada = (existentes || []).some(
        (registro) => leerCorteCaja(registro.observaciones)?.cajaId === formulario.cajaId
      );
      if (cajaOcupada) {
        throw new Error(
          "Ya existe un corte de esa caja y fecha. Revísalo antes de registrar otro para evitar duplicar ventas."
        );
      }

      const evidencia = await subirFotoCorteCaja({
        archivo: foto,
        branchId: formulario.branchId,
      });
      const datos = construirCorteRecibidoDireccion({
        formulario,
        empleado,
        capturadoPor: usuario?.nombre,
        evidencia,
      });
      const cierre = await guardarCierreTurno({
        branchId: formulario.branchId,
        responsable: empleado.nombre,
        turno: "cierre_caja",
        incidencias: `Registro recibido por Dirección: ${formulario.detalleMotivo.trim()}`,
        observaciones: crearObservacionesCorte(
          datos,
          `Capturado por ${usuario?.nombre || "Dirección"} a partir de evidencia recibida. No fue enviado desde la cuenta de la empleada.`
        ),
        fecha: formulario.fecha,
      });
      setMensaje(`Corte registrado con folio ${cierre.id}. Quedó pendiente de revisión.`);
      setFormulario(formularioVacio(fechaActual));
      setFoto(null);
      onGuardado?.();
    } catch (fallo) {
      setError(fallo?.message || "No fue posible registrar el corte recibido.");
    } finally {
      setGuardando(false);
    }
  }

  if (!["owner", "admin"].includes(String(usuario?.role || "").toLowerCase())) {
    return null;
  }

  return (
    <section style={{ marginTop: 16, border: "1px solid #e3cfda", borderRadius: 16, overflow: "hidden" }}>
      <button
        type="button"
        onClick={() => setAbierto((actual) => !actual)}
        style={{ width: "100%", minHeight: 52, padding: "12px 16px", border: 0, background: abierto ? "#f7eaf1" : "#fff", color: "#7c3158", fontWeight: 850, textAlign: "left" }}
      >
        {abierto ? "− Cerrar captura extraordinaria" : "+ Registrar corte recibido por WhatsApp"}
      </button>
      {abierto && (
        <form onSubmit={confirmar} style={{ display: "grid", gap: 14, padding: 16, background: "#fffafd" }}>
          <div>
            <strong>Solo para recuperar un corte que la empleada no pudo enviar</strong>
            <p style={{ margin: "6px 0 0", lineHeight: 1.45 }}>Conserva quién hizo el corte y quién lo capturó en Dirección. No uses esta opción si el corte ya aparece recibido.</p>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(210px,1fr))", gap: 12 }}>
            <label>Sucursal
              <select required value={formulario.branchId} onChange={(e) => cambiar("branchId", e.target.value)} style={estiloCampo}>
                <option value="">Seleccionar…</option>
                {sucursalesDisponibles.map((sucursal) => <option key={sucursal.id} value={sucursal.id}>{sucursal.nombre || sucursal.name || "Sucursal"}</option>)}
              </select>
            </label>
            <label>Quién hizo el corte
              <select required disabled={!formulario.branchId || cargandoEquipo} value={formulario.empleadoId} onChange={(e) => cambiar("empleadoId", e.target.value)} style={estiloCampo}>
                <option value="">{cargandoEquipo ? "Consultando…" : "Seleccionar…"}</option>
                {empleadosSucursal.map((empleado) => <option key={empleado.id} value={empleado.id}>{empleado.nombre}</option>)}
              </select>
            </label>
            <label>Fecha real del corte
              <input required type="date" max={fechaActual} value={formulario.fecha} onChange={(e) => cambiar("fecha", e.target.value)} style={estiloCampo} />
            </label>
            <label>Caja
              <select required value={formulario.cajaId} onChange={(e) => cambiar("cajaId", e.target.value)} style={estiloCampo}>
                <option value="">Seleccionar…</option>
                <option value="CAJA_1">Caja 1</option>
                {esSucursalCentro && <option value="CAJA_2">Caja 2</option>}
              </select>
            </label>
            <label>Por qué no se envió
              <select required value={formulario.motivo} onChange={(e) => cambiar("motivo", e.target.value)} style={estiloCampo}>
                <option value="">Seleccionar…</option>
                {MOTIVOS_CORTE_RECIBIDO.map(([valor, etiqueta]) => <option key={valor} value={valor}>{etiqueta}</option>)}
              </select>
            </label>
          </div>
          <label>Explicación breve
            <textarea required maxLength={500} value={formulario.detalleMotivo} onChange={(e) => cambiar("detalleMotivo", e.target.value)} style={{ ...estiloCampo, minHeight: 80 }} placeholder="Ej. Katy hizo el corte de la mañana antes de recibir su acceso." />
          </label>
          <label>Foto original del corte SICAR
            <input required type="file" accept="image/*" capture="environment" onChange={(e) => setFoto(e.target.files?.[0] || null)} style={estiloCampo} />
          </label>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(210px,1fr))", gap: 12 }}>
            {CAMPOS_DINERO.map(([campo, etiqueta]) => <label key={campo}>{etiqueta}
              <input required type="number" min="0" step="0.01" inputMode="decimal" value={formulario[campo]} onChange={(e) => cambiar(campo, e.target.value)} style={estiloCampo} placeholder="0.00" />
            </label>)}
          </div>
          {requiereDetalleGastos && <label>¿En qué se usaron las otras salidas de caja?
            <input required maxLength={500} value={formulario.detalleGastosCaja} onChange={(e) => cambiar("detalleGastosCaja", e.target.value)} style={estiloCampo} placeholder="Concepto y persona que recibió" />
          </label>}
          {requiereDestino && <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(210px,1fr))", gap: 12, padding: 12, borderRadius: 12, background: "#fff5df" }}>
            <label>Destino del efectivo retirado
              <select required value={formulario.destinoEfectivoRetirado} onChange={(e) => cambiar("destinoEfectivoRetirado", e.target.value)} style={estiloCampo}>
                <option value="">Seleccionar…</option>
                {DESTINOS_EFECTIVO_RETIRADO.map(([valor, etiqueta]) => <option key={valor} value={valor}>{etiqueta}</option>)}
              </select>
            </label>
            <label>Quién lo recibió o resguarda
              <input required value={formulario.responsableEfectivoRetirado} onChange={(e) => cambiar("responsableEfectivoRetirado", e.target.value)} style={estiloCampo} />
            </label>
            <label>Referencia o explicación
              <input required value={formulario.detalleEfectivoRetirado} onChange={(e) => cambiar("detalleEfectivoRetirado", e.target.value)} style={estiloCampo} />
            </label>
          </div>}
          {error && <p role="alert" style={{ margin: 0, color: "#9f263c", fontWeight: 750 }}>{error}</p>}
          {mensaje && <p role="status" style={{ margin: 0, color: "#247148", fontWeight: 750 }}>{mensaje}</p>}
          <button type="submit" disabled={guardando} style={{ minHeight: 50, border: 0, borderRadius: 12, background: guardando ? "#baa8b1" : "#87375f", color: "#fff", fontWeight: 900 }}>
            {guardando ? "Registrando…" : "Registrar corte con auditoría"}
          </button>
        </form>
      )}
    </section>
  );
}
