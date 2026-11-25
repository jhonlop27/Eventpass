import { Link } from "react-router-dom";
import { CalendarDays, MapPin, Ticket } from "lucide-react";
import { calendario, pesos } from "../data/presentacion";
import { Cartel } from "./EventoDestacado";
export default function EventCard({ evento: e }) {
  return (
    <article className="evento-fila">
      <Link className="mini-cartel" to={"/eventos/" + e.id} aria-label={"Ver " + e.nombre}>
        <Cartel categoria={e.categoria} />
      </Link>
      <div className="evento-info">
        <span className="kicker azul">{e.categoria}</span>
        <h3>
          <Link to={"/eventos/" + e.id}>{e.nombre}</Link>
        </h3>
        <div className="metas">
          <span>
            <CalendarDays />
            {calendario(e.fecha, { day: "numeric", month: "short" })} · {e.hora.slice(0, 5)}
          </span>
          <span>
            <MapPin />
            {e.ubicacion}
          </span>
        </div>
      </div>
      <div className="evento-venta">
        <strong>{e.precio_desde != null ? "Desde " + pesos(e.precio_desde) : "Sin cupos"}</strong>
        <Link to={"/eventos/" + e.id} className="texto-btn">
          <Ticket size={16} />
          Ver evento
        </Link>
      </div>
    </article>
  );
}
