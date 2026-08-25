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


  let tareaId = null;
  let supabase = null;


  try {
    const body =
      await req.json();

    tareaId =
      body?.tareaId || null;


    if (!tareaId) {
      throw new Error(
        "Falta tareaId."
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


    supabase =
      createClient(
        supabaseUrl,
        serviceRoleKey
      );


    const {
      data: tarea,
      error: errorTarea,
    } = await supabase
      .from(
        "tareas_operativas"
      )
      .select(`
        id,
        titulo,
        descripcion,
        area,
        responsable,
        instrucciones,
        criterio_exito,
        estado
      `)
      .eq(
        "id",
        tareaId
      )
      .single();


    if (errorTarea) {
      throw errorTarea;
    }


    const {
      data: evidencias,
      error: errorEvidencias,
    } = await supabase
      .from(
        "tarea_evidencias"
      )
      .select(`
        id,
        tipo,
        archivo_url,
        descripcion,
        created_at
      `)
      .eq(
        "tarea_id",
        tareaId
      )
      .order(
        "created_at",
        {
          ascending: true,
        }
      );


    if (errorEvidencias) {
      throw errorEvidencias;
    }


    const fotosIniciales =
      (evidencias || []).filter(
        (evidencia) =>
          evidencia.tipo ===
            "inicio" &&
          evidencia.archivo_url
      );


    const fotosFinales =
      (evidencias || []).filter(
        (evidencia) =>
          evidencia.tipo ===
            "final" &&
          evidencia.archivo_url
      );


    if (
      fotosIniciales.length === 0
    ) {
      throw new Error(
        "La tarea no tiene foto inicial."
      );
    }


    if (
      fotosFinales.length === 0
    ) {
      throw new Error(
        "La tarea no tiene foto final."
      );
    }


    const contenido = [
      {
        type: "input_text",
        text: `
Eres MONYS OS, supervisor operativo de una empresa.

Evalúa el cumplimiento REAL de una tarea usando las fotografías de ANTES y DESPUÉS.

TAREA:
${tarea.titulo || ""}

ÁREA:
${tarea.area || ""}

INSTRUCCIONES:
${tarea.instrucciones || "Sin instrucciones adicionales"}

CRITERIO DE ÉXITO:
${tarea.criterio_exito || "Cumplir correctamente la tarea indicada"}

REGLAS:

1. No inventes cosas que no sean visibles.
2. Compara antes contra después.
3. Una fotografía bonita NO significa que la tarea esté bien hecha.
4. Evalúa solamente lo que pueda comprobarse.
5. Si las imágenes no permiten comprobar la tarea, usa revision_humana.
6. Sé estricto pero razonable.
7. La puntuación debe ser de 0 a 100.

Devuelve únicamente JSON válido con esta estructura:

{
  "puntuacion_total": 0,
  "limpieza": 0,
  "orden": 0,
  "cumplimiento": 0,
  "presentacion": 0,
  "confianza_ia": 0,
  "resultado": "aprobada",
  "resumen": "",
  "problemas_detectados": [],
  "recomendaciones": []
}

RESULTADO:

aprobada = 90 a 100
aceptable = 75 a 89
corregir = 0 a 74
revision_humana = evidencia insuficiente o ambigua
        `.trim(),
      },
    ];


    contenido.push({
      type: "input_text",
      text:
        "FOTOGRAFÍAS INICIALES / ANTES:",
    });


    for (
      const evidencia
      of fotosIniciales
    ) {
      contenido.push({
        type: "input_image",
        image_url:
          evidencia.archivo_url,
      });
    }


    contenido.push({
      type: "input_text",
      text:
        "FOTOGRAFÍAS FINALES / DESPUÉS:",
    });


    for (
      const evidencia
      of fotosFinales
    ) {
      contenido.push({
        type: "input_image",
        image_url:
          evidencia.archivo_url,
      });
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
                content:
                  contenido,
              },
            ],

            text: {
              format: {
                type:
                  "json_schema",

                name:
                  "evaluacion_tarea",

                strict:
                  true,

                schema: {
                  type:
                    "object",

                  additionalProperties:
                    false,

                  properties: {
                    puntuacion_total: {
                      type:
                        "number",
                    },

                    limpieza: {
                      type:
                        "number",
                    },

                    orden: {
                      type:
                        "number",
                    },

                    cumplimiento: {
                      type:
                        "number",
                    },

                    presentacion: {
                      type:
                        "number",
                    },

                    confianza_ia: {
                      type:
                        "number",
                    },

                    resultado: {
                      type:
                        "string",

                      enum: [
                        "aprobada",
                        "aceptable",
                        "corregir",
                        "revision_humana",
                      ],
                    },

                    resumen: {
                      type:
                        "string",
                    },

                    problemas_detectados: {
                      type:
                        "array",

                      items: {
                        type:
                          "string",
                      },
                    },

                    recomendaciones: {
                      type:
                        "array",

                      items: {
                        type:
                          "string",
                      },
                    },
                  },

                  required: [
                    "puntuacion_total",
                    "limpieza",
                    "orden",
                    "cumplimiento",
                    "presentacion",
                    "confianza_ia",
                    "resultado",
                    "resumen",
                    "problemas_detectados",
                    "recomendaciones",
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
          "No fue posible evaluar la tarea."
      );
    }


    const textoResultado =
      respuestaJson
        ?.output?.[0]
        ?.content?.[0]
        ?.text;


    if (!textoResultado) {
      throw new Error(
        "La IA no devolvió una evaluación."
      );
    }


    const evaluacion =
      JSON.parse(
        textoResultado
      );


    const {
      error:
        errorGuardarEvaluacion,
    } = await supabase
      .from(
        "tarea_evaluaciones"
      )
      .insert({
        tarea_id:
          tareaId,

        puntuacion_total:
          evaluacion
            .puntuacion_total,

        limpieza:
          evaluacion.limpieza,

        orden:
          evaluacion.orden,

        cumplimiento:
          evaluacion
            .cumplimiento,

        presentacion:
          evaluacion
            .presentacion,

        confianza_ia:
          evaluacion
            .confianza_ia,

        resultado:
          evaluacion.resultado,

        resumen:
          evaluacion.resumen,

        problemas_detectados:
          evaluacion
            .problemas_detectados,

        recomendaciones:
          evaluacion
            .recomendaciones,
      });


    if (
      errorGuardarEvaluacion
    ) {
      throw errorGuardarEvaluacion;
    }


    let evaluacionEstado =
      "revision_humana";

    let requiereRevision =
      true;


    if (
      evaluacion.resultado ===
        "aprobada" ||
      evaluacion.resultado ===
        "aceptable"
    ) {
      evaluacionEstado =
        "aprobada";

      requiereRevision =
        false;
    }


    if (
      evaluacion.resultado ===
        "corregir"
    ) {
      evaluacionEstado =
        "corregir";

      requiereRevision =
        true;
    }


    const {
      error:
        errorActualizarTarea,
    } = await supabase
      .from(
        "tareas_operativas"
      )
      .update({
        calificacion_final:
          evaluacion
            .puntuacion_total,

        evaluacion_estado:
          evaluacionEstado,

        evaluacion_resumen:
          evaluacion.resumen,

        requiere_revision:
          requiereRevision,

        updated_at:
          new Date()
            .toISOString(),
      })
      .eq(
        "id",
        tareaId
      );


    if (
      errorActualizarTarea
    ) {
      throw errorActualizarTarea;
    }


    return new Response(
      JSON.stringify({
        ok: true,
        evaluacion,
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
      "Error evaluar-tarea:",
      error
    );


    const mensajeError =
      error instanceof Error
        ? error.message
        : "Error desconocido.";


    /*
     * RESCATE AUTOMÁTICO
     *
     * Si la IA, OpenAI, las fotografías
     * o cualquier otra parte del proceso falla,
     * la tarea NO debe quedarse eternamente
     * en ANALIZANDO.
     */
    if (
      supabase &&
      tareaId
    ) {
      try {
        const {
          error:
            errorRescatarTarea,
        } = await supabase
          .from(
            "tareas_operativas"
          )
          .update({
            calificacion_final:
              null,

            evaluacion_estado:
              "revision_humana",

            evaluacion_resumen:
              `La evaluación automática no pudo completarse. Motivo: ${mensajeError}`,

            requiere_revision:
              true,

            updated_at:
              new Date()
                .toISOString(),
          })
          .eq(
            "id",
            tareaId
          );


        if (
          errorRescatarTarea
        ) {
          console.error(
            "Error al rescatar tarea:",
            errorRescatarTarea
          );
        }
      } catch (
        errorRescate
      ) {
        console.error(
          "Error inesperado al rescatar tarea:",
          errorRescate
        );
      }
    }


    return new Response(
      JSON.stringify({
        ok: false,
        error:
          mensajeError,
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