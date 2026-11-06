const PLAN_ZONAS_CENTRO = [
  { responsable: "Vale", alias: ["vale", "valeria"], zonas: ["Beauty 1", "Beauty 2", "Beauty 3", "Beauty 4", "Espejo", "Mostrador trasero 1 · Caja 1"] },
  { responsable: "Karla", alias: ["karla"], zonas: ["Bissú 1", "Bissú 2", "Italia 1", "Italia 2", "Cala", "Mostrador trasero 2 · Caja 2"] },
  { responsable: "Mariana", alias: ["mariana"], zonas: ["Pink Up 1", "Pink Up 2", "Pink Up 3", "Pink Up 4", "Pink Up 5", "Novedades 1"] },
  { responsable: "Katy", alias: ["katy", "cathy", "cati"], zonas: ["Adara", "Champú", "Nekane", "Hidratante", "Kuul", "Kiki"] },
  { responsable: "Ale", alias: ["ale", "alejandra"], zonas: ["Isla 3", "Novedades 3", "Uñas 2", "Mostrador 4"] },
  { responsable: "Sofía", alias: ["sofia", "sofi"], zonas: ["Moira", "Isla 1", "Isla 2", "Lociones", "Isla Bausse", "Uñas 1"] },
  { responsable: "Elisa", alias: ["elisa"], zonas: ["Novedades", "KJ", "Saniye 1", "Saniye 2", "Mix", "Novedades 2"] },
];

const BODEGA_POR_DIA = {
  0: ["ale", "alejandra"],
  1: ["elisa"],
  2: ["mariana"],
  3: ["katy", "cathy", "cati"],
  4: ["vale", "valeria"],
  5: ["karla"],
  6: ["sofia", "sofi"],
};

const PANEL_COMPARTIDO = ["mariana", "katy", "cathy", "cati", "elisa"];

function normalizar(texto) {
  return String(texto || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("es-MX")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function coincide(nombre, alias = []) {
  const palabras = normalizar(nombre).split(" ").filter(Boolean);
  return alias.some((valor) => palabras.includes(normalizar(valor)));
}

function cargaDe(asignacion) {
  return asignacion.zonas.length;
}

function menorCarga(asignaciones, candidatos = null) {
  const pool = candidatos?.length ? asignaciones.filter((item) => candidatos.includes(item)) : asignaciones;
  return [...pool].sort((a, b) => cargaDe(a) - cargaDe(b) || a.nombre.localeCompare(b.nombre, "es-MX"))[0] || null;
}

export function esSucursalCentro(nombreSucursal) {
  return normalizar(nombreSucursal).includes("centro");
}

export function planificarZonasCentro({ candidatos = [], fecha } = {}) {
  const disponibles = (Array.isArray(candidatos) ? candidatos : [])
    .filter((item) => item?.empleado)
    .map((item) => ({ ...item, nombre: item.nombre || item.empleado.nombre || "Empleada", zonas: [], coberturas: [] }));
  const avisos = [];

  for (const grupo of PLAN_ZONAS_CENTRO) {
    const titular = disponibles.find((item) => coincide(item.nombre, grupo.alias));
    const destino = titular || menorCarga(disponibles);
    if (!destino) continue;
    destino.zonas.push(...grupo.zonas);
    if (!titular) {
      destino.coberturas.push(grupo.responsable);
      avisos.push(`${destino.nombre} cubre las zonas de ${grupo.responsable} porque no está disponible.`);
    }
  }

  const fechaLocal = /^\d{4}-\d{2}-\d{2}$/.test(String(fecha || "")) ? new Date(`${fecha}T12:00:00`) : null;
  const dia = fechaLocal && !Number.isNaN(fechaLocal.getTime()) ? fechaLocal.getDay() : null;
  const aliasBodega = dia === null ? [] : BODEGA_POR_DIA[dia] || [];
  let responsableBodega = disponibles.find((item) => coincide(item.nombre, aliasBodega)) || menorCarga(disponibles);
  const cubreBodega = Boolean(responsableBodega && aliasBodega.length && !coincide(responsableBodega.nombre, aliasBodega));

  const candidatasPanel = disponibles.filter((item) => coincide(item.nombre, PANEL_COMPARTIDO));
  const responsablePanel = menorCarga(disponibles, candidatasPanel);

  return {
    asignaciones: disponibles.filter((item) => item.zonas.length),
    responsableBodega: responsableBodega ? { ...responsableBodega, cubre: cubreBodega } : null,
    responsablePanel,
    avisos,
  };
}

export { PLAN_ZONAS_CENTRO };
