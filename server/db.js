import dotenv from "dotenv";
import pg from "pg";
import { fileURLToPath } from "node:url";

dotenv.config({ path: fileURLToPath(new URL(".env", import.meta.url)), quiet: true });

export function conectar(url = process.env.DATABASE_URL) {
  if (!url) throw new Error("Configura DATABASE_URL en server/.env.");
  const pool = new pg.Pool({
    connectionString: url,
    options: "-c search_path=eventpass,pg_catalog -c timezone=America/Bogota",
    connectionTimeoutMillis: 6000,
  });
  pool.on("error", () => console.error("Una conexión inactiva de PostgreSQL se cerró."));
  return pool;
}

export async function transaccion(pool, trabajo) {
  const db = await pool.connect();
  try {
    await db.query("BEGIN");
    const resultado = await trabajo(db);
    await db.query("COMMIT");
    return resultado;
  } catch (error) {
    await db.query("ROLLBACK");
    throw error;
  } finally {
    db.release();
  }
}
