export function puedeCargarDatosDeDireccion(role) {
  const rol = String(role || "").trim().toLowerCase();
  return rol === "owner" || rol === "admin";
}
