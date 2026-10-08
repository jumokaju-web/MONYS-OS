import ZonaCarga from "../components/ZonaCarga";
function ImportadorPage({ volverAlDashboard }) {
  return (
    <main
      style={{
        minHeight: "100vh",
        background: "#f8f5f7",
        padding: "24px",
      }}
    >
      <section
        style={{
          maxWidth: "1000px",
          margin: "0 auto",
        }}
      >
        <button
          type="button"
          onClick={volverAlDashboard}
          style={{
            border: "none",
            background: "transparent",
            color: "#7a315f",
            fontWeight: "700",
            cursor: "pointer",
            marginBottom: "18px",
          }}
        >
          ← Regresar al dashboard
        </button>

        <header style={{ marginBottom: "24px" }}>
          <p
            style={{
              margin: "0 0 6px",
              color: "#9b4f80",
              fontWeight: "700",
            }}
          >
            MONYS Intelligence
          </p>

          <h1
            style={{
              margin: "0",
              color: "#3f2436",
              fontSize: "32px",
            }}
          >
            Importador inteligente SICAR
          </h1>

          <p
            style={{
              color: "#6f626a",
              maxWidth: "700px",
            }}
          >
            Sube reportes de SICAR para que MONYS Intelligence los
            identifique, organice y prepare para su análisis.
          </p>
        </header>
        
<section style={{background:'#fffafc',border:'1px solid #ead8e2',borderRadius:16,padding:20,marginBottom:20}} aria-label="Guía para cargar información financiera"><h2 style={{color:'#5e3048',marginTop:0}}>Carga tus reportes · paso a paso</h2><ol><li>Selecciona Centro o General Anaya antes de elegir archivos.</li><li>Sube el Excel o CSV original de SICAR. Puedes elegir varios reportes de la misma tienda.</li><li>Revisa el tipo detectado, los registros y la vista previa. Preparado no significa guardado.</li><li>Pulsa Importar y espera la confirmación de cada archivo. Si aparece un error, revisa su detalle antes de reintentar.</li><li>Regresa al inicio para consultar los datos. Para comparar tiendas, sus reportes deben cubrir el mismo periodo.</li></ol><details><summary>Qué necesitas para conocer tus números</summary><p>Utilidad de ventas: ventas, costo y utilidad bruta. Ventas por artículo: productos y unidades. Movimientos de caja: entradas y salidas. Créditos de proveedores: saldos y fechas reportadas. Inventario y existencias: stock disponible.</p><p>Estados bancarios PDF, capturas, gastos y nómina todavía no tienen un importador completo en este flujo. No se convertirán automáticamente en registros conciliados. Las ventas y la utilidad bruta no equivalen a dinero disponible ni utilidad neta.</p><p>Evita volver a subir un reporte ya importado. Las nuevas cargas comprueban el contenido normalizado, tipo y sucursal antes de guardar. Las importaciones antiguas no tienen esta identificación y todavía pueden requerir revisión manual.</p></details></section><ZonaCarga />
       
      </section>
    </main>
  );
}

export default ImportadorPage;