// @ts-nocheck

import "jsr:@supabase/functions-js/edge-runtime.d.ts";

import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

function responder(
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
    return new Response("ok", {
      headers: corsHeaders,
    });
  }

  if (req.method !== "POST") {
    return responder(
      {
        error:
          "Método no permitido.",
      },
      405
    );
  }

  const supabaseUrl =
    Deno.env.get("SUPABASE_URL");

  const serviceRoleKey =
    Deno.env.get(
      "SUPABASE_SERVICE_ROLE_KEY"
    );

  const anonKey =
    Deno.env.get(
      "SUPABASE_ANON_KEY"
    );

  if (
    !supabaseUrl ||
    !serviceRoleKey ||
    !anonKey
  ) {
    return responder(
      {
        error:
          "Faltan credenciales internas de Supabase.",
      },
      500
    );
  }

  const authorization =
    req.headers.get(
      "Authorization"
    );

  if (!authorization) {
    return responder(
      {
        error:
          "No existe una sesión válida.",
      },
      401
    );
  }

  const supabaseUsuario =
    createClient(
      supabaseUrl,
      anonKey,
      {
        global: {
          headers: {
            Authorization:
              authorization,
          },
        },
      }
    );

  const supabaseAdmin =
    createClient(
      supabaseUrl,
      serviceRoleKey
    );

  try {
    /*
      ======================================
      1. VALIDAR AL USUARIO QUE SOLICITA
      ======================================
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
      return responder(
        {
          error:
            "La sesión no es válida.",
        },
        401
      );
    }

    const {
      data: solicitante,
      error:
        errorSolicitante,
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
          authData.user.id
        )
        .maybeSingle();

    if (errorSolicitante) {
      throw errorSolicitante;
    }

    if (
      !solicitante ||
      !solicitante.active
    ) {
      return responder(
        {
          error:
            "Tu cuenta no tiene autorización.",
        },
        403
      );
    }

    if (
      solicitante.role !==
        "owner" &&
      solicitante.role !==
        "admin"
    ) {
      return responder(
        {
          error:
            "Solamente Owner o Administrador pueden eliminar usuarios.",
        },
        403
      );
    }

    /*
      ======================================
      2. LEER USUARIO A ELIMINAR
      ======================================
    */

    const body =
      await req.json();

    const usuarioId =
      String(
        body?.usuario_id || ""
      ).trim();

    if (!usuarioId) {
      return responder(
        {
          error:
            "Falta el usuario a eliminar.",
        },
        400
      );
    }

    const {
      data: usuarioEliminar,
      error:
        errorUsuarioEliminar,
    } =
      await supabaseAdmin
        .from("usuarios")
        .select(`
          id,
          organization_id,
          auth_user_id,
          nombre,
          correo,
          role
        `)
        .eq(
          "id",
          usuarioId
        )
        .maybeSingle();

    if (errorUsuarioEliminar) {
      throw errorUsuarioEliminar;
    }

    if (!usuarioEliminar) {
      return responder(
        {
          error:
            "El usuario ya no existe.",
        },
        404
      );
    }

    /*
      ======================================
      3. SEGURIDAD
      ======================================
    */

    if (
      usuarioEliminar.organization_id !==
      solicitante.organization_id
    ) {
      return responder(
        {
          error:
            "No puedes eliminar usuarios de otra organización.",
        },
        403
      );
    }

    /*
      Nunca permitir borrar al Owner.
    */
    if (
      usuarioEliminar.role ===
      "owner"
    ) {
      return responder(
        {
          error:
            "El usuario Owner no puede eliminarse.",
        },
        403
      );
    }

    /*
      Evitar que alguien se elimine a sí mismo.
    */
    if (
      usuarioEliminar.id ===
      solicitante.id
    ) {
      return responder(
        {
          error:
            "No puedes eliminar tu propia cuenta desde aquí.",
        },
        403
      );
    }

    /*
      ======================================
      4. BORRAR PERFIL MONYS
      ======================================
    */

    const {
      error: errorPerfil,
    } =
      await supabaseAdmin
        .from("usuarios")
        .delete()
        .eq(
          "id",
          usuarioEliminar.id
        );

    if (errorPerfil) {
      throw errorPerfil;
    }

    /*
      ======================================
      5. BORRAR AUTH SI EXISTE
      ======================================
    */

    if (
      usuarioEliminar.auth_user_id
    ) {
      const {
        error: errorAuth,
      } =
        await supabaseAdmin
          .auth
          .admin
          .deleteUser(
            usuarioEliminar.auth_user_id
          );

      if (errorAuth) {
        console.error(
          "No se pudo eliminar Auth:",
          errorAuth
        );

        return responder(
          {
            ok: true,
            warning:
              "El perfil MONYS fue eliminado, pero la cuenta Auth no pudo eliminarse automáticamente.",
          },
          200
        );
      }
    }

    return responder({
      ok: true,

      mensaje:
        "Usuario eliminado correctamente.",
    });
  } catch (error) {
    console.error(
      "ERROR eliminar-usuario-monys:",
      error
    );

    return responder(
      {
        error:
          error instanceof Error
            ? error.message
            : "Ocurrió un error inesperado.",
      },
      500
    );
  }
});