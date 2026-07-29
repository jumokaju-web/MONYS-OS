function AccionesRapidas({ modulos, abrirModulo }) {
  return (
    <>
      <h2 className="titulo-seccion">¿Qué quieres hacer?</h2>

      <section className="modulos">
        {modulos.map(([icono, nombre]) => (
          <button
            className="modulo"
            key={nombre}
            onClick={() => abrirModulo(nombre)}
          >
            <span>{icono}</span>
            {nombre}
          </button>
        ))}
      </section>
    </>
  );
}

export default AccionesRapidas;