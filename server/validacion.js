export class Fallo extends Error {
  constructor(codigo, mensaje) {
    super(mensaje);
    this.codigo = codigo;
  }
}
export function exigir(condicion, codigo, mensaje) {
  if (!condicion) throw new Fallo(codigo, mensaje);
}
export function texto(valor, campo, max = 150) {
  exigir(
    typeof valor === "string" && valor.trim() && valor.trim().length <= max,
    "DATOS",
    `Revisa el campo ${campo} (máximo ${max} caracteres).`,
  );
  return valor.trim();
}
export function entero(valor, campo, min = 1) {
  const n = Number(valor);
  exigir(
    /^\d+$/.test(String(valor)) && Number.isSafeInteger(n) && n >= min && n <= 2147483647,
    "DATOS",
    `Revisa el valor de ${campo}.`,
  );
  return n;
}
export const id = (valor) => entero(valor, "identificador");
export function opcion(valor, opciones, campo) {
  exigir(opciones.includes(valor), "DATOS", `Valor de ${campo} no válido.`);
  return valor;
}
export function dinero(valor) {
  exigir(
    /^\d{1,10}(\.\d{1,2})?$/.test(String(valor)),
    "DATOS",
    "El precio debe ser positivo o cero y tener hasta dos decimales.",
  );
  return String(valor);
}
export function clave(valor) {
  exigir(
    typeof valor === "string" && valor.length >= 10 && Buffer.byteLength(valor) <= 72,
    "DATOS",
    "Usa una contraseña de al menos 10 caracteres y máximo 72 bytes.",
  );
  return valor;
}
export function una(resultado, mensaje = "El registro no existe o está fuera de tu ámbito.") {
  exigir(resultado.rowCount > 0, "NO_ENCONTRADO", mensaje);
  return resultado.rows[0];
}
export function mensajeSeguro(error) {
  if (error instanceof Fallo) return error;
  if (error.code === "23505")
    return new Fallo("CONFLICTO", "El código, usuario, identificación o nombre ya está registrado.");
  if (["23503", "23001"].includes(error.code))
    return new Fallo("CONFLICTO", "El registro tiene relaciones activas o la referencia no existe.");
  if (error.constraint === "aforo_asignacion")
    return new Fallo("AFORO", "La capacidad del evento debe cubrir la suma de los cupos asignados.");
  if (["23514", "23502", "22003", "22007", "22008", "22P02", "22001"].includes(error.code))
    return new Fallo("DATOS", "Los datos incumplen una restricción de cupo, formato o integridad.");
  if (["40001", "40P01", "55P03"].includes(error.code))
    return new Fallo("REINTENTAR", "Hubo otra operación simultánea. Vuelve a intentarlo.");
  console.error("Error interno de EventPass", error.code || error.name);
  return new Fallo("INTERNO", "No se pudo completar la operación.");
}
