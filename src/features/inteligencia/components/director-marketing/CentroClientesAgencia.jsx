import { useEffect, useState } from "react";

import {
  cambiarEstadoClienteAgenciaMarketing,
  crearClienteAgenciaMarketing,
  obtenerClientesAgenciaMarketing,
} from "../../services/clientesAgenciaMarketingService";

import "./CentroClientesAgencia.css";

export default function CentroClientesAgencia({ usuario, organizationId }) {
  const [clientes, setClientes] = useState([]);
  const [mostrarAlta, setMostrarAlta] = useState(false);
  const [nombre, setNombre] = useState("");
  const [sector, setSector] = useState("");
  const [objetivo, setObjetivo] = useState("");
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState("");
  const [mensaje, setMensaje] = useState("");

  const puedeGestionar = ["owner", "admin", "marketing"].includes(
    String(usuario?.role || "").toLowerCase()
  );

  async function cargar() {
    try {
      setError("");
      setClientes(await obtenerClientesAgenciaMarketing({ organizationId }));
    } catch (errorCarga) {
      setError(errorCarga?.message || "No fue posible cargar los clientes de la agencia.");
    }
  }

  useEffect(() => {
    cargar();
  }, [organizationId]);

  async function crear(evento) {
    evento.preventDefault();
    try {
      setGuardando(true);
      setError("");
      setMensaje("");
      await crearClienteAgenciaMarketing({
        organizationId,
        nombre,
        sector,
        objetivoPrincipal: objetivo,
      });
      setNombre("");
      setSector("");
      setObjetivo("");
      setMostrarAlta(false);
      setMensaje("Cliente creado. Ya puede preparar su estrategia y después conectar sus cuentas oficiales.");
      await cargar();
    } catch (errorAlta) {
      setError(errorAlta?.message || "No fue posible crear el cliente.");
    } finally {
      setGuardando(false);
    }
  }

  async function cambiarEstado(cliente) {
    try {
      setError("");
      const nuevoEstado = cliente.estado === "ACTIVO" ? "PAUSADO" : "ACTIVO";
      await cambiarEstadoClienteAgenciaMarketing({ clienteId: cliente.id, estado: nuevoEstado });
      setMensaje(nuevoEstado === "ACTIVO" ? "Cliente reactivado." : "Cliente pausado; sus datos se conservan.");
      await cargar();
    } catch (errorEstado) {
      setError(errorEstado?.message || "No fue posible actualizar el cliente.");
    }
  }

  return (
    <section className="agency-clients" aria-labelledby="agency-clients-title">
      <div className="agency-clients__heading">
        <div>
          <span>Agencia de Kary</span>
          <h4 id="agency-clients-title">Negocios y clientes separados</h4>
          <p>Cada marca conserva su estrategia, cuentas, presupuesto y resultados sin entrar a las áreas privadas de Monys Glam.</p>
        </div>
        {puedeGestionar && (
          <button type="button" onClick={() => setMostrarAlta((actual) => !actual)}>
            {mostrarAlta ? "Cancelar" : "+ Agregar cliente"}
          </button>
        )}
      </div>

      {mostrarAlta && (
        <form className="agency-clients__form" onSubmit={crear}>
          <label>Nombre del cliente o marca<input value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Ej. Boutique María" maxLength={120} /></label>
          <label>Giro o sector<input value={sector} onChange={(e) => setSector(e.target.value)} placeholder="Ej. Ropa, belleza, alimentos" maxLength={120} /></label>
          <label className="agency-clients__goal">Objetivo principal<textarea value={objetivo} onChange={(e) => setObjetivo(e.target.value)} placeholder="Ej. Conseguir pedidos por Instagram y WhatsApp" rows={3} maxLength={500} /></label>
          <button type="submit" disabled={guardando}>{guardando ? "Guardando…" : "Crear espacio del cliente"}</button>
        </form>
      )}

      <div className="agency-clients__grid">
        {clientes.map((cliente) => (
          <article key={cliente.id} className={cliente.estado === "PAUSADO" ? "is-paused" : ""}>
            <div>
              <b>{cliente.nombre.slice(0, 1).toUpperCase()}</b>
              <span>{cliente.tipo === "INTERNO" ? "Negocio propio" : "Cliente externo"}</span>
            </div>
            <h5>{cliente.nombre}</h5>
            <p>{cliente.objetivo_principal || "Objetivo por definir"}</p>
            <small>{cliente.sector || "Sector por definir"} · {cliente.estado === "ACTIVO" ? "Activo" : "Pausado"}</small>
            <div className="agency-clients__status">Redes pendientes de autorización oficial</div>
            {puedeGestionar && cliente.tipo === "EXTERNO" && (
              <button type="button" onClick={() => cambiarEstado(cliente)}>
                {cliente.estado === "ACTIVO" ? "Pausar cliente" : "Reactivar cliente"}
              </button>
            )}
          </article>
        ))}
      </div>

      {!clientes.length && <p className="agency-clients__empty">Preparando el primer espacio de Monys Glam…</p>}
      {mensaje && <p className="agency-clients__message">{mensaje}</p>}
      {error && <p className="agency-clients__error">{error}</p>}
    </section>
  );
}
