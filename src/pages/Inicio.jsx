import { Link } from "react-router-dom";
import { CalendarDays } from "lucide-react";
import { useConsulta } from "../services/useConsulta";
import EventoDestacado from "../components/EventoDestacado";
import EventCard from "../components/EventCard";
import { Carga, Vacio } from "../components/Estados";
export default function Inicio() {
  const consulta = useConsulta("ListarEventos"),
    eventos = consulta.data?.evento || [];
  return (
    <div className="pagina inicio">
      <section className="hero">
        <div className="hero-texto">
          <div className="kicker con-raya">Programación cultural</div>
          <h1>
            Agenda <br />
            en vivo<span>.</span>
          </h1>
          <p>Conciertos, exposiciones y conferencias. Consulta la programación y elige tus entradas.</p>
          <Link className="btn" to="/eventos">
            <CalendarDays size={18} />
            Explorar eventos
          </Link>
        </div>
        <EventoDestacado eventos={eventos.slice(0, 4)} />
      </section>
      <section className="cartelera">
        <div className="cabecera-seccion">
          <h2>Próximos eventos</h2>
          <Link className="texto-btn" to="/eventos">
            Ver catálogo completo
          </Link>
        </div>
        <Carga consulta={consulta}>
          {eventos.length ? (
            eventos.slice(0, 4).map((e) => <EventCard key={e.id} evento={e} />)
          ) : (
            <Vacio texto="Aún no hay eventos publicados." />
          )}
        </Carga>
      </section>
    </div>
  );
}
