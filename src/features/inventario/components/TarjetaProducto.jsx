import "./TarjetaProducto.css";

function TarjetaProducto({
  nombre,
  existencia,
  costo,
  precio,
  estado,
}) {
  const obtenerClaseEstado = () => {
    if (estado.includes("🟢")) {
      return "estado-verde";
    }

    if (estado.includes("🔴")) {
      return "estado-rojo";
    }

    return "estado-amarillo";
  };

  return (
    <article className="tarjeta-producto">
      <h3 className="tarjeta-titulo">{nombre}</h3>

      <p className="tarjeta-info">
        <strong>Existencia:</strong> {existencia}
      </p>

      <p className="tarjeta-info">
        <strong>Costo:</strong> ${costo}
      </p>

      <p className="tarjeta-info">
        <strong>Precio:</strong> ${precio}
      </p>

      <p className="tarjeta-info">
        <strong>Estado:</strong>{" "}
        <span className={obtenerClaseEstado()}>
          {estado}
        </span>
      </p>
    </article>
  );
}

export default TarjetaProducto;