import { useState } from "react";
import { Link } from "react-router-dom";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { calendario, categoriaArte } from "../data/presentacion";
export function Cartel({ categoria, className = "" }) {
  const tipo = categoriaArte(categoria);
  if (tipo === "musica")
    return (
      <img
        className={"foto " + className}
        src="/imagenes/concierto.webp"
        alt=""
        width="1400"
        height="933"
      />
    );
  return (
    <svg
      aria-hidden="true"
      className={"cartel-arte " + className}
      viewBox="0 0 520 320"
      preserveAspectRatio="xMidYMid slice"
    >
      <rect width="520" height="320" fill={tipo === "artes" ? "#D82C2C" : "#0033A0"} />
      {tipo === "artes"
        ? Array.from({ length: 13 }, (_, i) => (
            <circle
              key={i}
              cx="355"
              cy="185"
              r={12 + i * 18}
              fill="none"
              stroke="#1A1A1A"
              strokeWidth="8"
            />
          ))
        : Array.from({ length: 12 }, (_, i) => (
            <path key={i} d={`M${i * 48 - 150} 320 l210 -320 h22 l-210 320z`} fill="#F2F2F2" />
          ))}
    </svg>
  );
}
export default function EventoDestacado({ eventos }) {
  const [indice, setIndice] = useState(0);
  const actual = indice % Math.max(eventos.length, 1),
    e = eventos[actual];
  return (
    <div className="destacado">
      <Cartel categoria={e?.categoria || "Música"} />
      {e && (
        <>
          <div className="fecha-sello">
            <strong>{calendario(e.fecha, { day: "2-digit" })}</strong>
            <span>{calendario(e.fecha, { month: "short" }).replace(".", "")}</span>
          </div>
          <div className="destacado-pie">
            <div>
              <span className="kicker">En cartelera · {e.categoria}</span>
              <Link to={"/eventos/" + e.id}>{e.nombre}</Link>
            </div>
            {eventos.length > 1 && (
              <div className="carrusel">
                <button
                  aria-label="Evento destacado anterior"
                  onClick={() => setIndice((actual + eventos.length - 1) % eventos.length)}
                >
                  <ChevronLeft />
                </button>
                <button
                  aria-label="Siguiente evento destacado"
                  onClick={() => setIndice((actual + 1) % eventos.length)}
                >
                  <ChevronRight />
                </button>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
