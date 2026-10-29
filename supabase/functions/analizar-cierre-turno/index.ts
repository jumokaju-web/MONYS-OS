// @ts-nocheck
import "jsr:@supabase/functions-js/edge-runtime.d.ts";

import { createClient } from "npm:@supabase/supabase-js@2.110.7";


const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};


function rechazar(status, mensaje) {
  throw Object.assign(new Error(mensaje), { status });
}

async function sesionAutorizada(req, roles = null) {
  const authorization = req.headers.get("Authorization") || "";
  const token = /^Bearer\s+(\S+)$/i.exec(authorization)?.[1];
  if (!token) rechazar(401, "Inicia sesión para usar el análisis operativo.");
  const url = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  if (!url || !anonKey) rechazar(503, "No se pudo verificar el acceso.");
  const cliente = createClient(url, anonKey, {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: identidad, error: errorIdentidad } = await cliente.auth.getUser(token);
  if (errorIdentidad || !identidad?.user?.id || identidad.user.is_anonymous === true) {
    rechazar(401, "La sesión no es válida. Inicia sesión de nuevo.");
  }
  const { data: perfil, error: errorPerfil } = await cliente.from("usuarios")
    .select("auth_user_id, organization_id, business_id, branch_id, role, active")
    .eq("auth_user_id", identidad.user.id).maybeSingle();
  if (errorPerfil) rechazar(503, "No se pudo verificar tu autorización.");
  if (!perfil || perfil.auth_user_id !== identidad.user.id || perfil.active !== true
    || !perfil.organization_id || (roles && !roles.includes(perfil.role))) {
    rechazar(403, "Tu cuenta no tiene autorización para este análisis.");
  }
  return { cliente, perfil, usuarioId: identidad.user.id, url };
}

async function verificarSucursal(cliente, perfil, branchId) {
  if (!branchId) rechazar(403, "El recurso no tiene una sucursal autorizada.");
  const { data: sucursal, error: errorSucursal } = await cliente.from("branches")
    .select("id, business_id").eq("id", branchId).maybeSingle();
  if (errorSucursal || sucursal?.id !== branchId || !sucursal?.business_id) rechazar(403, "No se pudo autorizar la sucursal.");
  const { data: negocio, error: errorNegocio } = await cliente.from("businesses")
    .select("id, organization_id").eq("id", sucursal.business_id).maybeSingle();
  if (errorNegocio || !negocio || negocio.id !== sucursal.business_id || negocio.organization_id !== perfil.organization_id
    || (perfil.business_id && perfil.business_id !== negocio.id)
    || (!["owner", "admin"].includes(perfil.role)
      && (perfil.branch_id !== branchId || perfil.business_id !== negocio.id))) {
    rechazar(403, "El recurso está fuera de tu organización o alcance operativo.");
  }
  return sucursal;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(
      "ok",
      {
        headers: corsHeaders,
      }
    );
  }


  if (req.method !== "POST") return new Response(JSON.stringify({ ok: false, error: "Método no permitido." }), {
    status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

  try {
    const sesion = await sesionAutorizada(req);
    const { cliente: supabase, perfil, usuarioId, url } = sesion;
    const body = await req.json();
    const cierreId = typeof body?.cierreId === "string" ? body.cierreId.trim() : null;
    if (!cierreId) rechazar(400, "Falta cierreId.");
    const openAiKey = Deno.env.get("OPENAI_API_KEY");

    const {
      data: cierre,
      error: errorCierre,
    } = await supabase
      .from(
        "cierres_turno"
      )
      .select(`
        id,
        created_by,
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


    if (errorCierre || !cierre || cierre.id !== cierreId) rechazar(403, "No tienes acceso a este cierre.");
    await verificarSucursal(supabase, perfil, cierre.branch_id);
    if (!["owner", "admin"].includes(perfil.role) && cierre.created_by !== usuarioId) {
      rechazar(403, "Solo puedes analizar tus propios cierres.");
    }
    if (!openAiKey) throw new Error("Falta OPENAI_API_KEY.");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!serviceRoleKey) rechazar(503, "No se pudo preparar el guardado del análisis.");

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


    // cierres_turno_analisis no permite INSERT al usuario por sus políticas.
    // La clave privilegiada se usa EXCLUSIVAMENTE para persistir este resultado,
    // tras revalidar el mismo recurso con el cliente RLS. Nunca realiza lecturas.
    const { data: cierreVigente, error: errorVigente } = await supabase.from("cierres_turno")
      .select("id, branch_id, created_by").eq("id", cierreId).single();
    if (errorVigente || !cierreVigente || cierreVigente.branch_id !== cierre.branch_id
      || cierreVigente.created_by !== cierre.created_by) rechazar(403, "El cierre dejó de estar autorizado.");
    await verificarSucursal(supabase, perfil, cierreVigente.branch_id);
    const escritorResultado = createClient(url, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const {
      error: errorGuardarAnalisis,
    } = await escritorResultado
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
        status: error?.status || 400,

        headers: {
          ...corsHeaders,
          "Content-Type":
            "application/json",
        },
      }
    );
  }
});