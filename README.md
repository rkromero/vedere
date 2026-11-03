# Vedere

E-commerce de anteojos (sol, recetados, multifocales y accesorios) de Argentina. El cliente compra online y el pedido lo arma, entrega y ajusta la **óptica socia más cercana** a su domicilio.

> Estado: **prompt 5 de 6** — red de ópticas socias y gestión de pedidos (asignación automática por cercanía, panel `/optica`, línea de tiempo, reembolsos, cambios y devoluciones, liquidaciones) sobre el checkout y pagos del prompt 4 (API) y la tienda pública del prompt 3. Pendiente: pantallas web del checkout (prompt 4) y prompt 6.

## Stack

| Capa     | Tecnología                                                                 |
| -------- | -------------------------------------------------------------------------- |
| Monorepo | pnpm workspaces                                                            |
| Web      | `apps/web` — Next.js 15 (App Router), React 19, TypeScript, Tailwind v4    |
| API      | `apps/api` — Node 20, Fastify 5, TypeScript, Zod                           |
| Base     | `packages/db` — Prisma 6 + PostgreSQL                                      |
| UI       | `packages/ui` — componentes y tokens compartidos                           |
| Auth     | JWT en cookie httpOnly + refresh token rotativo (hasheado en DB), argon2id |
| Imágenes | sharp → WebP en 3 tamaños → Cloudflare R2 (S3) o disco local en desarrollo |
| Infra    | GitHub (main protegida + develop) → Railway (Postgres, api, web)           |

## Estructura

```
vedere/
├── apps/
│   ├── api/            Fastify: /health, /auth/*, /admin/* (backoffice), /catalogo/* (tienda)
│   └── web/            Next.js: tienda (/, /health, 404) y backoffice (/admin/*)
├── packages/
│   ├── db/             Prisma schema, migraciones, seed, cliente compartido
│   └── ui/             Button, Container, cn(), tokens de marca
├── docker-compose.yml  Postgres local
├── .env.example        Todas las variables (api + db + web)
└── .github/workflows   CI: lint · typecheck · test (con Postgres) · build
```

## Branding

Definido en `apps/web/src/styles/globals.css` (bloque `@theme` de Tailwind v4) y en `packages/ui/src/tokens.ts`.

- Colores: `negro #0A0A0A`, `blanco #FFFFFF`, `gris-claro #F2F2F0`, `gris-medio #8A8A86`. Colección: `sol #F2B33D`, `vetro #7FD1C1`, `noche #3A5BD9`, `carey #B7712F`. Se usan como `bg-sol`, `text-negro`, etc.
- Tipografía: **Archivo** variable (Google Fonts, ejes `wdth` + `wght`) cargada con `next/font`.
  - `font-campaign`: titulares de campaña → wdth 62, peso 800, mayúsculas.
  - `font-text` (y el default): wdth 100, pesos 400 a 600.
- Logos en `apps/web/public/brand/` (`logo.svg`, `logo-blanco.svg`, `isotipo.svg`). Los actuales son **placeholders**: reemplazarlos por los SVG oficiales manteniendo los nombres.

## Requisitos

- Node 20 o 22, pnpm 9 (`corepack enable` o `npm i -g pnpm@9`)
- Postgres local: Docker (`docker compose up -d`) **o** una instalación local (ej. `scoop install postgresql`) **o** una `DATABASE_URL` externa
- CLI: `gh` (GitHub) y `railway` (Railway) para infra

## Instalación y desarrollo local

```bash
pnpm install

# 1) Postgres local (opción Docker)
docker compose up -d
#    Opción sin Docker (Windows con scoop): scoop install postgresql; pg_ctl -D <scoop>/apps/postgresql/current/data start
#    y crear el rol/base: CREATE ROLE vedere LOGIN PASSWORD 'vedere' SUPERUSER; CREATE DATABASE vedere OWNER vedere; CREATE DATABASE vedere_test OWNER vedere;

# 2) Variables de entorno
cp .env.example .env                    # api + db + seed
cp apps/web/.env.example apps/web/.env.local
# editar .env: JWT_ACCESS_SECRET / JWT_REFRESH_SECRET (openssl rand -base64 48), ADMIN_PASSWORD

# 3) Base de datos: migraciones + seed (admin + catálogo de ejemplo)
pnpm db:deploy      # aplica packages/db/prisma/migrations
pnpm db:seed        # crea el ADMIN (ADMIN_EMAIL / ADMIN_PASSWORD) + 4 categorías base con hijas, 4 marcas, 4 colecciones y 12 productos
                    # SEED_CATALOGO=false pnpm db:seed → sólo el admin

# 4) Levantar todo (api :4000, web :3000)
pnpm dev
```

Backoffice local: http://localhost:3000/admin (ingresar con el admin del seed).

Scripts útiles:

| Comando           | Qué hace                                                         |
| ----------------- | ---------------------------------------------------------------- |
| `pnpm dev`        | api (tsx watch) + web (next dev)                                 |
| `pnpm build`      | build de db, ui, api y web                                       |
| `pnpm lint`       | ESLint en todos los paquetes                                     |
| `pnpm typecheck`  | `tsc --noEmit` en todos los paquetes                             |
| `pnpm test`       | tests (vitest en la API; integración si hay `TEST_DATABASE_URL`) |
| `pnpm format`     | Prettier                                                         |
| `pnpm db:migrate` | `prisma migrate dev` (crea una migración nueva)                  |
| `pnpm db:deploy`  | `prisma migrate deploy` (aplica migraciones)                     |
| `pnpm db:seed`    | seed del admin y catálogo de ejemplo                             |
| `pnpm db:studio`  | Prisma Studio                                                    |

## Modelo de datos (catálogo)

- **Marca**: nombre, slug, logo, activa.
- **Categoria**: nombre, slug, padre opcional (árbol), orden, activa. Base del seed: Sol, Recetados, Multifocal, Accesorios (+ hijas).
- **Coleccion**: nombre, slug, color hex, banner, vigencia desde/hasta, activa (Sol, Vetro, Noche, Carey).
- **Producto**: nombre, slug, descripción, marca, categorías (N:N), colección, línea (SOL, RECETADO, MULTIFOCAL, ACCESORIO), material, forma (REDONDO, CUADRADO, OJO_DE_GATO, AVIADOR, RECTANGULAR), género (UNISEX, MUJER, HOMBRE), medidas (calibre, puente, varilla mm), precio, precio de lista, permite receta, destacado, estado (BORRADOR, PUBLICADO, ARCHIVADO), SEO (title, description), vendidos, publicadoEn.
- **Variante**: producto, color de armazón (+hex), color de lente (+hex), SKU único, stock, stock mínimo, activa, orden.
- **ImagenVariante**: tipo (FRENTE, PERFIL, TRES_CUARTOS, PUESTO, OTRA), orden, URL grande / mediana / miniatura, alt.
- **Auditoría** en todos: `createdAt`, `updatedAt`, `createdById`, `updatedById`.

## Modelo de datos (pedidos y ópticas — prompts 4 y 5)

- **Optica**: nombre comercial, slug, razón social, CUIT, dirección geocodificada (lat/lng), radio de cobertura (km), horarios, teléfono, WhatsApp, email, óptico técnico responsable y matrícula, comisión %, capacidad diaria, activa/pausada. Los usuarios con rol **OPTICA** tienen `opticaId`.
- **Pedido**: número `VD-nnnnn`, cliente (email, nombre, DNI, teléfono), entrega (retiro en óptica o envío a domicilio con dirección geocodificada), óptica asignada, canal (WEB, WHATSAPP, OPTICA, ADMIN), ítems, totales y descuentos, receta, pago (`estadoPago`: PENDIENTE, APROBADO, RECHAZADO, REEMBOLSADO), estado, fechas (`pagadoEn`, `asignadoEn`, `aceptarAntesDe`, `aceptadoEn`, `enviadoEn`, `entregadoEn`), `numeroSeguimiento`, `opticasExcluidas` (rechazaron o vencieron), comisión congelada al entregar (`comisionPct`, `comisionMonto`), `reembolsado`, factura y notas internas.
- **Estados** (`EstadoPedido`): `PENDIENTE_PAGO → PAGADO → ASIGNADO → ACEPTADO → EN_ARMADO → LISTO → (ENVIADO) → ENTREGADO`, más `CANCELADO` y `DEVUELTO`. Las transiciones válidas están en `apps/api/src/lib/asignacion.ts` (`TRANSICIONES`); el admin puede forzar una con nota.
- **PedidoEvento** (línea de tiempo): tipo (ESTADO, ASIGNACION, RECHAZO, NOTA, EMAIL, PAGO, REEMBOLSO, SOLICITUD), estado anterior/nuevo, óptica, actor (usuario, nombre, rol o Sistema), nota y datos.
- **Turno** (agenda de la óptica): tipo (MEDICION, AJUSTE, RETIRO, OTRO), fecha, duración, cliente, pedido opcional, estado.
- **SolicitudCambio**: tipo (CAMBIO, DEVOLUCION), motivo, detalle, estado (PENDIENTE, APROBADA, RECHAZADA), resolución (NUEVO_PEDIDO, REINTEGRO), pedido nuevo, respuesta al cliente.
- **Reembolso**: proveedor (mercadopago / manual), id externo, monto, motivo, estado. **EmailEnviado**: cada email al cliente, a la óptica o al admin (ENVIADO por Resend, SIMULADO sin `RESEND_API_KEY`, ERROR).
- **ConfigTienda**: además de pagos y cuotas, `plazoAceptacionHoras` (horas hábiles que tiene la óptica para aceptar), `horaHabilDesde` / `horaHabilHasta` (hora Argentina) y `sabadoHabil`.

### Asignación automática

Al aprobarse el pago (webhook de Mercado Pago o confirmación manual de la transferencia) el pedido pasa a `PAGADO` y se asigna a la **óptica activa más cercana** (Haversine sobre lat/lng) que tenga al cliente **dentro de su radio** y **capacidad disponible ese día** (pedidos asignados hoy, hora Argentina, menos cancelados). Si ninguna lo cubre queda `PAGADO` **sin asignar**, se registra en la línea de tiempo y se avisa al admin por email (`ADMIN_NOTIFY_EMAIL`). La óptica tiene `plazoAceptacionHoras` hábiles para aceptar: si rechaza (con motivo) o se vence el plazo (`procesarVencidos`, cada `ASIGNACION_INTERVALO_MIN` minutos), queda excluida y el pedido pasa a la siguiente más cercana. El admin puede reasignar a mano a cualquier óptica indicando el motivo: queda registrado quién y por qué. Cada cambio de estado se audita y dispara un email al cliente.

## API

Base: `http://localhost:4000`. Todas las respuestas de error tienen la forma `{ error: { code, message, details? } }`. Un SKU o slug duplicado responde `409 DUPLICATE` con mensaje claro y no guarda nada.

### Auth y salud

| Método | Ruta             | Auth           | Descripción                                         |
| ------ | ---------------- | -------------- | --------------------------------------------------- |
| GET    | `/health`        | —              | Estado de la API y la base (200 ok / 503 degradado) |
| POST   | `/auth/register` | —              | Alta de CLIENTE; setea cookies de sesión            |
| POST   | `/auth/login`    | —              | Login; setea cookies de sesión                      |
| POST   | `/auth/refresh`  | cookie refresh | Rota refresh token y renueva access token           |
| POST   | `/auth/logout`   | cookie refresh | Revoca refresh token y limpia cookies               |
| GET    | `/auth/me`       | access         | Usuario actual                                      |

### Backoffice (`/admin/*`) — ADMIN y OPERADOR

| Ruta                                                                                       | Descripción                                                                                                                                                                               |
| ------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `GET /admin/dashboard`                                                                     | Totales + variantes con stock por debajo del mínimo                                                                                                                                       |
| `GET/POST /admin/marcas`, `GET/PUT/DELETE /admin/marcas/:id`                               | ABM de marcas (`q`, `activa`, paginación)                                                                                                                                                 |
| `GET/POST /admin/categorias`, `GET/PUT/DELETE /admin/categorias/:id`                       | ABM de categorías; `?tree=true` devuelve el árbol                                                                                                                                         |
| `GET/POST /admin/colecciones`, `GET/PUT/DELETE /admin/colecciones/:id`                     | ABM de colecciones                                                                                                                                                                        |
| `GET/POST /admin/productos`, `GET/PUT/DELETE /admin/productos/:id`                         | ABM de productos (variantes anidadas al crear). Filtros: `q`, `estado`, `linea`, `marcaId`, `categoriaId`, `coleccionId`, `forma`, `material`, `genero`, `destacado`, `bajoStock`, `sort` |
| `POST /admin/productos/bulk`                                                               | `{ ids, accion: publicar \| archivar \| borrador \| destacar \| no_destacar \| eliminar }`                                                                                                |
| `GET /admin/productos/export.csv` · `POST /admin/productos/import`                         | Exportar / importar CSV (una fila por variante; multipart `file`, `text/csv` o `{ csv }`). La importación es todo-o-nada y devuelve errores por fila                                      |
| `GET/POST /admin/productos/:id/variantes`, `GET/PUT/DELETE /admin/variantes/:id`           | Variantes                                                                                                                                                                                 |
| `POST/PUT /admin/variantes/:id/imagenes`, `DELETE /admin/variantes/:id/imagenes/:imagenId` | Imágenes (PUT reemplaza la lista en el orden recibido)                                                                                                                                    |
| `POST /admin/imagenes`                                                                     | multipart `file` (+ `folder`) → sharp → WebP 320 / 800 / 1600 → R2 (S3 `PutObject`, cache immutable) o disco local. `GET /admin/imagenes/config` informa el driver                        |
| `POST /admin/imagenes/presign`                                                             | URL prefirmada para subida directa a R2                                                                                                                                                   |

Sólo ADMIN: `GET /admin/ping`, `GET/POST /admin/usuarios`, `GET/PUT /admin/usuarios/:id` (rol OPTICA exige `opticaId`), `POST /admin/usuarios/:id/password`, `POST /admin/usuarios/:id/desactivar`, `POST /admin/usuarios/:id/activar`, `PUT /admin/config-tienda`. Un OPERADOR recibe 403.

### Backoffice: pedidos, ópticas y liquidaciones (prompt 5)

| Ruta                                                                     | Descripción                                                                                                                                                                                 |
| ------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `GET /admin/pedidos`                                                     | Listado paginado + `resumen` (por estado, por pago, sin asignar, solicitudes pendientes). Filtros: `q` (número, email, nombre, DNI, factura), `estado`, `estadoPago`, `metodoPago`, `opticaId` (o `sin`), `linea`, `canal`, `desde`, `hasta` |
| `GET /admin/pedidos/export.csv`                                          | Mismos filtros, CSV (`;`, BOM, hasta 5000 filas)                                                                                                                                            |
| `GET /admin/pedidos/:id`                                                 | Detalle completo (línea de tiempo, solicitudes, turnos, reembolsos, emails, pagos) + `candidatas` (ópticas con distancia, radio, cupo y elegibilidad)                                         |
| `PUT /admin/pedidos/:id` · `POST /admin/pedidos/:id/notas`               | Factura y notas internas · nota interna en la línea de tiempo                                                                                                                               |
| `POST /admin/pedidos/:id/estado`                                         | `{ estado, nota?, numeroSeguimiento?, forzar? }` — valida la secuencia salvo `forzar`; audita y avisa al cliente                                                                              |
| `POST /admin/pedidos/:id/asignar` · `/asignar-automatico`                | Reasignación manual `{ opticaId, motivo }` (queda quién y por qué) · vuelve a correr la asignación automática                                                                                 |
| `POST /admin/pedidos/:id/emails/reenviar`                                | Reenvía al cliente el email del estado actual (o `{ estado }`)                                                                                                                              |
| `POST /admin/pedidos/:id/reembolsar`                                     | `{ monto?, motivo, cancelar? }` — total o parcial; Mercado Pago vía `POST /v1/payments/:id/refunds`, transferencia queda registrado como manual                                              |
| `POST /admin/pedidos/:id/cancelar`                                       | `{ motivo, reembolsar? }` — repone stock, libera la óptica, avisa al cliente                                                                                                                 |
| `POST /admin/pedidos/:id/pago/aprobar` · `/pago/rechazar`                | Confirmación manual de transferencias (al aprobar: `PAGADO` + asignación automática)                                                                                                        |
| `GET /admin/solicitudes` · `POST /admin/solicitudes/:id/aprobar` · `/rechazar` | Bandeja de cambios y devoluciones (`estado`, `tipo`). Aprobar: `{ resolucion: NUEVO_PEDIDO \| REINTEGRO, respuesta? }` (nuevo pedido sin cargo asignado a una óptica, o reembolso total)  |
| `GET /admin/liquidaciones?mes=AAAA-MM[&opticaId]`                        | Resumen por óptica (entregados, monto, comisión) o detalle de una                                                                                                                            |
| `GET /admin/opticas/mapa`                                                | Ópticas con coordenadas y radio para el mapa Leaflet                                                                                                                                        |
| `GET /admin/config-tienda`                                               | Configuración comercial + plazo/horario hábil de aceptación (`entorno` informa si hay Resend, MP, etc.)                                                                                      |

### Panel de la óptica (`/optica/*`) — sólo rol OPTICA con óptica vinculada

Un usuario OPTICA sólo ve los pedidos de su óptica: cualquier otro pedido responde **403** aunque exista. ADMIN, OPERADOR y CLIENTE reciben 403 en todo el prefijo.

| Ruta                                                              | Descripción                                                                                                                                  |
| ----------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| `GET /optica/me`                                                  | Datos de la óptica y resumen (pendientes de aceptar, en curso, turnos de hoy)                                                                |
| `GET /optica/pedidos`                                             | Pedidos asignados (`q`, `estado`, `desde`, `hasta`) + `resumen` por estado                                                                   |
| `GET /optica/pedidos/:id`                                         | Detalle con ítems, receta (valores o archivo), datos del cliente, turnos, historial y comisión                                               |
| `POST /optica/pedidos/:id/aceptar` · `/rechazar`                  | Aceptar · rechazar `{ motivo }` (pasa a la siguiente óptica)                                                                                  |
| `POST /optica/pedidos/:id/estado`                                 | `{ estado: EN_ARMADO \| LISTO \| ENVIADO \| ENTREGADO, nota?, numeroSeguimiento? }` — ENVIADO sólo con envío a domicilio y con seguimiento |
| `GET/POST /optica/turnos` · `PUT/DELETE /optica/turnos/:id`       | Agenda de turnos (medición, ajuste, retiro)                                                                                                  |
| `GET /optica/liquidacion?mes=AAAA-MM`                             | Liquidación mensual: pedidos entregados, monto y comisión                                                                                    |

### Checkout (`/checkout/*`) — prompt 4

`GET /config`, `POST /cotizar`, `GET /optica?lat&lng`, `GET /direcciones` + `POST /direcciones/geocodificar`, `POST /recetas/archivo`, `POST /pedidos` (crea el pedido: Mercado Pago o transferencia), `GET /mis-pedidos`, `GET /pedidos/:id`, `POST /pedidos/:id/comprobante`, `POST /pedidos/:id/sincronizar-pago`, webhook de Mercado Pago, y (prompt 5) `GET /pedidos/buscar?numero&email` y `POST /pedidos/:id/solicitudes` `{ tipo, motivo, detalle?, email }` para pedir un cambio o devolución (sólo pedidos LISTO/ENVIADO/ENTREGADO dentro de los 30 días, una pendiente por pedido).

### Tienda (`/catalogo/*`) — público, sólo productos PUBLICADOS

| Ruta                                                                 | Descripción                                                                                                                                                                                                                                                         |
| -------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `GET /catalogo/productos` | Filtros (admiten listas separadas por coma): `q`, `categoria` (slug, incluye hijas), `linea`, `forma`, `color`, `material`, `genero`, `marca`, `coleccion`, `slugs`, `precioMin`, `precioMax`, `destacado`, `receta`. Orden: `orden=relevancia \| mas_vendidos \| novedades \| precio_asc \| precio_desc`. Paginación `page`, `pageSize` |
| `GET /catalogo/productos/:slug` · `/:slug/relacionados` | Detalle (404 si no está publicado) y relacionados (misma colección > forma > línea) |
| `GET /catalogo/sugerencias?q=` | Sugerencias en vivo para el buscador: productos, categorías y colecciones |
| `GET /catalogo/categorias` · `/marcas` · `/colecciones` · `/filtros` | Árbol de categorías, marcas, colecciones vigentes (con portada y cantidad) y valores disponibles para filtros |
| `GET /catalogo/promos` | Mensajes activos y vigentes de la barra de promo |
| `GET /catalogo/opticas` · `/opticas/:slug` | Ópticas socias activas; `cp` ordena por cercanía de código postal, `lat`/`lng` por distancia en km, `q` busca |
| `POST /catalogo/cupones/validar` | `{ codigo, subtotal }` → `{ valido, cupon, descuento }` (404 inexistente, 400 vencido/agotado/mínimo) |
| `POST /catalogo/newsletter` · `/avisos-stock` · `/contacto` | Formularios públicos (rate limit 12/min; `contacto` tiene honeypot `web`) |
| `GET/PUT/DELETE /carrito` | Carrito del usuario logueado (se sincroniza con el de localStorage) |

- Las rutas `PUT` aceptan cuerpos parciales: sólo cambian los campos enviados (los defaults del alta no se reaplican).
- Cookies: `vedere_access` (JWT, `ACCESS_TOKEN_TTL`, path `/`) y `vedere_refresh` (opaco, `REFRESH_TOKEN_TTL_DAYS`, path `/auth`). Ambas `httpOnly`.
- Roles: `ADMIN`, `OPERADOR`, `OPTICA`, `CLIENTE`. Guards: `app.authenticate` y `app.requireRole(...roles)`.
- Rate limiting: `RATE_LIMIT_MAX`/min global por IP, `RATE_LIMIT_AUTH_MAX`/min en register, login y refresh.
- CORS: sólo `WEB_URL`, con credenciales.

## Backoffice (`/admin`)

La web expone un proxy same-origin `/api/*` hacia la API, así las cookies de sesión quedan en el dominio de la web (SameSite=Lax) y los server components pueden leerlas. Un middleware renueva el access token con el refresh token cuando vence.

- Login en `/admin/login` (sólo ADMIN y OPERADOR).
- Menú lateral: Dashboard (pedidos pendientes de pago, sin asignar, con plazo vencido, en curso, solicitudes; alerta de stock), Productos (tabla con búsqueda, filtros, paginación, acciones masivas, exportar/importar CSV; formulario con pestañas Datos / Variantes y stock / Imágenes con arrastrar para ordenar / SEO), Categorías (árbol), Marcas, Colecciones, Usuarios (sólo ADMIN: crear, editar, desactivar, cambiar rol, resetear contraseña; rol OPTICA con selector de óptica), **Pedidos**, **Cambios y devoluciones**, **Ópticas**, **Liquidaciones**, Barra de promo, Cupones, Mensajes, Configuración.
- **Pedidos** (`/admin/pedidos`): resumen por estado, filtros por estado, pago, óptica (o sin asignar), línea, canal, medio de pago y fechas; búsqueda por número, email, nombre o DNI; exportación CSV. Detalle (`/admin/pedidos/[id]`): línea de tiempo (fecha, usuario, nota), notas internas, cambio de estado (con `forzar`), reasignación con las ópticas candidatas ordenadas por distancia (radio, cupo, rechazos) y motivo obligatorio, asignación automática, reenvío de emails, reembolso total/parcial, cancelación con devolución de stock, confirmación/rechazo de transferencias, factura, solicitudes del cliente (aprobar con nuevo pedido o reintegro / rechazar), reembolsos y emails enviados.
- **Ópticas** (`/admin/opticas`): mapa Leaflet + OpenStreetMap con todas las ópticas y su radio de cobertura; ABM con razón social, CUIT, óptico responsable y matrícula, radio, comisión, capacidad diaria y estado; cupo usado hoy.
- **Cambios y devoluciones** (`/admin/solicitudes`) y **Liquidaciones** (`/admin/liquidaciones?mes=AAAA-MM`, detalle por óptica).
- **Configuración**: plazo de aceptación (horas hábiles), horario hábil y sábado hábil (editable por ADMIN).

## Panel de la óptica (`/optica`)

- Login en `/optica/login` (sólo rol OPTICA con óptica vinculada; el middleware renueva la sesión igual que en `/admin`).
- Resumen (pendientes de aceptar, en curso, turnos de hoy), **Pedidos** con filtros por estado y fecha y búsqueda, detalle con ítems, receta (valores o archivo descargable), datos del cliente, historial y acciones: aceptar / no puedo tomarlo (con motivo), en armado, listo para retirar, enviado (con n.º de seguimiento), entregado y ajustado. **Agenda de turnos** (medición / ajuste / retiro, vinculables al pedido) y **Liquidación** mensual.

## Tienda pública

- Rutas: `/` (home), `/sol` `/recetados` `/multifocales` `/accesorios` `/novedades` `/mas-vendidos`, `/coleccion/[slug]`, `/categoria/[slug]`, `/buscar?q=`, `/p/[slug]?v=[varianteId]` (ficha), `/opticas` (mapa Leaflet + listado + buscador por CP), `/faq`, `/cambios-y-devoluciones`, `/contacto`, `/como-funciona`, `/envios`, `/nosotros`, `/legal/{terminos,privacidad,arrepentimiento}`, `/checkout` (pantallas pendientes del prompt 4), más `sitemap.xml` y `robots.txt`.
- `/cambios-y-devoluciones` incluye el formulario de solicitud: el cliente busca su pedido por número + email, ve sus solicitudes y pide un cambio o una devolución; el equipo la resuelve en `/admin/solicitudes` y el cliente recibe emails.
- Catálogo con Server Components y caché (`revalidate` 60 s en home/listados/ficha, 300 s en ópticas). Filtros y orden viven en la URL (compartibles); scroll infinito con `?page=` en `replaceState`.
- Carrito en `localStorage` (`vedere_carrito_v1`); si hay sesión (`/api/auth/me`), se mezcla con `/carrito` y se sincroniza con un `PUT` debounced. Vistos recientemente en `vedere_recientes_v1`.
- Componentes compartidos y accesibles en `packages/ui` (Drawer con `<dialog>` nativo, botones de 44 px, foco visible, contraste AA).

## Tests

```bash
pnpm test
```

- `apps/api/test/roles.test.ts`, `health.test.ts`: unitarios con la DB mockeada.
- `apps/api/test/catalogo.test.ts`: integración contra `TEST_DATABASE_URL` (vitest aplica las migraciones): alta de marca / categoría hija / colección / producto con 3 variantes e imágenes y lectura pública, SKU duplicado → 409 sin guardar, PUT parcial que no pisa el resto de los campos, archivar saca del público sin borrar, OPERADOR gestiona el catálogo (crea, edita, publica, archiva, borra) pero no usuarios, CSV exportado → importado sin errores, orden y filtros públicos, borrado en cascada.
- `apps/api/test/usuarios.test.ts`: ABM de usuarios sólo ADMIN: alta con hash argon2id, filtros, email duplicado → 409, edición, cambio de rol (revoca sesiones), reset de contraseña (la vieja deja de servir), desactivar (no puede loguearse ni refrescar) y activar, protección del propio usuario, OPERADOR → 403 en todas las rutas.
- `apps/api/test/storage.test.ts`: driver R2 real contra un servidor S3-compatible levantado en el test (sin cuenta de Cloudflare): sharp → WebP 320 / 800 / 1600, 3 `PutObject` firmados con SigV4 al bucket, URLs públicas, no agranda imágenes chicas, URL prefirmada para subida directa y `POST /admin/imagenes` multipart de punta a punta.
- `apps/api/test/checkout.test.ts`: checkout y pagos (prompt 4): cotización, cupones, promociones, pedido por transferencia con comprobante, webhook de Mercado Pago (al aprobar queda ASIGNADO a una óptica), reservas de stock.
- `apps/api/test/asignacion.test.ts` (unitario): elección de la óptica más cercana con radio y cupo (3 ópticas en CABA, pedido en Caballito → Flores), exclusiones, pausadas, horas hábiles (`sumarHorasHabiles`) y transiciones de estado.
- `apps/api/test/opticas.test.ts` (integración, criterios de aceptación del prompt 5): con 3 ópticas en CABA un pedido en Caballito se asigna a la más cercana dentro de su radio al confirmar el pago (eventos PAGO/ASIGNACION, emails al cliente y a la óptica); la capacidad diaria desvía a la siguiente; un usuario OPTICA no ve pedidos de otra óptica ni por URL ni por API (403) y otros roles no entran a `/optica`; si la óptica rechaza pasa a la siguiente y el admin lo ve en la línea de tiempo, y sin cobertura queda sin asignar con aviso al admin; reasignación manual con motivo auditada; ciclo aceptar → en armado → listo → entregado con un evento y un email `ESTADO_*` por cambio, transición inválida → 409; envío a domicilio exige seguimiento; plazo vencido reasigna (`procesarVencidos`); agenda de turnos; la liquidación mensual coincide con la suma de los pedidos entregados por óptica; solicitud del cliente → aprobación con reintegro (DEVUELTO, reembolso manual) o con pedido nuevo sin cargo; filtros, búsqueda por DNI y CSV del listado; cancelación con devolución de stock.
- Los tests de integración se saltean si no hay `TEST_DATABASE_URL`.

## Deploy en Railway

Proyecto **vedere** con tres servicios principales (`Postgres`, `api` y `web`) más `storage`, un object store de respaldo que hoy no se usa. `api` y `web` están vinculados al repo de GitHub (`rkromero/vedere`) y despliegan automáticamente con cada push a `main`. Cada uno se construye con su Dockerfile desde la raíz del monorepo (`apps/api/Dockerfile`, `apps/web/Dockerfile`), configurado en el servicio de Railway (Dockerfile path, healthcheck `/health`, restart on failure). Railway deprecó `railway.json`; la configuración vive en el servicio.

Las imágenes de producción se guardan en **Cloudflare R2**: bucket `vedere-media` con URL pública de desarrollo (`https://pub-….r2.dev`) y un token de API `vedere-api` con permiso *Object Read & Write* limitado a ese bucket. El servicio `api` tiene `STORAGE_DRIVER=auto`, `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET` y `R2_PUBLIC_URL`, con `R2_ENDPOINT` vacío (endpoint `https://<account>.r2.cloudflarestorage.com`). Cada subida genera tres WebP (`-320`, `-800`, `-1600`) con `Cache-Control: immutable` y se sirve desde la URL pública. Para producción conviene reemplazar la URL `r2.dev` (limitada en tasa) por un dominio propio conectado al bucket y actualizar `R2_PUBLIC_URL`.

`storage` es un object store S3-compatible alternativo ([RustFS](https://github.com/rustfs/rustfs), imagen `rustfs/rustfs:1.0.4`, volumen en `/data`, bucket público `vedere-media`) que se usó antes de tener R2. Queda como respaldo: para volver a él basta con apuntar las variables `R2_*` a sus credenciales y poner su dominio en `R2_ENDPOINT`; también se puede eliminar el servicio y su volumen.

La API corre `prisma migrate deploy` al arrancar, así que cada deploy aplica las migraciones pendientes.

### Variables en Railway (nunca en el repo)

**api**

| Variable                                                                                  | Valor                                                                                                                         |
| ----------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| `DATABASE_URL`                                                                            | `${{Postgres.DATABASE_URL}}`                                                                                                  |
| `NODE_ENV`                                                                                | `production`                                                                                                                  |
| `WEB_URL`                                                                                 | URL pública de la web (CORS)                                                                                                  |
| `API_PUBLIC_URL`                                                                          | URL pública de la API (URLs de imágenes en modo local)                                                                        |
| `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`                                                 | `openssl rand -base64 48` (distintos)                                                                                         |
| `COOKIE_SECURE`                                                                           | `true`                                                                                                                        |
| `COOKIE_SAME_SITE`                                                                        | `lax` (las cookies viajan por el proxy `/api/*` de la web)                                                                    |
| `STORAGE_DRIVER`, `UPLOADS_DIR`, `MAX_UPLOAD_MB`                                          | `auto` / `./uploads` / `10`. Con `auto` usa R2 si hay credenciales; si no, disco local (efímero en Railway)                   |
| `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET`, `R2_PUBLIC_URL` | credenciales del bucket de Cloudflare R2 (Account ID, token S3 y URL pública)                                                |
| `R2_ENDPOINT`                                                                             | endpoint S3 alternativo (local: RustFS de docker-compose; o el servicio `storage`). Vacío = Cloudflare R2 de la cuenta        |
| `ACCESS_TOKEN_TTL`, `REFRESH_TOKEN_TTL_DAYS`, `RATE_LIMIT_MAX`, `RATE_LIMIT_AUTH_MAX`     | opcionales (ver `.env.example`)                                                                                               |
| `ADMIN_EMAIL`, `ADMIN_PASSWORD`, `ADMIN_NOMBRE`                                           | para el seed                                                                                                                  |
| `MP_ACCESS_TOKEN`, `MP_WEBHOOK_SECRET`, `MP_ENABLED`                                      | Mercado Pago (checkout, webhook y reembolsos). Sin token, MP queda deshabilitado                                              |
| `RESERVA_STOCK_MINUTOS`, `GOOGLE_MAPS_API_KEY`                                            | reserva de stock durante el pago (30) y autocompletado de direcciones (opcional)                                              |
| `RESEND_API_KEY`, `EMAIL_FROM`                                                            | emails transaccionales (estados del pedido, óptica, admin). Sin API key se registran como SIMULADO en `emails_enviados`       |
| `ADMIN_NOTIFY_EMAIL`                                                                      | casilla que recibe los avisos de pedidos sin asignar y solicitudes de cambio                                                  |
| `ASIGNACION_INTERVALO_MIN`                                                                | cada cuántos minutos se reasignan los pedidos con plazo de aceptación vencido (5)                                             |
| `OPTICA_PASSWORD`                                                                         | sólo para el seed: crea un usuario OPTICA por óptica socia (`optica-<slug>@vedere.com.ar`)                                   |

**web**

| Variable                                                                        | Valor                                       |
| ------------------------------------------------------------------------------- | ------------------------------------------- |
| `NEXT_PUBLIC_SITE_URL`                                                          | URL pública de la web                       |
| `NEXT_PUBLIC_API_URL`                                                           | URL pública de la API                       |
| `API_URL`                                                                       | URL de la API para el servidor Next (proxy) |
| `NEXT_PUBLIC_PROMO_ENABLED`, `NEXT_PUBLIC_PROMO_TEXT`, `NEXT_PUBLIC_PROMO_LINK` | barra de promo de respaldo (los mensajes se cargan en `/admin/promos`) |
| `NEXT_PUBLIC_WHATSAPP` | número con código de país para el botón flotante y los CTA (vacío = se ocultan) |
| `NEXT_PUBLIC_CUOTAS`, `NEXT_PUBLIC_ENVIO_GRATIS_DESDE` | cuotas sin interés (6) y umbral de envío gratis (80000) |
| `NEXT_PUBLIC_INSTAGRAM`, `NEXT_PUBLIC_EMAIL_CONTACTO` | enlaces del footer y contacto |
| `NEXT_PUBLIC_COLAB_TITULO`, `NEXT_PUBLIC_COLAB_TEXTO`, `NEXT_PUBLIC_COLAB_LINK`, `NEXT_PUBLIC_COLAB_CTA` | banner de colaboración de la home (opcionales) |

Las `NEXT_PUBLIC_*` se inyectan en **build time** (Railway las pasa como build args al Dockerfile): al cambiarlas hay que redeployar la web.

### Seed en Railway

```bash
railway ssh --service api -- sh -c "cd /app && pnpm --filter @vedere/db exec tsx prisma/seed.ts"
# sólo admin + datos de tienda (promos, ópticas socias, cupones), sin tocar el catálogo:
railway ssh --service api -- sh -c "cd /app && SEED_CATALOGO=false pnpm --filter @vedere/db exec tsx prisma/seed.ts"
# sólo admin:
railway ssh --service api -- sh -c "cd /app && SEED_CATALOGO=false SEED_TIENDA=false pnpm --filter @vedere/db exec tsx prisma/seed.ts"
# con usuarios OPTICA de prueba (uno por óptica socia, email optica-<slug>@vedere.com.ar):
railway ssh --service api -- sh -c "cd /app && SEED_CATALOGO=false OPTICA_PASSWORD='clave-larga-de-prueba' pnpm --filter @vedere/db exec tsx prisma/seed.ts"
```

## Flujo de trabajo con Git

- `main`: producción. Protegida: sin force-push ni borrado, CI obligatorio. Push a `main` → deploy automático.
- `develop`: integración. PRs de feature → `develop` → PR a `main`.
