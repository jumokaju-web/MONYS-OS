import {
  useEffect,
  useState,
} from "react";

import {
  generarCompraMaestra,
} from "../services/compraMaestraService";

import ResumenSucursalesCompra from "../components/ResumenSucursalesCompra";
import DetalleCompraSucursal from "../components/DetalleCompraSucursal";
import PlanTraspasos from "../components/PlanTraspasos";
import ListaMaestraCompra from "../components/ListaMaestraCompra";
import HistorialCompraMaestra from "../components/HistorialCompraMaestra";

import {
  guardarPlanCompra,
  verificarPlanActualGuardado,
} from "../services/compraPlanService";

function convertirNumero(valor) {
  const numero = Number(valor);

  return Number.isFinite(numero)
    ? numero
    : 0;
}

function formatearDinero(valor) {
  return new Intl.NumberFormat(
    "es-MX",
    {
      style: "currency",
      currency: "MXN",
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    }
  ).format(
    convertirNumero(valor)
  );
}

function formatearNumero(valor) {
  return new Intl.NumberFormat(
    "es-MX"
  ).format(
    convertirNumero(valor)
  );
}

export default function CompraMaestraPage({
  volverAlDashboard,
}) {
  const [
    compraMaestra,
    setCompraMaestra,
  ] = useState(null);

    const [
    guardandoPlan,
    setGuardandoPlan,
  ] = useState(false);

  const [
    planGuardado,
    setPlanGuardado,
  ] = useState(false);

  const [
    mensajePlan,
    setMensajePlan,
  ] = useState("");

  const [
    cargando,
    setCargando,
  ] = useState(true);

  const [
    error,
    setError,
  ] = useState("");

  const [
    busqueda,
    setBusqueda,
  ] = useState("");

  const [
    soloConTraspaso,
    setSoloConTraspaso,
  ] = useState(false);

  const [
    soloRevisionInventario,
    setSoloRevisionInventario,
  ] = useState(false);

  const [
    sucursalSeleccionada,
    setSucursalSeleccionada,
  ] = useState(null);

    const [
    seccionActiva,
    setSeccionActiva,
  ] = useState("resumen");

   async function guardarPlanActual() {
    if (
      !compraMaestra ||
      guardandoPlan ||
      planGuardado
    ) {
      return;
    }

    try {
      setGuardandoPlan(true);
      setMensajePlan("");

      const resultado =
        await guardarPlanCompra({
          compraMaestra,
        });

      setPlanGuardado(true);

      setMensajePlan(
        `✅ Plan guardado correctamente · ${formatearNumero(
          resultado?.productosGuardados
        )} productos · ${formatearNumero(
          resultado?.traspasosGuardados
        )} traspasos`
      );
    } catch (errorGuardar) {
      console.error(
        "Error al guardar el plan actual:",
        errorGuardar
      );

      setMensajePlan(
        `❌ ${
          errorGuardar?.message ||
          "No fue posible guardar el plan."
        }`
      );
    } finally {
      setGuardandoPlan(false);
    }
  }

  useEffect(() => {
    let activo = true;

    async function cargarCompraMaestra() {
      try {
        setCargando(true);
        setError("");

        const resultado =
          await generarCompraMaestra();

        if (!activo) {
          return;
        }

        setCompraMaestra(
          resultado
        );
      
                try {
          const verificacion =
            await verificarPlanActualGuardado(
              resultado
            );

          if (!activo) {
            return;
          }

          if (
            verificacion?.guardado
          ) {
            setPlanGuardado(true);

            setMensajePlan(
              "✅ Este plan ya está guardado en el historial."
            );
          } else {
            setPlanGuardado(false);
            setMensajePlan("");
          }
        } catch (
          errorVerificacion
        ) {
          console.error(
            "No fue posible verificar si el plan ya estaba guardado:",
            errorVerificacion
          );

          if (activo) {
            setPlanGuardado(false);
            setMensajePlan("");
          }
        }

      } catch (errorCarga) {
        console.error(
          "Error al cargar Compra Maestra:",
          errorCarga
        );

        if (!activo) {
          return;
        }

        setError(
          errorCarga?.message ||
            "No fue posible calcular la Compra Maestra."
        );
      } finally {
        if (activo) {
          setCargando(false);
        }
      }
    }

    cargarCompraMaestra();

    return () => {
      activo = false;
    };
  }, []);

  if (cargando) {
    return (
      <div
        style={{
          padding: "32px",
        }}
      >
        <h2>
          🛒 Compra Maestra
        </h2>

        <p>
          Calculando necesidades de todas las sucursales...
        </p>
      </div>
    );
  }

  if (error) {
    return (
      <div
        style={{
          padding: "32px",
        }}
      >
        <h2>
          🛒 Compra Maestra
        </h2>

        <p
          style={{
            color: "#a52d2d",
          }}
        >
          {error}
        </p>
      </div>
    );
  }

  const productosCompra =
    Array.isArray(
      compraMaestra?.productos
    )
      ? compraMaestra.productos
      : [];

  const productosRevisionInventario =
    Array.isArray(
      compraMaestra
        ?.productosRevisionInventario
    )
      ? compraMaestra
          .productosRevisionInventario
      : [];

  const productosBase =
    soloRevisionInventario
      ? productosRevisionInventario
      : productosCompra;

  const textoBusqueda =
    busqueda
      .trim()
      .toLowerCase();

  const productosFiltrados =
    productosBase.filter(
      (producto) => {
        const codigo =
          String(
            producto?.codigo || ""
          ).toLowerCase();

        const descripcion =
          String(
            producto?.descripcion || ""
          ).toLowerCase();

        const categoria =
          String(
            producto?.categoria || ""
          ).toLowerCase();

        const coincideBusqueda =
          !textoBusqueda ||
          codigo.includes(
            textoBusqueda
          ) ||
          descripcion.includes(
            textoBusqueda
          ) ||
          categoria.includes(
            textoBusqueda
          );

        const tieneTraspaso =
          Number(
            producto
              ?.cubiertoPorTraspasos
          ) > 0;

        const coincideTraspaso =
          !soloConTraspaso ||
          tieneTraspaso;

        return (
          coincideBusqueda &&
          coincideTraspaso
        );
      }
    );

  return (
    <div
      style={{
        padding: "32px",
        maxWidth: "1400px",
        margin: "0 auto",
      }}
    >
      <div
        style={{
          marginBottom: "28px",
        }}
      >
        <button
          type="button"
          onClick={
            volverAlDashboard
          }
          style={{
            marginBottom: "18px",
            padding: "10px 16px",
            borderRadius: "10px",
            border:
              "1px solid #e6cbd8",
            backgroundColor:
              "#ffffff",
            cursor: "pointer",
            fontWeight: 800,
            color: "#8f2858",
          }}
        >
          ← Volver al Dashboard
        </button>

        <p
          style={{
            margin: 0,
            fontWeight: 800,
            color: "#c7256e",
            letterSpacing: "1px",
          }}
        >
          MONYS OS · INVENTARIO INTELIGENTE
        </p>

        <h1
          style={{
            marginBottom: "8px",
          }}
        >
          🛒 Compra Maestra
        </h1>

        <p
          style={{
            marginTop: 0,
            color: "#6f666a",
          }}
        >
          Compra consolidada de todas las sucursales.
          MONYS OS descuenta primero los traspasos
          seguros y calcula únicamente el faltante
          necesario para cubrir aproximadamente{" "}
          <strong>
            {compraMaestra
              ?.coberturaObjetivoDias ||
              30}{" "}
            días
          </strong>
          .
        </p>
      </div>

              <div
        style={{
          display: "flex",
          gap: "10px",
          flexWrap: "wrap",
          marginBottom: "24px",
          padding: "8px",
          borderRadius: "16px",
          backgroundColor: "#ffffff",
          border: "1px solid #ead5df",
        }}
      >
        {[
          {
            id: "resumen",
            texto: "📊 Resumen",
          },
          {
            id: "compra",
            texto: "🛒 Compra",
          },
          {
            id: "traspasos",
            texto: "🔄 Traspasos",
          },
          {
            id: "historial",
            texto: "🗂 Historial",
          },
        ].map((seccion) => {
          const activa =
            seccionActiva ===
            seccion.id;

          return (
            <button
              key={seccion.id}
              type="button"
              onClick={() =>
                setSeccionActiva(
                  seccion.id
                )
              }
              style={{
                padding:
                  "11px 16px",
                borderRadius:
                  "12px",
                border: activa
                  ? "2px solid #8f2858"
                  : "1px solid #ead5df",
                backgroundColor:
                  activa
                    ? "#fff0f6"
                    : "#ffffff",
                color:
                  activa
                    ? "#8f2858"
                    : "#6f666a",
                fontWeight: 800,
                cursor: "pointer",
              }}
            >
              {seccion.texto}
            </button>
          );
        })}
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns:
            "repeat(auto-fit, minmax(220px, 1fr))",
          gap: "16px",
          marginBottom: "28px",
        }}
      >
        <div
          style={{
            padding: "20px",
            borderRadius: "18px",
            border:
              "1px solid #ead5df",
            backgroundColor:
              "#ffffff",
          }}
        >
          <div>
            📦 Productos a comprar
          </div>

          <strong
            style={{
              display: "block",
              fontSize: "30px",
              marginTop: "8px",
            }}
          >
            {formatearNumero(
              compraMaestra
                ?.totalProductosComprar
            )}
          </strong>
        </div>

        <div
          style={{
            padding: "20px",
            borderRadius: "18px",
            border:
              "1px solid #ead5df",
            backgroundColor:
              "#ffffff",
          }}
        >
          <div>
            🧮 Necesidad inicial
          </div>

          <strong
            style={{
              display: "block",
              fontSize: "30px",
              marginTop: "8px",
            }}
          >
            {formatearNumero(
              compraMaestra
                ?.totalNecesidadAntesTraspasos
            )}{" "}
            pzas
          </strong>
        </div>

        <div
          style={{
            padding: "20px",
            borderRadius: "18px",
            border:
              "1px solid #d9e8ff",
            backgroundColor:
              "#f4f8ff",
          }}
        >
          <div>
            🔄 Cubiertas por traspaso
          </div>

          <strong
            style={{
              display: "block",
              fontSize: "30px",
              marginTop: "8px",
            }}
          >
            {formatearNumero(
              compraMaestra
                ?.totalCubiertoPorTraspasos
            )}{" "}
            pzas
          </strong>
        </div>

        <div
          style={{
            padding: "20px",
            borderRadius: "18px",
            border:
              "1px solid #cde8d7",
            backgroundColor:
              "#f3fbf6",
          }}
        >
          <div>
            ✅ Compra final
          </div>

          <strong
            style={{
              display: "block",
              fontSize: "30px",
              marginTop: "8px",
            }}
          >
            {formatearNumero(
              compraMaestra
                ?.totalPiezasComprar
            )}{" "}
            pzas
          </strong>
        </div>

        <div
          style={{
            padding: "20px",
            borderRadius: "18px",
            border:
              "1px solid #f0dfad",
            backgroundColor:
              "#fffaf0",
          }}
        >
          <div>
            💳 Inversión estimada
          </div>

          <strong
            style={{
              display: "block",
              fontSize: "30px",
              marginTop: "8px",
            }}
          >
            {formatearDinero(
              compraMaestra
                ?.inversionTotal
            )}
          </strong>
        </div>

        <div
          style={{
            padding: "20px",
            borderRadius: "18px",
            border:
              "1px solid #ead5df",
            backgroundColor:
              "#ffffff",
          }}
        >
          <div>
            📅 Cobertura objetivo
          </div>

          <strong
            style={{
              display: "block",
              fontSize: "30px",
              marginTop: "8px",
            }}
          >
            {formatearNumero(
              compraMaestra
                ?.coberturaObjetivoDias
            )}{" "}
            días
          </strong>
        </div>
      </div>

               <div
        style={{
          marginBottom: "28px",
          padding: "18px 20px",
          borderRadius: "16px",
          border:
            planGuardado
              ? "1px solid #b9dfc7"
              : "1px solid #ead5df",
          backgroundColor:
            planGuardado
              ? "#f3fbf6"
              : "#ffffff",
          display: "flex",
          justifyContent:
            "space-between",
          alignItems: "center",
          gap: "16px",
          flexWrap: "wrap",
        }}
      >
        <div>
          <strong>
            💾 Guardar fotografía de esta Compra Maestra
          </strong>

          <div
            style={{
              marginTop: "5px",
              color: "#6f666a",
              fontSize: "14px",
            }}
          >
            Conserva compra, distribución por sucursal
            y recomendaciones de traspaso para consultar
            este plan después.
          </div>

          {mensajePlan && (
            <div
              style={{
                marginTop: "9px",
                fontWeight: 800,
                color:
                  planGuardado
                    ? "#207a4a"
                    : "#a52d2d",
              }}
            >
              {mensajePlan}
            </div>
          )}
        </div>

        <button
          type="button"
          onClick={
            guardarPlanActual
          }
          disabled={
            guardandoPlan ||
            planGuardado
          }
          style={{
            padding: "12px 18px",
            borderRadius: "12px",
            border:
              planGuardado
                ? "1px solid #b9dfc7"
                : "1px solid #8f2858",
            backgroundColor:
              planGuardado
                ? "#e6f6ec"
                : "#8f2858",
            color:
              planGuardado
                ? "#207a4a"
                : "#ffffff",
            fontWeight: 800,
            cursor:
              guardandoPlan ||
              planGuardado
                ? "default"
                : "pointer",
            fontSize: "14px",
          }}
        >
          {guardandoPlan
            ? "💾 Guardando..."
            : planGuardado
              ? "✅ Plan guardado"
              : "💾 Guardar plan actual"}
        </button>
      </div>


          {seccionActiva ===
        "resumen" && (
        <>
          <ResumenSucursalesCompra
            compraMaestra={
              compraMaestra
            }
            onSeleccionarSucursal={
              setSucursalSeleccionada
            }
          />

          {sucursalSeleccionada && (
            <DetalleCompraSucursal
              branchId={
                sucursalSeleccionada.branchId
              }
              nombreSucursal={
                sucursalSeleccionada.sucursal
              }
              productos={
                productosCompra
              }
              onCerrar={() =>
                setSucursalSeleccionada(
                  null
                )
              }
            />
          )}
        </>
      )}

      {seccionActiva ===
        "historial" && (
        <HistorialCompraMaestra />
      )}

      {seccionActiva ===
        "compra" && (
        <ListaMaestraCompra
          productos={
            productosCompra
          }
          totalPiezas={
            compraMaestra
              ?.totalPiezasComprar
          }
          inversionTotal={
            compraMaestra
              ?.inversionTotal
          }
        />
      )}

      {seccionActiva ===
        "traspasos" && (
        <PlanTraspasos
          planTraspasos={
            compraMaestra
              ?.planTraspasos
          }
        />
      )}
    

   
 
     {seccionActiva === "compra" && (

      <div
        style={{
          padding: "22px",
          borderRadius: "20px",
          border:
            "1px solid #ead5df",
          backgroundColor:
            "#ffffff",
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent:
              "space-between",
            alignItems: "center",
            gap: "16px",
            flexWrap: "wrap",
            marginBottom: "18px",
          }}
        >
          <h2
            style={{
              margin: 0,
            }}
          >
            {soloRevisionInventario
              ? "⚠️ Productos para revisar inventario"
              : "📋 Productos de la Compra Maestra"}
          </h2>

          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "12px",
              flexWrap: "wrap",
            }}
          >
            <input
              type="text"
              value={busqueda}
              onChange={(evento) =>
                setBusqueda(
                  evento.target.value
                )
              }
              placeholder="Buscar por código, producto o categoría..."
              style={{
                width: "100%",
                maxWidth: "420px",
                padding: "12px 14px",
                borderRadius: "12px",
                border:
                  "1px solid #dccbd3",
                outline: "none",
                fontSize: "15px",
                backgroundColor:
                  "#ffffff",
              }}
            />

            <label
              style={{
                display: "flex",
                alignItems: "center",
                gap: "8px",
                padding:
                  "11px 14px",
                borderRadius:
                  "12px",
                border:
                  "1px solid #d9e8ff",
                backgroundColor:
                  soloConTraspaso
                    ? "#eaf3ff"
                    : "#ffffff",
                cursor: "pointer",
                fontWeight: 700,
                color: "#315a9b",
                whiteSpace:
                  "nowrap",
              }}
            >
              <input
                type="checkbox"
                checked={
                  soloConTraspaso
                }
                onChange={(evento) =>
                  setSoloConTraspaso(
                    evento.target
                      .checked
                  )
                }
              />

              🔄 Solo con traspaso
            </label>

            <label
              style={{
                display: "flex",
                alignItems: "center",
                gap: "8px",
                padding:
                  "11px 14px",
                borderRadius:
                  "12px",
                border:
                  "1px solid #f1c27d",
                backgroundColor:
                  soloRevisionInventario
                    ? "#fff1dc"
                    : "#ffffff",
                cursor: "pointer",
                fontWeight: 700,
                color: "#a85b00",
                whiteSpace:
                  "nowrap",
              }}
            >
              <input
                type="checkbox"
                checked={
                  soloRevisionInventario
                }
                onChange={(evento) =>
                  setSoloRevisionInventario(
                    evento.target
                      .checked
                  )
                }
              />

              ⚠️ Solo revisar inventario
            </label>
          </div>
        </div>

        {soloRevisionInventario && (
          <div
            style={{
              marginBottom: "18px",
              padding: "12px 14px",
              borderRadius: "12px",
              border:
                "1px solid #f1c27d",
              backgroundColor:
                "#fff8ee",
              color: "#8c570c",
            }}
          >
            ⚠️ Hay{" "}
            <strong>
              {formatearNumero(
                compraMaestra
                  ?.totalProductosRevisionInventario
              )}
            </strong>{" "}
            productos que requieren validar o corregir
            existencias antes de generar una compra
            automática.
          </div>
        )}

        {productosFiltrados.length ===
        0 ? (
          <p>
            No hay productos que coincidan con los filtros seleccionados.
          </p>
        ) : (
          <div
            style={{
              display: "grid",
              gap: "14px",
            }}
          >
            {productosFiltrados.map(
              (producto) => (
                <div
                  key={
                    producto.llave
                  }
                  style={{
                    padding: "18px",
                    borderRadius:
                      "16px",
                    border:
                      soloRevisionInventario
                        ? "1px solid #f1c27d"
                        : "1px solid #eee3e8",
                    backgroundColor:
                      soloRevisionInventario
                        ? "#fffdf9"
                        : "#fffdfd",
                  }}
                >
                  <div
                    style={{
                      display:
                        "flex",
                      justifyContent:
                        "space-between",
                      gap: "20px",
                      flexWrap:
                        "wrap",
                    }}
                  >
                    <div>
                      <strong
                        style={{
                          fontSize:
                            "18px",
                        }}
                      >
                        {
                          producto.descripcion
                        }
                      </strong>

                      <div
                        style={{
                          marginTop:
                            "4px",
                          color:
                            "#7c7276",
                        }}
                      >
                        Código:{" "}
                        {producto.codigo ||
                          "Sin código"}
                      </div>
                    </div>

                    <div
                      style={{
                        textAlign:
                          "right",
                      }}
                    >
                      {soloRevisionInventario ? (
                        <strong
                          style={{
                            fontSize:
                              "20px",
                            color:
                              "#a85b00",
                          }}
                        >
                          ⚠️ Revisión requerida
                        </strong>
                      ) : (
                        <>
                          <strong
                            style={{
                              fontSize:
                                "22px",
                            }}
                          >
                            Comprar{" "}
                            {formatearNumero(
                              producto
                                .compraTotal
                            )}{" "}
                            pzas
                          </strong>

                          <div
                            style={{
                              marginTop:
                                "4px",
                              color:
                                "#207a4a",
                              fontWeight:
                                700,
                            }}
                          >
                            {formatearDinero(
                              producto
                                .inversionTotal
                            )}
                          </div>
                        </>
                      )}
                    </div>
                  </div>

                  {!soloRevisionInventario &&
                    producto
                      .cubiertoPorTraspasos >
                      0 && (
                      <div
                        style={{
                          marginTop:
                            "12px",
                          padding:
                            "10px 12px",
                          borderRadius:
                            "10px",
                          backgroundColor:
                            "#f4f8ff",
                          color:
                            "#315a9b",
                        }}
                      >
                        🔄 Traspasos cubren{" "}
                        <strong>
                          {formatearNumero(
                            producto
                              .cubiertoPorTraspasos
                          )}{" "}
                          piezas
                        </strong>{" "}
                        antes de comprar.
                      </div>
                    )}

                  <div
                    style={{
                      marginTop:
                        "14px",
                      display:
                        "grid",
                      gap: "8px",
                    }}
                  >
                    {(
                      producto.sucursales ||
                      []
                    ).map(
                      (
                        sucursal
                      ) => (
                        <div
                          key={
                            sucursal.branchId
                          }
                          style={{
                            padding:
                              "12px",
                            borderRadius:
                              "12px",
                            backgroundColor:
                              sucursal
                                .requiereRevisionInventario
                                ? "#fff4e8"
                                : "#faf7f8",
                            border:
                              sucursal
                                .requiereRevisionInventario
                                ? "1px solid #f1c27d"
                                : "1px solid transparent",
                          }}
                        >
                          <strong>
                            {
                              sucursal.sucursal
                            }
                          </strong>

                          {sucursal
                            .requiereRevisionInventario ? (
                            <>
                              <div
                                style={{
                                  marginTop:
                                    "8px",
                                  fontWeight:
                                    800,
                                  color:
                                    "#a85b00",
                                }}
                              >
                                ⚠️ Revisar inventario
                              </div>

                              <div
                                style={{
                                  marginTop:
                                    "6px",
                                }}
                              >
                                Existencia reportada:{" "}
                                <strong>
                                  {formatearNumero(
                                    sucursal
                                      .existenciaActual
                                  )}
                                </strong>{" "}
                                · Vendidas:{" "}
                                {formatearNumero(
                                  sucursal
                                    .piezasVendidas
                                )}
                              </div>

                              <div
                                style={{
                                  marginTop:
                                    "4px",
                                  color:
                                    "#7d6752",
                                }}
                              >
                                No se genera compra automática
                                hasta corregir o validar la
                                existencia negativa.
                              </div>
                            </>
                          ) : (
                            <>
                              <div
                                style={{
                                  marginTop:
                                    "6px",
                                }}
                              >
                                Existencia:{" "}
                                {formatearNumero(
                                  sucursal
                                    .existenciaActual
                                )}{" "}
                                · Vendidas:{" "}
                                {formatearNumero(
                                  sucursal
                                    .piezasVendidas
                                )}{" "}
                                · Comprar:{" "}
                                <strong>
                                  {formatearNumero(
                                    sucursal
                                      .cantidadComprar
                                  )}
                                </strong>
                              </div>

                              <div
                                style={{
                                  marginTop:
                                    "4px",
                                  color:
                                    "#6f666a",
                                }}
                              >
                                Cobertura objetivo:{" "}
                                {
                                  sucursal
                                    .coberturaObjetivo
                                }{" "}
                                días
                                {sucursal
                                  .cubiertoPorTraspaso >
                                  0 &&
                                  ` · Traspaso cubre ${formatearNumero(
                                    sucursal
                                      .cubiertoPorTraspaso
                                  )} pzas`}
                              </div>
                            </>
                          )}
                        </div>
                      )
                    )}
                  </div>
                </div>
              )
            )}
          </div>
        )}
      </div>
      )}

    </div>
  );
}
