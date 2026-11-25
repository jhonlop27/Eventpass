import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { CalendarDays, MapPin, Users } from "lucide-react";
import { useConsulta } from "../services/useConsulta";
import Accordion from "../components/Accordion";
import { calendario, pesos } from "../data/presentacion";
import { Aviso, Carga } from "../components/Estados";
import { Cartel } from "../components/EventoDestacado";
import Comprar from "../components/Comprar";
export default function EventoDetalle() {
  const [errorCompra, setErrorCompra] = useState("");
  const { id } = useParams();
  const q = useConsulta("ObtenerEvento", { id }),
    tipos = useConsulta("ListarTiposEntrada", { evento_id: id });
  const e = q.data?.evento;
  return (
    <section className="pagina">
      <Link className="miga" to="/eventos">
        Volver al catálogo
      </Link>
      <Carga consulta={q}>
        {e && (
          <>
            <Aviso>{errorCompra}</Aviso>
            <div className="kicker con-raya">{e.categoria}</div>
            <h1>{e.nombre}</h1>
            <div className="detalle-grid">
              <div>
                <div className="imagen-evento">
                  <Cartel categoria={e.categoria} />
                </div>
                <div className="datos-evento">
                  <span>
                    <CalendarDays />
                    {calendario(e.fecha)} · {e.hora.slice(0, 5)}
                  </span>
                  <span>
                    <MapPin />
                    {e.ubicacion}
                  </span>
                  <span>
                    <Users />
                    {e.organizador_nombre}
                  </span>
                </div>
                <h2>Sobre el evento</h2>
                <p>{e.descripcion}</p>
                {tipos.data && (
                  <Accordion
                    items={[
                      {
                        pregunta: "Localidades y disponibilidad",
                        respuesta: tipos.data.tipo.length ? (
                          <ul className="localidades">
                            {tipos.data.tipo.map((t) => (
                              <li key={t.id}>
                                <span>
                                  {t.nombre} · {pesos(t.precio)}
                                </span>
                                <strong>{t.cantidad_disponible} disponibles</strong>
                              </li>
                            ))}
                          </ul>
                        ) : (
                          <p>El evento aún no tiene localidades a la venta.</p>
                        ),
                      },
                    ]}
                  />
                )}
              </div>
              <Carga consulta={tipos}>
                {tipos.data && (
                  <Comprar
                    evento={e}
                    tipos={tipos.data.tipo}
                    recargar={(mensaje) => {
                      setErrorCompra(mensaje);
                      tipos.recargar();
                      q.recargar();
                    }}
                  />
                )}
              </Carga>
            </div>
          </>
        )}
      </Carga>
    </section>
  );
}
