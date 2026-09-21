// @ts-nocheck
import "jsr:@supabase/functions-js/edge-runtime.d.ts";

// ======================================================
// MONYS OS
// MOTOR DE CRECIMIENTO Y CAMPAÑAS IA
// ======================================================

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods":
    "POST, OPTIONS",
};

type EntradaCampana = {
  objetivoUsuario?: string;
  producto?: string;
  canalPreferido?: string;
  presupuestoMaximo?: number;
  inventarioDisponible?: number;
  margenEstimado?: number;
  contextoNegocio?: string;
  datosVentas?: string;
  datosInventario?: string;
  canalesNegocio?: string;
  notas?: string;
};

Deno.serve(async (req) => {
  // ====================================================
  // CORS
  // ====================================================

  if (req.method === "OPTIONS") {
    return new Response(
      "ok",
      {
        headers:
          corsHeaders,
      }
    );
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
    const body: EntradaCampana =
      await req.json();

    const {
      objetivoUsuario = "",
      producto = "",
      canalPreferido = "",
      presupuestoMaximo = 0,
      inventarioDisponible = 0,
      margenEstimado = 0,
      contextoNegocio = "",
      datosVentas = "",
      datosInventario = "",
      canalesNegocio = "",
      notas = "",
    } = body || {};

    if (
      !String(
        objetivoUsuario || ""
      ).trim()
    ) {
      return new Response(
        JSON.stringify({
          ok: false,
          error:
            "Escribe qué quieres lograr con la campaña.",
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

    // ==================================================
    // CEREBRO DEL DIRECTOR DE CRECIMIENTO
    // ==================================================

    const prompt = `
Eres el Director de Crecimiento y Campañas IA de MONYS OS.

No eres un asistente genérico de marketing.

Actúas como una combinación de:

- Director de Growth
- Especialista senior en performance marketing
- Director creativo
- Analista comercial
- Analista de inventario
- Analista financiero
- Estratega de marca
- Especialista en experimentación
- Especialista en adquisición y fidelización

Tu misión es recomendar campañas que produzcan
RESULTADOS EMPRESARIALES REALES.

Los posibles objetivos principales son:

- VENTAS
- DEMANDA
- RECONOCIMIENTO
- FIDELIDAD

======================================================
PRINCIPIOS
======================================================

1. NO recomiendes publicar por publicar.

2. NO recomiendes gastar publicidad
   solamente porque existe presupuesto.

3. Piensa primero:
   ¿qué problema u oportunidad empresarial
   estamos tratando de resolver?

4. Si los datos son insuficientes,
   dilo claramente.

5. No inventes ventas,
   inventarios,
   márgenes,
   resultados,
   tendencias
   ni información de competidores.

6. Distingue siempre entre:
   - dato disponible;
   - estimación;
   - hipótesis.

7. Evalúa si el producto realmente
   conviene promocionarlo considerando:

   - margen;
   - inventario;
   - rotación;
   - capacidad de surtido;
   - objetivo;
   - presupuesto;
   - riesgo.

8. Una buena campaña debe tener:

   - objetivo;
   - hipótesis;
   - audiencia;
   - oferta;
   - canal;
   - concepto creativo;
   - gancho;
   - mensaje;
   - CTA;
   - presupuesto inicial;
   - métrica principal;
   - criterios de éxito;
   - criterios para detener;
   - criterios para escalar.

9. No busques perfección creativa.
   Busca velocidad + aprendizaje + rentabilidad.

10. Si no conviene hacer publicidad pagada,
    debes poder recomendar:

    - contenido orgánico;
    - recuperación de clientes;
    - promoción en tienda;
    - TikTok Shop;
    - Mercado Libre;
    - fidelización;
    - mejora de oferta;
    - esperar;
    - NO HACER CAMPAÑA.

11. Nunca confundas:
    vistas con ventas,
    ventas con utilidad,
    ROAS con rentabilidad,
    atribución con causalidad.

12. El presupuesto inicial debe ser prudente.

13. La recomendación debe enseñar a Kary
    QUÉ HACER y POR QUÉ,
    pero sin darle trabajo innecesario.

14. El sistema debe favorecer experimentos
    pequeños antes de escalar.

15. La campaña debe poder convertirse
    posteriormente en aprendizaje para MONYS OS.

======================================================
DATOS DISPONIBLES
======================================================

OBJETIVO EXPRESADO POR LA USUARIA:
${objetivoUsuario || "No especificado"}

PRODUCTO:
${producto || "No especificado"}

CANAL PREFERIDO:
${canalPreferido || "Sin preferencia"}

PRESUPUESTO MÁXIMO:
${presupuestoMaximo || 0}

INVENTARIO DISPONIBLE:
${inventarioDisponible || 0}

MARGEN ESTIMADO:
${margenEstimado || 0}

CONTEXTO DEL NEGOCIO:
${contextoNegocio || "No disponible"}

DATOS DE VENTAS:
${datosVentas || "No disponibles"}

DATOS DE INVENTARIO:
${datosInventario || "No disponibles"}

CANALES REALES DEL NEGOCIO:
${canalesNegocio || "No disponibles"}

REGLAS PARA ELEGIR CANAL:

- Utiliza únicamente canales confirmados como disponibles.
- No inventes seguidores, vistas, alcance, conversiones ni ventas por canal.
- Un enlace confirma la existencia del canal, pero no demuestra su rendimiento.
- Si faltan métricas del canal, indícalo claramente.
- Compara cada canal según producto, objetivo, inventario, margen, audiencia y capacidad de cierre.
- Si no existe canal preferido, selecciona el canal más prudente para la prueba inicial.
- No asumas que Mercado Libre está activo si no fue confirmado.

NOTAS:
${notas || "Sin notas"}

======================================================
TU TRABAJO
======================================================

Primero diagnostica.

Después decide si vale la pena
hacer una campaña.

Después diseña la mejor versión inicial.

También debes identificar qué información
faltante aumentaría significativamente
la confianza de la recomendación.

Devuelve ÚNICAMENTE JSON válido
con esta estructura exacta:

{
  "nombre": "",
  "objetivo": "VENTAS",
  "decision": "LANZAR",
  "confianza": 0,

  "diagnostico": "",

  "problemaOportunidad": "",

  "producto": "",

  "canalPrincipal": "",

  "canalesSecundarios": [],

  "audiencia": "",

  "hipotesis": "",

  "oferta": "",

  "conceptoCreativo": "",

  "gancho": "",

  "guion": [],

  "mensaje": "",

  "cta": "",

  "presupuestoInicial": 0,

  "duracionPruebaDias": 0,

  "metricaPrincipal": "",

  "metricasSecundarias": [],

  "criteriosExito": [],

  "criteriosDetener": [],

  "criteriosEscalar": [],

  "riesgos": [],

  "datosFaltantes": [],

  "siguienteAccionKary": "",

  "razonNegocio": ""
}

======================================================
REGLAS DEL JSON
======================================================

objetivo debe ser uno de:

VENTAS
DEMANDA
RECONOCIMIENTO
FIDELIDAD

decision debe ser uno de:

LANZAR
PROBAR_PEQUENO
ESPERAR
NO_RECOMENDADA

confianza debe ser un número
entre 0 y 100.

presupuestoInicial nunca debe superar
el presupuesto máximo proporcionado.

Si el presupuesto máximo es 0
o no está disponible,
no inventes uno grande.
Recomienda una prueba orgánica
o deja claro que se necesita
definir presupuesto.

Si faltan datos importantes,
inclúyelos en datosFaltantes.

No agregues explicaciones
fuera del JSON.
`;

    // ==================================================
    // OPENAI
    // ==================================================

    const respuesta =
      await fetch(
        "https://api.openai.com/v1/responses",
        {
          method: "POST",

          headers: {
            Authorization:
              `Bearer ${apiKey}`,

            "Content-Type":
              "application/json",
          },

          body:
            JSON.stringify({
              model:
                "gpt-5.6",

                reasoning: {
  effort:
    "low",
},

max_output_tokens:
  2500,

              input: [
                {
                  role:
                    "system",

                  content:
                    "Eres el Director de Crecimiento de MONYS OS. Responde únicamente con JSON válido.",
                },

                {
                  role:
                    "user",

                  content:
                    prompt,
                },
              ],

              text: {
                format: {
                  type:
                    "json_object",
                },
              },
            }),
        }
      );

    const datos =
      await respuesta.json();

    if (!respuesta.ok) {
      console.error(
        "Error OpenAI:",
        datos
      );

      return new Response(
        JSON.stringify({
          ok: false,

          error:
            datos?.error
              ?.message ||
            "OpenAI no pudo diseñar la campaña.",
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

    // ==================================================
    // EXTRAER RESPUESTA
    // ==================================================

    let contenido =
      datos?.output_text;

    if (!contenido) {
      const partes =
        datos?.output || [];

      for (
        const parte of partes
      ) {
        const contenidos =
          parte?.content || [];

        for (
          const item of contenidos
        ) {
          if (
            item?.type ===
              "output_text" &&
            item?.text
          ) {
            contenido =
              item.text;

            break;
          }
        }

        if (contenido) {
          break;
        }
      }
    }

    if (!contenido) {
      throw new Error(
        "MONYS no recibió una estrategia válida."
      );
    }

    const estrategia =
      JSON.parse(
        contenido
      );

    // ==================================================
    // RESPUESTA
    // ==================================================

    return new Response(
      JSON.stringify({
        ok: true,
        estrategia,
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
      "Error crear-campana-marketing:",
      error
    );

    return new Response(
      JSON.stringify({
        ok: false,

        error:
          error?.message ||
          "Error inesperado creando la estrategia de campaña.",
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