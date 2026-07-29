import { useRef, useState } from "react";
import {
  detectarReporte,
  encontrarFilaEncabezados,
} from "../utils/detectorReportes";
import {
  normalizarVentasPorArticulo,
  normalizarInventario,
  normalizarInventarioUtilidad,
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
import * as XLSX from "xlsx";

function ZonaCarga() {
  const inputArchivo = useRef(null);
  const [archivo, setArchivo] = useState(null);
  const [vistaPrevia, setVistaPrevia] = useState([]);
  const [tipoReporte, setTipoReporte] = useState("");
  const [datosParaImportar, setDatosParaImportar] = useState([]);
  const [guardando, setGuardando] = useState(false);
  const [mensajeImportacion, setMensajeImportacion] = useState("");
  const [resumenReporte, setResumenReporte] = useState(null);
  const [analisisEjecutivo, setAnalisisEjecutivo] = useState(null);
  function seleccionarArchivo() {
    inputArchivo.current.click();
  }
function archivoSeleccionado(evento) {
  const nuevoArchivo = evento.target.files[0];

  if (!nuevoArchivo) return;

  setArchivo(nuevoArchivo);
  setTipoReporte("Analizando...");

  const lector = new FileReader();

  lector.onload = (resultado) => {
    try {
      const datos = new Uint8Array(resultado.target.result);

      const libroExcel = XLSX.read(datos, {
        type: "array",
      });

      const nombrePrimeraHoja =
        libroExcel.SheetNames[0];

      const primeraHoja =
        libroExcel.Sheets[nombrePrimeraHoja];

      const filas = XLSX.utils.sheet_to_json(
        primeraHoja,
        {
          header: 1,
          defval: "",
        }
      );

    console.log(
  "PRIMERAS FILAS DEL ARCHIVO:",
  filas.slice(0, 20)
);

     const indiceEncabezados =
  encontrarFilaEncabezados(filas);

if (indiceEncabezados === -1) {
  setTipoReporte("Reporte desconocido");
  setVistaPrevia([]);
  setDatosParaImportar([]);
  setResumenReporte(null);
  setAnalisisEjecutivo(null);

  throw new Error(
    "No se encontró una fila válida de encabezados."
  );
}

const filasDelReporte =
  filas.slice(indiceEncabezados);

const encabezados =
  filasDelReporte[0] || [];

const reporteDetectado =
  detectarReporte(encabezados);

      setTipoReporte(reporteDetectado);
    
    setVistaPrevia(filasDelReporte.slice(0, 6));
   
      let datosNormalizados = [];

if (reporteDetectado === "Ventas por artículo") {
  datosNormalizados =
    normalizarVentasPorArticulo(filasDelReporte);
}

if (reporteDetectado === "Inventario") {
  datosNormalizados =
    normalizarInventario(filasDelReporte);
}

if (reporteDetectado === "Inventario / Utilidad") {
  datosNormalizados =
    normalizarInventarioUtilidad(filasDelReporte);
}

  setDatosParaImportar(datosNormalizados);

let resumen = null;

if (reporteDetectado === "Ventas por artículo") {
  resumen =
    generarResumenReporte(datosNormalizados);
}

if (
  reporteDetectado === "Inventario" ||
  reporteDetectado === "Inventario / Utilidad"
) {
  resumen =
    generarResumenInventario(datosNormalizados);
}

setResumenReporte(resumen);

if (resumen) {
  const conocimientoRegistrado =
    registrarConocimientoReporte({
      tipoReporte: reporteDetectado,
      resumen,
      nombreArchivo: nuevoArchivo.name,
    });

  console.log(
    "Conocimiento empresarial registrado:",
    conocimientoRegistrado
  );
}

const analisis =
  generarAnalisisEjecutivo(resumen);

setAnalisisEjecutivo(analisis);

console.log(
  "Análisis ejecutivo:",
  analisis
);

console.log(
  "Resumen inteligente:",
  resumen
);

console.log(
  "Datos normalizados:",
  datosNormalizados
);

console.log("Todas las filas:", filas);

      console.log(
        "Encabezados encontrados:",
        encabezados
      );

      console.log(
        "Reporte detectado:",
        reporteDetectado
      );
    } catch (error) {
      console.error(
        "Error al leer el archivo:",
        error
      );

      setTipoReporte(
        "No fue posible analizar el archivo"
      );
    }
  };

  lector.onerror = () => {
    setTipoReporte(
      "No fue posible leer el archivo"
    );
  };

  lector.readAsArrayBuffer(nuevoArchivo);
}
 
async function importarASupabase() {
  if (!archivo || datosParaImportar.length === 0) {
    setMensajeImportacion(
      "Primero selecciona un archivo válido para importar."
    );
    return;
  }

  try {
    setGuardando(true);
    setMensajeImportacion("Guardando información en MONYS...");

    const importacion = await guardarImportacion({
      tipoReporte,
      archivoOriginal: archivo.name,
      datosNormalizados: datosParaImportar,
    });

    setMensajeImportacion(
      `✅ Importación completada. Se guardaron ${datosParaImportar.length} filas.`
    );

    console.log("Importación guardada:", importacion);
  } catch (error) {
    console.error("Error al importar:", error);

    setMensajeImportacion(
      `❌ No se pudo completar la importación: ${error.message}`
    );
  } finally {
    setGuardando(false);
  }
}

const indicesColumnasVisibles =
  vistaPrevia.length > 0
    ? vistaPrevia[0]
        .map((encabezado, indice) => {
          const encabezadoTieneContenido =
            String(encabezado ?? "").trim() !== "";

          const algunaFilaTieneContenido =
            vistaPrevia
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
        border: "3px dashed #d4b5c7",
        borderRadius: "18px",
        padding: "60px 30px",
        textAlign: "center",
        background: "#fff",
      }}
    >
      <div
        style={{
          fontSize: "70px",
          marginBottom: "20px",
        }}
      >
        📄
    
      </div>

      <h2>Importador Inteligente SICAR</h2>

      <p>
        Selecciona un reporte de SICAR para comenzar el análisis.
      </p>

     {resumenReporte && (
  <ResumenReporte resumen={resumenReporte} />
)}

{analisisEjecutivo && (
  <AnalisisEjecutivo analisis={analisisEjecutivo} />
)}

      <button
        onClick={seleccionarArchivo}
        style={{
          marginTop: "20px",
          padding: "14px 24px",
          borderRadius: "10px",
          border: "none",
          cursor: "pointer",
          background: "#7a315f",
          color: "white",
          fontWeight: "bold",
        }}
      >
        Seleccionar archivo
      </button>

      <input
        ref={inputArchivo}
        type="file"
        accept=".xlsx,.xls,.csv"
        style={{ display: "none" }}
        onChange={archivoSeleccionado}
      />
      {archivo && (
  <div
    style={{
      marginTop: "30px",
      padding: "18px",
      borderRadius: "12px",
      background: "#f8f5f7",
      border: "1px solid #d8b8cb",
      textAlign: "left",
    }}
  >
    <h3 style={{ marginTop: 0 }}>
      📄 Archivo seleccionado
    </h3>

    <p>
      <strong>Nombre:</strong> {archivo.name}
    </p>

    <p>
      <strong>Tamaño:</strong>{" "}
      {(archivo.size / 1024).toFixed(2)} KB
    </p>

    <p>
      <strong>Tipo:</strong>{" "}
      {archivo.type || "No disponible"}
    </p>

    <p
      style={{
        color: "green",
        fontWeight: "bold",
        marginBottom: 0,
      }}
    >
      🟢 Archivo listo para analizar
    </p>
    <p
  style={{
    color: "#7a315f",
    fontWeight: "bold",
    marginTop: "10px",
    marginBottom: 0,
  }}
>
  🤖 Detector: {tipoReporte}
</p>
  </div>
)}
 

{vistaPrevia.length > 0 && (
  <div
    style={{
      marginTop: "24px",
      background: "#ffffff",
      borderRadius: "16px",
      padding: "20px",
      boxShadow: "0 8px 24px rgba(0,0,0,0.08)",
      overflowX: "auto",
    }}
  >
    <h3 style={{ marginBottom: "16px" }}>
      Vista previa del reporte
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
    {indicesColumnasVisibles.map((indice) => {
      const encabezado =
        vistaPrevia[0][indice];

      return (
        <th
          key={indice}
          style={{
            textAlign: "left",
            padding: "12px",
            background: "#f3e8ff",
            borderBottom:
              "1px solid #dddddd",
          }}
        >
          {encabezado ||
            `Columna ${indice + 1}`}
        </th>
      );
    })}
  </tr>
</thead>

      <tbody>
        {vistaPrevia.slice(1).map((fila, indiceFila) => (
          <tr key={indiceFila}>
          {indicesColumnasVisibles.map((indiceColumna) => (
              <td
                key={indiceColumna}
                style={{
                  padding: "12px",
                  borderBottom: "1px solid #eeeeee",
                }}
              >
                {fila[indiceColumna] ?? ""}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  </div>
)}

{datosParaImportar.length > 0 && (
  <div
    style={{
      marginTop: "24px",
      textAlign: "center",
    }}
  >
    <button
      onClick={importarASupabase}
      disabled={guardando}
      style={{
        padding: "14px 28px",
        borderRadius: "10px",
        border: "none",
        cursor: guardando ? "not-allowed" : "pointer",
        background: guardando ? "#b8a5b1" : "#7a315f",
        color: "white",
        fontWeight: "bold",
        fontSize: "16px",
      }}
    >
      {guardando
        ? "Guardando en MONYS..."
        : "🚀 Importar a MONYS"}
    </button>

    {mensajeImportacion && (
      <p
        style={{
          marginTop: "16px",
          fontWeight: "bold",
          color: mensajeImportacion.startsWith("❌")
            ? "#b42318"
            : "#276749",
        }}
      >
        {mensajeImportacion}
      </p>
    )}
  </div>
)}

</section>

  );
}

export default ZonaCarga;