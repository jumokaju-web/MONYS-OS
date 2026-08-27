import {
  useEffect,
  useState,
} from "react";

import "./App.css";

import CentroUsuarios from "./features/usuarios/components/CentroUsuarios";
import { systemConfig } from "./core/config/systemConfig";
import { useUser } from "./context/UserContext";

import Header from "./components/layout/Header";

import Indicadores from "./features/dashboard/Indicadores";
import DirectorGeneralIA from "./features/dashboard/DirectorGeneralIA";
import AccionesPrioritarias from "./features/inteligencia/components/AccionesPrioritarias";
import AccionesRapidas from "./features/dashboard/AccionesRapidas";
import SicarResumen from "./features/dashboard/components/SicarResumen";
import OperacionHoy from "./features/inteligencia/components/OperacionHoy";
import InicioEmpleado from "./features/inteligencia/components/InicioEmpleado";
import InicioJefa from "./features/dashboard/InicioJefa";
import CierreTurno from "./features/inteligencia/components/CierreTurno";
import CentroOrdenes from "./features/ordenes/components/CentroOrdenes";
import TesoreriaPage from "./features/tesoreria/pages/TesoreriaPage";
import InventarioPage from "./features/inventario/pages/InventarioPage";
import CompraMaestraPage from "./features/inventario/pages/CompraMaestraPage";
import ImportadorPage from "./features/importador/pages/ImportadorPage";
import DashboardPage from "./features/dashboard/pages/DashboardPage";
import CentroInteligencia from "./features/inteligencia/CentroInteligencia";

import {
  useDashboardData,
} from "./features/dashboard/hooks/useDashboardData";

import HistorialMovimientos from "./features/tesoreria/components/HistorialMovimientos";

import {
  actualizarEstadoMovimientoTesoreria,
  obtenerMovimientosTesoreria,
} from "./features/tesoreria/services/tesoreriaService";

const modulos = [
  ["💰", "Registrar dinero"],
  ["📦", "Producto solicitado"],
  ["🛒", "Compra Maestra"],
  ["⚠️", "Problemas e incidencias"],
  ["💡", "Ideas y oportunidades"],
  ["🚚", "Flotilla"],
  ["📄", "Importar reportes"],
  ["📋", "Centro de Órdenes"],
  ["👥", "Usuarios"],
  ["🤖", "Director General IA"],
];

function App() {
  const {
    usuario,
    permisos,
    tienePermiso,
    cargandoUsuario,
    errorUsuario,
    cargandoPermisos,
    errorPermisos,
  } = useUser();

  console.log(
    "USUARIO MONYS OS:",
    usuario
  );

  console.log(
    "PERMISOS MONYS OS:",
    permisos
  );

  const appName =
    systemConfig.app.name;

  console.log(
    "APP MONYS OS:",
    appName
  );

  const MODO_NUEVO_DASHBOARD =
    false;

  const [
    movimientos,
    setMovimientos,
  ] = useState([]);

  const [
    importacionId,
    setImportacionId,
  ] = useState(null);

  const [
    pantallaActual,
    setPantallaActual,
  ] = useState("dashboard");

  const {
    datosDashboard,
    cargandoDashboard,
    errorDashboard,
  } = useDashboardData();

  const esOwner =
    usuario?.role === "owner";

  const esAdmin =
    usuario?.role === "admin";

   const esEmpleado =
  !esOwner &&
  !esAdmin;

  function puede(permission) {
    if (esOwner) {
      return true;
    }

    return tienePermiso(
      permission
    );
  }

  function puedeAdministrarUsuarios() {
    return (
      esOwner ||
      esAdmin
    );
  }

  function puedeUsarInteligencia() {
    /*
      Por seguridad, mientras no exista
      un permiso específico de IA,
      solamente Owner tendrá acceso.
    */
    return esOwner;
  }

  function puedeImportarReportes() {
    /*
      Por seguridad, mientras no exista
      un permiso específico para importar,
      solamente Owner tendrá acceso.
    */
    return esOwner;
  }

  function puedeAbrirModulo(
    nombre
  ) {
    if (esOwner) {
      return true;
    }

    switch (nombre) {
      case "Registrar dinero":
        return puede(
          "ver_finanzas"
        );

      case "Producto solicitado":
        return (
          puede(
            "registrar_producto_solicitado"
          ) ||
          puede(
            "ver_inventario"
          )
        );

       case "Compra Maestra":
  return puede(
    "ver_inventario"
  );

      case "Problemas e incidencias":
        return puede(
          "registrar_incidencias"
        );

      case "Ideas y oportunidades":
        return puede(
          "registrar_ideas"
        );

      case "Flotilla":
        return puede(
          "ver_logistica"
        );

      case "Importar reportes":
        return puedeImportarReportes();

      case "Centro de Órdenes":
        return puede(
          "ver_ordenes"
        );

      case "Usuarios":
        return puedeAdministrarUsuarios();

      case "Director General IA":
        return puedeUsarInteligencia();

      default:
        return false;
    }
  }

  const modulosVisibles =
    modulos.filter(
      ([, nombre]) =>
        puedeAbrirModulo(
          nombre
        )
    );

  const puedeVerFinanzas =
    puede("ver_finanzas");

  const puedeVerVentas =
    puede("ver_ventas");

  const puedeVerInventario =
    puede("ver_inventario");

  const tieneAlgúnPermiso =
    esOwner ||
    esAdmin ||
    permisos.length > 0;

  /*
    Consulta los movimientos guardados
    en Supabase.
  */
  const cargarMovimientos =
    async () => {
      try {
        const registros =
          await obtenerMovimientosTesoreria();

        const movimientosAdaptados =
          registros.map(
            (registro) => ({
              id: registro.id,

              tipo:
                registro.movement_type,

              monto:
                Number(
                  registro.amount
                ) || 0,

              concepto:
                registro.concept ||
                "",

              negocio:
                registro.business_id
                  ? "Negocio registrado"
                  : "Sin negocio",

              sucursal:
                registro.branch_id
                  ? "Sucursal registrada"
                  : "Sin sucursal",

              estado:
                registro.status ||
                "Pendiente de revisión",

              fecha:
                registro.occurred_at
                  ? new Date(
                      registro.occurred_at
                    ).toLocaleString(
                      "es-MX"
                    )
                  : "",
            })
          );

        setMovimientos(
          movimientosAdaptados
        );
      } catch (error) {
        console.error(
          "No fue posible cargar los movimientos del Dashboard:",
          error
        );
      }
    };

  useEffect(() => {
    cargarMovimientos();
  }, []);

  const cambiarEstadoMovimiento =
    async (
      movimientoId,
      nuevoEstado
    ) => {
      try {
        if (
          !puedeVerFinanzas
        ) {
          alert(
            "No tienes permiso para modificar movimientos de Tesorería."
          );

          return;
        }

        await actualizarEstadoMovimientoTesoreria(
          movimientoId,
          nuevoEstado
        );

        await cargarMovimientos();

        alert(
          `El movimiento fue actualizado a: ${nuevoEstado}.`
        );
      } catch (error) {
        console.error(
          "Error al cambiar el estado del movimiento:",
          error
        );

        alert(
          error.message ||
            "No fue posible actualizar el movimiento."
        );
      }
    };

  const entradas =
    movimientos
      .filter(
        (movimiento) =>
          movimiento.tipo ===
          "ENTRADA"
      )
      .reduce(
        (
          total,
          movimiento
        ) =>
          total +
          movimiento.monto,
        0
      );

  const salidas =
    movimientos
      .filter(
        (movimiento) =>
          movimiento.tipo ===
          "SALIDA"
      )
      .reduce(
        (
          total,
          movimiento
        ) =>
          total +
          movimiento.monto,
        0
      );

  const disponible =
    entradas - salidas;

  const metricasVentas =
    datosDashboard?.metricas ||
    {};

  const ventasTotales =
    Number(
      metricasVentas.ventasTotales
    ) || 0;

  const utilidadTotal =
    Number(
      metricasVentas.utilidadTotal
    ) || 0;

  const margenUtilidad =
    Number(
      metricasVentas.margenUtilidad
    ) || 0;

  const totalPiezas =
    Number(
      metricasVentas.totalPiezas
    ) || 0;

  const formatoDinero =
    (cantidad) =>
      new Intl.NumberFormat(
        "es-MX",
        {
          style: "currency",
          currency: "MXN",
        }
      ).format(
        Number(cantidad) || 0
      );

  function mostrarAccesoDenegado(
    titulo
  ) {
    return (
      <main
        className="app"
      >
        <Header />

        <section
          style={{
            maxWidth:
              "720px",
            margin:
              "50px auto",
            padding:
              "32px",
            background:
              "#ffffff",
            border:
              "1px solid #eadde4",
            borderRadius:
              "18px",
            textAlign:
              "center",
            boxShadow:
              "0 10px 30px rgba(94, 48, 72, 0.08)",
          }}
        >
          <div
            style={{
              fontSize:
                "42px",
              marginBottom:
                "12px",
            }}
          >
            🔒
          </div>

          <h2
            style={{
              color:
                "#2c2030",
              marginBottom:
                "10px",
            }}
          >
            Acceso restringido
          </h2>

          <p
            style={{
              color:
                "#766a70",
              lineHeight:
                1.6,
            }}
          >
            Tu usuario no tiene
            permiso para acceder a{" "}
            <strong>
              {titulo}
            </strong>
            .
          </p>

          <button
            type="button"
            onClick={() =>
              setPantallaActual(
                "dashboard"
              )
            }
            style={{
              marginTop:
                "18px",
              padding:
                "11px 18px",
              border:
                "none",
              borderRadius:
                "10px",
              background:
                "#5e3048",
              color:
                "#ffffff",
              fontWeight:
                "800",
              cursor:
                "pointer",
            }}
          >
            Volver al Dashboard
          </button>
        </section>
      </main>
    );
  }

  const abrirModulo =
    (nombre) => {
      if (
        !puedeAbrirModulo(
          nombre
        )
      ) {
        alert(
          "Tu usuario no tiene permiso para abrir este módulo."
        );

        return;
      }

      if (
        nombre ===
        "Registrar dinero"
      ) {
        setPantallaActual(
          "tesoreria"
        );

        return;
      }

      if (
        nombre ===
        "Director General IA"
      ) {
        setPantallaActual(
          "inteligencia"
        );

        return;
      }

      if (
        nombre ===
        "Importar reportes"
      ) {
        setPantallaActual(
          "importador"
        );

        return;
      }

      if (
        nombre ===
        "Centro de Órdenes"
      ) {
        setPantallaActual(
          "ordenes"
        );

        return;
      }

       if (
  nombre ===
  "Compra Maestra"
) {
  setPantallaActual(
    "compra-maestra"
  );

  return;
}

      if (
        nombre ===
        "Producto solicitado"
      ) {
        setPantallaActual(
          "inventario"
        );

        return;
      }

      if (
        nombre ===
        "Usuarios"
      ) {
        setPantallaActual(
          "usuarios"
        );

        return;
      }

      alert(
        `${nombre} estará disponible en el siguiente módulo.`
      );
    };

      if (
  cargandoUsuario ||
  cargandoPermisos
) {
  return (
    <main
      className="app"
      style={{
        minHeight: "100vh",
        display: "grid",
        placeItems: "center",
        background: "#fff8fb",
      }}
    >
      <div
        style={{
          textAlign: "center",
          color: "#7b5368",
        }}
      >
        <div
          style={{
            fontSize: "36px",
            marginBottom: "12px",
          }}
        >
          ✨
        </div>

        <strong
          style={{
            display: "block",
            fontSize: "18px",
          }}
        >
          Preparando MONYS OS...
        </strong>

        <div
          style={{
            marginTop: "6px",
            fontSize: "13px",
            opacity: 0.75,
          }}
        >
          Cargando tu información
        </div>
      </div>
    </main>
  );
}

  if (
    errorUsuario
  ) {
    return (
      <main
        className="app"
      >
        <div
          style={{
            maxWidth:
              "700px",
            margin:
              "60px auto",
            padding:
              "24px",
            borderRadius:
              "14px",
            background:
              "#fff2f2",
            border:
              "1px solid #efc0c0",
            color:
              "#9b3030",
          }}
        >
          {errorUsuario}
        </div>
      </main>
    );
  }

  if (
    errorPermisos
  ) {
    console.error(
      "Error permisos:",
      errorPermisos
    );
  }

  if (
    MODO_NUEVO_DASHBOARD
  ) {
    return (
      <DashboardPage />
    );
  }

  /*
    TESORERÍA
  */
  if (
    pantallaActual ===
    "tesoreria"
  ) {
    if (
      !puedeVerFinanzas
    ) {
      return mostrarAccesoDenegado(
        "Tesorería"
      );
    }

    return (
      <TesoreriaPage
        volverAlDashboard={() =>
          setPantallaActual(
            "dashboard"
          )
        }
        onMovimientoGuardado={
          cargarMovimientos
        }
      />
    );
  }

 /*
  INVENTARIO
*/
if (
  pantallaActual ===
  "inventario"
) {
  if (
    !puedeVerInventario &&
    !puede(
      "registrar_producto_solicitado"
    )
  ) {
    return mostrarAccesoDenegado(
      "Inventario"
    );
  }

  return (
    <InventarioPage
      volverAlDashboard={() =>
        setPantallaActual(
          "dashboard"
        )
      }
    />
  );
}

/*
  COMPRA MAESTRA
*/
if (
  pantallaActual ===
  "compra-maestra"
) {
  if (
    !puedeVerInventario
  ) {
    return mostrarAccesoDenegado(
      "Compra Maestra"
    );
  }

  return (
    <CompraMaestraPage
      volverAlDashboard={() =>
        setPantallaActual(
          "dashboard"
        )
      }
    />
  );
}

  /*
    USUARIOS
  */
  if (
    pantallaActual ===
    "usuarios"
  ) {
    if (
      !puedeAdministrarUsuarios()
    ) {
      return mostrarAccesoDenegado(
        "Administración de Usuarios"
      );
    }

    return (
      <CentroUsuarios
        volverAlDashboard={() =>
          setPantallaActual(
            "dashboard"
          )
        }
      />
    );
  }

  /*
    ÓRDENES
  */
  if (
    pantallaActual ===
    "ordenes"
  ) {
    if (
      !puede(
        "ver_ordenes"
      )
    ) {
      return mostrarAccesoDenegado(
        "Centro de Órdenes"
      );
    }

    return (
      <CentroOrdenes
        volverAlDashboard={() =>
          setPantallaActual(
            "dashboard"
          )
        }
      />
    );
  }

  /*
    IMPORTADOR
  */
  if (
    pantallaActual ===
    "importador"
  ) {
    if (
      !puedeImportarReportes()
    ) {
      return mostrarAccesoDenegado(
        "Importador de Reportes"
      );
    }

    return (
      <ImportadorPage
        volverAlDashboard={() =>
          setPantallaActual(
            "dashboard"
          )
        }
      />
    );
  }

  /*
    INTELIGENCIA
  */
  if (
    pantallaActual ===
    "inteligencia"
  ) {
    if (
      !puedeUsarInteligencia()
    ) {
      return mostrarAccesoDenegado(
        "Director General IA"
      );
    }

    return (
      <CentroInteligencia
        datosDashboard={
          datosDashboard
        }
        movimientos={
          movimientos
        }
        importacionId={
          importacionId
        }
        cargandoDashboard={
          cargandoDashboard
        }
        errorDashboard={
          errorDashboard
        }
        volverAlDashboard={() =>
          setPantallaActual(
            "dashboard"
          )
        }
      />
    );
  }

  if (esEmpleado) {
  return (
    <InicioEmpleado
      usuario={usuario}
      datosDashboard={datosDashboard}
    />
  );
}

if (esOwner) {
  return (
    <InicioJefa
      ventasTotales={
        ventasTotales
      }
      utilidadTotal={
        utilidadTotal
      }
      disponible={
        disponible
      }
      movimientos={
        movimientos
      }
      formatoDinero={
        formatoDinero
      }

      abrirJuntaDirectiva={() =>
        setPantallaActual(
          "inteligencia"
        )
      }

      abrirTesoreria={() =>
        setPantallaActual(
          "tesoreria"
        )
      }

      abrirInventario={() =>
        setPantallaActual(
          "inventario"
        )
      }

      abrirCompraMaestra={() =>
        setPantallaActual(
          "compra-maestra"
        )
      }

      abrirUsuarios={() =>
        setPantallaActual(
          "usuarios"
        )
      }

      contenidoAcciones={
        !cargandoDashboard &&
        !errorDashboard &&
        datosDashboard ? (
          <AccionesPrioritarias
            datosDashboard={
              datosDashboard
            }
            movimientos={
              movimientos
            }
            branchId={
              datosDashboard?.branch_id ||
              null
            }
          />
        ) : null
      }

      contenidoOperacion={
        <OperacionHoy
          organizationId={
            datosDashboard?.organization_id ||
            null
          }
          businessId={
            datosDashboard?.business_id ||
            null
          }
          branchId={
            datosDashboard?.branch_id ||
            null
          }
        />
      }

      contenidoSicar={
        <SicarResumen
          datosDashboard={
            datosDashboard
          }
          cargandoDashboard={
            cargandoDashboard
          }
          errorDashboard={
            errorDashboard
          }
        />
      }

      contenidoCierre={
        <CierreTurno
          branchId={
            datosDashboard?.branch_id ||
            null
          }
        />
      }
    />
  );
}

  /*
    ==========================================
    DASHBOARD PRINCIPAL
    ==========================================
  */

  if (
    !tieneAlgúnPermiso
  ) {
    return (
      <main
        className="app"
      >
        <Header />

        <section
          style={{
            maxWidth:
              "720px",
            margin:
              "50px auto",
            padding:
              "34px",
            background:
              "#ffffff",
            border:
              "1px solid #eadde4",
            borderRadius:
              "18px",
            textAlign:
              "center",
            boxShadow:
              "0 10px 30px rgba(94, 48, 72, 0.08)",
          }}
        >
          <div
            style={{
              fontSize:
                "44px",
              marginBottom:
                "12px",
            }}
          >
            🔐
          </div>

          <h2
            style={{
              color:
                "#2c2030",
              marginBottom:
                "10px",
            }}
          >
            Usuario sin permisos asignados
          </h2>

          <p
            style={{
              color:
                "#766a70",
              lineHeight:
                1.6,
            }}
          >
            Hola{" "}
            <strong>
              {usuario?.nombre}
            </strong>
            . Tu cuenta está activa,
            pero todavía no tiene
            permisos para utilizar
            módulos de MONYS OS.
          </p>

          <p
            style={{
              color:
                "#766a70",
            }}
          >
            Un administrador deberá
            asignarte los accesos
            correspondientes.
          </p>
        </section>
      </main>
    );
  }

  return (
    <main className="app">
      <Header />

      {(puedeVerFinanzas ||
        puedeVerVentas) && (
        <Indicadores
          disponible={
            disponible
          }
          entradas={
            entradas
          }
          salidas={
            salidas
          }
          cantidadMovimientos={
            movimientos.length
          }
          ventasTotales={
            ventasTotales
          }
          utilidadTotal={
            utilidadTotal
          }
          margenUtilidad={
            margenUtilidad
          }
          totalPiezas={
            totalPiezas
          }
          formatoDinero={
            formatoDinero
          }
        />
      )}

       <OperacionHoy
  organizationId={
    datosDashboard?.organization_id ||
    null
  }
  businessId={
    datosDashboard?.business_id ||
    null
  }
  branchId={
    datosDashboard?.branch_id ||
    null
  }
/>

   <CierreTurno
  branchId={
    datosDashboard?.branch_id ||
    null
  }
/>


      {esOwner &&
        !cargandoDashboard &&
        !errorDashboard &&
        datosDashboard && (
        <AccionesPrioritarias
  datosDashboard={
    datosDashboard
  }
  movimientos={
    movimientos
  }
  branchId={
    datosDashboard?.branch_id ||
    null
  }
/>
        )}

      {puedeUsarInteligencia() && (
        <DirectorGeneralIA
          cantidadMovimientos={
            movimientos.length
          }
          disponible={
            disponible
          }
          formatoDinero={
            formatoDinero
          }
          datosDashboard={
            datosDashboard
          }
          movimientos={
            movimientos
          }
          entradas={
            entradas
          }
          salidas={
            salidas
          }
          abrirSalaConsejo={() =>
            setPantallaActual(
              "inteligencia"
            )
          }
        />
      )}

      {(puedeVerVentas ||
        puedeVerInventario) && (
        <SicarResumen
          datosDashboard={
            datosDashboard
          }
          cargandoDashboard={
            cargandoDashboard
          }
          errorDashboard={
            errorDashboard
          }
        />
      )}

      {modulosVisibles.length >
        0 && (
        <AccionesRapidas
          modulos={
            modulosVisibles
          }
          abrirModulo={
            abrirModulo
          }
        />
      )}

      {puedeVerFinanzas && (
        <>
          <HistorialMovimientos
            movimientos={
              movimientos
            }
            formatoDinero={
              formatoDinero
            }
            onCambiarEstado={
              cambiarEstadoMovimiento
            }
          />

          <h2 className="titulo-seccion">
            Últimos movimientos
          </h2>

          <section className="lista-movimientos">
            {movimientos.length ===
            0 ? (
              <div className="sin-registros">
                Todavía no hay
                movimientos
                registrados.
              </div>
            ) : (
              movimientos
                .slice(0, 8)
                .map(
                  (
                    movimiento
                  ) => (
                    <article
                      className="movimiento"
                      key={
                        movimiento.id
                      }
                    >
                      <div>
                        <strong>
                          {movimiento.tipo ===
                          "ENTRADA"
                            ? "📥"
                            : "📤"}{" "}
                          {formatoDinero(
                            movimiento.monto
                          )}
                        </strong>

                        <p>
                          {
                            movimiento.concepto
                          }
                        </p>

                        <small>
                          {
                            movimiento.negocio
                          }{" "}
                          ·{" "}
                          {
                            movimiento.sucursal
                          }
                        </small>
                      </div>

                      <div className="movimiento-derecha">
                        <span>
                          {
                            movimiento.estado
                          }
                        </span>

                        <small>
                          {
                            movimiento.fecha
                          }
                        </small>
                      </div>
                    </article>
                  )
                )
            )}
          </section>
        </>
      )}
    </main>
  );
}

export default App;