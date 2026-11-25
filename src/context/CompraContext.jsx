import { createContext, useContext, useRef } from "react";
import { soapRequest } from "../services/soapApi";
const CompraContext = createContext(null);
function nuevaSolicitud() {
  if (crypto.randomUUID) return crypto.randomUUID();
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  bytes[6] = (bytes[6] & 15) | 64;
  bytes[8] = (bytes[8] & 63) | 128;
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
  return [hex.slice(0, 8), hex.slice(8, 12), hex.slice(12, 16), hex.slice(16, 20), hex.slice(20)].join(
    "-",
  );
}
export default function CompraProvider({ children }) {
  const enCurso = useRef(new Map());
  async function comprar(actor, cliente, tipo, cantidad) {
    const key = ["eventpass.pedido", actor, cliente, tipo.id, cantidad, tipo.precio].join("/");
    if (enCurso.current.has(key)) return enCurso.current.get(key);
    const solicitud = sessionStorage.getItem(key) || nuevaSolicitud();
    sessionStorage.setItem(key, solicitud);
    const operacion = soapRequest("CrearCompra", {
      cliente_id: cliente,
      tipo_entrada_id: tipo.id,
      cantidad,
      solicitud_id: solicitud,
      precio_esperado: tipo.precio,
    });
    enCurso.current.set(key, operacion);
    try {
      const resultado = await operacion;
      sessionStorage.removeItem(key);
      return resultado;
    } finally {
      enCurso.current.delete(key);
    }
  }
  return <CompraContext.Provider value={comprar}>{children}</CompraContext.Provider>;
}
export const useCompra = () => useContext(CompraContext);
