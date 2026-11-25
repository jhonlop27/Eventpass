import { conectar, transaccion } from "./db.js";
import { crearUsuario, ADMIN } from "./usuarios.js";
import { exigir } from "./validacion.js";
const pool = conectar();
try {
  await transaccion(pool, async (db) => {
    const {
      ADMIN_IDENTIFICACION: identificacion,
      ADMIN_NAME: nombre,
      ADMIN_USER: usuario,
      ADMIN_PASSWORD: password,
    } = process.env;
    exigir(
      usuario && password && identificacion && nombre,
      "CONFIG",
      "Configura ADMIN_IDENTIFICACION, ADMIN_NAME, ADMIN_USER y ADMIN_PASSWORD.",
    );
    const existe = (
      await db.query("SELECT identificacion,rol,estado FROM usuarios WHERE usuario=$1", [
        usuario.trim().toLowerCase(),
      ])
    ).rows[0];
    if (existe) {
      exigir(
        existe.rol === ADMIN && existe.estado === "ACTIVO" && existe.identificacion === identificacion,
        "CONFIG",
        "El usuario existente no coincide con el administrador solicitado.",
      );
      console.log("El administrador ya existe.");
      return;
    }
    await crearUsuario({ db }, { identificacion, nombre, usuario, password, rol: ADMIN });
    console.log("Administrador creado.");
  });
} finally {
  await pool.end();
}
