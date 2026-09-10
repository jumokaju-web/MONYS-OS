// @ts-nocheck
import "jsr:@supabase/functions-js/edge-runtime.d.ts";

// ======================================================
// CORS
// ======================================================

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods":
    "POST, OPTIONS",
};

// ======================================================
// TIPOS
// ======================================================

type EntradaRevision = {
  tipoObjetivo?: string;
  producto?: string;
  texto?: string;
  gancho?: string;
  cta?: string;
  notas?: string;
};

// ======================================================
// EDGE FUNCTION
// ======================================================

Deno.serve(async (req) => {
  // ----------------------------------------------------
  // PRE-FLIGHT DEL NAVEGADOR
  // ----------------------------------------------------

  if (req.method === "OPTIONS") {
    return new Response("ok", {
      headers: corsHeaders,
    });
  }

  // ----------------------------------------------------
  // SOLO POST
  // ----------------------------------------------------

  if (req.method !== "POST") {
    return new Response(
      JSON.stringify({
        ok: false,
        error: "Método no permitido",
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
    // --------------------------------------------------
    // LEER INFORMACIÓN
    // --------------------------------------------------

    const body: EntradaRevision =
      await req.json();

    const {
      tipoObjetivo = "",
      producto = "",
      texto = "",
      gancho = "",
      cta = "",
      notas = "",
    } = body || {};

    const contenidoBase = [
      tipoObjetivo,
      producto,
      texto,
      gancho,
      cta,
      notas,
    ]
      .filter(Boolean)
      .join("\n");

    if (!contenidoBase.trim()) {
      return new Response(
        JSON.stringify({
          ok: false,
          error:
            "No hay contenido suficiente para revisar.",
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

    // --------------------------------------------------
    // OPENAI
    // --------------------------------------------------

    const apiKey =
      Deno.env.get("OPENAI_API_KEY");

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

    // --------------------------------------------------
    // CEREBRO DE MARKETING
    // --------------------------------------------------

    const prompt = `
Eres el Director de Marketing de MONYS OS.

Tu misión NO es buscar perfección.

Tu misión es ayudar a la responsable de marketing
a trabajar menos, publicar más rápido
y aumentar la probabilidad de producir:

- VENTAS
- RECONOCIMIENTO
- FIDELIDAD
- DEMANDA

Piensa como una agencia profesional de marketing
enfocada en resultados empresariales reales.

REGLAS:

1. Si el contenido está suficientemente bien,
   recomienda PUBLICAR.

2. No inventes trabajo adicional.

3. No busques perfección.

4. Si requiere cambios,
   da MÁXIMO 3 cambios.

5. Cada cambio debe ser:
   - concreto;
   - rápido;
   - de alto impacto.

6. No pidas rehacer todo salvo que
   realmente sea necesario.

7. Evalúa principalmente:

   - gancho;
   - claridad;
   - beneficio;
   - deseo;
   - confianza;
   - intención de compra;
   - CTA;
   - coherencia con la marca.

8. Si puedes mejorar algo con una frase,
   entrega directamente la frase.

9. Queremos RESULTADOS,
   no contenido perfecto.

10. Si ya está bien:
    dile claramente que publique
    y que no pierda más tiempo modificándolo.

CONTENIDO A REVISAR

OBJETIVO:
${tipoObjetivo || "No definido"}

PRODUCTO:
${producto || "No especificado"}

GANCHO:
${gancho || "No especificado"}

CONTENIDO:
${texto || "No especificado"}

CTA:
${cta || "No especificado"}

NOTAS:
${notas || "Sin notas"}

Devuelve SOLO JSON válido con esta estructura:

{
  "decision": "PUBLICAR" | "MEJORAR",
  "objetivoDetectado": "VENTAS" | "RECONOCIMIENTO" | "FIDELIDAD" | "DEMANDA",
  "puntaje": 0,
  "resumen": "",
  "cambios": [],
  "ganchoSugerido": "",
  "ctaSugerido": "",
  "razonNegocio": ""
}

REGLAS DE RESPUESTA:

- puntaje: número de 0 a 100.

- Si decision = PUBLICAR:
  cambios debe ser [].

- Si decision = MEJORAR:
  cambios debe contener máximo 3 elementos.

- resumen debe ser breve.

- No agregues tareas innecesarias.
`;

    // --------------------------------------------------
    // LLAMAR OPENAI
    // --------------------------------------------------

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
                  "Responde únicamente con JSON válido.",
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

    // --------------------------------------------------
    // ERROR OPENAI
    // --------------------------------------------------

    if (!respuesta.ok) {
      console.error(
        "Error OpenAI:",
        datos
      );

      return new Response(
        JSON.stringify({
          ok: false,

          error:
            datos?.error?.message ||
            "OpenAI no pudo revisar el contenido.",
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

    // --------------------------------------------------
    // LEER RESPUESTA
    // --------------------------------------------------

    const contenido =
      datos?.choices?.[0]
        ?.message?.content;

    if (!contenido) {
      throw new Error(
        "MONYS no recibió una evaluación válida."
      );
    }

    const evaluacion =
      JSON.parse(contenido);

    // --------------------------------------------------
    // RESPUESTA CORRECTA
    // --------------------------------------------------

    return new Response(
      JSON.stringify({
        ok: true,
        evaluacion,
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
      "Error revisar-marketing:",
      error
    );

    return new Response(
      JSON.stringify({
        ok: false,

        error:
          error?.message ||
          "Error inesperado al revisar marketing.",
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