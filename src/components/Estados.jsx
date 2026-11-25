import { CalendarDays, CircleAlert } from "lucide-react";
import { etiquetaEstado } from "../data/presentacion";
export function Aviso({ children }) {
  return children ? (
    <p className="aviso" role="alert">
      <CircleAlert size={18} />
      <span>{children}</span>
    </p>
  ) : null;
}
export function Vacio({ texto, children }) {
  return (
    <div className="vacio">
      <CalendarDays size={25} />
      <p>{texto}</p>
      {children}
    </div>
  );
}
export function Carga({ consulta, children }) {
  if (consulta.cargando)
    return (
      <div className="esqueleto" role="status" aria-label="Cargando datos">
        <i />
        <i />
        <i />
      </div>
    );
  if (consulta.error)
    return (
      <div>
        <Aviso>{consulta.error}</Aviso>
        <button className="texto-btn" onClick={consulta.recargar}>
          Volver a intentar
        </button>
      </div>
    );
  return children;
}
export function Estado({ valor }) {
  return <span className={"estado estado-" + valor}>{etiquetaEstado(valor)}</span>;
}
