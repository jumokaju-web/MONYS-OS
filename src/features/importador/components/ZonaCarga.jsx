import {
  useEffect,
  useRef,
  useState,
} from "react";
import {
  detectarReporte,
  encontrarFilaEncabezados,
} from "../utils/detectorReportes";
import {
  normalizarVentasPorArticulo,
  normalizarInventario,
  normalizarInventarioUtilidad,
  normalizarUtilidadVentas,
  normalizarExistencias,
  normalizarMovimientosCaja,
  normalizarCreditosProveedores,
} from "../utils/normalizador";
import { guardarImportacion } from "../services/importadorService";
import {
  generarResumenReporte,
  generarResumenInventario,
} from "../utils/resumenReporte";
import ResumenReporte from "./ResumenReporte";
import { generarAnalisisEjecutivo } from "../intelligence/generarAnalisisEjecutivo";
import { registrarConocimientoReporte } from "../../inteligencia/conocimiento/motorConocimiento";
import AnalisisEjecutivo from "./AnalisisEjecutivo";
import { ejecutarIA } from "../../../core/engine/iaEngine";
import { actualizarEmpresa } from "../../../core/engine/empresaActual";
import { useUser } from "../../../context/UserContext";
import {
  obtenerSucursalesInventario,
} from "../../inventario/services/inventarioService";

const REPORTES_ESPERADOS = [
  "Ventas por artículo",
  "Inventario",
  "Inventario / Utilidad",
  "Existencias",
  "Utilidad de ventas",
  "Movimientos de caja",
  "Créditos de proveedores",
];

function crearIdArchivo(file) {
  return `${file.name}-${file.size}-${file.lastModified}`;
}

function obtenerNormalizador(tipoReporte, filasDelReporte) {
  if (tipoReporte === "Ventas por artículo") {
    return normalizarVentasPorArticulo(filasDelReporte);
  }
if (tipoReporte === "Créditos de proveedores") {
  return normalizarCreditosProveedores(
    filasDelReporte
  );
}

if (tipoReporte === "Movimientos de caja") {
  return normalizarMovimientosCaja(
    filasDelReporte
  );
}

  if (tipoReporte === "Existencias") {
  return normalizarExistencias(filasDelReporte);
  }

  if (tipoReporte === "Inventario") {
    return normalizarInventario(filasDelReporte);
  }

  if (tipoReporte === "Inventario / Utilidad") {
    return normalizarInventarioUtilidad(filasDelReporte);
  }

  if (tipoReporte === "Utilidad de ventas") {
    return normalizarUtilidadVentas(filasDelReporte);
  }


  return [];
}

function generarResumen(tipoReporte, datosNormalizados) {
  if (tipoReporte === "Ventas por artículo") {
    return generarResumenReporte(datosNormalizados);
  }

  if (
    tipoReporte === "Inventario" ||
    tipoReporte === "Inventario / Utilidad"
  ) {
    return generarResumenInventario(datosNormalizados);
  }

  return null;
}

function obtenerColorEstado(estado) {
  const colores = {
    pendiente: {
      fondo: "#f7f4f5",
      borde: "#ddd5d9",
      texto: "#6f6469",
    },
    analizando: {
      fondo: "#fff8df",
      borde: "#f2dc8b",
      texto: "#8a6800",
    },
    listo: {
      fondo: "#eaf8f0",
      borde: "#b8e5ca",
      texto: "#207a4a",
    },
    importando: {
      fondo: "#f3e8ff",
      borde: "#d9b9f3",
      texto: "#713a8a",
    },
    importado: {
      fondo: "#eaf8f0",
      borde: "#98d7b0",
      texto: "#126c3b",
    },
    error: {
      fondo: "#fff0f0",
      borde: "#efb8b8",
      texto: "#a52d2d",
    },
    no_soportado: {
      fondo: "#fff4e8",
      borde: "#f4c69b",
      texto: "#9b4f12",
    },
  };

  return colores[estado] || colores.pendiente;
}

function obtenerEtiquetaEstado(estado) {
  const etiquetas = {
    pendiente: "Pendiente",
    analizando: "Analizando",
    listo: "Listo para importar",
    importando: "Importando",
    importado: "Importado",
    error: "Error",
    no_soportado: "Detectado, pendiente de integración",
  };

  return etiquetas[estado] || "Pendiente";
}

function ZonaCarga() {
  const { usuario } = useUser();
 const [sucursales, setSucursales] =
  useState([]);

const [
  branchIdSeleccionado,
  setBranchIdSeleccionado,
] = useState(
  usuario?.branch_id || ""
);

useEffect(() => {
  async function cargarSucursales() {
    try {
      const resultado =
        await obtenerSucursalesInventario();

      setSucursales(resultado || []);

      if (
        !branchIdSeleccionado &&
        usuario?.branch_id
      ) {
        setBranchIdSeleccionado(
          usuario.branch_id
        );
      }
    } catch (error) {
      console.error(
        "Error cargando sucursales:",
        error
      );
    }
  }

  cargarSucursales();
}, [
  usuario?.branch_id,
  branchIdSeleccionado,
]);

  console.log("USUARIO EN ZONA CARGA:", usuario);
  const inputArchivo = useRef(null);

  const [archivosProcesados, setArchivosProcesados] =
    useState([]);
  const [archivoActivoId, setArchivoActivoId] =
    useState(null);
  const [analizando, setAnalizando] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [arrastrando, setArrastrando] = useState(false);
  const [mensajeGeneral, setMensajeGeneral] = useState("");

  const archivoActivo =
    archivosProcesados.find(
      (item) => item.id === archivoActivoId
    ) || null;

  const archivosListos = archivosProcesados.filter(
    (item) => item.estado === "listo"
  );

  const archivosImportados = archivosProcesados.filter(
    (item) => item.estado === "importado"
  );

  const archivosConError = archivosProcesados.filter(
    (item) =>
      item.estado === "error" ||
      item.estado === "no_soportado"
  );

  const reportesDetectados = [
    ...new Set(
      archivosProcesados
        .map((item) => item.tipoReporte)
        .filter(Boolean)
    ),
  ];

  const reportesFaltantes = REPORTES_ESPERADOS.filter(
    (reporte) => !reportesDetectados.includes(reporte)
  );

  const totalArchivos = archivosProcesados.length;

  const totalProcesados = archivosProcesados.filter(
    (item) =>
      item.estado !== "pendiente" &&
      item.estado !== "analizando"
  ).length;

  const progreso =
    totalArchivos > 0
      ? Math.round((totalProcesados / totalArchivos) * 100)
      : 0;

  function seleccionarArchivos() {
    inputArchivo.current?.click();
  }

  function actualizarArchivo(id, cambios) {
    setArchivosProcesados((anteriores) =>
      anteriores.map((item) =>
        item.id === id
          ? {
              ...item,
              ...cambios,
            }
          : item
      )
    );
  }

  async function analizarArchivo(item) {
    actualizarArchivo(item.id, {
      estado: "analizando",
      error: "",
    });

    try {
      const resultadoIA = await ejecutarIA({
        file: item.file,
        contexto: {
          modulo: "Importador Inteligente SICAR 2.0",
          nombreArchivo: item.file.name,
          tamañoArchivo: item.file.size,
          tipoArchivo:
            item.file.type || "No disponible",
        },
      });

      if (!resultadoIA.exito) {
        const mensajeError =
          resultadoIA.errores?.join(" ") ||
          "MONYS OS no pudo procesar el archivo.";

        throw new Error(mensajeError);
      }

      const filas = resultadoIA.datosExcel || [];
     
      console.log("DATOS EXCEL", filas);

      if (!Array.isArray(filas) || filas.length === 0) {
        throw new Error(
          "El archivo no contiene información válida."
        );
      }

      const indiceEncabezados =
        encontrarFilaEncabezados(filas);

      if (indiceEncabezados === -1) {
        throw new Error(
          "No se encontró una fila válida de encabezados."
        );
      }

    const filasAntesEncabezados =
  filas.slice(0, indiceEncabezados);

let periodoInicio = null;
let periodoFin = null;

for (const filaCabecera of filasAntesEncabezados) {
  const indicePeriodo =
    filaCabecera.findIndex(
      (valor) =>
        String(valor ?? "")
          .trim()
          .toLowerCase()
          .replace(":", "") ===
        "periodo"
    );

  if (indicePeriodo === -1) {
    continue;
  }

  const fechasNumericas =
    filaCabecera
      .slice(indicePeriodo + 1)
      .map((valor) => Number(valor))
      .filter(
        (valor) =>
          Number.isFinite(valor) &&
          valor > 10000
      );

  if (fechasNumericas.length >= 2) {
    const convertirFechaExcel = (
      numeroExcel
    ) => {
      const milisegundos =
        Math.round(
          (numeroExcel - 25569) *
            86400 *
            1000
        );

      return new Date(milisegundos)
        .toISOString()
        .slice(0, 10);
    };

    periodoInicio =
      convertirFechaExcel(
        fechasNumericas[0]
      );

    periodoFin =
      convertirFechaExcel(
        fechasNumericas[1]
      );

    break;
  }
}

const filasDelReporte =
  filas.slice(indiceEncabezados);

const encabezados =
  filasDelReporte[0] || [];

const tipoReporte =
  detectarReporte(encabezados);

if (
  !tipoReporte ||
  tipoReporte === "Reporte desconocido"
) {
  throw new Error(
    "MONYS OS no pudo identificar el reporte SICAR."
  );
}

let datosNormalizados =
  obtenerNormalizador(
    tipoReporte,
    filasDelReporte
  );

if (
  tipoReporte ===
  "Ventas por artículo"
) {
  if (
    !periodoInicio ||
    !periodoFin
  ) {
    throw new Error(
      "MONYS OS no pudo detectar el periodo del reporte de Ventas por artículo."
    );
  }

  datosNormalizados =
    datosNormalizados.map(
      (fila) => ({
        ...fila,
        periodoInicio,
        periodoFin,
      })
    );
}

      const vistaPrevia =
        filasDelReporte.slice(0, 6);

      if (datosNormalizados.length === 0) {
        actualizarArchivo(item.id, {
          estado: "no_soportado",
          tipoReporte,
          vistaPrevia,
          resultadoMotor: resultadoIA,
          error:
            `El reporte "${tipoReporte}" fue reconocido, ` +
            "pero su normalizador todavía no está conectado.",
        });

        return;
      }

      const resumen = generarResumen(
        tipoReporte,
        datosNormalizados
      );

      const analisis = resumen
        ? generarAnalisisEjecutivo(resumen)
        : null;

      if (resumen) {
        registrarConocimientoReporte({
          tipoReporte,
          resumen,
          nombreArchivo: item.file.name,
        });
      }

      // ==========================================
// Actualizar Memoria Central de MONYS OS
// ==========================================

if (tipoReporte === "Ventas por artículo" && resumen) {
  actualizarEmpresa("ventas", {
    total: resumen.ventasTotales ?? 0,
    utilidad: resumen.utilidadTotal ?? 0,
    margen: resumen.margenPromedio ?? 0,
    productosVendidos: datosNormalizados,
  });
}

if (
  (tipoReporte === "Inventario" ||
    tipoReporte === "Inventario / Utilidad") &&
  resumen
) {
  actualizarEmpresa("inventario", {
    valor: resumen.valorInventario ?? 0,
    productos: datosNormalizados,
    agotados: resumen.productosAgotados ?? [],
    sobreInventario:
      resumen.productosSobreInventario ?? [],
  });
}

      actualizarArchivo(item.id, {
        estado: "listo",
        tipoReporte,
        vistaPrevia,
        datosNormalizados,
        resumen,
        analisis,
        resultadoMotor: resultadoIA,
        totalRegistros: datosNormalizados.length,
        error: "",
      });

      console.log(
        "Archivo procesado por MONYS OS:",
        {
          archivo: item.file.name,
          tipoReporte,
          datosNormalizados,
          resumen,
          analisis,
        }
      );
    } catch (error) {
      console.error(
        `Error al analizar ${item.file.name}:`,
        error
      );

      actualizarArchivo(item.id, {
        estado: "error",
        error: error.message,
      });
    }
  }

  async function procesarArchivos(files) {
    const listaArchivos = Array.from(files || []);

    if (listaArchivos.length === 0) {
      return;
    }

    const extensionesPermitidas = [
      ".xlsx",
      ".xls",
      ".csv",
    ];

    const archivosValidos = listaArchivos.filter(
      (file) =>
        extensionesPermitidas.some((extension) =>
          file.name.toLowerCase().endsWith(extension)
        )
    );

    if (archivosValidos.length === 0) {
      setMensajeGeneral(
        "❌ Selecciona archivos Excel, XLS o CSV."
      );

      return;
    }

    const idsExistentes = new Set(
      archivosProcesados.map((item) => item.id)
    );

    const archivosNuevos = archivosValidos
      .map((file) => ({
        id: crearIdArchivo(file),
        file,
        nombre: file.name,
        tamaño: file.size,
        estado: "pendiente",
        tipoReporte: "",
        vistaPrevia: [],
        datosNormalizados: [],
        resumen: null,
        analisis: null,
        resultadoMotor: null,
        totalRegistros: 0,
        error: "",
      }))
      .filter((item) => !idsExistentes.has(item.id));

    if (archivosNuevos.length === 0) {
      setMensajeGeneral(
        "⚠️ Los archivos seleccionados ya están en la cola."
      );

      return;
    }

    setMensajeGeneral("");
    setAnalizando(true);

    setArchivosProcesados((anteriores) => [
      ...anteriores,
      ...archivosNuevos,
    ]);

    if (!archivoActivoId) {
      setArchivoActivoId(archivosNuevos[0].id);
    }

    for (const item of archivosNuevos) {
      await analizarArchivo(item);
    }

    setAnalizando(false);

    if (inputArchivo.current) {
      inputArchivo.current.value = "";
    }
  }

  function archivosSeleccionados(evento) {
    procesarArchivos(evento.target.files);
  }

  function manejarArrastre(evento) {
    evento.preventDefault();
    evento.stopPropagation();

    if (evento.type === "dragenter") {
      setArrastrando(true);
    }

    if (evento.type === "dragleave") {
      setArrastrando(false);
    }
  }

  function recibirArchivos(evento) {
    evento.preventDefault();
    evento.stopPropagation();

    setArrastrando(false);
    procesarArchivos(evento.dataTransfer.files);
  }

  function quitarArchivo(id) {
    setArchivosProcesados((anteriores) =>
      anteriores.filter((item) => item.id !== id)
    );

    if (archivoActivoId === id) {
      const restantes = archivosProcesados.filter(
        (item) => item.id !== id
      );

      setArchivoActivoId(restantes[0]?.id || null);
    }

    setMensajeGeneral("");
  }

  function limpiarTodo() {
    setArchivosProcesados([]);
    setArchivoActivoId(null);
    setMensajeGeneral("");

    if (inputArchivo.current) {
      inputArchivo.current.value = "";
    }
  }

  async function importarTodos() {
    const pendientesDeImportar =
      archivosProcesados.filter(
        (item) => item.estado === "listo"
      );

    if (pendientesDeImportar.length === 0) {
      setMensajeGeneral(
        "No existen reportes listos para importar."
      );

      return;
    }

    try {
      setGuardando(true);
      setMensajeGeneral(
        `Importando ${pendientesDeImportar.length} reportes en MONYS OS...`
      );

      let importadosCorrectamente = 0;
      let importacionesConError = 0;

      for (const item of pendientesDeImportar) {
        actualizarArchivo(item.id, {
          estado: "importando",
        });

        try {
         const importacionGuardada =
 await guardarImportacion({
  tipoReporte: item.tipoReporte,
  archivoOriginal: item.nombre,
  datosNormalizados:
    item.datosNormalizados,
 branchId:
  branchIdSeleccionado || null,
});
          actualizarArchivo(item.id, {
            estado: "importado",
          });

          importadosCorrectamente += 1;
        } catch (error) {
          console.error(
            `Error al importar ${item.nombre}:`,
            error
          );

          actualizarArchivo(item.id, {
            estado: "error",
            error:
              `No se pudo guardar en Supabase: ${error.message}`,
          });

          importacionesConError += 1;
        }
      }

      if (importacionesConError === 0) {
        setMensajeGeneral(
          `✅ Importación masiva completada. ` +
            `${importadosCorrectamente} reportes guardados correctamente.`
        );
      } else {
        setMensajeGeneral(
          `⚠️ Se importaron ${importadosCorrectamente} reportes y ` +
            `${importacionesConError} presentaron errores.`
        );
      }
    } finally {
      setGuardando(false);
    }
  }

  const indicesColumnasVisibles =
    archivoActivo?.vistaPrevia?.length > 0
      ? archivoActivo.vistaPrevia[0]
          .map((encabezado, indice) => {
            const encabezadoTieneContenido =
              String(encabezado ?? "").trim() !== "";

            const algunaFilaTieneContenido =
              archivoActivo.vistaPrevia
                .slice(1)
                .some(
                  (fila) =>
                    String(
                      fila[indice] ?? ""
                    ).trim() !== ""
                );

            return encabezadoTieneContenido ||
              algunaFilaTieneContenido
              ? indice
              : null;
          })
          .filter((indice) => indice !== null)
      : [];

  return (
    <section
      style={{
        padding: "clamp(20px, 4vw, 38px)",
        borderRadius: "24px",
        background:
          "linear-gradient(135deg, #fff8fc 0%, #ffffff 100%)",
        border: "1px solid #edc6d9",
        boxShadow:
          "0 12px 30px rgba(122, 49, 95, 0.08)",
      }}
    >
      <div
        style={{
          textAlign: "center",
          marginBottom: "28px",
        }}
      >
        <p
          style={{
            margin: "0 0 8px",
            color: "#b44178",
            fontWeight: "800",
            letterSpacing: "1.3px",
          }}
        >
          MONYS OS · SICAR INTELLIGENCE
        </p>

        <h2
          style={{
            margin: 0,
            fontSize: "clamp(28px, 4vw, 40px)",
          }}
        >
          📥 Importador Inteligente 2.0
        </h2>

        <p
          style={{
            margin: "12px auto 0",
            maxWidth: "720px",
            color: "#6f6469",
            lineHeight: "1.6",
          }}
        >
          Selecciona o arrastra varios reportes de SICAR.
          MONYS OS los reconocerá y preparará
          automáticamente.
        </p>
      </div>
      <div
  style={{
    margin: "22px auto 0",
    maxWidth: "420px",
    textAlign: "left",
  }}
>
  <label
    style={{
      display: "block",
      marginBottom: "8px",
      fontWeight: "800",
      color: "#7a315f",
    }}
  >
    Sucursal del reporte
  </label>

  <select
    value={branchIdSeleccionado}
    onChange={(evento) =>
      setBranchIdSeleccionado(
        evento.target.value
      )
    }
    style={{
      width: "100%",
      padding: "12px 14px",
      borderRadius: "10px",
      border: "1px solid #d4b5c7",
      backgroundColor: "#ffffff",
      fontSize: "15px",
    }}
  >
    <option value="">
      Selecciona una sucursal
    </option>

    {sucursales.map((sucursal) => (
      <option
        key={sucursal.id}
        value={sucursal.id}
      >
        {sucursal.name}
      </option>
    ))}
  </select>
</div>
      <div
        onClick={seleccionarArchivos}
        onDragEnter={manejarArrastre}
        onDragOver={(evento) => {
          evento.preventDefault();
          evento.stopPropagation();
        }}
        onDragLeave={manejarArrastre}
        onDrop={recibirArchivos}
        style={{
          padding: "50px 25px",
          borderRadius: "20px",
          border: arrastrando
            ? "3px dashed #7a315f"
            : "3px dashed #d4b5c7",
          backgroundColor: arrastrando
            ? "#fff0f7"
            : "#ffffff",
          textAlign: "center",
          cursor:
            analizando || guardando
              ? "not-allowed"
              : "pointer",
          transition: "all 0.2s ease",
        }}
      >
        <div
          style={{
            fontSize: "64px",
            marginBottom: "16px",
          }}
        >
          {analizando ? "🤖" : "📂"}
        </div>

        <h3
          style={{
            margin: "0 0 10px",
            fontSize: "23px",
          }}
        >
          {analizando
            ? "MONYS OS está analizando los reportes"
            : "Arrastra aquí tus reportes SICAR"}
        </h3>

        <p
          style={{
            margin: 0,
            color: "#756971",
          }}
        >
          También puedes hacer clic para seleccionar
          varios archivos.
        </p>

        <input
          ref={inputArchivo}
          type="file"
          multiple
          accept=".xlsx,.xls,.csv"
          style={{ display: "none" }}
          onChange={archivosSeleccionados}
          disabled={analizando || guardando}
        />
      </div>

      {totalArchivos > 0 && (
        <>
          <div
            style={{
              marginTop: "26px",
              padding: "22px",
              borderRadius: "18px",
              backgroundColor: "#ffffff",
              border: "1px solid #ead5df",
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                flexWrap: "wrap",
                gap: "12px",
                marginBottom: "12px",
              }}
            >
              <strong>
                Progreso de análisis
              </strong>

              <span
                style={{
                  color: "#7a315f",
                  fontWeight: "800",
                }}
              >
                {progreso}%
              </span>
            </div>

            <div
              style={{
                height: "12px",
                borderRadius: "999px",
                backgroundColor: "#f0e5eb",
                overflow: "hidden",
              }}
            >
              <div
                style={{
                  width: `${progreso}%`,
                  height: "100%",
                  borderRadius: "999px",
                  background:
                    "linear-gradient(90deg, #c44583, #7a315f)",
                  transition: "width 0.3s ease",
                }}
              />
            </div>

            <div
              style={{
                display: "grid",
                gridTemplateColumns:
                  "repeat(auto-fit, minmax(150px, 1fr))",
                gap: "12px",
                marginTop: "18px",
              }}
            >
              <div>
                <strong>{totalArchivos}</strong>
                <p style={{ margin: "4px 0 0" }}>
                  Archivos agregados
                </p>
              </div>

              <div>
                <strong>{archivosListos.length}</strong>
                <p style={{ margin: "4px 0 0" }}>
                  Listos para importar
                </p>
              </div>

              <div>
                <strong>
                  {archivosImportados.length}
                </strong>
                <p style={{ margin: "4px 0 0" }}>
                  Importados
                </p>
              </div>

              <div>
                <strong>
                  {archivosConError.length}
                </strong>
                <p style={{ margin: "4px 0 0" }}>
                  Requieren revisión
                </p>
              </div>
            </div>
          </div>

          <div
            style={{
              marginTop: "24px",
              display: "grid",
              gridTemplateColumns:
                "repeat(auto-fit, minmax(280px, 1fr))",
              gap: "14px",
            }}
          >
            {archivosProcesados.map((item) => {
              const estilo =
                obtenerColorEstado(item.estado);

              const seleccionado =
                archivoActivoId === item.id;

              return (
                <article
                  key={item.id}
                  onClick={() =>
                    setArchivoActivoId(item.id)
                  }
                  style={{
                    padding: "18px",
                    borderRadius: "16px",
                    backgroundColor: estilo.fondo,
                    border: seleccionado
                      ? "2px solid #7a315f"
                      : `1px solid ${estilo.borde}`,
                    cursor: "pointer",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      justifyContent:
                        "space-between",
                      alignItems: "flex-start",
                      gap: "12px",
                    }}
                  >
                    <div
                      style={{
                        minWidth: 0,
                      }}
                    >
                      <strong
                        style={{
                          display: "block",
                          wordBreak: "break-word",
                        }}
                      >
                        📄 {item.nombre}
                      </strong>

                      <p
                        style={{
                          margin: "8px 0 0",
                          color: estilo.texto,
                          fontWeight: "700",
                        }}
                      >
                        {obtenerEtiquetaEstado(
                          item.estado
                        )}
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={(evento) => {
                        evento.stopPropagation();
                        quitarArchivo(item.id);
                      }}
                      disabled={
                        item.estado ===
                          "importando" ||
                        guardando
                      }
                      style={{
                        border: "none",
                        background: "transparent",
                        cursor: "pointer",
                        fontSize: "18px",
                      }}
                      title="Quitar archivo"
                    >
                      ✕
                    </button>
                  </div>

                  {item.tipoReporte && (
                    <p
                      style={{
                        margin: "12px 0 0",
                        fontWeight: "700",
                      }}
                    >
                      🤖 {item.tipoReporte}
                    </p>
                  )}

                  {item.totalRegistros > 0 && (
                    <p
                      style={{
                        margin: "7px 0 0",
                      }}
                    >
                      {item.totalRegistros} registros
                      preparados
                    </p>
                  )}

                  {item.error && (
                    <p
                      style={{
                        margin: "10px 0 0",
                        color: "#a52d2d",
                        lineHeight: "1.5",
                      }}
                    >
                      {item.error}
                    </p>
                  )}
                </article>
              );
            })}
          </div>

          <div
            style={{
              marginTop: "24px",
              padding: "22px",
              borderRadius: "18px",
              backgroundColor: "#ffffff",
              border: "1px solid #ead5df",
            }}
          >
            <h3 style={{ marginTop: 0 }}>
              📋 Control de reportes SICAR
            </h3>

            <div
              style={{
                display: "grid",
                gridTemplateColumns:
                  "repeat(auto-fit, minmax(260px, 1fr))",
                gap: "18px",
              }}
            >
              <div>
                <strong
                  style={{
                    color: "#207a4a",
                  }}
                >
                  ✅ Reportes detectados
                </strong>

                {reportesDetectados.length > 0 ? (
                  reportesDetectados.map(
                    (reporte) => (
                      <p
                        key={reporte}
                        style={{
                          margin: "8px 0 0",
                        }}
                      >
                        • {reporte}
                      </p>
                    )
                  )
                ) : (
                  <p>Todavía no hay reportes.</p>
                )}
              </div>

              <div>
                <strong
                  style={{
                    color: "#8a6800",
                  }}
                >
                  ⚠️ Reportes faltantes
                </strong>

                {reportesFaltantes.length > 0 ? (
                  reportesFaltantes.map(
                    (reporte) => (
                      <p
                        key={reporte}
                        style={{
                          margin: "8px 0 0",
                        }}
                      >
                        • {reporte}
                      </p>
                    )
                  )
                ) : (
                  <p>
                    Se cargaron todos los reportes
                    configurados.
                  </p>
                )}
              </div>
            </div>
          </div>
        </>
      )}

      {archivoActivo && (
        <div
          style={{
            marginTop: "28px",
          }}
        >
          <div
            style={{
              padding: "22px",
              borderRadius: "18px",
              backgroundColor: "#ffffff",
              border: "1px solid #ead5df",
            }}
          >
            <h3 style={{ marginTop: 0 }}>
              🔎 Detalle del reporte seleccionado
            </h3>

            <p>
              <strong>Archivo:</strong>{" "}
              {archivoActivo.nombre}
            </p>

            <p>
              <strong>Reporte:</strong>{" "}
              {archivoActivo.tipoReporte ||
                "Pendiente de detección"}
            </p>

            <p>
              <strong>Tamaño:</strong>{" "}
              {(archivoActivo.tamaño / 1024).toFixed(
                2
              )}{" "}
              KB
            </p>
          </div>

          {archivoActivo.vistaPrevia.length > 0 && (
            <div
              style={{
                marginTop: "20px",
                padding: "20px",
                borderRadius: "18px",
                backgroundColor: "#ffffff",
                border: "1px solid #ead5df",
                overflowX: "auto",
              }}
            >
              <h3 style={{ marginTop: 0 }}>
                Vista previa
              </h3>

              <table
                style={{
                  width: "100%",
                  borderCollapse: "collapse",
                  minWidth: "700px",
                }}
              >
                <thead>
                  <tr>
                    {indicesColumnasVisibles.map(
                      (indice) => (
                        <th
                          key={indice}
                          style={{
                            textAlign: "left",
                            padding: "12px",
                            backgroundColor:
                              "#f3e8ff",
                            borderBottom:
                              "1px solid #dddddd",
                          }}
                        >
                          {archivoActivo
                            .vistaPrevia[0][
                            indice
                          ] ||
                            `Columna ${
                              indice + 1
                            }`}
                        </th>
                      )
                    )}
                  </tr>
                </thead>

                <tbody>
                  {archivoActivo.vistaPrevia
                    .slice(1)
                    .map(
                      (
                        fila,
                        indiceFila
                      ) => (
                        <tr key={indiceFila}>
                          {indicesColumnasVisibles.map(
                            (
                              indiceColumna
                            ) => (
                              <td
                                key={
                                  indiceColumna
                                }
                                style={{
                                  padding:
                                    "12px",
                                  borderBottom:
                                    "1px solid #eeeeee",
                                }}
                              >
                                {fila[
                                  indiceColumna
                                ] ?? ""}
                              </td>
                            )
                          )}
                        </tr>
                      )
                    )}
                </tbody>
              </table>
            </div>
          )}

          {archivoActivo.resumen && (
            <ResumenReporte
              resumen={archivoActivo.resumen}
            />
          )}

          {archivoActivo.analisis && (
            <AnalisisEjecutivo
              analisis={archivoActivo.analisis}
            />
          )}
        </div>
      )}

      {totalArchivos > 0 && (
        <div
          style={{
            marginTop: "28px",
            display: "flex",
            justifyContent: "center",
            flexWrap: "wrap",
            gap: "14px",
          }}
        >
          <button
            type="button"
            onClick={importarTodos}
            disabled={
              guardando ||
              analizando ||
              archivosListos.length === 0
            }
            style={{
              padding: "15px 28px",
              borderRadius: "12px",
              border: "none",
              cursor:
                guardando ||
                analizando ||
                archivosListos.length === 0
                  ? "not-allowed"
                  : "pointer",
              background:
                guardando ||
                analizando ||
                archivosListos.length === 0
                  ? "#b8a5b1"
                  : "#7a315f",
              color: "#ffffff",
              fontWeight: "800",
              fontSize: "16px",
            }}
          >
            {guardando
              ? "Guardando reportes..."
              : `🚀 Importar ${archivosListos.length} reportes a MONYS OS`}
          </button>

          <button
            type="button"
            onClick={limpiarTodo}
            disabled={guardando || analizando}
            style={{
              padding: "15px 24px",
              borderRadius: "12px",
              border: "1px solid #cdb5c1",
              cursor:
                guardando || analizando
                  ? "not-allowed"
                  : "pointer",
              backgroundColor: "#ffffff",
              color: "#6f3a57",
              fontWeight: "800",
            }}
          >
            Limpiar lista
          </button>
        </div>
      )}

      {mensajeGeneral && (
        <p
          style={{
            marginTop: "20px",
            padding: "16px",
            borderRadius: "12px",
            backgroundColor:
              mensajeGeneral.startsWith("❌")
                ? "#fff0f0"
                : mensajeGeneral.startsWith("⚠️")
                  ? "#fff8df"
                  : "#eaf8f0",
            color:
              mensajeGeneral.startsWith("❌")
                ? "#a52d2d"
                : mensajeGeneral.startsWith("⚠️")
                  ? "#8a6800"
                  : "#207a4a",
            fontWeight: "700",
            textAlign: "center",
          }}
        >
          {mensajeGeneral}
        </p>
      )}
    </section>
  );
}

export default ZonaCarga;