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

      /*
        El rol controla permisos del sistema, pero el puesto define la
        experiencia operativa. Se consulta por el usuario autenticado para
        evitar que una vendedora herede la pantalla de Marketing únicamente
        porque su rol técnico quedó configurado de esa manera.

        Esta consulta es complementaria: un perfil sin ficha de RH conserva
        el acceso mediante su rol y no queda bloqueado al iniciar sesión.
      */
      let empleadoDB = null;

      const {
        data: empleadoRelacionado,
        error: errorEmpleado,
      } = await supabase
        .from("empleados")
        .select("id, puesto, branch_id, business_id, organization_id, active")
        .eq("usuario_id", authUserId)
        .eq("active", true)
        .order("updated_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (errorEmpleado) {
        console.warn(
          "No fue posible cargar el puesto operativo del usuario:",
          errorEmpleado
        );
      } else {
        empleadoDB = empleadoRelacionado;
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
        empleado_id:
          empleadoDB?.id || null,
        puesto:
          empleadoDB?.puesto || null,
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
