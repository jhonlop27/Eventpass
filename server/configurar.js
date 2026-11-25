import { randomBytes } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
const plantilla = await readFile(new URL(".env.example", import.meta.url), "utf8");
const password = randomBytes(18).toString("base64url");
const contenido = plantilla
  .replace(/^JWT_SECRET=$/m, "JWT_SECRET=" + randomBytes(48).toString("hex"))
  .replace(/^ADMIN_PASSWORD=$/m, "ADMIN_PASSWORD=" + password);
try {
  await writeFile(new URL(".env", import.meta.url), contenido, { flag: "wx", mode: 0o600 });
  console.log(
    "Configuración creada en server/.env. Ajusta DATABASE_URL. Allí encontrarás la clave inicial del administrador.",
  );
} catch (error) {
  if (error.code !== "EEXIST") throw error;
  console.log("Ya existe server/.env. Puedes editar DATABASE_URL en ese archivo.");
}
