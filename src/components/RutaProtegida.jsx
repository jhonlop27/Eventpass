import { Navigate, useLocation, Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
export default function RutaProtegida({ children, rolesPermitidos }) {
  const { usuario } = useAuth();
  const loc = useLocation();
  if (!usuario) return <Navigate to="/login" state={{ from: loc.pathname + loc.search }} replace />;
  if (!rolesPermitidos.includes(usuario.rol))
    return (
      <section className="pagina">
        <h1>Acceso restringido</h1>
        <p>Esta sección requiere otro rol.</p>
        <Link to="/panel" className="btn">
          Volver a mi panel
        </Link>
      </section>
    );
  return children;
}
