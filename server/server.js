import { conectar } from "./db.js";
import { crearApp } from "./app.js";

const pool = conectar(),
  port = Number(process.env.PORT || 4000);
await pool.query("SELECT id FROM usuarios LIMIT 0");
const app = await crearApp(
  pool,
  process.env.JWT_SECRET,
  process.env.SOAP_PUBLIC_URL || `http://localhost:${port}/soap`,
);
const server = app.listen(port, () =>
  console.log(`EventPass en http://localhost:${port} · WSDL en /soap?wsdl`),
);
function cerrar() {
  server.close(async () => {
    await pool.end();
  });
}
process.once("SIGINT", cerrar);
process.once("SIGTERM", cerrar);
