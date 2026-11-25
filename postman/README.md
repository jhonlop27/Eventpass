# EventPass · Administración de Eventos

La colección prueba el CRUD de eventos contra el servicio SOAP de EventPass. Crea un evento con un código único, trabaja con el ID que devuelve PostgreSQL y elimina ese evento al terminar. El recorrido incluye las pruebas de permisos mientras el evento todavía existe.

## Importación y conexión

1. Inicia EventPass con `npm run server` o `npm start` desde la raíz del proyecto. Comprueba que el navegador abre el WSDL en `http://localhost:4000/soap?wsdl`.
2. En Postman de escritorio, selecciona **Import**, abre `EventPass-Administracion-Eventos.postman_collection.json` y selecciona la colección **EventPass - Administración de Eventos**.
3. Abre **Variables** en la colección. Introduce las credenciales como valores locales. Puedes usar un entorno privado para las cuatro variables de credenciales. Deja al ámbito de la colección las variables de sesión y evento para que los scripts puedan actualizarlas.
4. Usa un administrador activo de tu instalación. Para una instalación nueva son `ADMIN_USER` y la clave creada por `npm run config:local` al ejecutar `npm run seed:admin`. Para el rol cliente, registra una cuenta desde **Iniciar sesión → Registrarse** o utiliza un cliente activo existente.
5. Selecciona **Run collection**, conserva todas las peticiones en el orden mostrado, elige una iteración y pulsa **Run**. Para ejecutarlas manualmente, pulsa **Send** en el mismo orden. Consulta **Test Results** en cada respuesta.

| Variable | Valor o procedencia |
|---|---|
| `baseUrl` | `http://localhost:4000` por defecto, sin barra final. Ajusta el puerto si tu backend usa otro. |
| `adminUsuario`, `adminPassword` | Credenciales del administrador de EventPass. |
| `clienteUsuario`, `clientePassword` | Credenciales de una cuenta activa con rol CLIENTE. |
| `token`, `clienteToken` | Las peticiones 01 y P0 guardan el JWT de cada rol después de verificar la respuesta. |
| `eventoId` | ID devuelto por 02 y reutilizado en lecturas, edición y baja. |
| `eventoCodigo`, `eventoFecha` | Se generan en 02. El código comienza por PM- y el evento se programa 30 días en el futuro. |

Conserva las contraseñas y los JWT como valores locales al compartir o exportar la colección. El JSON distribuido lleva esos valores vacíos.

## Orden y resultados

| Petición | Operación | Resultado comprobado |
|---|---|---|
| 01 · Iniciar sesión como administrador | `IniciarSesion` | Perfil ADMINISTRADOR activo y JWT guardado en `token`. |
| 02 · Crear evento | `CrearEvento` | Evento ACTIVO con el código generado y un ID positivo. |
| 03 · Listar eventos | `ListarEventos` | El listado administrativo incluye ese ID y código. |
| 04 · Obtener evento | `ObtenerEvento` | Identidad, nombre inicial y capacidad de 40 personas. |
| 05 · Actualizar evento | `ActualizarEvento` | Cambio de nombre, auditorio y capacidad a 60 personas. |
| P0 · Iniciar sesión como cliente | `IniciarSesion` | Perfil CLIENTE y JWT guardado en `clienteToken`. |
| P1 · Crear sin autenticación | `CrearEvento` | SOAP Fault `SESION`. |
| P2 · Actualizar como cliente | `ActualizarEvento` | SOAP Fault `PERMISO`. |
| P3 · Eliminar como cliente | `EliminarEvento` | SOAP Fault `PERMISO`. |
| P4 · Consultar con JWT inválido | `ObtenerEvento` | SOAP Fault `SESION`. |
| 05b · Verificar la actualización guardada | `ObtenerEvento` | El evento sigue presente con los datos de 05 después de las denegaciones. |
| 06 · Eliminar evento | `EliminarEvento` | El servidor devuelve el ID eliminado. |
| 06b · Comprobar la baja | `ObtenerEvento` | SOAP Fault `NO_ENCONTRADO` para el ID eliminado. |

Cada petición envía `POST {{baseUrl}}/soap`, con `Content-Type: text/xml; charset=utf-8` y el `SOAPAction` de su operación. Los dos inicios de sesión y P1 llevan el encabezado de autenticación omitido. Las demás operaciones autenticadas llevan el JWT en `Autenticacion/token`. Las respuestas válidas de negocio usan HTTP 200. Los rechazos comprobados por la colección usan HTTP 500 con un Fault SOAP 1.1 y el código de EventPass en `detail/ErrorEventPass/codigo`.

Las lecturas del administrador incluyen `gestion=true` para consultar todos los estados. Si deseas consultar la cartelera pública, omite ese campo en `ListarEventos`. El alta usa al administrador autenticado como organizador por defecto. El evento de prueba carece de localidades y ventas. Una baja con localidades asociadas devuelve `CONFLICTO` por integridad referencial.
