import { before, after, test } from "node:test";
import assert from "node:assert/strict";
import { chromium } from "playwright";
import { existsSync } from "node:fs";
import { entorno, oferta, pedido } from "./entorno.js";
let fx, browser, primera;
before(async () => {
  assert.ok(
    existsSync(new URL("../dist/index.html", import.meta.url)),
    "Ejecuta npm run build antes de la suite de navegador.",
  );
  fx = await entorno();
  primera = await oferta(fx, 30);
  browser = await chromium.launch({
    headless: true,
    executablePath: process.env.BROWSER_EXECUTABLE || undefined,
  });
});
after(async () => {
  await browser?.close();
  if (fx) await fx.cerrar();
});

async function pagina(viewport = { width: 1366, height: 850 }) {
  const context = await browser.newContext({ viewport, locale: "es-CO" });
  const p = await context.newPage();
  p.setDefaultTimeout(6000);
  return { p, context };
}
async function login(p, alias) {
  const u = fx.cuentas[alias];
  await p.getByLabel("Usuario", { exact: true }).fill(u.usuario);
  await p.getByLabel("Contraseña", { exact: true }).fill(u.password);
  await p.getByRole("button", { name: "Ingresar", exact: true }).click();
  await p.waitForURL((url) => url.pathname !== "/login");
}
async function ancho(p) {
  assert.ok(
    await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
    "Desbordamiento horizontal en " + p.url(),
  );
}
async function ver(p, role, name) {
  await p.getByRole(role, { name, exact: true }).first().waitFor();
}
async function destino(p, ruta, titulo) {
  await p.goto(fx.url + ruta);
  await ver(p, "heading", titulo);
}
test("Inicio, filtros, selección, login con retorno, compra real y pases individuales", async () => {
  const { p, context } = await pagina(),
    errores = [],
    operaciones = [];
  p.on("pageerror", (e) => errores.push(e.message));
  p.on("request", (r) => {
    if (r.method() === "POST") operaciones.push([new URL(r.url()).pathname, r.headers().soapaction]);
  });
  try {
    await p.goto(fx.url);
    await p.getByRole("link", { name: "Explorar eventos" }).click();
    await p.getByLabel("Buscar evento").fill("ninguna coincidencia");
    await p.getByText("No hay coincidencias para estos filtros.").waitFor();
    await p.getByRole("button", { name: "Limpiar filtros" }).click();
    await p.getByRole("link", { name: "Ver evento", exact: true }).first().click();
    await p.getByLabel("Cantidad", { exact: true }).fill("2");
    await p.getByRole("button", { name: "Iniciar sesión para comprar" }).click();
    await login(p, "ana");
    assert.equal(await p.getByLabel("Cantidad", { exact: true }).inputValue(), "2");
    await p.getByRole("button", { name: "Revisar compra" }).click();
    await ver(p, "dialog", "Resumen de compra");
    await p.getByRole("button", { name: "Confirmar compra" }).click();
    await p.getByText("Compra confirmada", { exact: true }).waitFor();
    assert.equal(await p.locator(".pase").count(), 2);
    await p.getByRole("link", { name: "Ver entrada", exact: true }).first().click();
    await ver(p, "heading", "Entrada digital");
    await p.locator(".pase-codigo code").waitFor();
    assert.match(await p.locator(".pase-codigo code").textContent(), /^EP-/);
    await p.getByRole("link", { name: "Ver compra asociada" }).click();
    await ver(p, "heading", "Detalle de compra");
    await destino(p, "/panel", "Resumen");
    await ver(p, "link", "Mi cuenta");
    assert.equal(
      await p
        .getByRole("navigation", { name: "Menú del panel" })
        .getByRole("link", { name: "Usuarios" })
        .count(),
      0,
    );
    await destino(p, "/panel/compras", "Mis compras");
    await destino(p, "/panel/entradas", "Mis entradas");
    await destino(p, "/panel/usuarios", "Acceso restringido");
    await p.getByRole("button", { name: "Cerrar sesión" }).click();
    await p.goto(fx.url + "/panel");
    await p.waitForURL("**/login");
    assert.ok(operaciones.every(([ruta]) => ruta === "/soap"));
    assert.ok(operaciones.some(([, op]) => op?.includes("CrearCompra")));
    assert.deepEqual(errores, []);
  } finally {
    await context.close();
  }
});
test("Formulario de acceso muestra el rechazo y la compra rechazada conserva el mensaje", async () => {
  const { p, context } = await pagina();
  try {
    await p.goto(fx.url + "/login");
    await p.getByLabel("Usuario", { exact: true }).fill("ana");
    await p.getByLabel("Contraseña", { exact: true }).fill("incorrecta");
    await p.getByRole("button", { name: "Ingresar", exact: true }).click();
    await p.getByRole("alert").getByText("Usuario o contraseña incorrectos.").waitFor();
    await login(p, "ana");
    const { e, t } = await oferta(fx, 1);
    await p.goto(fx.url + "/eventos/" + e.id);
    await p.getByRole("button", { name: "Revisar compra" }).click();
    await fx.llamar("luis", "CrearCompra", pedido(t));
    await p.getByRole("button", { name: "Confirmar compra" }).click();
    await p.getByRole("alert").first().waitFor();
    await p.getByText("Las entradas para este evento están agotadas o la venta está cerrada.").waitFor();
    assert.ok(p.url().includes("/eventos/"));
    assert.equal(await p.getByText("Compra confirmada").count(), 0);
  } finally {
    await context.close();
  }
});
test("Administrador: usuarios, eventos, localidades y edición con formularios reales", async () => {
  const { p, context } = await pagina({ width: 1024, height: 800 });
  try {
    await p.goto(fx.url + "/login");
    await login(p, "admin");
    await ver(p, "heading", "Resumen");
    await destino(p, "/panel/usuarios", "Usuarios");
    await p.getByRole("button", { name: "Crear usuario" }).click();
    let d = p.getByRole("dialog");
    await d.getByLabel("Identificación", { exact: true }).fill("WEB-UI");
    await d.getByLabel("Nombre", { exact: true }).fill("Cliente browser");
    await d.getByLabel("Usuario", { exact: true }).fill("cliente.browser");
    await d.getByLabel("Contraseña", { exact: true }).fill(fx.cuentas.ana.password);
    await d.getByRole("button", { name: "Guardar" }).click();
    await p.getByText("Cliente browser", { exact: true }).waitFor();
    let row = p.getByRole("row").filter({ hasText: "Cliente browser" });
    await row.getByRole("button", { name: "Editar" }).click();
    d = p.getByRole("dialog");
    await d.getByLabel("Nombre", { exact: true }).fill("Cliente editado");
    await d.getByRole("button", { name: "Guardar" }).click();
    row = p.getByRole("row").filter({ hasText: "Cliente editado" });
    await row.getByRole("button", { name: "Eliminar" }).click();
    await p.getByRole("button", { name: "Confirmar eliminación" }).click();
    await row.waitFor({ state: "detached" });
    await destino(p, "/panel/eventos", "Eventos");
    await p.getByRole("button", { name: "Crear evento" }).click();
    d = p.getByRole("dialog");
    for (const [label, v] of [
      ["Código", "WEB-EV"],
      ["Nombre del evento", "Festival browser"],
      ["Categoría", "Artes"],
      ["Ubicación", "Sala virtual"],
      ["Fecha", "2099-06-26"],
      ["Hora", "18:00"],
      ["Capacidad total", "5"],
      ["Descripción", "Muestra de arte local."],
    ])
      await d.getByLabel(label, { exact: true }).fill(v);
    await d.getByLabel("Estado", { exact: true }).selectOption("ACTIVO");
    await d.getByRole("button", { name: "Guardar" }).click();
    await p.getByText("Festival browser", { exact: true }).waitFor();
    await destino(p, "/panel/tipos", "Tipos de entrada");
    await p.getByRole("button", { name: "Crear tipo de entrada" }).click();
    d = p.getByRole("dialog");
    await d.getByLabel("Evento", { exact: true }).selectOption({ label: "Festival browser" });
    await d.getByLabel("Nombre de la localidad").fill("General browser");
    await d.getByLabel("Precio (COP)").fill("20.25");
    await d.getByLabel("Capacidad asignada").fill("6");
    await d.getByRole("button", { name: "Guardar" }).click();
    await d.getByRole("alert").waitFor();
    await d.getByLabel("Capacidad asignada").fill("5");
    await d.getByRole("button", { name: "Guardar" }).click();
    await p.getByText("General browser", { exact: true }).waitFor();
    await ancho(p);
    await destino(p, "/panel/compras", "Compras");
    await ver(p, "link", "Registrar compra");
    await destino(p, "/panel/entradas", "Entradas");
  } finally {
    await context.close();
  }
});
test("Organizador: rutas propias, validación y segundo intento visible", async () => {
  const { p, context } = await pagina();
  const {
    entrada: [i],
  } = await fx.llamar("ana", "CrearCompra", pedido(primera.t));
  try {
    await p.goto(fx.url + "/login");
    await login(p, "org");
    await destino(p, "/panel/eventos", "Mis eventos");
    await destino(p, "/panel/tipos", "Tipos de entrada");
    await destino(p, "/panel/compras", "Compras");
    await destino(p, "/panel/entradas", "Entradas");
    await destino(p, "/panel/usuarios", "Acceso restringido");
    await destino(p, "/panel/validar", "Validar entrada");
    async function escanear() {
      await p.getByLabel("Código de entrada").fill(i.codigo);
      await p.getByRole("button", { name: "Validar código" }).click();
    }
    await escanear();
    await p.getByText("Acceso registrado").waitFor();
    await escanear();
    await p.getByRole("alert").waitFor();
  } finally {
    await context.close();
  }
});
test("Escritorio, tablet y móvil sin desbordamientos en catálogo, compra y panel", async () => {
  const { p, context } = await pagina();
  try {
    await p.goto(fx.url + "/login");
    await login(p, "admin");
    const {
      compra,
      entrada: [i],
    } = await fx.llamar("ana", "CrearCompra", pedido(primera.t));
    for (const width of [1440, 768, 390, 320]) {
      await p.setViewportSize({ width, height: 870 });
      for (const ruta of [
        "/",
        "/eventos",
        "/eventos/" + primera.e.id,
        "/panel",
        "/panel/usuarios",
        "/panel/eventos",
        "/panel/tipos",
        "/panel/compras",
        "/panel/entradas",
        "/panel/validar",
        "/compras/" + compra.id,
        "/entradas/" + i.id,
        "/fuera-de-ruta",
      ]) {
        await p.goto(fx.url + ruta);
        await p.locator("main h1").waitFor();
        await p.locator(".esqueleto").first().waitFor({ state: "hidden" });
        await ancho(p);
      }
      if (width < 768) {
        await p.getByRole("button", { name: "Abrir menú" }).click();
        await ver(p, "link", "Mi panel");
        await p.getByRole("button", { name: "Cerrar menú" }).click();
      }
    }
  } finally {
    await context.close();
  }
});

test("Administrador: venta de mostrador, reemisión, cambio de responsable y cancelación", async () => {
  const { p, context } = await pagina(),
    { e, t } = await oferta(fx, 5);
  try {
    await p.goto(fx.url + "/login");
    await login(p, "admin");
    await p.goto(fx.url + "/eventos/" + e.id);
    await p.getByLabel("Cliente", { exact: false }).selectOption(String(fx.cuentas.luis.id));
    await p.getByLabel("Cantidad", { exact: true }).fill("2");
    await p.getByRole("button", { name: "Revisar compra" }).click();
    await p.getByRole("button", { name: "Confirmar compra" }).click();
    await p.getByText("Compra confirmada", { exact: true }).waitFor();
    const id = p.url().split("/").at(-1);
    const detalle = await fx.llamar("admin", "ObtenerCompra", { id });
    const filtro = (texto) => p.getByRole("searchbox").fill(texto);
    const confirmar = () =>
      p.getByRole("dialog").getByRole("button", { name: "Confirmar", exact: true }).click();
    await destino(p, "/panel/entradas", "Entradas");
    await filtro(detalle.entrada[0].codigo);
    await p.getByRole("button", { name: "Reemitir entrada", exact: true }).click();
    await confirmar();
    await p.getByText("Reemplazada", { exact: true }).waitFor();
    const nueva = (await fx.llamar("admin", "ObtenerCompra", { id })).entrada.find(
      (i) => i.estado === "EMITIDA" && i.id !== detalle.entrada[1].id,
    );
    await filtro(nueva.codigo);
    await p.getByRole("button", { name: "Cancelar entrada", exact: true }).click();
    await confirmar();
    await p.getByText("Cancelada", { exact: true }).waitFor();
    await destino(p, "/panel/compras", "Compras");
    await filtro(detalle.compra.codigo);
    await p.getByRole("button", { name: "Cambiar responsable", exact: true }).click();
    await p.getByRole("dialog").getByRole("combobox").selectOption(String(fx.cuentas.org.id));
    await confirmar();
    await p.getByRole("dialog").waitFor({ state: "hidden" });
    assert.equal(
      (await fx.llamar("admin", "ObtenerCompra", { id })).compra.usuario_responsable_id,
      fx.cuentas.org.id,
    );
    await p.getByRole("button", { name: "Cancelar compra", exact: true }).click();
    await confirmar();
    await p.getByText("Cancelada", { exact: true }).waitFor();
    assert.equal(
      (await fx.llamar("admin", "ObtenerTipoEntrada", { id: t.id, gestion: true })).tipo
        .cantidad_disponible,
      5,
    );
  } finally {
    await context.close();
  }
});

test("Registro móvil desde la compra: validación, envío único, confirmación e inicio de sesión con retorno", async () => {
  const { p, context } = await pagina({ width: 390, height: 844 });
  const password = fx.cuentas.ana.password;
  let envios = 0, cuerpoRegistro = "", liberar;
  const espera = new Promise((resolve) => { liberar = resolve; });
  try {
    await p.goto(fx.url + "/eventos/" + primera.e.id);
    await p.getByLabel("Cantidad", { exact: true }).fill("2");
    await p.getByRole("button", { name: "Iniciar sesión para comprar" }).click();
    const registrarse = p.getByRole("link", { name: "Registrarse", exact: true });
    await registrarse.click();
    await p.getByRole("link", { name: "Volver al inicio de sesión" }).click();
    await registrarse.click();
    await ver(p, "heading", "Registrarse");
    for (const width of [320, 768, 1440, 390]) {
      await p.setViewportSize({ width, height: 844 });
      await ancho(p);
    }
    assert.equal(await p.locator("form [name=rol], form [name=estado], form select").count(), 0);
    const crear = p.getByRole("button", { name: "Crear cuenta", exact: true });
    await crear.click();
    assert.equal(await p.locator("form :invalid").count(), 5);
    await p.getByLabel("Identificación", { exact: true }).fill("WEB-REGISTRO");
    await p.getByLabel("Nombre completo").fill("Cliente móvil");
    await p.getByLabel("Nombre de usuario").fill("Movil.Registro");
    await p.getByLabel("Contraseña", { exact: true }).fill(password);
    await p.getByLabel("Confirmar contraseña").fill("distinta");
    await crear.click();
    await p.getByRole("alert").getByText("Las contraseñas no coinciden.").waitFor();
    await p.getByLabel("Contraseña", { exact: true }).fill("é".repeat(37));
    await p.getByLabel("Confirmar contraseña").fill("é".repeat(37));
    await crear.click();
    await p.getByRole("alert").getByText("Usa una contraseña de al menos 10 caracteres y máximo 72 bytes.").waitFor();
    await p.getByLabel("Contraseña", { exact: true }).fill(password);
    await p.getByLabel("Confirmar contraseña").fill(password);
    await p.getByLabel("Nombre de usuario").fill(fx.cuentas.ana.usuario);
    await crear.click();
    await p.getByRole("alert").getByText("La identificación o el nombre de usuario ya está registrado.").waitFor();
    await p.getByLabel("Nombre de usuario").fill("Movil.Registro");
    await p.route("**/soap", async (route) => {
      if (route.request().headers().soapaction?.includes("RegistrarUsuario")) {
        envios++;
        cuerpoRegistro = route.request().postData();
        await espera;
      }
      await route.continue();
    });
    await crear.click();
    const cargando = p.getByRole("button", { name: "Creando cuenta…" });
    await cargando.waitFor();
    assert.ok(await cargando.isDisabled());
    await p.locator("form").evaluate((form) => form.requestSubmit());
    liberar();
    await p.getByRole("status").getByText("Cuenta creada. Ya puedes iniciar sesión.").waitFor();
    assert.equal(envios, 1);
    assert.equal(/<(?:e:|s:)(?:rol|estado|confirmacion|Autenticacion|Header)\b/.test(cuerpoRegistro), false);
    assert.equal(await p.getByLabel("Usuario", { exact: true }).inputValue(), "movil.registro");
    await p.getByLabel("Contraseña", { exact: true }).fill(password);
    await p.getByRole("button", { name: "Ingresar", exact: true }).click();
    await p.waitForURL((u) => u.pathname === "/eventos/" + primera.e.id);
    assert.equal(await p.getByLabel("Cantidad", { exact: true }).inputValue(), "2");
    await ancho(p);
  } finally {
    liberar();
    await context.close();
  }
});
