import { useState } from "react";
import { Link, useLocation, useNavigate, Navigate } from "react-router-dom";
import { CircleCheck, Ticket } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { Aviso } from "../components/Estados";
export default function Login() {
  const { iniciarSesion, usuario } = useAuth(),
    navegar = useNavigate(),
    loc = useLocation();
  const [error, setError] = useState(""),
    [ocupado, setOcupado] = useState(false);
  const from = loc.state?.from,
    destino = typeof from === "string" && /^\/(?!\/)/.test(from) ? from : "/panel";
  if (usuario) return <Navigate to={destino} replace />;
  async function enviar(e) {
    e.preventDefault();
    const data = new FormData(e.currentTarget);
    setOcupado(true);
    setError("");
    try {
      await iniciarSesion(data.get("usuario"), data.get("password"));
      navegar(destino, { replace: true });
    } catch (err) {
      setError(err.message);
    } finally {
      setOcupado(false);
    }
  }
  return (
    <section className="pagina login-grid">
      <div>
        <span className="kicker con-raya">Acceso a EventPass</span>
        <h1>Iniciar sesión</h1>
        <p>Ingresa con tu usuario para comprar entradas o gestionar tus eventos.</p>
        <Link className="texto-btn" to="/eventos">
          Consultar la programación
        </Link>
      </div>
      <form onSubmit={enviar} className="panel-card formulario">
        <Ticket className="azul" size={30} />
        {loc.state?.usuarioRegistrado && (
          <p className="confirmacion" role="status">
            <CircleCheck size={18} aria-hidden="true" />
            Cuenta creada. Ya puedes iniciar sesión.
          </p>
        )}
        <label>
          Usuario
          <input autoComplete="username" name="usuario" maxLength={80} required autoCapitalize="none"
            defaultValue={loc.state?.usuarioRegistrado || ""} />
        </label>
        <label>
          Contraseña
          <input autoComplete="current-password" name="password" type="password" required />
        </label>
        <Aviso>{error}</Aviso>
        <button className="btn" disabled={ocupado}>
          {ocupado ? "Ingresando…" : "Ingresar"}
        </button>
        <Link className="texto-btn" to="/registro" state={{ from }}>Registrarse</Link>
      </form>
    </section>
  );
}
