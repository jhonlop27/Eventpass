import GestorEntidades from "../components/GestorEntidades";
import { useConsulta } from "../services/useConsulta";
import { Estado } from "../components/Estados";
import { pesos } from "../data/presentacion";
export default function TiposAdmin() {
  const eventos = useConsulta("ListarEventos", { gestion: true });
  const campos = (f) => [
    {
      nombre: "evento_id",
      etiqueta: "Evento",
      opciones: (eventos.data?.evento || []).map((e) => [e.id, e.nombre]),
      fijo: !!f,
      omitirAlEditar: true,
    },
    { nombre: "nombre", etiqueta: "Nombre de la localidad", max: 100 },
    {
      nombre: "precio",
      etiqueta: "Precio (COP)",
      tipo: "number",
      min: 0,
      max: 9999999999.99,
      step: "0.01",
    },
    {
      nombre: "capacidad_asignada",
      etiqueta: "Capacidad asignada",
      tipo: "number",
      min: 0,
      max: 2147483647,
      step: 1,
    },
    { nombre: "estado", etiqueta: "Estado", opciones: ["ACTIVO", "INACTIVO"], inicial: "ACTIVO" },
  ];
  return (
    <GestorEntidades
      titulo="Tipos de entrada"
      singular="tipo de entrada"
      entidad="TipoEntrada"
      lista="ListarTiposEntrada"
      elemento="tipo"
      gestion
      campos={campos}
      dependencias={[eventos]}
      columnas={[
        { titulo: "Localidad", campo: "nombre" },
        { titulo: "Evento", campo: "evento_nombre" },
        { titulo: "Precio", ver: (t) => pesos(t.precio) },
        { titulo: "Disponibles", ver: (t) => t.cantidad_disponible + " / " + t.capacidad_asignada },
        { titulo: "Estado", ver: (t) => <Estado valor={t.estado} /> },
      ]}
      vacio="Crea un evento y asígnale su primera localidad."
    />
  );
}
