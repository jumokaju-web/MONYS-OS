// @ts-nocheck

import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",

  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",

  "Access-Control-Allow-Methods":
    "POST, OPTIONS",
};

type EntradaAnalisisCampana = {
  campana?: Record<
    string,
    unknown
  >;

  resultado?: Record<
    string,
    unknown
  >;

  aprendizajeBase?: Record<
    string,
    unknown
  >;
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", {
      headers: corsHeaders,
    });
  }

  if (req.method !== "POST") {
    return new Response(
      JSON.stringify({
        ok: false,
        error:
          "Método no permitido.",
      }),
      {
        status: 405,

        headers: {
          ...corsHeaders,

          "Content-Type":
            "application/json",
        },
      }
    );
  }

  try {
    const body:
      EntradaAnalisisCampana =
        await req.json();

    const {
      campana = {},
      resultado = {},
      aprendizajeBase = {},
    } = body || {};

    const historial =
      Array.isArray(
        resultado?.historial
      )
        ? resultado.historial
        : [];

    if (historial.length === 0) {
      return new Response(
        JSON.stringify({
          ok: false,

          error:
            "La campaña no tiene avances reales para analizar.",
        }),
        {
          status: 400,

          headers: {
            ...corsHeaders,

            "Content-Type":
              "application/json",
          },
        }
      );
    }

    const apiKey =
      Deno.env.get(
        "OPENAI_API_KEY"
      );

    if (!apiKey) {
      return new Response(
        JSON.stringify({
          ok: false,

          error:
            "Falta OPENAI_API_KEY en Supabase.",
        }),
        {
          status: 500,

          headers: {
            ...corsHeaders,

            "Content-Type":
              "application/json",
          },
        }
      );
    }

    const datosReales =
      JSON.stringify(
        {
          campana: {
            nombre:
              campana?.nombre ||
              "",

            objetivo:
              campana?.objetivo ||
              "",

            producto:
              campana?.producto ||
              "",

            canal:
              campana
                ?.canal_principal ||
              "",

            presupuesto:
              Number(
                campana
                  ?.presupuesto ||
                  0
              ),

            problemaOportunidad:
              campana
                ?.problema_oportunidad ||
              "",

            hipotesis:
              campana?.hipotesis ||
              "",
          },

          resultado,

          aprendizajeBase,
        },
        null,
        2
      );

    const prompt = `
Eres el Motor de Aprendizaje de Campañas
de MONYS OS.

Tu trabajo es convertir los resultados
reales de una campaña terminada en
aprendizaje empresarial reutilizable.

REGLAS OBLIGATORIAS:

1. Usa solamente los datos proporcionados.

2. No inventes ventas, costos, utilidad,
   conversiones, causas ni resultados.

3. Distingue claramente:
   - DATO_REAL;
   - ESTIMACION;
   - HIPOTESIS.

4. Si los datos no permiten comprobar algo,
   indícalo como limitación.

5. No afirmes que la campaña causó todas
   las ventas si no existe evidencia causal.

6. Evalúa si conviene:
   - REPETIR;
   - MEJORAR;
   - NO_REPETIR;
   - REQUIERE_MAS_DATOS.

7. La confianza debe depender de la
   cantidad y calidad de los registros.

8. Prioriza venta generada, gasto,
   pedidos, costo por pedido,
   retorno sobre gasto y aprendizaje.

9. La recomendación debe ser concreta
   y útil para una campaña futura.

DATOS DISPONIBLES:

${datosReales}

Devuelve SOLO JSON válido con esta forma:

{
  "resumen": "",
  "resultadoPrincipal": "",
  "queFunciono": [],
  "queNoSeComprobo": [],
  "hipotesisAprendidas": [],
  "limitaciones": [],
  "decisionFutura": "REPETIR",
  "recomendacionFutura": "",
  "confianza": 0,
  "clasificacionFuente": "DATO_REAL"
}

REGLAS DE RESPUESTA:

- confianza debe ser un número de 0 a 100.
- queFunciono debe contener solamente
  hechos apoyados por datos.
- queNoSeComprobo debe evitar conclusiones
  falsas.
- hipotesisAprendidas debe identificarse
  como hipótesis, no como hechos.
- Usa textos breves y claros.
`;

    const respuesta =
      await fetch(
        "https://api.openai.com/v1/chat/completions",
        {
          method: "POST",

          headers: {
            Authorization:
              `Bearer ${apiKey}`,

            "Content-Type":
              "application/json",
          },

          body: JSON.stringify({
            model: "gpt-5.6",

            messages: [
              {
                role: "system",

                content:
                  "Responde únicamente con JSON válido y no inventes datos.",
              },

              {
                role: "user",
                content: prompt,
              },
            ],

            response_format: {
              type: "json_object",
            },
          }),
        }
      );

    const datos =
      await respuesta.json();

    if (!respuesta.ok) {
      console.error(
        "Error OpenAI analizando campaña:",
        datos
      );

      return new Response(
        JSON.stringify({
          ok: false,

          error:
            datos?.error?.message ||
            "OpenAI no pudo analizar la campaña.",
        }),
        {
          status: 500,

          headers: {
            ...corsHeaders,

            "Content-Type":
              "application/json",
          },
        }
      );
    }

    const contenido =
      datos?.choices?.[0]
        ?.message?.content;

    if (!contenido) {
      throw new Error(
        "MONYS no recibió un análisis válido."
      );
    }

    const analisis =
      JSON.parse(contenido);

    return new Response(
      JSON.stringify({
        ok: true,
        analisis,
      }),
      {
        status: 200,

        headers: {
          ...corsHeaders,

          "Content-Type":
            "application/json",
        },
      }
    );
  } catch (error) {
    console.error(
      "Error analizar-campana-marketing:",
      error
    );

    return new Response(
      JSON.stringify({
        ok: false,

        error:
          error?.message ||
          "Error inesperado al analizar la campaña.",
      }),
      {
        status: 500,

        headers: {
          ...corsHeaders,

          "Content-Type":
            "application/json",
        },
      }
    );
  }
});