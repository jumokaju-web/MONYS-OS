function numeroONulo(valor) {
  if (valor === null || valor === undefined || String(valor).trim() === "") return null;
  const numero = Number(valor);
  return Number.isFinite(numero) ? numero : null;
}

function sumarDisponibles(valores) {
  const disponibles = valores.map(numeroONulo).filter((valor) => valor !== null);
  return disponibles.length ? disponibles.reduce((total, valor) => total + valor, 0) : null;
}

function fechasEntre(inicio, fin) {
  if (!inicio || !fin || inicio > fin) return [];
  const fechas = [];
  const cursor = new Date(`${inicio}T12:00:00Z`);
  const limite = new Date(`${fin}T12:00:00Z`);
  while (cursor <= limite && fechas.length < 45) {
    fechas.push(cursor.toISOString().slice(0, 10));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return fechas;
}

export function resumirCortesCajaSicar(cortes = []) {
  const lista = Array.isArray(cortes) ? cortes.filter(Boolean) : [];
  const fechas = [...new Set(lista.map((corte) => corte.fecha).filter(Boolean))].sort();
  const metodosContados = {};

  for (const corte of lista) {
    for (const metodo of corte.metodos || []) {
      const contado = numeroONulo(metodo.contado);
      if (contado === null) continue;
      const clave = metodo.clave || "otro";
      metodosContados[clave] = (metodosContados[clave] || 0) + contado;
    }
  }

  const alertas = lista.flatMap((corte) =>
    (corte.alertas || []).map((alerta) => ({ ...alerta, fecha: corte.fecha, caja: corte.caja })),
  );
  const cortesConDesgloseInconsistente = lista.filter((corte) => corte.desgloseContadoCoincide === false);
  const diferencias = lista
    .map((corte) => ({ corte, valor: numeroONulo(corte.diferenciaOperativa) }))
    .filter((item) => item.valor !== null)
    .sort((a, b) => Math.abs(b.valor) - Math.abs(a.valor));
  const porSucursal = new Map();
  for (const corte of lista) {
    const clave = corte.branchId || "reporte";
    const grupo = porSucursal.get(clave) || [];
    grupo.push(corte);
    porSucursal.set(clave, grupo);
  }
  const faltantesPorSucursal = [...porSucursal.entries()].flatMap(([branchId, grupo]) => {
    const periodosInicio = grupo.map((corte) => corte.periodoInicio).filter(Boolean).sort();
    const periodosFin = grupo.map((corte) => corte.periodoFin).filter(Boolean).sort();
    const inicio = periodosInicio[0] || null;
    const fin = periodosFin.at(-1) || null;
    if (!inicio || !fin) return [];
    const registradas = new Set(grupo.map((corte) => corte.fecha).filter(Boolean));
    return fechasEntre(inicio, fin)
      .filter((dia) => !registradas.has(dia))
      .map((dia) => ({ branchId, fecha: dia, estado: "CORTE_NO_DISPONIBLE" }));
  });

  return {
    totalCortes: lista.length,
    fechaInicio: fechas[0] || null,
    fechaFin: fechas.at(-1) || null,
    diasConCorte: fechas.length,
    totalContado: sumarDisponibles(lista.map((corte) => corte.contado)),
    totalRetirado: sumarDisponibles(lista.map((corte) => corte.retirado)),
    diferenciaOperativa: sumarDisponibles(lista.map((corte) => corte.diferenciaOperativa)),
    metodosContados,
    alertas,
    cortesConDesgloseInconsistente,
    mayorDiferencia: diferencias[0] || null,
    faltantesPorSucursal,
  };
}

export function combinarCortesImportados(importaciones = []) {
  const lista = Array.isArray(importaciones) ? importaciones : [];
  const cortes = lista.flatMap((importacion) =>
    (importacion.cortes || []).map((corte) => ({
      ...corte,
      importacionId: importacion.id,
      branchId: importacion.branch_id,
      archivoOriginal: importacion.archivo_original,
      importadoEn: importacion.created_at,
    })),
  );
  return { cortes, resumen: resumirCortesCajaSicar(cortes) };
}
