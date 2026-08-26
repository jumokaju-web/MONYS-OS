import {
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  obtenerUsuarios,
  obtenerNegociosActivos,
  obtenerSucursalesActivas,
  validarNuevoUsuario,
  crearPerfilUsuario,
  cambiarEstadoUsuario,
  eliminarUsuarioMonys,
} from "../services/usuariosService";

const ROLES = [
  { value: "owner", label: "Owner" },
  { value: "director", label: "Director" },
  { value: "admin", label: "Administrador" },
  { value: "encargada", label: "Encargada" },
  { value: "vendedora", label: "Vendedora" },
  { value: "marketing", label: "Marketing" },
  { value: "chofer", label: "Chofer" },
  { value: "compras", label: "Compras" },
  { value: "finanzas", label: "Finanzas" },
  { value: "rh", label: "Recursos Humanos" },
  { value: "capturista", label: "Capturista" },
  { value: "consulta", label: "Consulta" },
];

const FORMULARIO_INICIAL = {
  nombre: "",
  correo: "",
  telefono: "",
  password: "",
  role: "",
  business_id: "",
  branch_id: "",
  active: true,
};

export default function CentroUsuarios({
  volverAlDashboard,
}) {
  const [usuarios, setUsuarios] =
    useState([]);

  const [negocios, setNegocios] =
    useState([]);

  const [sucursales, setSucursales] =
    useState([]);

  const [cargando, setCargando] =
    useState(true);

  const [
    cargandoCatalogos,
    setCargandoCatalogos,
  ] = useState(true);

  const [
    mostrarFormulario,
    setMostrarFormulario,
  ] = useState(false);

  const [formulario, setFormulario] =
    useState(FORMULARIO_INICIAL);

  const [error, setError] =
    useState("");

  const [
    errorCatalogos,
    setErrorCatalogos,
  ] = useState("");

  const [
    guardandoUsuario,
    setGuardandoUsuario,
  ] = useState(false);

  const [
    errorFormulario,
    setErrorFormulario,
  ] = useState("");

  const [
    mensajeExito,
    setMensajeExito,
  ] = useState("");

  useEffect(() => {
    cargarUsuarios();
    cargarCatalogos();
  }, []);

  async function cargarUsuarios() {
    try {
      setCargando(true);
      setError("");

      const registros =
        await obtenerUsuarios();

      setUsuarios(
        registros || []
      );
    } catch (errorCarga) {
      console.error(
        "Error al cargar usuarios:",
        errorCarga
      );

      setError(
        errorCarga.message ||
          "No se pudieron cargar los usuarios."
      );
    } finally {
      setCargando(false);
    }
  }

  async function cargarCatalogos() {
    try {
      setCargandoCatalogos(true);
      setErrorCatalogos("");

      const [
        registrosNegocios,
        registrosSucursales,
      ] = await Promise.all([
        obtenerNegociosActivos(),
        obtenerSucursalesActivas(),
      ]);

      setNegocios(
        registrosNegocios || []
      );

      setSucursales(
        registrosSucursales || []
      );
    } catch (errorCarga) {
      console.error(
        "Error al cargar negocios y sucursales:",
        errorCarga
      );

      setErrorCatalogos(
        errorCarga.message ||
          "No se pudieron cargar los negocios y sucursales."
      );
    } finally {
      setCargandoCatalogos(false);
    }
  }

  const sucursalesDelNegocio =
    useMemo(() => {
      if (!formulario.business_id) {
        return [];
      }

      return sucursales.filter(
        (sucursal) =>
          sucursal.business_id ===
          formulario.business_id
      );
    }, [
      sucursales,
      formulario.business_id,
    ]);

  function actualizarCampo(evento) {
    const {
      name,
      value,
      type,
      checked,
    } = evento.target;

    setErrorFormulario("");
    setMensajeExito("");

    if (name === "business_id") {
      setFormulario((anterior) => ({
        ...anterior,
        business_id: value,
        branch_id: "",
      }));

      return;
    }

    setFormulario((anterior) => ({
      ...anterior,
      [name]:
        type === "checkbox"
          ? checked
          : value,
    }));
  }

  function abrirFormulario() {
    setFormulario(
      FORMULARIO_INICIAL
    );

    setErrorFormulario("");
    setMensajeExito("");

    setMostrarFormulario(true);
  }

  function cancelarFormulario() {
    if (guardandoUsuario) {
      return;
    }

    setFormulario(
      FORMULARIO_INICIAL
    );

    setErrorFormulario("");

    setMostrarFormulario(false);
  }

  async function guardarUsuario() {
    try {
      setGuardandoUsuario(true);
      setErrorFormulario("");
      setMensajeExito("");

      const usuarioValidado =
        validarNuevoUsuario({
          ...formulario,
          negocios,
          sucursales,
        });

      await crearPerfilUsuario(
        usuarioValidado
      );

      await cargarUsuarios();

      setFormulario(
        FORMULARIO_INICIAL
      );

      setMostrarFormulario(false);

      setMensajeExito(
        "Usuario registrado correctamente en MONYS OS."
      );
    } catch (errorGuardado) {
      console.error(
        "Error al guardar usuario:",
        errorGuardado
      );

      let mensaje =
        errorGuardado.message ||
        "No fue posible guardar el usuario.";

      if (
        errorGuardado.code ===
        "23505"
      ) {
        mensaje =
          "Ya existe un usuario registrado con ese correo.";
      }

      if (
        mensaje
          .toLowerCase()
          .includes(
            "row-level security"
          )
      ) {
        mensaje =
          "Supabase bloqueó el registro por seguridad. Verificaremos la sesión y los permisos del usuario.";
      }

      setErrorFormulario(
        mensaje
      );
    } finally {
      setGuardandoUsuario(false);
    }
  }

async function cambiarEstado(
  usuario
) {
  try {
    setError("");
    setMensajeExito("");

    await cambiarEstadoUsuario(
      usuario.id,
      !usuario.active
    );

    await cargarUsuarios();

    setMensajeExito(
      usuario.active
        ? `${usuario.nombre} fue pausado correctamente.`
        : `${usuario.nombre} fue reactivado correctamente.`
    );
  } catch (errorEstado) {
    console.error(
      "Error cambiando estado:",
      errorEstado
    );

    setError(
      errorEstado.message ||
        "No fue posible cambiar el estado del usuario."
    );
  }
}

async function eliminarUsuario(
  usuario
) {
  const confirmar =
    window.confirm(
      `¿Eliminar definitivamente a ${usuario.nombre}?\n\nEsta acción eliminará su acceso a MONYS OS.`
    );

  if (!confirmar) {
    return;
  }

  try {
    setError("");
    setMensajeExito("");

    await eliminarUsuarioMonys(
      usuario.id
    );

    await cargarUsuarios();

    setMensajeExito(
      `${usuario.nombre} fue eliminado correctamente.`
    );
  } catch (errorEliminar) {
    console.error(
      "Error eliminando usuario:",
      errorEliminar
    );

    setError(
      errorEliminar.message ||
        "No fue posible eliminar el usuario."
    );
  }
}

 const formularioCompleto =
  Boolean(
    formulario.nombre.trim() &&
      formulario.correo.trim() &&
      formulario.password.length >= 8 &&
      formulario.role &&
      formulario.business_id &&
      formulario.branch_id
  );

  return (
    <div
      style={{
        maxWidth: "1100px",
        margin: "0 auto",
        padding:
          "28px 20px 60px",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent:
            "space-between",
          alignItems: "center",
          gap: "16px",
          flexWrap: "wrap",
          marginBottom: "24px",
        }}
      >
        <div>
          <h1
            style={{
              margin: 0,
              color: "#2c2030",
            }}
          >
            👥 Administración de Usuarios
          </h1>

          <p
            style={{
              margin: "8px 0 0",
              color: "#6f646a",
            }}
          >
            Usuarios, roles,
            negocios y sucursales
            de MONYS OS.
          </p>
        </div>

        <button
          type="button"
          onClick={
            volverAlDashboard
          }
          style={{
            padding:
              "11px 18px",
            borderRadius: "10px",
            border:
              "1px solid #eadde4",
            background:
              "#ffffff",
            color: "#5e3048",
            fontWeight: "700",
            cursor: "pointer",
          }}
        >
          ← Volver al Dashboard
        </button>
      </div>

      {mensajeExito && (
        <div
          style={{
            padding:
              "14px 16px",
            marginBottom: "18px",
            borderRadius: "12px",
            background: "#eef8f2",
            border:
              "1px solid #b9dfc9",
            color: "#236b45",
            fontWeight: "700",
          }}
        >
          ✅ {mensajeExito}
        </div>
      )}

      <div
        style={{
          display: "flex",
          justifyContent:
            "space-between",
          alignItems: "center",
          gap: "12px",
          flexWrap: "wrap",
          marginBottom: "18px",
        }}
      >
        <strong
          style={{
            color: "#2c2030",
          }}
        >
          {usuarios.length} usuario
          {usuarios.length === 1
            ? ""
            : "s"}
        </strong>

        <button
          type="button"
          onClick={
            abrirFormulario
          }
          style={{
            padding:
              "11px 18px",
            borderRadius: "10px",
            border: "none",
            background:
              "#5e3048",
            color: "#ffffff",
            fontWeight: "800",
            cursor: "pointer",
          }}
        >
          ＋ Nuevo usuario
        </button>
      </div>

      {mostrarFormulario && (
        <div
          style={{
            padding: "22px",
            marginBottom: "20px",
            borderRadius: "16px",
            background:
              "#ffffff",
            border:
              "1px solid #eadde4",
            boxShadow:
              "0 8px 22px rgba(0,0,0,0.05)",
          }}
        >
          <h2
            style={{
              marginTop: 0,
              marginBottom: "6px",
              color: "#2c2030",
            }}
          >
            ➕ Nuevo usuario
          </h2>

          <p
            style={{
              marginTop: 0,
              marginBottom: "22px",
              color: "#766a70",
            }}
          >
            Registra los datos y
            asigna el acceso
            correspondiente.
          </p>

          {errorCatalogos && (
            <div
              style={{
                padding: "14px",
                marginBottom:
                  "18px",
                borderRadius:
                  "10px",
                background:
                  "#fff4f4",
                border:
                  "1px solid #efc0c0",
                color: "#9b3030",
              }}
            >
              {errorCatalogos}
            </div>
          )}

          {errorFormulario && (
            <div
              style={{
                padding: "14px",
                marginBottom:
                  "18px",
                borderRadius:
                  "10px",
                background:
                  "#fff4f4",
                border:
                  "1px solid #efc0c0",
                color: "#9b3030",
                fontWeight: "700",
              }}
            >
              {errorFormulario}
            </div>
          )}

          <div
            style={{
              display: "grid",
              gridTemplateColumns:
                "repeat(auto-fit, minmax(240px, 1fr))",
              gap: "18px",
            }}
          >
            <label
              style={{
                display: "grid",
                gap: "7px",
                color: "#51484d",
                fontWeight: "700",
              }}
            >
              Nombre completo

              <input
                type="text"
                name="nombre"
                value={
                  formulario.nombre
                }
                onChange={
                  actualizarCampo
                }
                placeholder="Ej. Ana Karina Jiménez"
                style={estiloCampo}
              />
            </label>

            <label
              style={{
                display: "grid",
                gap: "7px",
                color: "#51484d",
                fontWeight: "700",
              }}
            >
              Correo

              <input
                type="email"
                name="correo"
                value={
                  formulario.correo
                }
                onChange={
                  actualizarCampo
                }
                placeholder="correo@ejemplo.com"
                style={estiloCampo}
              />
            </label>

              <label
  style={{
    display: "grid",
    gap: "7px",
    color: "#51484d",
    fontWeight: "700",
  }}
>
  Contraseña temporal

  <input
    type="password"
    name="password"
    value={
      formulario.password
    }
    onChange={
      actualizarCampo
    }
    placeholder="Mínimo 8 caracteres"
    style={estiloCampo}
  />
</label>

            <label
              style={{
                display: "grid",
                gap: "7px",
                color: "#51484d",
                fontWeight: "700",
              }}
            >
              Teléfono

              <input
                type="tel"
                name="telefono"
                value={
                  formulario.telefono
                }
                onChange={
                  actualizarCampo
                }
                placeholder="Ej. 3781234567"
                style={estiloCampo}
              />
            </label>

            <label
              style={{
                display: "grid",
                gap: "7px",
                color: "#51484d",
                fontWeight: "700",
              }}
            >
              Rol

              <select
                name="role"
                value={
                  formulario.role
                }
                onChange={
                  actualizarCampo
                }
                style={estiloCampo}
              >
                <option value="">
                  Selecciona un rol
                </option>

                {ROLES.map(
                  (rol) => (
                    <option
                      key={
                        rol.value
                      }
                      value={
                        rol.value
                      }
                    >
                      {rol.label}
                    </option>
                  )
                )}
              </select>
            </label>

            <label
              style={{
                display: "grid",
                gap: "7px",
                color: "#51484d",
                fontWeight: "700",
              }}
            >
              Negocio

              <select
                name="business_id"
                value={
                  formulario.business_id
                }
                onChange={
                  actualizarCampo
                }
                disabled={
                  cargandoCatalogos
                }
                style={estiloCampo}
              >
                <option value="">
                  {cargandoCatalogos
                    ? "Cargando negocios..."
                    : "Selecciona un negocio"}
                </option>

                {negocios.map(
                  (negocio) => (
                    <option
                      key={
                        negocio.id
                      }
                      value={
                        negocio.id
                      }
                    >
                      {negocio.name}
                    </option>
                  )
                )}
              </select>
            </label>

            <label
              style={{
                display: "grid",
                gap: "7px",
                color: "#51484d",
                fontWeight: "700",
              }}
            >
              Sucursal

              <select
                name="branch_id"
                value={
                  formulario.branch_id
                }
                onChange={
                  actualizarCampo
                }
                disabled={
                  !formulario.business_id ||
                  cargandoCatalogos
                }
                style={estiloCampo}
              >
                <option value="">
                  {!formulario.business_id
                    ? "Primero selecciona un negocio"
                    : "Selecciona una sucursal"}
                </option>

                {sucursalesDelNegocio.map(
                  (sucursal) => (
                    <option
                      key={
                        sucursal.id
                      }
                      value={
                        sucursal.id
                      }
                    >
                      {sucursal.name}
                    </option>
                  )
                )}
              </select>
            </label>
          </div>

          <label
            style={{
              display: "flex",
              alignItems: "center",
              gap: "10px",
              marginTop: "20px",
              color: "#51484d",
              fontWeight: "700",
              cursor: "pointer",
            }}
          >
            <input
              type="checkbox"
              name="active"
              checked={
                formulario.active
              }
              onChange={
                actualizarCampo
              }
            />

            Usuario activo
          </label>

          <div
            style={{
              display: "flex",
              gap: "12px",
              flexWrap: "wrap",
              marginTop: "24px",
            }}
          >
            <button
              type="button"
              onClick={
                guardarUsuario
              }
              disabled={
                !formularioCompleto ||
                cargandoCatalogos ||
                guardandoUsuario
              }
              style={{
                padding:
                  "10px 18px",
                borderRadius:
                  "10px",
                border: "none",
                background:
                  !formularioCompleto ||
                  cargandoCatalogos ||
                  guardandoUsuario
                    ? "#d8cbd2"
                    : "#5e3048",
                color: "#ffffff",
                cursor:
                  !formularioCompleto ||
                  cargandoCatalogos ||
                  guardandoUsuario
                    ? "not-allowed"
                    : "pointer",
                fontWeight: "800",
              }}
            >
              {guardandoUsuario
                ? "Guardando..."
                : "Guardar usuario"}
            </button>

            <button
              type="button"
              onClick={
                cancelarFormulario
              }
              disabled={
                guardandoUsuario
              }
              style={{
                padding:
                  "10px 16px",
                borderRadius:
                  "10px",
                border:
                  "1px solid #eadde4",
                background:
                  "#ffffff",
                color: "#5e3048",
                cursor:
                  guardandoUsuario
                    ? "not-allowed"
                    : "pointer",
                fontWeight: "700",
                opacity:
                  guardandoUsuario
                    ? 0.6
                    : 1,
              }}
            >
              Cancelar
            </button>
          </div>
        </div>
      )}

      {cargando && (
        <div
          style={{
            padding: "30px",
            textAlign: "center",
            color: "#777777",
          }}
        >
          Cargando usuarios...
        </div>
      )}

      {error && (
        <div
          style={{
            padding: "16px",
            borderRadius: "12px",
            background: "#fff4f4",
            border:
              "1px solid #efc0c0",
            color: "#9b3030",
          }}
        >
          {error}
        </div>
      )}

      {!cargando &&
        !error &&
        usuarios.length === 0 && (
          <div
            style={{
              padding: "35px",
              borderRadius:
                "16px",
              background:
                "#ffffff",
              border:
                "1px dashed #d8cbd2",
              textAlign:
                "center",
              color: "#777777",
            }}
          >
            Todavía no hay usuarios
            registrados.
          </div>
        )}

          {!cargando &&
        !error &&
        usuarios.length > 0 && (
          <div
            style={{
              display: "grid",
              gap: "14px",
            }}
          >
            {usuarios.map(
              (usuario) => (
                <article
                  key={usuario.id}
                  style={{
                    padding: "18px",
                    borderRadius: "16px",
                    background: "#ffffff",
                    border:
                      "1px solid #eadde4",
                    boxShadow:
                      "0 8px 22px rgba(0,0,0,0.05)",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      justifyContent:
                        "space-between",
                      gap: "16px",
                      flexWrap: "wrap",
                    }}
                  >
                    <div>
                      <strong
                        style={{
                          display: "block",
                          fontSize: "18px",
                          color: "#2c2030",
                        }}
                      >
                        👤{" "}
                        {usuario.nombre}
                      </strong>

                      <div
                        style={{
                          marginTop: "6px",
                          color: "#766a70",
                          fontSize: "14px",
                        }}
                      >
                        {usuario.correo ||
                          "Sin correo"}
                      </div>
                    </div>

                    <span
                      style={{
                        padding:
                          "7px 12px",
                        borderRadius:
                          "999px",
                        background:
                          usuario.active
                            ? "#eef8f2"
                            : "#fff2f2",
                        color:
                          usuario.active
                            ? "#236b45"
                            : "#9b3030",
                        fontWeight: "800",
                        fontSize: "13px",
                      }}
                    >
                      {usuario.active
                        ? "ACTIVO"
                        : "INACTIVO"}
                    </span>
                  </div>

                  <div
                    style={{
                      display: "flex",
                      gap: "20px",
                      flexWrap: "wrap",
                      marginTop: "16px",
                      color: "#51484d",
                      fontSize: "14px",
                    }}
                  >
                    <span>
                      <strong>
                        Rol:
                      </strong>{" "}
                      {usuario.role}
                    </span>

                    <span>
                      <strong>
                        Negocio:
                      </strong>{" "}
                      {usuario.business_id
                        ? "Asignado"
                        : "Corporativo"}
                    </span>

                    <span>
                      <strong>
                        Sucursal:
                      </strong>{" "}
                      {usuario.branch_id
                        ? "Asignada"
                        : "Todas / No aplica"}
                    </span>
                  </div>

                  {usuario.role !==
                    "owner" && (
                    <div
                      style={{
                        display: "flex",
                        gap: "10px",
                        flexWrap: "wrap",
                        marginTop: "18px",
                      }}
                    >
                      <button
                        type="button"
                        onClick={() =>
                          cambiarEstado(
                            usuario
                          )
                        }
                        style={{
                          padding:
                            "9px 14px",
                          borderRadius:
                            "9px",
                          border:
                            "1px solid #d7c6cf",
                          background:
                            usuario.active
                              ? "#fff8df"
                              : "#eef8f2",
                          color:
                            usuario.active
                              ? "#8a6800"
                              : "#236b45",
                          fontWeight:
                            "800",
                          cursor:
                            "pointer",
                        }}
                      >
                        {usuario.active
                          ? "⏸ Pausar"
                          : "▶ Reactivar"}
                      </button>

                      <button
                        type="button"
                        onClick={() =>
                          eliminarUsuario(
                            usuario
                          )
                        }
                        style={{
                          padding:
                            "9px 14px",
                          borderRadius:
                            "9px",
                          border:
                            "1px solid #efb8b8",
                          background:
                            "#fff3f3",
                          color:
                            "#a52d2d",
                          fontWeight:
                            "800",
                          cursor:
                            "pointer",
                        }}
                      >
                        🗑 Eliminar
                      </button>
                    </div>
                  )}
                </article>
              )
            )}
          </div>
        )}
    </div>
  );
}

const estiloCampo = {
  width: "100%",
  boxSizing: "border-box",
  padding: "11px 12px",
  borderRadius: "10px",
  border:
    "1px solid #d8cbd2",
  background: "#ffffff",
  color: "#2c2030",
  fontSize: "15px",
  outline: "none",
};