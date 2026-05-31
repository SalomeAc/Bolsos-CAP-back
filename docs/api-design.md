# Diseño de la API — Bolsos-CAP

Propuesta de diseño para revisión y aprobación. El foco es el **modelo de personalización (Cotizaciones)**, prioridad inmediata. La IA (Gemini) se deja preparada pero se implementa después.

> **Decisiones confirmadas con el equipo (2026-05-27):**
> 1. **Cotizar requiere login** — la cotización se asocia siempre a un `User`.
> 2. **Chat en tiempo real con Socket.io** (con persistencia en Mongo).
> 3. **Pedido como entidad `Order` separada**, creada al aceptar la cotización.
> 4. **Máquina de estados** de la cotización: tal como se propone aquí (incluye estados de IA).

---

## 1. Convenciones

- Base: `/api`. JSON en request/response.
- Auth: header `Authorization: Bearer <jwt>` para rutas protegidas.
- Roles: `isAdmin` en el usuario. Middleware propuesto `requireAdmin` (además del actual `authenticateToken`).
- Patrón: nuevas entidades siguen `Global*` → `model` → `DAO (extiende GlobalDAO)` → `controller (extiende GlobalController)` → `routes`.

---

## 2. Catálogo (Productos) — ajustes

El modelo `Product` actual sirve como **catálogo gestionado por la administradora**. Cambios propuestos:

- `GET /api/products` y `GET /api/products/:id` → **públicos**.
- `POST/PUT/DELETE /api/products` → **solo-admin** (`authenticateToken` + `requireAdmin`).
- Revisar si `photo` debe seguir siendo `required` (la foto del cliente va en la Cotización, no aquí).

| Método | Ruta | Auth | Acción |
|--------|------|------|--------|
| GET | `/api/products` | No | Lista catálogo (con filtros por `type`, `color`, etc.) |
| GET | `/api/products/:id` | No | Detalle de un producto |
| POST | `/api/products` | Admin | Crear producto del catálogo |
| PUT | `/api/products/:id` | Admin | Actualizar producto |
| DELETE | `/api/products/:id` | Admin | Eliminar producto |

---

## 3. Modelo de personalización — `Quotation` (Cotización)

Modelo unificado que soporta las **dos modalidades** descritas.

### 3.1 Esquema propuesto

```js
const QuotationSchema = new mongoose.Schema(
  {
    // Modalidad de cotización
    kind: {
      type: String,
      enum: ["catalog", "custom"], // catálogo personalizado | producto personalizado
      required: true,
    },

    // Quién cotiza — cotizar requiere login (decisión confirmada)
    user: { type: ObjectId, ref: "User", required: true },

    // --- Modalidad "catalog" ---
    product: { type: ObjectId, ref: "Product" },    // requerido si kind === "catalog"
    customization: {                                 // opciones elegidas sobre el producto
      type: String,      // tipo de bolso
      color: String,
      size: String,      // "tamaño"
    },

    // --- Modalidad "custom" ---
    customProduct: {                                 // requerido si kind === "custom"
      description: String,
      color: String,
      dimensions: String,
      materials: [String],
      photo: String,     // foto de referencia que aporta el cliente
    },

    quantity: { type: Number, default: 1, min: 1 },
    notes: String,        // mensaje libre del cliente

    // --- Flujo / estado --- (máquina de estados confirmada)
    status: {
      type: String,
      enum: [
        "pendiente",        // creada por el cliente
        "cotizada_ia",      // la IA generó propuesta (fase 4)
        "en_revision",      // la administradora la está ajustando
        "cotizada",         // enviada al cliente
        "aceptada",
        "rechazada",
        "en_produccion",
        "completada",
        "cancelada",
      ],
      default: "pendiente",
    },

    // Propuesta de IA (fase 4)
    aiQuotation: {
      amount: Number,
      currency: { type: String, default: "COP" },
      breakdown: String,
      model: String,
      generatedAt: Date,
    },

    // Cotización final de la administradora
    finalQuotation: {
      amount: Number,
      currency: { type: String, default: "COP" },
      notes: String,
      quotedBy: { type: ObjectId, ref: "User" },
      quotedAt: Date,
    },
  },
  { timestamps: true }
);
```

Validaciones condicionales (en el modelo o el controller):
- `kind === "catalog"` ⇒ `product` requerido.
- `kind === "custom"` ⇒ `customProduct.description` (y campos mínimos) requeridos.

### 3.2 Endpoints `/api/quotations`

| Método | Ruta | Auth | Acción |
|--------|------|------|--------|
| POST | `/api/quotations` | Cliente | Crear cotización (catálogo o personalizada) — requiere login |
| GET | `/api/quotations` | Admin | Listar todas (con filtro por `status`) |
| GET | `/api/quotations/mine` | Cliente | Listar las del usuario autenticado |
| GET | `/api/quotations/:id` | Dueño/Admin | Detalle |
| PUT | `/api/quotations/:id/ai-quote` | Admin (fase 4) | Disparar/guardar propuesta de IA |
| PUT | `/api/quotations/:id/quote` | Admin | Fijar cotización final (`finalQuotation`) → `status: cotizada` |
| PUT | `/api/quotations/:id/respond` | Cliente | Aceptar / rechazar (`aceptada`/`rechazada`) |
| PUT | `/api/quotations/:id/status` | Admin | Actualizar estado de producción |
| DELETE | `/api/quotations/:id` | Admin | Eliminar/cancelar |

### 3.3 Métodos por capa (patrón `Global*`)

**`quotationDAO` (extiende `GlobalDAO`)** — hereda `create/read/update/delete/getAll`; añade:
- `findByUser(userId)`
- `findByStatus(status)`
- `setFinalQuotation(id, data)` (opcional, o usar `update`)

**`quotationController` (extiende `GlobalController`)** — hereda CRUD base; añade:
- `createQuotation(req, res)` — valida `kind` y campos condicionales.
- `getMyQuotations(req, res)`
- `setAiQuotation(req, res)` *(fase 4)*
- `setFinalQuotation(req, res)`
- `respondQuotation(req, res)` — aceptar/rechazar (solo el dueño).
- `updateStatus(req, res)` — admin.

---

## 4. Chat / mensajería — tiempo real (Socket.io) ✅

Mensajería en vivo entre cliente y administradora, asociada a una cotización, con **persistencia en Mongo**.

**Persistencia** — colección `Message`:

```js
const MessageSchema = new mongoose.Schema(
  {
    quotation: { type: ObjectId, ref: "Quotation", required: true },
    sender:    { type: ObjectId, ref: "User", required: true },
    role:      { type: String, enum: ["user", "admin"], required: true },
    body:      { type: String, required: true },
    readAt:    Date,
  },
  { timestamps: true }
);
```

**Socket.io:**
- Una **sala por cotización** (`room = quotation:<id>`).
- Handshake autenticado con el **mismo JWT** (`Authorization`/`auth.token`); rechazar si no valida.
- Eventos propuestos: `join` (unirse a la sala de una cotización del propio usuario o, si es admin, cualquiera), `message:send`, `message:new` (broadcast), `message:read`.
- Cada `message:send` se **persiste** antes de hacer broadcast.
- Endpoint REST de respaldo para cargar el historial al abrir el chat: `GET /api/quotations/:id/messages`.

**Infra:** instanciar `http.createServer(app)` + `Server` de Socket.io en `index.js`; CORS alineado con el frontend (Bolsos CAP).

---

## 5. Pedidos / seguimiento — entidad `Order` separada ✅

Al **aceptar** la cotización se crea un `Order` con su propio ciclo de vida e historial de estados.

```js
const OrderSchema = new mongoose.Schema(
  {
    quotation: { type: ObjectId, ref: "Quotation", required: true, unique: true },
    user:      { type: ObjectId, ref: "User", required: true },
    amount:    Number,                 // tomado de la finalQuotation aceptada
    currency:  { type: String, default: "COP" },
    status: {
      type: String,
      enum: ["en_produccion", "completada", "cancelada"],
      default: "en_produccion",
    },
    statusHistory: [
      { status: String, note: String, at: { type: Date, default: Date.now } },
    ],
  },
  { timestamps: true }
);
```

Endpoints `/api/orders`:

| Método | Ruta | Auth | Acción |
|--------|------|------|--------|
| GET | `/api/orders` | Admin | Listar pedidos (filtro por `status`) |
| GET | `/api/orders/mine` | Cliente | Pedidos del usuario autenticado |
| GET | `/api/orders/:id` | Dueño/Admin | Detalle |
| PUT | `/api/orders/:id/status` | Admin | Avanzar estado de producción (agrega a `statusHistory`) |

- El `Order` se crea automáticamente cuando `respondQuotation` marca la cotización como `aceptada`.
- Notificaciones de estado al cliente: reutilizar `utils/mailer.js` (nodemailer/Gmail) en cada cambio de `status`.
- `Quotation.status` y `Order.status` se mantienen coherentes (`aceptada` ⇒ existe `Order`).

---

## 6. Integración IA — Gemini (fase posterior)

- `utils/gemini.js`: cliente que recibe los datos de la cotización + contexto de la administradora y devuelve una propuesta.
- Se invoca al crear la cotización (o bajo demanda del admin) y rellena `aiQuotation`.
- La administradora **siempre** revisa antes de enviar (`aiQuotation` ≠ `finalQuotation`).
- Variable de entorno nueva: `GEMINI_API_KEY`.

---

## 7. Conexión a base de datos — revisión (verificada en vivo)

Conexión a Atlas **probada con éxito** el 2026-05-27. Detalle completo de colecciones, índices y hallazgos en **[`database.md`](./database.md)**. Resumen:

- BD en uso: **`test`** (el `MONGO_URI` no especifica nombre de BD → Mongoose usa `test`). Recomendado fijar `/bolsoscap`.
- Colecciones existentes: `users` (índices `email` único, `googleId` único+sparse) y `products` (índice `code` único). Coinciden con los modelos.
- Faltan `EMAIL_USER`/`EMAIL_PASS` en `.env` → el mailer fallará.
- `index.js` llama `connectDB()` **sin `await`**: arranca aunque Mongo no conecte. Recomendado `await connectDB()` antes de `app.listen`.
- Las nuevas colecciones (`quotations`, `messages`, `orders`) sólo requieren nuevos modelos Mongoose, sin cambios en la conexión.

---

## 8. Plan de implementación

### Fase 1 — Cotizaciones (PRIORIDAD)
1. **Auth de admin:** middleware `requireAdmin` y proteger el CRUD de productos (GET público).
2. **Modelo** `api/models/quotation.js` con validaciones condicionales por `kind` (`user` requerido).
3. **DAO** `api/dao/quotationDAO.js` extendiendo `GlobalDAO`.
4. **Controller** `api/controllers/quotationController.js` extendiendo `GlobalController`.
5. **Rutas** `api/routes/quotationRoutes.js` montadas en `routes.js` (`/api/quotations`), protegidas con `authenticateToken`.
6. **Validaciones** de las dos modalidades y de transiciones de estado.

### Fase 2 — Chat en tiempo real
7. `npm i socket.io`. Servidor Socket.io en `index.js` (`http.createServer(app)`).
8. Modelo `api/models/message.js` + persistencia.
9. Autenticación del handshake con JWT; salas por cotización; eventos `join/message:send/message:new/message:read`.
10. Endpoint REST `GET /api/quotations/:id/messages` para historial.

### Fase 3 — Pedidos y seguimiento
11. Modelo `api/models/order.js` (DAO/controller `Global*`, rutas `/api/orders`).
12. Crear `Order` automáticamente al aceptar la cotización.
13. Notificaciones por correo en cada cambio de estado (`utils/mailer.js`).

### Fase 4 — IA (Gemini)
14. `utils/gemini.js`, variable `GEMINI_API_KEY`, rellenar `aiQuotation`; la administradora siempre refina antes de enviar.

> Esquema, chat y pedidos ya están confirmados con el equipo (ver decisiones al inicio del documento).
