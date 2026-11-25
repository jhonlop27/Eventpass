import sax from "sax";

const SOAP = "http://schemas.xmlsoap.org/soap/envelope/";
const EP = "urn:eventpass";
const XSD = "http://www.w3.org/2001/XMLSchema";

// El preprocesamiento usa los campos del WSDL publicado. node-soap conserva el despacho y la serialización.
export function leerSolicitudes(wsdl, operaciones) {
  const contratos = new Map();
  const parser = sax.parser(true, { xmlns: true });
  let profundidad = 0,
    nivel = 0,
    actual;
  parser.onopentag = (nodo) => {
    profundidad++;
    if (nodo.uri !== XSD || nodo.local !== "element") return;
    const nombre = nodo.attributes.name?.value;
    if (operaciones.includes(nombre) && !actual) {
      actual = new Map();
      nivel = profundidad;
      contratos.set(nombre, actual);
    } else if (actual) {
      actual.set(nombre, {
        tipo: nodo.attributes.type.value.split(":").pop(),
        requerido: nodo.attributes.minOccurs?.value !== "0",
      });
    }
  };
  parser.onclosetag = () => {
    if (profundidad === nivel) actual = null;
    profundidad--;
  };
  parser.write(wsdl).close();
  return contratos;
}
export function revisarSobre(xml, accion, contratos) {
  const parser = sax.parser(true, { xmlns: true, position: false });
  const pila = [],
    vistos = new Set(),
    secciones = new Set();
  let operacion,
    campos,
    cabecera = false,
    token = false,
    contenido = "";
  function comprobar(ok) {
    if (!ok) throw new Error("XML");
  }
  parser.ondoctype = () => comprobar(false);
  parser.onopentag = (nodo) => {
    const nivel = pila.length,
      padre = pila.at(-1);
    const n = nodo.local;
    if (!nivel) comprobar(n === "Envelope" && nodo.uri === SOAP);
    else if (nivel === 1) {
      comprobar(
        nodo.uri === SOAP &&
          ["Header", "Body"].includes(n) &&
          !secciones.has(n) &&
          !secciones.has("Body"),
      );
      secciones.add(n);
    } else {
      comprobar(nodo.uri === EP);
      if (nivel === 2 && padre === "Body") {
        comprobar(!operacion && contratos.has(n));
        operacion = n;
        campos = contratos.get(n);
      } else if (nivel === 2 && padre === "Header") {
        comprobar(n === "Autenticacion" && !cabecera);
        cabecera = true;
      } else if (nivel === 3 && padre === "Autenticacion") {
        comprobar(n === "token" && !token);
        token = true;
      } else {
        comprobar(nivel === 3 && padre === operacion && campos.has(n) && !vistos.has(n));
        vistos.add(n);
      }
    }
    pila.push(n);
    contenido = "";
  };
  parser.ontext = parser.oncdata = (s) => {
    if (pila.length === 4) contenido += s;
    else comprobar(!s.trim());
  };
  parser.onclosetag = () => {
    const n = pila.pop();
    if (pila.length === 3 && pila.at(-1) === operacion) {
      const t = campos.get(n).tipo;
      if (t === "int") comprobar(/^-?\d+$/.test(contenido));
      if (t === "decimal") comprobar(/^\d+(\.\d{1,2})?$/.test(contenido));
      if (t === "time") comprobar(/^([01]\d|2[0-3]):[0-5]\d:[0-5]\d$/.test(contenido));
      if (t === "boolean") comprobar(["true", "false", "1", "0"].includes(contenido));
    }
  };
  parser.write(xml).close();
  comprobar(operacion && (!cabecera || token));
  comprobar(!accion || accion.replace(/^"|"$/g, "") === EP + "#" + operacion);
  for (const [nombre, campo] of campos) comprobar(!campo.requerido || vistos.has(nombre));
}
export function falloXML(res, status = 500) {
  return res
    .status(status)
    .type("text/xml")
    .send(
      `<?xml version="1.0" encoding="UTF-8"?><soap:Envelope xmlns:soap="${SOAP}" xmlns:ep="${EP}"><soap:Body><soap:Fault><faultcode>soap:Client</faultcode><faultstring>La solicitud no cumple el contrato SOAP de EventPass.</faultstring><detail><ep:ErrorEventPass><ep:codigo>XML</ep:codigo></ep:ErrorEventPass></detail></soap:Fault></soap:Body></soap:Envelope>`,
    );
}
