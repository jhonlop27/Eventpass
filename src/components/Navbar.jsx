import { useState, useEffect } from "react";
import { Link, NavLink, useLocation, useNavigate } from "react-router-dom";
import { Ticket, UserRound, LogOut, Menu, X } from "lucide-react";
import { useAuth } from "../context/AuthContext";
export function Marca() {
  return (
    <Link className="marca" to="/" aria-label="EventPass, inicio">
      <span className="marca-sello">
        <Ticket size={25} strokeWidth={2.3} />
      </span>
      EventPass
    </Link>
  );
}
export default function Navbar() {
  const { usuario, cerrarSesion } = useAuth();
  const [abierto, setAbierto] = useState(false);
  const loc = useLocation(),
    navegar = useNavigate();
  useEffect(() => setAbierto(false), [loc.pathname]);
  function salir() {
    cerrarSesion();
    setAbierto(false);
    navegar("/");
  }
  return (
    <nav className="wrap nav" aria-label="Navegación principal">
      <Marca />
      <button
        type="button"
        className="menu-movil icono"
        aria-label={abierto ? "Cerrar menú" : "Abrir menú"}
        aria-expanded={abierto}
        aria-controls="enlaces"
        onClick={() => setAbierto(!abierto)}
      >
        {abierto ? <X /> : <Menu />}
      </button>
      <div className={"enlaces " + (abierto ? "abierto" : "")} id="enlaces">
        <NavLink end to="/">
          Inicio
        </NavLink>
        <NavLink to="/eventos">Eventos</NavLink>
        {usuario && (
          <NavLink to="/panel">{usuario.rol === "CLIENTE" ? "Mi cuenta" : "Mi panel"}</NavLink>
        )}
        {usuario ? (
          <button className="cuenta" onClick={salir}>
            <LogOut size={16} />
            Cerrar sesión
          </button>
        ) : (
          <NavLink className="cuenta" to="/login">
            <UserRound size={16} />
            Iniciar sesión
          </NavLink>
        )}
      </div>
    </nav>
  );
}
