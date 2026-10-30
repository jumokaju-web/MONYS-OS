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
import { useUser } from "../../../context/UserContext";
import {
  guardarPermisosUsuario,
  obtenerConfiguracionPermisos,
} from "../../../services/permisosService";

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
  const { usuario: usuarioActual, tienePermiso } = useUser();
  const esPropietaria = usuarioActual?.role === "owner";
  const puedeGestionarEstado =
    esPropietaria || tienePermiso("gestionar_estado_usuarios");
  const [usuarios, setUsuarios] =
    useState([]);

  const [negocios, setNegocios] =
    useState([]);

  const [sucursales, setSucursales] =
    useState([]);

  const [filtroSucursal, setFiltroSucursal] =
    useState("todas");

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

  const [usuarioPermisos, setUsuarioPermisos] = useState(null);
  const [configuracionPermisos, setConfiguracionPermisos] = useState([]);
  const [permisosEditados, setPermisosEditados] = useState({});
  const [motivoPermisos, setMotivoPermisos] = useState("");
  const [cargandoEditorPermisos, setCargandoEditorPermisos] = useState(false);
  const [guardandoPermisos, setGuardandoPermisos] = useState(false);
  const [errorPermisos, setErrorPermisos] = useState("");

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

  const sucursalPorId = useMemo(
    () => new Map(sucursales.map((sucursal) => [sucursal.id, sucursal.name])),
    [sucursales]
  );

  const sucursalesConUsuarios = useMemo(() => {
    const conteos = new Map();

    usuarios.forEach((usuario) => {
      const clave = usuario.branch_id || "sin-sucursal";
      conteos.set(clave, (conteos.get(clave) || 0) + 1);
    });

    return [
      { id: "todas", name: "Todas", total: usuarios.length },
      ...sucursales
        .filter((sucursal) => conteos.has(sucursal.id))
        .map((sucursal) => ({
          id: sucursal.id,
          name: sucursal.name,
          total: conteos.get(sucursal.id),
        })),
      ...(conteos.has("sin-sucursal")
        ? [{ id: "sin-sucursal", name: "Sin sucursal", total: conteos.get("sin-sucursal") }]
        : []),
    ];
  }, [sucursales, usuarios]);

  const usuariosVisibles = useMemo(() => {
    if (filtroSucursal === "todas") return usuarios;
    if (filtroSucursal === "sin-sucursal") {
      return usuarios.filter((usuario) => !usuario.branch_id);
    }
    return usuarios.filter((usuario) => usuario.branch_id === filtroSucursal);
  }, [filtroSucursal, usuarios]);

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

async function abrirEditorPermisos(usuario) {
  try {
    setUsuarioPermisos(usuario);
    setConfiguracionPermisos([]);
    setPermisosEditados({});
    setMotivoPermisos("");
    setErrorPermisos("");
    setMensajeExito("");
    setCargandoEditorPermisos(true);

    const configuracion = await obtenerConfiguracionPermisos({
      usuarioId: usuario.id,
      role: usuario.role,
    });

    setConfiguracionPermisos(configuracion);
    setPermisosEditados(
      Object.fromEntries(
        configuracion.map((permiso) => [
          permiso.permission,
          permiso.effective,
        ])
      )
    );
  } catch (errorCarga) {
    console.error("Error cargando permisos del usuario:", errorCarga);
    setErrorPermisos(
      errorCarga.message || "No se pudieron cargar los permisos."
    );
  } finally {
    setCargandoEditorPermisos(false);
  }
}

function cerrarEditorPermisos() {
  if (guardandoPermisos) return;
  setUsuarioPermisos(null);
  setConfiguracionPermisos([]);
  setPermisosEditados({});
  setMotivoPermisos("");
  setErrorPermisos("");
}

function alternarPermiso(permission) {
  setErrorPermisos("");
  setPermisosEditados((anteriores) => ({
    ...anteriores,
    [permission]: !anteriores[permission],
  }));
}

async function guardarCambiosPermisos() {
  const cambios = configuracionPermisos
    .filter(
      (permiso) =>
        permisosEditados[permiso.permission] !== permiso.effective
    )
    .map((permiso) => ({
      permission: permiso.permission,
      allowed: permisosEditados[permiso.permission],
    }));

  if (!cambios.length) {
    setErrorPermisos("No hay cambios por guardar.");
    return;
  }

  if (motivoPermisos.trim().length < 4) {
    setErrorPermisos("Escribe un motivo breve para dejar registro del cambio.");
    return;
  }

  try {
    setGuardandoPermisos(true);
    setErrorPermisos("");

    await guardarPermisosUsuario({
      usuarioId: usuarioPermisos.id,
      cambios,
      motivo: motivoPermisos.trim(),
    });

    const nombre = usuarioPermisos.nombre;
    setUsuarioPermisos(null);
    setConfiguracionPermisos([]);
    setPermisosEditados({});
    setMotivoPermisos("");
    setMensajeExito(
      `Permisos de ${nombre} actualizados. Se aplicarán al recargar o volver a entrar.`
    );
  } catch (errorGuardado) {
    console.error("Error guardando permisos:", errorGuardado);
    setErrorPermisos(
      errorGuardado.message || "No fue posible guardar los permisos."
    );
  } finally {
    setGuardandoPermisos(false);
  }
}

 const formularioCompleto =
  Boolean(
    formulario.nombre.trim() &&
      (formulario.correo.trim() || formulario.telefono.trim()) &&
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

      {usuarioPermisos && (
        <EditorPermisos
          usuario={usuarioPermisos}
          configuracion={configuracionPermisos}
          valores={permisosEditados}
          motivo={motivoPermisos}
          error={errorPermisos}
          cargando={cargandoEditorPermisos}
          guardando={guardandoPermisos}
          onAlternar={alternarPermiso}
          onMotivo={setMotivoPermisos}
          onGuardar={guardarCambiosPermisos}
          onCerrar={cerrarEditorPermisos}
        />
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

        {esPropietaria ? (
          <button
            type="button"
            onClick={abrirFormulario}
            style={{
              padding: "11px 18px",
              borderRadius: "10px",
              border: "none",
              background: "#5e3048",
              color: "#ffffff",
              fontWeight: "800",
              cursor: "pointer",
            }}
          >
            ＋ Nuevo usuario
          </button>
        ) : (
          <span style={{ color: "#766a70", fontSize: "13px", fontWeight: 700 }}>
            Puedes activar o pausar personal; Mónica conserva permisos y eliminación
          </span>
        )}
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
              Correo (opcional si usa teléfono)

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
              Teléfono de acceso

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
            aria-label="Filtrar usuarios por sucursal"
            style={{
              display: "flex",
              gap: "8px",
              overflowX: "auto",
              paddingBottom: "12px",
              marginBottom: "4px",
            }}
          >
            {sucursalesConUsuarios.map((sucursal) => (
              <button
                key={sucursal.id}
                type="button"
                aria-pressed={filtroSucursal === sucursal.id}
                onClick={() => setFiltroSucursal(sucursal.id)}
                style={{
                  flex: "none",
                  padding: "10px 14px",
                  borderRadius: "999px",
                  border: filtroSucursal === sucursal.id
                    ? "1px solid #5e3048"
                    : "1px solid #d8cbd2",
                  background: filtroSucursal === sucursal.id ? "#5e3048" : "#ffffff",
                  color: filtroSucursal === sucursal.id ? "#ffffff" : "#5e3048",
                  fontWeight: 800,
                  cursor: "pointer",
                }}
              >
                {sucursal.name} · {sucursal.total}
              </button>
            ))}
          </div>
        )}

      {!cargando &&
        !error &&
        usuarios.length > 0 &&
        usuariosVisibles.length === 0 && (
          <div style={{ padding: "28px", textAlign: "center", color: "#766a70" }}>
            No hay usuarios en esta sucursal.
          </div>
        )}

      {!cargando &&
        !error &&
        usuariosVisibles.length > 0 && (
          <div
            style={{
              display: "grid",
              gap: "14px",
            }}
          >
            {usuariosVisibles.map(
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
                        ? sucursalPorId.get(usuario.branch_id) || "Asignada"
                        : "Todas / No aplica"}
                    </span>
                  </div>

                  {puedeGestionarEstado && usuario.role !==
                    "owner" && (
                    <div
                      style={{
                        display: "flex",
                        gap: "10px",
                        flexWrap: "wrap",
                        marginTop: "18px",
                      }}
                    >
                      {esPropietaria && <button
                          type="button"
                          onClick={() => abrirEditorPermisos(usuario)}
                          style={{
                            padding: "9px 14px",
                            borderRadius: "9px",
                            border: "1px solid #bba2af",
                            background: "#f8f0f4",
                            color: "#5e3048",
                            fontWeight: "800",
                            cursor: "pointer",
                          }}
                        >
                          🔐 Editar permisos
                        </button>}
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

                      {esPropietaria && <button
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
                      </button>}
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

function EditorPermisos({
  usuario,
  configuracion,
  valores,
  motivo,
  error,
  cargando,
  guardando,
  onAlternar,
  onMotivo,
  onGuardar,
  onCerrar,
}) {
  return (
    <section
      style={{
        padding: "22px",
        marginBottom: "20px",
        borderRadius: "16px",
        background: "#ffffff",
        border: "2px solid #d7c6cf",
        boxShadow: "0 10px 28px rgba(94,48,72,0.10)",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          gap: "14px",
          flexWrap: "wrap",
        }}
      >
        <div>
          <h2 style={{ margin: 0, color: "#2c2030" }}>
            🔐 Permisos de {usuario.nombre}
          </h2>
          <p style={{ margin: "7px 0 0", color: "#766a70" }}>
            Activa solamente las secciones que esta persona debe usar.
          </p>
        </div>
        <button
          type="button"
          onClick={onCerrar}
          disabled={guardando}
          style={{
            padding: "9px 13px",
            borderRadius: "9px",
            border: "1px solid #d7c6cf",
            background: "#ffffff",
            color: "#5e3048",
            fontWeight: "800",
            cursor: guardando ? "not-allowed" : "pointer",
          }}
        >
          ✕ Cerrar
        </button>
      </div>

      {error && (
        <div
          style={{
            marginTop: "16px",
            padding: "12px 14px",
            borderRadius: "10px",
            background: "#fff4f4",
            border: "1px solid #efc0c0",
            color: "#9b3030",
            fontWeight: "700",
          }}
        >
          {error}
        </div>
      )}

      {cargando ? (
        <p style={{ color: "#766a70" }}>Cargando permisos...</p>
      ) : (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
            gap: "12px",
            marginTop: "18px",
          }}
        >
          {configuracion.map((permiso) => {
            const activo = Boolean(valores[permiso.permission]);
            return (
              <button
                key={permiso.permission}
                type="button"
                role="switch"
                aria-checked={activo}
                onClick={() => onAlternar(permiso.permission)}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  gap: "14px",
                  padding: "15px",
                  borderRadius: "12px",
                  border: activo
                    ? "1px solid #82c49f"
                    : "1px solid #e1d5db",
                  background: activo ? "#eef8f2" : "#faf7f8",
                  color: "#2c2030",
                  textAlign: "left",
                  cursor: "pointer",
                }}
              >
                <span>
                  <strong style={{ display: "block" }}>{permiso.label}</strong>
                  <small style={{ color: "#766a70" }}>
                    {permiso.description}
                  </small>
                </span>
                <span
                  style={{
                    minWidth: "88px",
                    padding: "7px 9px",
                    borderRadius: "999px",
                    background: activo ? "#2f8657" : "#a34a4a",
                    color: "#ffffff",
                    fontSize: "12px",
                    fontWeight: "900",
                    textAlign: "center",
                  }}
                >
                  {activo ? "ACTIVADO" : "SIN ACCESO"}
                </span>
              </button>
            );
          })}
        </div>
      )}

      {!cargando && (
        <div style={{ marginTop: "18px" }}>
          <label
            style={{
              display: "grid",
              gap: "7px",
              color: "#51484d",
              fontWeight: "700",
            }}
          >
            Motivo del cambio
            <input
              value={motivo}
              onChange={(evento) => onMotivo(evento.target.value)}
              placeholder="Ej. Nueva responsabilidad de flotilla"
              style={estiloCampo}
            />
          </label>
          <button
            type="button"
            onClick={onGuardar}
            disabled={guardando}
            style={{
              marginTop: "14px",
              padding: "11px 18px",
              borderRadius: "10px",
              border: "none",
              background: guardando ? "#d8cbd2" : "#5e3048",
              color: "#ffffff",
              fontWeight: "900",
              cursor: guardando ? "not-allowed" : "pointer",
            }}
          >
            {guardando ? "Guardando..." : "Guardar permisos"}
          </button>
        </div>
      )}
    </section>
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
