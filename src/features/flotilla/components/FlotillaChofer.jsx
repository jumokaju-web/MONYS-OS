import {
  useEffect,
  useState,
} from "react";

import {
  obtenerUnidadPorPlacas,
  obtenerRutaDeUnidadEnFecha,
} from "./services/flotillaService";

export default function FlotillaChofer({ volverAlDashboard }) {
  const [placasBuscadas, setPlacasBuscadas] = useState('');
  const [placasConsulta, setPlacasConsulta] = useState('');
  const [actualizacion, setActualizacion] = useState(0);

      const [
    unidad,
    setUnidad,
  ] = useState(null);

  const [
    cargandoUnidad,
    setCargandoUnidad,
  ] = useState(true);

  const [
    errorUnidad,
    setErrorUnidad,
  ] = useState("");

  useEffect(() => {
    if (!placasConsulta) { setUnidad(null); setCargandoUnidad(false); return; }
    let activo = true;
    setUnidad(null);

    const cargarUnidad = async () => {
      try {
        setCargandoUnidad(true);
        setErrorUnidad("");

        const resultado =
          await obtenerUnidadPorPlacas(
            placasConsulta
          );

        if (activo) {
          setUnidad(resultado);
          if (!resultado) setErrorUnidad("No se encontró una unidad accesible con esas placas.");
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
  }, [placasConsulta, actualizacion]);

      const [rutaHoy, setRutaHoy] = useState(null);
  const [cargandoRuta, setCargandoRuta] = useState(false);
  const [errorRuta, setErrorRuta] = useState("");

  useEffect(() => {
    setRutaHoy(null); setErrorRuta("");
    if (!unidad?.id) { setCargandoRuta(false); return; }

    let activo = true;

    const cargarRuta = async () => {
      try {
        setCargandoRuta(true);
        setErrorRuta("");

        const hoy = new Date();
        const fechaLocal = [
          hoy.getFullYear(),
          String(hoy.getMonth() + 1).padStart(2, "0"),
          String(hoy.getDate()).padStart(2, "0"),
        ].join("-");

        const resultado =
          await obtenerRutaDeUnidadEnFecha(
            unidad.id,
            fechaLocal
          );

        if (activo) {
          setRutaHoy(resultado);

        }
      } catch (error) {
        console.error("Error cargando ruta:", error);

        if (activo) {
          setErrorRuta(
            error?.message ||
              "No fue posible cargar la ruta."
          );
        }
      } finally {
        if (activo) setCargandoRuta(false);
      }
    };

    cargarRuta();

    return () => {
      activo = false;
    };
  }, [unidad?.id, actualizacion]);



    const choferReal =
    unidad?.chofer_nombre || "—";

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
        <section style={{ background: "white", border: "1px solid #d5e2ef", borderRadius: 14, padding: 16, marginBottom: 16 }}>
          <button type="button" onClick={volverAlDashboard}>Volver al inicio</button>
          <h2>Consulta tu unidad</h2><p>Escribe las placas de la unidad registrada. Se consultan los datos permitidos por tu sesión.</p>
          <form onSubmit={e => { e.preventDefault(); const placas = placasBuscadas.trim().toUpperCase(); if (!placas) return; setPlacasConsulta(placas); setActualizacion(v => v + 1); }}><label>Placas<input value={placasBuscadas} onChange={e => setPlacasBuscadas(e.target.value)} placeholder="Placas de la unidad" required maxLength={20} style={{ width: "100%", padding: 12, boxSizing: "border-box", margin: "8px 0" }} /></label><button type="submit">Consultar unidad y ruta</button></form>
          <p style={{ fontSize: 12 }}>Esta consulta no integra automáticamente la aplicación externa de Chory ni registra rutas nuevas.</p>
        </section>
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
            }}
          >
            🔔
          </div>
        </div>

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
              Chofer · {tipoReal}
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