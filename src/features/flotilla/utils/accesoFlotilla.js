export function debeAbrirFlotillaComoInicio({ role, puedeVerLogistica }) {
  const rol = String(role || "").trim().toLowerCase();

  return ["chofer", "consulta"].includes(rol) && puedeVerLogistica === true;
}
