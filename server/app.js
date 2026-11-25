import express from "express";
import soap from "soap";
import { readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { servicios } from "./servicio.js";
import { leerSolicitudes, revisarSobre, falloXML } from "./xml.js";

export async function crearApp(pool, secreto, endpoint) {
  if (!secreto || Buffer.byteLength(secreto) < 32)
    throw new Error("JWT_SECRET debe tener al menos 32 bytes.");
  const direccion = new URL(endpoint);
  if (
    !["https:", "http:"].includes(direccion.protocol) ||
    direccion.pathname !== "/soap" ||
    direccion.search ||
    direccion.hash ||
    direccion.username ||
    direccion.password
  )
    throw new Error("SOAP_PUBLIC_URL debe apuntar a /soap con http o https.");
  const archivo = await readFile(new URL("./eventpass.wsdl", import.meta.url), "utf8");
  const xml = archivo.replace('location="http://localhost:4000/soap"', `location="${direccion.href}"`);
  const services = servicios(pool, secreto);
  const contratos = leerSolicitudes(xml, Object.keys(services.EventPassService.EventPassPort));
  const app = express();
  app.disable("x-powered-by");
  app.use("/soap", (req, res, next) => {
    res.set("Cache-Control", "no-store");
    next();
  });
  app.post("/soap", express.text({ type: () => true, limit: "128kb" }), (req, res, next) => {
    try {
      revisarSobre(req.body, req.get("SOAPAction"), contratos);
      next();
    } catch {
      falloXML(res);
    }
  });
  app.use("/soap", (err, req, res, next) => falloXML(res, err.status === 413 ? 413 : 500));
  await new Promise((resolve, reject) =>
    soap.listen(app, {
      path: "/soap",
      services,
      xml,
      envelopeKey: "soap",
      suppressStack: true,
      returnFault: true,
      customDeserializer: { int: (s) => s, decimal: (s) => s, date: (s) => s },
      callback: (error, service) => {
        if (error) return reject(error);
        // Conserva los espacios significativos de xsd:string, incluidos los de una contraseña.
        service.wsdl.options.preserveWhitespace = true;
        resolve();
      },
    }),
  );
  const dist = fileURLToPath(new URL("../dist/", import.meta.url));
  if (existsSync(dist + "index.html")) {
    app.use(express.static(dist));
    app.get("/{*ruta}", (req, res) => res.sendFile(dist + "index.html"));
  }
  return app;
}
