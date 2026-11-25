import { useEffect, useState } from "react";
import { soapRequest } from "./soapApi";
import { useAuth } from "../context/AuthContext";
export function useConsulta(operacion, campos = {}, habilitada = true) {
  const { usuario } = useAuth();
  const [revision, setRevision] = useState(0);
  const [resultado, setResultado] = useState(null);
  const args = JSON.stringify(campos);
  const key = JSON.stringify([operacion, args, habilitada, usuario?.id, revision]);
  useEffect(() => {
    if (!habilitada) return;
    const controller = new AbortController();
    soapRequest(operacion, JSON.parse(args), { signal: controller.signal })
      .then((data) => {
        if (!controller.signal.aborted) setResultado({ key, data });
      })
      .catch((error) => {
        if (!controller.signal.aborted) setResultado({ key, error: error.message });
      });
    return () => controller.abort();
  }, [key, operacion, args, habilitada]);
  return {
    ...(resultado?.key === key ? resultado : {}),
    cargando: habilitada && resultado?.key !== key,
    recargar: () => setRevision((n) => n + 1),
  };
}
