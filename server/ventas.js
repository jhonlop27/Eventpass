import { ADMIN, CLI, ORG, personal, usuarioActivo } from "./usuarios.js";
import { contextoTipo } from "./catalogo.js";
import { dinero, entero, exigir, id, opcion, texto, una } from "./validacion.js";

const uniones = `JOIN tipos_entrada t ON t.id=c.tipo_entrada_id JOIN eventos e ON e.id=t.evento_id
  JOIN usuarios u ON u.id=c.cliente_id`;
const sqlCompra = `SELECT c.id,c.codigo,c.cliente_id,c.usuario_responsable_id,c.tipo_entrada_id,c.fecha,
  c.cantidad_entradas,c.valor_total,c.estado,e.id AS evento_id,e.nombre AS evento_nombre,u.nombre AS cliente_nombre,
  t.nombre AS tipo_nombre,(SELECT count(*)::int FROM entradas i WHERE i.compra_id=c.id AND i.estado IN ('EMITIDA','UTILIZADA')) AS vigentes
  FROM compras c ${uniones}`;
const sqlEntrada = `SELECT i.id,i.codigo,i.compra_id,i.evento_id,i.tipo_entrada_id,i.precio_pagado,i.fecha_generacion,i.estado,
  e.nombre AS evento_nombre,e.fecha::text AS evento_fecha,e.hora::text AS evento_hora,e.ubicacion,t.nombre AS tipo_nombre,
  c.codigo AS compra_codigo FROM entradas i JOIN compras c ON c.id=i.compra_id ${uniones}`;

async function consultar({ db, actor }, a, entradas, individual) {
  const params = [],
    filtros = [];
  function filtrar(columna, valor) {
    params.push(id(valor));
    filtros.push(columna + "=$" + params.length);
  }
  if (actor.rol === ORG) filtrar("e.organizador_id", actor.id);
  if (actor.rol === CLI) filtrar("c.cliente_id", actor.id);
  if (a.evento_id != null) filtrar("e.id", a.evento_id);
  if (entradas && a.compra_id != null) filtrar("c.id", a.compra_id);
  if (individual) filtrar(entradas ? "i.id" : "c.id", a.id);
  const where = filtros.length ? " WHERE " + filtros.join(" AND ") : "";
  const q = await db.query(
    (entradas ? sqlEntrada : sqlCompra) +
      where +
      (entradas ? " ORDER BY i.id DESC" : " ORDER BY c.id DESC"),
    params,
  );
  return individual ? una(q) : q.rows;
}
export const listarCompras = (c, a) => consultar(c, a, false, false);
export const listarEntradas = (c, a) => consultar(c, a, true, false);
export const obtenerEntrada = (c, a) => consultar(c, a, true, true);
export async function detalleCompra(ctx, a) {
  const compra = await consultar(ctx, a, false, true);
  return { compra, entrada: await listarEntradas(ctx, { compra_id: compra.id }) };
}

export async function crearCompra(ctx, a) {
  const { db, actor } = ctx;
  const cliente = a.cliente_id == null ? actor.id : id(a.cliente_id);
  exigir(
    actor.rol === ADMIN || (actor.rol === CLI && cliente === actor.id),
    "PERMISO",
    "Solo puedes comprar para tu propia cuenta.",
  );
  const cantidad = entero(a.cantidad, "cantidad");
  const tipoId = id(a.tipo_entrada_id);
  const solicitud = texto(a.solicitud_id, "identificador de solicitud", 36).toLowerCase();
  exigir(
    /^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/.test(solicitud),
    "DATOS",
    "La solicitud debe tener una clave UUID.",
  );
  await usuarioActivo(db, cliente, [CLI]);
  // Una respuesta perdida puede repetirse incluso cuando ya se agotaron los cupos.
  await db.query("SELECT pg_advisory_xact_lock(hashtextextended($1,0))", [cliente + "/" + solicitud]);
  const anterior = (
    await db.query(
      "SELECT id,tipo_entrada_id,cantidad_entradas FROM compras WHERE cliente_id=$1 AND solicitud_id=$2",
      [cliente, solicitud],
    )
  ).rows[0];
  if (anterior) {
    exigir(
      anterior.tipo_entrada_id === tipoId && anterior.cantidad_entradas === cantidad,
      "CONFLICTO",
      "La clave de solicitud ya identifica otro pedido.",
    );
    return detalleCompra(ctx, { id: anterior.id });
  }
  const { evento, tipo } = await contextoTipo(db, tipoId, actor, false);
  exigir(
    evento.estado === "ACTIVO" && evento.futuro && tipo.estado === "ACTIVO",
    "CERRADO",
    "La venta de esta entrada está cerrada.",
  );
  const {
    rows: [{ vendidas }],
  } = await db.query(
    "SELECT count(*)::int AS vendidas FROM entradas WHERE evento_id=$1 AND estado IN ('EMITIDA','UTILIZADA')",
    [evento.id],
  );
  exigir(
    cantidad <= evento.capacidad_total - vendidas,
    "AFORO",
    "La cantidad supera el aforo restante del evento.",
  );
  exigir(
    cantidad <= tipo.cantidad_disponible,
    "INVENTARIO",
    "La cantidad supera la disponibilidad de este tipo de entrada.",
  );
  if (a.precio_esperado != null) {
    const mismo = await db.query("SELECT $1::numeric=$2::numeric AS ok", [
      dinero(a.precio_esperado),
      tipo.precio,
    ]);
    exigir(mismo.rows[0].ok, "PRECIO", "El precio cambió. Revisa el resumen antes de confirmar.");
  }
  const compra = una(
    await db.query(
      `INSERT INTO compras(cliente_id,usuario_responsable_id,tipo_entrada_id,solicitud_id,cantidad_entradas,valor_total)
    SELECT $1,$2,id,$3,$4,precio*$4::integer FROM tipos_entrada WHERE id=$5 RETURNING id`,
      [cliente, evento.organizador_id, solicitud, cantidad, tipo.id],
    ),
  );
  // El trigger recalcula las existencias del lote en la misma transacción.
  await db.query(
    `INSERT INTO entradas(compra_id,evento_id,tipo_entrada_id,precio_pagado)
    SELECT $1,$2,$3,$4 FROM generate_series(1,$5::int)`,
    [compra.id, evento.id, tipo.id, tipo.precio, cantidad],
  );
  return detalleCompra(ctx, { id: compra.id });
}

async function bloquearCompra(ctx, compraId) {
  const { db, actor } = ctx;
  const ref = una(await db.query("SELECT tipo_entrada_id FROM compras WHERE id=$1", [id(compraId)]));
  const { evento } = await contextoTipo(db, ref.tipo_entrada_id, actor);
  const compra = una(await db.query("SELECT id,estado FROM compras WHERE id=$1 FOR UPDATE", [compraId]));
  return { evento, compra };
}
async function cancelarCompra(ctx, compra) {
  if (compra.estado === "CANCELADA") return;
  const usada = await ctx.db.query(
    "SELECT 1 FROM entradas WHERE compra_id=$1 AND estado='UTILIZADA' LIMIT 1",
    [compra.id],
  );
  exigir(
    !usada.rowCount,
    "UTILIZADA",
    "La compra contiene una entrada utilizada. Puedes cancelar por separado las entradas sin usar.",
  );
  await ctx.db.query("UPDATE entradas SET estado='CANCELADA' WHERE compra_id=$1 AND estado='EMITIDA'", [
    compra.id,
  ]);
  await ctx.db.query("UPDATE compras SET estado='CANCELADA' WHERE id=$1", [compra.id]);
}
export async function actualizarCompra(ctx, a, borrar = false) {
  const { compra } = await bloquearCompra(ctx, a.id);
  if (borrar || a.estado === "CANCELADA") await cancelarCompra(ctx, compra);
  else {
    exigir(
      a.usuario_responsable_id != null,
      "DATOS",
      "Selecciona un responsable o solicita la cancelación.",
    );
    exigir(
      !a.estado || a.estado === compra.estado,
      "CONFLICTO",
      "Una compra cancelada no se puede reactivar.",
    );
    const responsable = await usuarioActivo(ctx.db, a.usuario_responsable_id, personal);
    await ctx.db.query("UPDATE compras SET usuario_responsable_id=$1 WHERE id=$2", [
      responsable,
      compra.id,
    ]);
  }
  return consultar(ctx, { id: compra.id }, false, true);
}

async function bloquearEntrada(ctx, a, porCodigo) {
  const columna = porCodigo ? "codigo" : "id";
  const valor = porCodigo ? texto(a.codigo, "código", 60).toUpperCase() : id(a.id);
  const ref = una(await ctx.db.query(`SELECT id,compra_id FROM entradas WHERE ${columna}=$1`, [valor]));
  const { compra } = await bloquearCompra(ctx, ref.compra_id);
  const entrada = una(await ctx.db.query("SELECT * FROM entradas WHERE id=$1 FOR UPDATE", [ref.id]));
  return { compra, entrada };
}
export async function validarEntrada(ctx, a, porCodigo = true) {
  const { entrada, compra } = await bloquearEntrada(ctx, a, porCodigo);
  exigir(
    compra.estado === "CONFIRMADA" && entrada.estado === "EMITIDA",
    "ENTRADA_INVALIDA",
    "La entrada ya fue utilizada, cancelada o reemplazada.",
  );
  una(
    await ctx.db.query(
      "UPDATE entradas SET estado='UTILIZADA' WHERE id=$1 AND estado='EMITIDA' RETURNING id",
      [entrada.id],
    ),
  );
  return obtenerEntrada(ctx, { id: entrada.id });
}
export async function eliminarEntrada(ctx, a) {
  const { entrada, compra } = await bloquearEntrada(ctx, a, false);
  if (entrada.estado === "CANCELADA") return obtenerEntrada(ctx, a);
  exigir(
    entrada.estado === "EMITIDA" && compra.estado === "CONFIRMADA",
    "ENTRADA_INVALIDA",
    "Solo se puede cancelar una entrada emitida sin usar.",
  );
  await ctx.db.query("UPDATE entradas SET estado='CANCELADA' WHERE id=$1", [entrada.id]);
  await ctx.db.query(
    `UPDATE compras SET estado='CANCELADA' WHERE id=$1 AND NOT EXISTS
    (SELECT 1 FROM entradas WHERE compra_id=$1 AND estado IN ('EMITIDA','UTILIZADA'))`,
    [compra.id],
  );
  return obtenerEntrada(ctx, a);
}
export async function actualizarEntrada(ctx, a) {
  opcion(a.estado, ["UTILIZADA", "CANCELADA"], "estado");
  return a.estado === "UTILIZADA" ? validarEntrada(ctx, a, false) : eliminarEntrada(ctx, a);
}
export async function reemitirEntrada(ctx, a) {
  const { entrada, compra } = await bloquearEntrada(ctx, { id: a.entrada_origen_id }, false);
  exigir(
    entrada.estado === "EMITIDA" && compra.estado === "CONFIRMADA",
    "ENTRADA_INVALIDA",
    "La reemisión requiere una entrada vigente sin usar.",
  );
  await ctx.db.query("UPDATE entradas SET estado='REEMPLAZADA' WHERE id=$1", [entrada.id]);
  const nueva = una(
    await ctx.db.query(
      `INSERT INTO entradas(compra_id,evento_id,tipo_entrada_id,precio_pagado)
    SELECT compra_id,evento_id,tipo_entrada_id,precio_pagado FROM entradas WHERE id=$1 RETURNING id`,
      [entrada.id],
    ),
  );
  return obtenerEntrada(ctx, { id: nueva.id });
}
