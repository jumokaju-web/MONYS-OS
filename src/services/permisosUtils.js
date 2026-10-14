export function combinarPermisosEfectivos(
  permisosRol = [],
  excepciones = []
) {
  const efectivos = new Set(permisosRol);

  excepciones.forEach(({ permission, allowed }) => {
    if (allowed) {
      efectivos.add(permission);
    } else {
      efectivos.delete(permission);
    }
  });

  return [...efectivos];
}
