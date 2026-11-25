import { useCallback, useId, useState } from "react";
import { Plus, Search } from "lucide-react";
import { useConsulta } from "../services/useConsulta";
import { soapRequest } from "../services/soapApi";
import { buscar } from "../data/presentacion";
import { Aviso, Carga } from "./Estados";
import Modal from "./Modal";
import Toast from "./Toast";
import Tabla from "./Tabla";

export function Campo({ campo: c, valor, cambiar }) {
  const id = useId();
  const props = {
    id,
    name: c.nombre,
    value: valor ?? "",
    onChange: (e) => cambiar(e.target.value),
    required: !c.opcional,
    disabled: c.fijo,
    autoComplete: c.tipo === "password" ? "new-password" : "off",
  };
  return (
    <div className={"campo " + (c.tipo === "textarea" ? "campo-amplio" : "")}>
      <label htmlFor={id}>{c.etiqueta}</label>
      {c.opciones ? (
        <select {...props}>
          <option value="">Seleccionar</option>
          {c.opciones.map((o) => {
            const [v, l] = Array.isArray(o) ? o : [o, o];
            return (
              <option key={v} value={v}>
                {l}
              </option>
            );
          })}
        </select>
      ) : c.tipo === "textarea" ? (
        <textarea {...props} maxLength={c.max || 3000} rows="3" />
      ) : (
        <input
          {...props}
          type={c.tipo || "text"}
          maxLength={c.tipo === "number" ? undefined : c.max}
          minLength={c.minLength}
          min={c.min}
          max={c.tipo === "number" ? c.max : undefined}
          step={c.step}
        />
      )}
      {c.ayuda && <small>{c.ayuda}</small>}
    </div>
  );
}
export default function GestorEntidades({
  titulo,
  singular,
  entidad,
  lista,
  elemento,
  gestion = false,
  campos,
  columnas,
  dependencias = [],
  vacio,
}) {
  const q = useConsulta(lista, gestion ? { gestion: true } : {});
  const [buscarPor, setBuscarPor] = useState(""),
    [modal, setModal] = useState(null),
    [datos, setDatos] = useState({});
  const [error, setError] = useState(""),
    [ocupado, setOcupado] = useState(false),
    [mensaje, setMensaje] = useState("");
  const cerrarToast = useCallback(() => setMensaje(""), []);
  const definicion = campos(modal?.fila);
  function abrir(accion, fila) {
    const form = {};
    for (const c of campos(fila))
      form[c.nombre] = c.tipo === "password" ? "" : (fila?.[c.nombre] ?? c.inicial ?? "");
    setDatos(form);
    setError("");
    setModal({ accion, fila });
  }
  async function enviar(e) {
    e.preventDefault();
    setOcupado(true);
    setError("");
    try {
      const borrando = modal.accion === "Eliminar",
        editando = modal.accion === "Actualizar";
      const payload = modal.fila ? { id: modal.fila.id } : {};
      if (!borrando)
        for (const c of definicion) {
          if (c.omitirAlEditar && editando) continue;
          if (c.opcional && datos[c.nombre] === "") continue;
          payload[c.nombre] = datos[c.nombre];
        }
      await soapRequest(modal.accion + entidad, payload);
      setModal(null);
      setMensaje(borrando ? "Registro eliminado." : "Cambios guardados.");
      q.recargar();
    } catch (err) {
      setError(err.message);
    } finally {
      setOcupado(false);
    }
  }
  const consultaDependiente = dependencias.find((d) => d.error || d.cargando);
  const filas = (q.data?.[elemento] || []).filter((f) =>
    buscar(
      [f.nombre, f.usuario, f.identificacion, f.codigo, f.evento_nombre].filter(Boolean).join(" "),
    ).includes(buscar(buscarPor)),
  );
  return (
    <>
      <div className="cabecera-seccion">
        <h1>{titulo}</h1>
        <button className="btn" disabled={Boolean(consultaDependiente)} onClick={() => abrir("Crear")}>
          <Plus size={17} />
          Crear {singular}
        </button>
      </div>
      {consultaDependiente?.error && <Aviso>{consultaDependiente.error}</Aviso>}
      <label className="busca-tabla">
        Buscar
        <span className="entrada-icono">
          <Search size={17} />
          <input
            type="search"
            value={buscarPor}
            onChange={(e) => setBuscarPor(e.target.value)}
            placeholder="Nombre o identificador"
          />
        </span>
      </label>
      <Carga consulta={q}>
        <Tabla
          filas={filas}
          columnas={columnas}
          vacio={buscarPor ? "No hay coincidencias." : vacio}
          acciones={(f) => (
            <>
              <button
                className="texto-btn"
                disabled={Boolean(consultaDependiente)}
                onClick={() => abrir("Actualizar", f)}
              >
                Editar
              </button>
              <button className="texto-btn peligro" onClick={() => abrir("Eliminar", f)}>
                Eliminar
              </button>
            </>
          )}
        />
      </Carga>
      <Modal
        abierto={!!modal}
        titulo={(modal?.accion === "Actualizar" ? "Editar" : modal?.accion || "") + " " + singular}
        cerrar={() => setModal(null)}
        bloqueado={ocupado}
      >
        <form className="formulario" onSubmit={enviar}>
          {modal?.accion === "Eliminar" ? (
            <p>
              ¿Eliminar <strong>{modal.fila.nombre}</strong>? El servidor comprueba si está vinculado a
              otros registros.
            </p>
          ) : (
            <div className="campos">
              {definicion.map((c) => (
                <Campo
                  key={c.nombre}
                  campo={c}
                  valor={datos[c.nombre]}
                  cambiar={(v) => setDatos((d) => ({ ...d, [c.nombre]: v }))}
                />
              ))}
            </div>
          )}
          <Aviso>{error}</Aviso>
          <div className="acciones">
            <button
              type="button"
              className="btn secundario"
              disabled={ocupado}
              onClick={() => setModal(null)}
            >
              Volver
            </button>
            <button
              className={"btn " + (modal?.accion === "Eliminar" ? "destructivo" : "")}
              disabled={ocupado}
            >
              {ocupado
                ? "Guardando…"
                : modal?.accion === "Eliminar"
                  ? "Confirmar eliminación"
                  : "Guardar"}
            </button>
          </div>
        </form>
      </Modal>
      <Toast mensaje={mensaje} cerrar={cerrarToast} />
    </>
  );
}
