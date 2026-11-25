# Servicio SOAP de EventPass

El proceso Express monta node-soap en `/soap`. React envía sobres XML de estilo document/literal al mismo origen. Vite reenvía este endpoint al backend durante el desarrollo. Express sirve el build en producción.

## Instalación y arranque

Ejecuta los comandos desde la raíz, donde está el único `package.json`. Instala PostgreSQL 14 o posterior e inicia el servicio. Usa tu base existente o, en una instalación nueva, crea `eventpass` con pgAdmin o `createdb -U postgres eventpass`.

```sh
npm ci
npm run config:local
```

Configura `DATABASE_URL` en `server/.env` y ejecuta lo siguiente.

```sh
npm run db:init
npm run seed:admin
npm run server
```

El inicializador aplica `server/schema.sql` dentro de una transacción y después `server/configurar-search-path.sql` para el rol conectado en esa base. En pgAdmin se pueden ejecutar esos dos archivos en el mismo orden. Para una base ya inicializada basta con ejecutar el segundo si solo necesitas resolver tablas por nombre. Las tablas residen en el esquema PostgreSQL `eventpass`. La carga opcional `npm run seed:demo` crea un cliente, un organizador y eventos con dos localidades cada uno. [Verificación desde pgAdmin](../README.md#consultar-desde-pgadmin)

## Configuración

| Variable | Uso |
|---|---|
| `DATABASE_URL` | URI de la base de EventPass. Para inicializar, el rol debe poder crear el esquema y sus objetos. |
| `PORT` | Puerto de Express. Valor predeterminado 4000. El proxy de Vite lee este valor al iniciar. |
| `SOAP_PUBLIC_URL` | Dirección absoluta anunciada por el WSDL. Por defecto `http://localhost:<PORT>/soap`. |
| `JWT_SECRET` | Secreto de firma de al menos 32 bytes. El configurador genera 48 bytes aleatorios y los representa en hexadecimal. |
| `ADMIN_IDENTIFICACION`, `ADMIN_NAME`, `ADMIN_USER`, `ADMIN_PASSWORD` | Identidad y credenciales para crear el administrador. El seed comprueba una cuenta preexistente antes de finalizar. |
| `TEST_DATABASE_URL` | Conexión de mantenimiento para las suites. El rol necesita `CREATEDB`. |
| `BROWSER_EXECUTABLE` | Ruta opcional a Chromium para la suite de interfaz. |

Se puede usar la plantilla `.env.example` con variables inyectadas por el entorno. Mantén `.env` fuera del control de versiones. El servidor lee las variables respecto a la ubicación de sus archivos.

## Contrato

| Dato | Valor por defecto |
|---|---|
| Endpoint HTTP POST | `http://localhost:4000/soap` |
| Consulta del WSDL | `http://localhost:4000/soap?wsdl` |
| Namespace del servicio | `urn:eventpass` |
| Servicio y puerto | `EventPassService` / `EventPassPort` |
| Encabezados HTTP | `Content-Type: text/xml; charset=utf-8` y `SOAPAction: "urn:eventpass#NombreOperacion"` |
| Autenticación | `Autenticacion/token` en la cabecera SOAP de las peticiones protegidas |
| Colecciones | Elementos XML repetidos `usuario`, `evento`, `tipo`, `compra` o `entrada`. Una lista vacía contiene cero elementos. |

`IniciarSesion` recibe `usuario` y `password` y devuelve el perfil público, el token y `expira_en`. La firma usa HS256 con emisor y audiencia definidos. El JWT dura ocho horas. Cada operación autenticada consulta el estado, el rol y la versión de sesión en PostgreSQL. Cambiar contraseña, usuario, rol o estado invalida los tokens anteriores. Las contraseñas se protegen con bcrypt, con coste 12 y comprobación del límite de 72 bytes.

`RegistrarUsuario` recibe `identificacion`, `nombre`, `usuario` y `password`, y devuelve el perfil público en `usuario`. El alta fija el rol `CLIENTE` y el estado `ACTIVO`. El contrato tolera los campos opcionales `rol` y `estado` para que el servidor pueda descartarlos incluso cuando un cliente los envíe. Los índices únicos de identificación y usuario resuelven también altas simultáneas. Un duplicado produce un Fault `CONFLICTO`. La contraseña se confirma en React y se envía una sola vez al servicio. Para obtener un JWT se llama después a `IniciarSesion`.

### Las 28 operaciones

| Entidad | Operaciones |
|---|---|
| Acceso público | `IniciarSesion`, `RegistrarUsuario` |
| Usuarios | `CrearUsuario`, `ListarUsuarios`, `ObtenerUsuario`, `ActualizarUsuario`, `EliminarUsuario` |
| Eventos | `CrearEvento`, `ListarEventos`, `ObtenerEvento`, `ActualizarEvento`, `EliminarEvento` |
| Tipos | `CrearTipoEntrada`, `ListarTiposEntrada`, `ObtenerTipoEntrada`, `ActualizarTipoEntrada`, `EliminarTipoEntrada` |
| Compras | `CrearCompra`, `ListarCompras`, `ObtenerCompra`, `ActualizarCompra`, `EliminarCompra` |
| Entradas | `CrearEntrada`, `ListarEntradas`, `ObtenerEntrada`, `ActualizarEntrada`, `EliminarEntrada`, `ValidarEntrada` |

Las altas y ediciones de usuarios, eventos y tipos usan campos explícitos del WSDL. Una edición de usuario admite una contraseña nueva opcional. Eventos y tipos aceptan `gestion=true` en sus lecturas para aplicar el ámbito privado del gestor. En la cartelera pública se omite ese campo. Envía fechas de evento como `AAAA-MM-DD` y horas locales como `HH:mm:ss`.

`ListarTiposEntrada` acepta `evento_id`. `ListarCompras` y `ListarEntradas` aceptan `evento_id`, y la segunda acepta además `compra_id`. El servidor combina los filtros con los permisos del solicitante. Para consultar un registro individual envía su `id`.

### Solicitud pública completa

```xml
<s:Envelope xmlns:s="http://schemas.xmlsoap.org/soap/envelope/" xmlns:e="urn:eventpass">
  <s:Body><e:ListarEventos/></s:Body>
</s:Envelope>
```

### Solicitud de compra

Sustituye el token por el devuelto al iniciar sesión, el tipo por uno existente y el UUID por uno nuevo para el pedido. Reutiliza el mismo UUID al reintentar el mismo pedido.

```xml
<s:Envelope xmlns:s="http://schemas.xmlsoap.org/soap/envelope/" xmlns:e="urn:eventpass">
  <s:Header><e:Autenticacion><e:token>TOKEN_DE_SESION</e:token></e:Autenticacion></s:Header>
  <s:Body>
    <e:CrearCompra>
      <e:tipo_entrada_id>1</e:tipo_entrada_id>
      <e:cantidad>2</e:cantidad>
      <e:solicitud_id>11111111-1111-4111-8111-111111111111</e:solicitud_id>
    </e:CrearCompra>
  </s:Body>
</s:Envelope>
```

Un cliente puede omitir `cliente_id`. El servidor toma su identidad del JWT. Una venta administrativa indica un cliente activo. En ambos canales el responsable inicial es el organizador del evento. La pantalla de confirmación envía `precio_esperado` para detectar cambios de tarifa. El precio de cobro procede de la base. El resultado contiene `compra` y un elemento `entrada` por unidad. `ObtenerCompra` devuelve el comprobante con su historial de códigos.

### Operaciones administrativas sobre las ventas

| Operación | Entrada y efecto |
|---|---|
| `ActualizarCompra` | `id` y `usuario_responsable_id` para cambiar el responsable, o `id` y `estado=CANCELADA` para cancelar. |
| `EliminarCompra` | Cancela por `id`. Conserva el comprobante. |
| `CrearEntrada` | Reemite una entrada vigente mediante `entrada_origen_id`. La anterior queda `REEMPLAZADA`. |
| `ActualizarEntrada` | `id` y `estado=UTILIZADA` registran el ingreso. `estado=CANCELADA` anula la unidad. |
| `EliminarEntrada` | Cancela por `id`. La devolución de cupo depende de la transición efectiva. |
| `ValidarEntrada` | Recibe el `codigo` del pase y devuelve la entrada ya utilizada. |

### SOAP Faults

Un fallo de negocio produce un sobre SOAP 1.1 con HTTP 500, `faultcode`, `faultstring` y `detail/ErrorEventPass/codigo`. Un cuerpo que excede el límite de 128 KiB recibe HTTP 413 y un Fault XML. El cliente presenta el mensaje de negocio. Los detalles internos de SQL, la traza y los hashes quedan fuera del contrato público.

| Códigos frecuentes | Significado |
|---|---|
| `CREDENCIALES`, `SESION`, `PERMISO` | Acceso rechazado, sesión requerida o rol insuficiente. |
| `NO_ENCONTRADO` | Registro inexistente o fuera del ámbito de lectura. |
| `DATOS`, `XML`, `CONFLICTO` | Formato, restricción de integridad, duplicado o relación existente. |
| `INVENTARIO`, `AFORO`, `PRECIO`, `CERRADO` | Venta rechazada por cupos, precio actualizado o cierre. |
| `ENTRADA_INVALIDA`, `UTILIZADA` | Estado incompatible con la operación de admisión o cancelación. |
| `REINTENTAR`, `INTERNO` | Conflicto transitorio o error interno con reversión. |
