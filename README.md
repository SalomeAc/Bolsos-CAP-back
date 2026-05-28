# Bolsos-CAP-back

Backend (API REST) de **Bolsos-CAP**. Plataforma tipo *e-commerce* para **bolsos tejidos a crochet**: como cada pieza es hecha a mano, **no hay precios fijos**, todo se vende por **cotización**.

> El frontend del proyecto se llama **Lumo**. La administradora (admin) gestiona el catálogo, refina cotizaciones y administra pedidos.

## Tabla de contenidos

- [Visión del producto](#visión-del-producto)
- [Estado del proyecto](#estado-del-proyecto)
- [Tecnologías](#tecnologías)
- [Instalación](#instalación)
- [Configuración (`.env`)](#configuración-env)
- [Ejecución](#ejecución)
- [Estructura del proyecto](#estructura-del-proyecto)
- [Convenciones de la API](#convenciones-de-la-api)
- [Autenticación](#autenticación)
- [Endpoints — resumen](#endpoints--resumen)
- [Referencia detallada](#referencia-detallada)
  - [Usuarios (`/api/users`)](#usuarios-apiusers)
  - [Productos (`/api/products`)](#productos-apiproducts)
  - [Cotizaciones (`/api/quotations`)](#cotizaciones-apiquotations)
- [Modelos de datos](#modelos-de-datos)
- [Colección de Postman](#colección-de-postman)
- [Documentación adicional](#documentación-adicional)

---

## Visión del producto

- Cualquier visitante puede explorar el **catálogo** (color, material, tamaño, descripción) **sin loguearse**.
- El cliente puede pedir **dos tipos de cotización** (requiere login):
  1. **Sobre un producto del catálogo**, personalizándolo por tipo, color y tamaño.
  2. **Producto personalizado** que no está en el catálogo (foto de referencia, descripción, color, dimensiones y materiales).
- La solicitud llega a la **administradora** vía chat. Una **IA (Gemini)** generará una cotización preliminar; la administradora la **refina** y responde.
- El cliente **acepta o rechaza**. Al aceptar se genera el pedido y se envían **actualizaciones de estado**.

## Estado del proyecto

✅ **Implementado** y verificado contra MongoDB Atlas:
- Usuarios (registro local, login con Google, recuperación de contraseña, perfil, `deactivate`, `delete`, `isAdmin`).
- Catálogo de productos (lectura pública, mutaciones solo-admin con middleware `requireAdmin`).
- Cotizaciones (`kind: catalog` y `kind: custom`) con máquina de estados completa.

⏳ **Próximas fases** (ver `features.md`):
- **Fase 2** — Chat en tiempo real con Socket.io.
- **Fase 3** — Pedidos (entidad `Order` separada) y notificaciones por correo.
- **Fase 4** — Cotización automática con IA (Gemini).

## Tecnologías

- Node.js + [Express 5](https://expressjs.com/) (CommonJS)
- MongoDB Atlas con [Mongoose](https://mongoosejs.com/) 9
- Autenticación con JSON Web Tokens (`jsonwebtoken`)
- Hash de contraseñas con `bcrypt`
- Login con Google (`google-auth-library`)
- Envío de correos con `nodemailer` (Gmail)
- CORS habilitado para el frontend

## Instalación

```bash
git clone <url-del-repo>
cd Bolsos-CAP-back
npm install
```

## Configuración (`.env`)

Crea un archivo `.env` en la raíz con las siguientes variables:

```env
MONGO_URI=mongodb+srv://<user>:<pass>@<cluster>.mongodb.net/bolsoscap?retryWrites=true&w=majority
JWT_SECRET=tu_secreto_jwt
PORT=3000
GOOGLE_CLIENT_ID=tu_google_client_id
EMAIL_USER=tu_correo@gmail.com
EMAIL_PASS=tu_app_password_de_gmail
NODE_ENV=development
```

> 💡 **Importante:** si el `MONGO_URI` no incluye el nombre de BD tras el host (p. ej. `/bolsoscap`), Mongoose usará `test` por defecto. Ver `docs/database.md`.
>
> `.env` está en `.gitignore` y no debe versionarse.

## Ejecución

```bash
node index.js
```

El servidor queda disponible en `http://localhost:3000` (o el puerto definido en `PORT`).

## Estructura del proyecto

```
api/
├── config/database.js              Conexión a MongoDB (connectDB/disconnectDB)
├── routes/                         routes.js, userRoutes, productRoutes, quotationRoutes
├── middlewares/auth.js             authenticateToken (verifica JWT)
├── middlewares/requireAdmin.js     Verifica isAdmin (después de authenticateToken)
├── controllers/                    globalController → userController, quotationController; productController
├── dao/                            globalDAO → userDAO, quotationDAO; productDAO
├── models/                         user.js, product.js, quotation.js
└── utils/mailer.js                 Envío de correos (nodemailer/Gmail)

docs/
├── api-design.md                   Diseño de la API y plan de implementación
└── database.md                     Estado real de la BD y modelo de datos

postman/
├── Bolsos-CAP.postman_collection.json
└── Bolsos-CAP.postman_environment.json

features.md                         Visión, diferencias con el código y roadmap
index.js                            Arranque del servidor
```

El módulo de usuarios y cotizaciones usa un patrón de clases base (`GlobalController` / `GlobalDAO`) que las entidades concretas extienden. El módulo de productos está implementado con funciones sueltas (deuda técnica para alinear con el patrón).

---

## Convenciones de la API

| | |
|---|---|
| **Base URL** | `http://localhost:3000/api` |
| **Formato** | JSON (`Content-Type: application/json`) |
| **Auth** | `Authorization: Bearer <jwt>` |
| **Charset** | UTF-8 |

**Códigos HTTP usados:**

| Código | Significado |
|--------|-------------|
| `200` | OK |
| `201` | Creado |
| `400` | Solicitud inválida (faltan campos, validación, formato) |
| `401` | Sin autenticar (token faltante o inválido) |
| `403` | No autorizado (rol insuficiente, no es el dueño, cuenta desactivada) |
| `404` | Recurso no encontrado |
| `409` | Conflicto (email duplicado, transición de estado inválida) |
| `500` | Error interno |

**Forma de los errores:**
- Endpoints de usuarios y cotizaciones: `{ "message": "..." }`
- Endpoints de productos (legacy): `{ "error": "..." }`

## Autenticación

JWT firmado con `JWT_SECRET`, expira en **1 hora**. Payload: `{ id, email, provider }`. El campo `isAdmin` **no** está en el token: el middleware `requireAdmin` lo consulta en la BD.

Flujo:

1. **Registro local:** `POST /api/users/register`. Crea el usuario; **no** devuelve token (no hay login local todavía — es una decisión intencional del producto).
2. **Login con Google:** `POST /api/users/login` con el `idToken` del frontend → devuelve `{ token }`.
3. Las llamadas autenticadas envían `Authorization: Bearer <token>`.

```
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

---

## Endpoints — resumen

🔒 = requiere login · 👑 = requiere admin (`isAdmin: true`)

### `/api/users`

| Método | Ruta                      | Auth | Descripción |
|--------|---------------------------|------|-------------|
| POST   | `/register`               | —    | Registro local |
| POST   | `/login`                  | —    | Login con Google |
| POST   | `/recover-password`       | —    | Envía correo de recuperación |
| POST   | `/reset-password/:token`  | —    | Restablece la contraseña |
| GET    | `/user-profile`           | 🔒   | Perfil del usuario autenticado |
| PUT    | `/update-profile`         | 🔒   | Actualiza el perfil |
| PUT    | `/deactivate`             | 🔒   | Desactiva la cuenta |
| DELETE | `/delete-user`            | 🔒   | Elimina la cuenta |

### `/api/products`

| Método | Ruta     | Auth  | Descripción |
|--------|----------|-------|-------------|
| GET    | `/`      | —     | Lista del catálogo |
| GET    | `/:id`   | —     | Detalle |
| POST   | `/`      | 🔒👑  | Crea un producto |
| PUT    | `/:id`   | 🔒👑  | Actualiza un producto |
| DELETE | `/:id`   | 🔒👑  | Elimina un producto |

### `/api/quotations`

| Método | Ruta              | Auth                | Descripción |
|--------|-------------------|---------------------|-------------|
| POST   | `/`               | 🔒                  | Crea cotización (`kind: catalog` o `custom`) |
| GET    | `/mine`           | 🔒                  | Mis cotizaciones |
| GET    | `/:id`            | 🔒 (dueño o admin)  | Detalle |
| PUT    | `/:id/respond`    | 🔒 (dueño)          | Acepta/rechaza (`status==="cotizada"`) |
| GET    | `/`               | 🔒👑                | Lista todas (filtro `?status=`) |
| PUT    | `/:id/quote`      | 🔒👑                | Fija cotización final → `status: cotizada` |
| PUT    | `/:id/ai-quote`   | 🔒👑                | Guarda propuesta IA → `status: cotizada_ia` |
| PUT    | `/:id/status`     | 🔒👑                | Avanza estado (revisión/producción) |
| DELETE | `/:id`            | 🔒👑                | Elimina cotización |

---

## Referencia detallada

### Usuarios (`/api/users`)

#### `POST /api/users/register` — Registro local

**Body:**
```json
{
  "firstName": "Ana",
  "lastName": "Pérez",
  "age": 22,
  "email": "ana@ejemplo.com",
  "password": "Aa1!segura",
  "confirmPassword": "Aa1!segura"
}
```

**Validaciones:**
- `password` ≥ 8 caracteres, con al menos 1 mayúscula, 1 minúscula, 1 número y 1 carácter especial.
- `age` ≥ 13.
- `password` y `confirmPassword` deben coincidir.

**Respuestas:**
- `201` `{ "message": "Registro exitoso" }`
- `400` `{ "message": "Las contraseñas no coinciden" }` · `"Todos los campos son obligatorios"` · mensaje de validación del schema.
- `409` `{ "message": "Email ya registrado" }`

---

#### `POST /api/users/login` — Login con Google

**Body** (acepta `idToken`, `credential` o `token` como llave):
```json
{ "idToken": "<google-id-token>" }
```

**Respuestas:**
- `200` `{ "message": "Login con Google exitoso", "token": "<jwt>" }`
- `400` `{ "message": "Token de Google requerido" }`
- `401` `{ "message": "Token de Google inválido" }` o `"No se pudo validar la cuenta de Google"`
- `403` `{ "message": "Usuario desactivado" }`

> Si el correo de Google no existe en la BD, **se crea** el usuario automáticamente (`authProvider: "google"`, `isActive: true`, `isAdmin: false`).

---

#### `POST /api/users/recover-password` — Pedir correo de recuperación

**Body:** `{ "email": "ana@ejemplo.com" }`

**Respuestas:**
- `200` `{ "message": "Email de recuperar contraseña enviado" }`
- `400` `{ "message": "Email es requerido" }`
- `404` `{ "message": "Usuario no encontrado" }`

> ⚠️ Requiere `EMAIL_USER` / `EMAIL_PASS` en `.env`. El enlace generado apunta a `https://lumo-front-jtug.vercel.app/reset-password/?token=...` (frontend) y expira en 1 hora.

---

#### `POST /api/users/reset-password/:token` — Restablecer contraseña

**Body:** `{ "password": "Nuevo123!", "confirmPassword": "Nuevo123!" }`

**Respuestas:**
- `200` `{ "message": "Password has been reset successfully" }`
- `400` `{ "message": "Token no válida o expirada" }` · `"Las contraseñas no coinciden"` · validación.

> Tras un cambio exitoso, se envía un correo de confirmación al usuario.

---

#### `GET /api/users/user-profile` 🔒 — Perfil del usuario autenticado

**Respuesta `200`:**
```json
{
  "firstName": "Ana",
  "lastName": "Pérez",
  "age": 22,
  "email": "ana@ejemplo.com"
}
```
`404` `{ "message": "Usuario no encontrado" }`

---

#### `PUT /api/users/update-profile` 🔒 — Actualizar perfil

**Body** (todos opcionales; si se envía `password` debe ir con `confirmPassword`):
```json
{ "firstName": "Ana María", "password": "Nueva123!", "confirmPassword": "Nueva123!" }
```

**Respuestas:**
- `200` `{ "message": "Perfil exitosamente actualizado" }`
- `400` `{ "message": "Las contraseñas no coinciden" }` o validación.
- `409` `{ "message": "Email ya registrado" }`

> La nueva contraseña se hashea automáticamente (hook `post("findOneAndUpdate")`).

---

#### `PUT /api/users/deactivate` 🔒 — Desactivar cuenta

Sin body. Marca `isActive: false`.
**Respuesta `200`:** `{ "message": "Usuario desactivado" }`

---

#### `DELETE /api/users/delete-user` 🔒 — Eliminar cuenta

Sin body. Borra al usuario autenticado.
- `200` `{ "message": "Perfil exitosamente borrado" }`
- `404` `{ "message": "Usuario no encontrado" }`

---

### Productos (`/api/products`)

#### `GET /api/products` — Lista pública

Respuesta `200`:
```json
[
  {
    "_id": "6a178e0c3b8b82e42725f301",
    "name": "Bolso Elegante",
    "description": "Bolso blanco",
    "color": "Blanco",
    "dimensions": "30x20 cm",
    "materials": ["Hilo de algodón"],
    "type": "Bolso",
    "photo": "https://...",
    "code": "PRD-432856"
  }
]
```

#### `GET /api/products/:id` — Detalle público

- `200` Producto.
- `404` `{ "error": "Producto no encontrado" }`

---

#### `POST /api/products` 🔒👑 — Crear producto

**Body:**
```json
{
  "name": "Bolso Andina",
  "description": "Tejido en crochet 100% algodón",
  "color": "Azul",
  "dimensions": "30x20 cm",
  "materials": ["Algodón"],
  "type": "Bandolera",
  "photo": "https://example.com/img.jpg"
}
```
`code` es opcional; si no se envía se autogenera como `PRD-XXXXXX` (6 dígitos).

**Respuestas:**
- `201` Producto creado.
- `400` `{ "error": "..." }` (validación de Mongoose: campos requeridos).
- `401` Token faltante · `403` No es admin.

---

#### `PUT /api/products/:id` 🔒👑 — Actualizar producto

**Body:** los campos a actualizar (parcial).
- `200` Producto actualizado.
- `404` `{ "error": "Producto no encontrado" }`
- `400` `{ "error": "..." }` validación.

#### `DELETE /api/products/:id` 🔒👑 — Eliminar producto

- `200` `{ "message": "Producto eliminado" }`
- `404` `{ "error": "Producto no encontrado" }`

---

### Cotizaciones (`/api/quotations`)

Todas las rutas requieren `Authorization: Bearer <jwt>`. La cotización siempre se asocia al usuario autenticado (`user` se ignora si el cliente lo envía en el body).

**Máquina de estados:**

```
pendiente ──► cotizada_ia ──► en_revision ──► cotizada ──► aceptada ──► en_produccion ──► completada
                                                  └─► rechazada                        └─► cancelada
```

#### `POST /api/quotations` 🔒 — Crear cotización

**Body — modalidad `catalog`** (sobre un producto del catálogo):
```json
{
  "kind": "catalog",
  "product": "6a178e0c3b8b82e42725f301",
  "customization": { "type": "Bandolera", "color": "Azul", "size": "30x20" },
  "quantity": 1,
  "notes": "¿Posible asa más larga?"
}
```

**Body — modalidad `custom`** (producto personalizado, fuera del catálogo):
```json
{
  "kind": "custom",
  "customProduct": {
    "description": "Bolso grande con asas largas",
    "color": "Beige",
    "dimensions": "40x30 cm",
    "materials": ["Algodón", "Lino"],
    "photo": "https://example.com/ref.jpg"
  },
  "quantity": 1,
  "notes": "Lo necesito para junio"
}
```

**Validaciones:**
- `kind` ∈ `["catalog", "custom"]`.
- `catalog` → `product` requerido.
- `custom` → `customProduct.description`, `color`, `dimensions` y `materials` (con al menos 1 ítem) requeridos.
- `quantity` ≥ 1 (default 1).

**Respuestas:**
- `201` La cotización creada con `status: "pendiente"` y `user` igual al autenticado.
- `400` `{ "message": "El tipo de cotización debe ser 'catalog' o 'custom'" }` · `"Una cotización de catálogo requiere el producto"` · `"Una cotización personalizada requiere descripción, color, dimensiones y materiales"` · `"La cantidad mínima es 1"`.

---

#### `GET /api/quotations/mine` 🔒 — Mis cotizaciones

Lista de las cotizaciones del usuario autenticado, ordenadas por `createdAt` desc.

**Respuesta `200`:** `[ Quotation, ... ]`

---

#### `GET /api/quotations/:id` 🔒 — Detalle

Sólo el dueño o un admin pueden ver el detalle.

- `200` Quotation
- `403` `{ "message": "No autorizado" }`
- `404` `{ "message": "Cotización no encontrada" }`

---

#### `PUT /api/quotations/:id/respond` 🔒 — Aceptar/rechazar (cliente)

**Body:** `{ "decision": "aceptada" }` o `{ "decision": "rechazada" }`

**Reglas:**
- Sólo el dueño puede responder.
- Sólo permitido cuando `status === "cotizada"`.

**Respuestas:**
- `200` Quotation con `status: "aceptada" | "rechazada"`.
- `400` `{ "message": "La decisión debe ser 'aceptada' o 'rechazada'" }`
- `403` `{ "message": "No autorizado" }`
- `409` `{ "message": "Solo se puede responder una cotización en estado 'cotizada'" }`

---

#### `GET /api/quotations` 🔒👑 — Listar todas (admin)

Soporta filtros por query string sobre cualquier campo. Ejemplos:

```
GET /api/quotations?status=pendiente
GET /api/quotations?kind=custom
```

**Respuesta `200`:** `[ Quotation, ... ]`

---

#### `PUT /api/quotations/:id/quote` 🔒👑 — Cotizar (admin)

**Body:**
```json
{ "amount": 120000, "currency": "COP", "notes": "Incluye envío" }
```
`currency` por defecto `"COP"`.

**Efecto:** guarda `finalQuotation` (con `quotedBy: <admin.id>`, `quotedAt: now`) y pasa `status` a `"cotizada"`.

**Respuestas:**
- `200` Quotation actualizada.
- `400` `{ "message": "El monto de la cotización es requerido" }`
- `404` `{ "message": "Cotización no encontrada" }`

---

#### `PUT /api/quotations/:id/ai-quote` 🔒👑 — Guardar propuesta IA (admin)

> Fase 4 — endpoint listo, todavía sin llamada a Gemini.

**Body:**
```json
{ "amount": 100000, "currency": "COP", "breakdown": "materiales + horas", "model": "gemini-1.5" }
```

**Efecto:** guarda `aiQuotation` (con `generatedAt: now`) y pasa `status` a `"cotizada_ia"`.

---

#### `PUT /api/quotations/:id/status` 🔒👑 — Avanzar estado (admin)

**Body:** `{ "status": "en_revision" | "en_produccion" | "completada" | "cancelada" }`

**Respuestas:**
- `200` Quotation actualizada.
- `400` `{ "message": "Estado no permitido. Use uno de: en_revision, en_produccion, completada, cancelada" }`
- `404` `{ "message": "Cotización no encontrada" }`

---

#### `DELETE /api/quotations/:id` 🔒👑 — Eliminar cotización

- `200` `{ "message": "Item deleted successfully" }`
- `404` `{ "message": "Item not found" }`

---

## Modelos de datos

### Usuario

| Campo | Tipo | Notas |
|-------|------|-------|
| `firstName`, `lastName` | String | Requeridos |
| `age` | Number | ≥13; opcional para usuarios de Google |
| `email` | String | Único y validado |
| `password` | String | Requerida y validada (no aplica a Google); hasheada con bcrypt |
| `authProvider` | String | `local` o `google` |
| `googleId` | String | Único, sparse |
| `isActive` | Boolean | default `true` |
| `isAdmin` | Boolean | default `false` |

### Producto

| Campo | Tipo | Notas |
|-------|------|-------|
| `name` | String | Requerido (trim) |
| `description` | String | Requerido |
| `color` | String | Requerido |
| `dimensions` | String | Requerido ("tamaño") |
| `materials` | [String] | Requerido |
| `type` | String | Requerido |
| `photo` | String | Requerido (URL) |
| `code` | String | Único; autogenerado (`PRD-XXXXXX`) |

### Cotización

| Campo | Tipo | Notas |
|-------|------|-------|
| `kind` | `catalog`\|`custom` | Modalidad. Requerido |
| `user` | ObjectId → `User` | Requerido |
| `product` | ObjectId → `Product` | Requerido si `kind=catalog` |
| `customization` | `{ type, color, size }` | Opciones elegidas (catálogo) |
| `customProduct` | `{ description, color, dimensions, materials[], photo }` | Requerido si `kind=custom` |
| `quantity` | Number | default 1, min 1 |
| `notes` | String | Mensaje libre |
| `status` | enum | `pendiente` · `cotizada_ia` · `en_revision` · `cotizada` · `aceptada` · `rechazada` · `en_produccion` · `completada` · `cancelada` |
| `aiQuotation` | `{ amount, currency, breakdown, model, generatedAt }` | Propuesta IA (fase 4) |
| `finalQuotation` | `{ amount, currency, notes, quotedBy, quotedAt }` | Cotización de la admin |
| `createdAt`/`updatedAt` | Date | Timestamps automáticos |

---

## Colección de Postman

En `postman/` se incluye:

- **`Bolsos-CAP.postman_collection.json`** — todos los endpoints organizados por carpeta (Usuarios, Productos, Cotizaciones), con descripción, body de ejemplo y *tests* que extraen automáticamente `token`, `productId` y `quotationId` a variables de la colección.
- **`Bolsos-CAP.postman_environment.json`** — environment con `baseUrl` y placeholders para `token`, `adminToken`, `productId` y `quotationId`.

### Cómo usar

1. En Postman → **Import** → arrastra los dos archivos.
2. Selecciona el environment **Bolsos-CAP – Local**.
3. Ajusta `baseUrl` (default `http://localhost:3000`).
4. Autenticación:
   - Si tienes un `idToken` de Google, ejecuta **Usuarios → Login con Google**; el `token` se guarda automáticamente.
   - Si no, mintea un JWT manualmente con tu `JWT_SECRET` y pégalo en la variable `token` del environment. Para acciones de admin, lo mismo con `adminToken`.
5. Los IDs (`productId`, `quotationId`) se setean automáticamente al ejecutar **Crear producto** / **Crear cotización (catálogo)**.

### Orden sugerido para probar el flujo de cotizaciones

1. **Productos → Listar productos** (público) — guarda `productId`.
2. **Cotizaciones → Crear cotización (catálogo)** (cliente) — guarda `quotationId`.
3. **Cotizaciones → Admin · Cotizar** (admin) — `status → cotizada`.
4. **Cotizaciones → Cliente · Aceptar/Rechazar** — `status → aceptada`.
5. **Cotizaciones → Admin · Avanzar estado** — `status → en_produccion → completada`.

---

## Documentación adicional

- **[`features.md`](./features.md)** — visión completa, diferencias entre la visión y el código, decisiones de arquitectura y roadmap.
- **[`docs/api-design.md`](./docs/api-design.md)** — diseño detallado de la API por capa y plan de implementación por fases.
- **[`docs/database.md`](./docs/database.md)** — estado real de la BD verificado en vivo, índices y diseño de las colecciones nuevas.
