import { useEffect, useRef, useState } from "react";
import { Link, Navigate, useLocation, useNavigate } from "react-router-dom";
import { UserPlus } from "lucide-react";
import { Aviso } from "../components/Estados";
import { useAuth } from "../context/AuthContext";
import { soapRequest } from "../services/soapApi";

export default function Registro() {
  const { usuario } = useAuth();
  const { state } = useLocation();
  const navegar = useNavigate();
  const pendiente = useRef(null);
  const [ocupado, setOcupado] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => () => pendiente.current?.abort(), []);
  if (usuario) return <Navigate to="/panel" replace />;

  async function enviar(e) {
    e.preventDefault();
    if (pendiente.current) return;
    const f = new FormData(e.currentTarget);
    const datos = {
      identificacion: f.get("identificacion").trim(),
      nombre: f.get("nombre").trim(),
      usuario: f.get("usuario").trim(),
      password: f.get("password"),
    };
    if (!datos.identificacion || !datos.nombre || !datos.usuario)
      return setError("Completa la identificación, el nombre y el usuario.");
    if (!/^[\p{L}\p{N}_.@-]+$/u.test(datos.usuario))
      return setError("Usa letras, números, punto, guion, @ o guion bajo en el usuario.");
    if (datos.password.length < 10 || new TextEncoder().encode(datos.password).length > 72)
      return setError("Usa una contraseña de al menos 10 caracteres y máximo 72 bytes.");
    if (datos.password !== f.get("confirmacion")) return setError("Las contraseñas no coinciden.");

    const solicitud = new AbortController();
    pendiente.current = solicitud;
    setError("");
    setOcupado(true);
    try {
      const alta = await soapRequest("RegistrarUsuario", datos, { signal: solicitud.signal });
      navegar("/login", {
        replace: true,
        state: { from: state?.from, usuarioRegistrado: alta.usuario.usuario },
      });
    } catch (err) {
      if (!solicitud.signal.aborted) setError(err.message);
    } finally {
      pendiente.current = null;
      if (!solicitud.signal.aborted) setOcupado(false);
    }
  }

  return (
    <section className="pagina login-grid">
      <div>
        <span className="kicker con-raya">Acceso a EventPass</span>
        <h1>Registrarse</h1>
        <p>Crea tu cuenta de cliente para comprar entradas y consultar tus compras.</p>
        <Link className="texto-btn" to="/login" state={{ from: state?.from }}>
          Volver al inicio de sesión
        </Link>
      </div>
      <form className="panel-card formulario" onSubmit={enviar} aria-busy={ocupado}>
        <UserPlus className="azul" size={30} aria-hidden="true" />
        <label>
          Identificación
          <input name="identificacion" maxLength={40} required />
        </label>
        <label>
          Nombre completo
          <input name="nombre" autoComplete="name" maxLength={150} required />
        </label>
        <label>
          Nombre de usuario
          <input name="usuario" autoComplete="username" autoCapitalize="none" maxLength={80} required />
        </label>
        <div>
          <label>
            Contraseña
            <input name="password" type="password" autoComplete="new-password" minLength={10}
              aria-describedby="regla-clave" required />
          </label>
          <small id="regla-clave">Al menos 10 caracteres. Máximo 72 bytes.</small>
        </div>
        <label>
          Confirmar contraseña
          <input name="confirmacion" type="password" autoComplete="new-password" required />
        </label>
        <Aviso>{error}</Aviso>
        <button className="btn" disabled={ocupado}>
          {ocupado ? "Creando cuenta…" : "Crear cuenta"}
        </button>
      </form>
    </section>
  );
}
