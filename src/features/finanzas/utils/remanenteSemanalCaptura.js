const numero = (valor) => {
  if (valor === null || valor === undefined || String(valor).trim() === "") return null;
  const resultado = Number(valor);
  return Number.isFinite(resultado) ? resultado : null;
};

export function validarCapturaRemanente({
  efectivoSicar,
  efectivoContado,
  fondoFijo,
  montoResguardado,
  destino,
  referencia,
  evidencia,
  nota,
} = {}) {
  const sicar = numero(efectivoSicar);
  const contado = numero(efectivoContado);
  const fondo = numero(fondoFijo);
  const resguardado = numero(montoResguardado);
  if ([sicar, contado, fondo, resguardado].some((importe) => importe === null || importe < 0)) {
    return "Captura importes válidos iguales o mayores a cero.";
  }
  if (contado < fondo) return "El efectivo contado no puede ser menor que el fondo fijo.";
  if (Math.round(resguardado * 100) > Math.round((contado - fondo) * 100)) {
    return "El monto resguardado excede el efectivo disponible después de conservar el fondo fijo.";
  }
  if (resguardado > 0 && String(destino || "").trim().length < 2) return "Indica el destino real donde quedó el efectivo retirado.";
  if (resguardado > 0 && String(referencia || "").trim().length < 2) return "Agrega una referencia del retiro o depósito.";
  if (resguardado > 0 && !evidencia) return "Adjunta evidencia del efectivo resguardado.";
  if (Math.abs(Math.round((contado - sicar) * 100)) > 0 && String(nota || "").trim().length < 5) {
    return "Describe la diferencia entre el conteo físico y SICAR.";
  }
  return null;
}

export function resumirCapturaRemanente({ efectivoSicar, efectivoContado, fondoFijo, montoResguardado } = {}) {
  const sicar = numero(efectivoSicar);
  const contado = numero(efectivoContado);
  const fondo = numero(fondoFijo);
  const resguardado = numero(montoResguardado);
  if ([sicar, contado, fondo, resguardado].some((importe) => importe === null)) {
    return { montoResguardable: null, efectivoDespues: null, diferenciaSicar: null, coincideSicar: false };
  }
  const diferenciaSicar = Math.round((contado - sicar) * 100) / 100;
  return {
    montoResguardable: Math.max(0, contado - fondo),
    efectivoDespues: contado - resguardado,
    diferenciaSicar,
    coincideSicar: Math.abs(diferenciaSicar) <= 0.009,
  };
}
