import { useSearchParams } from "react-router-dom";
import { Search } from "lucide-react";
import { useConsulta } from "../services/useConsulta";
import { buscar } from "../data/presentacion";
import EventCard from "../components/EventCard";
import { Carga, Vacio } from "../components/Estados";
export default function Eventos() {
  const consulta = useConsulta("ListarEventos"),
    eventos = consulta.data?.evento || [];
  const [params, setParams] = useSearchParams(),
    q = params.get("q") || "",
    categoria = params.get("categoria") || "";
  function filtrar(k, v) {
    const p = new URLSearchParams(params);
    if (v) p.set(k, v);
    else p.delete(k);
    setParams(p, { replace: true });
  }
  const categorias = [...new Set(eventos.map((e) => e.categoria))].sort();
  const lista = eventos.filter(
    (e) =>
      (!categoria || e.categoria === categoria) &&
      buscar(e.nombre + " " + e.ubicacion).includes(buscar(q)),
  );
  return (
    <section className="pagina">
      <div className="kicker con-raya">Programación</div>
      <h1>Catálogo de eventos</h1>
      <div className="filtros">
        <label>
          Buscar evento
          <span className="entrada-icono">
            <Search size={17} />
            <input
              type="search"
              value={q}
              onChange={(e) => filtrar("q", e.target.value)}
              placeholder="Nombre o ubicación"
            />
          </span>
        </label>
        <label>
          Categoría
          <select value={categoria} onChange={(e) => filtrar("categoria", e.target.value)}>
            <option value="">Todas las categorías</option>
            {categorias.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
        </label>
      </div>
      <Carga consulta={consulta}>
        <p className="conteo mono">
          {lista.length} {lista.length === 1 ? "evento" : "eventos"}
        </p>
        {lista.length ? (
          lista.map((e) => <EventCard key={e.id} evento={e} />)
        ) : (
          <Vacio
            texto={
              eventos.length
                ? "No hay coincidencias para estos filtros."
                : "Aún no hay eventos publicados."
            }
          >
            {(q || categoria) && (
              <button className="btn secundario" onClick={() => setParams({})}>
                Limpiar filtros
              </button>
            )}
          </Vacio>
        )}
      </Carga>
    </section>
  );
}
