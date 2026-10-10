import { useCallback, useEffect, useMemo, useState } from "react";
import { obtenerCierresTurno } from "../../inteligencia/services/cierresTurnoService";
import { extraerCapturaFinanciera } from "../../inteligencia/utils/capturasFinancierasEquipo";

const moneda = new Intl.NumberFormat("es-MX", {
  style: "currency",
  currency: "MXN",
  maximumFractionDigits: 2,
});

function fechaLegible(fecha) {
  if (!fecha) return "Sin fecha";
  const [anio, mes, dia] = String(fecha).split("-");
  return dia && mes && anio ? `${dia}/${mes}/${anio}` : fecha;
}

function TarjetaDato({ titulo, valor, alerta = false }) {
  return (
    <div className={alerta ? "captura-dato captura-dato-alerta" : "captura-dato"}>
      <small>{titulo}</small>
      <strong>{moneda.format(Number(valor) || 0)}</strong>
    </div>
  );
}

export default function BandejaCapturasEquipo({ branchId }) {
  const [capturas, setCapturas] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState("");

  const cargar = useCallback(async () => {
    try {
      setCargando(true);
      setError("");
      const cierres = await obtenerCierresTurno({ branchId, limite: 100 });
      setCapturas(cierres.map(extraerCapturaFinanciera).filter(Boolean));
    } catch (errorConsulta) {
      setError(errorConsulta?.message || "No fue posible cargar las capturas del equipo.");
    } finally {
      setCargando(false);
    }
  }, [branchId]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  const resumen = useMemo(() => {
    const cajas = capturas.filter((item) => item.tipo === "caja");
    const flotilla = capturas.filter((item) => item.tipo === "flotilla");
    return {
      cajas: cajas.length,
      flotilla: flotilla.length,
      diferenciasCaja: cajas.reduce(
        (total, item) => total + (Number(item.datos.diferenciaCaja) || 0),
        0
      ),
      resultadoFlotilla: flotilla.reduce(
        (total, item) => total + (Number(item.datos.resultadoEstimado) || 0),
        0
      ),
    };
  }, [capturas]);

  return (
    <section className="capturas-equipo">
      <div className="capturas-equipo-cabecera">
        <div>
          <span>ENTRADAS DEL EQUIPO · SINCRONIZADAS</span>
          <h2>Cortes de tienda y liquidaciones de flotilla</h2>
          <p>
            Aquí llega lo que registran empleadas y choferes. Primero se revisa;
            después se concilia con SICAR, banco y comprobantes.
          </p>
        </div>
        <button type="button" onClick={cargar} disabled={cargando}>
          {cargando ? "Actualizando…" : "Actualizar"}
        </button>
      </div>

      <div className="capturas-resumen">
        <TarjetaDato titulo="Cortes recibidos" valor={resumen.cajas} />
        <TarjetaDato titulo="Liquidaciones recibidas" valor={resumen.flotilla} />
        <TarjetaDato
          titulo="Diferencia acumulada de caja"
          valor={resumen.diferenciasCaja}
          alerta={Math.abs(resumen.diferenciasCaja) > 0.009}
        />
        <TarjetaDato titulo="Resultado estimado flotilla" valor={resumen.resultadoFlotilla} />
      </div>

      <p className="capturas-aviso">
        Las cifras son reportes del equipo y todavía no son contabilidad final.
        No se suman a utilidad hasta comprobarlas contra las otras fuentes.
      </p>

      {error && <p role="alert">{error}</p>}
      {cargando && capturas.length === 0 && <p role="status">Cargando capturas…</p>}
      {!cargando && !error && capturas.length === 0 && (
        <div className="capturas-vacio">
          Aún no hay cortes de caja ni liquidaciones de flotilla con el nuevo formato.
          En cuanto el equipo guarde uno, aparecerá aquí.
        </div>
      )}

      <div className="capturas-lista">
        {capturas.map(({ tipo, datos, cierre }) => (
          <article key={cierre.id} className="captura-registro">
            <header>
              <div>
                <span>{tipo === "caja" ? "CORTE DE TIENDA" : "LIQUIDACIÓN DE FLOTILLA"}</span>
                <h3>
                  {tipo === "caja"
                    ? cierre.responsable
                    : `${datos.placas || "Unidad"} · ${datos.chofer || cierre.responsable}`}
                </h3>
              </div>
              <div className="captura-estado">
                <b>Pendiente de revisión</b>
                <small>{fechaLegible(cierre.fecha)}</small>
              </div>
            </header>

            {tipo === "caja" ? (
              <div className="captura-grid">
                <TarjetaDato titulo="Venta SICAR" valor={datos.ventaSicar} />
                <TarjetaDato titulo="Cobrado" valor={datos.cobrado} />
                <TarjetaDato
                  titulo="Diferencia contra SICAR"
                  valor={datos.diferenciaVenta}
                  alerta={Math.abs(Number(datos.diferenciaVenta) || 0) > 0.009}
                />
                <TarjetaDato
                  titulo="Diferencia de caja"
                  valor={datos.diferenciaCaja}
                  alerta={Math.abs(Number(datos.diferenciaCaja) || 0) > 0.009}
                />
              </div>
            ) : (
              <div className="captura-grid">
                <TarjetaDato titulo="Ingreso de ruta" valor={datos.ingresoRuta} />
                <TarjetaDato titulo="Gastos reportados" valor={datos.gastos} />
                <TarjetaDato titulo="Resultado estimado" valor={datos.resultadoEstimado} />
                <div className="captura-dato">
                  <small>Ruta</small>
                  <strong>{datos.codigoRuta || "Sin ruta"}</strong>
                </div>
              </div>
            )}
          </article>
        ))}
      </div>
    </section>
  );
}
