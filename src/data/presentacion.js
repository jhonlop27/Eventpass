export const ROLES = ["ADMINISTRADOR", "ORGANIZADOR", "CLIENTE"];
export const GESTORES = ROLES.slice(0, 2);
export const rolesTexto = {
  ADMINISTRADOR: "Administración",
  ORGANIZADOR: "Organización",
  CLIENTE: "Cliente",
};
const moneda = new Intl.NumberFormat("es-CO", {
  style: "currency",
  currency: "COP",
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
});
export const pesos = (valor) => (valor == null ? "—" : moneda.format(String(valor)));
export function importePedido(precio, cantidad) {
  if (!/^\d{1,10}$/.test(String(cantidad))) return null;
  const [entero, fraccion = ""] = String(precio).split(".");
  const centavos = BigInt(entero + fraccion.padEnd(2, "0")) * BigInt(cantidad);
  return (centavos / 100n).toString() + "." + (centavos % 100n).toString().padStart(2, "0");
}
export function calendario(fecha, opciones = { day: "numeric", month: "long", year: "numeric" }) {
  return new Intl.DateTimeFormat("es-CO", { ...opciones, timeZone: "America/Bogota" }).format(
    new Date(fecha.length === 10 ? fecha + "T12:00:00-05:00" : fecha),
  );
}
export const categoriaArte = (categoria) => {
  const s = String(categoria).toLowerCase();
  if (/m[uú]sica|concierto|festival/.test(s)) return "musica";
  if (/conferen|c[oó]digo|tecnolog/.test(s)) return "conferencia";
  return "artes";
};
export const etiquetaEstado = (s) =>
  ({
    ACTIVO: "Activo",
    INACTIVO: "Inactivo",
    BORRADOR: "Borrador",
    CERRADO: "Cerrado",
    CONFIRMADA: "Confirmada",
    CANCELADA: "Cancelada",
    EMITIDA: "Emitida",
    UTILIZADA: "Utilizada",
    REEMPLAZADA: "Reemplazada",
  })[s] || s;
export const buscar = (s = "") =>
  s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
