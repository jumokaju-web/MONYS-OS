import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  obtenerUnidadesFlotilla,
  obtenerRutaDeUnidadEnFecha,
  guardarLiquidacionFlotilla,
  obtenerLiquidacionFlotillaHoy,
  suscribirseARutasDeUnidad,
} from "./services/flotillaService";
import ResumenFlotillaSocios from "./ResumenFlotillaSocios";
import { calcularLiquidacionFlotilla } from "../../inteligencia/utils/capturasFinancierasEquipo";

function normalizarNombre(valor) {
  return String(valor || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();
}

function obtenerFechaLocal() {
  const hoy = new Date();
  return [
    hoy.getFullYear(),
    String(hoy.getMonth() + 1).padStart(2, "0"),
    String(hoy.getDate()).padStart(2, "0"),
  ].join("-");
}

export default function FlotillaChofer({
  usuario = null,
  volverAlDashboard,
}) {

  const [unidades, setUnidades] = useState([]);
  const [unidadId, setUnidadId] = useState("");
  const [liquidacion, setLiquidacion] = useState({
    ingresoRuta: "",
    pagoChofer: "",
    sacarCamioneta: "",
    gasolina: "",
    casetas: "",
    mantenimiento: "",
    prestamos: "",
    otrosGastos: "",
    nota: "",
  });
  const [liquidacionGuardada, setLiquidacionGuardada] = useState(null);
  const [guardandoLiquidacion, setGuardandoLiquidacion] = useState(false);
  const [mensajeLiquidacion, setMensajeLiquidacion] = useState("");
  const [errorLiquidacion, setErrorLiquidacion] = useState("");

  const unidad =
    unidades.find((item) => item.id === unidadId) || null;

  const [
    cargandoUnidad,
    setCargandoUnidad,
  ] = useState(true);

  const [
    errorUnidad,
    setErrorUnidad,
  ] = useState("");

  useEffect(() => {
    let activo = true;

    const cargarUnidad = async () => {
      try {
        setCargandoUnidad(true);
        setErrorUnidad("");

        const resultado = await obtenerUnidadesFlotilla();

        if (activo) {
          const nombreUsuario = normalizarNombre(usuario?.nombre);
          const asignada = resultado.find((item) => {
            const chofer = normalizarNombre(item?.chofer_nombre);
            return (
              nombreUsuario &&
              chofer &&
              (chofer.includes(nombreUsuario) || nombreUsuario.includes(chofer))
            );
          });

          const rol = String(usuario?.role || "").toLowerCase();
          const puedeRevisarTodaLaFlotilla =
            rol === "owner" || rol === "admin";
          const unidadesPermitidas = puedeRevisarTodaLaFlotilla
            ? resultado
            : asignada
              ? [asignada]
              : [];

          setUnidades(unidadesPermitidas);

          setUnidadId((actual) =>
            unidadesPermitidas.some((item) => item.id === actual)
              ? actual
              : asignada?.id || unidadesPermitidas[0]?.id || ""
          );
        }
      } catch (error) {
        console.error(
          "Error cargando unidad:",
          error
        );

        if (activo) {
          setErrorUnidad(
            error?.message ||
              "No fue posible cargar la unidad."
          );
        }
      } finally {
        if (activo) {
          setCargandoUnidad(false);
        }
      }
    };

    cargarUnidad();

    return () => {
      activo = false;
    };
  }, [usuario?.nombre, usuario?.role]);

  const [rutaHoy, setRutaHoy] = useState(null);
  const [cargandoRuta, setCargandoRuta] = useState(false);
  const [errorRuta, setErrorRuta] = useState("");
  const [estadoSincronizacion, setEstadoSincronizacion] =
    useState("CONECTANDO");

  const resumenLiquidacion = useMemo(
    () => calcularLiquidacionFlotilla(liquidacion),
    [liquidacion]
  );

  const cargarRutaActual = useCallback(
    async ({ silencioso = false } = {}) => {
      if (!unidad?.id) {
        setRutaHoy(null);
        return;
      }

      try {
        if (!silencioso) {
          setCargandoRuta(true);
          setRutaHoy(null);
        }
        setErrorRuta("");

        const resultado = await obtenerRutaDeUnidadEnFecha(
          unidad.id,
          obtenerFechaLocal()
        );

        setRutaHoy(resultado);
      } catch (error) {
        console.error("Error cargando ruta:", error);
        setErrorRuta(
          error?.message || "No fue posible cargar la ruta."
        );
      } finally {
        if (!silencioso) {
          setCargandoRuta(false);
        }
      }
    },
    [unidad?.id]
  );

  useEffect(() => {
    if (!unidad?.id) {
      setRutaHoy(null);
      setEstadoSincronizacion("SIN_UNIDAD");
      return;
    }

    cargarRutaActual();

    const detenerSuscripcion = suscribirseARutasDeUnidad({
      unidadId: unidad.id,
      onCambio: () => cargarRutaActual({ silencioso: true }),
      onEstado: (estado) => setEstadoSincronizacion(estado),
    });

    // Respaldo para proyectos donde Realtime aún no esté habilitado.
    const intervalo = window.setInterval(
      () => cargarRutaActual({ silencioso: true }),
      60000
    );

    return () => {
      detenerSuscripcion();
      window.clearInterval(intervalo);
    };
  }, [cargarRutaActual, unidad?.id]);

  useEffect(() => {
    let activo = true;
    setLiquidacionGuardada(null);
    if (!unidad?.id) return () => { activo = false; };

    obtenerLiquidacionFlotillaHoy({
      unidadId: unidad.id,
      fecha: obtenerFechaLocal(),
    })
      .then((resultado) => {
        if (activo) setLiquidacionGuardada(resultado);
      })
      .catch(() => {
        if (activo) setLiquidacionGuardada(null);
      });

    return () => {
      activo = false;
    };
  }, [unidad?.id]);

  async function enviarLiquidacion(evento) {
    evento.preventDefault();
    setMensajeLiquidacion("");
    setErrorLiquidacion("");

    try {
      setGuardandoLiquidacion(true);
      const cierre = await guardarLiquidacionFlotilla({
        branchId: usuario?.branch_id || null,
        responsable: usuario?.nombre || unidad?.chofer_nombre,
        unidad,
        ruta: rutaHoy,
        valores: liquidacion,
        nota: liquidacion.nota,
      });
      setLiquidacionGuardada({ cierre, datos: { ...liquidacion, ...resumenLiquidacion } });
      setMensajeLiquidacion(
        "Liquidación enviada a Dirección. Quedó pendiente de revisión financiera."
      );
    } catch (error) {
      setErrorLiquidacion(
        error?.message || "No fue posible guardar la liquidación."
      );
    } finally {
      setGuardandoLiquidacion(false);
    }
  }

    const choferReal =
    unidad?.chofer_nombre || usuario?.nombre || "Sin asignar";

  const placasReales =
    unidad?.placas || "—";

  const tipoReal =
    unidad?.tipo_operacion || "—";

  const estadoReal =
    unidad?.estado || "—";

  const propietarioReal =
    Array.isArray(
      unidad?.propietarios
    ) &&
    unidad.propietarios.length > 0
      ? typeof unidad.propietarios[0] ===
        "string"
        ? unidad.propietarios[0]
        : unidad.propietarios[0]
            ?.nombre || "—"
      : "—";

    return (

    <div
      style={{
        minHeight: "100vh",
        background:
          "linear-gradient(180deg, #eef8ff 0%, #ffffff 100%)",
        padding: "14px 12px 90px",
        fontFamily:
          "Inter, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
        color: "#14365a",
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: "520px",
          margin: "0 auto",
        }}
      >
        {/* ENCABEZADO */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: "14px",
          }}
        >
          <div>
            <div
              style={{
                fontSize: "18px",
                fontWeight: "900",
                color: "#14365a",
              }}
            >
              🚚 MONYS OS
            </div>

            <div
              style={{
                fontSize: "13px",
                color: "#67809a",
              }}
            >
              Flotilla Inteligente
            </div>
          </div>

          <div
            style={{
              fontSize: "23px",
              display: "flex",
              gap: "8px",
              alignItems: "center",
            }}
          >
            <span aria-label="Notificaciones">🔔</span>
            {typeof volverAlDashboard === "function" && (
              <button
                type="button"
                onClick={volverAlDashboard}
                style={{
                  border: "1px solid #c9ddeb",
                  borderRadius: "10px",
                  background: "#fff",
                  color: "#174b7a",
                  padding: "8px 10px",
                  fontWeight: 850,
                  cursor: "pointer",
                }}
              >
                Salir
              </button>
            )}
          </div>
        </div>

        {cargandoUnidad && (
          <p role="status">Consultando unidades autorizadas…</p>
        )}

        {errorUnidad && (
          <div
            role="alert"
            style={{
              marginBottom: "14px",
              padding: "12px",
              borderRadius: "12px",
              background: "#fff1f1",
              border: "1px solid #e7aaaa",
              color: "#9b2929",
              fontWeight: 750,
            }}
          >
            {errorUnidad}
          </div>
        )}

        {!cargandoUnidad && !errorUnidad && unidades.length === 0 && (
          <div
            role="status"
            style={{
              marginBottom: "14px",
              padding: "14px",
              borderRadius: "12px",
              background: "#fff8e8",
              border: "1px solid #e8cc86",
              color: "#705016",
            }}
          >
            No hay una unidad autorizada para esta cuenta. Administración debe
            registrar o asignar la unidad antes de crear rutas o gastos.
          </div>
        )}

        {unidades.length > 1 && (
          <label
            style={{
              display: "block",
              marginBottom: "14px",
              fontSize: "13px",
              fontWeight: 850,
            }}
          >
            Unidad a revisar
            <select
              value={unidadId}
              onChange={(evento) => setUnidadId(evento.target.value)}
              style={{
                width: "100%",
                marginTop: "6px",
                padding: "11px",
                borderRadius: "11px",
                border: "1px solid #c9ddeb",
                background: "#fff",
                color: "#14365a",
                font: "inherit",
              }}
            >
              {unidades.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.placas || "Sin placas"} · {item.chofer_nombre || "Sin chofer"}
                </option>
              ))}
            </select>
          </label>
        )}

        {unidad?.id && (
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              gap: "10px",
              marginBottom: "14px",
              padding: "10px 12px",
              borderRadius: "11px",
              background:
                estadoSincronizacion === "SUBSCRIBED"
                  ? "#eaf9f0"
                  : "#fff8e8",
              border:
                estadoSincronizacion === "SUBSCRIBED"
                  ? "1px solid #b8ddc5"
                  : "1px solid #e8cc86",
              color:
                estadoSincronizacion === "SUBSCRIBED"
                  ? "#247044"
                  : "#705016",
              fontSize: "12px",
              fontWeight: 800,
            }}
          >
            <span>
              {estadoSincronizacion === "SUBSCRIBED"
                ? "● Sincronización automática activa"
                : "● Comprobando sincronización"}
            </span>
            <button
              type="button"
              onClick={() => cargarRutaActual()}
              disabled={cargandoRuta}
              style={{
                border: "1px solid currentColor",
                borderRadius: "9px",
                background: "#fff",
                color: "inherit",
                padding: "6px 9px",
                fontWeight: 850,
                cursor: cargandoRuta ? "wait" : "pointer",
              }}
            >
              {cargandoRuta ? "Actualizando…" : "Actualizar"}
            </button>
          </div>
        )}

        {["owner", "admin"].includes(
          String(usuario?.role || "").toLowerCase()
        ) && <ResumenFlotillaSocios unidades={unidades} />}

        {/* SALUDO */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            gap: "12px",
            marginBottom: "14px",
          }}
        >
          <div>
            <h1
              style={{
                margin: 0,
                fontSize: "31px",
                color: "#142f50",
              }}
            >
             Hola, {choferReal} 💪
            </h1>

            <div
              style={{
                fontSize: "15px",
                color: "#5f7891",
                marginTop: "2px",
              }}
            >
              Chofer · MLP
            </div>
          </div>

          <div
            style={{
              textAlign: "right",
              fontSize: "12px",
              color: "#53708b",
            }}
          >
            <div>Hoy</div>

            <div
              style={{
                marginTop: "7px",
                background: "#dff8e9",
                color: "#148451",
                padding: "7px 11px",
                borderRadius: "999px",
                fontWeight: "900",
              }}
            >
             {cargandoRuta
  ? "Consultando ruta..."
  : errorRuta
    ? "Error al consultar"
    : rutaHoy?.estado || "Sin ruta registrada"}
            </div>
          </div>
        </div>

        {/* UNIDAD */}
        <div
          style={{
            background: "#ffffff",
            borderRadius: "18px",
            padding: "14px",
            border: "1px solid #dbeaf6",
            marginBottom: "12px",
            display: "flex",
            gap: "13px",
            alignItems: "center",
            boxShadow:
              "0 8px 24px rgba(44, 95, 135, 0.07)",
          }}
        >
          <div
            style={{
              width: "76px",
              height: "60px",
              borderRadius: "14px",
              background: "#e8f3fb",
              display: "grid",
              placeItems: "center",
              fontSize: "38px",
            }}
          >
            🚐
          </div>

          <div>
            <div
              style={{
                fontSize: "16px",
                fontWeight: "900",
              }}
            >
              Unidad: {placasReales}
            </div>

            <div
              style={{
                fontSize: "13px",
                color: "#647d94",
                marginTop: "3px",
              }}
            >
              Tipo: {tipoReal}
            </div>

            <div
              style={{
                fontSize: "13px",
                color: "#647d94",
              }}
            >
              Dueño: {propietarioReal}
            </div>

            <div
              style={{
                fontSize: "13px",
                color: "#647d94",
              }}
            >
              Estado: {estadoReal}
            </div>
          </div>
        </div>

        {/* 4 INDICADORES */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns:
              "repeat(4, minmax(0, 1fr))",
            gap: "7px",
            marginBottom: "12px",
          }}
        >
          {
            [
  ["📍", "Ruta", rutaHoy?.codigo_ruta || "Sin ruta"],
  [
    "🛣️",
    "Paros",
    rutaHoy?.paros_total == null
      ? "Sin dato"
      : String(rutaHoy.paros_total),
  ],
  ["💵", "Ingreso base", "Pendiente"],
  ["⛽", "Gasolina", "Pendiente"],
].map(([icono, titulo, valor]) => (
            <div
              key={titulo}
              style={{
                background: "#ffffff",
                borderRadius: "15px",
                padding: "10px 6px",
                textAlign: "center",
                border: "1px solid #dceaf5",
              }}
            >
              <div
                style={{
                  fontSize: "18px",
                }}
              >
                {icono}
              </div>

              <div
                style={{
                  fontSize: "10px",
                  color: "#74889b",
                  marginTop: "4px",
                }}
              >
                {titulo}
              </div>

              <div
                style={{
                  fontSize: "15px",
                  fontWeight: "900",
                  marginTop: "3px",
                  color: "#174b7a",
                }}
              >
                {valor}
              </div>
            </div>
          ))}
        </div>

        {/* GANANCIA */}
        <div
          style={{
            background:
              "linear-gradient(135deg, #d9fae7, #c9f7dc)",
            border: "1px solid #b8eacb",
            borderRadius: "18px",
            padding: "16px",
            marginBottom: "12px",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <div>
            <div
              style={{
                fontSize: "13px",
                color: "#32735b",
                fontWeight: "800",
              }}
            >
              📊 Ganancia estimada hoy
            </div>

            <div
              style={{
                fontSize: "34px",
                fontWeight: "900",
                color: "#0d7950",
                marginTop: "3px",
              }}
            >
              Pendiente
            </div>
          </div>


        </div>

        {/* BOTONES PRINCIPALES */}
        <div
          style={{
            display: "none",
            gridTemplateColumns:
              "repeat(3, minmax(0, 1fr))",
            gap: "8px",
            marginBottom: "14px",
          }}
        >
          <button
            type="button"
            style={{
              border: "none",
              background: "#1675df",
              color: "white",
              borderRadius: "14px",
              padding: "13px 6px",
              fontWeight: "900",
              cursor: "pointer",
            }}
          >
            ▶ Iniciar ruta
          </button>

          <button
            type="button"
            style={{
              border: "1px solid #cfe1f2",
              background: "#ffffff",
              color: "#205b91",
              borderRadius: "14px",
              padding: "13px 6px",
              fontWeight: "900",
              cursor: "pointer",
            }}
          >
            ⛽ Registrar gasto
          </button>

          <button
            type="button"
            style={{
              border: "1px solid #cfe1f2",
              background: "#ffffff",
              color: "#205b91",
              borderRadius: "14px",
              padding: "13px 6px",
              fontWeight: "900",
              cursor: "pointer",
            }}
          >
            🚩 Cerrar ruta
          </button>
        </div>

        {/* MI RUTA */}
{cargandoRuta && (
  <p role="status">Consultando la ruta de hoy...</p>
)}
{errorRuta && (
  <p role="alert" style={{ color: "#b42318", fontWeight: "700" }}>
    No se pudo consultar la ruta. Actualiza la página para intentarlo de nuevo.
  </p>
)}
<section
          style={{
            background: "#ffffff",
            borderRadius: "18px",
            padding: "15px",
            border: "1px solid #dbeaf5",
            marginBottom: "12px",
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              marginBottom: "12px",
            }}
          >
            <strong>🚙 Mi ruta de hoy</strong>

            <span
              style={{
                color: "#2572bc",
                fontSize: "12px",
              }}
            >
              Ver detalles ›
            </span>
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: "8px 18px",
              fontSize: "13px",
            }}
          >
          <div>
  Ruta:{" "}
  <strong>
    {cargandoRuta
      ? "Cargando..."
      : errorRuta
        ? "No disponible"
        : rutaHoy?.codigo_ruta || "Sin ruta registrada"}
  </strong>
</div>

<div>
  Estado:{" "}
  <strong>
    {cargandoRuta
      ? "Cargando..."
      : errorRuta
        ? "No disponible"
        : rutaHoy?.estado || "Sin ruta registrada"}
  </strong>
</div>

             <div>
  Unidad: <strong>{placasReales}</strong>
</div>

<div>
  Chofer: <strong>{choferReal}</strong>
</div>

            <div>
  Paros:{" "}
  <strong>
    {rutaHoy?.paros_total == null
      ? "Sin dato"
      : rutaHoy.paros_total}
  </strong>
</div>
             <div>
  Dueño: <strong>{propietarioReal}</strong>
</div>

   <div>
  Paquetes:{" "}
  <strong>
    {rutaHoy?.paquetes_total == null
      ? "Sin dato"
      : rutaHoy.paquetes_total}
  </strong>
</div>

           <div>
  Tipo: <strong>{tipoReal}</strong>
</div>
          </div>
        </section>

        <form
          onSubmit={enviarLiquidacion}
          style={{
            marginBottom: "12px",
            padding: "16px",
            borderRadius: "18px",
            background: "linear-gradient(145deg, #123d63, #1c6794)",
            color: "#fff",
            boxShadow: "0 12px 30px rgba(20, 54, 90, .16)",
          }}
        >
          <div style={{ fontSize: "11px", fontWeight: 900, letterSpacing: ".1em", opacity: .82 }}>
            LIQUIDACIÓN DIARIA · CONECTADA A DIRECCIÓN
          </div>
          <h2 style={{ margin: "6px 0", fontSize: "21px" }}>
            Entrega los números de la ruta
          </h2>
          <p style={{ margin: "0 0 14px", fontSize: "13px", lineHeight: 1.5, opacity: .86 }}>
            Registra lo cobrado y cada salida. MONYS calcula el resultado y lo
            manda a Finanzas para revisión; no lo mezcla automáticamente con el banco.
          </p>

          {liquidacionGuardada && (
            <div
              role="status"
              style={{
                marginBottom: "12px",
                padding: "11px",
                borderRadius: "11px",
                background: "rgba(220,255,235,.15)",
                border: "1px solid rgba(220,255,235,.35)",
                fontWeight: 800,
              }}
            >
              ✓ Esta unidad ya tiene una liquidación guardada hoy. Puedes enviar
              una corrección; Dirección verá ambos registros.
            </div>
          )}

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
              gap: "10px",
            }}
          >
            {[
              ["ingresoRuta", "Ingreso de la ruta"],
              ["pagoChofer", "Pago al chofer"],
              ["sacarCamioneta", "Pago por sacar camioneta"],
              ["gasolina", "Gasolina"],
              ["casetas", "Casetas"],
              ["mantenimiento", "Mantenimiento"],
              ["prestamos", "Préstamo o adelanto"],
              ["otrosGastos", "Otros gastos"],
            ].map(([campo, etiqueta]) => (
              <label key={campo} style={{ fontSize: "12px", fontWeight: 800 }}>
                {etiqueta}
                <input
                  type="number"
                  inputMode="decimal"
                  min="0"
                  step="0.01"
                  value={liquidacion[campo]}
                  onChange={(evento) =>
                    setLiquidacion((actual) => ({
                      ...actual,
                      [campo]: evento.target.value,
                    }))
                  }
                  placeholder="$0.00"
                  style={{
                    width: "100%",
                    boxSizing: "border-box",
                    marginTop: "5px",
                    padding: "10px",
                    borderRadius: "10px",
                    border: "1px solid rgba(255,255,255,.38)",
                    background: "rgba(255,255,255,.96)",
                    color: "#14365a",
                  }}
                />
              </label>
            ))}
          </div>

          <label style={{ display: "block", marginTop: "10px", fontSize: "12px", fontWeight: 800 }}>
            Nota o explicación
            <textarea
              rows={2}
              value={liquidacion.nota}
              onChange={(evento) =>
                setLiquidacion((actual) => ({ ...actual, nota: evento.target.value }))
              }
              placeholder="Ej. se pagó ponchadura, depósito incompleto…"
              style={{
                width: "100%",
                boxSizing: "border-box",
                marginTop: "5px",
                padding: "10px",
                borderRadius: "10px",
                border: "1px solid rgba(255,255,255,.38)",
              }}
            />
          </label>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: "9px",
              marginTop: "12px",
            }}
          >
            <div style={{ padding: "11px", borderRadius: "11px", background: "rgba(255,255,255,.12)" }}>
              <small>Gastos reportados</small>
              <strong style={{ display: "block", fontSize: "19px", marginTop: "3px" }}>
                {new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" }).format(resumenLiquidacion.gastos)}
              </strong>
            </div>
            <div style={{ padding: "11px", borderRadius: "11px", background: "rgba(255,255,255,.12)" }}>
              <small>Resultado estimado</small>
              <strong style={{ display: "block", fontSize: "19px", marginTop: "3px" }}>
                {new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" }).format(resumenLiquidacion.resultadoEstimado)}
              </strong>
            </div>
          </div>

          {errorLiquidacion && <p role="alert" style={{ color: "#ffd6d6", fontWeight: 800 }}>{errorLiquidacion}</p>}
          {mensajeLiquidacion && <p role="status" style={{ color: "#d9ffe7", fontWeight: 800 }}>{mensajeLiquidacion}</p>}

          <button
            type="submit"
            disabled={guardandoLiquidacion || !unidad?.id}
            style={{
              width: "100%",
              marginTop: "13px",
              padding: "12px",
              border: 0,
              borderRadius: "11px",
              background: "#fff",
              color: "#174b7a",
              fontWeight: 900,
              cursor: guardandoLiquidacion ? "wait" : "pointer",
            }}
          >
            {guardandoLiquidacion ? "Enviando a Dirección…" : "Guardar y enviar a Dirección →"}
          </button>
        </form>

        {/* ECONOMÍA + GASTO */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr",
            gap: "10px",
          }}
        >
          <section
            style={{
              background: "#ffffff",
              borderRadius: "18px",
              padding: "14px",
              border: "1px solid #dbeaf5",
            }}
          >
            <strong>
              🕘 Resumen económico
            </strong>

            {[
  ["Pago base chofer", "Pendiente"],
  ["Sacar camioneta", "Pendiente"],
  ["Gasolina", "Pendiente"],
  ["Préstamo / adelanto", "Pendiente"],
  ["Otros ajustes", "Pendiente"],
].map(([texto, valor]) => (
              <div
                key={texto}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  marginTop: "9px",
                  fontSize: "12px",
                }}
              >
                <span>{texto}</span>
                <strong>{valor}</strong>
              </div>
            ))}

            <div
              style={{
                background: "#e3faeb",
                borderRadius: "10px",
                padding: "10px",
                marginTop: "12px",
                display: "flex",
                justifyContent: "space-between",
                fontWeight: "900",
                color: "#14744d",
              }}
            >
             <span>Saldo de hoy:</span>
<span>Pendiente</span>
            </div>
          </section>

         <section
  hidden
  style={{
    background: "#ffffff",
    borderRadius: "18px",
    padding: "14px",
    border: "1px solid #dbeaf5",
  }}
>
  <strong>
    💼 Registrar gasto
            </strong>

            <div
              style={{
                marginTop: "12px",
                fontSize: "11px",
                color: "#6a8195",
              }}
            >
              Tipo de gasto
            </div>

            <select
              style={{
                width: "100%",
                marginTop: "5px",
                padding: "9px",
                borderRadius: "9px",
                border: "1px solid #cfddea",
              }}
            >
              <option>Gasolina</option>
              <option>Préstamo</option>
              <option>Adelanto</option>
            </select>

            <div
              style={{
                marginTop: "10px",
                fontSize: "11px",
                color: "#6a8195",
              }}
            >
              Monto
            </div>

            <input
              type="number"
              placeholder="$ 300"
              style={{
                width: "100%",
                boxSizing: "border-box",
                marginTop: "5px",
                padding: "9px",
                borderRadius: "9px",
                border: "1px solid #cfddea",
              }}
            />

            <div
              style={{
                marginTop: "10px",
                fontSize: "11px",
                color: "#6a8195",
              }}
            >
              Salió de
            </div>

            <select
              style={{
                width: "100%",
                marginTop: "5px",
                padding: "9px",
                borderRadius: "9px",
                border: "1px solid #cfddea",
              }}
            >
              <option>Tienda Centro</option>
              <option>General Anaya</option>
              <option>BBVA Mónica</option>
              <option>BBVA Ana Karina</option>
              <option>Chory</option>
            </select>

            <button
              type="button"
              style={{
                width: "100%",
                marginTop: "12px",
                border: "none",
                background: "#1675df",
                color: "white",
                borderRadius: "10px",
                padding: "10px",
                fontWeight: "900",
                cursor: "pointer",
              }}
            >
             Registro pendiente de conexión
            </button>
          </section>
        </div>

        {/* MENÚ INFERIOR */}
        <div
          style={{
            position: "fixed",
            bottom: 0,
            left: 0,
            right: 0,
            background: "#ffffff",
            borderTop: "1px solid #dce8f2",
            padding: "9px 10px 12px",
            display: "flex",
            justifyContent: "space-around",
            zIndex: 20,
          }}
        >
          {[
            ["🏠", "Inicio"],
            ["🗺️", "Mi ruta"],
            ["📅", "Mi semana"],
            ["🚑", "Ambulancia"],
            ["☰", "Más"],
          ].map(([icono, texto]) => (
            <div
              key={texto}
              style={{
                textAlign: "center",
                fontSize: "11px",
                color:
                  texto === "Inicio"
                    ? "#1675df"
                    : "#536d85",
                fontWeight:
                  texto === "Inicio"
                    ? "900"
                    : "700",
              }}
            >
              <div
                style={{
                  fontSize: "20px",
                }}
              >
                {icono}
              </div>

              {texto}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
