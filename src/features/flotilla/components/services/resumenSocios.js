function nombrePropietario(unidad) {
  const propietarios = Array.isArray(unidad?.propietarios)
    ? unidad.propietarios
    : [];
  const principal = propietarios[0];

  if (typeof principal === "string") {
    return principal.trim() || "Sin propietario";
  }

  return String(principal?.nombre || "Sin propietario").trim();
}

function esUnidadRental(unidad) {
  const clasificacion = [unidad?.tipo_operacion, unidad?.tipo_propiedad]
    .map((valor) => String(valor || "").toLowerCase())
    .join(" ");

  return clasificacion.includes("rental");
}

function numeroRegistrado(valor) {
  if (valor === null || valor === undefined || valor === "") return null;
  const numero = Number(valor);
  return Number.isFinite(numero) ? numero : null;
}

export function construirResumenSocios({
  unidades = [],
  rutas = [],
  excluirRental = true,
}) {
  const unidadesValidas = (Array.isArray(unidades) ? unidades : []).filter(
    (unidad) => !excluirRental || !esUnidadRental(unidad)
  );
  const unidadesPorId = new Map(
    unidadesValidas.map((unidad) => [unidad.id, unidad])
  );
  const socios = new Map();

  unidadesValidas.forEach((unidad) => {
    const nombre = nombrePropietario(unidad);
    const actual = socios.get(nombre) || {
      socio: nombre,
      unidades: 0,
      rutas: 0,
      paquetes: 0,
      paros: 0,
      kilometros: 0,
      rutasConPaquetes: 0,
      rutasConParos: 0,
      rutasConKilometros: 0,
    };
    actual.unidades += 1;
    socios.set(nombre, actual);
  });

  (Array.isArray(rutas) ? rutas : []).forEach((ruta) => {
    const unidad = unidadesPorId.get(ruta?.unidad_id);
    if (!unidad) return;

    const nombre = nombrePropietario(unidad);
    const actual = socios.get(nombre);
    const paquetes = numeroRegistrado(ruta?.paquetes_total);
    const paros = numeroRegistrado(ruta?.paros_total);
    const kilometros = numeroRegistrado(ruta?.kilometros_ruta);

    actual.rutas += 1;
    if (paquetes !== null) {
      actual.paquetes += paquetes;
      actual.rutasConPaquetes += 1;
    }
    if (paros !== null) {
      actual.paros += paros;
      actual.rutasConParos += 1;
    }
    if (kilometros !== null) {
      actual.kilometros += kilometros;
      actual.rutasConKilometros += 1;
    }
  });

  const totalRutas = [...socios.values()].reduce(
    (total, socio) => total + socio.rutas,
    0
  );

  return [...socios.values()]
    .map((socio) => ({
      ...socio,
      rutasPorUnidad:
        socio.unidades > 0 ? socio.rutas / socio.unidades : 0,
      participacionRutas:
        totalRutas > 0 ? (socio.rutas / totalRutas) * 100 : 0,
      paquetesPromedio:
        socio.rutasConPaquetes > 0
          ? socio.paquetes / socio.rutasConPaquetes
          : null,
      parosPromedio:
        socio.rutasConParos > 0
          ? socio.paros / socio.rutasConParos
          : null,
      kilometrosPromedio:
        socio.rutasConKilometros > 0
          ? socio.kilometros / socio.rutasConKilometros
          : null,
    }))
    .sort((a, b) => b.rutasPorUnidad - a.rutasPorUnidad);
}
