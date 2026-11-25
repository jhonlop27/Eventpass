import { randomBytes, randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { once } from "node:events";
import pg from "pg";
import soap from "soap";
import { conectar, transaccion } from "../server/db.js";
import { crearApp } from "../server/app.js";
import { crearUsuario } from "../server/usuarios.js";

export async function entorno() {
  const base = process.env.TEST_DATABASE_URL || process.env.DATABASE_URL;
  if (!base)
    throw new Error(
      "Configura TEST_DATABASE_URL o DATABASE_URL con un rol local con CREATEDB para las pruebas.",
    );
  const nombre = "ep_test_" + randomUUID().replaceAll("-", "");
  const control = new pg.Pool({ connectionString: base }),
    destino = new URL(base);
  destino.pathname = "/" + nombre;
  const pool = conectar(destino.href),
    secreto = randomBytes(40).toString("hex");
  let server,
    creada = false;
  const cuentas = {},
    clientes = {},
    docs = new URL("../server/schema.sql", import.meta.url);
  async function cerrar() {
    if (server?.listening) {
      const cerrado = once(server, "close");
      server.close();
      server.closeAllConnections();
      await cerrado;
    }
    await pool.end();
    if (creada) await control.query("DROP DATABASE " + nombre);
    await control.end();
  }
  try {
    await control.query("CREATE DATABASE " + nombre);
    creada = true;
    await pool.query(await readFile(docs, "utf8"));
    const app = await crearApp(pool, secreto, "http://localhost:4000/soap");
    server = app.listen(0, "127.0.0.1");
    await once(server, "listening");
    const url = "http://127.0.0.1:" + server.address().port;
    async function cliente(token) {
      const cl = await soap.createClientAsync(url + "/soap?wsdl", {
        endpoint: url + "/soap",
        wsdl_options: { proxy: false },
        disableCache: true,
      });
      if (token)
        cl.addSoapHeader(
          `<ep:Autenticacion xmlns:ep="urn:eventpass"><ep:token>${token}</ep:token></ep:Autenticacion>`,
        );
      return cl;
    }
    clientes.publico = await cliente();
    async function llamar(alias, operacion, args = {}) {
      const cl = typeof alias === "string" ? clientes[alias] : alias;
      const [r] = await cl[operacion + "Async"](args, { proxy: false });
      return r || {};
    }
    for (const [alias, rol] of Object.entries({
      admin: "ADMINISTRADOR",
      org: "ORGANIZADOR",
      otro: "ORGANIZADOR",
      ana: "CLIENTE",
      luis: "CLIENTE",
    })) {
      const password = randomBytes(18).toString("hex");
      const u = await transaccion(pool, (db) =>
        crearUsuario(
          { db },
          { identificacion: alias, nombre: "Prueba " + alias, usuario: alias, rol, password },
        ),
      );
      const s = await llamar("publico", "IniciarSesion", { usuario: alias, password });
      cuentas[alias] = { ...u, password, token: s.token };
      clientes[alias] = await cliente(s.token);
    }
    return { pool, url, cuentas, clientes, cliente, llamar, cerrar, secreto };
  } catch (error) {
    await cerrar();
    throw error;
  }
}
export function evento(datos = {}) {
  return {
    codigo: randomUUID(),
    nombre: "Encuentro de prueba",
    descripcion: "Programación de prueba.",
    categoria: "Música",
    ubicacion: "Popayán",
    fecha: "2099-08-22",
    hora: "19:30:00",
    capacidad_total: 10,
    estado: "ACTIVO",
    ...datos,
  };
}
export async function oferta(fx, cupo = 10, asignado = cupo, alias = "org") {
  const { evento: e } = await fx.llamar(alias, "CrearEvento", evento({ capacidad_total: cupo }));
  const { tipo: t } = await fx.llamar(alias, "CrearTipoEntrada", {
    evento_id: e.id,
    nombre: "General",
    precio: "24500.25",
    capacidad_asignada: asignado,
    estado: "ACTIVO",
  });
  return { e, t };
}
export const pedido = (tipo, cantidad = 1, datos = {}) => ({
  tipo_entrada_id: tipo.id,
  cantidad,
  solicitud_id: randomUUID(),
  ...datos,
});
