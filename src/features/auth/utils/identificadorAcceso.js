const DOMINIO_TELEFONO_INTERNO = "acceso.telefono.monys.local";

export function normalizarTelefonoAcceso(valor) {
  let digitos = String(valor || "").replace(/\D/g, "");

  if (digitos.length === 13 && digitos.startsWith("521")) {
    digitos = digitos.slice(3);
  } else if (digitos.length === 12 && digitos.startsWith("52")) {
    digitos = digitos.slice(2);
  }

  return /^\d{10}$/.test(digitos) ? digitos : null;
}

export function correoInternoParaTelefono(valor) {
  const telefono = normalizarTelefonoAcceso(valor);

  return telefono
    ? `telefono.${telefono}@${DOMINIO_TELEFONO_INTERNO}`
    : null;
}

export function prepararInicioSesion(identificador) {
  const valor = String(identificador || "").trim();

  if (valor.includes("@")) {
    return {
      email: valor.toLowerCase(),
    };
  }

  const email = correoInternoParaTelefono(valor);

  if (!email) {
    throw new Error(
      "Escribe un correo válido o un teléfono de 10 dígitos."
    );
  }

  return { email };
}
