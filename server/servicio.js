import * as u from "./usuarios.js";
import * as c from "./catalogo.js";
import * as v from "./ventas.js";
import { transaccion } from "./db.js";
import { exigir, mensajeSeguro } from "./validacion.js";

const admin = [u.ADMIN];
const publicas = null;
// La clave de salida corresponde al elemento tipado del WSDL. Las listas repiten ese elemento.
const operaciones = {
  IniciarSesion: [publicas, u.iniciar],
  RegistrarUsuario: [publicas, u.registrarUsuario, "usuario"],
  CrearUsuario: [admin, u.crearUsuario, "usuario"],
  ListarUsuarios: [admin, u.listarUsuarios, "usuario"],
  ObtenerUsuario: [admin, u.obtenerUsuario, "usuario"],
  ActualizarUsuario: [admin, u.actualizarUsuario, "usuario"],
  EliminarUsuario: [admin, u.eliminarUsuario],
  CrearEvento: [u.personal, (cxt, a) => c.guardarEvento(cxt, a, false), "evento"],
  ListarEventos: [publicas, c.listarEventos, "evento"],
  ObtenerEvento: [publicas, c.obtenerEvento, "evento"],
  ActualizarEvento: [u.personal, (cxt, a) => c.guardarEvento(cxt, a, true), "evento"],
  EliminarEvento: [u.personal, c.eliminarEvento],
  CrearTipoEntrada: [u.personal, (cxt, a) => c.guardarTipo(cxt, a, false), "tipo"],
  ListarTiposEntrada: [publicas, c.listarTipos, "tipo"],
  ObtenerTipoEntrada: [publicas, c.obtenerTipo, "tipo"],
  ActualizarTipoEntrada: [u.personal, (cxt, a) => c.guardarTipo(cxt, a, true), "tipo"],
  EliminarTipoEntrada: [u.personal, c.eliminarTipo],
  CrearCompra: [[u.ADMIN, u.CLI], v.crearCompra],
  ListarCompras: [u.todos, v.listarCompras, "compra"],
  ObtenerCompra: [u.todos, v.detalleCompra],
  ActualizarCompra: [admin, v.actualizarCompra, "compra"],
  EliminarCompra: [admin, (ctx, a) => v.actualizarCompra(ctx, a, true), "compra"],
  CrearEntrada: [admin, v.reemitirEntrada, "entrada"],
  ListarEntradas: [u.todos, v.listarEntradas, "entrada"],
  ObtenerEntrada: [u.todos, v.obtenerEntrada, "entrada"],
  ActualizarEntrada: [admin, v.actualizarEntrada, "entrada"],
  EliminarEntrada: [admin, v.eliminarEntrada, "entrada"],
  ValidarEntrada: [u.personal, v.validarEntrada, "entrada"],
};
function datosXML(valor) {
  if (valor instanceof Date) return valor.toISOString();
  if (Array.isArray(valor)) return valor.map(datosXML);
  if (valor && typeof valor === "object") {
    return Object.fromEntries(
      Object.entries(valor)
        .filter(([, v]) => v != null)
        .map(([k, v]) => [k, datosXML(v)]),
    );
  }
  return valor;
}
export function servicios(pool, secreto) {
  const metodos = {};
  for (const [nombre, [roles, ejecutar, envoltura]] of Object.entries(operaciones)) {
    metodos[nombre] = async (args, callback, headers) => {
      try {
        return await transaccion(pool, async (db) => {
          const token = headers?.Autenticacion?.token;
          const actor = token ? await u.identificar(db, token, secreto) : null;
          exigir(!roles || actor, "SESION", "Inicia sesión para continuar.");
          exigir(
            !roles || roles.includes(actor.rol),
            "PERMISO",
            "Tu rol no tiene permiso para esta operación.",
          );
          const result = await ejecutar({ db, actor, secreto }, args || {});
          return datosXML(envoltura ? { [envoltura]: result } : result);
        });
      } catch (error) {
        const { codigo, message } = mensajeSeguro(error);
        throw {
          Fault: {
            faultcode: codigo === "INTERNO" ? "soap:Server" : "soap:Client",
            faultstring: message,
            detail: { "tns:ErrorEventPass": { "tns:codigo": codigo } },
            statusCode: 500,
          },
        };
      }
    };
  }
  return { EventPassService: { EventPassPort: metodos } };
}
