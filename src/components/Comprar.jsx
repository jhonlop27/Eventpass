import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Ticket } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { useCompra } from "../context/CompraContext";
import { importePedido, pesos } from "../data/presentacion";
import Modal from "./Modal";
import { Aviso } from "./Estados";
import { useConsulta } from "../services/useConsulta";
export default function Comprar({ evento, tipos, recargar }) {
  const { usuario } = useAuth(),
    comprar = useCompra(),
    navegar = useNavigate();
  const [params, setParams] = useSearchParams();
  const disponibles = tipos.filter((t) => Number(t.cantidad_disponible) > 0);
  const tipo = disponibles.find((t) => t.id === params.get("tipo")) || disponibles[0];
  const cantidad = params.get("cantidad") ?? "1";
  const [cliente, setCliente] = useState(""),
    [resumen, setResumen] = useState(false),
    [enviando, setEnviando] = useState(false),
    [error, setError] = useState("");
  const esAdmin = usuario?.rol === "ADMINISTRADOR";
  const cuentas = useConsulta("ListarUsuarios", {}, esAdmin);
  function elegir(k, v) {
    const p = new URLSearchParams(params);
    p.set(k, v);
    setParams(p, { replace: true });
  }
  function revisar(e) {
    e.preventDefault();
    setError("");
    if (!usuario) {
      navegar("/login", {
        state: {
          from: "/eventos/" + evento.id + "?" + new URLSearchParams({ tipo: tipo.id, cantidad }),
        },
      });
      return;
    }
    setResumen(true);
  }
  async function confirmar() {
    setEnviando(true);
    setError("");
    try {
      const { compra } = await comprar(usuario.id, esAdmin ? cliente : usuario.id, tipo, cantidad);
      navegar("/compras/" + compra.id, { state: { confirmada: true }, replace: true });
    } catch (err) {
      setError(err.message);
      setResumen(false);
      recargar(err.message);
    } finally {
      setEnviando(false);
    }
  }
  return (
    <aside className="compra-box">
      <div className="kicker">
        <Ticket size={16} />
        Venta de entradas
      </div>
      <h2>Elige tu entrada</h2>
      <Aviso>{error}</Aviso>
      {!tipo ? (
        <p>Las entradas para este evento están agotadas o la venta está cerrada.</p>
      ) : usuario?.rol === "ORGANIZADOR" ? (
        <p>
          Tu cuenta de organización puede consultar la disponibilidad. La compra requiere una cuenta de
          cliente o de administración.
        </p>
      ) : (
        <form onSubmit={revisar} className="formulario">
          <label>
            Tipo de entrada
            <select
              aria-label="Tipo de entrada"
              value={tipo.id}
              onChange={(e) => elegir("tipo", e.target.value)}
            >
              {disponibles.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.nombre} · {pesos(t.precio)}
                </option>
              ))}
            </select>
          </label>
          <label>
            Cantidad
            <input
              type="number"
              required
              min="1"
              max={Math.min(Number(tipo.cantidad_disponible), Number(evento.disponibles))}
              step="1"
              value={cantidad}
              onChange={(e) => elegir("cantidad", e.target.value)}
            />
          </label>
          <span className="detalle-menor">{tipo.cantidad_disponible} disponibles en esta localidad</span>
          {esAdmin && (
            <label>
              Cliente
              <select
                aria-label="Cliente"
                value={cliente}
                onChange={(e) => setCliente(e.target.value)}
                required
              >
                <option value="">Seleccionar cliente</option>
                {cuentas.data?.usuario
                  .filter((u) => u.rol === "CLIENTE" && u.estado === "ACTIVO")
                  .map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.nombre} · {u.usuario}
                    </option>
                  ))}
              </select>
              <Aviso>{cuentas.error}</Aviso>
            </label>
          )}
          <div className="total">
            <span>Total estimado</span>
            <strong>{pesos(importePedido(tipo.precio, cantidad))}</strong>
          </div>
          <button className="btn" type="submit">
            {usuario ? "Revisar compra" : "Iniciar sesión para comprar"}
          </button>
        </form>
      )}
      <Modal
        abierto={resumen && Boolean(tipo)}
        cerrar={() => setResumen(false)}
        titulo="Resumen de compra"
        bloqueado={enviando}
      >
        {tipo && (
          <>
            <h3>{evento.nombre}</h3>
            <dl className="ficha">
              <div>
                <dt>Localidad</dt>
                <dd>{tipo.nombre}</dd>
              </div>
              <div>
                <dt>Entradas</dt>
                <dd>
                  {cantidad} × {pesos(tipo.precio)}
                </dd>
              </div>
              <div>
                <dt>Total</dt>
                <dd>{pesos(importePedido(tipo.precio, cantidad))}</dd>
              </div>
            </dl>
          </>
        )}
        <div className="acciones">
          <button className="btn secundario" disabled={enviando} onClick={() => setResumen(false)}>
            Volver
          </button>
          <button className="btn" disabled={enviando} onClick={confirmar}>
            {enviando ? "Procesando…" : "Confirmar compra"}
          </button>
        </div>
      </Modal>
    </aside>
  );
}
