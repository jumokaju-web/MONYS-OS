import {
  createContext,
  useContext,
  useEffect,
  useState,
} from "react";

import { supabase } from "../supabase";

import {
  obtenerPermisosPorRol,
} from "../services/permisosService";

const UserContext = createContext(null);

export function UserProvider({
  children,
}) {
  const [
    usuario,
    setUsuario,
  ] = useState(null);

  const [
    cargandoUsuario,
    setCargandoUsuario,
  ] = useState(true);

  const [
    errorUsuario,
    setErrorUsuario,
  ] = useState("");

  const [
    permisos,
    setPermisos,
  ] = useState([]);

  const [
    cargandoPermisos,
    setCargandoPermisos,
  ] = useState(false);

  const [
    errorPermisos,
    setErrorPermisos,
  ] = useState("");

  /*
    ==========================================
    CARGA DEL USUARIO AUTENTICADO
    ==========================================
  */

  async function cargarUsuarioAutenticado(
    authUserId
  ) {
    try {
      setCargandoUsuario(true);
      setErrorUsuario("");

      const {
        data: usuarioDB,
        error: errorUsuarioDB,
      } = await supabase
        .from("usuarios")
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
        .eq(
          "auth_user_id",
          authUserId
        )
        .maybeSingle();

      if (errorUsuarioDB) {
        throw errorUsuarioDB;
      }

      if (!usuarioDB) {
        throw new Error(
          "La cuenta autenticada no está vinculada a un usuario de MONYS OS."
        );
      }

      if (!usuarioDB.active) {
        throw new Error(
          "Este usuario está inactivo en MONYS OS."
        );
      }

      let nombreNegocio =
        "Corporativo";

      let nombreSucursal =
        "Todas / No aplica";

      /*
        Carga el nombre real del negocio.
      */
      if (usuarioDB.business_id) {
        const {
          data: negocioDB,
          error: errorNegocio,
        } = await supabase
          .from("businesses")
          .select("name")
          .eq(
            "id",
            usuarioDB.business_id
          )
          .maybeSingle();

        if (errorNegocio) {
          throw errorNegocio;
        }

        if (negocioDB?.name) {
          nombreNegocio =
            negocioDB.name;
        }
      }

      /*
        Carga el nombre real de la sucursal.
      */
      if (usuarioDB.branch_id) {
        const {
          data: sucursalDB,
          error: errorSucursal,
        } = await supabase
          .from("branches")
          .select("name")
          .eq(
            "id",
            usuarioDB.branch_id
          )
          .maybeSingle();

        if (errorSucursal) {
          throw errorSucursal;
        }

        if (sucursalDB?.name) {
          nombreSucursal =
            sucursalDB.name;
        }
      }

      setUsuario({
        id: usuarioDB.id,
        organization_id:
          usuarioDB.organization_id,
        business_id:
          usuarioDB.business_id,
        branch_id:
          usuarioDB.branch_id,
        auth_user_id:
          usuarioDB.auth_user_id,
        nombre:
          usuarioDB.nombre,
        correo:
          usuarioDB.correo,
        telefono:
          usuarioDB.telefono,
        role:
          usuarioDB.role,
        active:
          usuarioDB.active,
        negocio:
          nombreNegocio,
        sucursal:
          nombreSucursal,
      });
    } catch (error) {
      console.error(
        "Error al cargar usuario autenticado:",
        error
      );

      setUsuario(null);

      setErrorUsuario(
        error.message ||
          "No se pudo cargar el usuario."
      );
    } finally {
      setCargandoUsuario(false);
    }
  }

  /*
    ==========================================
    REVISA LA SESIÓN DE SUPABASE
    ==========================================
  */

  useEffect(() => {
    let componenteActivo = true;

    async function iniciarUsuario() {
      try {
        setCargandoUsuario(true);
        setErrorUsuario("");

        const {
          data,
          error,
        } =
          await supabase.auth.getSession();

        if (error) {
          throw error;
        }

        if (!componenteActivo) {
          return;
        }

        const session =
          data?.session;

        if (session?.user?.id) {
          await cargarUsuarioAutenticado(
            session.user.id
          );

          return;
        }

        /*
          SIN SESIÓN:
          no entra ningún usuario.
        */
        setUsuario(null);
        setPermisos([]);
        setCargandoUsuario(false);
      } catch (error) {
        console.error(
          "Error al revisar sesión:",
          error
        );

        if (
          componenteActivo
        ) {
          setUsuario(null);
          setPermisos([]);

          setErrorUsuario(
            error.message ||
              "No se pudo revisar la sesión."
          );

          setCargandoUsuario(false);
        }
      }
    }

    iniciarUsuario();

    const {
      data: {
        subscription,
      },
    } =
      supabase.auth.onAuthStateChange(
        async (
          evento,
          session
        ) => {
          if (
            !componenteActivo
          ) {
            return;
          }

          console.log(
            "AUTH USER CONTEXT:",
            evento
          );

          if (
            session?.user?.id
          ) {
            await cargarUsuarioAutenticado(
              session.user.id
            );

            return;
          }

          /*
            CERRÓ SESIÓN O NO EXISTE SESIÓN:
            limpia completamente el usuario.
          */
          setUsuario(null);
          setPermisos([]);
          setCargandoUsuario(false);
        }
      );

    return () => {
      componenteActivo = false;

      subscription.unsubscribe();
    };
  }, []);

  /*
    ==========================================
    PERMISOS POR ROL
    ==========================================
  */

  useEffect(() => {
    if (!usuario?.role) {
      setPermisos([]);
      setCargandoPermisos(
        false
      );

      return;
    }

    cargarPermisos();
  }, [usuario?.role]);

  async function cargarPermisos() {
    try {
      if (!usuario?.role) {
        setPermisos([]);
        return;
      }

      setCargandoPermisos(
        true
      );

      setErrorPermisos("");

      const permisosRol =
        await obtenerPermisosPorRol(
          usuario.role
        );

      setPermisos(
        permisosRol || []
      );
    } catch (error) {
      console.error(
        "Error al cargar permisos:",
        error
      );

      setErrorPermisos(
        error.message ||
          "No se pudieron cargar los permisos."
      );

      setPermisos([]);
    } finally {
      setCargandoPermisos(
        false
      );
    }
  }

  /*
    ==========================================
    VALIDACIÓN DE PERMISOS
    ==========================================
  */

  function tienePermiso(
    permission
  ) {
    if (!usuario) {
      return false;
    }

    if (
      usuario.role === "owner"
    ) {
      return true;
    }

    return permisos.includes(
      permission
    );
  }

  const value = {
    usuario,
    setUsuario,

    permisos,
    tienePermiso,

    cargandoUsuario,
    errorUsuario,

    cargandoPermisos,
    errorPermisos,

    recargarPermisos:
      cargarPermisos,

    recargarUsuario:
      cargarUsuarioAutenticado,
  };

  return (
    <UserContext.Provider
      value={value}
    >
      {children}
    </UserContext.Provider>
  );
}

export function useUser() {
  const context =
    useContext(UserContext);

  if (!context) {
    throw new Error(
      "useUser debe usarse dentro de UserProvider"
    );
  }

  return context;
}