import { randomBytes } from "node:crypto";
import { conectar, transaccion } from "./db.js";
import { crearUsuario, CLI, ORG } from "./usuarios.js";
import { guardarEvento, guardarTipo } from "./catalogo.js";
import { exigir } from "./validacion.js";
const pool = conectar();
try {
  const credenciales = await transaccion(pool, async (db) => {
    const nuevas = [];
    async function demo(usuario, rol, nombre) {
      const identificacion = "MUESTRA-" + rol;
      const previo = (
        await db.query("SELECT id,identificacion,rol,estado FROM usuarios WHERE usuario=$1", [usuario])
      ).rows[0];
      if (previo) {
        exigir(
          previo.identificacion === identificacion && previo.rol === rol && previo.estado === "ACTIVO",
          "CONFIG",
          "Hay un conflicto con el usuario de muestra.",
        );
        return previo;
      }
      const password = randomBytes(18).toString("base64url");
      const cuenta = await crearUsuario({ db }, { identificacion, nombre, usuario, password, rol });
      nuevas.push({ usuario, password });
      return cuenta;
    }
    const actor = await demo("organizacion.demo", ORG, "Agenda Cultural del Cauca");
    await demo("cliente.demo", CLI, "Cliente de muestra");
    const eventos = [
      [
        "FRECUENCIA",
        "Frecuencia Andina",
        "Música",
        "Teatro Municipal · Popayán",
        "Un encuentro de electrónica y percusión en vivo con artistas del suroccidente.",
        14,
        "19:30",
        45000,
      ],
      [
        "FORMA",
        "Forma y materia",
        "Artes",
        "Sala de exposiciones · Popayán",
        "Una jornada de grabado y escultura con recorridos guiados por los talleres participantes.",
        22,
        "10:00",
        18000,
      ],
      [
        "CODIGO",
        "Código Abierto",
        "Conferencia",
        "Auditorio central · Cali",
        "Conferencias sobre software abierto, datos y los equipos que mantienen herramientas de uso público.",
        30,
        "09:00",
        35000,
      ],
      [
        "CUERDAS",
        "Cuerdas al atardecer",
        "Música",
        "Patio de las artes · Popayán",
        "Repertorio de cámara para cuerdas en un concierto de tarde.",
        38,
        "17:00",
        28000,
      ],
    ];
    for (const [codigo, nombre, categoria, ubicacion, descripcion, dias, hora, precio] of eventos) {
      const existe = await db.query("SELECT id FROM eventos WHERE codigo=$1", [codigo]);
      if (existe.rowCount) continue;
      const {
        rows: [{ fecha }],
      } = await db.query("SELECT (CURRENT_DATE+$1::integer)::text AS fecha", [dias]);
      const evento = await guardarEvento(
        { db, actor },
        {
          codigo,
          nombre,
          categoria,
          ubicacion,
          descripcion,
          fecha,
          hora,
          capacidad_total: 160,
          estado: "ACTIVO",
        },
        false,
      );
      for (const [nombre, cupo, costo] of [
        ["General", 120, precio],
        ["Preferencial", 40, precio + 20000],
      ]) {
        await guardarTipo(
          { db, actor },
          { evento_id: evento.id, nombre, capacidad_asignada: cupo, precio: costo, estado: "ACTIVO" },
          false,
        );
      }
    }
    return nuevas;
  });
  console.log("Agenda de muestra preparada.");
  for (const c of credenciales) console.log(`Cuenta local: ${c.usuario} · contraseña: ${c.password}`);
} finally {
  await pool.end();
}
