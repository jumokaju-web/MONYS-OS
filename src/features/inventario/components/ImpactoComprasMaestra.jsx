import { useMemo, useState } from "react";
import { evaluarImpactoCompras } from "../utils/impactoCompraMaestra.js";
import { ESTADOS_IMPACTO, calcularImpactoCompra } from "../../../core/impacto/motorImpactoDinero.js";
import "../../dashboard/components/ImpactoDineroHoy.css";

const dinero = (valor) =>
  new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN", maximumFractionDigits: 0 }).format(Number(valor) || 0);

const porcentaje = (valor) => (valor == null ? "—" : `${Math.round(valor * 100)}%`);

function SimuladorTemporada() {
  const [campos, setCampos] = useState({
    unidades: "",
    costo: "",
    precio: "",
    ventaDiaria: "",
    dias: "45",
    remate: "",
  });
  const cambiar = (campo) => (evento) => setCampos((actual) => ({ ...actual, [campo]: evento.target.value }));
  const completo = campos.unidades && campos.costo && campos.precio && campos.ventaDiaria && campos.dias;
  const resultado = completo
    ? calcularImpactoCompra({
        unidades: campos.unidades,
        costoUnitario: campos.costo,
        precioVenta: campos.precio,
        ventaDiariaEstimada: campos.ventaDiaria,
        diasTemporada: campos.dias,
        valorRemateUnitario: campos.remate === "" ? null : campos.remate,
      })
    : null;

  const entrada = (campo, etiqueta, ayuda) => (
    <label className="impacto-dinero__campo">
      <span>{etiqueta}</span>
      <input type="number" inputMode="decimal" min="0" value={campos[campo]} onChange={cambiar(campo)} placeholder={ayuda} />
    </label>
  );

  return (
    <details className="impacto-dinero__simulador">
      <summary>Simular una compra de temporada</summary>
      <div className="impacto-dinero__campos">
        {entrada("unidades", "Piezas a comprar", "100")}
        {entrada("costo", "Costo por pieza", "50")}
        {entrada("precio", "Precio de venta", "120")}
        {entrada("ventaDiaria", "Piezas que vendes al día", "2")}
        {entrada("dias", "Días que dura la temporada", "45")}
        {entrada("remate", "Precio de remate (opcional)", "Mitad del costo")}
      </div>
      {resultado && resultado.estado !== ESTADOS_IMPACTO.FALTAN_DATOS && (
        <div className="impacto-dinero__resultado">
          <strong className={resultado.ganancia > 0 ? "" : "impacto-dinero__negativo"}>
            {resultado.ganancia > 0 ? "Ganarías" : "Perderías"} {dinero(Math.abs(resultado.ganancia))}
          </strong>
          <span>
            Inviertes {dinero(resultado.inversion)} · retorno {porcentaje(resultado.retorno)}
            {resultado.diasRecuperacion ? ` · recuperas la inversión en ~${resultado.diasRecuperacion} días` : ""}
          </span>
          {resultado.unidadesRecomendadas < Number(campos.unidades) && (
            <span>
              Al ritmo indicado solo vendes {resultado.unidadesRecomendadas} piezas en la temporada; comprar más deja sobrante.
            </span>
          )}
          <ul>
            {resultado.supuestos.map((supuesto) => <li key={supuesto}>{supuesto}</li>)}
          </ul>
        </div>
      )}
    </details>
  );
}

export default function ImpactoComprasMaestra({ productos = [], diasCobertura = 30 }) {
  const [capital, setCapital] = useState("");
  const datos = useMemo(
    () => evaluarImpactoCompras(productos, { diasCobertura, capitalDisponible: capital === "" ? null : capital }),
    [productos, diasCobertura, capital]
  );
  const { resumen, mejores } = datos;

  return (
    <section className="impacto-dinero" aria-labelledby="impacto-compras-titulo">
      <header>
        <span>CUÁNTO DEJA ESTA COMPRA</span>
        <h3 id="impacto-compras-titulo">Ganancia esperada de comprar</h3>
      </header>

      {resumen.productosConDatos === 0 ? (
        <p className="impacto-dinero__nota">
          No hay productos con costo y precio de venta para calcular la ganancia. Revisa que el inventario SICAR traiga precio de compra y de venta.
        </p>
      ) : (
        <>
          <div className="impacto-dinero__totales">
            <div>
              <small>Ganancia esperada</small>
              <strong>{dinero(resumen.gananciaEstimada)}</strong>
              <span>En {diasCobertura} días, {resumen.productosConDatos} productos</span>
            </div>
            <div>
              <small>Inversión</small>
              <strong className="impacto-dinero__neutro">{dinero(resumen.inversion)}</strong>
              <span>Dinero que sale de caja</span>
            </div>
          </div>

          <label className="impacto-dinero__campo">
            <span>¿Cuánto dinero confirmado tienes para comprar?</span>
            <input type="number" inputMode="decimal" min="0" value={capital} onChange={(evento) => setCapital(evento.target.value)} placeholder="Ej. 20000" />
          </label>
          {resumen.capitalDisponible !== null ? (
            <p className="impacto-dinero__nota">
              Con {dinero(resumen.capitalDisponible)} alcanzas {resumen.productosConCapital} productos (los de mejor retorno): inviertes {dinero(resumen.inversionConCapital)} y ganarías {dinero(resumen.gananciaConCapital)}.
            </p>
          ) : (
            <p className="impacto-dinero__nota">Sin dinero confirmado, ninguna compra se da por autorizada.</p>
          )}

          <ol className="impacto-dinero__lista" aria-label="Productos con mejor retorno">
            {mejores.map((producto) => (
              <li key={producto.llave ?? producto.codigo}>
                <div>
                  <b>{producto.descripcion}</b>
                  <small>
                    {producto.compraTotal} piezas · inviertes {dinero(producto.impactoDinero.inversion)}
                  </small>
                </div>
                <div className="impacto-dinero__monto">
                  <strong>+{dinero(producto.impactoDinero.ganancia)}</strong>
                  <em>retorno {porcentaje(producto.impactoDinero.retorno)}</em>
                </div>
              </li>
            ))}
          </ol>
          {(resumen.productosSinDatos > 0 || resumen.productosNoConvienen > 0) && (
            <p className="impacto-dinero__nota">
              {resumen.productosSinDatos > 0 && `${resumen.productosSinDatos} productos sin costo o precio para calcular. `}
              {resumen.productosNoConvienen > 0 && `${resumen.productosNoConvienen} productos dejan pérdida con estos datos.`}
            </p>
          )}
        </>
      )}

      <SimuladorTemporada />
    </section>
  );
}
