# Entrega de EventPass

## Corrección del responsable de compra

El alta de compras en ambos canales guarda el organizador del evento como responsable inicial. El script opcional `server/reparar-responsables.sql` completa compras históricas con responsable nulo. La suite de integración de esta revisión aprobó 20 de 20 pruebas.

Esta actualización parte de `EventPass(3).zip`. Incorpora el registro público de clientes, una colección Postman para administrar eventos y consultas por nombre de tabla desde pgAdmin. Incluye el proyecto completo con su código fuente y la compilación de React.

## Auditoría de compatibilidad

El documento «Proyecto 5 – Servicios Web» exige React, Node.js con Express, SOAP/XML, PostgreSQL, cinco tablas, tres roles y autenticación JWT. Exige además verificar la disponibilidad y generar las entradas individuales al confirmar compras. El documento describe los requisitos de evaluación en términos funcionales y no indica puntajes por criterio.

| Cambio | Compatibilidad | Justificación | Riesgos |
|---|---|---|---|
| Registro de CLIENTE | Compatible con usuarios y autenticación. | Una operación pública independiente valida los datos, reutiliza bcrypt y crea un comprador activo. La persona obtiene el JWT al iniciar sesión. | Asignación de privilegios desde XML y altas duplicadas. El servidor fija rol y estado. Las dos restricciones únicas resuelven también solicitudes simultáneas. |
| Control administrativo de roles | Compatible con la distribución académica de permisos. | La operación administrativa existente valida JWT, rol, estado y versión en PostgreSQL. Solo ADMINISTRADOR puede cambiar roles. | Un token emitido antes del cambio, o reasignar a alguien con compras o eventos incompatibles. Se probaron ambas situaciones y la restauración del rol original. |
| Colección SOAP de Postman | Compatible con el CRUD de eventos y su evaluación. | Las peticiones reproducen el contrato WSDL y muestran alta, listado, consulta, cambio, baja y rechazos por permisos. | ID desactualizado, token de otro rol o prueba sobre un evento con ventas. La colección genera su propio evento, separa los dos tokens y relee el resultado. |
| Configuración PostgreSQL | Compatible con el modelo de cinco tablas y sus relaciones. | Se recuperó el DDL original y se configuró la búsqueda para el rol conectado en una sola base. | Resolver otra tabla homónima o afectar a otros usuarios. Se comprueban los identificadores internos de las tablas después de reconectar y se delimita el ajuste por rol y base. |

## Hallazgos del proyecto

- **Backend.** Express monta `node-soap` en `/soap`. `server/xml.js` comprueba la estructura y los campos declarados en el WSDL. `server/servicio.js` determina el acceso y abre una transacción por operación. `server/usuarios.js` ya verificaba la firma JWT, el rol, el estado y la versión de sesión en PostgreSQL. El cambio de rol ya incrementaba esa versión y protegía las relaciones con compras y eventos.
- **Frontend.** React Router organiza las páginas. `AuthContext` gestiona el inicio y cierre de sesión y `src/services/soapApi.js` codifica y lee los sobres. El registro reutiliza ese transporte, `Aviso`, los controles del login y los estilos de tarjeta, botones y cuadrícula. Se conserva el destino de compra durante el alta y el acceso.
- **PostgreSQL.** La conexión local del ZIP apuntaba a la base `eventpass` con el usuario `postgres`. El pool de Node ya fija `eventpass, pg_catalog` en cada conexión. El script de instalación usa `SET LOCAL` durante su transacción. Un Query Tool con otra conexión toma la configuración de su propio rol y base. El ajuste se verificó también con un usuario de solo lectura distinto del usuario de la aplicación.
- **SQL de origen.** El primer texto del archivo adjunto era `fecha_generacion`, en mitad de la definición de `entradas`. Al ejecutarlo, PostgreSQL devolvió el error de sintaxis `42601`. Se repusieron las 64 líneas iniciales desde el archivo anterior del mismo proyecto, `EventPass_esquema.sql`. El fragmento presente en el ZIP coincide con ese archivo hasta el final. La reparación recupera las cinco tablas, los índices, las claves y los triggers del modelo.
- **Primera instalación.** El configurador leía `server/.env.example`. El ZIP de origen incluía la configuración privada local y le faltaba la plantilla. Se añadió una plantilla sin secretos. El configurador conserva un `.env` existente y genera valores aleatorios cuando crea uno nuevo.

## Archivos de esta actualización

| Ruta modificada | Cambio y motivo |
|---|---|
| `server/usuarios.js` | Añade la función pública que selecciona cuatro campos, fija CLIENTE/ACTIVO y traduce un duplicado a un mensaje de registro. Reutiliza la validación, bcrypt y el INSERT existentes. |
| `server/servicio.js` | Despacha `RegistrarUsuario` como operación pública independiente con respuesta tipada. |
| `server/eventpass.wsdl` | Define entrada, salida, mensajes, puerto y binding SOAP de la operación 28. Incluye los dos campos opcionales que el servidor descarta si los recibe. |
| `server/schema.sql` | Recupera el inicio del DDL para poder instalar y reaplicar el esquema original. |
| `server/init-db.js` | Aplica la configuración del rol y la base después de preparar el esquema. |
| `src/App.jsx` | Expone la ruta pública `/registro`. |
| `src/pages/Login.jsx` | Enlaza el registro, presenta la confirmación del alta y precarga el usuario para iniciar sesión. |
| `src/services/soapApi.js` | Envía los registros públicos sin JWT, igual que el inicio de sesión. |
| `test/integration.test.js` | Amplía la comprobación del contrato a 28 operaciones y añade pruebas de altas, autorización, revocación, integridad y configuración de sesiones de PostgreSQL. |
| `test/browser.test.js` | Añade el recorrido de registro desde una compra, con validaciones, duplicado, doble envío, confirmación, retorno y tamaños de pantalla. |
| `README.md` | Recoge los pasos de actualización o primera instalación, las consultas en pgAdmin y el nuevo recorrido de acceso. |
| `server/README.md` | Documenta la operación pública, el contrato de 28 operaciones y el ajuste del rol de PostgreSQL. |
| `BACKEND.md` | Actualiza el origen de las cuentas en la descripción del modelo. |
| `ENTREGA.md` | Registra la auditoría, el inventario y los resultados de esta versión. |
| `dist/index.html` y `dist/assets/index-CtL9LsJ0.js` | Vite generó el nuevo punto de entrada y el JavaScript de producción para incluir la ruta de registro. Sustituye al anterior `dist/assets/index-r5MjhYee.js`. |

| Ruta nueva | Función |
|---|---|
| `src/pages/Registro.jsx` | Formulario público con identificación, nombre completo, usuario, contraseña y confirmación. |
| `server/configurar-search-path.sql` | Ajusta la sesión actual y las próximas conexiones del mismo rol a la misma base. Puede ejecutarse directamente desde pgAdmin. |
| `server/.env.example` | Proporciona las variables que utiliza el configurador local en una instalación limpia. |
| `postman/EventPass-Administracion-Eventos.postman_collection.json` | Colección importable con sesiones separadas por rol, CRUD y pruebas negativas. |
| `postman/README.md` | Explica importación, variables, orden de ejecución y resultados esperados por petición. |

## Instalación y uso

Para actualizar una instalación, extrae el ZIP en una carpeta nueva, conserva allí tu archivo `server/.env` y abre la terminal donde está `package.json`. Ejecuta `npm ci`, `npm run db:init`, `npm run build` y `npm start`, en ese orden. La aplicación queda en `http://localhost:4000` con el puerto predeterminado. Para una instalación nueva, crea la base, ejecuta `npm run config:local` después de `npm ci`, ajusta `DATABASE_URL` y ejecuta `npm run seed:admin` después de `npm run db:init`. [Guía de instalación y desarrollo con Vite](README.md)

Para habilitar únicamente las consultas por nombre en una base existente, ejecuta `server/configurar-search-path.sql` desde el Query Tool conectado con tu usuario. Al abrir una conexión nueva, comprueba `SHOW search_path;` y `SELECT * FROM usuarios;`. [Verificación de las cinco tablas en pgAdmin](README.md#consultar-desde-pgadmin)

Para Postman, importa el JSON de la carpeta `postman`, completa las credenciales locales del administrador y de un cliente activo y ejecuta la colección en orden. [Instrucciones y resultado esperado para cada petición](postman/README.md)

## Resultados de esta entrega

Las comprobaciones utilizaron Node.js 24.22.3, PostgreSQL 18.7, Newman 6.2.3 y Chromium Headless 153.0.8010.0. Los ensayos se realizaron en bases locales de prueba, con datos creados para la verificación.

| Comprobación ejecutada | Resultado observado |
|---|---|
| `npm ci`, `npm run build` y `npm start` | Instalación y compilación correctas. Express publicó el WSDL y atendió la colección desde el servicio iniciado con `npm start`. |
| `npm run config:local`, `npm run db:init`, `npm run seed:admin` | Dos ejecuciones. La segunda reconoció el archivo de configuración y el administrador existentes. |
| `npm test` | **19/19**. Pasaron las 16 pruebas anteriores y las 3 nuevas, con el contrato ampliado a 28 operaciones. |
| `npm run test:ui` | **7/7**. Pasaron los 6 recorridos anteriores y el nuevo registro desde la compra. La pantalla de registro se comprobó a 320, 390, 768 y 1440 px. |
| Registro y roles | Alta simple y simultánea, duplicados independientes, hash bcrypt de coste 12, login JWT y CLIENTE/ACTIVO incluso al recibir otro rol o estado. Cliente, organizador y anónimo rechazados en la operación administrativa. |
| Cambio autorizado | El administrador cambió el rol y pudo restaurarlo. Ambos JWT anteriores fueron rechazados. Los intentos de cambiar a un rol incompatible con eventos o compras devolvieron `CONFLICTO`. |
| Colección con Newman | **13 peticiones y 47 aserciones aprobadas por recorrido**, en dos ejecuciones completas. Los cuatro casos negativos devolvieron los códigos previstos. La relectura posterior a la baja devolvió `NO_ENCONTRADO`. |
| Formatos | JSON válido conforme al esquema oficial de colecciones v2.1. Los 13 sobres se analizaron como SOAP 1.1 y su cabecera de autenticación, cuando correspondía, y cuerpo se validaron con el XSD del WSDL. Las 27 operaciones previas conservan sus definiciones. |
| PostgreSQL y conservación | Las 5 tablas resolvieron al mismo OID por nombre corto y por nombre calificado. Se compararon filas de las 5 tablas y definiciones de índices, restricciones y triggers antes y después de reinicializar. El catálogo contiene 8 claves foráneas, 21 índices y 9 triggers de aplicación. |
| Rol de consulta independiente | El script pasó de `"$user", public` a `eventpass, pg_catalog` para el rol de lectura en la base elegida. Una conexión nueva pudo leer las 5 tablas. En otra base, el mismo rol conservó su configuración anterior. |

La primera ejecución de interfaz se detuvo al iniciar el Chromium de sistema por una restricción de sockets del entorno de pruebas. El resultado de la tabla corresponde a la suite completa ejecutada con Chromium Headless mediante la opción existente `BROWSER_EXECUTABLE`. La verificación de pgAdmin usó conexiones PostgreSQL independientes, equivalentes a abrir un Query Tool nuevo.

El ZIP incluye `package-lock.json` y la compilación de producción. Las dependencias se instalan con `npm ci`. Las credenciales de cada instalación se conservan en su archivo local `server/.env`.

---

<details>
<summary>Historial de la transformación inicial de Techstore a EventPass</summary>

La transformación se hizo sobre el proyecto contenido en `techstore_integrado(1).zip`. Los requisitos se contrastaron con el documento «Proyecto 5 – Servicios Web» y el diseño con «Swiss Design Gráfico». Se conservan el paquete npm único, Vite, React Router, contextos, componentes y páginas, PostgreSQL y node-soap. La nueva API publica 27 operaciones document/literal con campos XML tipados.

## Estructura

| Ruta | Contenido |
|---|---|
| `package.json`, `package-lock.json`, `vite.config.js`, `index.html` | Dependencias, scripts y entrada web del proyecto integrado |
| `src/App.jsx`, `src/main.jsx`, `src/styles.css` | Rutas, arranque y sistema visual |
| `src/components/` | Navegación, cartelera, compra, formularios, tablas, estados, modal y notificaciones |
| `src/context/` | Sesión y reintento de pedidos |
| `src/data/` | Formatos colombianos, roles y etiquetas de presentación |
| `src/pages/` | Catálogo, detalle, acceso, paneles por rol, comprobantes y admisión |
| `src/services/` | Transporte SOAP y consultas con estados de carga y error |
| `server/` | Express, contrato, operaciones de dominio, esquema, configuración y carga inicial |
| `public/` | Marca y fotografía de concierto distribuidas localmente |
| `test/` | Entorno PostgreSQL aislado, suite SOAP y recorridos Playwright |

## Correspondencia con el proyecto académico

| Requisito | Dónde se implementa o se verifica |
|---|---|
| Cinco tablas, claves, importes y relaciones | `server/schema.sql` y [modelo relacional](BACKEND.md) |
| CRUD mediante SOAP para las cinco entidades | `server/eventpass.wsdl`, `server/servicio.js` y [27 operaciones](server/README.md) |
| JWT, bcrypt y tres roles | `server/usuarios.js`, autorización por operación y filtros por propietario en las consultas |
| Aforo, inventario y comprobantes | `server/catalogo.js`, `server/ventas.js` y triggers de `server/schema.sql` |
| Entradas únicas y validación | `ValidarEntrada`, consulta de la compra y transición bloqueada del pase |
| Compra en el navegador | `EventoDetalle.jsx`, `Comprar.jsx`, `CompraContext.jsx` y `Movimientos.jsx` |
| Identidad gráfica y adaptación | `styles.css`, arte por categoría, fotografía local, iconos Lucide y tipografía mono local |

## Resultados de verificación

Se utilizó Node.js 24.22.3, PostgreSQL 18.7, React 19, Vite 7 y Chromium Headless 153.0.8010.0. El frontend se ejecutó contra Express y una base PostgreSQL real. El esquema completo puede instalarse junto a otros esquemas y admite inicialización repetida.

| Comprobación | Resultado |
|---|---|
| Instalación y compilación | `npm ci` y `npm run build` completados desde la entrega de código fuente. |
| Arranque y datos iniciales | Se inicializó el esquema dos veces. Los seeds reconocieron el administrador y las cuentas de muestra existentes. Vite y Express publicaron los cuatro eventos por SOAP, con el puerto del backend configurado. |
| Backend, base de datos y SOAP | **16 de 16 pruebas aprobadas** mediante `npm test`. |
| Interfaz en Chromium | **6 de 6 pruebas aprobadas** mediante `npm run test:ui`. |
| Contrato XML | Se compiló el XSD y se validaron 62 solicitudes y respuestas, incluido un Fault. El recorrido cubrió las 27 operaciones. |
| Adaptación | Se comprobaron 13 rutas por ancho a 320, 390, 768 y 1440 píxeles, incluida la navegación móvil. La edición administrativa también se probó a 1024 píxeles. |
| Simultaneidad | Dos clientes que pedían dos unidades cuando quedaban tres produjeron una compra de dos y una plaza restante. |
| Idempotencia | Dos peticiones simultáneas con el mismo UUID recuperaron una sola compra y descontaron el cupo una sola vez. |
| Fallo al confirmar | Se forzó un error diferido dentro de PostgreSQL. La compra y sus entradas quedaron revertidas y el inventario recuperó su valor original. |
| Admisión | Dos validaciones simultáneas del mismo código produjeron un único ingreso. La carrera entre validación y cancelación dejó un único estado final coherente. |
| Historial | Se verificaron reemisión y cancelaciones parcial, total y repetida, manteniendo códigos previos y precios originales. |

Los recorridos de interfaz incluyen el regreso desde el login a la selección, filtros, compra aceptada y rechazada, comprobantes, redirección al cerrar sesión, formularios administrativos, venta de mostrador, cambio de responsable y control de puerta. Las pruebas de JWT también ejercitan expiración, firma, cambio de estado y discrepancia de rol. Las resoluciones móviles corresponden a un navegador Chromium con viewport configurado.

## Decisiones de entrega

- La antigua operación genérica y el catálogo local de productos dieron paso a contratos XML por entidad y al inventario persistente. La selección se conserva al iniciar sesión y la clave del pedido permite recuperar un intento cuyo resultado se perdió.
- El administrador puede actuar como organizador de un evento. Un organizador ordinario solo puede administrar eventos propios. Los compradores son cuentas de cliente activas.
- El CRUD conserva el historial de ventas mediante cancelaciones lógicas. `CrearEntrada` se reserva para reemitir un pase pagado y todavía sin usar. La misma plaza conserva su precio.
- Se eligió el código único en texto seleccionable como identificación visual. El registro de ingreso siempre consulta PostgreSQL por SOAP.
- Los componentes de práctica de contacto, animaciones y navegación duplicada se sustituyeron por los flujos de eventos. El modal, el acordeón, las notificaciones y la navegación se utilizan en funciones reales.
- La plantilla `server/.env.example` y el generador local sustituyen al archivo de configuración que contenía el ZIP de origen. Las claves de demostración se generan en cada instalación.
- El esquema completo, los permisos y el procedimiento de arranque se detallan en [BACKEND.md](BACKEND.md), [README.md](README.md) y [server/README.md](server/README.md).

## Inventario frente al ZIP de origen

Las rutas se comparan con la raíz de cada proyecto. Un cambio de nombre aparece como baja y alta. Los archivos de instalación local y el directorio de compilación se regeneran con los comandos del README.

### Creados (35)

| Carpeta | Archivos |
|---|---|
| Raíz | `ENTREGA.md` |
| `public/imagenes` | `concierto.webp` |
| `public` | `marca.svg` |
| `server` | `.env.example`, `app.js`, `catalogo.js`, `configurar.js`, `db.js`, `eventpass.wsdl`, `init-db.js`, `seed-demo.js`, `servicio.js`, `usuarios.js`, `validacion.js`, `ventas.js`, `xml.js` |
| `src/components` | `Comprar.jsx`, `Estados.jsx`, `EventCard.jsx`, `EventoDestacado.jsx`, `GestorEntidades.jsx`, `Tabla.jsx` |
| `src/context` | `CompraContext.jsx` |
| `src/data` | `presentacion.js` |
| `src/pages` | `EventoDetalle.jsx`, `Eventos.jsx`, `EventosAdmin.jsx`, `Movimientos.jsx`, `Panel.jsx`, `TiposAdmin.jsx`, `Validar.jsx` |
| `src/services` | `useConsulta.js` |
| `test` | `browser.test.js`, `entorno.js`, `integration.test.js` |

### Modificados (27)

| Carpeta | Archivos |
|---|---|
| Raíz | `.gitignore`, `BACKEND.md`, `README.md`, `index.html`, `package-lock.json`, `package.json`, `vite.config.js` |
| `server` | `README.md`, `schema.sql`, `seed-admin.js`, `server.js` |
| `src` | `App.jsx`, `main.jsx`, `styles.css` |
| `src/components` | `Accordion.jsx`, `Footer.jsx`, `Header.jsx`, `Modal.jsx`, `Navbar.jsx`, `RutaProtegida.jsx`, `Toast.jsx` |
| `src/context` | `AuthContext.jsx` |
| `src/pages` | `Inicio.jsx`, `Login.jsx`, `NoEncontrado.jsx`, `UsuariosAdmin.jsx` |
| `src/services` | `soapApi.js` |

### Retirados (17)

| Carpeta | Archivos |
|---|---|
| `server` | `.env`, `techstore.wsdl` |
| `src/components` | `ClienteActual.jsx`, `Dropdown.jsx`, `FeaturedProductCarousel.jsx`, `NavbarCompact.jsx`, `ProductCard.jsx`, `Tabs.jsx` |
| `src/context` | `FormularioContext.jsx` |
| `src/data` | `productos.js` |
| `src/pages` | `CargarProducto.jsx`, `Contacto.jsx`, `InterfacesModernas.jsx`, `ProductoDetalle.jsx`, `Productos.jsx`, `ProductosAdmin.jsx`, `Usuarios.jsx` |

</details>
