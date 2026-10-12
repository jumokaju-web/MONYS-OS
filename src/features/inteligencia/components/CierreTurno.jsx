import CapturaDemanda from '../../valor/CapturaDemanda';
import {
  useEffect,
  useMemo,
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
  crearObservacionesCorte,
  FONDO_FIJO_CAJA,
  leerAperturaCaja,
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
  efectivoFinal: String(FONDO_FIJO_CAJA),
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
}) {
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

  const [sesionCajaActiva, setSesionCajaActiva] = useState(null);
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
            year: "numeric",
            month: "long",
            day: "numeric",
          }
        );
    }, []);

  useEffect(() => {
    const nombre = String(usuario?.nombre || "").trim();
    if (!nombre) return;
    setFormulario((actual) =>
      actual.responsable ? actual : { ...actual, responsable: nombre }
    );
  }, [usuario?.nombre]);

  const corteCalculado = useMemo(
    () => calcularCorteCaja(formulario),
    [formulario]
  );


  async function cargarCierres() {
    try {
      setCargandoCierres(true);

      const data =
        await obtenerCierresTurno({
          branchId,
          limite: 10,
        });

      const lista = Array.isArray(data) ? data : [];
      setCierres(lista);
      setSesionCajaActiva(obtenerSesionCajaActiva(lista));
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

  async function abrirCaja() {
    const responsable = String(usuario?.nombre || formulario.responsable || "").trim();
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
          responsable,
        }),
      });
      setFormulario((actual) => ({
        ...actual,
        responsable,
        turno: "cierre_caja",
        fondoInicial: String(FONDO_FIJO_CAJA),
        efectivoFinal: String(FONDO_FIJO_CAJA),
      }));
      setMensaje(`Caja abierta por ${responsable} con fondo de ${formatearDinero(FONDO_FIJO_CAJA)}.`);
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

    setError("");
    setMensaje("");
    setAnalisisActual(null);

    if (
      !formulario
        .responsable
        .trim()
    ) {
      setError(
        "Escribe quién realiza el cierre."
      );

      return;
    }

    if (!sesionCajaActiva) {
      setError("Primero abre la caja para registrar quién queda como responsable.");
      return;
    }

    if (!fotoCorte) {
      setError("Toma o selecciona la foto del corte de SICAR antes de cerrar la caja.");
      return;
    }

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
      setGuardando(true);

      const evidenciaCorte = await subirFotoCorteCaja({
        archivo: fotoCorte,
        branchId,
      });

      const datosCorte = {
        ...formularioLimpio,
        sesionCajaId: sesionCajaActiva.sesionCajaId,
        responsableCaja: sesionCajaActiva.responsable,
        fotoCorteUrl: evidenciaCorte.archivoUrl,
        fotoCortePath: evidenciaCorte.archivoPath,
        fondoSiguiente: FONDO_FIJO_CAJA,
        cerradoEn: new Date().toISOString(),
      };

      const cierreGuardado =
        await guardarCierreTurno({
          branchId,

          responsable:
            formulario.responsable,

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


      setMensaje(
        "Cierre guardado. MONYS está analizando la información."
      );


      setFormulario({
        ...formularioInicial,
        responsable: formulario.responsable,
      });
      setFotoCorte(null);


      await cargarCierres();


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
      style={{
        padding: "24px",
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
          🌙 Cierre Inteligente de Turno
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
          MONYS recopilará lo ocurrido
          durante el turno para detectar
          pendientes, problemas,
          oportunidades y aprendizajes.
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


      {analisisActual && (
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
        {sesionCajaActiva ? (
          <>
            <h3 style={{ margin: "7px 0" }}>Caja abierta por {sesionCajaActiva.responsable}</h3>
            <p style={{ margin: 0, color: "#5f4f57" }}>
              Fondo inicial: <b>{formatearDinero(FONDO_FIJO_CAJA)}</b> · abierta {new Date(
                sesionCajaActiva.abiertoEn
              ).toLocaleString("es-MX")}
            </p>
            <p style={{ margin: "9px 0 0", color: "#5f4f57" }}>
              Para que otra persona tome la caja, primero termina este corte con la foto de SICAR.
            </p>
          </>
        ) : (
          <>
            <h3 style={{ margin: "7px 0" }}>La caja está cerrada</h3>
            <p style={{ margin: "0 0 14px", color: "#5f4f57" }}>
              Quien vaya a usarla debe abrirla. MONYS registrará automáticamente su nombre, hora y el fondo fijo de {formatearDinero(FONDO_FIJO_CAJA)}.
            </p>
            <button
              type="button"
              onClick={abrirCaja}
              disabled={abriendoCaja}
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
              {abriendoCaja ? "Abriendo caja..." : `Abrir caja con fondo de ${formatearDinero(FONDO_FIJO_CAJA)}`}
            </button>
          </>
        )}
      </section>


      {sesionCajaActiva && (
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
              👤 ¿Quién cierra?
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
              style={{
                marginTop: "6px",
                padding: "11px",
                borderRadius: "10px",
                background: "#f8f3f6",
                fontWeight: 900,
              }}
            >
              {formatearDinero(FONDO_FIJO_CAJA)} · fijo
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
              ["fondoInicial", "Fondo inicial", "Siempre inicia con $1,000"],
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
                  readOnly={name === "fondoInicial"}
                  placeholder="$0.00"
                  style={{
                    width: "100%",
                    boxSizing: "border-box",
                    marginTop: "6px",
                    padding: "11px",
                    borderRadius: "10px",
                    border: "1px solid #d9bdcc",
                    background: name === "fondoInicial" ? "#f8f3f6" : "#fff",
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
                  background: Number(valor) === 0 ? "#f5f8f6" : "#fff2e6",
                  border: "1px solid #eadde4",
                }}
              >
                <small style={{ color: "#725d68" }}>{etiqueta}</small>
                <strong style={{ display: "block", marginTop: "4px" }}>
                  {formatearDinero(valor)}
                </strong>
              </div>
            ))}
          </div>
        </section>


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


      <section>
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
        cierres.length === 0 ? (
          <p>
            Cargando cierres...
          </p>
        ) : cierres.length ===
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
            {cierres.map(
              (cierre) => (
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
                          cierre.responsable
                        }
                      </strong>

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
                </article>
              )
            )}
          </div>
        )}
      </section>
    </section>
  );
}
