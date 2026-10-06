function normalizarTexto(valor) {
  return String(valor || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .replace(/\s+/g, " ")
    .toUpperCase();
}

function coincideNombreLegacy(responsable, nombreUsuario) {
  const responsableNormalizado = normalizarTexto(responsable);
  const usuarioNormalizado = normalizarTexto(nombreUsuario);

  if (!responsableNormalizado || !usuarioNormalizado) {
    return false;
  }

  if (responsableNormalizado === usuarioNormalizado) {
    return true;
  }

  const partesResponsable = responsableNormalizado.split(" ");
  const coincidencias = usuarioNormalizado
    .split(" ")
    .filter(
      (parteUsuario) =>
        parteUsuario.length >= 4 &&
        partesResponsable.some(
          (parteResponsable) =>
            parteResponsable.length >= 4 &&
            (parteResponsable === parteUsuario ||
              parteResponsable.startsWith(parteUsuario) ||
              parteUsuario.startsWith(parteResponsable)),
        ),
    );

  return coincidencias.length >= 2;
}

export function tareaPerteneceAlUsuario(
  tarea,
  { authUserId = null, nombreUsuario = null } = {},
) {
  const usuarioAsignado = String(
    tarea?.responsable_usuario_id || "",
  ).trim();

  if (usuarioAsignado) {
    return Boolean(authUserId) && usuarioAsignado === String(authUserId).trim();
  }

  return coincideNombreLegacy(tarea?.responsable, nombreUsuario);
}
