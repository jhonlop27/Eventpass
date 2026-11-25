# EventPass

Sistema de gestión de eventos, venta de entradas y control de acceso del Proyecto 5 de Servicios Web. React 19 consume una API SOAP 1.1 de Express. PostgreSQL conserva el catálogo, las compras y cada entrada emitida.

## Primera ejecución en Windows, macOS o Linux

Necesitas Node.js 22.12 o superior, npm y PostgreSQL 14 o superior en ejecución. Abre una terminal en la carpeta que contiene `package.json`. Estos comandos también funcionan en PowerShell.

1. Si la base ya existe, utiliza esa misma base y conserva tu `server/.env` en la carpeta del proyecto actualizado. Si es una instalación nueva, crea la base desde pgAdmin o con el siguiente comando.

   ```sh
   createdb -U postgres eventpass
   ```

2. Instala las dependencias y crea la configuración local.

   ```sh
   npm ci
   npm run config:local
   ```

3. Abre `server/.env`. Ajusta `DATABASE_URL` con el usuario, contraseña, host, puerto y base de tu instalación. La forma de la URI es `postgresql://USUARIO:CLAVE@localhost:5432/eventpass`. Codifica los caracteres especiales de la contraseña en esa URI. El archivo generado contiene un secreto JWT aleatorio y la contraseña inicial de `ADMIN_USER`. Guarda esos valores en tu equipo.

4. Inicializa las cinco tablas. El comando también configura la búsqueda por nombre para ese usuario de PostgreSQL en esa base. En una instalación nueva, crea el primer administrador con el segundo comando. En una actualización puedes seguir usando la cuenta administrativa existente.

   ```sh
   npm run db:init
   npm run seed:admin
   ```

5. Para una demostración con los tres roles y cuatro eventos comprables, ejecuta la carga de muestra.

   ```sh
   npm run seed:demo
   ```

   La primera ejecución imprime en tu terminal las claves aleatorias de `organizacion.demo` y `cliente.demo`. Guárdalas entonces. Las siguientes ejecuciones reconocen las cuentas existentes. El administrador también puede asignar una nueva contraseña desde **Panel → Usuarios**. Los eventos de muestra se programan a partir del día en que se crean.

6. Arranca el backend en una terminal y Vite en otra, ambas desde la raíz.

   ```sh
   npm run server
   ```

   ```sh
   npm run dev
   ```

   Abre la dirección que imprima Vite, habitualmente [http://localhost:5173](http://localhost:5173). El servicio de PostgreSQL debe estar iniciado antes de arrancar Express. El WSDL está disponible en [http://localhost:4000/soap?wsdl](http://localhost:4000/soap?wsdl).

### Ejecutar el build con un solo servidor

Con la base configurada, también puedes servir el frontend compilado y SOAP desde el mismo proceso.

```sh
npm run build
npm start
```

Abre [http://localhost:4000](http://localhost:4000). El proceso detecta `dist/` al arrancar. En un servidor público, configura HTTPS en el proxy de entrada y establece `SOAP_PUBLIC_URL` con la dirección HTTPS del servicio.

## Consultar desde pgAdmin

1. En **Databases**, selecciona la base que aparece al final de `DATABASE_URL` y abre **Query Tool**. Comprueba el usuario de la conexión y su ruta de búsqueda.

   ```sql
   SELECT current_database(), current_user, current_schema();
   SHOW search_path;
   ```

2. Si usas el mismo usuario que ejecutó `npm run db:init`, abre una conexión nueva. Si consultas con otro usuario o solo necesitas corregir una instalación existente, abre y ejecuta el archivo `server/configurar-search-path.sql` en esa base, conectado con el usuario que hará las consultas. El script también actualiza el Query Tool que lo ejecuta. Ese usuario debe tener acceso de lectura a las tablas.

3. Cierra el Query Tool y abre otro en la misma base para verificar el ajuste persistente. El resultado de `SHOW search_path` debe ser `eventpass, pg_catalog` y la comparación debe devolver `true`.

   ```sql
   SHOW search_path;
   SELECT to_regclass('usuarios')::oid = to_regclass('eventpass.usuarios')::oid AS misma_tabla;
   SELECT * FROM usuarios;
   SELECT * FROM eventos;
   SELECT * FROM tipos_entrada;
   SELECT * FROM compras;
   SELECT * FROM entradas;
   ```

El pool de Node configura su propia conexión en `server/db.js`. El `SET LOCAL` de `schema.sql` solo rige la transacción de instalación. El nuevo script usa `ALTER ROLE … IN DATABASE …` para el usuario y la base actuales. Los privilegios de lectura se administran por separado. [PostgreSQL, esquemas y ruta de búsqueda](https://www.postgresql.org/docs/current/ddl-schemas.html) · [PostgreSQL, ALTER ROLE](https://www.postgresql.org/docs/current/sql-alterrole.html)

## Registro y uso por rol

En **Iniciar sesión → Registrarse**, completa la identificación, el nombre, el usuario y las dos copias de la contraseña. Al confirmar volverás al acceso con el nombre de usuario precargado. Si el registro comenzó durante una compra, el inicio de sesión recupera el evento y la cantidad seleccionados. Las cuentas públicas nacen como `CLIENTE` y `ACTIVO`. Un administrador puede cambiar un rol en **Panel → Usuarios → Editar**, siempre que sea compatible con las compras y eventos asociados.

| Función | Administrador | Organizador | Cliente |
|---|---|---|---|
| Consultar cartelera y localidades | Sí | Sí | Sí |
| Gestionar usuarios | Todos | — | — |
| Crear, editar y eliminar eventos y tipos | Todos | De sus eventos | — |
| Comprar | Para un cliente activo | — | Para sí mismo |
| Consultar compras y entradas | Todas | De sus eventos | Propias |
| Cambiar responsable o cancelar compra | Sí | — | — |
| Reemitir o cancelar una entrada | Sí | — | — |
| Validar el ingreso por código | Cualquier evento | Sus eventos | — |

La cartelera pública muestra eventos activos cuya fecha y hora todavía no han pasado. Un evento agotado se identifica en el catálogo. Un administrador u organizador puede abrir los borradores y eventos cerrados desde su panel.

## Recorrido de compra

1. Abre un evento, elige localidad y cantidad. Si inicias sesión durante el proceso, regresarás a la selección.
2. Revisa el resumen y confirma. El servidor comprueba los cupos, compara el precio visto con el vigente y calcula el total en PostgreSQL.
3. El comprobante reúne las entradas individuales. Cada pase muestra su código, evento, horario, lugar, localidad, precio pagado y estado.
4. En **Panel → Validar entrada**, el personal autorizado introduce el código completo. Un segundo intento informa que la entrada ya se utilizó.

La venta académica registra el importe en COP. La identificación en puerta se realiza mediante el código de texto verificable. Para una cancelación parcial se conserva el importe original del comprobante y se actualiza la cantidad de entradas vigentes.

## Rutas

| Ruta | Vista |
|---|---|
| `/`, `/eventos`, `/eventos/:id` | Inicio, catálogo y selección de entradas |
| `/login` | Inicio de sesión y retorno a la ruta solicitada |
| `/registro` | Registro público de clientes |
| `/panel` | Resumen según el rol |
| `/panel/usuarios` | Administración de usuarios |
| `/panel/eventos`, `/panel/tipos` | Gestión de eventos y localidades |
| `/panel/compras`, `/panel/entradas` | Historial y acciones según rol |
| `/compras/:id`, `/entradas/:id` | Comprobante e identificación individual |
| `/panel/validar` | Registro de ingreso |

## Pruebas

Las suites crean bases temporales llamadas `ep_test_<uuid>`, arrancan Express en un puerto libre y eliminan únicamente la base que crearon. Usa un rol local con permiso `CREATEDB` en `TEST_DATABASE_URL`. Si omites esa variable, se usa el rol de `DATABASE_URL`. Los datos del catálogo de trabajo se mantienen en su propia base.

```sh
npm test
npm run build
npx playwright install chromium
npm run test:ui
```

También puedes indicar un Chromium compatible mediante `BROWSER_EXECUTABLE`. La suite de navegador usa el build de producción y realiza compras contra PostgreSQL.

## Documentos de la entrega

- [Operaciones SOAP y configuración](server/README.md)
- [Colección Postman y recorrido de pruebas](postman/README.md)
- [Esquema relacional, transacciones y reglas de negocio](BACKEND.md)
- [Inventario de archivos, decisiones y resultados de la verificación](ENTREGA.md)

La fotografía editorial se distribuye dentro de `public/imagenes/`. Crédito de la imagen de concierto a Yvette de Wit. La tipografía JetBrains Mono se incluye localmente durante el build. [Fotografía original](https://unsplash.com/photos/stage-light-front-of-audience-NYrVisodQ2M) · [Licencia de la fotografía](https://unsplash.com/license)

## Responsable al registrar una compra

El responsable inicial de cada compra es el organizador del evento asociado al tipo de entrada. La regla aplica a compras de clientes y a ventas de mostrador. Si actualizas una instalación existente, reinicia el backend con el código actualizado. Desde el Query Tool de pgAdmin, ejecuta `server/reparar-responsables.sql` en la base de EventPass para completar las compras que tienen responsable nulo. La reparación usa el organizador actual de cada evento y conserva las asignaciones ya registradas.
