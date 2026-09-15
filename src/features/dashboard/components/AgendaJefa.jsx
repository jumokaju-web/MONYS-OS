function AgendaJefa({
  recordatorios = [],
  movimientosPendientes = 0,
  cargando = false,
  error = "",
  abrirTesoreria,
  abrirImportador,
}) {
  const tareas = [
    ...(movimientosPendientes > 0
      ? [
          {
            id: "tesoreria-pendiente",
            prioridad: "alta",
            tipo: "tesoreria",
            titulo:
              movimientosPendientes === 1
                ? "1 movimiento necesita aclaración"
                : `${movimientosPendientes} movimientos necesitan aclaración`,
            detalle:
              "MONYS necesita tu decisión para clasificar correctamente el dinero.",
            boton:
              "Revisar movimiento",
          },
        ]
      : []),

    ...recordatorios,
  ];

  const ejecutarAccion = (
    tarea
  ) => {
    if (
      tarea.tipo ===
      "importador"
    ) {
      abrirImportador?.();
      return;
    }

    if (
      tarea.tipo ===
      "tesoreria"
    ) {
      abrirTesoreria?.();
    }
  };

  const hayTareas =
    tareas.length > 0;

  return (
    <section
      style={{
        background: hayTareas
          ? "#fff7f3"
          : "#f3faf6",
        border: hayTareas
          ? "1px solid #f0d1c5"
          : "1px solid #cae6d5",
        borderRadius: "18px",
        padding: "16px",
        marginBottom: "12px",
      }}
    >
      <div
        style={{
          fontSize: "11px",
          fontWeight: "900",
          color: hayTareas
            ? "#a65435"
            : "#377357",
          marginBottom: "5px",
          letterSpacing: "0.5px",
        }}
      >
        {hayTareas
          ? "🚨 REQUIERE TU ATENCIÓN"
          : "✅ OPERACIÓN BAJO CONTROL"}
      </div>

      {cargando && (
        <div
          style={{
            color: "#77686f",
            fontSize: "13px",
          }}
        >
          MONYS está revisando qué falta hoy...
        </div>
      )}

      {!cargando && error && (
        <div
          role="alert"
          style={{
            marginTop: "8px",
            padding: "10px",
            borderRadius: "10px",
            background: "#fff1f1",
            color: "#9a3333",
            fontSize: "13px",
          }}
        >
          ⚠️ {error}
        </div>
      )}

      {!cargando &&
        !error &&
        !hayTareas && (
          <>
            <strong
              style={{
                display: "block",
                fontSize: "18px",
                color: "#30232a",
              }}
            >
              No hay pendientes importantes hoy
            </strong>

            <div
              style={{
                marginTop: "5px",
                color: "#77686f",
                fontSize: "13px",
              }}
            >
              Si algo requiere tu decisión,
              MONYS lo mostrará aquí.
            </div>
          </>
        )}

      {!cargando &&
        hayTareas && (
          <>
            <strong
              style={{
                display: "block",
                fontSize: "18px",
                color: "#30232a",
                marginBottom: "10px",
              }}
            >
              Hola, Jefa: hoy hay{" "}
              {tareas.length}{" "}
              {tareas.length === 1
                ? "tarea importante"
                : "tareas importantes"}
            </strong>

            <div
              style={{
                display: "grid",
                gap: "9px",
              }}
            >
              {tareas.map(
                (tarea) => (
                  <article
                    key={tarea.id}
                    style={{
                      padding: "12px",
                      border:
                        "1px solid #efd9d0",
                      borderRadius: "12px",
                      background: "#ffffff",
                    }}
                  >
                    <strong
                      style={{
                        display: "block",
                        color: "#402b34",
                        fontSize: "14px",
                      }}
                    >
                      {tarea.prioridad ===
                      "alta"
                        ? "🔴 "
                        : "🟡 "}
                      {tarea.titulo}
                    </strong>

                    <div
                      style={{
                        marginTop: "4px",
                        color: "#77686f",
                        fontSize: "12px",
                        lineHeight: 1.4,
                      }}
                    >
                      {tarea.detalle}
                    </div>

                    <button
                      type="button"
                      onClick={() =>
                        ejecutarAccion(
                          tarea
                        )
                      }
                      style={{
                        marginTop: "9px",
                        border:
                          "1px solid #e3c4b8",
                        background: "#ffffff",
                        color: "#8d4b35",
                        borderRadius: "10px",
                        padding: "8px 11px",
                        fontWeight: "800",
                        cursor: "pointer",
                        fontSize: "12px",
                      }}
                    >
                      {tarea.boton}
                    </button>
                  </article>
                )
              )}
            </div>
          </>
        )}
    </section>
  );
}

export default AgendaJefa;