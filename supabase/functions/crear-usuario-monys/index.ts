// @ts-nocheck
import "jsr:@supabase/functions-js/edge-runtime.d.ts";

import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const ROLES_PERMITIDOS = [
  "owner",
  "director",
  "admin",
  "encargada",
  "vendedora",
  "marketing",
  "chofer",
  "compras",
  "finanzas",
  "rh",
  "capturista",
  "consulta",
];

function respuesta(
  body: Record<string, unknown>,
  status = 200
) {
  return new Response(
    JSON.stringify(body),
    {
      status,
      headers: {
        ...corsHeaders,
        "Content-Type":
          "application/json",
      },
    }
  );
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

  if (req.method !== "POST") {
    return respuesta(
      {
        error:
          "Método no permitido.",
      },
      405
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

  if (
    !supabaseUrl ||
    !serviceRoleKey
  ) {
    return respuesta(
      {
        error:
          "La función no tiene configuradas las credenciales internas de Supabase.",
      },
      500
    );
  }

  const authorization =
    req.headers.get(
      "Authorization"
    );

  if (!authorization) {
    return respuesta(
      {
        error:
          "No existe una sesión válida.",
      },
      401
    );
  }

  /*
    Cliente con la sesión del usuario
    que está usando MONYS.
  */
  const supabaseUsuario =
    createClient(
      supabaseUrl,
      Deno.env.get(
        "SUPABASE_ANON_KEY"
      ) || "",
      {
        global: {
          headers: {
            Authorization:
              authorization,
          },
        },
      }
    );

  /*
    Cliente administrativo.

    Esta llave solamente vive dentro
    de la Edge Function.

    NUNCA se manda al navegador.
  */
  const supabaseAdmin =
    createClient(
      supabaseUrl,
      serviceRoleKey
    );

  try {
    /*
      ========================================
      1. CONFIRMAR QUIÉN ESTÁ HACIENDO EL ALTA
      ========================================
    */

    const {
      data: authData,
      error: authError,
    } =
      await supabaseUsuario
        .auth
        .getUser();

    if (
      authError ||
      !authData?.user
    ) {
      return respuesta(
        {
          error:
            "La sesión no es válida.",
        },
        401
      );
    }

    const authUser =
      authData.user;

    const {
      data: usuarioSolicitante,
      error:
        errorUsuarioSolicitante,
    } =
      await supabaseAdmin
        .from("usuarios")
        .select(`
          id,
          organization_id,
          role,
          active
        `)
        .eq(
          "auth_user_id",
          authUser.id
        )
        .maybeSingle();

    if (
      errorUsuarioSolicitante
    ) {
      throw errorUsuarioSolicitante;
    }

    if (
      !usuarioSolicitante ||
      !usuarioSolicitante.active
    ) {
      return respuesta(
        {
          error:
            "Tu cuenta no tiene autorización para administrar usuarios.",
        },
        403
      );
    }

    const puedeCrearUsuarios =
      usuarioSolicitante.role ===
        "owner" ||
      usuarioSolicitante.role ===
        "admin";

    if (!puedeCrearUsuarios) {
      return respuesta(
        {
          error:
            "Solamente Owner o Administrador pueden crear usuarios.",
        },
        403
      );
    }

    /*
      ========================================
      2. LEER DATOS DEL NUEVO USUARIO
      ========================================
    */

    const body =
      await req.json();

    const nombre =
      String(
        body?.nombre || ""
      ).trim();

    const correo =
      String(
        body?.correo || ""
      )
        .trim()
        .toLowerCase();

    const password =
      String(
        body?.password || ""
      );

    const telefono =
      body?.telefono
        ? String(
            body.telefono
          ).trim()
        : null;

    const role =
      String(
        body?.role || ""
      ).trim();

    const businessId =
      String(
        body?.business_id || ""
      ).trim();

    const branchId =
      String(
        body?.branch_id || ""
      ).trim();

    const active =
      body?.active !== false;

    if (!nombre) {
      return respuesta(
        {
          error:
            "Debes escribir el nombre.",
        },
        400
      );
    }

    if (
      !correo ||
      !correo.includes("@")
    ) {
      return respuesta(
        {
          error:
            "Debes escribir un correo válido.",
        },
        400
      );
    }

    if (
      password.length < 8
    ) {
      return respuesta(
        {
          error:
            "La contraseña temporal debe tener por lo menos 8 caracteres.",
        },
        400
      );
    }

    if (
      !ROLES_PERMITIDOS.includes(
        role
      )
    ) {
      return respuesta(
        {
          error:
            "El rol seleccionado no es válido.",
        },
        400
      );
    }

    if (
      !businessId ||
      !branchId
    ) {
      return respuesta(
        {
          error:
            "Debes seleccionar negocio y sucursal.",
        },
        400
      );
    }

    /*
      ========================================
      3. VALIDAR NEGOCIO Y SUCURSAL
      ========================================
    */

    const {
      data: negocio,
      error: errorNegocio,
    } =
      await supabaseAdmin
        .from("businesses")
        .select(`
          id,
          organization_id,
          active
        `)
        .eq(
          "id",
          businessId
        )
        .maybeSingle();

    if (errorNegocio) {
      throw errorNegocio;
    }

    if (
      !negocio ||
      !negocio.active
    ) {
      return respuesta(
        {
          error:
            "El negocio seleccionado no es válido.",
        },
        400
      );
    }

    /*
      Nadie puede crear usuarios
      fuera de su propia organización.
    */
    if (
      negocio.organization_id !==
      usuarioSolicitante.organization_id
    ) {
      return respuesta(
        {
          error:
            "No puedes crear usuarios para otra organización.",
        },
        403
      );
    }

    const {
      data: sucursal,
      error: errorSucursal,
    } =
      await supabaseAdmin
        .from("branches")
        .select(`
          id,
          business_id,
          active
        `)
        .eq(
          "id",
          branchId
        )
        .maybeSingle();

    if (errorSucursal) {
      throw errorSucursal;
    }

    if (
      !sucursal ||
      !sucursal.active
    ) {
      return respuesta(
        {
          error:
            "La sucursal seleccionada no es válida.",
        },
        400
      );
    }

    if (
      sucursal.business_id !==
      negocio.id
    ) {
      return respuesta(
        {
          error:
            "La sucursal no pertenece al negocio seleccionado.",
        },
        400
      );
    }

    /*
      ========================================
      4. EVITAR CORREOS DUPLICADOS EN MONYS
      ========================================
    */

    const {
      data: usuarioExistente,
      error:
        errorUsuarioExistente,
    } =
      await supabaseAdmin
        .from("usuarios")
        .select(`
          id,
          correo,
          auth_user_id
        `)
        .eq(
          "correo",
          correo
        )
        .maybeSingle();

    if (errorUsuarioExistente) {
      throw errorUsuarioExistente;
    }

    if (usuarioExistente) {
      return respuesta(
        {
          error:
            "Ya existe un usuario de MONYS registrado con ese correo.",
        },
        409
      );
    }

    /*
      ========================================
      5. CREAR CUENTA DE ACCESO
      ========================================
    */

    const {
      data: nuevoAuth,
      error: errorCrearAuth,
    } =
      await supabaseAdmin
        .auth
        .admin
        .createUser({
          email: correo,
          password,
          email_confirm: true,
          user_metadata: {
            nombre,
          },
        });

    if (
      errorCrearAuth ||
      !nuevoAuth?.user
    ) {
      return respuesta(
        {
          error:
            errorCrearAuth?.message ||
            "No fue posible crear la cuenta de acceso.",
        },
        400
      );
    }

    const nuevoAuthUser =
      nuevoAuth.user;

    /*
      ========================================
      6. CREAR PERFIL EMPRESARIAL
      ========================================
    */

    const {
      data: nuevoPerfil,
      error:
        errorCrearPerfil,
    } =
      await supabaseAdmin
        .from("usuarios")
        .insert({
          organization_id:
            negocio.organization_id,

          business_id:
            negocio.id,

          branch_id:
            sucursal.id,

          auth_user_id:
            nuevoAuthUser.id,

          nombre,

          correo,

          telefono,

          role,

          active,
        })
        .select(`
          id,
          organization_id,
          business_id,
          branch_id,
          auth_user_id,
          nombre,
          correo,
          telefono,
          role,
          active
        `)
        .single();

    /*
      Si falla el perfil empresarial,
      eliminamos la cuenta Auth que
      acabamos de crear.

      Así no dejamos usuarios "huérfanos".
    */
    if (
      errorCrearPerfil ||
      !nuevoPerfil
    ) {
      await supabaseAdmin
        .auth
        .admin
        .deleteUser(
          nuevoAuthUser.id
        );

      throw (
        errorCrearPerfil ||
        new Error(
          "No fue posible crear el perfil empresarial."
        )
      );
    }

    /*
      ========================================
      7. RESULTADO
      ========================================
    */

    return respuesta({
      ok: true,

      mensaje:
        "Usuario creado correctamente.",

      usuario:
        nuevoPerfil,
    });
  } catch (error) {
    console.error(
      "ERROR crear-usuario-monys:",
      error
    );

    return respuesta(
      {
        error:
          error instanceof Error
            ? error.message
            : "Ocurrió un error inesperado al crear el usuario.",
      },
      500
    );
  }
});