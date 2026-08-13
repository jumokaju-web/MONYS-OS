import { useEffect, useState } from "react";
import { supabase } from "../../../supabase";

export default function CentroOrdenes({
  volverAlDashboard,
}) {
  const [ordenes, setOrdenes] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    cargarOrdenes();
  }, []);

  async function cargarOrdenes() {
    try {
      setCargando(true);
      setError("");

      const { data, error: errorSupabase } =
        await supabase
          .from("ordenes_compra")
          .select("*")
          .order("creado_en", {
            ascending: false,
          });

      if (errorSupabase) {
        throw errorSupabase;
      }

      setOrdenes(data || []);
    } catch (errorCarga) {
      console.error(
        "Error al cargar órdenes:",
        errorCarga
      );

      setError(
        "No se pudieron cargar las órdenes."
      );
    } finally {
      setCargando(false);
    }
  }

  return (
    <div
      style={{
        background: "#fff",
        padding: 24,
        borderRadius: 16,
        margin: 20,
        boxShadow:
          "0 4px 15px rgba(0,0,0,.08)",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: 16,
          flexWrap: "wrap",
          marginBottom: 20,
        }}
      >
        <div>
          <h2
            style={{
              margin: 0,
            }}
          >
            📦 Centro de Órdenes
          </h2>

          <p
            style={{
              marginBottom: 0,
              color: "#666",
            }}
          >
            Aquí aparecerán todas las órdenes
            generadas automáticamente por el CEO.
          </p>
        </div>

        <button
          type="button"
          onClick={volverAlDashboard}
          style={{
            padding: "11px 18px",
            borderRadius: 10,
            border: "1px solid #eadde4",
            background: "#ffffff",
            color: "#5e3048",
            fontWeight: "700",
            cursor: "pointer",
          }}
        >
          ← Volver al Dashboard
        </button>
      </div>

      {cargando && (
        <div
          style={{
            padding: 20,
            textAlign: "center",
            color: "#666",
          }}
        >
          Cargando órdenes...
        </div>
      )}

      {error && (
        <div
          style={{
            padding: 16,
            borderRadius: 12,
            background: "#fff4f4",
            border: "1px solid #efc0c0",
            color: "#9b3030",
            textAlign: "center",
          }}
        >
          {error}
        </div>
      )}

      {!cargando &&
        !error &&
        ordenes.length === 0 && (
          <div
            style={{
              marginTop: 20,
              padding: 20,
              border: "2px dashed #ccc",
              borderRadius: 12,
              textAlign: "center",
            }}
          >
            Sin órdenes pendientes.
          </div>
        )}

      {!cargando &&
        !error &&
        ordenes.length > 0 && (
          <div
            style={{
              marginTop: 20,
              display: "grid",
              gap: 14,
            }}
          >
            {ordenes.map((orden) => (
              <div
                key={orden.id}
                style={{
                  padding: 18,
                  borderRadius: 14,
                  border:
                    "1px solid #eadde4",
                  background: "#faf7f9",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent:
                      "space-between",
                    gap: 12,
                    flexWrap: "wrap",
                  }}
                >
                  <strong
                    style={{
                      fontSize: 18,
                      color: "#5e3048",
                    }}
                  >
                    {orden.titulo}
                  </strong>

                  <span
                    style={{
                      fontWeight: "700",
                    }}
                  >
                    {orden.prioridad}
                  </span>
                </div>

                <p
                  style={{
                    margin: "10px 0",
                    color: "#555",
                    lineHeight: "1.5",
                  }}
                >
                  {orden.descripcion}
                </p>

                <div
                  style={{
                    display: "flex",
                    gap: 18,
                    flexWrap: "wrap",
                    fontSize: 14,
                  }}
                >
                  <span>
                    <strong>Área:</strong>{" "}
                    {orden.area}
                  </span>

                  <span>
                    <strong>Estado:</strong>{" "}
                    {orden.estado}
                  </span>

                  <span>
                    <strong>Costo:</strong> $
                    {Number(
                      orden.costo_estimado || 0
                    ).toLocaleString("es-MX")}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
    </div>
  );
}