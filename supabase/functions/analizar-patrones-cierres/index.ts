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
    const body =
      await req.json();

    const branchId =
      body?.branchId || null;

    const dias =
      Number(
        body?.dias || 7
      );


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


    const fechaDesde =
      new Date();

    fechaDesde.setDate(
      fechaDesde.getDate() -
        dias
    );


    let consultaCierres =
      supabase
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
        .gte(
          "created_at",
          fechaDesde
            .toISOString()
        )
        .order(
          "created_at",
          {
            ascending: false,
          }
        );


    if (branchId) {
      consultaCierres =
        consultaCierres.eq(
          "branch_id",
          branchId
        );
    }


    const {
      data: cierres,
      error: errorCierres,
    } = await consultaCierres;


    if (errorCierres) {
      throw errorCierres;
    }


    const cierresLista =
      Array.isArray(cierres)
        ? cierres
        : [];


    if (
      cierresLista.length === 0
    ) {
      const patronesVacios = {
        periodo_dias:
          dias,

        total_cierres:
          0,

        prioridad_general:
          "baja",

        resumen_ejecutivo:
          "No hay cierres suficientes para detectar patrones en el periodo seleccionado.",

        patrones_repetidos:
          [],

        productos_recurrentes:
          [],

        incidencias_recurrentes:
          [],

        objeciones_recurrentes:
          [],

        oportunidades_recurrentes:
          [],

        acciones_prioritarias:
          [],

        alertas:
          [],

        confianza:
          100,
      };


      const {
        error:
          errorGuardarVacio,
      } = await supabase
        .from(
          "cierres_patrones_analisis"
        )
        .insert({
          branch_id:
            branchId,

          periodo_dias:
            patronesVacios
              .periodo_dias,

          total_cierres:
            patronesVacios
              .total_cierres,

          prioridad_general:
            patronesVacios
              .prioridad_general,

          resumen_ejecutivo:
            patronesVacios
              .resumen_ejecutivo,

          patrones_repetidos:
            patronesVacios
              .patrones_repetidos,

          productos_recurrentes:
            patronesVacios
              .productos_recurrentes,

          incidencias_recurrentes:
            patronesVacios
              .incidencias_recurrentes,

          objeciones_recurrentes:
            patronesVacios
              .objeciones_recurrentes,

          oportunidades_recurrentes:
            patronesVacios
              .oportunidades_recurrentes,

          acciones_prioritarias:
            patronesVacios
              .acciones_prioritarias,

          alertas:
            patronesVacios
              .alertas,

          confianza:
            patronesVacios
              .confianza,
        });


      if (errorGuardarVacio) {
        console.error(
          "Error al guardar análisis vacío:",
          errorGuardarVacio
        );

        throw errorGuardarVacio;
      }


      return new Response(
        JSON.stringify({
          ok: true,
          patrones:
            patronesVacios,
        }),
        {
          headers: {
            ...corsHeaders,
            "Content-Type":
              "application/json",
          },
        }
      );
    }


    const cierreIds =
      cierresLista.map(
        (cierre) =>
          cierre.id
      );


    const {
      data: analisisGuardados,
      error:
        errorAnalisisGuardados,
    } = await supabase
      .from(
        "cierres_turno_analisis"
      )
      .select(`
        id,
        cierre_id,
        prioridad,
        resumen_ejecutivo,
        pendientes_importantes,
        incidencias_importantes,
        oportunidades_detectadas,
        productos_a_revisar,
        acciones_sugeridas,
        requiere_atencion,
        created_at
      `)
      .in(
        "cierre_id",
        cierreIds
      );


    if (
      errorAnalisisGuardados
    ) {
      throw errorAnalisisGuardados;
    }


    const mapaAnalisis =
      new Map();


    for (
      const analisis
      of analisisGuardados || []
    ) {
      mapaAnalisis.set(
        analisis.cierre_id,
        analisis
      );
    }


    const cierresPreparados =
      cierresLista.map(
        (cierre) => {
          const analisis =
            mapaAnalisis.get(
              cierre.id
            ) || null;


          return {
            cierre_id:
              cierre.id,

            fecha:
              cierre.fecha,

            responsable:
              cierre.responsable,

            turno:
              cierre.turno,

            pendientes:
              cierre.pendientes,

            incidencias:
              cierre.incidencias,

            productos_solicitados:
              cierre
                .productos_solicitados,

            objeciones_clientes:
              cierre
                .objeciones_clientes,

            aprendizajes:
              cierre.aprendizajes,

            observaciones:
              cierre.observaciones,

            analisis:
              analisis
                ? {
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
                  }
                : null,
          };
        }
      );


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
Eres MONYS OS, un motor de inteligencia operativa empresarial.

Analiza múltiples cierres de turno para detectar PATRONES, REPETICIONES y SEÑALES ACUMULADAS.

PERIODO ANALIZADO:
Últimos ${dias} días.

TOTAL DE CIERRES:
${cierresPreparados.length}

DATOS:
${JSON.stringify(
  cierresPreparados,
  null,
  2
)}

OBJETIVO:

1. Detecta pendientes que se repiten.
2. Detecta productos solicitados repetidamente.
3. Detecta incidencias recurrentes.
4. Detecta objeciones de clientes recurrentes.
5. Detecta oportunidades comerciales repetidas.
6. Detecta acciones que aparecen varias veces.
7. Distingue una mención aislada de un patrón real.
8. Identifica qué necesita atención de la dueña.
9. Prioriza por impacto, frecuencia y urgencia.
10. No inventes frecuencias. Solo menciona cantidades cuando puedan deducirse de los cierres enviados.
11. Si todavía hay pocos cierres, dilo claramente.
12. Convierte patrones útiles en acciones concretas.

Devuelve únicamente JSON válido con esta estructura:

{
  "periodo_dias": 7,
  "total_cierres": 0,
  "prioridad_general": "normal",
  "resumen_ejecutivo": "",
  "patrones_repetidos": [],
  "productos_recurrentes": [],
  "incidencias_recurrentes": [],
  "objeciones_recurrentes": [],
  "oportunidades_recurrentes": [],
  "acciones_prioritarias": [],
  "alertas": [],
  "confianza": 0
}

PRIORIDAD GENERAL:

baja = no hay señales relevantes
normal = seguimiento rutinario
alta = existen patrones importantes
urgente = hay un patrón que requiere actuación inmediata

CONFIANZA:

0 a 100.
Reduce la confianza cuando haya pocos cierres o datos incompletos.
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
                  "patrones_cierres",

                strict:
                  true,

                schema: {
                  type:
                    "object",

                  additionalProperties:
                    false,

                  properties: {
                    periodo_dias: {
                      type:
                        "number",
                    },

                    total_cierres: {
                      type:
                        "number",
                    },

                    prioridad_general: {
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

                    patrones_repetidos: {
                      type:
                        "array",

                      items: {
                        type:
                          "string",
                      },
                    },

                    productos_recurrentes: {
                      type:
                        "array",

                      items: {
                        type:
                          "string",
                      },
                    },

                    incidencias_recurrentes: {
                      type:
                        "array",

                      items: {
                        type:
                          "string",
                      },
                    },

                    objeciones_recurrentes: {
                      type:
                        "array",

                      items: {
                        type:
                          "string",
                      },
                    },

                    oportunidades_recurrentes: {
                      type:
                        "array",

                      items: {
                        type:
                          "string",
                      },
                    },

                    acciones_prioritarias: {
                      type:
                        "array",

                      items: {
                        type:
                          "string",
                      },
                    },

                    alertas: {
                      type:
                        "array",

                      items: {
                        type:
                          "string",
                      },
                    },

                    confianza: {
                      type:
                        "number",
                    },
                  },

                  required: [
                    "periodo_dias",
                    "total_cierres",
                    "prioridad_general",
                    "resumen_ejecutivo",
                    "patrones_repetidos",
                    "productos_recurrentes",
                    "incidencias_recurrentes",
                    "objeciones_recurrentes",
                    "oportunidades_recurrentes",
                    "acciones_prioritarias",
                    "alertas",
                    "confianza",
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
          "No fue posible analizar los patrones de cierres."
      );
    }


    const textoResultado =
      respuestaJson
        ?.output?.[0]
        ?.content?.[0]
        ?.text;


    if (!textoResultado) {
      throw new Error(
        "La IA no devolvió análisis de patrones."
      );
    }


    const patrones =
      JSON.parse(
        textoResultado
      );


    const {
      error:
        errorGuardarPatrones,
    } = await supabase
      .from(
        "cierres_patrones_analisis"
      )
      .insert({
        branch_id:
          branchId,

        periodo_dias:
          patrones
            .periodo_dias,

        total_cierres:
          patrones
            .total_cierres,

        prioridad_general:
          patrones
            .prioridad_general,

        resumen_ejecutivo:
          patrones
            .resumen_ejecutivo,

        patrones_repetidos:
          patrones
            .patrones_repetidos,

        productos_recurrentes:
          patrones
            .productos_recurrentes,

        incidencias_recurrentes:
          patrones
            .incidencias_recurrentes,

        objeciones_recurrentes:
          patrones
            .objeciones_recurrentes,

        oportunidades_recurrentes:
          patrones
            .oportunidades_recurrentes,

        acciones_prioritarias:
          patrones
            .acciones_prioritarias,

        alertas:
          patrones
            .alertas,

        confianza:
          Math.round(
            Number(
              patrones.confianza ||
                0
            )
          ),
      });


    if (errorGuardarPatrones) {
      console.error(
        "Error al guardar patrones:",
        errorGuardarPatrones
      );

      throw errorGuardarPatrones;
    }


    return new Response(
      JSON.stringify({
        ok: true,
        patrones,
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
      "Error analizar-patrones-cierres:",
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