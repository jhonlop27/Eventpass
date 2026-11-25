import { ADMIN, ORG, personal, usuarioActivo } from "./usuarios.js";
import { dinero, entero, exigir, id, opcion, texto, una } from "./validacion.js";

const publicados = "e.estado='ACTIVO' AND (e.fecha + e.hora) > LOCALTIMESTAMP";
const eventoBase = `SELECT e.id,e.codigo,e.organizador_id,e.nombre,e.descripcion,e.categoria,e.ubicacion,
  e.fecha::text AS fecha,e.hora::text AS hora,e.capacidad_total,e.estado,e.creado_en,e.actualizado_en,
  u.nombre AS organizador_nombre,COALESCE(t.disponibles,0)::int AS disponibles,t.precio_desde
  FROM eventos e JOIN usuarios u ON u.id=e.organizador_id
  LEFT JOIN LATERAL (SELECT sum(cantidad_disponible) AS disponibles,
    min(precio) FILTER (WHERE cantidad_disponible>0) AS precio_desde FROM tipos_entrada WHERE evento_id=e.id AND estado='ACTIVO') t ON true`;
const tipoBase =
  "SELECT t.*,e.nombre AS evento_nombre FROM tipos_entrada t JOIN eventos e ON e.id=t.evento_id";

function alcance(actor, gestion, esTipo, parametros) {
  if (!gestion) return publicados + (esTipo ? " AND t.estado='ACTIVO'" : "");
  exigir(personal.includes(actor?.rol), "PERMISO", "Se requiere acceso de gestión.");
  if (actor.rol === ADMIN) return "TRUE";
  parametros.push(actor.id);
  return `e.organizador_id=$${parametros.length}`;
}
function gestionar(a) {
  return a.gestion === true || a.gestion === "true" || a.gestion === "1";
}
async function consultar({ db, actor }, a, esTipo, individual) {
  const params = [];
  const filtros = [alcance(actor, gestionar(a), esTipo, params)];
  if (individual) {
    params.push(id(a.id));
    filtros.push(`${esTipo ? "t" : "e"}.id=$${params.length}`);
  }
  if (esTipo && a.evento_id != null) {
    params.push(id(a.evento_id));
    filtros.push(`e.id=$${params.length}`);
  }
  const q = await db.query(
    `${esTipo ? tipoBase : eventoBase} WHERE ${filtros.join(" AND ")}
    ORDER BY ${esTipo ? "e.fecha,t.precio,t.id" : "e.fecha,e.hora,e.id"}`,
    params,
  );
  return individual ? una(q) : q.rows;
}
export const listarEventos = (c, a) => consultar(c, a, false, false);
export const obtenerEvento = (c, a) => consultar(c, a, false, true);
export const listarTipos = (c, a) => consultar(c, a, true, false);
export const obtenerTipo = (c, a) => consultar(c, a, true, true);

export async function bloquearEvento(db, eventoId, actor, comprobarDueno = true) {
  const e = una(
    await db.query(
      "SELECT *, (fecha+hora)>LOCALTIMESTAMP AS futuro FROM eventos WHERE id=$1 FOR UPDATE",
      [id(eventoId)],
    ),
  );
  if (comprobarDueno)
    exigir(
      actor.rol === ADMIN || (actor.rol === ORG && e.organizador_id === actor.id),
      "PERMISO",
      "El evento no está a tu cargo.",
    );
  return e;
}
async function datosEvento({ db, actor }, a, anterior) {
  const responsable = a.organizador_id ?? anterior?.organizador_id ?? actor.id;
  exigir(
    actor.rol === ADMIN || id(responsable) === actor.id,
    "PERMISO",
    "Solo puedes gestionar tus propios eventos.",
  );
  await usuarioActivo(db, responsable, personal);
  exigir(
    /^\d{4}-\d{2}-\d{2}$/.test(a.fecha) && /^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/.test(a.hora),
    "DATOS",
    "Revisa la fecha y la hora del evento.",
  );
  return [
    texto(a.codigo, "código", 48).toUpperCase(),
    responsable,
    texto(a.nombre, "nombre"),
    texto(a.descripcion, "descripción", 3000),
    texto(a.categoria, "categoría", 80),
    texto(a.ubicacion, "ubicación", 200),
    a.fecha,
    a.hora,
    entero(a.capacidad_total, "capacidad"),
    opcion(a.estado ?? anterior?.estado ?? "BORRADOR", ["ACTIVO", "CERRADO", "BORRADOR"], "estado"),
  ];
}
export async function guardarEvento(ctx, a, editar) {
  const previo = editar ? await bloquearEvento(ctx.db, a.id, ctx.actor) : null;
  const datos = await datosEvento(ctx, a, previo);
  const sql = editar
    ? `UPDATE eventos SET codigo=$1,organizador_id=$2,nombre=$3,descripcion=$4,categoria=$5,ubicacion=$6,fecha=$7,hora=$8,capacidad_total=$9,estado=$10 WHERE id=$11`
    : `INSERT INTO eventos(codigo,organizador_id,nombre,descripcion,categoria,ubicacion,fecha,hora,capacidad_total,estado) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`;
  if (editar) datos.push(previo.id);
  const fila = una(await ctx.db.query(sql + " RETURNING id", datos));
  return obtenerEvento(ctx, { id: fila.id, gestion: true });
}
export async function eliminarEvento({ db, actor }, a) {
  await bloquearEvento(db, a.id, actor);
  return una(await db.query("DELETE FROM eventos WHERE id=$1 RETURNING id", [a.id]));
}
export async function contextoTipo(db, tipoId, actor, comprobarDueno = true) {
  const ref = una(await db.query("SELECT evento_id FROM tipos_entrada WHERE id=$1", [id(tipoId)]));
  const evento = await bloquearEvento(db, ref.evento_id, actor, comprobarDueno);
  const tipo = una(await db.query("SELECT * FROM tipos_entrada WHERE id=$1 FOR UPDATE", [tipoId]));
  return { evento, tipo };
}
export async function guardarTipo(ctx, a, editar) {
  const { db, actor } = ctx;
  const previo = editar ? await contextoTipo(db, a.id, actor) : null;
  const evento = previo?.evento ?? (await bloquearEvento(db, a.evento_id, actor));
  if (a.evento_id != null)
    exigir(id(a.evento_id) === evento.id, "DATOS", "El evento de un tipo es inmutable.");
  const datos = [
    texto(a.nombre, "tipo", 100),
    dinero(a.precio),
    entero(a.capacidad_asignada, "capacidad asignada", 0),
    opcion(a.estado ?? previo?.tipo.estado ?? "ACTIVO", ["ACTIVO", "INACTIVO"], "estado"),
  ];
  const sql = editar
    ? "UPDATE tipos_entrada SET nombre=$1,precio=$2,capacidad_asignada=$3,estado=$4 WHERE id=$5"
    : "INSERT INTO tipos_entrada(nombre,precio,capacidad_asignada,estado,evento_id) VALUES($1,$2,$3,$4,$5)";
  const fila = una(await db.query(sql + " RETURNING id", [...datos, editar ? a.id : evento.id]));
  return obtenerTipo(ctx, { id: fila.id, gestion: true });
}
export async function eliminarTipo({ db, actor }, a) {
  await contextoTipo(db, a.id, actor);
  return una(await db.query("DELETE FROM tipos_entrada WHERE id=$1 RETURNING id", [a.id]));
}
