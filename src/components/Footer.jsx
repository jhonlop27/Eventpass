import { Link } from "react-router-dom";
import { Marca } from "./Navbar";
export default function Footer() {
  return (
    <footer>
      <div className="wrap pie">
        <Marca />
        <Link to="/eventos">Programación de eventos</Link>
        <span className="mono">© {new Date().getFullYear()} EventPass</span>
      </div>
    </footer>
  );
}
