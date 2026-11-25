import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { soapRequest, sesionGuardada, SESSION_KEY } from "../services/soapApi";
const AuthContext = createContext(null);
export function AuthProvider({ children }) {
  const [sesion, setSesion] = useState(sesionGuardada);
  const cerrarSesion = useCallback(() => {
    sessionStorage.removeItem(SESSION_KEY);
    setSesion(null);
  }, []);
  useEffect(() => {
    window.addEventListener("eventpass:sesion-terminada", cerrarSesion);
    const timer = sesion
      ? setTimeout(cerrarSesion, Math.max(0, Date.parse(sesion.expira_en) - Date.now()))
      : null;
    return () => {
      window.removeEventListener("eventpass:sesion-terminada", cerrarSesion);
      clearTimeout(timer);
    };
  }, [sesion, cerrarSesion]);
  async function iniciarSesion(usuario, password) {
    const nueva = await soapRequest("IniciarSesion", { usuario: usuario.trim(), password });
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(nueva));
    setSesion(nueva);
    return nueva.usuario;
  }
  return (
    <AuthContext.Provider value={{ usuario: sesion?.usuario, iniciarSesion, cerrarSesion }}>
      {children}
    </AuthContext.Provider>
  );
}
export const useAuth = () => useContext(AuthContext);
