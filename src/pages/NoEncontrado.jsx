import { Link } from "react-router-dom";
export default function NoEncontrado() {
  return (
    <section className="pagina">
      <span className="kicker con-raya">404</span>
      <h1>Página no encontrada</h1>
      <Link className="btn" to="/eventos">
        Volver al catálogo
      </Link>
    </section>
  );
}
