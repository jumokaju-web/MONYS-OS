import { useEffect, useState } from "react";
import "./App.css";

import { systemConfig } from "./core/config/systemConfig";

import Header from "./components/layout/Header";

import Indicadores from "./features/dashboard/Indicadores";
import DirectorGeneralIA from "./features/dashboard/DirectorGeneralIA";
import AccionesPrioritarias from "./features/inteligencia/components/AccionesPrioritarias";
import AccionesRapidas from "./features/dashboard/AccionesRapidas";
import SicarResumen from "./features/dashboard/components/SicarResumen";

import TesoreriaPage from "./features/tesoreria/pages/TesoreriaPage";
import InventarioPage from "./features/inventario/pages/InventarioPage";
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
  ["⚠️", "Problemas e incidencias"],
  ["💡", "Ideas y oportunidades"],
  ["🚚", "Flotilla"],
  ["📄", "Importar reportes"],
  ["🤖", "Director General IA"],
];

function App() {
  const appName =
    systemConfig.app.name;

  const MODO_NUEVO_DASHBOARD =
    false;

  const [
    movimientos,
    setMovimientos,
  ] = useState([]);

  const [
    pantallaActual,
    setPantallaActual,
  ] = useState("dashboard");

  const {
    datosDashboard,
    cargandoDashboard,
    errorDashboard,
  } = useDashboardData();

  /*
    Consulta los movimientos guardados en Supabase
    y los adapta al formato que utiliza el Dashboard.
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
                registro.concept || "",

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

  /*
    Carga los movimientos cuando inicia MONYS OS.
  */
  useEffect(() => {
    cargarMovimientos();
  }, []);

  /*
    Cambia el estado de un movimiento en Supabase
    y después actualiza el Dashboard.
  */
  const cambiarEstadoMovimiento =
    async (
      movimientoId,
      nuevoEstado
    ) => {
      try {
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

  /*
    Calcula el total de entradas.
  */
  const entradas =
    movimientos
      .filter(
        (movimiento) =>
          movimiento.tipo ===
          "ENTRADA"
      )
      .reduce(
        (total, movimiento) =>
          total +
          movimiento.monto,
        0
      );

  /*
    Calcula el total de salidas.
  */
  const salidas =
    movimientos
      .filter(
        (movimiento) =>
          movimiento.tipo ===
          "SALIDA"
      )
      .reduce(
        (total, movimiento) =>
          total +
          movimiento.monto,
        0
      );

  const disponible =
    entradas - salidas;

  /*
    Métricas reales obtenidas de SICAR.
  */
  const metricasVentas =
    datosDashboard?.metricas || {};

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

  /*
    Da formato de pesos mexicanos.
  */
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

  /*
    Abre los módulos disponibles.
  */
  const abrirModulo =
    (nombre) => {
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
        "Producto solicitado"
      ) {
        setPantallaActual(
          "inventario"
        );

        return;
      }

      alert(
        `${nombre} estará disponible en el siguiente módulo.`
      );
    };

  /*
    Dashboard alternativo.
  */
  if (
    MODO_NUEVO_DASHBOARD
  ) {
    return <DashboardPage />;
  }

  /*
    Pantalla de Tesorería.
  */
  if (
    pantallaActual ===
    "tesoreria"
  ) {
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
    Pantalla de Inventario.
  */
  if (
    pantallaActual ===
    "inventario"
  ) {
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
    Pantalla del Importador.
  */
  if (
    pantallaActual ===
    "importador"
  ) {
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
    Centro de Inteligencia Empresarial.
  */
  if (
    pantallaActual ===
    "inteligencia"
  ) {
    return (
      <CentroInteligencia
        datosDashboard={
          datosDashboard
        }
        movimientos={
          movimientos
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

  /*
    ==========================================
    DASHBOARD PRINCIPAL
    ==========================================
  */
  return (
    <main className="app">
      <Header />

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

      {/* ================================= */}
      {/* DECISIONES PRIORITARIAS DE HOY */}
      {/* ================================= */}

      {!cargandoDashboard &&
        !errorDashboard &&
        datosDashboard && (
          <AccionesPrioritarias
            datosDashboard={
              datosDashboard
            }
            movimientos={
              movimientos
            }
          />
        )}

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

      <AccionesRapidas
        modulos={
          modulos
        }
        abrirModulo={
          abrirModulo
        }
      />

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
            Todavía no hay movimientos registrados.
          </div>
        ) : (
          movimientos
            .slice(0, 8)
            .map(
              (movimiento) => (
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
    </main>
  );
}

export default App;