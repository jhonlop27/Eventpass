import { useCallback, useState } from "react";
import { Link, useParams, useLocation } from "react-router-dom";
import { CheckCircle2, Ticket, MapPin, CalendarDays } from "lucide-react";
import { useConsulta } from "../services/useConsulta";
import { soapRequest } from "../services/soapApi";
import { useAuth } from "../context/AuthContext";
import { buscar, calendario, pesos } from "../data/presentacion";
import { Aviso, Carga, Estado, Vacio } from "../components/Estados";
import Tabla from "../components/Tabla";
import Modal from "../components/Modal";
import Toast from "../components/Toast";

const accionesCompra = {
  responsable: { titulo: "Cambiar responsable", operacion: "ActualizarCompra" },
  cancelar: {
    titulo: "Cancelar compra",
    operacion: "EliminarCompra",
    texto:
      "Las entradas sin usar se cancelarán y sus cupos volverán al inventario. Una compra con ingresos registrados debe gestionarse por entrada.",
  },
};
const accionesEntrada = {
  reemitir: {
    titulo: "Reemitir entrada",
    operacion: "CrearEntrada",
    texto: "Se reemplazará el código actual por uno nuevo para la misma localidad y el mismo precio.",
  },
  cancelar: {
    titulo: "Cancelar entrada",
    operacion: "EliminarEntrada",
    texto: "El código quedará cancelado y se devolverá una plaza al inventario.",
  },
  utilizar: {
    titulo: "Registrar ingreso",
    operacion: "ActualizarEntrada",
    texto: "La entrada pasará a utilizada y el código quedará consumido.",
  },
};
export function Movimientos({ entradas = false }) {
  const { usuario } = useAuth(),
    admin = usuario.rol === "ADMINISTRADOR",
    cliente = usuario.rol === "CLIENTE";
  const q = useConsulta(entradas ? "ListarEntradas" : "ListarCompras");
  const [filtro, setFiltro] = useState(""),
    [accion, setAccion] = useState(null),
    [fila, setFila] = useState(null),
    [responsable, setResponsable] = useState("");
  const [error, setError] = useState(""),
    [ocupado, setOcupado] = useState(false),
    [mensaje, setMensaje] = useState("");
  const cerrarToast = useCallback(() => setMensaje(""), []);
  const personas = useConsulta("ListarUsuarios", {}, admin && accion === "responsable");
  const acciones = entradas ? accionesEntrada : accionesCompra,
    config = acciones[accion];
  function abrir(f, k) {
    setFila(f);
    setAccion(k);
    setError("");
    setResponsable(f.usuario_responsable_id || "");
  }
  async function aplicar(e) {
    e.preventDefault();
    setOcupado(true);
    setError("");
    const args = accion === "reemitir" ? { entrada_origen_id: fila.id } : { id: fila.id };
    if (accion === "responsable") args.usuario_responsable_id = responsable;
    if (accion === "utilizar") args.estado = "UTILIZADA";
    try {
      const r = await soapRequest(config.operacion, args);
      setAccion(null);
      setMensaje(accion === "reemitir" ? "Nuevo código: " + r.entrada.codigo : "Cambio registrado.");
      q.recargar();
    } catch (err) {
      setError(err.message);
    } finally {
      setOcupado(false);
    }
  }
  const items = (q.data?.[entradas ? "entrada" : "compra"] || []).filter((f) =>
    buscar(
      [f.codigo, f.evento_nombre, f.tipo_nombre, f.cliente_nombre, f.estado].filter(Boolean).join(" "),
    ).includes(buscar(filtro)),
  );
  const columnas = [
    {
      titulo: "Evento",
      ver: (f) => (
        <>
          <strong>{f.evento_nombre}</strong>
          <small>{f.tipo_nombre}</small>
        </>
      ),
    },
    entradas
      ? { titulo: "Código", ver: (f) => <code>{f.codigo}</code> }
      : {
          titulo: "Compra",
          ver: (f) => (
            <>
              <span>{f.cliente_nombre}</span>
              <small>
                {f.cantidad_entradas} entrada(s) · {pesos(f.valor_total)}
              </small>
            </>
          ),
        },
    { titulo: "Estado", ver: (f) => <Estado valor={f.estado} /> },
  ];
  return (
    <>
      <div className="cabecera-seccion">
        <h1>
          {entradas ? (cliente ? "Mis entradas" : "Entradas") : cliente ? "Mis compras" : "Compras"}
        </h1>
        {!entradas && (admin || cliente) && (
          <Link className="btn" to="/eventos">
            {admin ? "Registrar compra" : "Comprar entradas"}
          </Link>
        )}
      </div>
      <label className="busca-tabla">
        Buscar
        <input
          type="search"
          value={filtro}
          onChange={(e) => setFiltro(e.target.value)}
          placeholder="Código o evento"
        />
      </label>
      <Carga consulta={q}>
        <Tabla
          columnas={columnas}
          filas={items}
          vacio={
            filtro
              ? "No hay coincidencias."
              : entradas
                ? "Aún no hay entradas en tu cuenta o tus eventos."
                : "Aún no hay compras registradas."
          }
          acciones={(f) => (
            <>
              <Link className="texto-btn" to={(entradas ? "/entradas/" : "/compras/") + f.id}>
                Ver detalle
              </Link>
              {admin &&
                (entradas ? f.estado === "EMITIDA" : f.estado === "CONFIRMADA") &&
                Object.entries(acciones).map(([k, v]) => (
                  <button
                    key={k}
                    className={"texto-btn " + (k === "cancelar" ? "peligro" : "")}
                    onClick={() => abrir(f, k)}
                  >
                    {v.titulo}
                  </button>
                ))}
            </>
          )}
        />
      </Carga>
      <Modal
        abierto={!!accion}
        titulo={config?.titulo || ""}
        cerrar={() => setAccion(null)}
        bloqueado={ocupado}
      >
        <form className="formulario" onSubmit={aplicar}>
          <code>{fila?.codigo}</code>
          {config?.texto && <p>{config.texto}</p>}
          {accion === "responsable" && (
            <Carga consulta={personas}>
              <label>
                Responsable
                <select required value={responsable} onChange={(e) => setResponsable(e.target.value)}>
                  <option value="">Seleccionar responsable</option>
                  {personas.data?.usuario
                    .filter((u) => u.estado === "ACTIVO" && u.rol !== "CLIENTE")
                    .map((u) => (
                      <option value={u.id} key={u.id}>
                        {u.nombre}
                      </option>
                    ))}
                </select>
              </label>
            </Carga>
          )}
          <Aviso>{error}</Aviso>
          <div className="acciones">
            <button
              type="button"
              disabled={ocupado}
              className="btn secundario"
              onClick={() => setAccion(null)}
            >
              Volver
            </button>
            <button
              className={"btn " + (accion === "cancelar" ? "destructivo" : "")}
              disabled={ocupado || (accion === "responsable" && !responsable)}
            >
              {ocupado ? "Procesando…" : "Confirmar"}
            </button>
          </div>
        </form>
      </Modal>
      <Toast mensaje={mensaje} cerrar={cerrarToast} />
    </>
  );
}
function Pase({ entrada: i, detalle = false }) {
  return (
    <article className="pase">
      <div className="pase-marca">
        <Ticket size={22} />
        <span>EventPass</span>
      </div>
      <div className="pase-datos">
        <div className="cabecera-seccion">
          <span className="kicker azul">{i.tipo_nombre}</span>
          <Estado valor={i.estado} />
        </div>
        <h2>{i.evento_nombre}</h2>
        <div className="datos-evento">
          <span>
            <CalendarDays />
            {calendario(i.evento_fecha)} · {i.evento_hora.slice(0, 5)}
          </span>
          <span>
            <MapPin />
            {i.ubicacion}
          </span>
        </div>
        <div className="pase-codigo">
          <span className="kicker">Código de acceso</span>
          <code>{i.codigo}</code>
        </div>
        <div className="pase-pie">
          <span>
            Precio pagado <strong>{pesos(i.precio_pagado)}</strong>
          </span>
          {!detalle && (
            <Link className="texto-btn" to={"/entradas/" + i.id}>
              Ver entrada
            </Link>
          )}
        </div>
      </div>
    </article>
  );
}
export function DetalleCompra() {
  const { id } = useParams(),
    loc = useLocation(),
    q = useConsulta("ObtenerCompra", { id }),
    c = q.data?.compra;
  return (
    <section className="pagina">
      <Link className="miga" to="/panel/compras">
        Volver a compras
      </Link>
      <Carga consulta={q}>
        {c && (
          <>
            {loc.state?.confirmada && c.estado === "CONFIRMADA" && (
              <div className="confirmacion" role="status">
                <CheckCircle2 />
                <strong>Compra confirmada</strong>
              </div>
            )}
            <div className="kicker con-raya">Comprobante</div>
            <h1>Detalle de compra</h1>
            <div className="recibo">
              <div>
                <h2>{c.evento_nombre}</h2>
                <code>{c.codigo}</code>
              </div>
              <Estado valor={c.estado} />
            </div>
            <dl className="ficha horizontal">
              <div>
                <dt>Cliente</dt>
                <dd>{c.cliente_nombre}</dd>
              </div>
              <div>
                <dt>Fecha de compra</dt>
                <dd>{calendario(c.fecha)}</dd>
              </div>
              <div>
                <dt>Entradas vigentes</dt>
                <dd>
                  {c.vigentes} de {c.cantidad_entradas}
                </dd>
              </div>
              <div>
                <dt>Total original</dt>
                <dd>{pesos(c.valor_total)}</dd>
              </div>
            </dl>
            <h2>Entradas de la compra</h2>
            <div className="pases">
              {q.data.entrada.map((i) => (
                <Pase entrada={i} key={i.id} />
              ))}
            </div>
          </>
        )}
      </Carga>
    </section>
  );
}
export function DetalleEntrada() {
  const { id } = useParams(),
    q = useConsulta("ObtenerEntrada", { id }),
    i = q.data?.entrada;
  return (
    <section className="pagina">
      <Link className="miga" to="/panel/entradas">
        Volver a entradas
      </Link>
      <div className="kicker con-raya">Admisión</div>
      <h1>Entrada digital</h1>
      <Carga consulta={q}>
        {i ? (
          <>
            <Pase entrada={i} detalle />
            <Link className="texto-btn" to={"/compras/" + i.compra_id}>
              Ver compra asociada
            </Link>
          </>
        ) : (
          <Vacio texto="No hay una entrada disponible." />
        )}
      </Carga>
    </section>
  );
}
