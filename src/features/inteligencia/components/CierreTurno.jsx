import { validarImportesCorte } from '../utils/corteTienda';
import { claveBorradorCorte, guardarBorradorCorte, leerBorradorCorte, tieneCapturaBorrador } from '../utils/borradorCorte';
import CapturaDemanda from '../../valor/CapturaDemanda';
import {
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import {
  guardarCierreTurno,
  obtenerCierresTurno,
  analizarCierreTurnoIA,
  analizarPatronesCierresIA,
  subirFotoCorteCaja,
} from "../services/cierresTurnoService";

import {
  convertirPatronesEnPrioridades,
} from "../services/patronesOperativosService";

import {
  crearTareasAutomaticasDesdePatrones,
} from "../services/tareasOperativasService";
import {
  calcularCorteCaja,
  crearObservacionesAperturaCaja,
  crearObservacionesCorreccionCierre,
  crearObservacionesCorte,
  FONDO_FIJO_CAJA,
  indexarCorreccionesCierres,
  leerAperturaCaja,
  leerCorreccionCierre,
  leerCorteCaja,
  leerLiquidacionFlotilla,
  obtenerSesionCajaActiva,
} from "../utils/capturasFinancierasEquipo";

const formularioInicial = {
  responsable: "",
  turno: "cierre_caja",
  pendientes: "",
  incidencias: "",
  productosSolicitados: "",
  objecionesClientes: "",
  aprendizajes: "",
  observaciones: "",
  ventaSicar: "",
  efectivoVentas: "",
  tarjeta: "",
  transferencias: "",
  otrosCobros: "",
  fondoInicial: String(FONDO_FIJO_CAJA),
  efectivoEntregado: "",
  efectivoFinal: "",
  movimientosCaja: [],
};

const categoriasMovimientoCaja = [
  ["retiro_caja", "Retiro de caja"],
  ["proveedor", "Pago a proveedor / mercancía"],
  ["nomina_comision", "Nómina o comisión"],
  ["logistica", "Envío, ruta o paquetería"],
  ["deposito_traspaso", "Depósito o traspaso"],
  ["servicios", "Servicio del negocio"],
  ["compra_emergencia", "Compra de emergencia"],
  ["prestamo_anticipo", "Préstamo o anticipo"],
  ["otro", "Otro movimiento"],
];

function movimientoCajaVacio() {
  return {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    tipo: "salida",
    categoria: "proveedor",
    concepto: "",
    recibidoPor: "",
    monto: "",
  };
}


export default function CierreTurno({
  branchId = null,
  usuario = null,
  modoEmpleado = false,
}) {
  const envioEnCurso = useRef(false);
  const [borradorRecuperable, setBorradorRecuperable] = useState(null);
  const [claveLeida, setClaveLeida] = useState(null);
  const [avisoBorrador, setAvisoBorrador] = useState('');
  const [confirmacionCorte, setConfirmacionCorte] = useState(null);
  const [consultaCajaConfirmada, setConsultaCajaConfirmada] = useState(false);
  const [correccionCierre, setCorreccionCierre] = useState(null);
  const [guardandoCorreccion, setGuardandoCorreccion] = useState(false);
  const [
    formulario,
    setFormulario,
  ] = useState(
    formularioInicial
  );

  const [
    guardando,
    setGuardando,
  ] = useState(false);

  const [
    analizando,
    setAnalizando,
  ] = useState(false);

  const [
    mensaje,
    setMensaje,
  ] = useState("");

  const [
    error,
    setError,
  ] = useState("");

  const [
    cierres,
    setCierres,
  ] = useState([]);

  const [
    cargandoCierres,
    setCargandoCierres,
  ] = useState(false);
  const correccionesCierres = useMemo(() => indexarCorreccionesCierres(cierres), [cierres]);
  const cierresVisibles = useMemo(
    () => cierres.filter((cierre) => !leerCorreccionCierre(cierre?.observaciones)),
    [cierres]
  );

  const [corteSinApertura, setCorteSinApertura] = useState(false);
  const esSucursalCentro = /centro/i.test(String(usuario?.sucursal || ''));
  const opcionesCaja = esSucursalCentro ? [['CAJA_1', 'Caja 1'], ['CAJA_2', 'Caja 2']] : [['CAJA_1', 'Caja 1']];
  const [cajaId, setCajaId] = useState(esSucursalCentro ? '' : 'CAJA_1');
  const cajaNombre = opcionesCaja.find(([id]) => id === cajaId)?.[1] || '';
  const sesionCajaActiva = useMemo(() => cajaId ? obtenerSesionCajaActiva(cierres, cajaId) : null, [cierres, cajaId]);
  const claveBorrador = modoEmpleado && cajaId ? claveBorradorCorte(usuario, branchId, cajaId) : null;
  const [abriendoCaja, setAbriendoCaja] = useState(false);
  const [fotoCorte, setFotoCorte] = useState(null);

  const [
    analisisActual,
    setAnalisisActual,
  ] = useState(null);

  const [
    patrones,
    setPatrones,
  ] = useState(null);

  const [
    analizandoPatrones,
    setAnalizandoPatrones,
  ] = useState(false);

  const [
    errorPatrones,
    setErrorPatrones,
  ] = useState("");


  const fechaHoy =
    useMemo(() => {
      return new Date()
        .toLocaleDateString(
          "es-MX",
          {
            timeZone: "America/Mexico_City",
            year: "numeric",
            month: "long",
            day: "numeric",
          }
        );
    }, []);

  useEffect(() => {
    const nombre = String(usuario?.nombre || "").trim();
    if (!nombre) return;
    setFormulario((actual) => ({ ...actual, responsable: nombre }));
  }, [usuario?.nombre]);

  const corteCalculado = useMemo(
    () => calcularCorteCaja(formulario),
    [formulario]
  );


  const importesListos = !validarImportesCorte(formulario);

  useEffect(() => {
    if (!claveBorrador) return;
    try {
      setBorradorRecuperable(leerBorradorCorte(window.localStorage, claveBorrador));
      setAvisoBorrador('');
    } catch { setAvisoBorrador('Este navegador no permite proteger el borrador. Mantén esta pantalla abierta hasta enviar el corte.'); }
    setClaveLeida(claveBorrador);
  }, [claveBorrador]);

  useEffect(() => {
    if (!claveBorrador || claveLeida !== claveBorrador || borradorRecuperable || guardando) return;
    try {
      guardarBorradorCorte(window.localStorage, claveBorrador, formulario, sesionCajaActiva?.sesionCajaId, corteSinApertura);
    } catch { setAvisoBorrador('No se pudo proteger el borrador en este dispositivo. Mantén esta pantalla abierta hasta enviar el corte.'); }
  }, [claveBorrador, claveLeida, borradorRecuperable, formulario, sesionCajaActiva?.sesionCajaId, corteSinApertura, guardando]);

  useEffect(() => {
    if (!modoEmpleado || !fotoCorte) return;
    const avisar = evento => { evento.preventDefault(); evento.returnValue = ''; };
    window.addEventListener('beforeunload', avisar);
    return () => window.removeEventListener('beforeunload', avisar);
  }, [modoEmpleado, fotoCorte]);

  function recuperarBorrador() {
    if (!borradorRecuperable || !consultaCajaConfirmada || cargandoCierres) return;
    if ((borradorRecuperable.sesionCajaId || null) !== (sesionCajaActiva?.sesionCajaId || null)) {
      setAvisoBorrador('La sesión de caja cambió desde este borrador. No se recuperó para evitar mezclar turnos. Confirma con Dirección antes de descartarlo.');
      return;
    }
    setFormulario({ ...formularioInicial, ...borradorRecuperable.formulario, responsable: String(usuario?.nombre || '').trim() });
    setCorteSinApertura(borradorRecuperable.sinApertura);
    setFotoCorte(null);
    setBorradorRecuperable(null);
    setAvisoBorrador('Borrador recuperado. Revisa los importes y vuelve a adjuntar la foto; el corte todavía no se ha enviado.');
  }

  function descartarBorrador() {
    try { window.localStorage.removeItem(claveBorrador); setBorradorRecuperable(null); setAvisoBorrador('Borrador anterior descartado.'); }
    catch { setAvisoBorrador('No se pudo descartar el borrador.'); }
  }

  async function cargarCierres() {
    try {
      setCargandoCierres(true);
      setConsultaCajaConfirmada(false);

      const data =
        await obtenerCierresTurno({
          branchId,
          limite: 100,
        });

      const lista = Array.isArray(data) ? data : [];
      setCierres(lista);
      setConsultaCajaConfirmada(true);
    } catch (
      errorCierres
    ) {
      console.error(
        "Error al cargar cierres:",
        errorCierres
      );
    } finally {
      setCargandoCierres(false);
    }
  }


 async function cargarPatrones() {
  try {
    setAnalizandoPatrones(true);
    setErrorPatrones("");

    const respuesta =
      await analizarPatronesCierresIA({
        branchId,
        dias: 7,
      });


    const patronesActuales =
      respuesta?.patrones ||
      null;


    setPatrones(
      patronesActuales
    );


    // ==============================================
    // MONYS OS
    // PATRONES → PRIORIDADES → TAREAS AUTOMÁTICAS
    // ==============================================

    if (patronesActuales) {
      try {
        const prioridades =
          convertirPatronesEnPrioridades(
            patronesActuales
          );


        const resultadoTareas =
          await crearTareasAutomaticasDesdePatrones({
            prioridades,
            branchId,
            creadaPor:
              "MONYS OS",
          });


        if (
          resultadoTareas
            ?.creadas > 0
        ) {
          console.log(
            "MONYS creó tareas directamente desde el análisis de patrones:",
            resultadoTareas
          );
        }


        if (
          resultadoTareas
            ?.duplicadas > 0
        ) {
          console.log(
            "MONYS evitó tareas duplicadas desde patrones:",
            resultadoTareas
          );
        }


        if (
          resultadoTareas
            ?.errores > 0
        ) {
          console.error(
            "MONYS tuvo problemas creando algunas tareas desde patrones:",
            resultadoTareas
          );
        }
      } catch (
        errorTareasPatrones
      ) {
        /*
         * El análisis de patrones ya quedó
         * correctamente guardado.
         *
         * Si falla la creación de una tarea,
         * no destruimos ni ocultamos el análisis.
         */
        console.error(
          "Error al convertir patrones en tareas:",
          errorTareasPatrones
        );
      }
    }
  } catch (
    errorAnalisisPatrones
  ) {
    console.error(
      "Error al analizar patrones:",
      errorAnalisisPatrones
    );

    setErrorPatrones(
      errorAnalisisPatrones
        ?.message ||
        "MONYS no pudo analizar los patrones de cierres."
    );
  } finally {
    setAnalizandoPatrones(false);
  }
}

  useEffect(() => {
    cargarCierres();
  }, [branchId]);


  function manejarCambio(
    event
  ) {
    const {
      name,
      value,
    } = event.target;

    setFormulario(
      (actual) => ({
        ...actual,
        [name]: value,
      })
    );
  }

  function agregarMovimientoCaja() {
    setFormulario((actual) => ({
      ...actual,
      movimientosCaja: [...actual.movimientosCaja, movimientoCajaVacio()],
    }));
  }

  function actualizarMovimientoCaja(id, campo, valor) {
    setFormulario((actual) => ({
      ...actual,
      movimientosCaja: actual.movimientosCaja.map((movimiento) =>
        movimiento.id === id ? { ...movimiento, [campo]: valor } : movimiento
      ),
    }));
  }

  function eliminarMovimientoCaja(id) {
    setFormulario((actual) => ({
      ...actual,
      movimientosCaja: actual.movimientosCaja.filter(
        (movimiento) => movimiento.id !== id
      ),
    }));
  }

  function seleccionarCaja(nuevaCajaId) {
    if (nuevaCajaId === cajaId) return;
    if (cajaId && (tieneCapturaBorrador(formulario) || fotoCorte)) {
      setError(`Ya comenzaste la captura de ${cajaNombre}. Termínala o recarga el borrador antes de cambiar de caja.`);
      return;
    }
    setCajaId(nuevaCajaId);
    setFormulario({ ...formularioInicial, responsable: String(usuario?.nombre || '').trim() });
    setFotoCorte(null);
    setBorradorRecuperable(null);
    setCorteSinApertura(false);
    setConfirmacionCorte(null);
    setError('');
    setMensaje('');
  }

  async function guardarCorreccionHistorica(cierre) {
    if (guardandoCorreccion || !correccionCierre || correccionCierre.cierreId !== cierre.id) return;
    const responsableCorregido = String(correccionCierre.responsableCorregido || '').trim();
    const cajaCorregidaId = String(correccionCierre.cajaId || '').trim();
    const cajaCorregidaNombre = opcionesCaja.find(([id]) => id === cajaCorregidaId)?.[1] || '';
    const corregidoPor = String(usuario?.nombre || '').trim();
    if (!['owner', 'admin'].includes(String(usuario?.role || '').toLowerCase())) {
      setError('Solo Dirección puede corregir un cierre histórico.');
      return;
    }
    if (!responsableCorregido || !cajaCorregidaNombre || !corregidoPor) {
      setError('Confirma la responsable y la caja correcta.');
      return;
    }
    try {
      setGuardandoCorreccion(true);
      setError('');
      await guardarCierreTurno({
        branchId: cierre.branch_id || branchId,
        responsable: corregidoPor,
        turno: 'correccion_cierre',
        observaciones: crearObservacionesCorreccionCierre({
          cierreId: cierre.id,
          responsableCorregido,
          cajaId: cajaCorregidaId,
          cajaNombre: cajaCorregidaNombre,
          motivo: correccionCierre.motivo || 'Confirmación operativa posterior al cierre',
          corregidoPor,
        }),
      });
      setCorreccionCierre(null);
      setMensaje(`Corrección registrada: ${responsableCorregido} · ${cajaCorregidaNombre}. El dato original se conserva para auditoría.`);
      await cargarCierres();
    } catch (errorCorreccion) {
      setError(errorCorreccion?.message || 'No fue posible registrar la corrección.');
    } finally {
      setGuardandoCorreccion(false);
    }
  }

  async function abrirCaja() {
    if (abriendoCaja || cargandoCierres) return;
    if (borradorRecuperable) { setError('Recupera o descarta el borrador anterior antes de iniciar otra caja.'); return; }
    if (!branchId) { setError('No se pudo identificar la sucursal. Avisa a Dirección.'); return; }
    if (!cajaId) { setError('Selecciona Caja 1 o Caja 2 antes de iniciar.'); return; }
    const responsable = String(usuario?.nombre || "").trim();
    if (!responsable) {
      setError("No fue posible identificar a la responsable de caja.");
      return;
    }

    try {
      setAbriendoCaja(true);
      setError("");
      setMensaje("");
      const sesionCajaId =
        typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
          ? crypto.randomUUID()
          : `caja-${Date.now()}`;
      await guardarCierreTurno({
        branchId,
        responsable,
        turno: "apertura_caja",
        observaciones: crearObservacionesAperturaCaja({
          sesionCajaId,
          cajaId,
          cajaNombre,
          responsable,
        }),
      });
      setFormulario((actual) => ({
        ...actual,
        responsable,
        turno: "cierre_caja",
        fondoInicial: String(FONDO_FIJO_CAJA),
        efectivoFinal: "",
      }));
      setMensaje(`${cajaNombre} abierta por ${responsable} con fondo de ${formatearDinero(FONDO_FIJO_CAJA)}.`);
      await cargarCierres();
    } catch (errorApertura) {
      setError(errorApertura?.message || "No se pudo abrir la caja.");
    } finally {
      setAbriendoCaja(false);
    }
  }


  async function manejarGuardar(
    event
  ) {
    event.preventDefault();
    if (envioEnCurso.current) return;
    if (borradorRecuperable) { setError('Recupera o descarta el borrador anterior antes de enviar otro corte.'); return; }

    setError("");
    setMensaje("");
    setAnalisisActual(null);

    const responsableAutenticada = String(usuario?.nombre || '').trim();
    if (!responsableAutenticada) { setError('No fue posible confirmar quién realiza el cierre. Vuelve a iniciar sesión.'); return; }

    if (!branchId) { setError("No se pudo identificar la sucursal. Avisa a Dirección."); return; }
    if (!cajaId) { setError('Selecciona Caja 1 o Caja 2 antes de registrar el cierre.'); return; }
    if (!sesionCajaActiva && !corteSinApertura) {
      setError("Abre la caja o selecciona registrar cierre sin apertura previa.");
      return;
    }

    if (!fotoCorte) {
      setError("Toma o selecciona la foto del corte de SICAR antes de cerrar la caja.");
      return;
    }

    const validacionImportes = validarImportesCorte(formulario);
    if (validacionImportes) { setError(validacionImportes); return; }
    const camposDinero = [
      "ventaSicar",
      "efectivoVentas",
      "tarjeta",
      "transferencias",
      "otrosCobros",
      "fondoInicial",
      "efectivoEntregado",
      "efectivoFinal",
    ];
    const movimientosIniciados = formulario.movimientosCaja.filter((movimiento) =>
      [movimiento.concepto, movimiento.recibidoPor, movimiento.monto].some(
        (valor) => String(valor ?? "").trim() !== ""
      )
    );
    const capturaDineroIniciada =
      camposDinero.some(
        (campo) => String(formulario[campo] ?? "").trim() !== ""
      ) || movimientosIniciados.length > 0;

    if (
      capturaDineroIniciada &&
      (String(formulario.ventaSicar).trim() === "" ||
        String(formulario.efectivoFinal).trim() === "")
    ) {
      setError(
        "Para terminar el corte escribe la venta total de SICAR y el efectivo contado al cierre."
      );
      return;
    }

    const movimientoIncompleto = movimientosIniciados.find(
      (movimiento) =>
        !Number.isFinite(Number(movimiento.monto)) ||
        !(Number(movimiento.monto) > 0) ||
        !String(movimiento.concepto || "").trim() ||
        (movimiento.tipo === "salida" &&
          !String(movimiento.recibidoPor || "").trim())
    );

    if (movimientoIncompleto) {
      setError(
        "Completa el monto, concepto y quién recibió cada salida de caja. Así Dirección podrá comprobar el dinero."
      );
      return;
    }

    const formularioLimpio = {
      ...formulario,
      movimientosCaja: movimientosIniciados.map(({ id: _id, ...movimiento }) => ({
        ...movimiento,
        monto: Number(movimiento.monto),
      })),
    };

    try {
      envioEnCurso.current = true;
      setGuardando(true);

      const evidenciaCorte = await subirFotoCorteCaja({
        archivo: fotoCorte,
        branchId,
      });

      const datosCorte = {
        ...formularioLimpio,
        cajaId,
        cajaNombre,
        sesionCajaId: sesionCajaActiva?.sesionCajaId || null,
        responsableApertura: sesionCajaActiva?.responsable || null,
        responsableCaja: responsableAutenticada,
        responsableCierre: responsableAutenticada,
        sinAperturaPrevia: !sesionCajaActiva,
        inicioRegistroCierre: !sesionCajaActiva ? new Date().toISOString() : null,
        fotoCorteUrl: evidenciaCorte.archivoUrl,
        fotoCortePath: evidenciaCorte.archivoPath,
        fondoSiguiente: FONDO_FIJO_CAJA,
        cerradoEn: new Date().toISOString(),
      };

      const cierreGuardado =
        await guardarCierreTurno({
          branchId,

          responsable: responsableAutenticada,

          turno: "cierre_caja",

          pendientes:
            formulario.pendientes,

          incidencias:
            formulario.incidencias,

          productosSolicitados:
            formulario
              .productosSolicitados,

          objecionesClientes:
            formulario
              .objecionesClientes,

          aprendizajes:
            formulario.aprendizajes,

          observaciones: crearObservacionesCorte(datosCorte, formulario.observaciones),
        });

      setConfirmacionCorte({ folio: cierreGuardado.id, fecha: cierreGuardado.fecha, responsable: responsableAutenticada, cajaNombre, venta: formulario.ventaSicar, efectivo: formulario.efectivoFinal });
      try { if (claveBorrador) window.localStorage.removeItem(claveBorrador); } catch { /* El corte ya fue guardado; un fallo local no debe presentarse como fallo del envío. */ }
      setBorradorRecuperable(null);
      setAvisoBorrador('');


      setMensaje(
        "Cierre guardado. MONYS está analizando la información."
      );


      setFormulario({
        ...formularioInicial,
        responsable: responsableAutenticada,
      });
      setFotoCorte(null);
      setCorteSinApertura(false);


      await cargarCierres();
      if (modoEmpleado) { setMensaje('Corte guardado y enviado a Dirección para revisión. No vuelvas a enviarlo.'); return; }

      try {
        setAnalizando(true);

        const respuesta =
          await analizarCierreTurnoIA(
            cierreGuardado.id
          );


        setAnalisisActual(
          respuesta?.analisis ||
            null
        );


        setMensaje(
          "Cierre de turno guardado y analizado correctamente."
        );


        /*
         * Después de analizar el cierre
         * individual, actualizamos también
         * los patrones acumulados.
         *
         * Si este segundo análisis falla,
         * NO afecta el cierre ya guardado.
         */
        try {
          await cargarPatrones();
        } catch (
          errorPatronAutomatico
        ) {
          console.error(
            "No se pudieron actualizar patrones:",
            errorPatronAutomatico
          );
        }
      } catch (
        errorAnalisis
      ) {
        console.error(
          "Error al analizar cierre:",
          errorAnalisis
        );

        /*
         * El cierre YA quedó guardado.
         * Si OpenAI falla, no perdemos
         * la información del empleado.
         */
        setError(
          errorAnalisis?.message ||
            "El cierre quedó guardado, pero MONYS no pudo analizarlo."
        );

        setMensaje(
          "El cierre de turno sí quedó guardado."
        );
      } finally {
        setAnalizando(false);
      }
    } catch (
      errorGuardar
    ) {
      console.error(
        "Error al guardar cierre:",
        errorGuardar
      );

      setError(
        errorGuardar?.message ||
          "No se pudo guardar el cierre de turno."
      );
    } finally {
      envioEnCurso.current = false;
      setGuardando(false);
    }
  }


  function formatearFecha(
    fecha
  ) {
    if (!fecha) {
      return "Sin fecha";
    }

    const partes =
      String(fecha)
        .split("-");

    if (
      partes.length === 3
    ) {
      return `${partes[2]}/${partes[1]}/${partes[0]}`;
    }

    return fecha;
  }


  function mostrarDato(
    valor
  ) {
    const texto =
      String(
        valor || ""
      ).trim();

    return texto ||
      "Sin información";
  }

  function formatearDinero(valor) {
    return new Intl.NumberFormat("es-MX", {
      style: "currency",
      currency: "MXN",
      maximumFractionDigits: 2,
    }).format(Number(valor) || 0);
  }

  function mostrarObservacionesCierre(cierre) {
    const apertura = leerAperturaCaja(cierre?.observaciones);
    if (apertura) {
      return `Caja abierta con ${formatearDinero(apertura.fondoInicial)} de fondo`;
    }

    const corte = leerCorteCaja(cierre?.observaciones);
    if (corte) {
      return `Corte enviado a Dirección · diferencia de venta ${formatearDinero(
        corte.diferenciaVenta
      )} · diferencia de caja ${formatearDinero(corte.diferenciaCaja)}`;
    }

    const flotilla = leerLiquidacionFlotilla(cierre?.observaciones);
    if (flotilla) {
      return `Liquidación enviada a Dirección · resultado estimado ${formatearDinero(
        flotilla.resultadoEstimado
      )}`;
    }

    return mostrarDato(cierre?.observaciones);
  }


  function etiquetaPrioridad(
    prioridad
  ) {
    switch (
      prioridad
    ) {
      case "urgente":
        return "🔴 URGENTE";

      case "alta":
        return "🟠 ALTA";

      case "baja":
        return "🟢 BAJA";

      default:
        return "🟡 NORMAL";
    }
  }


  function ListaAnalisis({
    titulo,
    datos,
  }) {
    if (
      !Array.isArray(datos) ||
      datos.length === 0
    ) {
      return null;
    }

    return (
      <div>
        <strong>
          {titulo}
        </strong>

        <ul
          style={{
            marginBottom: 0,
          }}
        >
          {datos.map(
            (
              item,
              index
            ) => (
              <li
                key={`${titulo}-${index}`}
              >
                {item}
              </li>
            )
          )}
        </ul>
      </div>
    );
  }


  return (
    <section
      className={modoEmpleado ? "tienda-cierre" : undefined}
      style={{
        padding: modoEmpleado ? "0" : "24px",
      }}
    >
      <div
        style={{
          marginBottom: "22px",
        }}
      >
        <h2
          style={{
            margin: 0,
          }}
        >
          {modoEmpleado ? "Tu corte, claro y completo" : "🌙 Cierre Inteligente de Turno"}
        </h2>

        <p
          style={{
            marginTop: "6px",
            opacity: 0.75,
          }}
        >
          {fechaHoy}
        </p>

        <p
          style={{
            marginTop: "8px",
          }}
        >
          {modoEmpleado ? "Foto, cobros y efectivo del turno." : "MONYS recopilará lo ocurrido durante el turno para detectar pendientes, problemas, oportunidades y aprendizajes."}
        </p>
      </div>


      {error && (
        <div
          style={{
            padding: "12px",
            marginBottom: "14px",
            border:
              "1px solid #dc3545",
            borderRadius: "10px",
          }}
        >
          ❌ {error}
        </div>
      )}


      {mensaje && (
        <div
          style={{
            padding: "12px",
            marginBottom: "14px",
            border:
              "1px solid #198754",
            borderRadius: "10px",
          }}
        >
          ✅ {mensaje}
        </div>
      )}

      {modoEmpleado && <aside className="tienda-borrador" aria-label="Protección de tu captura">
        <strong>{borradorRecuperable ? 'Encontramos una captura sin terminar' : 'Borrador de tu captura'}</strong>
        <p>{claveBorrador
          ? 'Los datos escritos se conservan hasta 12 horas para esta cuenta, sucursal, caja y fecha. La foto debe adjuntarse de nuevo al recuperar. Al pulsar Salir se eliminan los borradores de esta cuenta.'
          : modoEmpleado && !cajaId
            ? 'Elige Caja 1 o Caja 2 para proteger por separado el borrador de esa caja.'
            : 'No se pudo identificar tu cuenta y sucursal para proteger el borrador.'}</p>
        {borradorRecuperable && <><p>Guardado a las {new Date(borradorRecuperable.guardadoEn).toLocaleTimeString('es-MX', { timeZone: 'America/Mexico_City' })}. Recupera o descarta antes de empezar una captura nueva.</p><button type="button" onClick={recuperarBorrador} disabled={!consultaCajaConfirmada || cargandoCierres || guardando}>Recuperar captura</button><button type="button" onClick={descartarBorrador} disabled={guardando}>Descartar borrador anterior</button></>}
        {avisoBorrador && <p role="status">{avisoBorrador}</p>}
      </aside>}
      {confirmacionCorte && <aside className="tienda-confirmacion" role="status"><span>CORTE RECIBIDO EN MONYS</span><h3>Tu envío quedó registrado</h3><p><b>Folio:</b> {confirmacionCorte.folio}</p><p>{confirmacionCorte.responsable} · {usuario?.sucursal || 'Sucursal de esta cuenta'} · {confirmacionCorte.cajaNombre}{confirmacionCorte.fecha ? ` · ${confirmacionCorte.fecha}` : ''}</p><p>Venta SICAR: {formatearDinero(confirmacionCorte.venta)} · Efectivo que queda: {formatearDinero(confirmacionCorte.efectivo)}</p><small>Pendiente de revisión de Dirección. Conserva este folio; no vuelvas a enviar el mismo corte.</small></aside>}


      {analizando && (
        <div
          style={{
            padding: "16px",
            marginBottom: "18px",
            border:
              "1px solid #aaa",
            borderRadius: "12px",
          }}
        >
          🧠 MONYS está analizando
          el cierre del turno...
        </div>
      )}


      {!modoEmpleado && analisisActual && (
        <section
          style={{
            padding: "20px",
            marginBottom: "24px",
            border:
              "2px solid #333",
            borderRadius: "16px",
          }}
        >
          <h3
            style={{
              marginTop: 0,
            }}
          >
            🧠 Análisis de MONYS
          </h3>


          <div
            style={{
              marginBottom: "14px",
              fontWeight: "800",
            }}
          >
            Prioridad:{" "}
            {etiquetaPrioridad(
              analisisActual.prioridad
            )}
          </div>


          <div
            style={{
              padding: "14px",
              marginBottom: "16px",
              border:
                "1px solid #ddd",
              borderRadius: "10px",
            }}
          >
            <strong>
              📋 Resumen ejecutivo
            </strong>

            <p
              style={{
                marginBottom: 0,
              }}
            >
              {
                analisisActual
                  .resumen_ejecutivo
              }
            </p>
          </div>


          <div
            style={{
              display: "grid",
              gridTemplateColumns:
                "repeat(auto-fit, minmax(250px, 1fr))",
              gap: "16px",
            }}
          >
            <ListaAnalisis
              titulo="📌 Pendientes importantes"
              datos={
                analisisActual
                  .pendientes_importantes
              }
            />

            <ListaAnalisis
              titulo="🚨 Incidencias importantes"
              datos={
                analisisActual
                  .incidencias_importantes
              }
            />

            <ListaAnalisis
              titulo="💰 Oportunidades detectadas"
              datos={
                analisisActual
                  .oportunidades_detectadas
              }
            />

            <ListaAnalisis
              titulo="🛍️ Productos a revisar"
              datos={
                analisisActual
                  .productos_a_revisar
              }
            />

            <ListaAnalisis
              titulo="⚡ Acciones sugeridas"
              datos={
                analisisActual
                  .acciones_sugeridas
              }
            />
          </div>


          <div
            style={{
              marginTop: "18px",
              fontWeight: "700",
            }}
          >
            {analisisActual
              .requiere_atencion
              ? "⚠️ Este cierre requiere atención."
              : "✅ No requiere atención inmediata."}
          </div>
        </section>
      )}


      {["owner", "admin"].includes(String(usuario?.role || "").toLowerCase()) && (
      <section
        style={{
          padding: "20px",
          marginBottom: "28px",
          border:
            "2px solid #333",
          borderRadius: "16px",
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent:
              "space-between",
            alignItems: "center",
            gap: "14px",
            flexWrap: "wrap",
            marginBottom: "16px",
          }}
        >
          <div>
            <h3
              style={{
                margin: 0,
              }}
            >
              🔎 Patrones detectados por MONYS
            </h3>

            <p
              style={{
                margin:
                  "6px 0 0 0",
                opacity: 0.75,
              }}
            >
              MONYS compara los cierres
              de los últimos 7 días para
              detectar problemas y
              oportunidades repetidas.
            </p>
          </div>


          <button
            type="button"
            onClick={
              cargarPatrones
            }
            disabled={
              analizandoPatrones
            }
          >
            {analizandoPatrones
              ? "🧠 Analizando..."
              : "🔎 Analizar últimos 7 días"}
          </button>
        </div>


        {errorPatrones && (
          <div
            style={{
              padding: "12px",
              marginBottom: "14px",
              border:
                "1px solid #dc3545",
              borderRadius: "10px",
            }}
          >
            ❌ {errorPatrones}
          </div>
        )}


        {analizandoPatrones && (
          <div
            style={{
              padding: "14px",
              border:
                "1px solid #aaa",
              borderRadius: "10px",
            }}
          >
            🧠 MONYS está comparando
            cierres, buscando repeticiones
            y calculando la importancia
            de cada señal...
          </div>
        )}


        {!analizandoPatrones &&
        !patrones && (
          <div
            style={{
              padding: "16px",
              border:
                "1px solid #ddd",
              borderRadius: "10px",
            }}
          >
            Presiona{" "}
            <strong>
              🔎 Analizar últimos 7 días
            </strong>{" "}
            para que MONYS busque patrones
            entre los cierres registrados.
          </div>
        )}


        {!analizandoPatrones &&
        patrones && (
          <div>
            <div
              style={{
                display: "grid",
                gridTemplateColumns:
                  "repeat(auto-fit, minmax(180px, 1fr))",
                gap: "12px",
                marginBottom: "18px",
              }}
            >
              <div
                style={{
                  padding: "14px",
                  border:
                    "1px solid #ddd",
                  borderRadius: "10px",
                }}
              >
                <strong>
                  📅 Periodo
                </strong>

                <div
                  style={{
                    marginTop: "6px",
                  }}
                >
                  Últimos{" "}
                  {
                    patrones.periodo_dias
                  }{" "}
                  días
                </div>
              </div>


              <div
                style={{
                  padding: "14px",
                  border:
                    "1px solid #ddd",
                  borderRadius: "10px",
                }}
              >
                <strong>
                  📚 Cierres analizados
                </strong>

                <div
                  style={{
                    marginTop: "6px",
                    fontSize: "20px",
                    fontWeight: "800",
                  }}
                >
                  {
                    patrones.total_cierres
                  }
                </div>
              </div>


              <div
                style={{
                  padding: "14px",
                  border:
                    "1px solid #ddd",
                  borderRadius: "10px",
                }}
              >
                <strong>
                  🚦 Prioridad general
                </strong>

                <div
                  style={{
                    marginTop: "6px",
                    fontWeight: "800",
                  }}
                >
                  {etiquetaPrioridad(
                    patrones
                      .prioridad_general
                  )}
                </div>
              </div>


              <div
                style={{
                  padding: "14px",
                  border:
                    "1px solid #ddd",
                  borderRadius: "10px",
                }}
              >
                <strong>
                  🎯 Confianza
                </strong>

                <div
                  style={{
                    marginTop: "6px",
                    fontSize: "20px",
                    fontWeight: "800",
                  }}
                >
                  {Number(
                    patrones.confianza ||
                      0
                  ).toFixed(0)}
                  %
                </div>
              </div>
            </div>


            <div
              style={{
                padding: "16px",
                marginBottom: "18px",
                border:
                  "1px solid #ddd",
                borderRadius: "12px",
              }}
            >
              <strong>
                📋 Resumen ejecutivo
              </strong>

              <p
                style={{
                  marginBottom: 0,
                }}
              >
                {
                  patrones
                    .resumen_ejecutivo
                }
              </p>
            </div>


            <div
              style={{
                display: "grid",
                gridTemplateColumns:
                  "repeat(auto-fit, minmax(260px, 1fr))",
                gap: "18px",
              }}
            >
              <ListaAnalisis
                titulo="🔁 Patrones repetidos"
                datos={
                  patrones
                    .patrones_repetidos
                }
              />

              <ListaAnalisis
                titulo="🛍️ Productos recurrentes"
                datos={
                  patrones
                    .productos_recurrentes
                }
              />

              <ListaAnalisis
                titulo="🚨 Incidencias recurrentes"
                datos={
                  patrones
                    .incidencias_recurrentes
                }
              />

              <ListaAnalisis
                titulo="💬 Objeciones recurrentes"
                datos={
                  patrones
                    .objeciones_recurrentes
                }
              />

              <ListaAnalisis
                titulo="💰 Oportunidades recurrentes"
                datos={
                  patrones
                    .oportunidades_recurrentes
                }
              />

              <ListaAnalisis
                titulo="⚡ Acciones prioritarias"
                datos={
                  patrones
                    .acciones_prioritarias
                }
              />

              <ListaAnalisis
                titulo="⚠️ Alertas"
                datos={
                  patrones.alertas
                }
              />
            </div>


            {Number(
              patrones.total_cierres ||
                0
            ) < 3 && (
              <div
                style={{
                  marginTop: "18px",
                  padding: "12px",
                  border:
                    "1px solid #aaa",
                  borderRadius: "10px",
                }}
              >
                ℹ️ Todavía hay pocos
                cierres registrados.
                La precisión de MONYS
                aumentará conforme el
                equipo realice cierres
                todos los días.
              </div>
            )}
          </div>
        )}
      </section>
      )}


      <section className="tienda-selector-caja" aria-label="Seleccionar caja">
        <span>CAJA FÍSICA</span>
        <h3>{esSucursalCentro ? '¿Cuál caja vas a cerrar?' : 'Caja de esta sucursal'}</h3>
        <p>Esta selección separa el dinero, la apertura y el corte de cada caja.</p>
        <div>{opcionesCaja.map(([id, nombre]) => <button type="button" key={id} aria-pressed={cajaId === id} onClick={() => seleccionarCaja(id)}>{nombre}</button>)}</div>
        {!cajaId && <small>Selecciona una caja para continuar.</small>}
      </section>


      <section
        style={{
          padding: "18px",
          marginBottom: "18px",
          borderRadius: "18px",
          border: sesionCajaActiva ? "1px solid #b9dec9" : "1px solid #e6c7d7",
          background: sesionCajaActiva
            ? "linear-gradient(145deg, #f0fbf5, #ffffff)"
            : "linear-gradient(145deg, #fff2f8, #ffffff)",
        }}
      >
        <div style={{ color: "#8f2f5e", fontSize: "12px", fontWeight: 900, letterSpacing: ".08em" }}>
          RESPONSABILIDAD DE CAJA
        </div>
        {cargandoCierres ? <p role="status">Consultando el estado de caja…</p> : sesionCajaActiva ? (
          <>
            <h3 style={{ margin: "7px 0" }}>{cajaNombre} abierta por {sesionCajaActiva.responsable}</h3>
            <p style={{ margin: 0, color: "#5f4f57" }}>
              Fondo inicial: <b>{formatearDinero(FONDO_FIJO_CAJA)}</b> · abierta {new Date(
                sesionCajaActiva.abiertoEn
              ).toLocaleString("es-MX")}
            </p>
            <p style={{ margin: "9px 0 0", color: "#5f4f57" }}>
              El cierre quedará firmado por la cuenta que lo envíe. La persona que abrió se conserva por separado.
            </p>
          </>
        ) : corteSinApertura ? <div><h3 style={{ margin: '7px 0' }}>Cierre sin apertura previa</h3><p style={{ margin: 0 }}>Captura el fondo inicial real. Dirección revisará este corte; no se crea una apertura retroactiva.</p></div> : (
          <>
            <h3 style={{ margin: "7px 0" }}>No se encontró una apertura registrada</h3>
            <p style={{ margin: "0 0 14px", color: "#5f4f57" }}>
              Si vas a comenzar a usar la caja, registra su apertura. Si ya vas a cerrar y no registraste la apertura, usa la opción de cierre de hoy y captura el fondo real.
            </p>
            <button
              type="button"
              onClick={abrirCaja}
              disabled={!cajaId || abriendoCaja || cargandoCierres || corteSinApertura}
              style={{
                width: "100%",
                padding: "13px 16px",
                border: 0,
                borderRadius: "12px",
                background: "linear-gradient(135deg, #7f174d, #ba2f72)",
                color: "#fff",
                fontWeight: 900,
                cursor: abriendoCaja ? "wait" : "pointer",
              }}
            >
              {abriendoCaja ? "Abriendo caja..." : `Iniciar caja ahora · fondo ${formatearDinero(FONDO_FIJO_CAJA)}`}
            </button>
            <button className="tienda-cierre-sin-apertura" type="button" disabled={!cajaId || corteSinApertura || abriendoCaja || cargandoCierres} onClick={() => { setCorteSinApertura(true); setFormulario(actual => ({ ...actual, fondoInicial: '', efectivoFinal: '' })); setError(''); }}>Registrar cierre de hoy sin apertura previa</button>
            {corteSinApertura && <p role="status">Este corte quedará identificado como sin apertura registrada. Escribe el fondo que realmente había al comenzar el turno; no se registrará una apertura retroactiva.</p>}
          </>
        )}
      </section>


      {(sesionCajaActiva || corteSinApertura) && (
      <form
        onSubmit={
          manejarGuardar
        }
        style={{
          display: "grid",
          gap: "16px",
          padding: "20px",
          border:
            "1px solid #333",
          borderRadius: "14px",
          marginBottom: "28px",
        }}
      >
        <div
          style={{
            display: "grid",
            gridTemplateColumns:
              "repeat(auto-fit, minmax(220px, 1fr))",
            gap: "12px",
          }}
        >
          <div>
            <label>
              👤 Cierre firmado por
            </label>

            <input
              type="text"
              name="responsable"
              value={
                formulario.responsable
              }
              readOnly
              style={{
                width: "100%",
                marginTop: "6px",
                padding: "10px",
                background: "#f8f3f6",
              }}
            />
          </div>


          <div>
            <label>
              💵 Fondo de caja
            </label>
            <div
              id="employee-shift-select"
              tabIndex={-1}
              aria-label="Fondo fijo de caja: mil pesos"
              style={{
                marginTop: "6px",
                padding: "11px",
                borderRadius: "10px",
                background: "#f8f3f6",
                fontWeight: 900,
              }}
            >
              {corteSinApertura ? 'Captura el fondo real en el formulario' : `${formatearDinero(FONDO_FIJO_CAJA)} · registrado`}
            </div>
          </div>
        </div>


        <section
          style={{
            padding: "18px",
            borderRadius: "16px",
            background: "linear-gradient(145deg, #fff7fb, #ffffff)",
            border: "1px solid #e4c9d7",
          }}
        >
          <div style={{ marginBottom: "14px" }}>
            <div
              style={{
                color: "#9b1d5c",
                fontSize: "12px",
                fontWeight: 900,
                letterSpacing: ".08em",
              }}
            >
              CORTE DE CAJA · DATOS DEL DÍA
            </div>
            <h3 style={{ margin: "5px 0" }}>Cuadra venta, cobros y efectivo</h3>
            <p style={{ margin: 0, color: "#725d68", lineHeight: 1.5 }}>
              Captura los importes del corte. MONYS calcula las diferencias y lo
              envía a Dirección como pendiente de revisión; no modifica la
              utilidad automáticamente.
            </p>
          </div>

          <label
            style={{
              display: "block",
              marginTop: "16px",
              padding: "15px",
              borderRadius: "13px",
              border: fotoCorte ? "1px solid #9bc9ad" : "1px solid #d9bdcc",
              background: fotoCorte ? "#f0faf4" : "#fff",
              fontWeight: 900,
            }}
          >
            📷 Foto obligatoria del corte de SICAR
            <input
              type="file"
              accept="image/*"
              capture="environment"
              onChange={(event) => setFotoCorte(event.target.files?.[0] || null)}
              style={{ display: "block", width: "100%", marginTop: "10px" }}
            />
            <small style={{ display: "block", marginTop: "7px", color: "#725d68", fontWeight: 600 }}>
              {fotoCorte
                ? `Lista para enviar: ${fotoCorte.name}`
                : "Toma la foto donde se vea el total, faltante o sobrante del corte."}
            </small>
          </label>

          <div
            className="tienda-importes"
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
              gap: "12px",
            }}
          >
            {[
              ["ventaSicar", "Venta total SICAR", "Total del corte"],
              ["efectivoVentas", "Ventas en efectivo", "Solo cobros en efectivo"],
              ["tarjeta", "Cobros con tarjeta", "Total de terminales"],
              ["transferencias", "Transferencias", "Cobros recibidos por banco"],
              ["otrosCobros", "Otros cobros", "Vales u otra forma de pago"],
              ["fondoInicial", "Fondo inicial", corteSinApertura ? "Fondo real al iniciar el turno" : "Fondo registrado al abrir"],
              ["efectivoEntregado", "Efectivo retirado al cierre", "Dinero de la venta que entregas o resguardas"],
              ["efectivoFinal", "Fondo que queda en caja", "Cuenta el efectivo real; la meta es dejar $1,000"],
            ].map(([name, label, ayuda]) => (
              <label key={name} style={{ fontWeight: 800, fontSize: "13px" }}>
                {label}
                <input
                  type="number"
                  inputMode="decimal"
                  min="0"
                  step="0.01"
                  name={name}
                  value={formulario[name]}
                  onChange={manejarCambio}
                  readOnly={name === "fondoInicial" && !corteSinApertura}
                  placeholder="$0.00"
                  style={{
                    width: "100%",
                    boxSizing: "border-box",
                    marginTop: "6px",
                    padding: "11px",
                    borderRadius: "10px",
                    border: "1px solid #d9bdcc",
                    background: name === "fondoInicial" && !corteSinApertura ? "#f8f3f6" : "#fff",
                  }}
                />
                <small
                  style={{
                    display: "block",
                    marginTop: "4px",
                    color: "#806e77",
                    fontWeight: 500,
                  }}
                >
                  {ayuda}
                </small>
              </label>
            ))}
          </div>

          <div
            style={{
              marginTop: "18px",
              paddingTop: "17px",
              borderTop: "1px solid #ead8e2",
            }}
          >
            <div
              style={{
                display: "flex",
                gap: "12px",
                justifyContent: "space-between",
                alignItems: "center",
                flexWrap: "wrap",
              }}
            >
              <div>
                <h4 style={{ margin: 0 }}>Movimientos después de abrir la caja</h4>
                <p style={{ margin: "5px 0 0", color: "#725d68", fontSize: "13px" }}>
                  Registra cada salida o entrada por separado. Préstamos y depósitos
                  quedarán identificados y no se confundirán con gastos del negocio.
                </p>
              </div>
              <button
                type="button"
                onClick={agregarMovimientoCaja}
                style={{
                  border: 0,
                  borderRadius: "10px",
                  padding: "10px 14px",
                  background: "#7d2553",
                  color: "#fff",
                  fontWeight: 900,
                  cursor: "pointer",
                }}
              >
                + Agregar movimiento
              </button>
            </div>

            {formulario.movimientosCaja.length === 0 ? (
              <p
                style={{
                  margin: "12px 0 0",
                  padding: "12px",
                  borderRadius: "10px",
                  background: "#fff",
                  border: "1px dashed #d8bdcb",
                  color: "#806e77",
                  fontSize: "13px",
                }}
              >
                Si no hubo retiros, pagos, depósitos, préstamos ni entradas extra,
                déjalo vacío.
              </p>
            ) : (
              <div style={{ display: "grid", gap: "10px", marginTop: "12px" }}>
                {formulario.movimientosCaja.map((movimiento, index) => (
                  <div
                    key={movimiento.id}
                    style={{
                      padding: "13px",
                      border: "1px solid #e2ced9",
                      borderRadius: "12px",
                      background: "#fff",
                    }}
                  >
                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns: "repeat(auto-fit, minmax(145px, 1fr))",
                        gap: "9px",
                      }}
                    >
                      <label style={{ fontSize: "12px", fontWeight: 800 }}>
                        Tipo
                        <select
                          value={movimiento.tipo}
                          onChange={(event) =>
                            actualizarMovimientoCaja(
                              movimiento.id,
                              "tipo",
                              event.target.value
                            )
                          }
                          style={{ width: "100%", marginTop: "5px", padding: "10px" }}
                        >
                          <option value="salida">Salida de dinero</option>
                          <option value="entrada">Entrada adicional</option>
                        </select>
                      </label>
                      <label style={{ fontSize: "12px", fontWeight: 800 }}>
                        Categoría
                        <select
                          value={movimiento.categoria}
                          onChange={(event) =>
                            actualizarMovimientoCaja(
                              movimiento.id,
                              "categoria",
                              event.target.value
                            )
                          }
                          style={{ width: "100%", marginTop: "5px", padding: "10px" }}
                        >
                          {categoriasMovimientoCaja.map(([valor, etiqueta]) => (
                            <option key={valor} value={valor}>{etiqueta}</option>
                          ))}
                        </select>
                      </label>
                      <label style={{ fontSize: "12px", fontWeight: 800 }}>
                        Concepto
                        <input
                          value={movimiento.concepto}
                          onChange={(event) =>
                            actualizarMovimientoCaja(
                              movimiento.id,
                              "concepto",
                              event.target.value
                            )
                          }
                          placeholder="Ej. mercancía Pink Up"
                          style={{ width: "100%", boxSizing: "border-box", marginTop: "5px", padding: "10px" }}
                        />
                      </label>
                      <label style={{ fontSize: "12px", fontWeight: 800 }}>
                        {movimiento.tipo === "salida" ? "Quién recibió" : "De quién llegó"}
                        <input
                          value={movimiento.recibidoPor}
                          onChange={(event) =>
                            actualizarMovimientoCaja(
                              movimiento.id,
                              "recibidoPor",
                              event.target.value
                            )
                          }
                          placeholder="Nombre o proveedor"
                          style={{ width: "100%", boxSizing: "border-box", marginTop: "5px", padding: "10px" }}
                        />
                      </label>
                      <label style={{ fontSize: "12px", fontWeight: 800 }}>
                        Monto
                        <input
                          type="number"
                          inputMode="decimal"
                          min="0"
                          step="0.01"
                          value={movimiento.monto}
                          onChange={(event) =>
                            actualizarMovimientoCaja(
                              movimiento.id,
                              "monto",
                              event.target.value
                            )
                          }
                          placeholder="$0.00"
                          style={{ width: "100%", boxSizing: "border-box", marginTop: "5px", padding: "10px" }}
                        />
                      </label>
                    </div>
                    <button
                      type="button"
                      onClick={() => eliminarMovimientoCaja(movimiento.id)}
                      style={{
                        marginTop: "10px",
                        border: 0,
                        background: "transparent",
                        color: "#9b1d5c",
                        fontWeight: 800,
                        cursor: "pointer",
                      }}
                    >
                      Quitar movimiento {index + 1}
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))",
              gap: "10px",
              marginTop: "16px",
            }}
          >
            {[
              ["Cobrado por métodos", corteCalculado.cobrado],
              ["Diferencia contra SICAR", corteCalculado.diferenciaVenta],
              ["Entradas posteriores", corteCalculado.entradasPosteriores],
              ["Salidas posteriores", corteCalculado.salidasPosteriores],
              ["Efectivo esperado", corteCalculado.efectivoEsperado],
              ["Diferencia de caja", corteCalculado.diferenciaCaja],
            ].map(([etiqueta, valor]) => (
              <div
                key={etiqueta}
                style={{
                  padding: "12px",
                  borderRadius: "12px",
                  background: importesListos && etiqueta.startsWith("Diferencia") && Math.abs(Number(valor)) > 0.009 ? "#fff2e6" : "#f5f8f6",
                  border: "1px solid #eadde4",
                }}
              >
                <small style={{ color: "#725d68" }}>{etiqueta}</small>
                <strong style={{ display: "block", marginTop: "4px" }}>
                  {importesListos ? formatearDinero(valor) : "Por completar"}
                </strong>
              </div>
            ))}
          </div>
        </section>


        <details className="tienda-notas"><summary>Notas del turno · opcional</summary>
        <div>
          <label>
            📌 ¿Qué quedó pendiente?
          </label>

          <textarea
            name="pendientes"
            value={
              formulario.pendientes
            }
            onChange={
              manejarCambio
            }
            placeholder="Pedidos, acomodos, clientes, tareas..."
            rows={3}
            style={{
              width: "100%",
              marginTop: "6px",
              padding: "10px",
            }}
          />
        </div>


        <div>
          <label>
            🚨 ¿Hubo alguna incidencia?
          </label>

          <textarea
            id="employee-incident-input"
            name="incidencias"
            value={
              formulario.incidencias
            }
            onChange={
              manejarCambio
            }
            placeholder="Faltantes, problemas con clientes, caja, equipo..."
            rows={3}
            style={{
              width: "100%",
              marginTop: "6px",
              padding: "10px",
            }}
          />
        </div>


        <div>
          <label>
            🛍️ Productos solicitados
          </label>
          <CapturaDemanda onAgregar={(linea) => setFormulario(anterior => ({ ...anterior, productosSolicitados: [anterior.productosSolicitados, linea].filter(Boolean).join("\n") }))} />

          <textarea
            name="productosSolicitados"
            value={
              formulario
                .productosSolicitados
            }
            onChange={
              manejarCambio
            }
            placeholder="Productos que pidieron los clientes y no encontraron..."
            rows={3}
            style={{
              width: "100%",
              marginTop: "6px",
              padding: "10px",
            }}
          />
        </div>


        <div>
          <label>
            💬 Objeciones de clientes
          </label>

          <textarea
            name="objecionesClientes"
            value={
              formulario
                .objecionesClientes
            }
            onChange={
              manejarCambio
            }
            placeholder="Muy caro, no había tono, buscaban otra marca..."
            rows={3}
            style={{
              width: "100%",
              marginTop: "6px",
              padding: "10px",
            }}
          />
        </div>


        <div>
          <label>
            💡 ¿Qué aprendimos hoy?
          </label>

          <textarea
            name="aprendizajes"
            value={
              formulario.aprendizajes
            }
            onChange={
              manejarCambio
            }
            placeholder="Algo que funcionó, algo que debemos cambiar..."
            rows={3}
            style={{
              width: "100%",
              marginTop: "6px",
              padding: "10px",
            }}
          />
        </div>


        <div>
          <label>
            📝 Algo más que MONYS
            deba saber
          </label>

          <textarea
            name="observaciones"
            value={
              formulario.observaciones
            }
            onChange={
              manejarCambio
            }
            placeholder="Cualquier información importante del turno..."
            rows={3}
            style={{
              width: "100%",
              marginTop: "6px",
              padding: "10px",
            }}
          />
        </div>


        </details>
        <button
          type="submit"
          disabled={
            guardando ||
            analizando
          }
          style={{
            padding: "12px 18px",
            fontWeight: "700",
            cursor:
              guardando ||
              analizando
                ? "not-allowed"
                : "pointer",
          }}
        >
          {guardando
            ? "Guardando..."
            : analizando
            ? "MONYS está analizando..."
            : "✅ Finalizar cierre de turno"}
        </button>
      </form>
      )}


      {!modoEmpleado && <section>
        <div
          style={{
            display: "flex",
            justifyContent:
              "space-between",
            alignItems: "center",
            gap: "12px",
            flexWrap: "wrap",
            marginBottom: "14px",
          }}
        >
          <div>
            <h3
              style={{
                margin: 0,
              }}
            >
              📚 Últimos cierres de turno
            </h3>

            <p
              style={{
                margin:
                  "5px 0 0 0",
                opacity: 0.7,
              }}
            >
              Historial reciente de
              lo reportado por el equipo.
            </p>
          </div>


          <button
            type="button"
            onClick={
              cargarCierres
            }
            disabled={
              cargandoCierres
            }
          >
            {cargandoCierres
              ? "Actualizando..."
              : "🔄 Actualizar"}
          </button>
        </div>


        {cargandoCierres &&
        cierresVisibles.length === 0 ? (
          <p>
            Cargando cierres...
          </p>
        ) : cierresVisibles.length ===
          0 ? (
          <div
            style={{
              padding: "18px",
              border:
                "1px solid #ddd",
              borderRadius: "12px",
            }}
          >
            Todavía no hay cierres
            registrados.
          </div>
        ) : (
          <div
            style={{
              display: "grid",
              gap: "14px",
            }}
          >
            {cierresVisibles.map(
              (cierre) => {
                const correccion = correccionesCierres.get(cierre.id);
                const editando = correccionCierre?.cierreId === cierre.id;
                return (
                <article
                  key={
                    cierre.id
                  }
                  style={{
                    padding: "18px",
                    border:
                      "1px solid #333",
                    borderRadius:
                      "14px",
                  }}
                >
                  <div
                    style={{
                      display:
                        "flex",
                      justifyContent:
                        "space-between",
                      gap: "12px",
                      flexWrap:
                        "wrap",
                      marginBottom:
                        "14px",
                    }}
                  >
                    <div>
                      <strong>
                        👤{" "}
                        {
                          correccion?.responsableCorregido || cierre.responsable
                        }
                      </strong>

                      {correccion?.cajaNombre && <div style={{ marginTop: "4px", fontWeight: 800 }}>
                        {correccion.cajaNombre}
                      </div>}

                      <div
                        style={{
                          marginTop:
                            "4px",
                          opacity:
                            0.75,
                        }}
                      >
                        🕐{" "}
                        {cierre.turno ||
                          "Sin turno"}
                      </div>
                    </div>

                    <div>
                      📅{" "}
                      {formatearFecha(
                        cierre.fecha
                      )}
                    </div>
                  </div>


                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns:
                        "repeat(auto-fit, minmax(240px, 1fr))",
                      gap: "12px",
                    }}
                  >
                    <div>
                      <strong>
                        📌 Pendientes
                      </strong>

                      <p>
                        {mostrarDato(
                          cierre.pendientes
                        )}
                      </p>
                    </div>


                    <div>
                      <strong>
                        🚨 Incidencias
                      </strong>

                      <p>
                        {mostrarDato(
                          cierre.incidencias
                        )}
                      </p>
                    </div>


                    <div>
                      <strong>
                        🛍️ Productos solicitados
                      </strong>

                      <p>
                        {mostrarDato(
                          cierre
                            .productos_solicitados
                        )}
                      </p>
                    </div>


                    <div>
                      <strong>
                        💬 Objeciones
                      </strong>

                      <p>
                        {mostrarDato(
                          cierre
                            .objeciones_clientes
                        )}
                      </p>
                    </div>


                    <div>
                      <strong>
                        💡 Aprendizajes
                      </strong>

                      <p>
                        {mostrarDato(
                          cierre.aprendizajes
                        )}
                      </p>
                    </div>


                    <div>
                      <strong>
                        📝 Observaciones
                      </strong>

                      <p>
                        {mostrarObservacionesCierre(cierre)}
                      </p>
                    </div>
                  </div>

                  {correccion && <div style={{ marginTop: "14px", padding: "12px", borderRadius: "10px", background: "#f8eef3", color: "#654657" }}>
                    <strong>Corrección de Dirección</strong>
                    <p style={{ margin: "5px 0 0" }}>Registro original: {cierre.responsable}. Corregido por {correccion.corregidoPor || 'Dirección'} sin borrar el historial.</p>
                  </div>}

                  {!correccion && ['owner', 'admin'].includes(String(usuario?.role || '').toLowerCase()) && !editando && (
                    <button type="button" onClick={() => setCorreccionCierre({ cierreId: cierre.id, responsableCorregido: cierre.responsable || '', cajaId: '', motivo: 'Confirmación operativa posterior al cierre' })} style={{ marginTop: "14px" }}>
                      Corregir responsable o caja
                    </button>
                  )}

                  {editando && <div style={{ marginTop: "14px", padding: "14px", border: "1px solid #d9bdcc", borderRadius: "12px", background: "#fff8fb" }}>
                    <strong>Registrar corrección sin borrar el original</strong>
                    <label style={{ display: "block", marginTop: "10px" }}>Responsable correcta
                      <input value={correccionCierre.responsableCorregido} onChange={(event) => setCorreccionCierre((actual) => ({ ...actual, responsableCorregido: event.target.value }))} style={{ width: "100%", boxSizing: "border-box", marginTop: "5px", padding: "10px" }} />
                    </label>
                    <label style={{ display: "block", marginTop: "10px" }}>Caja correcta
                      <select value={correccionCierre.cajaId} onChange={(event) => setCorreccionCierre((actual) => ({ ...actual, cajaId: event.target.value }))} style={{ width: "100%", marginTop: "5px", padding: "10px" }}>
                        <option value="">Seleccionar caja</option>
                        {opcionesCaja.map(([id, nombreCaja]) => <option key={id} value={id}>{nombreCaja}</option>)}
                      </select>
                    </label>
                    <label style={{ display: "block", marginTop: "10px" }}>Motivo
                      <input value={correccionCierre.motivo} onChange={(event) => setCorreccionCierre((actual) => ({ ...actual, motivo: event.target.value }))} style={{ width: "100%", boxSizing: "border-box", marginTop: "5px", padding: "10px" }} />
                    </label>
                    <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", marginTop: "12px" }}>
                      <button type="button" onClick={() => guardarCorreccionHistorica(cierre)} disabled={guardandoCorreccion}>{guardandoCorreccion ? 'Guardando…' : 'Guardar corrección'}</button>
                      <button type="button" onClick={() => setCorreccionCierre(null)} disabled={guardandoCorreccion}>Cancelar</button>
                    </div>
                  </div>}
                </article>
                );
              }
            )}
          </div>
        )}
      </section>}
    </section>
  );
}
