import GestorEntidades from "../components/GestorEntidades";
import { Estado } from "../components/Estados";
import { ROLES, rolesTexto } from "../data/presentacion";
export default function UsuariosAdmin() {
  const campos = (f) => [
    { nombre: "identificacion", etiqueta: "Identificación", max: 40 },
    { nombre: "nombre", etiqueta: "Nombre", max: 150 },
    { nombre: "usuario", etiqueta: "Usuario", max: 80 },
    {
      nombre: "password",
      etiqueta: f ? "Nueva contraseña (opcional)" : "Contraseña",
      tipo: "password",
      minLength: 10,
      max: 72,
      opcional: !!f,
    },
    {
      nombre: "rol",
      etiqueta: "Rol",
      opciones: ROLES.map((r) => [r, rolesTexto[r]]),
      inicial: "CLIENTE",
    },
    { nombre: "estado", etiqueta: "Estado", opciones: ["ACTIVO", "INACTIVO"], inicial: "ACTIVO" },
  ];
  return (
    <GestorEntidades
      titulo="Usuarios"
      singular="usuario"
      entidad="Usuario"
      lista="ListarUsuarios"
      elemento="usuario"
      campos={campos}
      columnas={[
        { titulo: "Nombre", campo: "nombre" },
        { titulo: "Usuario", campo: "usuario" },
        { titulo: "Rol", ver: (f) => rolesTexto[f.rol] },
        { titulo: "Estado", ver: (f) => <Estado valor={f.estado} /> },
      ]}
    />
  );
}
