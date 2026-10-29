// @ts-nocheck



import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.110.7";



const corsHeaders = {

  "Access-Control-Allow-Origin": "*",

  "Access-Control-Allow-Headers":

    "authorization, x-client-info, apikey, content-type",

  "Access-Control-Allow-Methods":

    "POST, OPTIONS",

};



type EntradaKitMarketing = {

  negocio?: Record<string, unknown>;

  producto?: Record<string, unknown>;

  estrategia?: Record<string, unknown>;

  campana?: Record<string, unknown>;

  canales?: string[];

  resultadosAnteriores?: Record<string, unknown>;

  datosReales?: Record<string, unknown>;

};



function responder(

  contenido: Record<string, unknown>,

  status = 200

) {

  return new Response(

    JSON.stringify(contenido),

    {

      status,

      headers: {

        ...corsHeaders,

        "Content-Type": "application/json",

      },

    }

  );

}



function texto(valor: unknown) {

  return String(valor || "").trim();

}



function numeroValido(valor: unknown) {

  if (

    valor === null ||

    valor === undefined ||

    valor === ""

  ) {

    return false;

  }



  return Number.isFinite(Number(valor));

}



Deno.serve(async (req) => {

  if (req.method === "OPTIONS") {

    return new Response("ok", {

      headers: corsHeaders,

    });

  }



  if (req.method !== "POST") {

    return responder(

      {

        ok: false,

        error: "Método no permitido.",

      },

      405

    );

  }



  try {
    // Verify identity with Auth, then authorize using the current database
    // profile through the caller's RLS scope. A signed anon JWT is not a user.
    const authorization = req.headers.get("Authorization") || "";
    const token = /^Bearer\s+(\S+)$/i.exec(authorization)?.[1];
    const rechazar = (status, error) => new Response(
      JSON.stringify({ ok: false, error }),
      { status, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
    if (!token) return rechazar(401, "Inicia sesión para utilizar Marketing IA.");

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
    if (!supabaseUrl || !anonKey) {
      return rechazar(503, "No se pudo verificar el acceso. Intenta más tarde.");
    }
    const clienteUsuario = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authorization } },
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: identidad, error: errorIdentidad } = await clienteUsuario.auth.getUser(token);
    if (errorIdentidad || !identidad?.user?.id || identidad.user.is_anonymous === true) {
      return rechazar(401, "La sesión no es válida. Inicia sesión de nuevo.");
    }
    const { data: perfil, error: errorPerfil } = await clienteUsuario
      .from("usuarios")
      .select("auth_user_id, organization_id, role, active")
      .eq("auth_user_id", identidad.user.id)
      .maybeSingle();
    if (errorPerfil) {
      return rechazar(503, "No se pudo verificar tu autorización. Intenta más tarde.");
    }
    if (!perfil || perfil.auth_user_id !== identidad.user.id || perfil.active !== true
      || !perfil.organization_id || !["owner", "admin", "marketing"].includes(perfil.role)) {
      return rechazar(403, "Tu cuenta no tiene autorización para utilizar Marketing IA.");
    }


    const body: EntradaKitMarketing =

      await req.json();



    const {

      negocio = {},

      producto = {},

      estrategia = {},

      campana = {},

      canales = [

        "TikTok",

        "WhatsApp",

        "Mercado Libre",

        "Marca personal",

      ],

      resultadosAnteriores = {},

      datosReales = {},

    } = body || {};



    const datosFaltantes = [];



    if (!texto(producto?.nombre)) {

      datosFaltantes.push(

        "Nombre del producto"

      );

    }



    if (!numeroValido(producto?.precio)) {

      datosFaltantes.push(

        "Precio vigente"

      );

    }



    if (!numeroValido(producto?.existencia)) {

      datosFaltantes.push(

        "Existencia disponible"

      );

    }



    if (!texto(estrategia?.oferta)) {

      datosFaltantes.push(

        "Oferta o condición de venta"

      );

    }



    if (!texto(estrategia?.objetivo)) {

      datosFaltantes.push(

        "Objetivo de la publicación"

      );

    }



    if (datosFaltantes.length > 0) {

      return responder({

        ok: true,

        listo: false,

        estado: "REQUIERE_DATOS",

        datosFaltantes,

        mensaje:

          "Confirma precio, existencia, oferta y objetivo. MONYS propondrá el cliente ideal como hipótesis si no hay datos de clientes.",

      });

    }



    const apiKey =

      Deno.env.get("OPENAI_API_KEY");



    if (!apiKey) {

      return responder(

        {

          ok: false,

          error:

            "Falta OPENAI_API_KEY en Supabase.",

        },

        500

      );

    }



    const datosDisponibles =

      JSON.stringify(

        {

          negocio,

          producto,

          estrategia,

          campana,

          canales,

          resultadosAnteriores,

          datosReales,

        },

        null,

        2

      );



    const prompt = `

Eres el Motor de Ejecución de Marketing

de MONYS OS.



Tu trabajo es crear un kit de publicación

listo para ejecutar por una empleada de una

tienda mexicana de cosméticos.



El kit debe indicar exactamente:



- qué publicar;

- en qué canal;

- el texto exacto;

- el guion;

- las fotografías o tomas necesarias;

- la llamada a comprar;

- cómo medir los resultados.



REGLAS OBLIGATORIAS:



1. Usa solamente los datos proporcionados.



2. No inventes precio, existencia, margen,

promoción, descuento, envío, beneficios,

ventas, testimonios ni resultados.



3. No prometas efectos cosméticos o médicos

que no estén expresamente respaldados

en los datos proporcionados.



4. Si falta un dato necesario, inclúyelo

en datosFaltantes y marca el estado como

REQUIERE_DATOS.



5. Diferencia claramente:

DATO_REAL, ESTIMACION e HIPOTESIS.



6. Los datos capturados por Kary deben

considerarse DATO_REAL_CAPTURADO_POR_KARY.



7. Los datos provenientes de Supabase deben

considerarse DATO_REAL_CONSULTADO_EN_SUPABASE.



8. Si los datos de Supabase no encuentran

coincidencia con el producto buscado, no

inventes coincidencias ni resultados.

Decláralo en advertencias.



9. Escribe en español claro, natural y útil

para clientes de México.



10. Evita lenguaje exagerado, genérico o engañoso.



11. Adapta el contenido a cada canal.



12. Para TikTok entrega:

- guion por escenas;

- texto en pantalla;

- voz o acción;

- descripción;

- llamado a comprar;

- instrucciones de grabación.



13. Para WhatsApp entrega:

- secuencia de estados;

- mensaje directo no invasivo;

- respuestas para preguntas frecuentes.



14. Para Mercado Libre entrega:

- título;

- beneficios comprobables;

- descripción;

- orden de fotografías;

- palabras clave;

- preguntas frecuentes.



15. No inventes datos de envío, garantía,

promociones ni condiciones comerciales.



16. Para marca personal explica:

- qué debe decir Mónica;

- cómo grabarlo;

- cómo relacionarlo con una venta

sin perder autenticidad.



17. Señala cualquier cambio de precio,

descuento, presupuesto o afirmación sensible

que requiera autorización humana.



18. La medición debe separar actividad de

resultados:



- publicación;

- vistas;

- mensajes;

- pedidos;

- ventas;

- monto vendido;

- gasto;

- utilidad, únicamente si existe un dato real.



19. Los criterios de éxito, semáforos y

recomendaciones futuras son HIPOTESIS si

no existe una línea base real.



20. Si un canal no fue solicitado, devuelve

su sección vacía.

21. Propón el cliente ideal. Usa audiencia capturada e historial solamente si existen.
Si faltan datos de compradores, ofrece un segmento de prueba como HIPOTESIS,
explica en qué señal te basas y cómo lo validarías con una prueba pequeña.
No inventes edad, género, ingresos, tipo de piel ni compras anteriores.
Incluye el segmento en clienteIdeal, aunque estrategia.audiencia esté vacía.



DATOS DISPONIBLES:



${datosDisponibles}



Devuelve únicamente JSON válido con esta forma:



{

  "estado": "LISTO",

  "resumen": "",

  "datosFaltantes": [],

  "advertencias": [],

  "clienteIdeal": {
    "perfil": "",
    "necesidad": "",
    "fundamento": "",
    "clasificacion": "HIPOTESIS",
    "comoValidar": ""
  },

  "mensajeCentral": {

    "gancho": "",

    "beneficio": "",

    "oferta": "",

    "llamadoAComprar": ""

  },

  "tiktok": {

    "objetivo": "",

    "duracionSegundos": 0,

    "guion": [

      {

        "momento": "",

        "visual": "",

        "vozOAccion": "",

        "textoEnPantalla": ""

      }

    ],

    "textoPublicacion": "",

    "hashtags": [],

    "llamadoAComprar": "",

    "instruccionesGrabacion": []

  },

  "whatsapp": {

    "estados": [

      {

        "orden": 1,

        "visual": "",

        "texto": "",

        "llamadoAComprar": ""

      }

    ],

    "mensajeDirecto": "",

    "respuestasRapidas": [

      {

        "pregunta": "",

        "respuesta": ""

      }

    ]

  },

  "mercadoLibre": {

    "titulo": "",

    "beneficiosComprobables": [],

    "descripcion": "",

    "ordenFotografias": [],

    "palabrasClave": [],

    "preguntasFrecuentes": [

      {

        "pregunta": "",

        "respuesta": ""

      }

    ]

  },

  "marcaPersonal": {

    "angulo": "",

    "guion": [],

    "textoPublicacion": "",

    "instruccionesGrabacion": [],

    "llamadoAComprar": ""

  },

  "medicion": {

    "registrar": [],

    "ventanaInicialHoras": 24,

    "criterioVerde": "",

    "criterioAmarillo": "",

    "criterioRojo": "",

    "notaCausal": ""

  },

  "requiereAutorizacion": [],

  "confianza": 0,

  "clasificacionFuentes": {

    "datoReal": [],

    "estimacion": [],

    "hipotesis": []

  }

}



REGLAS DE RESPUESTA:



- confianza debe ser un número de 0 a 100;

- no omitas ninguna sección;

- no inventes datos;

- los textos deben poder copiarse y publicarse;

- los criterios de semáforo deben marcarse

como hipótesis cuando no exista línea base;

- cualquier dato no comprobado debe aparecer

en advertencias o hipótesis.

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

            model:

              Deno.env.get(

                "OPENAI_MODEL"

              ) || "gpt-5.6",

            messages: [

              {

                role: "system",

                content:

                  "Responde únicamente con JSON válido. No inventes datos ni afirmaciones de producto.",

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

        "Error OpenAI generando kit:",

        datos

      );



      return responder(

        {

          ok: false,

          error:

            datos?.error?.message ||

            "OpenAI no pudo generar el kit de publicación.",

        },

        500

      );

    }



    const contenido =

      datos?.choices?.[0]

        ?.message?.content;



    if (!contenido) {

      throw new Error(

        "MONYS no recibió un kit válido."

      );

    }



    const kit =

      JSON.parse(contenido);

    if (!kit?.clienteIdeal?.perfil) {
      kit.clienteIdeal = {
        perfil: "Por definir con una prueba pequeña",
        necesidad: "Sin evidencia suficiente de clientes",
        fundamento: "La respuesta no propuso un segmento verificable.",
        clasificacion: "HIPOTESIS",
        comoValidar: "Registrar mensajes, pedidos y ventas por tipo de cliente.",
      };
    }

    if (!texto(estrategia?.audiencia)) {
      kit.clienteIdeal.clasificacion = "HIPOTESIS";
    }

    if (texto(datosReales?.fuenteExistencia).includes("PENDIENTE_VERIFICACIÓN")) {
      kit.estado = "REQUIERE_DATOS";
      kit.datosFaltantes = Array.isArray(kit.datosFaltantes)
        ? kit.datosFaltantes
        : [];
      if (!kit.datosFaltantes.includes("Verificar existencia actual antes de publicar")) {
        kit.datosFaltantes.push("Verificar existencia actual antes de publicar");
      }
    }



    return responder({

      ok: true,

      listo:

        kit?.estado === "LISTO",

      kit,

    });

  } catch (error) {

    console.error(

      "Error generar-kit-marketing:",

      error

    );



    return responder(

      {

        ok: false,

        error:

          error?.message ||

          "Error inesperado al generar el kit de publicación.",

      },

      500

    );

  }

});
