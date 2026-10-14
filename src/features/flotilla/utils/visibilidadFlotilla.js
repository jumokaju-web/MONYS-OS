export function obtenerVisibilidadFlotilla({ role = "", tipoAcceso = "" } = {}) {
  const rol = String(role || "").trim().toLowerCase();
  const acceso = String(tipoAcceso || "").trim().toUpperCase();
  const esAdministrador = ["owner", "admin"].includes(rol) || acceso === "ADMIN_FLOTILLA";
  const esSocioConsulta = acceso === "SOCIO_CONSULTA";
  const esChofer = !esAdministrador && !esSocioConsulta;

  return {
    esAdministrador,
    esSocioConsulta,
    esChofer,
    puedeVerPropietario: esAdministrador || esSocioConsulta,
    puedeCapturarLiquidacionAdministrativa: esAdministrador,
    puedeVerResultadoNegocio: esAdministrador,
    puedeVerMovimientosPropios: esChofer,
  };
}
