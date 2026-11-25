const NS = "urn:eventpass";
const SOAP = "http://schemas.xmlsoap.org/soap/envelope/";
export const SESSION_KEY = "eventpass.sesion";
const repeated = {
  ListarUsuarios: "usuario",
  ListarEventos: "evento",
  ListarTiposEntrada: "tipo",
  ListarCompras: "compra",
  ListarEntradas: "entrada",
  CrearCompra: "entrada",
  ObtenerCompra: "entrada",
};
const xmlEscape = (value) =>
  String(value).replace(
    /[&<>"']/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;" })[c],
  );
export function sesionGuardada() {
  try {
    const s = JSON.parse(sessionStorage.getItem(SESSION_KEY));
    return s?.usuario && s?.token && Date.parse(s.expira_en) > Date.now() ? s : null;
  } catch {
    return null;
  }
}
function leer(nodo) {
  if (!nodo.children.length) return nodo.textContent;
  return Object.fromEntries(Array.from(nodo.children, (h) => [h.localName, leer(h)]));
}
export async function soapRequest(operacion, args = {}, opciones = {}) {
  const accesoPublico = operacion === "IniciarSesion" || operacion === "RegistrarUsuario";
  const token = accesoPublico ? null : sesionGuardada()?.token;
  const tag = (k, v) => `<e:${k}>${xmlEscape(v)}</e:${k}>`;
  const campos = Object.entries(args)
    .filter(([, v]) => v !== undefined && v !== null)
    // Un control HTML de hora puede omitir los segundos obligatorios de xsd:time.
    .map(([k, v]) => tag(k, k === "hora" && /^\d{2}:\d{2}$/.test(v) ? v + ":00" : v))
    .join("");
  const cabecera = token
    ? `<s:Header><e:Autenticacion>${tag("token", token)}</e:Autenticacion></s:Header>`
    : "";
  const body = `<s:Envelope xmlns:s="${SOAP}" xmlns:e="${NS}">${cabecera}<s:Body><e:${operacion}>${campos}</e:${operacion}></s:Body></s:Envelope>`;
  let response;
  try {
    response = await fetch("/soap", {
      method: "POST",
      headers: { "Content-Type": "text/xml; charset=utf-8", SOAPAction: `"${NS}#${operacion}"` },
      body,
      signal: opciones.signal,
    });
  } catch (error) {
    if (error.name === "AbortError") throw error;
    throw new Error("No se pudo contactar con EventPass. Comprueba la conexión y vuelve a intentar.");
  }
  const xml = new DOMParser().parseFromString(await response.text(), "application/xml");
  const soapBody = xml.getElementsByTagNameNS(SOAP, "Body")[0];
  const child = soapBody?.firstElementChild;
  if (child?.localName === "Fault") {
    const code = child.getElementsByTagNameNS("*", "codigo")[0]?.textContent;
    if (code === "SESION" && token && sesionGuardada()?.token === token)
      window.dispatchEvent(new Event("eventpass:sesion-terminada"));
    throw Object.assign(
      new Error(
        child.getElementsByTagNameNS("*", "faultstring")[0]?.textContent ||
          "El servicio rechazó la operación.",
      ),
      { code },
    );
  }
  if (!response.ok || child?.namespaceURI !== NS || child.localName !== operacion + "Response")
    throw new Error("El servicio SOAP no está disponible o devolvió una respuesta inválida.");
  const lista = repeated[operacion];
  const result = lista ? { [lista]: [] } : {};
  for (const campo of child.children) {
    if (campo.localName === lista) result[lista].push(leer(campo));
    else result[campo.localName] = leer(campo);
  }
  return result;
}
