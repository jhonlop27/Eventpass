import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { clave, exigir, id, opcion, texto, una, Fallo } from "./validacion.js";

export const ADMIN = "ADMINISTRADOR",
  ORG = "ORGANIZADOR",
  CLI = "CLIENTE";
export const personal = [ADMIN, ORG],
  todos = [ADMIN, ORG, CLI];
const campos = "id,identificacion,nombre,usuario,rol,estado,creado_en,actualizado_en";
const hashAusente = bcrypt.hashSync("cuenta-inexistente", 12);
const estados = ["ACTIVO", "INACTIVO"];

function loginNormalizado(valor) {
  const login = texto(valor, "usuario", 80).toLowerCase();
  exigir(
    /^[\p{L}\p{N}_.@-]+$/u.test(login),
    "DATOS",
    "Usa letras, números, punto, guion, @ o guion bajo en el usuario.",
  );
  return login;
}

export async function iniciar({ db, secreto }, a) {
  const login = loginNormalizado(a.usuario);
  const encontrado = (
    await db.query(`SELECT ${campos},password_hash,version_sesion FROM usuarios WHERE usuario=$1`, [
      login,
    ])
  ).rows[0];
  const password =
    typeof a.password === "string" && Buffer.byteLength(a.password) <= 72 ? a.password : "";
  const valida = await bcrypt.compare(password, encontrado?.password_hash || hashAusente);
  exigir(valida && encontrado?.estado === "ACTIVO", "CREDENCIALES", "Usuario o contraseña incorrectos.");
  const { password_hash, version_sesion, ...usuario } = encontrado;
  const token = jwt.sign({ rol: usuario.rol, v: version_sesion }, secreto, {
    algorithm: "HS256",
    issuer: "eventpass",
    audience: "eventpass-web",
    subject: String(usuario.id),
    expiresIn: "8h",
  });
  return { usuario, token, expira_en: new Date(jwt.decode(token).exp * 1000) };
}

export async function identificar(db, token, secreto) {
  let claims;
  try {
    claims = jwt.verify(token, secreto, {
      algorithms: ["HS256"],
      issuer: "eventpass",
      audience: "eventpass-web",
    });
  } catch {
    throw new Fallo("SESION", "Tu sesión terminó. Inicia sesión de nuevo.");
  }
  exigir(
    /^\d+$/.test(claims.sub) && Number(claims.sub) <= 2147483647 && claims.exp,
    "SESION",
    "Sesión inválida.",
  );
  const actor = (
    await db.query("SELECT id,rol,estado,version_sesion FROM usuarios WHERE id=$1", [claims.sub])
  ).rows[0];
  exigir(
    actor?.estado === "ACTIVO" && actor.rol === claims.rol && actor.version_sesion === claims.v,
    "SESION",
    "La cuenta cambió. Inicia sesión de nuevo.",
  );
  return actor;
}

function datos(a, estadoActual = "ACTIVO") {
  return [
    texto(a.identificacion, "identificación", 40),
    texto(a.nombre, "nombre"),
    loginNormalizado(a.usuario),
    opcion(a.rol, todos, "rol"),
    opcion(a.estado ?? estadoActual, estados, "estado"),
  ];
}
export async function crearUsuario({ db }, a) {
  const valores = datos(a);
  return una(
    await db.query(
      `INSERT INTO usuarios(identificacion,nombre,usuario,rol,estado,password_hash)
    VALUES($1,$2,$3,$4,$5,$6) RETURNING ${campos}`,
      [...valores, await bcrypt.hash(clave(a.password), 12)],
    ),
  );
}
export async function registrarUsuario(ctx, { identificacion, nombre, usuario, password }) {
  try {
    return await crearUsuario(ctx, { identificacion, nombre, usuario, password, rol: CLI, estado: "ACTIVO" });
  } catch (error) {
    if (error.code === "23505")
      throw new Fallo("CONFLICTO", "La identificación o el nombre de usuario ya está registrado.");
    throw error;
  }
}
export async function listarUsuarios({ db }) {
  return (await db.query(`SELECT ${campos} FROM usuarios ORDER BY nombre,id`)).rows;
}
export async function obtenerUsuario({ db }, a) {
  return una(await db.query(`SELECT ${campos} FROM usuarios WHERE id=$1`, [id(a.id)]));
}
export async function actualizarUsuario({ db, actor }, a) {
  const anterior = una(
    await db.query("SELECT rol,estado FROM usuarios WHERE id=$1 FOR UPDATE", [id(a.id)]),
  );
  const valores = datos(a, anterior.estado);
  exigir(
    Number(a.id) !== actor.id || (a.rol === ADMIN && valores[4] === "ACTIVO"),
    "CONFLICTO",
    "Conserva el rol y el estado de tu propia cuenta.",
  );
  if (anterior.rol !== a.rol) {
    const vinculada = await db.query(
      `SELECT EXISTS(SELECT 1 FROM compras WHERE cliente_id=$1) AS compra,
      EXISTS(SELECT 1 FROM eventos WHERE organizador_id=$1) AS evento`,
      [a.id],
    );
    const { compra, evento } = vinculada.rows[0];
    exigir(
      (!compra || a.rol === CLI) && (!evento || personal.includes(a.rol)),
      "CONFLICTO",
      "El rol es incompatible con las compras o eventos asociados.",
    );
  }
  const hash = a.password ? await bcrypt.hash(clave(a.password), 12) : null;
  return una(
    await db.query(
      `UPDATE usuarios SET identificacion=$2,nombre=$3,usuario=$4::varchar,rol=$5,estado=$6,
    password_hash=COALESCE($7,password_hash),version_sesion=version_sesion +
    CASE WHEN $7::text IS NOT NULL OR rol<>$5 OR estado<>$6 OR usuario<>$4::varchar THEN 1 ELSE 0 END
    WHERE id=$1 RETURNING ${campos}`,
      [a.id, ...valores, hash],
    ),
  );
}
export async function eliminarUsuario({ db, actor }, a) {
  exigir(id(a.id) !== actor.id, "CONFLICTO", "La cuenta en uso no se puede eliminar.");
  return una(await db.query("DELETE FROM usuarios WHERE id=$1 RETURNING id", [a.id]));
}
export async function usuarioActivo(db, valor, roles) {
  const fila = await db.query(
    "SELECT id FROM usuarios WHERE id=$1 AND estado='ACTIVO' AND rol=ANY($2::text[]) FOR SHARE",
    [id(valor), roles],
  );
  return una(fila, "Selecciona una cuenta activa con el rol correspondiente.").id;
}
