import { before, after, test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import jwt from "jsonwebtoken";
import pg from "pg";
import { entorno, evento, oferta, pedido } from "./entorno.js";
let fx, call;
before(async () => {
  fx = await entorno();
  call = fx.llamar;
});
after(async () => {
  if (fx) await fx.cerrar();
});
async function falla(promesa, codigo) {
  await assert.rejects(promesa, (err) => {
    const detalle = err.root?.Envelope?.Body?.Fault?.detail?.ErrorEventPass?.codigo;
    assert.equal(detalle, codigo, err.message);
    return true;
  });
}
async function stock(t) {
  return (await call("admin", "ObtenerTipoEntrada", { id: t.id, gestion: true })).tipo
    .cantidad_disponible;
}
test("PostgreSQL crea cinco tablas, claves foráneas y esquema repetible", async () => {
  await fx.pool.query(await readFile(new URL("../server/schema.sql", import.meta.url), "utf8"));
  const { rows } = await fx.pool.query(
    "SELECT tablename FROM pg_tables WHERE schemaname='eventpass' ORDER BY tablename",
  );
  assert.deepEqual(
    rows.map((r) => r.tablename),
    ["compras", "entradas", "eventos", "tipos_entrada", "usuarios"],
  );
  await assert.rejects(
    fx.pool.query(
      "INSERT INTO tipos_entrada(evento_id,nombre,precio,capacidad_asignada) VALUES(2147483647,'Prueba',1,1)",
    ),
    (e) => e.code === "23503",
  );
});
test("WSDL publicado, 28 operaciones concretas y errores de sobre SOAP en XML", async () => {
  const wsdl = await (await fetch(fx.url + "/soap?wsdl")).text();
  assert.match(wsdl, /name="EventPassService"/);
  assert.doesNotMatch(wsdl, /dataJson/);
  const operaciones = fx.clientes.publico.describe().EventPassService.EventPassPort;
  assert.equal(Object.keys(operaciones).length, 28);
  assert.ok(operaciones.RegistrarUsuario && operaciones.CrearUsuario && operaciones.ActualizarUsuario);
  const r = await fetch(fx.url + "/soap", {
    method: "POST",
    body: "<incompleto>",
    headers: { "Content-Type": "text/xml" },
  });
  assert.equal(r.status, 500);
  assert.match(await r.text(), /<soap:Fault>/);
});
test("bcrypt, respuesta sin hash, JWT obligatorio, firma, expiración, rol y estado actuales", async () => {
  const conEspacios = "  " + randomUUID() + "  ";
  await call("admin", "CrearUsuario", {
    identificacion: "BLANCOS",
    nombre: "Cuenta de prueba",
    usuario: "espacios",
    rol: "CLIENTE",
    password: conEspacios,
  });
  assert.ok(
    (await call("publico", "IniciarSesion", { usuario: "espacios", password: conEspacios })).token,
  );
  await falla(
    call("publico", "IniciarSesion", { usuario: "espacios", password: conEspacios.trim() }),
    "CREDENCIALES",
  );
  const u = fx.cuentas.ana;
  const {
    rows: [privado],
  } = await fx.pool.query("SELECT password_hash FROM usuarios WHERE id=$1", [u.id]);
  assert.match(privado.password_hash, /^\$2[aby]\$12\$/);
  const login = await call("publico", "IniciarSesion", { usuario: u.usuario, password: u.password });
  assert.ok(login.expira_en);
  assert.ok(!JSON.stringify(login).includes("password"));
  await falla(
    call("publico", "IniciarSesion", { usuario: u.usuario, password: "incorrecta" }),
    "CREDENCIALES",
  );
  await falla(call("publico", "ListarCompras"), "SESION");
  for (const [key, rol, tiempo] of [
    ["otra-clave-para-fixture", "CLIENTE", "1h"],
    [fx.secreto, "CLIENTE", "-1s"],
    [fx.secreto, "ADMINISTRADOR", "1h"],
  ]) {
    const token = jwt.sign({ rol, v: 1 }, key, {
      subject: String(u.id),
      issuer: "eventpass",
      audience: "eventpass-web",
      expiresIn: tiempo,
    });
    await falla(call(await fx.cliente(token), "ListarCompras"), "SESION");
  }
  await call("admin", "ActualizarUsuario", {
    id: u.id,
    identificacion: u.identificacion,
    nombre: u.nombre,
    usuario: u.usuario,
    rol: u.rol,
    estado: "INACTIVO",
  });
  await falla(call("ana", "ListarEntradas"), "SESION");
  await call("admin", "ActualizarUsuario", {
    id: u.id,
    identificacion: u.identificacion,
    nombre: u.nombre,
    usuario: u.usuario,
    rol: u.rol,
    estado: "ACTIVO",
  });
  const sesion = await call("publico", "IniciarSesion", { usuario: u.usuario, password: u.password });
  fx.clientes.ana = await fx.cliente(sesion.token);
});
test("CRUD de usuarios, identificación única y prohibición a otros roles", async () => {
  const datos = {
    identificacion: "AB",
    nombre: "María & José",
    usuario: "maria",
    rol: "CLIENTE",
    password: randomUUID(),
  };
  const { usuario: u } = await call("admin", "CrearUsuario", datos);
  assert.equal((await call("admin", "ObtenerUsuario", { id: u.id })).usuario.nombre, datos.nombre);
  assert.ok((await call("admin", "ListarUsuarios")).usuario.some((v) => v.id === u.id));
  await falla(call("admin", "CrearUsuario", { ...datos, usuario: "otra" }), "CONFLICTO");
  assert.equal(
    (await call("admin", "ActualizarUsuario", { ...datos, id: u.id, nombre: "Otro nombre" })).usuario
      .nombre,
    "Otro nombre",
  );
  for (const alias of ["org", "ana"]) await falla(call(alias, "ListarUsuarios"), "PERMISO");
  await call("admin", "EliminarUsuario", { id: u.id });
  await falla(call("admin", "ObtenerUsuario", { id: u.id }), "NO_ENCONTRADO");
});
test("CRUD de eventos y tipos, aislamiento del organizador y visibilidad pública", async () => {
  const datos = evento({ estado: "BORRADOR" });
  const { evento: e } = await call("org", "CrearEvento", datos);
  await falla(call("publico", "ObtenerEvento", { id: e.id }), "NO_ENCONTRADO");
  assert.ok((await call("org", "ListarEventos", { gestion: true })).evento.some((x) => x.id === e.id));
  await falla(call("otro", "ActualizarEvento", { ...datos, id: e.id }), "PERMISO");
  await falla(call("ana", "CrearEvento", datos), "PERMISO");
  await call("org", "ActualizarEvento", { ...datos, id: e.id, estado: "ACTIVO" });
  const { tipo: t } = await call("org", "CrearTipoEntrada", {
    evento_id: e.id,
    nombre: "Localidad",
    precio: "10.25",
    capacidad_asignada: 5,
  });
  assert.equal((await call("publico", "ListarTiposEntrada", { evento_id: e.id })).tipo[0].id, t.id);
  await call("org", "ActualizarTipoEntrada", {
    id: t.id,
    nombre: "General",
    precio: 15,
    capacidad_asignada: 4,
    estado: "INACTIVO",
  });
  await falla(call("publico", "ObtenerTipoEntrada", { id: t.id }), "NO_ENCONTRADO");
  await falla(call("otro", "EliminarTipoEntrada", { id: t.id }), "PERMISO");
  await falla(call("org", "EliminarEvento", { id: e.id }), "CONFLICTO");
  await call("org", "EliminarTipoEntrada", { id: t.id });
  await call("org", "EliminarEvento", { id: e.id });
});
test("PostgreSQL impide negativos, exceso de asignaciones y reducciones de aforo", async () => {
  const { e, t } = await oferta(fx, 12, 8);
  for (const [sql, p] of [
    ["UPDATE tipos_entrada SET precio=-1 WHERE id=$1", t.id],
    ["UPDATE tipos_entrada SET capacidad_asignada=-1 WHERE id=$1", t.id],
    ["UPDATE tipos_entrada SET cantidad_disponible=-1 WHERE id=$1", t.id],
    ["UPDATE eventos SET capacidad_total=2 WHERE id=$1", e.id],
  ]) {
    await assert.rejects(fx.pool.query(sql, [p]), (err) => err.code === "23514");
  }
  const dos = await Promise.allSettled(
    ["A", "B"].map((nombre) =>
      call("org", "CrearTipoEntrada", { evento_id: e.id, nombre, precio: 1, capacidad_asignada: 4 }),
    ),
  );
  assert.equal(dos.filter((x) => x.status === "fulfilled").length, 1);
});
test("Compra atómica emite códigos individuales, calcula en NUMERIC y el historial conserva el precio", async () => {
  const { e, t } = await oferta(fx);
  const { compra, entrada } = await call("ana", "CrearCompra", pedido(t, 3));
  assert.equal(Number(compra.valor_total), 73500.75);
  assert.equal(entrada.length, 3);
  assert.equal(new Set(entrada.map((i) => i.codigo)).size, 3);
  assert.ok(
    entrada.every(
      (i) => i.evento_id === e.id && i.compra_id === compra.id && Number(i.precio_pagado) === 24500.25,
    ),
  );
  assert.equal(await stock(t), 7);
  await call("org", "ActualizarTipoEntrada", {
    id: t.id,
    nombre: t.nombre,
    capacidad_asignada: 10,
    precio: 99,
  });
  assert.equal(
    Number((await call("ana", "ObtenerCompra", { id: compra.id })).compra.valor_total),
    73500.75,
  );
  assert.equal(
    (
      await call("admin", "ActualizarCompra", {
        id: compra.id,
        usuario_responsable_id: fx.cuentas.admin.id,
      })
    ).compra.usuario_responsable_id,
    fx.cuentas.admin.id,
  );
  await falla(call("luis", "ObtenerCompra", { id: compra.id }), "NO_ENCONTRADO");
  await falla(call("otro", "ObtenerEntrada", { id: entrada[0].id }), "NO_ENCONTRADO");
  assert.ok(
    (await call("org", "ListarCompras", { evento_id: e.id })).compra.some((c) => c.id === compra.id),
  );
  assert.equal((await call("otro", "ListarEntradas", { evento_id: e.id })).entrada?.length || 0, 0);
  await falla(call("ana", "CrearEntrada", { entrada_origen_id: entrada[0].id }), "PERMISO");
  await falla(call("ana", "CrearCompra", pedido(t, 1, { cliente_id: fx.cuentas.luis.id })), "PERMISO");
});
test("Inventario por localidad, aforo global, cierre de venta y precio esperado", async () => {
  const { e, t } = await oferta(fx, 8, 3);
  await falla(call("ana", "CrearCompra", pedido(t, 4)), "INVENTARIO");
  await falla(call("ana", "CrearCompra", pedido(t, 9)), "AFORO");
  await falla(call("ana", "CrearCompra", pedido(t, 1, { precio_esperado: 1 })), "PRECIO");
  await call("org", "ActualizarTipoEntrada", {
    id: t.id,
    nombre: t.nombre,
    precio: 2,
    capacidad_asignada: 3,
    estado: "INACTIVO",
  });
  await falla(call("ana", "CrearCompra", pedido(t)), "CERRADO");
  await call("org", "ActualizarTipoEntrada", {
    id: t.id,
    nombre: t.nombre,
    precio: 2,
    capacidad_asignada: 3,
    estado: "ACTIVO",
  });
  await fx.pool.query("UPDATE eventos SET estado='CERRADO' WHERE id=$1", [e.id]);
  await falla(call("ana", "CrearCompra", pedido(t)), "CERRADO");
  assert.equal(await stock(t), 3);
});
test("Compras simultáneas en los últimos cupos: solo una se confirma", async () => {
  const { e, t } = await oferta(fx, 3);
  const rs = await Promise.allSettled(["ana", "luis"].map((a) => call(a, "CrearCompra", pedido(t, 2))));
  assert.equal(rs.filter((r) => r.status === "fulfilled").length, 1);
  assert.equal(await stock(t), 1);
  assert.equal((await call("admin", "ListarEntradas", { evento_id: e.id })).entrada.length, 2);
});
test("Idempotencia simultánea: mismo pedido y mismo código, sin doble descuento", async () => {
  const { t } = await oferta(fx, 4),
    a = pedido(t, 3);
  const [x, y] = await Promise.all([call("ana", "CrearCompra", a), call("ana", "CrearCompra", a)]);
  assert.equal(x.compra.id, y.compra.id);
  assert.equal(await stock(t), 1);
  await falla(call("ana", "CrearCompra", { ...a, cantidad: 2 }), "CONFLICTO");
});
test("Un error después de emitir revierte compra, entradas y existencias", async () => {
  const { e, t } = await oferta(fx);
  await fx.pool
    .query(`CREATE FUNCTION prueba_fallo() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'prueba'; END $$;
    CREATE CONSTRAINT TRIGGER prueba_fallo AFTER INSERT ON entradas DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION prueba_fallo()`);
  try {
    await falla(call("ana", "CrearCompra", pedido(t, 2)), "INTERNO");
  } finally {
    await fx.pool.query("DROP TRIGGER prueba_fallo ON entradas; DROP FUNCTION prueba_fallo()");
  }
  assert.equal(await stock(t), 10);
  assert.equal((await call("admin", "ListarCompras", { evento_id: e.id })).compra?.length || 0, 0);
  assert.equal((await call("admin", "ListarEntradas", { evento_id: e.id })).entrada?.length || 0, 0);
});
test("Reemisión, anulación individual y cancelaciones repetidas conservan el inventario", async () => {
  const { t } = await oferta(fx, 3);
  const { compra, entrada } = await call(
    "admin",
    "CrearCompra",
    pedido(t, 2, { cliente_id: fx.cuentas.ana.id }),
  );
  const nueva = (await call("admin", "CrearEntrada", { entrada_origen_id: entrada[0].id })).entrada;
  assert.notEqual(nueva.codigo, entrada[0].codigo);
  assert.equal(await stock(t), 1);
  await falla(call("org", "ValidarEntrada", { codigo: entrada[0].codigo }), "ENTRADA_INVALIDA");
  await call("admin", "ActualizarEntrada", { id: nueva.id, estado: "CANCELADA" });
  await call("admin", "EliminarEntrada", { id: nueva.id });
  assert.equal(await stock(t), 2);
  await Promise.all([
    call("admin", "EliminarCompra", { id: compra.id }),
    call("admin", "ActualizarCompra", { id: compra.id, estado: "CANCELADA" }),
  ]);
  assert.equal(await stock(t), 3);
  await falla(call("org", "ValidarEntrada", { codigo: entrada[1].codigo }), "ENTRADA_INVALIDA");
});
test("Validación simultánea de dos porteros, pertenencia y bloqueo del usado", async () => {
  const { t } = await oferta(fx, 2);
  const {
    compra,
    entrada: [i],
  } = await call("ana", "CrearCompra", pedido(t));
  await falla(call("otro", "ValidarEntrada", { codigo: i.codigo }), "PERMISO");
  await falla(call("ana", "ValidarEntrada", { codigo: i.codigo }), "PERMISO");
  const rs = await Promise.allSettled(
    ["org", "admin"].map((a) => call(a, "ValidarEntrada", { codigo: i.codigo })),
  );
  assert.equal(rs.filter((r) => r.status === "fulfilled").length, 1);
  assert.equal((await call("ana", "ObtenerEntrada", { id: i.id })).entrada.estado, "UTILIZADA");
  await falla(call("admin", "EliminarCompra", { id: compra.id }), "UTILIZADA");
  assert.equal(await stock(t), 1);
});

test("La capacidad disponible coincide con los pases emitidos incluso al cambiar el cupo", async () => {
  const { t } = await oferta(fx, 12, 6);
  const { entrada } = await call("ana", "CrearCompra", pedido(t, 4));
  await assert.rejects(
    fx.pool.query("UPDATE tipos_entrada SET cantidad_disponible=5 WHERE id=$1", [t.id]),
    (err) => err.code === "23514",
  );
  await falla(
    call("org", "ActualizarTipoEntrada", {
      id: t.id,
      nombre: t.nombre,
      precio: 99,
      capacidad_asignada: 3,
    }),
    "DATOS",
  );
  const editado = await call("org", "ActualizarTipoEntrada", {
    id: t.id,
    nombre: t.nombre,
    precio: 99,
    capacidad_asignada: 8,
  });
  assert.equal(editado.tipo.cantidad_disponible, 4);
  const cambios = await Promise.allSettled(
    [1, 2].map(() => call("admin", "CrearEntrada", { entrada_origen_id: entrada[0].id })),
  );
  assert.equal(cambios.filter((x) => x.status === "fulfilled").length, 1);
  assert.equal(await stock(t), 4);
});

test("La validación y la cancelación compiten por una única transición", async () => {
  const { t } = await oferta(fx, 1);
  const {
    compra,
    entrada: [i],
  } = await call("ana", "CrearCompra", pedido(t));
  const intentos = await Promise.allSettled([
    call("org", "ValidarEntrada", { codigo: i.codigo }),
    call("admin", "EliminarCompra", { id: compra.id }),
  ]);
  assert.equal(intentos.filter((r) => r.status === "fulfilled").length, 1);
  const final = await call("ana", "ObtenerCompra", { id: compra.id });
  const cancelada = final.compra.estado === "CANCELADA";
  assert.equal(final.entrada[0].estado, cancelada ? "CANCELADA" : "UTILIZADA");
  assert.equal(await stock(t), cancelada ? 1 : 0);
});

test("Permisos de mutación por rol y filtros privados en el catálogo", async () => {
  const { e, t } = await oferta(fx);
  const {
    compra,
    entrada: [i],
  } = await call("ana", "CrearCompra", pedido(t));
  for (const alias of ["org", "ana"]) {
    for (const [op, args] of [
      ["EliminarUsuario", { id: fx.cuentas.admin.id }],
      ["ActualizarCompra", { id: compra.id, estado: "CANCELADA" }],
      ["EliminarCompra", { id: compra.id }],
      ["CrearEntrada", { entrada_origen_id: i.id }],
      ["ActualizarEntrada", { id: i.id, estado: "UTILIZADA" }],
      ["EliminarEntrada", { id: i.id }],
    ]) {
      await falla(call(alias, op, args), "PERMISO");
    }
  }
  await falla(call("org", "CrearCompra", pedido(t)), "PERMISO");
  await falla(call("ana", "ListarEventos", { gestion: true }), "PERMISO");
  await falla(call("publico", "ObtenerEvento", { id: e.id, gestion: true }), "PERMISO");
  await falla(
    call("otro", "CrearTipoEntrada", {
      evento_id: e.id,
      nombre: "Nueva",
      precio: 10,
      capacidad_asignada: 1,
    }),
    "PERMISO",
  );
  for (const c of [0, -1]) await falla(call("ana", "CrearCompra", pedido(t, c)), "DATOS");
  const cupo = await stock(t);
  await fx.pool.query("UPDATE eventos SET fecha=CURRENT_DATE-1 WHERE id=$1", [e.id]);
  await falla(call("ana", "CrearCompra", pedido(t)), "CERRADO");
  assert.equal(await stock(t), cupo);
});

test("Registro público: cliente activo, bcrypt, login, datos obligatorios y unicidad simultánea", async () => {
  const datos = {
    identificacion: "REGISTRO-API",
    nombre: "María & José",
    usuario: "Nuevo.Cliente",
    password: randomUUID(),
  };
  const alta = () => call("publico", "RegistrarUsuario", { ...datos, rol: "ADMINISTRADOR", estado: "INACTIVO" });
  const intentos = await Promise.allSettled([alta(), alta()]);
  assert.equal(intentos.filter((r) => r.status === "fulfilled").length, 1);
  const { usuario: cuenta } = intentos.find((r) => r.status === "fulfilled").value;
  const error = intentos.find((r) => r.status === "rejected").reason;
  assert.equal(error.root.Envelope.Body.Fault.detail.ErrorEventPass.codigo, "CONFLICTO");
  assert.equal(cuenta.rol, "CLIENTE");
  assert.equal(cuenta.estado, "ACTIVO");
  assert.equal(cuenta.usuario, "nuevo.cliente");
  assert.ok(!("password_hash" in cuenta) && !("version_sesion" in cuenta));
  const { rows: [almacenada] } = await fx.pool.query(
    "SELECT rol,estado,password_hash FROM usuarios WHERE id=$1", [cuenta.id],
  );
  assert.equal(almacenada.rol, "CLIENTE");
  assert.equal(almacenada.estado, "ACTIVO");
  assert.match(almacenada.password_hash, /^\$2[aby]\$12\$/);
  const sesion = await call("publico", "IniciarSesion", { usuario: datos.usuario, password: datos.password });
  assert.equal(sesion.usuario.id, cuenta.id);
  assert.ok(sesion.token);

  await falla(call("publico", "RegistrarUsuario", { ...datos, usuario: "otro.login" }), "CONFLICTO");
  await falla(call("publico", "RegistrarUsuario", { ...datos, identificacion: "OTRO-ID", usuario: "NUEVO.CLIENTE" }), "CONFLICTO");
  for (const cambio of [{ nombre: "   " }, { usuario: "contiene espacios" }, { password: "corta" }, { password: "é".repeat(37) }])
    await falla(call("publico", "RegistrarUsuario", { ...datos, ...cambio }), "DATOS");
  const { password, ...incompletos } = datos;
  await falla(call("publico", "RegistrarUsuario", incompletos), "XML");
});

test("Solo el administrador puede cambiar roles y los JWT anteriores siguen revocados al restaurar el rol", async () => {
  const datos = { identificacion: "REG-ROLES", nombre: "Cuenta de roles", usuario: "reg.roles", password: randomUUID() };
  const { usuario } = await call("publico", "RegistrarUsuario", datos);
  const credenciales = { usuario: datos.usuario, password: datos.password };
  const sesion = await call("publico", "IniciarSesion", credenciales);
  const cliente = await fx.cliente(sesion.token);
  const cambio = { id: usuario.id, nombre: datos.nombre, identificacion: datos.identificacion, usuario: datos.usuario, rol: "ORGANIZADOR" };
  await falla(call("publico", "ActualizarUsuario", cambio), "SESION");
  await falla(call("publico", "CrearUsuario", { ...datos, rol: "ADMINISTRADOR" }), "SESION");
  for (const actor of [cliente, "org"])
    await falla(call(actor, "ActualizarUsuario", { ...cambio, rol: "ADMINISTRADOR" }), "PERMISO");
  assert.equal((await call("admin", "ObtenerUsuario", { id: usuario.id })).usuario.rol, "CLIENTE");
  assert.equal((await call("admin", "ActualizarUsuario", cambio)).usuario.rol, "ORGANIZADOR");
  await falla(call(cliente, "ListarEntradas"), "SESION");
  const comoOrg = await call("publico", "IniciarSesion", credenciales);
  assert.equal(comoOrg.usuario.rol, "ORGANIZADOR");
  await call("admin", "ActualizarUsuario", { ...cambio, rol: "CLIENTE" });
  await falla(call(cliente, "ListarEntradas"), "SESION");
  await falla(call(await fx.cliente(comoOrg.token), "ListarEntradas"), "SESION");
  const { rows: [fila] } = await fx.pool.query("SELECT version_sesion FROM usuarios WHERE id=$1", [usuario.id]);
  assert.equal(fila.version_sesion, 3);
});

test("Los datos vinculados conservan su rol y las cinco tablas tras reinicializar y reconectar", async () => {
  const { t } = await oferta(fx);
  await call("luis", "CrearCompra", pedido(t));
  for (const [alias, rol] of [["luis", "ORGANIZADOR"], ["org", "CLIENTE"]]) {
    const { id, identificacion, nombre, usuario } = fx.cuentas[alias];
    await falla(call("admin", "ActualizarUsuario", { id, identificacion, nombre, usuario, rol }), "CONFLICTO");
  }
  const tablas = ["usuarios", "eventos", "tipos_entrada", "compras", "entradas"];
  async function huellas(db) {
    const registros = [];
    for (const tabla of tablas) {
      const { rows } = await db.query(`SELECT id, md5(to_jsonb(t)::text) AS huella FROM eventpass.${tabla} t ORDER BY id`);
      assert.ok(rows.length > 0);
      registros.push(rows);
    }
    return registros;
  }
  const objetos = `SELECT indexdef AS definicion FROM pg_indexes WHERE schemaname='eventpass'
    UNION ALL SELECT pg_get_triggerdef(t.oid) FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid
      WHERE c.relnamespace='eventpass'::regnamespace AND NOT t.tgisinternal
    UNION ALL SELECT pg_get_constraintdef(oid) FROM pg_constraint WHERE connamespace='eventpass'::regnamespace
    ORDER BY 1`;
  const antes = await huellas(fx.pool);
  const originales = (await fx.pool.query(objetos)).rows;
  await fx.pool.query(await readFile(new URL("../server/schema.sql", import.meta.url), "utf8"));
  await fx.pool.query(await readFile(new URL("../server/configurar-search-path.sql", import.meta.url), "utf8"));
  const destino = new URL(fx.pool.options.connectionString);
  destino.searchParams.delete("options");
  const externa = new pg.Client({ connectionString: destino.href });
  await externa.connect();
  try {
    assert.equal((await externa.query("SHOW search_path")).rows[0].search_path, "eventpass, pg_catalog");
    // to_jsonb representa los timestamptz con la zona de cada conexión.
    await externa.query("SET TIME ZONE 'America/Bogota'");
    for (const tabla of tablas) {
      assert.ok((await externa.query(`SELECT * FROM ${tabla} LIMIT 1`)).rowCount);
      const { rows: [r] } = await externa.query("SELECT to_regclass($1)::oid = to_regclass($2)::oid AS misma", [tabla, "eventpass." + tabla]);
      assert.equal(r.misma, true);
    }
    assert.deepEqual(await huellas(externa), antes);
    assert.deepEqual((await externa.query(objetos)).rows, originales);
  } finally {
    await externa.end();
  }
});

test("Cliente y mostrador guardan al organizador de su evento; la reparación solo completa nulos", async () => {
  const primera = await oferta(fx);
  const segunda = await oferta(fx, 5, 5, "otro");
  const cliente = await call("ana", "CrearCompra", pedido(primera.t));
  const mostrador = await call("admin", "CrearCompra", pedido(segunda.t, 1, { cliente_id: fx.cuentas.ana.id }));
  assert.equal(cliente.compra.usuario_responsable_id, primera.e.organizador_id);
  assert.equal(mostrador.compra.usuario_responsable_id, segunda.e.organizador_id);
  await fx.pool.query("UPDATE compras SET usuario_responsable_id=NULL WHERE id=$1", [cliente.compra.id]);
  await fx.pool.query("UPDATE compras SET usuario_responsable_id=$1 WHERE id=$2", [fx.cuentas.admin.id, mostrador.compra.id]);
  const sql = await readFile(new URL("../server/reparar-responsables.sql", import.meta.url), "utf8");
  assert.equal((await fx.pool.query(sql)).rowCount, 1);
  assert.equal((await fx.pool.query(sql)).rowCount, 0);
  assert.equal((await call("ana", "ObtenerCompra", { id: cliente.compra.id })).compra.usuario_responsable_id, primera.e.organizador_id);
  assert.equal((await call("admin", "ObtenerCompra", { id: mostrador.compra.id })).compra.usuario_responsable_id, fx.cuentas.admin.id);
});
