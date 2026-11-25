import { Link, NavLink, Outlet } from "react-router-dom";
import { LayoutDashboard, CalendarDays, Users, Layers, Receipt, Ticket, ScanLine } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { useConsulta } from "../services/useConsulta";
import { rolesTexto } from "../data/presentacion";
import { Carga } from "../components/Estados";
export function Panel() {
  const { usuario: u } = useAuth(),
    admin = u.rol === "ADMINISTRADOR",
    personal = u.rol !== "CLIENTE";
  const enlaces = [
    ["/panel", "Resumen", LayoutDashboard],
    ...(admin ? [["/panel/usuarios", "Usuarios", Users]] : []),
    ...(personal
      ? [
          ["/panel/eventos", admin ? "Eventos" : "Mis eventos", CalendarDays],
          ["/panel/tipos", "Tipos de entrada", Layers],
        ]
      : [["/eventos", "Eventos disponibles", CalendarDays]]),
    ["/panel/compras", personal ? "Compras" : "Mis compras", Receipt],
    ["/panel/entradas", personal ? "Entradas" : "Mis entradas", Ticket],
    ...(personal ? [["/panel/validar", "Validar entrada", ScanLine]] : []),
  ];
  return (
    <div className="pagina panel-layout">
      <aside className="lateral">
        <span className="kicker">{rolesTexto[u.rol]}</span>
        <strong>{u.nombre}</strong>
        <nav aria-label="Menú del panel">
          {enlaces.map(([to, label, Icon]) => (
            <NavLink end to={to} key={to}>
              <Icon size={17} />
              {label}
            </NavLink>
          ))}
        </nav>
      </aside>
      <section className="panel-contenido">
        <Outlet />
      </section>
    </div>
  );
}
export function Dashboard() {
  const { usuario } = useAuth(),
    personal = usuario.rol !== "CLIENTE";
  const e = useConsulta("ListarEventos", personal ? { gestion: true } : {}),
    c = useConsulta("ListarCompras"),
    i = useConsulta("ListarEntradas");
  const tarjetas = [
    [
      personal ? "Eventos a cargo" : "Eventos en cartelera",
      e,
      "evento",
      personal ? "/panel/eventos" : "/eventos",
      CalendarDays,
    ],
    [personal ? "Compras registradas" : "Mis compras", c, "compra", "/panel/compras", Receipt],
    [personal ? "Entradas registradas" : "Mis entradas", i, "entrada", "/panel/entradas", Ticket],
  ];
  return (
    <>
      <div className="kicker con-raya">Panel de {rolesTexto[usuario.rol].toLowerCase()}</div>
      <h1>Resumen</h1>
      <div className="resumen-grid">
        {tarjetas.map(([label, q, campo, url, Icon]) => (
          <article className="metrica" key={campo}>
            <Icon size={22} />
            <Carga consulta={q}>
              <b>{q.data?.[campo]?.length ?? 0}</b>
            </Carga>
            <Link to={url}>{label}</Link>
          </article>
        ))}
      </div>
      <div className="atajo">
        <h2>{personal ? "Control de acceso" : "Próxima compra"}</h2>
        <Link className="btn" to={personal ? "/panel/validar" : "/eventos"}>
          {personal ? "Validar una entrada" : "Explorar eventos"}
        </Link>
      </div>
    </>
  );
}
