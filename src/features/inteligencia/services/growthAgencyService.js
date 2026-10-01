import { supabase } from "../../../supabase";

export async function obtenerEspaciosGrowth({
  organizationId,
} = {}) {
  if (!organizationId) {
    return [];
  }

  const {
    data: negocios,
    error: errorNegocios,
  } = await supabase
    .from("businesses")
    .select("id, organization_id, name, active")
    .eq("organization_id", organizationId)
    .eq("active", true)
    .order("name", {
      ascending: true,
    });

  if (errorNegocios) {
    throw errorNegocios;
  }

  const businessIds = (negocios || []).map(
    (negocio) => negocio.id
  );

  if (businessIds.length === 0) {
    return [];
  }

  const {
    data: sucursales,
    error: errorSucursales,
  } = await supabase
    .from("branches")
    .select("id, business_id, name, active")
    .in("business_id", businessIds)
    .eq("active", true)
    .order("name", {
      ascending: true,
    });

  if (errorSucursales) {
    throw errorSucursales;
  }

  return (negocios || []).flatMap(
    (negocio) => {
      const sucursalesNegocio = (
        sucursales || []
      ).filter(
        (sucursal) =>
          sucursal.business_id === negocio.id
      );

      if (sucursalesNegocio.length === 0) {
        return [
          {
            organization_id:
              negocio.organization_id,
            business_id: negocio.id,
            branch_id: null,
            negocio: negocio.name,
            sucursal: "Todas / No aplica",
          },
        ];
      }

      return sucursalesNegocio.map(
        (sucursal) => ({
          organization_id:
            negocio.organization_id,
          business_id: negocio.id,
          branch_id: sucursal.id,
          negocio: negocio.name,
          sucursal: sucursal.name,
        })
      );
    }
  );
}

export function claveEspacioGrowth(espacio) {
  return [
    espacio?.organization_id || "",
    espacio?.business_id || "",
    espacio?.branch_id || "",
  ].join(":");
}

function tieneContenido(valor) {
  if (Array.isArray(valor)) {
    return valor.length > 0;
  }

  if (valor && typeof valor === "object") {
    return Object.keys(valor).length > 0;
  }

  return Boolean(String(valor || "").trim());
}

function numeroRegistrado(valor) {
  if (valor === null || valor === undefined || valor === "") {
    return null;
  }

  const numero = Number(valor);
  return Number.isFinite(numero) ? numero : null;
}

export function orquestarAgenciaGrowth({
  actualizacionDatos = null,
  productoLider = null,
  inventarioProductoLider = null,
  campanasActivas = [],
  campanasFinalizadas = [],
} = {}) {
  const campanaActiva = campanasActivas[0] || null;
  const campanaReferencia =
    campanaActiva || campanasFinalizadas[0] || null;
  const estrategia = campanaReferencia?.estrategia_ia || {};
  const resultado = campanaReferencia?.resultado || {};
  const aprendizaje = campanaReferencia?.aprendizaje || {};
  const historial = Array.isArray(resultado?.historial)
    ? resultado.historial
    : [];
  const tieneResultados = historial.length > 0;
  const productoConfirmado =
    tieneContenido(productoLider?.nombre) ||
    tieneContenido(campanaReferencia?.producto);
  const inventarioConfirmado =
    numeroRegistrado(inventarioProductoLider?.existencia) !== null;
  const presupuesto = numeroRegistrado(
    campanaReferencia?.presupuesto
  );
  const venta = numeroRegistrado(resultado?.ventaAcumulada);
  const utilidad = numeroRegistrado(
    resultado?.utilidadEstimadaCampana
  );
  const decision =
    resultado?.decisionActual ||
    campanaReferencia?.decision_ia ||
    null;

  const etapas = [
    {
      id: "CONTEXTO",
      agente: "Estrategia",
      etiqueta: "Contexto real",
      detalle: "Ventas e inventario vigentes de la sucursal",
      completado: actualizacionDatos?.vigente === true,
      destino: "plan-crecimiento-marketing",
      accion: "Actualizar SICAR y volver a comprobar",
    },
    {
      id: "OPORTUNIDAD",
      agente: "Oportunidades",
      etiqueta: "Oportunidad",
      detalle: "Producto, existencia y evidencia comercial",
      completado:
        actualizacionDatos?.vigente === true &&
        productoConfirmado &&
        inventarioConfirmado,
      destino: "plan-crecimiento-marketing",
      accion: "Validar el producto prioritario",
    },
    {
      id: "HIPOTESIS",
      agente: "Estrategia",
      etiqueta: "Hipótesis",
      detalle: "Qué se probará y por qué podría funcionar",
      completado:
        tieneContenido(campanaReferencia?.hipotesis) ||
        tieneContenido(estrategia?.hipotesis),
      destino: "campanas-marketing-activas",
      accion: "Definir una prueba medible",
    },
    {
      id: "CONTENIDO",
      agente: "Creatividad",
      etiqueta: "Contenido",
      detalle: "Gancho, guion, formato, mensaje y CTA",
      completado:
        tieneContenido(estrategia?.kitPublicacion) ||
        (tieneContenido(campanaReferencia?.gancho) &&
          tieneContenido(campanaReferencia?.cta)),
      destino: "campanas-marketing-activas",
      accion: "Generar y revisar el kit de contenido",
    },
    {
      id: "CANAL",
      agente: "Campañas",
      etiqueta: "Canal",
      detalle: "Canal principal y adaptación multicanal",
      completado: tieneContenido(
        campanaReferencia?.canal_principal ||
          estrategia?.canalPrincipal
      ),
      destino: "growth-paid-channels-title",
      accion: "Confirmar canal y conexión",
    },
    {
      id: "INVERSION",
      agente: "Auditoría",
      etiqueta: "Inversión",
      detalle: "Presupuesto registrado; cero también es una decisión",
      completado: presupuesto !== null,
      destino: "campanas-marketing-activas",
      accion: "Registrar presupuesto y autorización",
    },
    {
      id: "RESULTADO",
      agente: "Embudo",
      etiqueta: "Resultado",
      detalle: "Publicación y avance real comprobados",
      completado: tieneResultados,
      destino: "campanas-marketing-activas",
      accion: "Registrar el primer resultado real",
    },
    {
      id: "VENTAS",
      agente: "Embudo",
      etiqueta: "Ventas",
      detalle: "Venta atribuida registrada, incluso si fue cero",
      completado: tieneResultados && venta !== null,
      destino: "campanas-marketing-activas",
      accion: "Confirmar ventas atribuidas",
    },
    {
      id: "UTILIDAD",
      agente: "Rentabilidad",
      etiqueta: "Utilidad",
      detalle: "Margen, gasto y utilidad incremental calculados",
      completado: tieneResultados && utilidad !== null,
      destino: "campanas-marketing-activas",
      accion: "Calcular utilidad de la campaña",
    },
    {
      id: "APRENDIZAJE",
      agente: "Memoria",
      etiqueta: "Aprendizaje",
      detalle: "Qué funcionó, qué falló y qué no repetir",
      completado:
        tieneContenido(aprendizaje) ||
        campanasFinalizadas.length > 0,
      destino: "historial-aprendizaje-campanas",
      accion: "Finalizar y documentar aprendizaje",
    },
    {
      id: "SIGUIENTE_ACCION",
      agente: "Dirección Growth",
      etiqueta: "Siguiente acción",
      detalle: "Mantener, mejorar, escalar o detener",
      completado: tieneResultados && tieneContenido(decision),
      destino: "campanas-marketing-activas",
      accion: "Pedir decisión a MONYS",
    },
  ];

  const completadas = etapas.filter(
    (etapa) => etapa.completado
  ).length;
  const resultadoPendiente =
    campanaActiva &&
    !etapas.find((etapa) => etapa.id === "RESULTADO")?.completado;
  const siguiente = resultadoPendiente
    ? etapas.find((etapa) => etapa.id === "RESULTADO")
    : etapas.find((etapa) => !etapa.completado) || null;

  return {
    etapas,
    completadas,
    total: etapas.length,
    porcentaje: Math.round((completadas / etapas.length) * 100),
    siguiente,
    campanaActiva,
    producto:
      campanaReferencia?.producto ||
      productoLider?.nombre ||
      "Producto por confirmar",
    decision: decision || "ESPERANDO DATOS",
  };
}
