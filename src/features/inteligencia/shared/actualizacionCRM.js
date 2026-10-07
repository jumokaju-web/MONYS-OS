export function construirActualizacionCRMDesdeSeguimiento(resultado, fechaISO) {
  const texto = String(resultado || "").trim();
  if (!texto) {
    throw new Error("El resultado del seguimiento es obligatorio.");
  }
  return {
    etapa: "CONTACTADO",
    proximo_seguimiento: null,
    ultimo_resultado: texto,
    ultimo_seguimiento_at: fechaISO,
    updated_at: fechaISO,
  };
}
