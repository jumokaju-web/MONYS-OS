import {
  useState,
} from "react";

import ListaPreparacionTraspasos from "./ListaPreparacionTraspasos";

function convertirNumero(valor) {
  const numero = Number(valor);

  return Number.isFinite(numero)
    ? numero
    : 0;
}

function formatearNumero(valor) {
  return new Intl.NumberFormat(
    "es-MX"
  ).format(
    convertirNumero(valor)
  );
}

function obtenerEstiloPrioridad(
  prioridad
) {
  if (prioridad === "ALTA") {
    return {
      fondo: "#fff1f1",
      borde: "#efb8b8",
      texto: "#a52d2d",
      icono: "🔴",
    };
  }

  if (prioridad === "MEDIA") {
    return {
      fondo: "#fff8ee",
      borde: "#f1c27d",
      texto: "#a85b00",
      icono: "🟡",
    };
  }

  return {
    fondo: "#f3fbf6",
    borde: "#cde8d7",
    texto: "#207a4a",
    icono: "🟢",
  };
}

export default function PlanTraspasos({
  planTraspasos,
}) {
  const [
    busqueda,
    setBusqueda,
  ] = useState("");

  const [
    rutaSeleccionada,
    setRutaSeleccionada,
  ] = useState("");

  const [
    prioridadSeleccionada,
    setPrioridadSeleccionada,
  ] = useState("");

  const traspasos =
    Array.isArray(planTraspasos)
      ? planTraspasos
      : [];

  const totalPiezas =
    traspasos.reduce(
      (total, traspaso) =>
        total +
        convertirNumero(
          traspaso?.cantidadSugerida
        ),
      0
    );

  const mapaRutas =
    new Map();

  for (
    const traspaso of traspasos
  ) {
    const branchOrigenId =
      traspaso?.branchOrigenId ||
      "origen";

    const branchDestinoId =
      traspaso?.branchDestinoId ||
      "destino";

    const sucursalOrigen =
      traspaso?.sucursalOrigen ||
      "Origen";

    const sucursalDestino =
      traspaso?.sucursalDestino ||
      "Destino";

    const claveRuta =
      `${branchOrigenId}->${branchDestinoId}`;

    const rutaActual =
      mapaRutas.get(
        claveRuta
      ) || {
        claveRuta,

        branchOrigenId,

        branchDestinoId,

        sucursalOrigen,

        sucursalDestino,

        movimientos: 0,

        piezas: 0,
      };

    rutaActual.movimientos += 1;

    rutaActual.piezas +=
      convertirNumero(
        traspaso?.cantidadSugerida
      );

    mapaRutas.set(
      claveRuta,
      rutaActual
    );
  }

  const resumenRutas =
    Array.from(
      mapaRutas.values()
    ).sort(
      (a, b) =>
        b.piezas -
        a.piezas
    );

  const traspasosDeRuta =
    traspasos.filter(
      (traspaso) => {
        if (!rutaSeleccionada) {
          return true;
        }

        const claveRuta =
          `${
            traspaso?.branchOrigenId ||
            "origen"
          }->${
            traspaso?.branchDestinoId ||
            "destino"
          }`;

        return (
          claveRuta ===
          rutaSeleccionada
        );
      }
    );

  const totalAlta =
    traspasosDeRuta.filter(
      (traspaso) =>
        traspaso?.prioridad ===
        "ALTA"
    ).length;

  const totalMedia =
    traspasosDeRuta.filter(
      (traspaso) =>
        traspaso?.prioridad ===
        "MEDIA"
    ).length;

  const totalBaja =
    traspasosDeRuta.filter(
      (traspaso) =>
        traspaso?.prioridad ===
        "BAJA"
    ).length;

  const textoBusqueda =
    busqueda
      .trim()
      .toLowerCase();

  const traspasosFiltrados =
    traspasos.filter(
      (traspaso) => {
        const claveRuta =
          `${
            traspaso?.branchOrigenId ||
            "origen"
          }->${
            traspaso?.branchDestinoId ||
            "destino"
          }`;

        const coincideRuta =
          !rutaSeleccionada ||
          claveRuta ===
            rutaSeleccionada;

        if (!coincideRuta) {
          return false;
        }

        const coincidePrioridad =
          !prioridadSeleccionada ||
          traspaso?.prioridad ===
            prioridadSeleccionada;

        if (!coincidePrioridad) {
          return false;
        }

        if (!textoBusqueda) {
          return true;
        }

        const codigo =
          String(
            traspaso?.codigo || ""
          ).toLowerCase();

        const producto =
          String(
            traspaso?.producto || ""
          ).toLowerCase();

        const sucursalOrigen =
          String(
            traspaso?.sucursalOrigen ||
              ""
          ).toLowerCase();

        const sucursalDestino =
          String(
            traspaso?.sucursalDestino ||
              ""
          ).toLowerCase();

        return (
          codigo.includes(
            textoBusqueda
          ) ||
          producto.includes(
            textoBusqueda
          ) ||
          sucursalOrigen.includes(
            textoBusqueda
          ) ||
          sucursalDestino.includes(
            textoBusqueda
          )
        );
      }
    );

  const rutaActiva =
    resumenRutas.find(
      (ruta) =>
        ruta.claveRuta ===
        rutaSeleccionada
    );

  if (traspasos.length === 0) {
    return (
      <section
        style={{
          marginBottom: "28px",
          padding: "22px",
          borderRadius: "20px",
          border:
            "1px solid #d9e8ff",
          backgroundColor:
            "#f8fbff",
        }}
      >
        <h2
          style={{
            marginTop: 0,
          }}
        >
          🔄 Plan de Traspasos
        </h2>

        <p
          style={{
            marginBottom: 0,
            color: "#6f666a",
          }}
        >
          MONYS OS no encontró
          traspasos seguros entre
          sucursales con los datos
          actuales.
        </p>
      </section>
    );
  }

  return (
    <section
      style={{
        marginBottom: "28px",
        padding: "22px",
        borderRadius: "20px",
        border:
          "1px solid #d9e8ff",
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
          gap: "18px",
          flexWrap: "wrap",
          marginBottom: "20px",
        }}
      >
        <div>
          <p
            style={{
              margin: 0,
              color: "#315a9b",
              fontWeight: 800,
              letterSpacing: "0.8px",
            }}
          >
            REBALANCEO DE INVENTARIO
          </p>

          <h2
            style={{
              margin: "6px 0 0",
            }}
          >
            🔄 Plan de Traspasos
          </h2>
        </div>

        <div
          style={{
            display: "flex",
            gap: "12px",
            flexWrap: "wrap",
          }}
        >
          <div
            style={{
              padding: "12px 16px",
              borderRadius: "12px",
              backgroundColor:
                "#f4f8ff",
              border:
                "1px solid #d9e8ff",
            }}
          >
            <div
              style={{
                fontSize: "13px",
                color: "#6f666a",
              }}
            >
              Movimientos
            </div>

            <strong
              style={{
                display: "block",
                marginTop: "4px",
                fontSize: "22px",
              }}
            >
              {formatearNumero(
                traspasos.length
              )}
            </strong>
          </div>

          <div
            style={{
              padding: "12px 16px",
              borderRadius: "12px",
              backgroundColor:
                "#f3fbf6",
              border:
                "1px solid #cde8d7",
            }}
          >
            <div
              style={{
                fontSize: "13px",
                color: "#6f666a",
              }}
            >
              Piezas a mover
            </div>

            <strong
              style={{
                display: "block",
                marginTop: "4px",
                fontSize: "22px",
              }}
            >
              {formatearNumero(
                totalPiezas
              )}
            </strong>
          </div>
        </div>
      </div>

      <div
        style={{
          marginBottom: "20px",
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent:
              "space-between",
            alignItems: "center",
            gap: "12px",
            flexWrap: "wrap",
            marginBottom: "12px",
          }}
        >
          <h3
            style={{
              margin: 0,
            }}
          >
            🏪 Resumen por ruta
          </h3>

          {rutaSeleccionada && (
            <button
              type="button"
              onClick={() =>
                setRutaSeleccionada("")
              }
              style={{
                padding:
                  "9px 13px",
                borderRadius:
                  "10px",
                border:
                  "1px solid #d9e8ff",
                backgroundColor:
                  "#ffffff",
                color:
                  "#315a9b",
                fontWeight: 800,
                cursor: "pointer",
              }}
            >
              ✕ Ver todas las rutas
            </button>
          )}
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns:
              "repeat(auto-fit, minmax(260px, 1fr))",
            gap: "12px",
          }}
        >
          {resumenRutas.map(
            (ruta) => {
              const activa =
                rutaSeleccionada ===
                ruta.claveRuta;

              return (
                <button
                  key={
                    ruta.claveRuta
                  }
                  type="button"
                  onClick={() =>
                    setRutaSeleccionada(
                      activa
                        ? ""
                        : ruta.claveRuta
                    )
                  }
                  style={{
                    width: "100%",
                    textAlign: "left",
                    padding: "16px",
                    borderRadius:
                      "14px",
                    border:
                      activa
                        ? "2px solid #315a9b"
                        : "1px solid #d9e8ff",
                    backgroundColor:
                      activa
                        ? "#eaf3ff"
                        : "#f8fbff",
                    cursor: "pointer",
                  }}
                >
                  <strong
                    style={{
                      display:
                        "block",
                      fontSize:
                        "17px",
                      color:
                        "#315a9b",
                    }}
                  >
                    🏪{" "}
                    {
                      ruta.sucursalOrigen
                    }
                    {" → "}
                    🏪{" "}
                    {
                      ruta.sucursalDestino
                    }
                  </strong>

                  <div
                    style={{
                      display: "flex",
                      gap: "20px",
                      flexWrap:
                        "wrap",
                      marginTop:
                        "12px",
                    }}
                  >
                    <div>
                      <div
                        style={{
                          color:
                            "#6f666a",
                          fontSize:
                            "13px",
                        }}
                      >
                        Movimientos
                      </div>

                      <strong
                        style={{
                          display:
                            "block",
                          marginTop:
                            "3px",
                          fontSize:
                            "22px",
                        }}
                      >
                        {formatearNumero(
                          ruta.movimientos
                        )}
                      </strong>
                    </div>

                    <div>
                      <div
                        style={{
                          color:
                            "#6f666a",
                          fontSize:
                            "13px",
                        }}
                      >
                        Piezas
                      </div>

                      <strong
                        style={{
                          display:
                            "block",
                          marginTop:
                            "3px",
                          fontSize:
                            "22px",
                          color:
                            "#207a4a",
                        }}
                      >
                        {formatearNumero(
                          ruta.piezas
                        )}
                      </strong>
                    </div>
                  </div>

                  <div
                    style={{
                      marginTop:
                        "10px",
                      color:
                        "#315a9b",
                      fontSize:
                        "13px",
                      fontWeight: 800,
                    }}
                  >
                    {activa
                      ? "✓ Ruta seleccionada"
                      : "Ver esta ruta →"}
                  </div>
                </button>
              );
            }
          )}
        </div>
      </div>

      {rutaActiva && (
        <div
          style={{
            marginBottom: "18px",
            padding: "12px 14px",
            borderRadius: "12px",
            border:
              "1px solid #d9e8ff",
            backgroundColor:
              "#eaf3ff",
            color: "#315a9b",
            fontWeight: 800,
          }}
        >
          🔎 Mostrando ruta:{" "}
          {rutaActiva.sucursalOrigen}
          {" → "}
          {rutaActiva.sucursalDestino}
          {" · "}
          {formatearNumero(
            rutaActiva.movimientos
          )}{" "}
          movimientos
          {" · "}
          {formatearNumero(
            rutaActiva.piezas
          )}{" "}
          piezas
        </div>
      )}

           {rutaActiva && (
        <ListaPreparacionTraspasos
          traspasos={
            traspasosDeRuta
          }
          sucursalOrigen={
            rutaActiva.sucursalOrigen
          }
          sucursalDestino={
            rutaActiva.sucursalDestino
          }
        />
      )}

      <div
        style={{
          marginBottom: "18px",
        }}
      >
        <h3
          style={{
            margin:
              "0 0 10px",
          }}
        >
          🚦 Filtrar por prioridad
        </h3>

        <div
          style={{
            display: "flex",
            gap: "10px",
            flexWrap: "wrap",
          }}
        >
          <button
            type="button"
            onClick={() =>
              setPrioridadSeleccionada("")
            }
            style={{
              padding:
                "10px 14px",
              borderRadius:
                "12px",
              border:
                !prioridadSeleccionada
                  ? "2px solid #315a9b"
                  : "1px solid #d9e8ff",
              backgroundColor:
                !prioridadSeleccionada
                  ? "#eaf3ff"
                  : "#ffffff",
              color: "#315a9b",
              fontWeight: 800,
              cursor: "pointer",
            }}
          >
            Todas (
            {formatearNumero(
              traspasosDeRuta.length
            )}
            )
          </button>

          <button
            type="button"
            onClick={() =>
              setPrioridadSeleccionada(
                "ALTA"
              )
            }
            style={{
              padding:
                "10px 14px",
              borderRadius:
                "12px",
              border:
                prioridadSeleccionada ===
                "ALTA"
                  ? "2px solid #a52d2d"
                  : "1px solid #efb8b8",
              backgroundColor:
                prioridadSeleccionada ===
                "ALTA"
                  ? "#ffe5e5"
                  : "#fff1f1",
              color: "#a52d2d",
              fontWeight: 800,
              cursor: "pointer",
            }}
          >
            🔴 ALTA (
            {formatearNumero(
              totalAlta
            )}
            )
          </button>

          <button
            type="button"
            onClick={() =>
              setPrioridadSeleccionada(
                "MEDIA"
              )
            }
            style={{
              padding:
                "10px 14px",
              borderRadius:
                "12px",
              border:
                prioridadSeleccionada ===
                "MEDIA"
                  ? "2px solid #a85b00"
                  : "1px solid #f1c27d",
              backgroundColor:
                prioridadSeleccionada ===
                "MEDIA"
                  ? "#ffedcf"
                  : "#fff8ee",
              color: "#a85b00",
              fontWeight: 800,
              cursor: "pointer",
            }}
          >
            🟡 MEDIA (
            {formatearNumero(
              totalMedia
            )}
            )
          </button>

          <button
            type="button"
            onClick={() =>
              setPrioridadSeleccionada(
                "BAJA"
              )
            }
            style={{
              padding:
                "10px 14px",
              borderRadius:
                "12px",
              border:
                prioridadSeleccionada ===
                "BAJA"
                  ? "2px solid #207a4a"
                  : "1px solid #cde8d7",
              backgroundColor:
                prioridadSeleccionada ===
                "BAJA"
                  ? "#e4f6eb"
                  : "#f3fbf6",
              color: "#207a4a",
              fontWeight: 800,
              cursor: "pointer",
            }}
          >
            🟢 BAJA (
            {formatearNumero(
              totalBaja
            )}
            )
          </button>
        </div>
      </div>

      <div
        style={{
          marginBottom: "18px",
          padding: "12px 14px",
          borderRadius: "12px",
          backgroundColor:
            "#f4f8ff",
          color: "#315a9b",
        }}
      >
        💡 Estos movimientos son
        recomendaciones de MONYS OS.
        Todavía no ejecutan ningún
        traspaso real.
      </div>

      <div
        style={{
          marginBottom: "18px",
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
          placeholder="Buscar por código, producto, origen o destino..."
          style={{
            width: "100%",
            boxSizing: "border-box",
            padding: "12px 14px",
            borderRadius: "12px",
            border:
              "1px solid #cbdcf7",
            outline: "none",
            fontSize: "15px",
            backgroundColor:
              "#ffffff",
          }}
        />

        {(textoBusqueda ||
          rutaSeleccionada ||
          prioridadSeleccionada) && (
          <div
            style={{
              marginTop: "10px",
              color: "#6f666a",
              fontSize: "14px",
            }}
          >
            Mostrando{" "}
            <strong>
              {formatearNumero(
                traspasosFiltrados.length
              )}
            </strong>{" "}
            de{" "}
            <strong>
              {formatearNumero(
                traspasos.length
              )}
            </strong>{" "}
            movimientos.
          </div>
        )}
      </div>

      {traspasosFiltrados.length ===
      0 ? (
        <div
          style={{
            padding: "18px",
            borderRadius: "12px",
            backgroundColor:
              "#faf7f8",
            color: "#6f666a",
          }}
        >
          No hay traspasos que
          coincidan con los filtros.
        </div>
      ) : (
        <div
          style={{
            display: "grid",
            gap: "12px",
          }}
        >
          {traspasosFiltrados.map(
            (
              traspaso,
              indice
            ) => {
              const estilo =
                obtenerEstiloPrioridad(
                  traspaso
                    ?.prioridad
                );

              return (
                <div
                  key={
                    `${traspaso?.productId || traspaso?.codigo || "producto"}-${traspaso?.branchOrigenId || "origen"}-${traspaso?.branchDestinoId || "destino"}-${indice}`
                  }
                  style={{
                    padding: "16px",
                    borderRadius:
                      "14px",
                    border:
                      `1px solid ${estilo.borde}`,
                    backgroundColor:
                      "#fffdfd",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      justifyContent:
                        "space-between",
                      alignItems:
                        "flex-start",
                      gap: "18px",
                      flexWrap:
                        "wrap",
                    }}
                  >
                    <div
                      style={{
                        flex:
                          "1 1 500px",
                      }}
                    >
                      <div
                        style={{
                          display:
                            "flex",
                          gap: "8px",
                          alignItems:
                            "center",
                          flexWrap:
                            "wrap",
                        }}
                      >
                        <strong
                          style={{
                            fontSize:
                              "18px",
                          }}
                        >
                          {traspaso
                            ?.producto ||
                            "Producto"}
                        </strong>

                        <span
                          style={{
                            padding:
                              "4px 8px",
                            borderRadius:
                              "999px",
                            backgroundColor:
                              estilo.fondo,
                            color:
                              estilo.texto,
                            border:
                              `1px solid ${estilo.borde}`,
                            fontSize:
                              "12px",
                            fontWeight:
                              800,
                          }}
                        >
                          {
                            estilo.icono
                          }{" "}
                          {
                            traspaso
                              ?.prioridad ||
                            "BAJA"
                          }
                        </span>
                      </div>

                      <div
                        style={{
                          marginTop:
                            "5px",
                          color:
                            "#7c7276",
                        }}
                      >
                        Código:{" "}
                        {traspaso
                          ?.codigo ||
                          "Sin código"}
                      </div>

                      <div
                        style={{
                          marginTop:
                            "12px",
                          padding:
                            "12px 14px",
                          borderRadius:
                            "12px",
                          backgroundColor:
                            "#f4f8ff",
                          color:
                            "#315a9b",
                          fontWeight:
                            800,
                        }}
                      >
                        🏪{" "}
                        {traspaso
                          ?.sucursalOrigen ||
                          "Origen"}
                        {"  →  "}
                        🏪{" "}
                        {traspaso
                          ?.sucursalDestino ||
                          "Destino"}
                      </div>
                    </div>

                    <div
                      style={{
                        textAlign:
                          "right",
                        minWidth:
                          "150px",
                      }}
                    >
                      <div
                        style={{
                          color:
                            "#6f666a",
                          fontSize:
                            "13px",
                        }}
                      >
                        Mover
                      </div>

                      <strong
                        style={{
                          display:
                            "block",
                          marginTop:
                            "3px",
                          fontSize:
                            "28px",
                          color:
                            "#315a9b",
                        }}
                      >
                        {formatearNumero(
                          traspaso
                            ?.cantidadSugerida
                        )}{" "}
                        pzas
                      </strong>
                    </div>
                  </div>

                  <div
                    style={{
                      marginTop:
                        "14px",
                      display: "grid",
                      gridTemplateColumns:
                        "repeat(auto-fit, minmax(210px, 1fr))",
                      gap: "10px",
                    }}
                  >
                    <div
                      style={{
                        padding:
                          "10px 12px",
                        borderRadius:
                          "10px",
                        backgroundColor:
                          "#faf7f8",
                      }}
                    >
                      <strong>
                        {
                          traspaso
                            ?.sucursalOrigen
                        }
                      </strong>

                      <div
                        style={{
                          marginTop:
                            "5px",
                          color:
                            "#6f666a",
                        }}
                      >
                        Existencia:{" "}
                        {formatearNumero(
                          traspaso
                            ?.existenciaOrigen
                        )}
                        {" · "}
                        Vendidas:{" "}
                        {formatearNumero(
                          traspaso
                            ?.ventasOrigen
                        )}
                      </div>
                    </div>

                    <div
                      style={{
                        padding:
                          "10px 12px",
                        borderRadius:
                          "10px",
                        backgroundColor:
                          "#faf7f8",
                      }}
                    >
                      <strong>
                        {
                          traspaso
                            ?.sucursalDestino
                        }
                      </strong>

                      <div
                        style={{
                          marginTop:
                            "5px",
                          color:
                            "#6f666a",
                        }}
                      >
                        Existencia:{" "}
                        {formatearNumero(
                          traspaso
                            ?.existenciaDestino
                        )}
                        {" · "}
                        Vendidas:{" "}
                        {formatearNumero(
                          traspaso
                            ?.ventasDestino
                        )}
                      </div>
                    </div>
                  </div>

                  {traspaso
                    ?.motivo && (
                    <div
                      style={{
                        marginTop:
                          "12px",
                        color:
                          "#6f666a",
                        fontSize:
                          "14px",
                      }}
                    >
                      💬{" "}
                      {
                        traspaso.motivo
                      }
                    </div>
                  )}
                </div>
              );
            }
          )}
        </div>
      )}
    </section>
  );
}