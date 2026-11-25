import { readFile } from "node:fs/promises";
import { conectar } from "./db.js";
const pool = conectar();
try {
  await pool.query(await readFile(new URL("./schema.sql", import.meta.url), "utf8"));
  await pool.query(await readFile(new URL("./configurar-search-path.sql", import.meta.url), "utf8"));
  console.log("Esquema eventpass preparado. Ruta de búsqueda configurada para este usuario y esta base.");
} finally {
  await pool.end();
}
