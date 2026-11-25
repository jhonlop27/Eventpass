import { useState } from "react";
import { ScanLine, CheckCircle2 } from "lucide-react";
import { soapRequest } from "../services/soapApi";
import { Aviso } from "../components/Estados";
export default function Validar() {
  const [codigo, setCodigo] = useState(""),
    [entrada, setEntrada] = useState(null),
    [error, setError] = useState(""),
    [ocupado, setOcupado] = useState(false);
  async function validar(e) {
    e.preventDefault();
    setError("");
    setEntrada(null);
    setOcupado(true);
    try {
      const r = await soapRequest("ValidarEntrada", { codigo: codigo.trim() });
      setEntrada(r.entrada);
      setCodigo("");
    } catch (err) {
      setError(err.message);
    } finally {
      setOcupado(false);
    }
  }
  return (
    <>
      <span className="kicker con-raya">Control de acceso</span>
      <h1>Validar entrada</h1>
      <form className="panel-card formulario" onSubmit={validar}>
        <label>
          Código de entrada
          <input
            className="mono"
            autoComplete="off"
            placeholder="EP-…"
            maxLength="60"
            value={codigo}
            onChange={(e) => setCodigo(e.target.value)}
            required
          />
        </label>
        <button className="btn" disabled={ocupado}>
          <ScanLine size={18} />
          {ocupado ? "Validando…" : "Validar código"}
        </button>
        <Aviso>{error}</Aviso>
        {entrada && (
          <div className="confirmacion" role="status">
            <CheckCircle2 />
            <div>
              <strong>Acceso registrado</strong>
              <p>
                {entrada.evento_nombre} · {entrada.tipo_nombre}
              </p>
              <code>{entrada.codigo}</code>
            </div>
          </div>
        )}
      </form>
    </>
  );
}
