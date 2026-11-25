import { Vacio } from "./Estados";
export default function Tabla({ filas, columnas, acciones, vacio = "Aún no hay registros." }) {
  if (!filas.length) return <Vacio texto={vacio} />;
  return (
    <table className="tabla">
      <thead>
        <tr>
          {columnas.map((c) => (
            <th key={c.titulo} scope="col">
              {c.titulo}
            </th>
          ))}
          {acciones && <th scope="col">Acciones</th>}
        </tr>
      </thead>
      <tbody>
        {filas.map((f) => (
          <tr key={f.id}>
            {columnas.map((c) => (
              <td key={c.titulo} data-label={c.titulo}>
                {c.ver ? c.ver(f) : f[c.campo]}
              </td>
            ))}
            {acciones && (
              <td className="acciones-fila" data-label="Acciones">
                {acciones(f)}
              </td>
            )}
          </tr>
        ))}
      </tbody>
    </table>
  );
}
