import { supabase } from "../../../supabase";

import {
  asignarResponsableAutomatico,
  obtenerEmpleadosActivosParaAsignacion,
} from "./empleadosRHService";


// ======================================================
// MONYS OS
// LIMPIEZA INTELIGENTE DE OPERACIÓN
//
// Objetivo:
// - No borrar historial.
// - Agrupar tareas automáticas repetidas.
// - Conservar una tarea principal por problema.
// - Cancelar duplicadas.
// - Redistribuir tareas pendientes.
// - Evitar sobrecargar a una sola persona.
// ======================================================


// ======================================================
// FECHA LOCAL
// ======================================================

function obtenerFechaHoy() {
  const ahora =
    new Date();

  const year =
    ahora.getFullYear();

  const month =
    String(
      ahora.getMonth() + 1
    ).padStart(
      2,
      "0"
    );

  const day =
    String(
      ahora.getDate()
    ).padStart(
      2,
      "0"
    );

  return `${year}-${month}-${day}`;
}


// ======================================================
// NORMALIZAR TEXTO
// ======================================================

function normalizarTexto(
  valor
) {
  return String(
    valor || ""
  )
    .toLowerCase()
    .normalize("NFD")
    .replace(
      /[\u0300-\u036f]/g,
      ""
    )
    .replace(
      /[^a-z0-9ñ\s]/g,
      " "
    )
    .replace(
      /\s+/g,
      " "
    )
    .trim();
}


// ======================================================
// PALABRAS POCO ÚTILES
// ======================================================

const PALABRAS_VACIAS =
  new Set([
    "a",
    "al",
    "algo",
    "como",
    "con",
    "de",
    "del",
    "el",
    "en",
    "entre",
    "es",
    "esta",
    "este",
    "la",
    "las",
    "lo",
    "los",
    "para",
    "por",
    "que",
    "se",
    "sin",
    "su",
    "sus",
    "un",
    "una",
    "y",
  ]);


// ======================================================
// TOKENS
// ======================================================

function obtenerTokens(
  texto
) {
  return normalizarTexto(
    texto
  )
    .split(" ")
    .filter(
      (token) =>
        token.length >= 4 &&
        !PALABRAS_VACIAS.has(
          token
        )
    );
}


// ======================================================
// SIMILITUD
// ======================================================

function calcularSimilitud(
  textoA,
  textoB
) {
  const tokensA =
    new Set(
      obtenerTokens(
        textoA
      )
    );

  const tokensB =
    new Set(
      obtenerTokens(
        textoB
      )
    );

  if (
    tokensA.size === 0 ||
    tokensB.size === 0
  ) {
    return 0;
  }

  let coincidencias =
    0;

  tokensA.forEach(
    (token) => {
      if (
        tokensB.has(
          token
        )
      ) {
        coincidencias +=
          1;
      }
    }
  );

  const union =
    new Set([
      ...tokensA,
      ...tokensB,
    ]).size;

  if (!union) {
    return 0;
  }

  return (
    coincidencias /
    union
  );
}


// ======================================================
// FAMILIAS DE PROBLEMAS
// ======================================================

function detectarFamilia({
  titulo = "",
  descripcion = "",
} = {}) {
  const texto =
    normalizarTexto(
      `${titulo} ${descripcion}`
    );


  const familias = [
    {
      id:
        "factura_mercancia",

      palabras: [
        "factura",
        "facturacion",
        "mercancia",
        "discrepancia",
        "diferencia",
        "cuadra",
      ],
    },

    {
      id:
        "faltantes_stock",

      palabras: [
        "faltante",
        "faltantes",
        "stock",
        "reponer",
        "reposicion",
        "agotado",
        "agotados",
        "probador",
        "probadores",
      ],
    },

    {
      id:
        "limpieza_acomodo",

      palabras: [
        "limpieza",
        "limpiar",
        "acomodar",
        "acomodo",
        "organizar",
        "orden",
      ],
    },

    {
      id:
        "productos_nuevos",

      palabras: [
        "producto nuevo",
        "productos nuevos",
        "registrar",
        "registro",
        "disponibilidad",
        "adara",
      ],
    },

    {
      id:
        "precio_demanda",

      palabras: [
        "precio",
        "precios",
        "demanda",
        "oferta",
        "aceptacion",
        "valor",
      ],
    },

    {
      id:
        "clientes_ventas",

      palabras: [
        "cliente",
        "clientes",
        "venta",
        "ventas",
        "oportunidad",
        "oportunidades",
      ],
    },
  ];


  let mejorFamilia =
    null;

  let mejorPuntaje =
    0;


  familias.forEach(
    (familia) => {
      const puntaje =
        familia.palabras.reduce(
          (
            acumulado,
            palabra
          ) => {
            return (
              acumulado +
              (
                texto.includes(
                  palabra
                )
                  ? 1
                  : 0
              )
            );
          },
          0
        );


      if (
        puntaje >
        mejorPuntaje
      ) {
        mejorPuntaje =
          puntaje;

        mejorFamilia =
          familia.id;
      }
    }
  );


  return mejorPuntaje > 0
    ? mejorFamilia
    : null;
}


// ======================================================
// OBTENER TAREAS AUTOMÁTICAS PENDIENTES
// ======================================================

async function obtenerTareasAutomaticasPendientes({
  branchId,
  fecha,
}) {
  const {
    data,
    error,
  } = await supabase
    .from(
      "tareas_operativas"
    )
    .select(`
      id,
      branch_id,
      titulo,
      descripcion,
      area,
      responsable,
      prioridad,
      estado,
      fecha,
      instrucciones,
      creada_por,
      created_at
    `)
    .eq(
      "branch_id",
      branchId
    )
    .eq(
      "fecha",
      fecha
    )
    .eq(
      "estado",
      "pendiente"
    )
    .eq(
      "creada_por",
      "MONYS OS"
    )
    .order(
      "created_at",
      {
        ascending: true,
      }
    );


  if (error) {
    console.error(
      "Error al obtener tareas automáticas pendientes:",
      error
    );

    throw error;
  }


  return Array.isArray(
    data
  )
    ? data
    : [];
}


// ======================================================
// COMPARAR SI DOS TAREAS SON EL MISMO PROBLEMA
// ======================================================

function sonTareasRelacionadas(
  tareaA,
  tareaB
) {
  const familiaA =
    detectarFamilia({
      titulo:
        tareaA?.titulo,

      descripcion:
        tareaA
          ?.descripcion,
    });


  const familiaB =
    detectarFamilia({
      titulo:
        tareaB?.titulo,

      descripcion:
        tareaB
          ?.descripcion,
    });


  const similitudTitulo =
    calcularSimilitud(
      tareaA?.titulo,
      tareaB?.titulo
    );


  const similitudCompleta =
    calcularSimilitud(
      `${tareaA?.titulo || ""} ${tareaA?.descripcion || ""}`,
      `${tareaB?.titulo || ""} ${tareaB?.descripcion || ""}`
    );


  if (
    similitudTitulo >=
    0.5
  ) {
    return true;
  }


  if (
    similitudCompleta >=
    0.58
  ) {
    return true;
  }


  if (
    familiaA &&
    familiaB &&
    familiaA ===
      familiaB
  ) {
    return true;
  }


  return false;
}


// ======================================================
// AGRUPAR TAREAS SIMILARES
// ======================================================

function agruparTareas(
  tareas
) {
  const grupos =
    [];


  tareas.forEach(
    (tarea) => {
      let grupoEncontrado =
        null;


      for (
        const grupo
        of grupos
      ) {
        const principal =
          grupo[0];


        if (
          sonTareasRelacionadas(
            tarea,
            principal
          )
        ) {
          grupoEncontrado =
            grupo;

          break;
        }
      }


      if (
        grupoEncontrado
      ) {
        grupoEncontrado.push(
          tarea
        );
      } else {
        grupos.push([
          tarea,
        ]);
      }
    }
  );


  return grupos;
}


// ======================================================
// ELEGIR TAREA PRINCIPAL
// ======================================================

function elegirTareaPrincipal(
  grupo
) {
  if (
    !Array.isArray(grupo) ||
    grupo.length === 0
  ) {
    return null;
  }


  /*
    Conservamos la tarea más antigua.

    Ventajas:
    - mantiene trazabilidad;
    - conserva la primera alerta;
    - evita estar cambiando el objetivo.
  */

  return [...grupo]
    .sort(
      (a, b) => {
        const fechaA =
          new Date(
            a.created_at
          ).getTime();

        const fechaB =
          new Date(
            b.created_at
          ).getTime();

        return (
          fechaA -
          fechaB
        );
      }
    )[0];
}


// ======================================================
// CANCELAR DUPLICADA
// ======================================================

async function cancelarTareaDuplicada({
  tarea,
  tareaPrincipal,
}) {
  const {
    error,
  } = await supabase
    .from(
      "tareas_operativas"
    )
    .update({
      estado:
        "cancelada",

      resultado:
        `Cancelada automáticamente por MONYS por duplicidad. Se conserva la tarea principal: ${tareaPrincipal?.titulo || "tarea consolidada"}.`,

      updated_at:
        new Date()
          .toISOString(),
    })
    .eq(
      "id",
      tarea.id
    );


  if (error) {
    console.error(
      "Error al cancelar tarea duplicada:",
      error
    );

    throw error;
  }


  return true;
}


// ======================================================
// OBTENER CARGA ACTUAL
// ======================================================

async function obtenerCargaActual({
  branchId,
  fecha,
}) {
  const {
    data,
    error,
  } = await supabase
    .from(
      "tareas_operativas"
    )
    .select(`
      id,
      responsable,
      estado
    `)
    .eq(
      "branch_id",
      branchId
    )
    .eq(
      "fecha",
      fecha
    )
    .in(
      "estado",
      [
        "pendiente",
        "en_proceso",
      ]
    );


  if (error) {
    console.error(
      "Error al obtener carga actual:",
      error
    );

    throw error;
  }


  const carga =
    {};


  (
    Array.isArray(data)
      ? data
      : []
  ).forEach(
    (tarea) => {
      const responsable =
        normalizarTexto(
          tarea.responsable
        );


      if (
        !responsable ||
        responsable ===
          "operacion"
      ) {
        return;
      }


      carga[responsable] =
        (
          carga[
            responsable
          ] ||
          0
        ) + 1;
    }
  );


  return carga;
}


// ======================================================
// ELEGIR EMPLEADO CON BALANCE
// ======================================================

async function elegirEmpleadoBalanceado({
  branchId,
  fecha,
  tarea,
  cargaActual,
}) {
  const empleados =
    await obtenerEmpleadosActivosParaAsignacion(
      branchId
    );


  if (
    empleados.length === 0
  ) {
    return null;
  }


  let preferido =
    null;


  try {
    preferido =
      await asignarResponsableAutomatico({
        branchId,

        titulo:
          tarea.titulo,

        descripcion:
          tarea.descripcion,

        area:
          tarea.area ||
          "operacion",

        fecha,
      });
  } catch (
    errorPreferido
  ) {
    console.error(
      "Error al buscar responsable preferido:",
      errorPreferido
    );
  }


  const candidatos =
    empleados
      .map(
        (empleado) => {
          const clave =
            normalizarTexto(
              empleado.nombre
            );


          return {
            empleado,

            carga:
              cargaActual[
                clave
              ] || 0,

            esPreferido:
              preferido
                ?.empleadoId ===
              empleado.id,
          };
        }
      )
      .sort(
        (a, b) => {
          /*
            Primero balanceamos carga.

            El perfil sirve para desempatar,
            no para saturar siempre a la
            misma persona.
          */

          if (
            a.carga !==
            b.carga
          ) {
            return (
              a.carga -
              b.carga
            );
          }


          if (
            a.esPreferido &&
            !b.esPreferido
          ) {
            return -1;
          }


          if (
            b.esPreferido &&
            !a.esPreferido
          ) {
            return 1;
          }


          return 0;
        }
      );


  return candidatos[0]
    ?.empleado ||
    null;
}


// ======================================================
// REASIGNAR TAREA
// ======================================================

async function reasignarTarea({
  tarea,
  empleado,
}) {
  if (
    !tarea?.id ||
    !empleado?.nombre
  ) {
    return false;
  }


  const instruccionesAnteriores =
    String(
      tarea.instrucciones ||
      ""
    ).trim();


  const instrucciones =
    instruccionesAnteriores
      ? `Tarea organizada automáticamente por MONYS y asignada a ${empleado.nombre}. ${instruccionesAnteriores}`
      : `Tarea organizada automáticamente por MONYS y asignada a ${empleado.nombre}. Ejecutar la acción y registrar evidencia del resultado.`;


  const {
    error,
  } = await supabase
    .from(
      "tareas_operativas"
    )
    .update({
      responsable:
        empleado.nombre,

      instrucciones,

      updated_at:
        new Date()
          .toISOString(),
    })
    .eq(
      "id",
      tarea.id
    );


  if (error) {
    console.error(
      "Error al reasignar tarea:",
      error
    );

    throw error;
  }


  return true;
}


// ======================================================
// FUNCIÓN PRINCIPAL
// ======================================================

export async function limpiarYBalancearOperacion({
  branchId,
  fecha = null,
} = {}) {
  if (!branchId) {
    throw new Error(
      "Falta branch_id para limpiar Operación de Hoy."
    );
  }


  const fechaTrabajo =
    fecha ||
    obtenerFechaHoy();


  // --------------------------------------
  // 1. Leer tareas automáticas pendientes
  // --------------------------------------

  const tareas =
    await obtenerTareasAutomaticasPendientes({
      branchId,
      fecha:
        fechaTrabajo,
    });


  if (
    tareas.length === 0
  ) {
    return {
      ok:
        true,

      totalAntes:
        0,

      grupos:
        0,

      conservadas:
        0,

      canceladas:
        0,

      reasignadas:
        0,

      totalDespues:
        0,

      mensaje:
        "No hay tareas automáticas pendientes para limpiar.",
    };
  }


  // --------------------------------------
  // 2. Agrupar problemas repetidos
  // --------------------------------------

  const grupos =
    agruparTareas(
      tareas
    );


  const principales =
    [];

  const duplicadas =
    [];


  grupos.forEach(
    (grupo) => {
      const principal =
        elegirTareaPrincipal(
          grupo
        );


      if (!principal) {
        return;
      }


      principales.push(
        principal
      );


      grupo.forEach(
        (tarea) => {
          if (
            tarea.id !==
            principal.id
          ) {
            duplicadas.push({
              tarea,
              principal,
            });
          }
        }
      );
    }
  );


  // --------------------------------------
  // 3. Cancelar duplicadas
  // --------------------------------------

  let canceladas =
    0;


  for (
    const item
    of duplicadas
  ) {
    try {
      await cancelarTareaDuplicada({
        tarea:
          item.tarea,

        tareaPrincipal:
          item.principal,
      });

      canceladas +=
        1;
    } catch (
      errorCancelar
    ) {
      console.error(
        "MONYS no pudo cancelar una duplicada:",
        errorCancelar
      );
    }
  }


  // --------------------------------------
  // 4. Repartir tareas principales
  // --------------------------------------

  const cargaActual =
    await obtenerCargaActual({
      branchId,
      fecha:
        fechaTrabajo,
    });


  let reasignadas =
    0;


  for (
    const tarea
    of principales
  ) {
    try {
      const empleado =
        await elegirEmpleadoBalanceado({
          branchId,

          fecha:
            fechaTrabajo,

          tarea,

          cargaActual,
        });


      if (
        !empleado
      ) {
        continue;
      }


      await reasignarTarea({
        tarea,
        empleado,
      });


      const clave =
        normalizarTexto(
          empleado.nombre
        );


      cargaActual[
        clave
      ] =
        (
          cargaActual[
            clave
          ] ||
          0
        ) + 1;


      reasignadas +=
        1;
    } catch (
      errorReasignar
    ) {
      console.error(
        "MONYS no pudo reasignar una tarea:",
        errorReasignar
      );
    }
  }


  return {
    ok:
      true,

    totalAntes:
      tareas.length,

    grupos:
      grupos.length,

    conservadas:
      principales.length,

    canceladas,

    reasignadas,

    totalDespues:
      principales.length,

    mensaje:
      `MONYS organizó ${tareas.length} tareas automáticas en ${principales.length} problemas operativos principales.`,
  };
}