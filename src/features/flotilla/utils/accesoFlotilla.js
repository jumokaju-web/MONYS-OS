export function debeAbrirFlotillaComoInicio({ role, puedeVerLogistica }) {
  return role === "consulta" && puedeVerLogistica === true;
}
