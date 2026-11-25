import { useEffect } from "react";
import { Route, Routes, useLocation } from "react-router-dom";
import Header from "./components/Header";
import Footer from "./components/Footer";
import RutaProtegida from "./components/RutaProtegida";
import Inicio from "./pages/Inicio";
import Eventos from "./pages/Eventos";
import EventoDetalle from "./pages/EventoDetalle";
import Login from "./pages/Login";
import Registro from "./pages/Registro";
import NoEncontrado from "./pages/NoEncontrado";
import { Panel, Dashboard } from "./pages/Panel";
import UsuariosAdmin from "./pages/UsuariosAdmin";
import EventosAdmin from "./pages/EventosAdmin";
import TiposAdmin from "./pages/TiposAdmin";
import Validar from "./pages/Validar";
import { Movimientos, DetalleCompra, DetalleEntrada } from "./pages/Movimientos";
import { ROLES, GESTORES } from "./data/presentacion";

const protegido = (vista, roles = ROLES) => (
  <RutaProtegida rolesPermitidos={roles}>{vista}</RutaProtegida>
);
export default function App() {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);
  return (
    <>
      <Header />
      <main className="wrap" id="contenido">
        <Routes>
          <Route path="/" element={<Inicio />} />
          <Route path="/eventos" element={<Eventos />} />
          <Route path="/eventos/:id" element={<EventoDetalle key={pathname} />} />
          <Route path="/login" element={<Login />} />
          <Route path="/registro" element={<Registro />} />
          <Route path="/compras/:id" element={protegido(<DetalleCompra />)} />
          <Route path="/entradas/:id" element={protegido(<DetalleEntrada />)} />
          <Route path="/panel" element={protegido(<Panel />)}>
            <Route index element={<Dashboard />} />
            <Route path="usuarios" element={protegido(<UsuariosAdmin />, ["ADMINISTRADOR"])} />
            <Route path="eventos" element={protegido(<EventosAdmin />, GESTORES)} />
            <Route path="tipos" element={protegido(<TiposAdmin />, GESTORES)} />
            <Route path="compras" element={<Movimientos key="compras" />} />
            <Route path="entradas" element={<Movimientos key="entradas" entradas />} />
            <Route path="validar" element={protegido(<Validar />, GESTORES)} />
          </Route>
          <Route path="*" element={<NoEncontrado />} />
        </Routes>
      </main>
      <Footer />
    </>
  );
}
