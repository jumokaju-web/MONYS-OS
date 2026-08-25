function convertirNumero(valor) {
  const numero = Number(valor);

  return Number.isFinite(numero)
    ? numero
    : 0;
}

function normalizarTexto(valor) {
  return String(valor || "")
    .trim()
    .toUpperCase();
}

function obtenerNivelPrioridad(
  prioridad
) {
  if (prioridad === "CRITICA") {
    return 1;
  }

  if (prioridad === "ALTA") {
    return 2;
  }

  if (prioridad === "MEDIA") {
    return 3;
  }

  return 4;
}

function empleadoEstaActivo(
  empleado
) {
  if (!empleado) {
    return false;
  }

  if (
    empleado.active === false ||
    empleado.activo === false
  ) {
    return false;
  }

  const estado =
    normalizarTexto(
      empleado.estado
    );

  if (
    estado === "INACTIVO" ||
    estado === "BAJA" ||
    estado === "DESPEDIDO" ||
    estado === "TERMINADO"
  ) {
    return false;
  }

  return true;
}

function incidenciaEstaAbierta(
  incidencia
) {
  const estado =
    normalizarTexto(
      incidencia?.estado
    );

  return ![
    "CERRADA",
    "CERRADO",
    "RESUELTA",
    "RESUELTO",
    "COMPLETADA",
    "COMPLETADO",
  ].includes(estado);
}

function capacitacionEstaPendiente(
  capacitacion
) {
  const estado =
    normalizarTexto(
      capacitacion?.estado
    );

  return ![
    "COMPLETADA",
    "COMPLETADO",
    "FINALIZADA",
    "FINALIZADO",
    "APROBADA",
    "APROBADO",
  ].includes(estado);
}

function vacanteEstaAbierta(
  vacante
) {
  const estado =
    normalizarTexto(
      vacante?.estado
    );

  return ![
    "CERRADA",
    "CERRADO",
    "CUBIERTA",
    "CUBIERTO",
    "CANCELADA",
    "CANCELADO",
  ].includes(estado);
}

function obtenerCostoNomina(
  movimiento
) {
  return convertirNumero(
    movimiento?.costoTotal ??
      movimiento?.costo_total ??
      movimiento?.total ??
      movimiento?.importe ??
      movimiento?.sueldoNeto ??
      movimiento?.sueldo_neto ??
      movimiento?.sueldo ??
      0
  );
}

function obtenerNombreEmpleado(
  empleado
) {
  return (
    empleado?.nombre ||
    empleado?.name ||
    empleado?.empleado ||
    empleado?.correo ||
    "Empleado"
  );
}

export function directorRHIA({
  empleados = [],
  nomina = [],
  incidencias = [],
  capacitaciones = [],
  vacantes = [],
  analisisFinanciero = null,

  /*
    Permite distinguir entre:

    - fuente conectada pero sin registros
    - fuente todavía no conectada

    Si no se manda explícitamente,
    MONYS OS puede inferir conexión
    cuando existen registros.
  */
  fuentesConectadas = {},
} = {}) {
  const listaEmpleados =
    Array.isArray(empleados)
      ? empleados
      : [];

  const listaNomina =
    Array.isArray(nomina)
      ? nomina
      : [];

  const listaIncidencias =
    Array.isArray(incidencias)
      ? incidencias
      : [];

  const listaCapacitaciones =
    Array.isArray(capacitaciones)
      ? capacitaciones
      : [];

  const listaVacantes =
    Array.isArray(vacantes)
      ? vacantes
      : [];

  /*
    ==========================================
    ESTADO DE CONEXIÓN DE FUENTES
    ==========================================
  */

  const empleadosConectados =
    fuentesConectadas.empleados ??
    listaEmpleados.length > 0;

  const nominaConectada =
    fuentesConectadas.nomina ??
    listaNomina.length > 0;

  const incidenciasConectadas =
    fuentesConectadas.incidencias ??
    listaIncidencias.length > 0;

  const capacitacionesConectadas =
    fuentesConectadas.capacitaciones ??
    listaCapacitaciones.length > 0;

  const vacantesConectadas =
    fuentesConectadas.vacantes ??
    listaVacantes.length > 0;

  const estadoFuentes = {
    empleados:
      empleadosConectados,

    nomina:
      nominaConectada,

    incidencias:
      incidenciasConectadas,

    capacitaciones:
      capacitacionesConectadas,

    vacantes:
      vacantesConectadas,
  };

  const fuentesPendientes = [];

  if (!empleadosConectados) {
    fuentesPendientes.push(
      "empleados"
    );
  }

  if (!nominaConectada) {
    fuentesPendientes.push(
      "nómina"
    );
  }

  if (!incidenciasConectadas) {
    fuentesPendientes.push(
      "incidencias"
    );
  }

  if (!capacitacionesConectadas) {
    fuentesPendientes.push(
      "capacitaciones"
    );
  }

  if (!vacantesConectadas) {
    fuentesPendientes.push(
      "vacantes"
    );
  }

  const tieneAlgunaFuenteConectada =
    Object.values(
      estadoFuentes
    ).some(Boolean);

  const conexionCompleta =
    Object.values(
      estadoFuentes
    ).every(Boolean);

  /*
    ==========================================
    PERSONAL
    ==========================================
  */

  const empleadosActivos =
    listaEmpleados.filter(
      empleadoEstaActivo
    );

  const empleadosInactivos =
    listaEmpleados.filter(
      (empleado) =>
        !empleadoEstaActivo(
          empleado
        )
    );

  /*
    ==========================================
    INCIDENCIAS
    ==========================================
  */

  const incidenciasAbiertas =
    listaIncidencias.filter(
      incidenciaEstaAbierta
    );

  const incidenciasCriticas =
    incidenciasAbiertas.filter(
      (incidencia) => {
        const prioridad =
          normalizarTexto(
            incidencia?.prioridad
          );

        const gravedad =
          normalizarTexto(
            incidencia?.gravedad
          );

        return (
          prioridad === "CRITICA" ||
          prioridad === "ALTA" ||
          gravedad === "CRITICA" ||
          gravedad === "ALTA"
        );
      }
    );

  /*
    ==========================================
    CAPACITACIÓN
    ==========================================
  */

  const capacitacionesPendientes =
    listaCapacitaciones.filter(
      capacitacionEstaPendiente
    );

  /*
    ==========================================
    VACANTES
    ==========================================
  */

  const vacantesAbiertas =
    listaVacantes.filter(
      vacanteEstaAbierta
    );

  /*
    ==========================================
    NÓMINA
    ==========================================
  */

  const costoNomina =
    listaNomina.reduce(
      (total, movimiento) =>
        total +
        obtenerCostoNomina(
          movimiento
        ),
      0
    );

  /*
    ==========================================
    CRUCE CON FINANZAS
    ==========================================
  */

  const dineroDisponible =
    convertirNumero(
      analisisFinanciero
        ?.dineroDisponible
    );

  const reservaRecomendada =
    convertirNumero(
      analisisFinanciero
        ?.reservaRecomendada
    );

  const vencimientos30Dias =
    convertirNumero(
      analisisFinanciero
        ?.vencimientos30Dias
    );

  const liquidezLibreEstimada =
    dineroDisponible -
    reservaRecomendada -
    vencimientos30Dias;

  /*
    ==========================================
    INCIDENCIAS POR EMPLEADO
    ==========================================
  */

  const incidenciasPorEmpleado =
    {};

  for (
    const incidencia of
    incidenciasAbiertas
  ) {
    const empleadoId =
      incidencia?.empleado_id ??
      incidencia?.empleadoId ??
      incidencia?.user_id ??
      incidencia?.usuario_id ??
      incidencia?.empleado ??
      null;

    if (!empleadoId) {
      continue;
    }

    const clave =
      String(empleadoId);

    incidenciasPorEmpleado[
      clave
    ] =
      (
        incidenciasPorEmpleado[
          clave
        ] || 0
      ) + 1;
  }

  const empleadosConRiesgo =
    empleadosActivos
      .map((empleado) => {
        const empleadoId =
          empleado?.id ??
          empleado?.user_id ??
          empleado?.usuario_id ??
          empleado?.empleado_id ??
          empleado?.correo ??
          empleado?.nombre ??
          null;

        const incidenciasEmpleado =
          empleadoId
            ? incidenciasPorEmpleado[
                String(empleadoId)
              ] || 0
            : 0;

        return {
          id:
            empleadoId,

          nombre:
            obtenerNombreEmpleado(
              empleado
            ),

          incidencias:
            incidenciasEmpleado,

          empleado,
        };
      })
      .filter(
        (empleado) =>
          empleado.incidencias >= 3
      )
      .sort(
        (a, b) =>
          b.incidencias -
          a.incidencias
      );

  /*
    ==========================================
    ALERTAS
    ==========================================
  */

  const alertas = [];

  if (
    !tieneAlgunaFuenteConectada
  ) {
    alertas.push({
      prioridad:
        "ALTA",

      tipo:
        "DATOS",

      titulo:
        "RH todavía no tiene datos operativos conectados",

      descripcion:
        "El Director RH IA está preparado, pero necesita fuentes reales de Recursos Humanos para emitir un diagnóstico.",
    });
  } else if (
    !conexionCompleta
  ) {
    alertas.push({
      prioridad:
        "MEDIA",

      tipo:
        "DATOS_PARCIALES",

      titulo:
        "RH está parcialmente conectado",

      descripcion:
        `Ya existen datos reales de Recursos Humanos, pero todavía faltan por conectar: ${fuentesPendientes.join(
          ", "
        )}.`,
    });
  }

  if (
    incidenciasConectadas &&
    incidenciasCriticas.length > 0
  ) {
    alertas.push({
      prioridad:
        "CRITICA",

      tipo:
        "INCIDENCIAS",

      titulo:
        "Incidencias críticas de personal pendientes",

      descripcion:
        `Existen ${incidenciasCriticas.length.toLocaleString(
          "es-MX"
        )} incidencias críticas o de prioridad alta que requieren seguimiento.`,
    });
  }

  if (
    incidenciasConectadas &&
    empleadosConRiesgo.length > 0
  ) {
    alertas.push({
      prioridad:
        "ALTA",

      tipo:
        "PERSONAL",

      titulo:
        "Empleados con incidencias recurrentes",

      descripcion:
        `${empleadosConRiesgo.length.toLocaleString(
          "es-MX"
        )} empleados acumulan tres o más incidencias abiertas y requieren revisión.`,
    });
  }

  if (
    capacitacionesConectadas &&
    capacitacionesPendientes.length >
      0
  ) {
    alertas.push({
      prioridad:
        "MEDIA",

      tipo:
        "CAPACITACION",

      titulo:
        "Capacitaciones pendientes",

      descripcion:
        `Existen ${capacitacionesPendientes.length.toLocaleString(
          "es-MX"
        )} capacitaciones pendientes de completar.`,
    });
  }

  if (
    vacantesConectadas &&
    vacantesAbiertas.length > 0 &&
    liquidezLibreEstimada <= 0
  ) {
    alertas.push({
      prioridad:
        "ALTA",

      tipo:
        "CONTRATACION",

      titulo:
        "Vacantes abiertas con liquidez comprometida",

      descripcion:
        "Antes de autorizar nuevas contrataciones, RH debe validar el costo laboral con Finanzas.",
    });
  }

  /*
    ==========================================
    RECOMENDACIONES
    ==========================================
  */

  const recomendaciones = [];

  if (
    !tieneAlgunaFuenteConectada
  ) {
    recomendaciones.push(
      "Conectar la información real de Recursos Humanos para comenzar el análisis operativo."
    );
  } else if (
    !conexionCompleta
  ) {
    recomendaciones.push(
      `Completar las fuentes pendientes de RH: ${fuentesPendientes.join(
        ", "
      )}.`
    );
  }

  if (
    incidenciasConectadas &&
    incidenciasAbiertas.length > 0
  ) {
    recomendaciones.push(
      "Dar seguimiento y responsable a cada incidencia abierta hasta comprobar que quedó resuelta."
    );
  }

  if (
    incidenciasConectadas &&
    empleadosConRiesgo.length > 0
  ) {
    recomendaciones.push(
      "Revisar individualmente a los empleados con incidencias recurrentes antes de que el problema afecte operación, servicio o ventas."
    );
  }

  if (
    capacitacionesConectadas &&
    capacitacionesPendientes.length >
      0
  ) {
    recomendaciones.push(
      "Priorizar capacitación pendiente según el puesto y el impacto operativo de cada empleado."
    );
  }

  if (
    vacantesConectadas &&
    vacantesAbiertas.length > 0
  ) {
    recomendaciones.push(
      "Cruzar toda nueva contratación con Finanzas para conocer el costo laboral total antes de autorizarla."
    );
  }

  if (
    nominaConectada &&
    listaNomina.length > 0
  ) {
    recomendaciones.push(
      "Comparar periódicamente costo de nómina contra ventas y utilidad para vigilar que el crecimiento de personal sea sostenible."
    );
  }

  /*
    ==========================================
    ACCIONES PRIORITARIAS
    ==========================================
  */

  const accionesPrioritarias =
    [...alertas]
      .sort(
        (a, b) =>
          obtenerNivelPrioridad(
            a.prioridad
          ) -
          obtenerNivelPrioridad(
            b.prioridad
          )
      )
      .slice(0, 5);

  /*
    ==========================================
    ESTADO GENERAL RH
    ==========================================
  */

  let estadoGeneral =
    "RH estable";

  if (
    !tieneAlgunaFuenteConectada
  ) {
    estadoGeneral =
      "RH pendiente de datos operativos";
  } else if (
    incidenciasConectadas &&
    incidenciasCriticas.length > 0
  ) {
    estadoGeneral =
      "RH requiere intervención";
  } else if (
    incidenciasConectadas &&
    empleadosConRiesgo.length > 0
  ) {
    estadoGeneral =
      "RH con personal en seguimiento";
  } else if (
    (
      incidenciasConectadas &&
      incidenciasAbiertas.length > 0
    ) ||
    (
      capacitacionesConectadas &&
      capacitacionesPendientes.length >
        0
    )
  ) {
    estadoGeneral =
      "RH con pendientes operativos";
  } else if (
    !conexionCompleta
  ) {
    estadoGeneral =
      "RH parcialmente conectado";
  }

  /*
    ==========================================
    CONTRATACIÓN
    ==========================================
  */

  let estadoContratacion =
    "DATOS_PENDIENTES";

  if (vacantesConectadas) {
    if (
      vacantesAbiertas.length === 0
    ) {
      estadoContratacion =
        "SIN_VACANTES";
    } else if (
      liquidezLibreEstimada > 0
    ) {
      estadoContratacion =
        "EVALUAR_CON_FINANZAS";
    } else {
      estadoContratacion =
        "NO_AUTORIZADA_FINANCIERAMENTE";
    }
  }

  /*
    ==========================================
    RESULTADO
    ==========================================
  */

  return {
    nombre:
      "Director RH IA",

    version:
      "1.1.0",

    estadoGeneral,

    tieneDatosRH:
      tieneAlgunaFuenteConectada,

    conexionCompleta,

    estadoFuentes,

    fuentesPendientes,

    totalEmpleados:
      listaEmpleados.length,

    empleadosActivos:
      empleadosActivos.length,

    empleadosInactivos:
      empleadosInactivos.length,

    costoNomina,

    incidenciasAbiertas:
      incidenciasAbiertas.length,

    incidenciasCriticas:
      incidenciasCriticas.length,

    capacitacionesPendientes:
      capacitacionesPendientes.length,

    vacantesAbiertas:
      vacantesAbiertas.length,

    empleadosConRiesgo,

    estadoContratacion,

    dineroDisponible,

    reservaRecomendada,

    vencimientos30Dias,

    liquidezLibreEstimada,

    alertas,

    recomendaciones,

    accionesPrioritarias,

    generadoEn:
      new Date().toISOString(),
  };
}