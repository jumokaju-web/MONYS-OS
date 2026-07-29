import { useEffect, useState } from "react";
import PrimaryButton from "../../../design/components/PrimaryButton";
import { obtenerCategoriasActivas } from "../services/categoriasService";

const FORMULARIO_INICIAL = {
  sku: "",
  codigo_barras: "",
  nombre: "",
  marca: "",
  categoria: "",
  proveedor: "",
  costo: "",
  precio: "",
  precio_mayoreo: "",
  existencia: "",
  stock_minimo: "5",
};

function FormularioProducto({ onAgregarProducto }) {
  const [formulario, setFormulario] = useState(
    FORMULARIO_INICIAL
  );

  const [guardando, setGuardando] = useState(false);
  const [categorias, setCategorias] = useState([]);

useEffect(() => {
  async function cargarCategorias() {
    try {
      const lista = await obtenerCategoriasActivas();
      setCategorias(lista);
    } catch (error) {
      console.error(
        "Error al cargar categorías:",
        error
      );
    }
  }

  cargarCategorias();
}, []);
  function manejarCambio(evento) {
    const { name, value } = evento.target;

    setFormulario((anterior) => ({
      ...anterior,
      [name]: value,
    }));
  }

  async function manejarEnvio(evento) {
    evento.preventDefault();

    try {
      setGuardando(true);

      const productoGuardado = await onAgregarProducto({
        sku: formulario.sku.trim() || null,
        codigo_barras:
          formulario.codigo_barras.trim() || null,
        nombre: formulario.nombre.trim(),
        marca: formulario.marca.trim(),
        categoria: formulario.categoria.trim(),
        proveedor: formulario.proveedor.trim() || null,
        costo: Number(formulario.costo),
        precio: Number(formulario.precio),
        precio_mayoreo:
          formulario.precio_mayoreo === ""
            ? null
            : Number(formulario.precio_mayoreo),
        existencia: Number(formulario.existencia),
        stock_minimo: Number(formulario.stock_minimo),
      });

      if (productoGuardado) {
        setFormulario(FORMULARIO_INICIAL);
      }
    } catch (error) {
      console.error(
        "Error desde FormularioProducto:",
        error
      );
    } finally {
      setGuardando(false);
    }
  }

  return (
    <form onSubmit={manejarEnvio}>
      <h2>➕ Agregar producto</h2>

    <select
  name="categoria"
  value={formulario.categoria}
  onChange={manejarCambio}
  required
>
  <option value="">
    Selecciona una categoría
  </option>

  {categorias.map((categoria) => (
    <option
      key={categoria.id}
      value={categoria.nombre}
    >
      {categoria.nombre}
    </option>
  ))}
</select>

      <input
        type="text"
        name="codigo_barras"
        placeholder="Código de barras"
        value={formulario.codigo_barras}
        onChange={manejarCambio}
      />

      <input
        type="text"
        name="nombre"
        placeholder="Nombre del producto"
        value={formulario.nombre}
        onChange={manejarCambio}
        required
      />

      <input
        type="text"
        name="marca"
        placeholder="Marca"
        value={formulario.marca}
        onChange={manejarCambio}
        required
      />

      <input
        type="text"
        name="categoria"
        placeholder="Categoría"
        value={formulario.categoria}
        onChange={manejarCambio}
        required
      />

      <input
        type="text"
        name="proveedor"
        placeholder="Proveedor"
        value={formulario.proveedor}
        onChange={manejarCambio}
      />

      <input
        type="number"
        name="costo"
        placeholder="Costo"
        value={formulario.costo}
        onChange={manejarCambio}
        min="0"
        step="0.01"
        required
      />

      <input
        type="number"
        name="precio"
        placeholder="Precio de menudeo"
        value={formulario.precio}
        onChange={manejarCambio}
        min="0"
        step="0.01"
        required
      />

      <input
        type="number"
        name="precio_mayoreo"
        placeholder="Precio de mayoreo"
        value={formulario.precio_mayoreo}
        onChange={manejarCambio}
        min="0"
        step="0.01"
      />

      <input
        type="number"
        name="existencia"
        placeholder="Existencia actual"
        value={formulario.existencia}
        onChange={manejarCambio}
        min="0"
        required
      />

      <input
        type="number"
        name="stock_minimo"
        placeholder="Stock mínimo"
        value={formulario.stock_minimo}
        onChange={manejarCambio}
        min="0"
        required
      />

      <PrimaryButton
        type="submit"
        disabled={guardando}
      >
        {guardando
          ? "Guardando..."
          : "Guardar producto"}
      </PrimaryButton>
    </form>
  );
}

export default FormularioProducto;