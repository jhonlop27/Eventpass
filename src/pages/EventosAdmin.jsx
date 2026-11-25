import GestorEntidades from "../components/GestorEntidades";
import { useAuth } from "../context/AuthContext";
import { useConsulta } from "../services/useConsulta";
import { Estado } from "../components/Estados";
import { calendario } from "../data/presentacion";
export default function EventosAdmin() {
  const { usuario } = useAuth(),
    admin = usuario.rol === "ADMINISTRADOR";
  const users = useConsulta("ListarUsuarios", {}, admin);
  const campos = () => [
    { nombre: "codigo", etiqueta: "Código", max: 48 },
    { nombre: "nombre", etiqueta: "Nombre del evento", max: 150 },
    ...(admin
      ? [
          {
            nombre: "organizador_id",
            etiqueta: "Organizador",
            inicial: usuario.id,
            opciones: (users.data?.usuario || [])
              .filter((u) => u.rol !== "CLIENTE" && u.estado === "ACTIVO")
              .map((u) => [u.id, u.nombre]),
          },
        ]
      : []),
    { nombre: "categoria", etiqueta: "Categoría", max: 80 },
    { nombre: "ubicacion", etiqueta: "Ubicación", max: 200 },
    { nombre: "fecha", etiqueta: "Fecha", tipo: "date" },
    { nombre: "hora", etiqueta: "Hora", tipo: "time", step: "1" },
    {
      nombre: "capacidad_total",
      etiqueta: "Capacidad total",
      tipo: "number",
      min: 1,
      max: 2147483647,
      step: 1,
    },
    {
      nombre: "estado",
      etiqueta: "Estado",
      opciones: ["BORRADOR", "ACTIVO", "CERRADO"],
      inicial: "BORRADOR",
    },
    { nombre: "descripcion", etiqueta: "Descripción", tipo: "textarea" },
  ];
  return (
    <GestorEntidades
      titulo={admin ? "Eventos" : "Mis eventos"}
      singular="evento"
      entidad="Evento"
      lista="ListarEventos"
      elemento="evento"
      gestion
      campos={campos}
      dependencias={admin ? [users] : []}
      columnas={[
        { titulo: "Evento", campo: "nombre" },
        { titulo: "Fecha", ver: (e) => calendario(e.fecha) },
        { titulo: "Aforo", campo: "capacidad_total" },
        { titulo: "Estado", ver: (e) => <Estado valor={e.estado} /> },
      ]}
      vacio="Aún no hay eventos en tu gestión."
    />
  );
}
