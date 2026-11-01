import {
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  obtenerUsuarios,
  obtenerNegociosActivos,
  obtenerSucursalesActivas,
  obtenerEmpleadasSinAcceso,
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

const ROLES_OPERATIVOS_PERSONAL = new Set([
  "encargada",
  "vendedora",
  "marketing",
  "chofer",
  "compras",
  "capturista",
  "consulta",
]);

const FORMULARIO_INICIAL = {
  nombre: "",
  correo: "",
  telefono: "",
  password: "",
  role: "",
  business_id: "",
  branch_id: "",
  empleado_id: "",
  active: true,
};

function rolSugeridoPorPuesto(puesto = "") {
  const texto = String(puesto).toLocaleLowerCase("es-MX");

  if (texto.includes("encargad")) return "encargada";
  if (texto.includes("marketing") || texto.includes("redes")) return "marketing";
  if (texto.includes("chofer") || texto.includes("repart")) return "chofer";
  if (texto.includes("compra")) return "compras";
  if (texto.includes("captur")) return "capturista";
  return "vendedora";
}

export default function CentroUsuarios({
  volverAlDashboard,
}) {
  const { usuario: usuarioActual, tienePermiso } = useUser();
  const esPropietaria = usuarioActual?.role === "owner";
  const puedeGestionarEstado =
    esPropietaria || tienePermiso("gestionar_estado_usuarios");
  const puedeGestionarPersonal =
    esPropietaria || tienePermiso("gestionar_personal_operativo");
  const [usuarios, setUsuarios] =
    useState([]);

  const [negocios, setNegocios] =
    useState([]);

  const [sucursales, setSucursales] =
    useState([]);

  const [empleadasSinAcceso, setEmpleadasSinAcceso] =
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
        registrosEmpleadas,
      ] = await Promise.all([
        obtenerNegociosActivos(),
        obtenerSucursalesActivas(),
        obtenerEmpleadasSinAcceso(),
      ]);

      setNegocios(
        registrosNegocios || []
      );

      setSucursales(
        registrosSucursales || []
      );

      setEmpleadasSinAcceso(
        registrosEmpleadas || []
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

  const empleadasDeSucursal = useMemo(() => {
    if (!formulario.branch_id) return [];

    return empleadasSinAcceso.filter(
      (empleada) =>
        empleada.branch_id === formulario.branch_id &&
        empleada.business_id === formulario.business_id
    );
  }, [empleadasSinAcceso, formulario.branch_id, formulario.business_id]);

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
        empleado_id: "",
      }));

      return;
    }

    if (name === "branch_id") {
      setFormulario((anterior) => ({
        ...anterior,
        branch_id: value,
        empleado_id: "",
      }));

      return;
    }

    if (name === "empleado_id") {
      const empleada = empleadasSinAcceso.find(
        (item) => item.id === value
      );

      setFormulario((anterior) => ({
        ...anterior,
        empleado_id: value,
        nombre: empleada?.nombre || anterior.nombre,
        role: empleada
          ? rolSugeridoPorPuesto(empleada.puesto)
          : anterior.role,
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
      await cargarCatalogos();

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

        {puedeGestionarPersonal ? (
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

                {ROLES
                  .filter((role) => esPropietaria || ROLES_OPERATIVOS_PERSONAL.has(role.value))
                  .map(
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

            <label
              style={{
                display: "grid",
                gap: "7px",
                color: "#51484d",
                fontWeight: "700",
              }}
            >
              Ficha de empleada

              <select
                name="empleado_id"
                value={formulario.empleado_id}
                onChange={actualizarCampo}
                disabled={!formulario.branch_id || cargandoCatalogos}
                style={estiloCampo}
              >
                <option value="">
                  {!formulario.branch_id
                    ? "Primero selecciona una sucursal"
                    : empleadasDeSucursal.length
                      ? "Selecciona a la empleada"
                      : "No hay fichas disponibles en esta sucursal"}
                </option>

                {empleadasDeSucursal.map((empleada) => (
                  <option key={empleada.id} value={empleada.id}>
                    {empleada.nombre} · {empleada.puesto || "Puesto pendiente"}
                  </option>
                ))}
              </select>

              <small style={{ color: "#766a70", fontWeight: 600 }}>
                Al elegirla, MONYS completa su nombre y rol y deja su acceso
                listo para registrar entrada, tareas y evidencias.
              </small>
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
