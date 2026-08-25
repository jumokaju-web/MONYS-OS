import {
  useState,
} from "react";

import TarjetaIndicador from "../shared/TarjetaIndicador";

import {
  crearEmpleadoRH,
  darDeBajaEmpleadoRH,
  reactivarEmpleadoRH,
  actualizarEmpleadoRH,
  eliminarEmpleadoRH,
} from "../../services/empleadosRHService";

import {
  obtenerPuestosRH,
} from "../../services/puestosRHService";

function convertirNumero(valor) {
  const numero = Number(valor);

  return Number.isFinite(numero)
    ? numero 
    : 0;
}

function formatearDinero(valor) {
  return new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency: "MXN",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(convertirNumero(valor));
}

function obtenerEstiloPrioridad(prioridad) {
  if (prioridad === "CRITICA") {
    return {
      icono: "🔴",
      fondo: "#fff0f0",
      borde: "#efb8b8",
      color: "#a52d2d",
    };
  }

  if (prioridad === "ALTA") {
    return {
      icono: "🟠",
      fondo: "#fff5ed",
      borde: "#efbd84",
      color: "#9a5416",
    };
  }

  return {
    icono: "🟡",
    fondo: "#fffbea",
    borde: "#e4d17d",
    color: "#806600",
  };
}

const formularioInicial = {
  nombre: "",
  puesto: "",
  fechaIngreso: "",
  sueldoBase: "",
  periodicidadPago: "",
  tipoContrato: "",
};

export default function DirectorRH({
  analisisRH,
  organizationId = null,
  businessId = null,
  branchId = null,
  empleados = [],
  onEmpleadoCreado = null,
}) {
  const [
    mostrarFormulario,
    setMostrarFormulario,
  ] = useState(false);

  const [
    formularioEmpleado,
    setFormularioEmpleado,
  ] = useState(formularioInicial);

  const [
    guardandoEmpleado,
    setGuardandoEmpleado,
  ] = useState(false);

  const [
    errorEmpleado,
    setErrorEmpleado,
  ] = useState("");

  const [
    mensajeEmpleado,
    setMensajeEmpleado,
  ] = useState("");

  const [
  empleadoAccionesAbierto,
  setEmpleadoAccionesAbierto,
] = useState(null);

const [
  empleadoEditando,
  setEmpleadoEditando,
] = useState(null);

  if (!analisisRH) {
    return null;
  }

  const {
    estadoGeneral = "RH pendiente de análisis",
    tieneDatosRH = false,
    totalEmpleados = 0,
    empleadosActivos = 0,
    empleadosInactivos = 0,
    costoNomina = 0,
    incidenciasAbiertas = 0,
    incidenciasCriticas = 0,
    capacitacionesPendientes = 0,
    vacantesAbiertas = 0,
    estadoContratacion = "SIN_DATOS",
    alertas = [],
    recomendaciones = [],
    accionesPrioritarias = [],
    estadoFuentes = {},
  } = analisisRH;

  const listaAlertas =
    Array.isArray(alertas)
      ? alertas
      : [];

  const listaRecomendaciones =
    Array.isArray(recomendaciones)
      ? recomendaciones
      : [];

  const listaAcciones =
    Array.isArray(accionesPrioritarias)
      ? accionesPrioritarias
      : [];

    const listaEmpleados =
  Array.isArray(empleados)
    ? empleados
    : [];

    const puestosDisponibles =
  obtenerPuestosRH("general");

  const empleadosConectados =
    estadoFuentes?.empleados === true;

  const nominaConectada =
    estadoFuentes?.nomina === true;

  const incidenciasConectadas =
    estadoFuentes?.incidencias === true;

  const capacitacionesConectadas =
    estadoFuentes?.capacitaciones === true;

  const vacantesConectadas =
    estadoFuentes?.vacantes === true;

  const requiereAtencion =
    estadoGeneral
      .toUpperCase()
      .includes("INTERVENCIÓN") ||
    estadoGeneral
      .toUpperCase()
      .includes("INTERVENCION") ||
    incidenciasCriticas > 0;

  function actualizarCampo(
    campo,
    valor
  ) {
    setFormularioEmpleado(
      (actual) => ({
        ...actual,
        [campo]: valor,
      })
    );
  }

  function cerrarFormulario() {
    if (guardandoEmpleado) {
      return;
    }

    setMostrarFormulario(false);
    setFormularioEmpleado(
      formularioInicial
    );
    setErrorEmpleado("");
  }

   function comenzarEdicionEmpleado(
  empleado
) {
  setEmpleadoEditando(
    empleado
  );

  setFormularioEmpleado({
    nombre:
      empleado?.nombre || "",

    puesto:
      empleado?.puesto || "",

    fechaIngreso:
      empleado?.fecha_ingreso || "",

    sueldoBase:
      empleado?.sueldo_base ?? "",

    periodicidadPago:
      empleado?.periodicidad_pago || "",

    tipoContrato:
      empleado?.tipo_contrato || "",
  });

  setMostrarFormulario(
    true
  );

  setEmpleadoAccionesAbierto(
    null
  );

  setErrorEmpleado("");
  setMensajeEmpleado("");
}

  async function guardarEmpleado(
    evento
  ) {
    evento.preventDefault();

    setErrorEmpleado("");
    setMensajeEmpleado("");

    if (
      !formularioEmpleado.nombre.trim()
    ) {
      setErrorEmpleado(
        "Escribe el nombre del empleado."
      );
      return;
    }

 
  
    if (!branchId) {
      setErrorEmpleado(
        "No se encontró la sucursal actual."
      );
      return;
    }

    try {
      setGuardandoEmpleado(true);

     if (empleadoEditando?.id) {
  await actualizarEmpleadoRH({
    empleadoId:
      empleadoEditando.id,

    nombre:
      formularioEmpleado.nombre,

    puesto:
      formularioEmpleado.puesto,

    fechaIngreso:
      formularioEmpleado.fechaIngreso,

    sueldoBase:
      formularioEmpleado.sueldoBase,

    periodicidadPago:
      formularioEmpleado
        .periodicidadPago,

    tipoContrato:
      formularioEmpleado.tipoContrato,
  });
} else {
  await crearEmpleadoRH({
    organizationId,
    businessId,
    branchId,

    nombre:
      formularioEmpleado.nombre,

    puesto:
      formularioEmpleado.puesto,

    fechaIngreso:
      formularioEmpleado.fechaIngreso,

    sueldoBase:
      formularioEmpleado.sueldoBase,

    periodicidadPago:
      formularioEmpleado
        .periodicidadPago,

    tipoContrato:
      formularioEmpleado.tipoContrato,
  });
}

      setFormularioEmpleado(
        formularioInicial
      );

      setEmpleadoEditando(null);setEmpleadoEditando(null);

      setMostrarFormulario(false);

      setMensajeEmpleado(
        "Empleado registrado correctamente."
      );

      if (
        typeof onEmpleadoCreado ===
        "function"
      ) {
        await onEmpleadoCreado();
      }
    } catch (error) {
      console.error(
        "Error al guardar empleado desde RH:",
        error
      );

      setErrorEmpleado(
        error?.message ||
          "No fue posible registrar al empleado."
      );
    } finally {
      setGuardandoEmpleado(false);
    }
  }


   async function manejarBajaEmpleado(
  empleado
) {


  if (!empleado?.id) {
    return;
  }

  const confirmar =
    window.confirm(
      `¿Dar de baja a ${
        empleado.nombre ||
        "este empleado"
      }?`
    );

  if (!confirmar) {
    return;
  }

  try {
    await darDeBajaEmpleadoRH(
      empleado.id
    );

    setEmpleadoAccionesAbierto(
      null
    );

    if (
      typeof onEmpleadoCreado ===
      "function"
    ) {
      await onEmpleadoCreado();
    }
  } catch (error) {
    console.error(
      "Error al dar de baja empleado:",
      error
    );
  }
}

async function manejarReactivarEmpleado(
  empleado
) {


  if (!empleado?.id) {
    return;
  }

  const confirmar =
    window.confirm(
      `¿Reactivar a ${
        empleado.nombre ||
        "este empleado"
      }?`
    );

  if (!confirmar) {
    return;
  }

  try {
    await reactivarEmpleadoRH(
      empleado.id
    );

    setEmpleadoAccionesAbierto(
      null
    );

    if (
      typeof onEmpleadoCreado ===
      "function"
    ) {
      await onEmpleadoCreado();
    }
  } catch (error) {
    console.error(
      "Error al reactivar empleado:",
      error
    );
  }
}

async function manejarReactivarEmpleado(
  empleado
) {
  // toda la lógica de reactivar
}

async function manejarEliminarEmpleado(
  empleado
) {
  if (!empleado?.id) {
    return;
  }

  const confirmar =
    window.confirm(
      `¿Eliminar definitivamente a ${
        empleado.nombre ||
        "este empleado"
      }?\n\nEsta acción no se puede deshacer.`
    );

  if (!confirmar) {
    return;
  }

  try {
    await eliminarEmpleadoRH(
      empleado.id
    );

    setEmpleadoAccionesAbierto(
      null
    );

    if (
      typeof onEmpleadoCreado ===
      "function"
    ) {
      await onEmpleadoCreado();
    }
  } catch (error) {
    console.error(
      "Error al eliminar empleado:",
      error
    );
  }
}

  return (
    <section
      style={{
        marginTop: "30px",
        padding: "28px",
        borderRadius: "22px",
        background:
          "linear-gradient(135deg, #ffffff 0%, #f7f3ff 100%)",
        border: "1px solid #d9c7ef",
        boxShadow:
          "0 12px 35px rgba(110, 75, 160, 0.10)",
      }}
    >
      {/* ENCABEZADO */}

      <div
        style={{
          display: "flex",
          justifyContent:
            "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: "15px",
        }}
      >
        <div>
          <p
            style={{
              margin: "0 0 7px",
              color: "#7650a8",
              fontWeight: "800",
              letterSpacing: "1px",
            }}
          >
            MONYS OS · DIRECTOR RH
          </p>

          <h2
            style={{
              margin: 0,
              fontSize: "28px",
            }}
          >
            👥 Informe de Recursos Humanos IA
          </h2>
        </div>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "10px",
            flexWrap: "wrap",
          }}
        >
          <button
            type="button"
            onClick={() => {
              setMostrarFormulario(
                (actual) => !actual
              );
              setErrorEmpleado("");
              setMensajeEmpleado("");
            }}
            style={{
              padding: "11px 18px",
              borderRadius: "10px",
              border: "none",
              backgroundColor:
                "#7650a8",
              color: "#ffffff",
              cursor: "pointer",
              fontWeight: "800",
              fontSize: "15px",
            }}
          >
            + Nuevo empleado
          </button>

          <div
            style={{
              padding: "11px 17px",
              borderRadius: "999px",
              backgroundColor:
                requiereAtencion
                  ? "#fff0f0"
                  : tieneDatosRH
                  ? "#eef9f2"
                  : "#fffbea",
              border:
                requiereAtencion
                  ? "1px solid #efb8b8"
                  : tieneDatosRH
                  ? "1px solid #b8e5ca"
                  : "1px solid #e4d17d",
              color:
                requiereAtencion
                  ? "#a52d2d"
                  : tieneDatosRH
                  ? "#207a4a"
                  : "#806600",
              fontWeight: "800",
            }}
          >
            {requiereAtencion
              ? "🔴 "
              : tieneDatosRH
              ? "🟢 "
              : "🟡 "}

            {estadoGeneral}
          </div>
        </div>
      </div>

      {/* MENSAJE DE ÉXITO */}

      {mensajeEmpleado && (
        <div
          style={{
            marginTop: "18px",
            padding: "13px 16px",
            borderRadius: "12px",
            backgroundColor: "#eef9f2",
            border:
              "1px solid #b8e5ca",
            color: "#207a4a",
            fontWeight: "700",
          }}
        >
          ✅ {mensajeEmpleado}
        </div>
      )}

      {/* FORMULARIO NUEVO EMPLEADO */}

      {mostrarFormulario && (
        <form
          onSubmit={guardarEmpleado}
          style={{
            marginTop: "22px",
            padding: "22px",
            borderRadius: "18px",
            backgroundColor: "#ffffff",
            border:
              "1px solid #d9c7ef",
            boxShadow:
              "0 8px 24px rgba(110, 75, 160, 0.08)",
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent:
                "space-between",
              alignItems: "center",
              gap: "12px",
              marginBottom: "18px",
            }}
          >
            <div>
              <h3
                style={{
                  margin: 0,
                }}
              >
                👤 Nuevo empleado
              </h3>

              <p
                style={{
                  margin:
                    "6px 0 0",
                  color: "#746b71",
                }}
              >
                Registra personal sin entrar
                a Supabase.
              </p>
            </div>

            <button
              type="button"
              onClick={
                cerrarFormulario
              }
              style={{
                border: "none",
                background:
                  "transparent",
                cursor: "pointer",
                fontSize: "22px",
              }}
            >
              ✕
            </button>
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns:
                "repeat(auto-fit, minmax(220px, 1fr))",
              gap: "16px",
            }}
          >
      <label>
  <strong>
    Nombre *
  </strong>

  <input
    type="text"
    value={
      formularioEmpleado.nombre
    }
    onChange={(evento) =>
      actualizarCampo(
        "nombre",
        evento.target.value
      )
    }
    placeholder="Nombre completo"
    style={{
      width: "100%",
      marginTop: "7px",
      padding: "11px",
      borderRadius: "9px",
      border:
        "1px solid #d8ced4",
      boxSizing: "border-box",
    }}
  />
</label>

         <label>
  <strong>
    Puesto
  </strong>

  <select
    value={
      formularioEmpleado.puesto
    }
    onChange={(evento) =>
      actualizarCampo(
        "puesto",
        evento.target.value
      )
    }
    style={{
      width: "100%",
      marginTop: "7px",
      padding: "11px",
      borderRadius: "9px",
      border:
        "1px solid #d8ced4",
      backgroundColor: "#ffffff",
      boxSizing: "border-box",
    }}
  >
    <option value="">
      Seleccionar puesto
    </option>

    {puestosDisponibles.map(
      (puesto) => (
        <option
          key={puesto}
          value={puesto}
        >
          {puesto}
        </option>
      )
    )}
  </select>
</label>

            <label>
              <strong>
                Fecha de ingreso
              </strong>

              <input
                type="date"
                value={
                  formularioEmpleado
                    .fechaIngreso
                }
                onChange={(evento) =>
                  actualizarCampo(
                    "fechaIngreso",
                    evento.target.value
                  )
                }
                style={{
                  width: "100%",
                  marginTop: "7px",
                  padding: "11px",
                  borderRadius: "9px",
                  border:
                    "1px solid #d8ced4",
                  boxSizing:
                    "border-box",
                }}
              />
            </label>

            <label>
              <strong>
                Sueldo base
              </strong>

              <input
                type="number"
                min="0"
                step="0.01"
                value={
                  formularioEmpleado
                    .sueldoBase
                }
                onChange={(evento) =>
                  actualizarCampo(
                    "sueldoBase",
                    evento.target.value
                  )
                }
                placeholder="0.00"
                style={{
                  width: "100%",
                  marginTop: "7px",
                  padding: "11px",
                  borderRadius: "9px",
                  border:
                    "1px solid #d8ced4",
                  boxSizing:
                    "border-box",
                }}
              />
            </label>

            <label>
              <strong>
                Periodicidad de pago
              </strong>

              <select
                value={
                  formularioEmpleado
                    .periodicidadPago
                }
                onChange={(evento) =>
                  actualizarCampo(
                    "periodicidadPago",
                    evento.target.value
                  )
                }
                style={{
                  width: "100%",
                  marginTop: "7px",
                  padding: "11px",
                  borderRadius: "9px",
                  border:
                    "1px solid #d8ced4",
                  backgroundColor:
                    "#ffffff",
                  boxSizing:
                    "border-box",
                }}
              >
                <option value="">
                  Seleccionar
                </option>

                <option value="semanal">
                  Semanal
                </option>

                <option value="quincenal">
                  Quincenal
                </option>

                <option value="mensual">
                  Mensual
                </option>
              </select>
            </label>

            <label>
              <strong>
                Tipo de contrato
              </strong>

              <select
                value={
                  formularioEmpleado
                    .tipoContrato
                }
                onChange={(evento) =>
                  actualizarCampo(
                    "tipoContrato",
                    evento.target.value
                  )
                }
                style={{
                  width: "100%",
                  marginTop: "7px",
                  padding: "11px",
                  borderRadius: "9px",
                  border:
                    "1px solid #d8ced4",
                  backgroundColor:
                    "#ffffff",
                  boxSizing:
                    "border-box",
                }}
              >
                <option value="">
                  Seleccionar
                </option>

                <option value="indeterminado">
                  Indeterminado
                </option>

                <option value="determinado">
                  Determinado
                </option>

                <option value="temporal">
                  Temporal
                </option>

                <option value="prueba">
                  Periodo de prueba
                </option>
              </select>
            </label>
          </div>

          {errorEmpleado && (
            <div
              style={{
                marginTop: "16px",
                padding: "12px",
                borderRadius: "10px",
                backgroundColor:
                  "#fff0f0",
                border:
                  "1px solid #efb8b8",
                color: "#a52d2d",
                fontWeight: "700",
              }}
            >
              ⚠️ {errorEmpleado}
            </div>
          )}

          <div
            style={{
              display: "flex",
              justifyContent:
                "flex-end",
              gap: "10px",
              marginTop: "20px",
              flexWrap: "wrap",
            }}
          >
            <button
              type="button"
              onClick={
                cerrarFormulario
              }
              disabled={
                guardandoEmpleado
              }
              style={{
                padding: "11px 18px",
                borderRadius: "10px",
                border:
                  "1px solid #d8ced4",
                backgroundColor:
                  "#ffffff",
                cursor:
                  guardandoEmpleado
                    ? "not-allowed"
                    : "pointer",
                fontWeight: "700",
              }}
            >
              Cancelar
            </button>

            <button
              type="submit"
              disabled={
                guardandoEmpleado
              }
              style={{
                padding: "11px 20px",
                borderRadius: "10px",
                border: "none",
                backgroundColor:
                  guardandoEmpleado
                    ? "#c5b6cd"
                    : "#7650a8",
                color: "#ffffff",
                cursor:
                  guardandoEmpleado
                    ? "not-allowed"
                    : "pointer",
                fontWeight: "800",
              }}
            >
              {guardandoEmpleado
                ? "Guardando..."
                : "Guardar empleado"}
            </button>
          </div>
        </form>
      )}

      {/* INDICADORES */}

      <div
        style={{
          display: "grid",
          gridTemplateColumns:
            "repeat(auto-fit, minmax(210px, 1fr))",
          gap: "16px",
          marginTop: "24px",
        }}
      >
        <TarjetaIndicador
          icono="👥"
          titulo="Personal registrado"
          valor={
            empleadosConectados
              ? convertirNumero(
                  totalEmpleados
                ).toLocaleString("es-MX")
              : "Pendiente"
          }
        />

        <TarjetaIndicador
          icono="✅"
          titulo="Empleados activos"
          valor={
            empleadosConectados
              ? convertirNumero(
                  empleadosActivos
                ).toLocaleString("es-MX")
              : "Pendiente"
          }
        />

        <TarjetaIndicador
          icono="⛔"
          titulo="Empleados inactivos"
          valor={
            empleadosConectados
              ? convertirNumero(
                  empleadosInactivos
                ).toLocaleString("es-MX")
              : "Pendiente"
          }
        />

        <TarjetaIndicador
          icono="💰"
          titulo="Costo de nómina"
          valor={
            nominaConectada
              ? formatearDinero(
                  costoNomina
                )
              : "Pendiente"
          }
        />

        <TarjetaIndicador
          icono="⚠️"
          titulo="Incidencias abiertas"
          valor={
            incidenciasConectadas
              ? convertirNumero(
                  incidenciasAbiertas
                ).toLocaleString("es-MX")
              : "Pendiente"
          }
        />

        <TarjetaIndicador
          icono="🔴"
          titulo="Incidencias críticas"
          valor={
            incidenciasConectadas
              ? convertirNumero(
                  incidenciasCriticas
                ).toLocaleString("es-MX")
              : "Pendiente"
          }
        />

        <TarjetaIndicador
          icono="🎓"
          titulo="Capacitaciones pendientes"
          valor={
            capacitacionesConectadas
              ? convertirNumero(
                  capacitacionesPendientes
                ).toLocaleString("es-MX")
              : "Pendiente"
          }
        />

        <TarjetaIndicador
          icono="🧑‍💼"
          titulo="Vacantes abiertas"
          valor={
            vacantesConectadas
              ? convertirNumero(
                  vacantesAbiertas
                ).toLocaleString("es-MX")
              : "Pendiente"
          }
        />
      </div>

       {/* LISTA DE EMPLEADOS */}

<div
  style={{
    marginTop: "26px",
    padding: "22px",
    borderRadius: "18px",
    backgroundColor: "#ffffff",
    border: "1px solid #ddd0ee",
  }}
>
  <h3
    style={{
      marginTop: 0,
      marginBottom: "18px",
      textAlign: "center",
    }}
  >
    👥 Personal
  </h3>

  {listaEmpleados.length > 0 ? (
    <div
      style={{
        display: "grid",
        gap: "12px",
      }}
    >
      {listaEmpleados.map(
        (empleado) => (
          <div
            key={empleado.id}
            style={{
              padding: "14px 16px",
              borderRadius: "12px",
              border:
                "1px solid #e5dce9",
              display: "flex",
              justifyContent:
                "space-between",
              alignItems: "center",
              gap: "12px",
              flexWrap: "wrap",
            }}
          >
            <div>
              <strong>
                {empleado.nombre ||
                  "Sin nombre"}
              </strong>

              <div
                style={{
                  marginTop: "4px",
                  color: "#746b71",
                }}
              >
                {empleado.puesto ||
                  "Puesto pendiente"}
              </div>
            </div>

          <div
  style={{
    display: "flex",
    alignItems: "center",
    gap: "10px",
    position: "relative",
    flexWrap: "wrap",
  }}
>
  <div
    style={{
      fontWeight: "700",
      color:
        empleado.active === false
          ? "#a52d2d"
          : "#207a4a",
    }}
  >
    {empleado.active === false
      ? "⛔ Inactivo"
      : "✅ Activo"}
  </div>

  <button
    type="button"
    onClick={() =>
      setEmpleadoAccionesAbierto(
        empleadoAccionesAbierto === empleado.id
          ? null
          : empleado.id
      )
    }
    style={{
      padding: "8px 12px",
      borderRadius: "8px",
      border: "1px solid #d9c7ef",
      backgroundColor: "#ffffff",
      cursor: "pointer",
      fontWeight: "700",
    }}
  >
    Acciones
  </button>

  {empleadoAccionesAbierto === empleado.id && (
    <div
      style={{
        position: "absolute",
        top: "42px",
        right: 0,
        zIndex: 10,
        minWidth: "170px",
        padding: "8px",
        borderRadius: "10px",
        backgroundColor: "#ffffff",
        border: "1px solid #ddd0ee",
        boxShadow:
          "0 8px 20px rgba(0, 0, 0, 0.12)",
      }}
    >
     
     <button
  type="button"
  onClick={() =>
    comenzarEdicionEmpleado(
      empleado
    )
  }
  style={{
    width: "100%",
    padding: "9px 10px",
    border: "none",
    borderRadius: "7px",
    backgroundColor: "#f4effb",
    color: "#7650a8",
    cursor: "pointer",
    fontWeight: "700",
    textAlign: "left",
    marginBottom: "6px",
  }}
>
  ✏️ Editar
</button>

      {empleado.active !== false && (
        <button
          type="button"
          onClick={() =>
            manejarBajaEmpleado(empleado)
          }
          style={{
            width: "100%",
            padding: "9px 10px",
            border: "none",
            borderRadius: "7px",
            backgroundColor: "#fff0f0",
            color: "#a52d2d",
            cursor: "pointer",
            fontWeight: "700",
            textAlign: "left",
          }}
        >
          ⛔ Dar de baja
        </button>
      )}

      {empleado.active === false && (
  <button
    type="button"
    onClick={() =>
      manejarReactivarEmpleado(
        empleado
      )
    }
    style={{
      width: "100%",
      padding: "9px 10px",
      border: "none",
      borderRadius: "7px",
      backgroundColor: "#eef9f2",
      color: "#207a4a",
      cursor: "pointer",
      fontWeight: "700",
      textAlign: "left",
    }}
  >
    ✅ Reactivar
  </button>
)}

   <button
  type="button"
  onClick={() =>
    manejarEliminarEmpleado(
      empleado
    )
  }
  style={{
    width: "100%",
    padding: "9px 10px",
    border: "none",
    borderRadius: "7px",
    backgroundColor: "#fff4f4",
    color: "#b42318",
    cursor: "pointer",
    fontWeight: "700",
    textAlign: "left",
    marginTop: "6px",
  }}
>
  🗑️ Eliminar definitivamente
</button>

    </div>
  )}
</div>
          </div>
        )
      )}
    </div>
  ) : (
    <p
      style={{
        margin: 0,
        textAlign: "center",
        color: "#746b71",
      }}
    >
      Todavía no hay empleados registrados.
    </p>
  )}
</div>

      {/* DIAGNÓSTICO */}

      <div
        style={{
          marginTop: "26px",
          padding: "20px",
          borderRadius: "16px",
          backgroundColor:
            tieneDatosRH
              ? "#f5fbf7"
              : "#fffbea",
          border:
            tieneDatosRH
              ? "1px solid #ccebd5"
              : "1px solid #e4d17d",
          textAlign: "center",
        }}
      >
        <h3
          style={{
            margin: "0 0 8px",
          }}
        >
          🧠 Diagnóstico RH
        </h3>

        {tieneDatosRH ? (
          <p
            style={{
              margin: 0,
              lineHeight: "1.6",
            }}
          >
            MONYS OS está analizando
            personal, incidencias,
            capacitación, contratación y
            costo laboral para detectar
            riesgos y necesidades
            operativas.
          </p>
        ) : (
          <p
            style={{
              margin: 0,
              lineHeight: "1.6",
            }}
          >
            El Director RH IA ya está
            preparado, pero todavía{" "}
            <strong>
              no tiene conectados los datos
              operativos reales de Recursos
              Humanos.
            </strong>
          </p>
        )}
      </div>

      {/* CONTRATACIÓN */}

      <div
        style={{
          marginTop: "24px",
          padding: "20px",
          borderRadius: "16px",
          backgroundColor: "#f7f4ff",
          border:
            "1px solid #d9c7ef",
          textAlign: "center",
        }}
      >
        <h3
          style={{
            margin: "0 0 8px",
          }}
        >
          🧑‍💼 Estado de contratación
        </h3>

        <strong>
          {estadoContratacion ===
          "NO_AUTORIZADA_FINANCIERAMENTE"
            ? "🔴 No autorizada financieramente"
            : estadoContratacion ===
              "EVALUAR_CON_FINANZAS"
            ? "🟡 Evaluar con Finanzas"
            : estadoContratacion ===
              "SIN_VACANTES"
            ? "🟢 Sin vacantes abiertas"
            : "⚪ Pendiente de información"}
        </strong>
      </div>

      {/* ACCIONES PRIORITARIAS */}

      <div
        style={{
          marginTop: "24px",
          padding: "22px",
          borderRadius: "18px",
          backgroundColor: "#ffffff",
          border:
            "1px solid #ddd0ee",
        }}
      >
        <h3
          style={{
            textAlign: "center",
            marginTop: 0,
          }}
        >
          🎯 Acciones prioritarias de RH
        </h3>

        <div
          style={{
            display: "grid",
            gap: "12px",
            marginTop: "16px",
          }}
        >
          {listaAcciones.length > 0 ? (
            listaAcciones.map(
              (accion, index) => {
                const estilo =
                  obtenerEstiloPrioridad(
                    accion?.prioridad
                  );

                return (
                  <article
                    key={`accion-rh-${index}`}
                    style={{
                      padding: "16px",
                      borderRadius: "14px",
                      backgroundColor:
                        estilo.fondo,
                      border: `1px solid ${estilo.borde}`,
                    }}
                  >
                    <strong
                      style={{
                        color:
                          estilo.color,
                      }}
                    >
                      {estilo.icono}{" "}
                      {accion?.titulo ||
                        "Acción RH"}
                    </strong>

                    <p
                      style={{
                        margin: "8px 0 0",
                        lineHeight: "1.6",
                      }}
                    >
                      {accion?.descripcion ||
                        "Sin descripción disponible."}
                    </p>
                  </article>
                );
              }
            )
          ) : (
            <p
              style={{
                margin: 0,
                textAlign: "center",
              }}
            >
              No hay acciones prioritarias
              disponibles por el momento.
            </p>
          )}
        </div>
      </div>

      {/* ALERTAS */}

      <div
        style={{
          marginTop: "24px",
          padding: "22px",
          borderRadius: "18px",
          backgroundColor: "#fff8f3",
          border:
            "1px solid #efd0b8",
        }}
      >
        <h3
          style={{
            textAlign: "center",
            marginTop: 0,
          }}
        >
          ⚠️ Alertas de Recursos Humanos
        </h3>

        {listaAlertas.length > 0 ? (
          listaAlertas.map(
            (alerta, index) => (
              <div
                key={`alerta-rh-${index}`}
                style={{
                  marginBottom: "15px",
                  lineHeight: "1.6",
                  textAlign: "center",
                }}
              >
                <strong>
                  {alerta?.titulo ||
                    "Alerta RH"}
                </strong>

                <div
                  style={{
                    marginTop: "5px",
                  }}
                >
                  {alerta?.descripcion ||
                    "Sin descripción disponible."}
                </div>
              </div>
            )
          )
        ) : (
          <p
            style={{
              margin: 0,
              textAlign: "center",
            }}
          >
            No hay alertas de RH por el
            momento.
          </p>
        )}
      </div>

      {/* RECOMENDACIONES */}

      <div
        style={{
          marginTop: "24px",
          padding: "22px",
          borderRadius: "18px",
          backgroundColor: "#f8f4ff",
          border:
            "1px solid #d9c7ef",
        }}
      >
        <h3
          style={{
            textAlign: "center",
            marginTop: 0,
            color: "#6f45a1",
          }}
        >
          💡 Recomendaciones de RH
        </h3>

        {listaRecomendaciones.length > 0 ? (
          listaRecomendaciones.map(
            (recomendacion, index) => (
              <div
                key={`recomendacion-rh-${index}`}
                style={{
                  display: "flex",
                  gap: "10px",
                  marginBottom: "12px",
                  lineHeight: "1.6",
                }}
              >
                <span>💡</span>

                <span>
                  {typeof recomendacion ===
                  "string"
                    ? recomendacion
                    : recomendacion
                        ?.descripcion ||
                      recomendacion
                        ?.titulo ||
                      "Recomendación RH"}
                </span>
              </div>
            )
          )
        ) : (
          <p
            style={{
              margin: 0,
              textAlign: "center",
            }}
          >
            No hay recomendaciones
            disponibles por el momento.
          </p>
        )}
      </div>
    </section>
  );
}