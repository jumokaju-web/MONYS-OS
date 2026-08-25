// @ts-nocheck
import "jsr:@supabase/functions-js/edge-runtime.d.ts";

import { createClient } from
  "https://esm.sh/@supabase/supabase-js@2";


const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};


Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(
      "ok",
      {
        headers: corsHeaders,
      }
    );
  }


  try {
    const {
      cierreId,
    } = await req.json();


    if (!cierreId) {
      throw new Error(
        "Falta cierreId."
      );
    }


    const supabaseUrl =
      Deno.env.get(
        "SUPABASE_URL"
      );

    const serviceRoleKey =
      Deno.env.get(
        "SUPABASE_SERVICE_ROLE_KEY"
      );

    const openAiKey =
      Deno.env.get(
        "OPENAI_API_KEY"
      );


    if (
      !supabaseUrl ||
      !serviceRoleKey
    ) {
      throw new Error(
        "Falta configuración de Supabase."
      );
    }


    if (!openAiKey) {
      throw new Error(
        "Falta OPENAI_API_KEY."
      );
    }


    const supabase =
      createClient(
        supabaseUrl,
        serviceRoleKey
      );


    const {
      data: cierre,
      error: errorCierre,
    } = await supabase
      .from(
        "cierres_turno"
      )
      .select(`
        id,
        branch_id,
        responsable,
        turno,
        pendientes,
        incidencias,
        productos_solicitados,
        objeciones_clientes,
        aprendizajes,
        observaciones,
        fecha,
        created_at
      `)
      .eq(
        "id",
        cierreId
      )
      .single();


    if (errorCierre) {
      throw errorCierre;
    }


    if (!cierre) {
      throw new Error(
        "No se encontró el cierre."
      );
    }


    const respuestaIA =
      await fetch(
        "https://api.openai.com/v1/responses",
        {
          method: "POST",

          headers: {
            Authorization:
              `Bearer ${openAiKey}`,

            "Content-Type":
              "application/json",
          },

          body: JSON.stringify({
            model:
              "gpt-4.1-mini",

            input: [
              {
                role: "user",

                content: [
                  {
                    type:
                      "input_text",

                    text: `
Eres MONYS OS, supervisor operativo inteligente de una empresa.

Analiza este cierre de turno y convierte la información reportada por el empleado en señales operativas útiles.

CIERRE:

Responsable:
${cierre.responsable || "Sin responsable"}

Turno:
${cierre.turno || "Sin turno"}

Fecha:
${cierre.fecha || "Sin fecha"}

Pendientes:
${cierre.pendientes || "Sin pendientes reportados"}

Incidencias:
${cierre.incidencias || "Sin incidencias reportadas"}

Productos solicitados:
${cierre.productos_solicitados || "Sin productos solicitados reportados"}

Objeciones de clientes:
${cierre.objeciones_clientes || "Sin objeciones reportadas"}

Aprendizajes:
${cierre.aprendizajes || "Sin aprendizajes reportados"}

Observaciones:
${cierre.observaciones || "Sin observaciones"}

OBJETIVO:

1. Detecta qué requiere atención.
2. Distingue problemas reales de comentarios sin importancia.
3. Detecta oportunidades comerciales.
4. Detecta posibles faltantes o necesidades de inventario.
5. Detecta incidencias que puedan requerir una tarea.
6. Resume el cierre en lenguaje ejecutivo.
7. Indica el nivel de prioridad general.
8. No inventes información que no esté en el cierre.

Devuelve únicamente JSON válido con esta estructura:

{
  "prioridad": "normal",
  "resumen_ejecutivo": "",
  "pendientes_importantes": [],
  "incidencias_importantes": [],
  "oportunidades_detectadas": [],
  "productos_a_revisar": [],
  "acciones_sugeridas": [],
  "requiere_atencion": false
}

PRIORIDAD:

baja = sin asuntos importantes
normal = seguimiento rutinario
alta = requiere atención próxima
urgente = requiere atención inmediata
                    `.trim(),
                  },
                ],
              },
            ],

            text: {
              format: {
                type:
                  "json_schema",

                name:
                  "analisis_cierre_turno",

                strict:
                  true,

                schema: {
                  type:
                    "object",

                  additionalProperties:
                    false,

                  properties: {
                    prioridad: {
                      type:
                        "string",

                      enum: [
                        "baja",
                        "normal",
                        "alta",
                        "urgente",
                      ],
                    },

                    resumen_ejecutivo: {
                      type:
                        "string",
                    },

                    pendientes_importantes: {
                      type:
                        "array",

                      items: {
                        type:
                          "string",
                      },
                    },

                    incidencias_importantes: {
                      type:
                        "array",

                      items: {
                        type:
                          "string",
                      },
                    },

                    oportunidades_detectadas: {
                      type:
                        "array",

                      items: {
                        type:
                          "string",
                      },
                    },

                    productos_a_revisar: {
                      type:
                        "array",

                      items: {
                        type:
                          "string",
                      },
                    },

                    acciones_sugeridas: {
                      type:
                        "array",

                      items: {
                        type:
                          "string",
                      },
                    },

                    requiere_atencion: {
                      type:
                        "boolean",
                    },
                  },

                  required: [
                    "prioridad",
                    "resumen_ejecutivo",
                    "pendientes_importantes",
                    "incidencias_importantes",
                    "oportunidades_detectadas",
                    "productos_a_revisar",
                    "acciones_sugeridas",
                    "requiere_atencion",
                  ],
                },
              },
            },
          }),
        }
      );


    const respuestaJson =
      await respuestaIA.json();


    if (!respuestaIA.ok) {
      console.error(
        "Error OpenAI:",
        respuestaJson
      );

      throw new Error(
        respuestaJson?.error
          ?.message ||
          "No fue posible analizar el cierre."
      );
    }


    const textoResultado =
      respuestaJson
        ?.output?.[0]
        ?.content?.[0]
        ?.text;


    if (!textoResultado) {
      throw new Error(
        "La IA no devolvió análisis del cierre."
      );
    }


    const analisis =
      JSON.parse(
        textoResultado
      );


    const {
      error: errorGuardarAnalisis,
    } = await supabase
      .from(
        "cierres_turno_analisis"
      )
      .insert({
        cierre_id:
          cierreId,

        prioridad:
          analisis.prioridad,

        resumen_ejecutivo:
          analisis
            .resumen_ejecutivo,

        pendientes_importantes:
          analisis
            .pendientes_importantes,

        incidencias_importantes:
          analisis
            .incidencias_importantes,

        oportunidades_detectadas:
          analisis
            .oportunidades_detectadas,

        productos_a_revisar:
          analisis
            .productos_a_revisar,

        acciones_sugeridas:
          analisis
            .acciones_sugeridas,

        requiere_atencion:
          analisis
            .requiere_atencion,
      });


    if (errorGuardarAnalisis) {
      console.error(
        "Error al guardar análisis:",
        errorGuardarAnalisis
      );

      throw errorGuardarAnalisis;
    }


    return new Response(
      JSON.stringify({
        ok: true,
        analisis,
      }),
      {
        headers: {
          ...corsHeaders,
          "Content-Type":
            "application/json",
        },
      }
    );
  } catch (error) {
    console.error(
      "Error analizar-cierre-turno:",
      error
    );


    return new Response(
      JSON.stringify({
        ok: false,

        error:
          error instanceof Error
            ? error.message
            : "Error desconocido.",
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
});